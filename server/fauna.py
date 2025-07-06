import json
import uuid
import random
import time
import math
from db import db_write

# --- Fauna Configuration ---
FAUNA_AGE_STAGES = {"Infant": 120, "Young": 300, "Adult": 900, "Elderly": 0}
ADULT_SPAWN_CHANCE = 0.50 
REPRODUCTION_COOLDOWN = 60 # Cooldown in seconds (1 minute)
MAX_OFFSPRING = 3
ELDERLY_MIN_LIFESPAN = 60
ELDERLY_MAX_LIFESPAN = 300
DEAD_REMOVAL_TIME = 60
IDLE_GOAL_CHANCE = 0.25
TICK_RATE = 3

class FaunaManager:
    """Manages the lifecycle and AI for all fauna in the world."""

    def __init__(self, world_state, broadcast_callback):
        self.world_state = world_state
        self.broadcast = broadcast_callback

    async def update_fauna(self):
        """
        The main update logic for all fauna, called once per game loop tick.
        """
        current_time = time.time()
        fauna_to_add = []
        fauna_to_remove = []
        food_to_remove = []

        for fauna_id, fauna in list(self.world_state["fauna"].items()):
            if fauna["is_dead"]:
                if current_time > fauna["time_of_death"] + DEAD_REMOVAL_TIME:
                    fauna_to_remove.append(fauna_id)
                continue

            # --- Aging and Stage Progression ---
            fauna["age_seconds"] += TICK_RATE
            previous_stage = fauna["stage"]
            if fauna["stage"] == "Infant" and fauna["age_seconds"] > FAUNA_AGE_STAGES["Infant"]: fauna["stage"] = "Young"
            elif fauna["stage"] == "Young" and fauna["age_seconds"] > FAUNA_AGE_STAGES["Young"]: fauna["stage"] = "Adult"
            elif fauna["stage"] == "Adult" and fauna["age_seconds"] > FAUNA_AGE_STAGES["Adult"]:
                fauna["stage"] = "Elderly"
                fauna["death_timer"] = current_time + random.randint(ELDERLY_MIN_LIFESPAN, ELDERLY_MAX_LIFESPAN)
            
            if fauna["stage"] != previous_stage:
                db_write("UPDATE fauna SET stage = ?, age_seconds = ?, death_timer = ? WHERE id = ?", (fauna["stage"], fauna["age_seconds"], fauna.get("death_timer"), fauna_id))
                await self.broadcast(json.dumps({"type": "fauna_stage_changed", "fauna_id": fauna_id, "data": fauna}))

            # --- Goal-Oriented AI Logic ---
            if fauna["stage"] == "Young" and self.world_state["food"]:
                nearest_food_id, nearest_food_pos, min_dist = None, None, float('inf')
                for food_id, food_pos in self.world_state["food"].items():
                    dist = math.hypot(fauna['x'] - food_pos['x'], fauna['y'] - food_pos['y'])
                    if dist < min_dist:
                        min_dist, nearest_food_id, nearest_food_pos = dist, food_id, food_pos
                if nearest_food_pos:
                    fauna["goal"] = {"type": "seek_food", "x": nearest_food_pos["x"], "y": nearest_food_pos["y"], "food_id": nearest_food_id}
            
            elif not fauna.get("goal") and fauna["stage"] in ["Adult", "Elderly"]:
                if random.random() < IDLE_GOAL_CHANCE:
                    fauna["goal"] = {"type": "wander", "x": random.randint(16, 784), "y": random.randint(16, 584)}

            # --- Movement based on Goal ---
            if fauna.get("goal"):
                goal = fauna["goal"]
                goal_x, goal_y = goal["x"], goal["y"]
                
                if math.hypot(fauna['x'] - goal_x, fauna['y'] - goal_y) < 20:
                    if goal.get("type") == "seek_food" and goal.get("food_id") not in food_to_remove:
                        food_to_remove.append(goal["food_id"])
                        if random.random() < 0.25:
                            fauna["stage"] = "Adult"
                            db_write("UPDATE fauna SET stage = ? WHERE id = ?", (fauna["stage"], fauna_id))
                            await self.broadcast(json.dumps({"type": "fauna_stage_changed", "fauna_id": fauna_id, "data": fauna}))
                    fauna["goal"] = None
                else:
                    speed = 16 * (1 if fauna["stage"] == "Elderly" else 2)
                    if goal_x > fauna['x']: fauna['x'] += speed
                    elif goal_x < fauna['x']: fauna['x'] -= speed
                    if goal_y > fauna['y']: fauna['y'] += speed
                    elif goal_y < fauna['y']: fauna['y'] -= speed
                    db_write("UPDATE fauna SET x=?, y=?, goal=? WHERE id=?", (fauna['x'], fauna['y'], json.dumps(fauna['goal']), fauna_id))
                    await self.broadcast(json.dumps({"type": "fauna_moved", "fauna_id": fauna_id, "data": fauna}))

            # --- Reproduction & Death ---
            if fauna["stage"] == "Adult" and fauna["offspring_count"] < MAX_OFFSPRING:
                last_attempt = fauna.get("last_repro_attempt", 0)
                if current_time > last_attempt + REPRODUCTION_COOLDOWN:
                    fauna["last_repro_attempt"] = current_time
                    if random.random() < ADULT_SPAWN_CHANCE:
                        fauna["offspring_count"] += 1
                        # Generate a unique ID with timestamp to avoid collisions
                        new_id = f"dragon_{int(time.time())}_{uuid.uuid4().hex[:8]}"
                        new_data = {"x": fauna["x"], "y": fauna["y"], "kind": "dragon", "age_seconds": 0, "stage": "Infant", "is_dead": False, "time_of_death": None, "offspring_count": 0, "death_timer": None, "goal": None}
                        fauna_to_add.append((new_id, new_data))
                        try:
                            db_write("INSERT INTO fauna (id, kind, x, y, age_seconds, stage, is_dead, offspring_count, goal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", (new_id, new_data["kind"], new_data["x"], new_data["y"], 0, "Infant", False, 0, None))
                            db_write("UPDATE fauna SET offspring_count = ? WHERE id = ?", (fauna["offspring_count"], fauna_id))
                        except Exception as e:
                            print(f"Database error while spawning fauna: {e}")
                            # Remove from fauna_to_add if database write failed
                            fauna_to_add = [item for item in fauna_to_add if item[0] != new_id]
            
            if fauna["stage"] == "Elderly" and current_time > fauna.get("death_timer", float('inf')):
                fauna["is_dead"], fauna["time_of_death"] = True, current_time
                db_write("UPDATE fauna SET is_dead = ?, time_of_death = ? WHERE id = ?", (True, current_time, fauna_id))
                await self.broadcast(json.dumps({"type": "fauna_died", "fauna_id": fauna_id, "data": fauna}))
        
        return fauna_to_add, fauna_to_remove, food_to_remove
