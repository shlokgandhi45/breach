
import sys
import random
from pathlib import Path
from datetime import datetime, timedelta, timezone

# Add parent to path so imports work
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from models.schema import SessionLocal, Candidate, Resume

PIPELINE_STAGES = ['Applied', 'Screening', 'Technical', 'Interview', 'Offer', 'Hired']
RESUME_SOURCES = ['pdf_upload', 'email', 'hrms', 'referral', 'linkedin']

def randomize_data():
    db: Session = SessionLocal()
    try:
        candidates = db.query(Candidate).all()
        print(f"Randomizing {len(candidates)} candidates...")
        
        now = datetime.now(timezone.utc)
        
        for c in candidates:
            # 1. Randomize Pipeline Stage
            stage = random.choices(
                PIPELINE_STAGES, 
                weights=[30, 25, 15, 15, 10, 5], 
                k=1
            )[0]
            c.pipeline_stage = stage
            
            # 2. Randomize Created At (Applied Date) - last 45 days
            days_ago = random.randint(0, 45)
            hours_ago = random.randint(0, 23)
            created_at = now - timedelta(days=days_ago, hours=hours_ago)
            c.created_at = created_at
            
            # 3. Randomize Updated At (Last Activity)
            if random.random() > 0.3:
                activity_days = random.randint(0, days_ago)
                updated_at = now - timedelta(days=activity_days, hours=random.randint(0, 23))
                c.updated_at = updated_at
            else:
                c.updated_at = created_at

            # 4. Randomize Resume Sources
            for resume in db.query(Resume).filter_by(candidate_id=c.candidate_id).all():
                resume.resume_source = random.choice(RESUME_SOURCES)

        db.commit()
        print("Success: Pipeline stages and dates randomized.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    randomize_data()
