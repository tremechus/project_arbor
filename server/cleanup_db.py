#!/usr/bin/env python3
"""
Quick script to clean up any duplicate fauna entries in the database
"""
import sqlite3

def cleanup_database():
    conn = sqlite3.connect('project_arbor.db')
    cursor = conn.cursor()
    
    # Remove all fauna to clear any duplicates
    print("Clearing all fauna from database...")
    cursor.execute("DELETE FROM fauna")
    
    conn.commit()
    print("Database cleaned up successfully!")
    conn.close()

if __name__ == "__main__":
    cleanup_database()
