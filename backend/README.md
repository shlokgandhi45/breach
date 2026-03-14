# Unified Recruitment Platform
## AI-powered resume ingestion, candidate search, and intelligence

### Structure
```
backend_breach/
├── config/
│   └── settings.py              # All env vars in one place — copy .env.example
├── models/
│   └── schema.py                # SQLAlchemy ORM models + pgvector embeddings
├── services/
│   ├── pdf_extractor.py         # PyMuPDF: PDF bytes → raw text
│   ├── llm_parser.py            # OpenAI: raw text → structured JSON fields
│   ├── db_writer.py             # Writes parsed data into all 6 tables atomically
│   ├── embedder.py              # sentence-transformers: text → VECTOR(384)
│   ├── vector_search.py         # pgvector cosine similarity search
│   ├── hybrid_search.py         # BM25 + vector → Reciprocal Rank Fusion
│   ├── query_intent_parser.py   # LLM: natural language → structured filters
│   ├── metadata_filter.py       # SQL pre-filtering from parsed intent
│   ├── rag_summarizer.py        # Anti-hallucination RAG candidate summaries
│   └── search_orchestrator.py   # Full 6-step search pipeline orchestrator
├── routes/
│   ├── ingest.py                # POST /api/ingest/upload, /batch, /status
│   ├── search.py                # POST /api/search, GET /api/search/candidate/{id}
│   └── intelligence.py          # Culture fit, gap bridge, outreach, email send
├── scripts/
│   └── bulk_ingest.py           # CLI: bulk load a folder of PDFs
├── frontend/
│   ├── RecruiterSearchDashboard.jsx  # React search UI
│   └── CandidateIntelPanel.jsx       # React intelligence panel (radar, gaps, email)
├── main.py                      # FastAPI app entry point (all routes registered)
├── requirements.txt
└── .env.example
```

### Quick start
```bash
# 1. Copy env
cp .env.example .env
# fill in DATABASE_URL and OPENAI_API_KEY

# 2. Install
pip install -r requirements.txt

# 3. Create tables (idempotent)
python -c "from models.schema import Base, engine; Base.metadata.create_all(engine)"

# 4. Run API
uvicorn main:app --reload --port 8000

# 5. OR bulk ingest a dataset folder
python scripts/bulk_ingest.py --folder ./dataset/resumes --source linkedin
```

### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingest/upload` | POST | Single PDF resume upload |
| `/api/ingest/batch` | POST | Batch PDF upload (base64) |
| `/api/ingest/status` | GET | Pipeline health check |
| `/api/search` | POST | Natural language candidate search |
| `/api/search/candidate/{id}` | GET | Single candidate full profile |
| `/api/intelligence/culture-fit` | POST | 5-axis personality radar |
| `/api/intelligence/gap-bridge` | POST | Skill gap learning bridge |
| `/api/intelligence/draft-outreach` | POST | Personalized outreach email |
| `/api/intelligence/send-email/gmail` | POST | Send via Gmail API |
| `/api/intelligence/send-email/mock` | POST | Mock send (console log) |

### Integration with other machines
- Clone this folder
- Set DATABASE_URL to point at the shared PostgreSQL instance
- Run bulk_ingest.py — all writes are idempotent (duplicate emails skip gracefully)
- The `/api/ingest` endpoint is callable from any other service via HTTP

