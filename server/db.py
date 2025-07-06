import sqlite3
import json
import random
from typing import List, Dict, Any

DB_FILE = "project_arbor.db"

def init_db():
    """Initializes the database and creates tables if they don't exist."""
    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                name TEXT PRIMARY KEY,
                x REAL NOT NULL,
                y REAL NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS fauna (
                id TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                x REAL NOT NULL,
                y REAL NOT NULL,
                age_seconds INTEGER NOT NULL,
                stage TEXT NOT NULL,
                is_dead BOOLEAN NOT NULL,
                time_of_death REAL,
                offspring_count INTEGER NOT NULL,
                death_timer REAL,
                goal TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS food (
                id TEXT PRIMARY KEY,
                x REAL NOT NULL,
                y REAL NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS zone_tiles (
                x INTEGER NOT NULL,
                y INTEGER NOT NULL,
                tile_type INTEGER NOT NULL,
                PRIMARY KEY (x, y)
            )
        """)
        conn.commit()

def db_write(query: str, params: tuple = ()):
    """Helper function to write to the database."""
    with sqlite3.connect(DB_FILE) as conn:
        conn.execute(query, params)
        conn.commit()

def db_read(query: str, params: tuple = ()) -> List[Any]:
    """Helper function to read from the database."""
    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.execute(query, params)
        return cursor.fetchall()

def load_state_from_db() -> Dict[str, Any]:
    """Loads the entire game state from the database into memory."""
    state = {
        "players": {},
        "fauna": {},
        "food": {},
        "map": []
    }
    
    fauna_rows = db_read("SELECT * FROM fauna")
    for row in fauna_rows:
        state["fauna"][row[0]] = {
            "id": row[0], "kind": row[1], "x": row[2], "y": row[3], "age_seconds": row[4],
            "stage": row[5], "is_dead": bool(row[6]), "time_of_death": row[7],
            "offspring_count": row[8], "death_timer": row[9], "goal": json.loads(row[10]) if row[10] else None
        }

    food_rows = db_read("SELECT * FROM food")
    for row in food_rows:
        state["food"][row[0]] = {"x": row[1], "y": row[2]}

    map_rows = db_read("SELECT * FROM zone_tiles ORDER BY y, x")
    if not map_rows:
        return None 

    map_width = max(row[0] for row in map_rows) + 1
    map_height = max(row[1] for row in map_rows) + 1
    game_map = [[0] * map_width for _ in range(map_height)]
    for x, y, tile_type in map_rows:
        game_map[y][x] = tile_type
    state["map"] = game_map
    
    return state

def initialize_default_world():
    """Populates the database with a default world if it's empty."""
    print("Database is empty. Initializing default world...")
    game_map = [[0 if random.random() > 0.8 else 1 for _ in range(50)] for _ in range(38)]
    for y, row in enumerate(game_map):
        for x, tile_type in enumerate(row):
            db_write("INSERT INTO zone_tiles (x, y, tile_type) VALUES (?, ?, ?)", (x, y, tile_type))
    
    fauna_id = "dragon_1"
    fauna_data = {"x": 300, "y": 300, "kind": "dragon", "age_seconds": 0, "stage": "Infant", "is_dead": False, "time_of_death": None, "offspring_count": 0, "death_timer": None, "goal": None}
    db_write(
        "INSERT INTO fauna (id, kind, x, y, age_seconds, stage, is_dead, offspring_count, goal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (fauna_id, fauna_data["kind"], fauna_data["x"], fauna_data["y"], 0, "Infant", False, 0, None)
    )
    print("Default world created and saved.")
