"""
routes/intelligence.py

Five endpoints powering the CandidateIntelPanel:
  POST /api/intelligence/culture-fit      — LLM parses resume text → 5-axis scores
  POST /api/intelligence/gap-bridge       — LLM generates learning bridge per skill gap
  POST /api/intelligence/draft-outreach   — LLM writes personalized outreach email
  POST /api/intelligence/send-email/gmail — Gmail API send (OAuth2 via service account or user token)
  POST /api/intelligence/send-email/mock  — Mock send (logs to console, no real email)

Install:
  pip install fastapi openai google-auth google-auth-oauthlib google-api-python-client

Env vars:
  OPENAI_API_KEY            — OpenAI key
  GMAIL_SERVICE_ACCOUNT_JSON — path to service account JSON (optional, for Gmail)
  GMAIL_SENDER_EMAIL        — the From address authorized in Google Workspace
"""

import os, json, base64
from fastapi import APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware  # kept for reference; CORS handled by main.py
from pydantic import BaseModel
from typing import List, Optional
from openai import OpenAI

# ── Gmail imports (gracefully optional) ──────────────────────────────────────
try:
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    GMAIL_AVAILABLE = True
except ImportError:
    GMAIL_AVAILABLE = False

router = APIRouter(prefix="/api/intelligence", tags=["intelligence"])

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
MODEL = "gpt-4o-mini"   # fast + cheap; swap to gpt-4o for demo day


# ─── Pydantic models ──────────────────────────────────────────────────────────

class CandidateTextPayload(BaseModel):
    text: str

class SkillItem(BaseModel):
    name: str
    candidateLevel: int   # 0-3
    requiredLevel: int    # 0-3

class GapBridgePayload(BaseModel):
    skills: List[SkillItem]
    match_score: float
    role: str

class OutreachPayload(BaseModel):
    candidate_name: str
    candidate_email: str
    role: str
    top_trait: str          # highest-scoring culture radar axis label
    gap_weeks: int
    gap_skills: str         # comma-separated missing skills

class SendEmailPayload(BaseModel):
    to: str
    subject: str
    body: str


# ─── Helper: call LLM and parse JSON safely ──────────────────────────────────

def llm_json(prompt: str) -> dict:
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.4,
    )
    return json.loads(response.choices[0].message.content)


# ─── Endpoint 1: Culture Fit Radar ───────────────────────────────────────────

@router.post("/culture-fit")
async def culture_fit(payload: CandidateTextPayload):
    """
    Parses resume/cover letter text and returns 5-axis personality scores.
    Scores are 0-100. Reasoning strings feed the UI's Explainable AI evidence tags.
    """
    prompt = f"""
You are an expert recruiter and behavioral analyst.

Analyze the following resume or cover letter text. Return ONLY valid JSON with this exact structure:

{{
  "communication_clarity": <int 0-100>,
  "leadership_signal": <int 0-100>,
  "technical_depth": <int 0-100>,
  "collaboration": <int 0-100>,
  "growth_mindset": <int 0-100>,
  "reasoning": {{
    "communication_clarity": "<one sentence: what in the text justifies this score>",
    "leadership_signal": "<one sentence>",
    "technical_depth": "<one sentence>",
    "collaboration": "<one sentence>",
    "growth_mindset": "<one sentence>"
  }}
}}

Scoring guide:
- communication_clarity: sentence structure, precision, absence of jargon overload
- leadership_signal: ownership language ("led", "built", "launched", "own")
- technical_depth: specificity of tools, versions, architectures, tradeoffs mentioned
- collaboration: cross-functional mentions, team language vs pure solo narrative
- growth_mindset: side projects, self-teaching, pivots, learning-in-progress signals

Text to analyze:
\"\"\"
{payload.text}
\"\"\"
"""
    data = llm_json(prompt)
    return data


# ─── Endpoint 2: Skill Gap Bridge ────────────────────────────────────────────

@router.post("/gap-bridge")
async def gap_bridge(payload: GapBridgePayload):
    """
    Takes the skill delta list from the C++/Java scoring engine and generates
    a concrete learning bridge per gap (course, estimated weeks, difficulty).
    """
    gaps = [s for s in payload.skills if s.requiredLevel > s.candidateLevel]

    if not gaps:
        return {
            "bridges": [],
            "total_weeks_to_hire_ready": 0,
            "hire_now_recommendation": "No skill gaps detected. Candidate is hire-ready now.",
        }

    gap_descriptions = "\n".join([
        f"- {s.name}: candidate is at level {s.candidateLevel}/3, role requires {s.requiredLevel}/3"
        for s in gaps
    ])

    prompt = f"""
You are a senior technical recruiter.

A candidate is {payload.match_score:.0f}% matched for a "{payload.role}" role.

Skill gaps to bridge:
{gap_descriptions}

Return ONLY valid JSON:
{{
  "bridges": [
    {{
      "skill": "<skill name>",
      "course": "<specific course title and platform, e.g. 'Kubernetes for App Developers — Udemy'>",
      "weeks_to_ready": <realistic integer, 1-12>,
      "difficulty": "<beginner | intermediate | advanced>"
    }}
  ],
  "total_weeks_to_hire_ready": <sum of all weeks, integer>,
  "hire_now_recommendation": "<1-2 sentence honest assessment for the recruiter>"
}}

Be specific and realistic. Do not invent fake URLs.
"""
    data = llm_json(prompt)
    return data


# ─── Endpoint 3: Draft Outreach Email ────────────────────────────────────────

@router.post("/draft-outreach")
async def draft_outreach(payload: OutreachPayload):
    """
    Generates a hyper-personalized outreach email combining:
      - The candidate's top culture radar trait (from Feature 1)
      - The gap bridge plan (from Feature 2)
      - Role and name context
    The email acknowledges the gap and presents it as a growth opportunity,
    not a rejection. Human review required before send.
    """
    prompt = f"""
You are writing a recruiter outreach email on behalf of a hiring team.

Candidate details:
- Name: {payload.candidate_name}
- Applying for: {payload.role}
- Standout quality (from personality analysis): {payload.top_trait}
- Skills to grow: {payload.gap_skills}
- Estimated time to bridge gap: {payload.gap_weeks} weeks

Write a warm, direct, non-corporate email that:
1. Opens by naming the specific standout quality — NOT generic praise
2. Expresses genuine interest in the candidate for this role
3. Honestly names the skill gap but frames it as bridgeable with specific context
4. Closes with a clear call to action (15-minute call)
5. Is under 160 words
6. Feels human, not AI-generated

Return ONLY valid JSON:
{{
  "subject": "<subject line, specific not generic>",
  "body": "<full email body, no placeholders except [Recruiter Name]>"
}}
"""
    data = llm_json(prompt)
    return data


@router.post("/send-email/gmail")
async def send_via_gmail(payload: SendEmailPayload):
    """
    Sends email via SMTP using the configured Hackathon dummy credentials.
    """
    if not GMAIL_AVAILABLE:
        raise HTTPException(
            status_code=501,
            detail="SMTP libraries missing."
        )

    # Hardcoded or Env based
    sender_email = "dummy.150905@gmail.com"
    sender_password = "jpqm apfx dmvj euvu"

    try:
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = payload.to
        msg['Subject'] = payload.subject
        msg.attach(MIMEText(payload.body, 'plain'))

        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(sender_email, sender_password)
        server.send_message(msg)
        server.quit()

        return {"success": True, "mode": "smtp", "to": payload.to}

    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=401, detail="SMTP Authentication failed for dummy.150905@gmail.com. Check App Password.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Endpoint 4b: Mock send ───────────────────────────────────────────────────

@router.post("/send-email/mock")
async def send_mock(payload: SendEmailPayload):
    """
    Simulates sending. Logs full email to console.
    Safe to use during the hackathon demo when Gmail OAuth isn't configured.
    Returns the same shape as the Gmail endpoint so frontend code is identical.
    """
    print("\n" + "="*60)
    print("MOCK EMAIL SENT")
    print("="*60)
    print(f"TO:      {payload.to}")
    print(f"SUBJECT: {payload.subject}")
    print("-"*60)
    print(payload.body)
    print("="*60 + "\n")

    return {
        "success": True,
        "mode":    "mock",
        "to":      payload.to,
        "message": "Email logged to server console. No real email sent.",
    }


# ─── Health check ─────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {
        "status": "ok",
        "gmail_libraries": GMAIL_AVAILABLE,
        "openai_key_set":  bool(os.environ.get("OPENAI_API_KEY")),
        "gmail_configured": bool(
            os.environ.get("GMAIL_SERVICE_ACCOUNT_JSON") and
            os.environ.get("GMAIL_SENDER_EMAIL")
        ),
    }
