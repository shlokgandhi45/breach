import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def create_db():
    conn = None
    try:
        # Connect to default postgres database
        conn = psycopg2.connect(
            dbname='postgres',
            user='postgres',
            password='password',
            host='localhost'
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        
        # Check if database exists
        cur.execute("SELECT 1 FROM pg_database WHERE datname='recruitment'")
        exists = cur.fetchone()
        
        if not exists:
            cur.execute('CREATE DATABASE recruitment')
            print("Database 'recruitment' created successfully.")
        else:
            print("Database 'recruitment' already exists.")
    except psycopg2.OperationalError:
        # Try without password
        try:
            conn = psycopg2.connect(
                dbname='postgres',
                user='postgres',
                password='',
                host='localhost'
            )
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM pg_database WHERE datname='recruitment'")
            exists = cur.fetchone()
            if not exists:
                cur.execute('CREATE DATABASE recruitment')
                print("Database 'recruitment' created (no password needed).")
            else:
                print("Database 'recruitment' already exists (no password needed).")
        except Exception as e2:
            print(f"Error (all attempts): {e2}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    create_db()
