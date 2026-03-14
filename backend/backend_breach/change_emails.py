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
        
        # If we didn't find 3, grab any 3
        if len(candidates) < 3:
            more = db.query(Candidate).filter(~Candidate.candidate_id.in_([c.candidate_id for c in candidates])).limit(3 - len(candidates)).all()
            candidates.extend(more)

        new_emails = ['ridhamshah538@gmail.com', 'khush09temp@gmail.com', 'saumyajjoshi10@gmail.com']
        
        print("=== UPDATED CANDIDATES ===")
        for i, candidate in enumerate(candidates):
            candidate.email = new_emails[i]
            print(f"- {candidate.full_name} | Role: {candidate.pipeline_stage} | Selected for: {new_emails[i]}")
            
        db.commit()
        print("Successfully updated emails.")

    except Exception as e:
        print(f"Error updating emails: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_candidate_emails()
