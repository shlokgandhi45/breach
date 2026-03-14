import sys
import random
import uuid
from pathlib import Path

# Add parent to path so imports work
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from models.schema import SessionLocal, Candidate
from services.llm_parser import ParsedCandidate, ParsedEducation
from services.db_writer import write_candidate

# Mock data pools
FIRST_NAMES = ["Aarav", "Aditi", "Arjun", "Ananya", "Ishaan", "Isha", "Rohan", "Riya", "Vihaan", "Vanya", "Sai", "Sanya", "Kabir", "Kiara", "Aryan", "Avni"]
LAST_NAMES = ["Sharma", "Verma", "Gupta", "Malhotra", "Kapoor", "Khan", "Reddy", "Patel", "Singh", "Joshi", "Das", "Choudhury", "Nair", "Iyengar", "Bose", "Pillai"]
LOCATIONS = ["Mumbai, India", "Bangalore, India", "Delhi, India", "Pune, India", "Hyderabad, India", "Chennai, India", "Gurgaon, India", "Noida, India", "Remote"]
COMPANIES = ["Google", "Microsoft", "Amazon", "Meta", "TCS", "Infosys", "Wipro", "Zomato", "Swiggy", "Flipkart", "CRED", "Razorpay", "Ola", "Paytm"]
ROLES = ["Software Engineer", "Frontend Developer", "Backend Developer", "Fullstack Engineer", "ML Engineer", "Data Scientist", "DevOps Engineer", "Mobile Developer", "Product Manager"]
SKILLS_POOL = [
    "Python", "JavaScript", "React", "Node.js", "TypeScript", "Java", "C++", "Go", "Rust", 
    "AWS", "Azure", "Docker", "Kubernetes", "PyTorch", "TensorFlow", "SQL", "NoSQL", 
    "FastAPI", "Django", "Spring Boot", "Next.js", "Tailwind CSS", "Redux", "GraphQL"
]
DEGREES = ["B.Tech", "M.Tech", "B.E.", "M.S.", "BCA", "MCA", "B.Sc", "M.Sc"]
UNIVERSITIES = ["IIT Delhi", "IIT Bombay", "IIT Madras", "BITS Pilani", "NIT Trichy", "Delhi Technological University", "VIT Vellore", "SRM University", "Manipal Institute of Technology"]

def generate_mock_candidate(index):
    first_name = random.choice(FIRST_NAMES)
    last_name = random.choice(LAST_NAMES)
    full_name = f"{first_name} {last_name}"
    email = f"mock_candidate_{index}_{uuid.uuid4().hex[:4]}@example.com"
    
    role = random.choice(ROLES)
    company = random.choice(COMPANIES)
    location = random.choice(LOCATIONS)
    exp_years = round(random.uniform(1.0, 15.0), 1)
    
    skills = random.sample(SKILLS_POOL, k=random.randint(5, 12))
    
    educations = [
        ParsedEducation(
            degree=random.choice(DEGREES),
            university=random.choice(UNIVERSITIES),
            graduation_year=random.randint(2010, 2023),
            field_of_study="Computer Science"
        )
    ]
    
    return ParsedCandidate(
        full_name=full_name,
        email=email,
        phone=f"+91 {random.randint(7000000000, 9999999999)}",
        location=location,
        current_job_title=role,
        current_company=company,
        total_experience_years=exp_years,
        educations=educations,
        skills=skills,
        linkedin_url=f"https://linkedin.com/in/mock-{index}",
    )

def main():
    db: Session = SessionLocal()
    count = 100
    print(f"Starting bulk ingestion of {count} candidates...")
    
    success_count = 0
    for i in range(1, count + 1):
        try:
            parsed = generate_mock_candidate(i)
            # Build a more comprehensive resume text for search matching
            resume_text = (
                f"RESUME: {parsed.full_name}\n"
                f"Role: {parsed.current_job_title} at {parsed.current_company}\n"
                f"Location: {parsed.location}\n"
                f"Experience: {parsed.total_experience_years} years\n"
                f"Skills: {', '.join(parsed.skills)}\n"
                f"Education: {parsed.educations[0].degree} from {parsed.educations[0].university}"
            )
            file_url = f"/resumes/mock_resume_{i}.pdf"
            
            write_candidate(
                db=db,
                parsed=parsed,
                resume_text=resume_text,
                file_url=file_url,
                resume_source="bulk_generation"
            )
            success_count += 1
            if i % 10 == 0:
                print(f"  Processed {i}/{count} candidates...")
        except Exception as e:
            print(f"  Error processing candidate {i}: {e}")
            db.rollback()
    
    print(f"\nFinished. Successfully added {success_count} candidates.")
    db.close()

if __name__ == "__main__":
    main()
