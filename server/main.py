import json
import uuid
import random
import asyncio
import time
import math
from typing import List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from db import init_db, load_state_from_db, initialize_default_world, db_write, db_read
from fauna import FaunaManager, TICK_RATE, FAUNA_AGE_STAGES # Import the new manager, TICK_RATE, and FAUNA_AGE_STAGES

# --- FastAPI App and Game State Initialization ---
app = FastAPI()
init_db()
world_state = load_state_from_db()
if world_state is None:
    initialize_default_world()
    world_state = load_state_from_db()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.player_data = {}
    async def connect(self, websocket: WebSocket) -> str:
        await websocket.accept()
        player_id = str(uuid.uuid4().hex[:6])
        self.active_connections.append(websocket)
        self.player_data[websocket] = player_id
        return player_id
    def disconnect(self, websocket: WebSocket):
        if websocket in self.player_data:
            player_id = self.player_data[websocket]
            self.active_connections.remove(websocket)
            del self.player_data[websocket]
            return player_id
        return None
    async def broadcast(self, message: str):
        disconnected_connections = []
        for connection in self.active_connections[:]:  # Use slice to avoid modification during iteration
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Error sending message to connection: {e}")
                disconnected_connections.append(connection)
        
        # Clean up disconnected connections
        for connection in disconnected_connections:
            self.disconnect(connection)

manager = ConnectionManager()
# Create an instance of the FaunaManager
fauna_manager = FaunaManager(world_state, manager.broadcast)

async def game_loop():
    """The main server-side game loop."""
    while True:
        await asyncio.sleep(TICK_RATE)
        
        # The complex fauna logic is now handled by the manager
        fauna_to_add, fauna_to_remove, food_to_remove = await fauna_manager.update_fauna()

        # Update the world state based on the results from the manager
        for new_id, new_data in fauna_to_add:
            world_state["fauna"][new_id] = new_data
            await manager.broadcast(json.dumps({"type": "fauna_spawned", "fauna_id": new_id, "data": new_data}))
        for fauna_id in fauna_to_remove:
            if fauna_id in world_state["fauna"]:
                del world_state["fauna"][fauna_id]
                db_write("DELETE FROM fauna WHERE id = ?", (fauna_id,))
                await manager.broadcast(json.dumps({"type": "fauna_removed", "fauna_id": fauna_id}))
        for food_id in food_to_remove:
            if food_id in world_state["food"]:
                del world_state["food"][food_id]
                db_write("DELETE FROM food WHERE id = ?", (food_id,))
                await manager.broadcast(json.dumps({"type": "food_removed", "food_id": food_id}))

@app.on_event("startup")
async def startup_event_full():
    """On server startup, create the main game loop task."""
    asyncio.create_task(game_loop())

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    player_id = await manager.connect(websocket)
    player_name = "Anon"
    is_joined = False

    try:
        try:
            join_request_data = await websocket.receive_text()
            message = json.loads(join_request_data)
        except WebSocketDisconnect:
            print(f"Player {player_id} disconnected before sending join request.")
            manager.disconnect(websocket)
            return

        if message.get("type") == "player_join_request":
            player_name = message.get("name", "Anon")
            if any(p.get("name") == player_name for p in world_state["players"].values()):
                await websocket.send_text(json.dumps({"type": "error", "reason": "name_taken"}))
                await websocket.close()
                manager.disconnect(websocket)
                return

            player_row = db_read("SELECT x, y FROM users WHERE name = ?", (player_name,))
            if player_row:
                start_x, start_y = player_row[0]
            else:
                start_x, start_y = random.randint(50, 750), random.randint(50, 550)
                db_write("INSERT INTO users (name, x, y) VALUES (?, ?, ?)", (player_name, start_x, start_y))
            
            world_state["players"][player_id] = {"x": start_x, "y": start_y, "name": player_name}
            is_joined = True
            print(f"Player {player_name} ({player_id}) successfully joined.")

            await websocket.send_text(json.dumps({"type": "join_success"}))
            await websocket.send_text(json.dumps({"type": "world_state", "player_id": player_id, "world": world_state}))
            await manager.broadcast(json.dumps({"type": "player_joined", "player_id": player_id, "data": world_state["players"][player_id]}))
        else:
            print(f"Invalid first message from {player_id}. Closing.")
            await websocket.close()
            manager.disconnect(websocket)
            return

        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "player_chat":
                text = message.get("text", "")
                if text.startswith("/"):
                    if text == "/reset_zone":
                        print(f"Admin command '/reset_zone' issued by {player_name}")
                        world_state["food"].clear()
                        db_write("DELETE FROM food")
                        world_state["fauna"].clear()
                        db_write("DELETE FROM fauna")
                        for y in range(len(world_state["map"])):
                            for x in range(len(world_state["map"][y])):
                                world_state["map"][y][x] = 0
                        db_write("UPDATE zone_tiles SET tile_type = 0")
                        for i in range(3):
                            fauna_id = f"dragon_adult_{i}"
                            fauna_data = {"x": random.randint(50, 750), "y": random.randint(50, 550), "kind": "dragon", "age_seconds": FAUNA_AGE_STAGES["Young"] + 1, "stage": "Adult", "is_dead": False, "time_of_death": None, "offspring_count": 0, "death_timer": None, "goal": None}
                            world_state["fauna"][fauna_id] = fauna_data
                            db_write("INSERT INTO fauna (id, kind, x, y, age_seconds, stage, is_dead, offspring_count, goal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", (fauna_id, fauna_data["kind"], fauna_data["x"], fauna_data["y"], fauna_data["age_seconds"], "Adult", False, 0, None))
                        await manager.broadcast(json.dumps({"type": "world_reset", "world": world_state}))
                else:
                    await manager.broadcast(json.dumps({"type": "player_chatted", "player_id": player_id, "text": text}))
            elif message["type"] == "player_move":
                px, py = message["x"], message["y"]
                world_state["players"][player_id].update({"x": px, "y": py})
                await manager.broadcast(json.dumps({"type": "player_moved", "player_id": player_id, "data": world_state["players"][player_id]}))
            elif message["type"] == "action_till":
                tx, ty = message["tile"]["x"], message["tile"]["y"]
                if 0 <= ty < len(world_state["map"]) and 0 <= tx < len(world_state["map"][0]) and world_state["map"][ty][tx] == 0:
                    world_state["map"][ty][tx] = 1
                    db_write("UPDATE zone_tiles SET tile_type = 1 WHERE x = ? AND y = ?", (tx, ty))
                    await manager.broadcast(json.dumps({"type": "tile_updated", "tile": {"x": tx, "y": ty, "type": 1}}))
            elif message["type"] == "action_drop_food":
                food_id = f"food_{uuid.uuid4().hex[:6]}"
                pos = message["pos"]
                world_state["food"][food_id] = {"x": pos["x"], "y": pos["y"]}
                db_write("INSERT INTO food (id, x, y) VALUES (?, ?, ?)", (food_id, pos["x"], pos["y"]))
                await manager.broadcast(json.dumps({"type": "food_spawned", "food_id": food_id, "data": world_state["food"][food_id]}))

    except WebSocketDisconnect:
        print(f"Player {player_name} ({player_id}) disconnected.")
    except Exception as e:
        print(f"An error occurred for player {player_name} ({player_id}): {e}")
    finally:
        if is_joined and player_id in world_state["players"]:
            final_pos = world_state["players"][player_id]
            db_write("UPDATE users SET x = ?, y = ? WHERE name = ?", (final_pos["x"], final_pos["y"], player_name))
            del world_state["players"][player_id]
            await manager.broadcast(json.dumps({"type": "player_left", "player_id": player_id}))
        if websocket in manager.player_data:
            manager.disconnect(websocket)
