import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend_breach')))

from models.schema import SessionLocal, Candidate

def get_emails():
    db = SessionLocal()
    try:
        candidates = db.query(Candidate).filter(Candidate.email.in_([
            'ridhamshah538@gmail.com', 'khush09temp@gmail.com', 'saumyajjoshi10@gmail.com'
        ])).all()
        
        with open('assigned_emails.txt', 'w', encoding='utf-8') as f:
            if not candidates:
                f.write("No candidates found.\n")
            for c in candidates:
                f.write(f"- {c.full_name} is assigned to: {c.email}\n")
    finally:
        db.close()

if __name__ == "__main__":
    get_emails()
