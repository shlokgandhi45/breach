import sqlite3
import os

# Get path to db
db_path = os.path.join(os.path.dirname(__file__), "recruitment.db")

print(f"Connecting to database at {db_path}...")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# SQLite doesn't directly support `ADD COLUMN IF NOT EXISTS`, so we check existing columns.
cursor.execute("PRAGMA table_info(candidates)")
columns = [info[1] for info in cursor.fetchall()]

try:
    if "is_duplicate" not in columns:
        print("Adding is_duplicate column...")
        cursor.execute("ALTER TABLE candidates ADD COLUMN is_duplicate VARCHAR(5) DEFAULT 'false' NOT NULL;")
        
    if "master_candidate_id" not in columns:
        print("Adding master_candidate_id column...")
        cursor.execute("ALTER TABLE candidates ADD COLUMN master_candidate_id CHAR(32);")
        
    if "dedup_merged_at" not in columns:
        print("Adding dedup_merged_at column...")
        cursor.execute("ALTER TABLE candidates ADD COLUMN dedup_merged_at DATETIME;")

    conn.commit()
    print("Migration successful.")
except Exception as e:
    print(f"Error during migration: {e}")
    conn.rollback()
finally:
    conn.close()
