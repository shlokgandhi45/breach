import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend/backend_breach')))

from sqlalchemy.orm import Session
from models.schema import SessionLocal, Candidate

def update_candidate_emails():
    db = SessionLocal()
    try:
        # Prioritize candidates in active pipeline stages for easy demonstration
        candidates = (
            db.query(Candidate)
            .filter(Candidate.pipeline_stage.in_(['Interview', 'Technical', 'Screening']))
            .limit(3)
            .all()
        )
        
        # If we didn't find 3, just grab any 3
        if len(candidates) < 3:
            more = db.query(Candidate).filter(~Candidate.candidate_id.in_([c.candidate_id for c in candidates])).limit(3 - len(candidates)).all()
            candidates.extend(more)

        if len(candidates) < 3:
            print("Not enough candidates found in the database.")
            return

        new_emails = ['ridhamshah538@gmail.com', 'khush09temp@gmail.com', 'saumyajjoshi10@gmail.com']
        
        for i, candidate in enumerate(candidates):
            old_email = candidate.email
            candidate.email = new_emails[i]
            print(f"Candidate: {candidate.full_name} | Role/Stage: {candidate.pipeline_stage} | Selected for: {new_emails[i]}")
            
        db.commit()
        print("Successfully updated emails.")

    except Exception as e:
        print(f"Error updating emails: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_candidate_emails()
