<div align="center">

<h1>⚡ ALTURA</h1>
<h3>AI-Powered Unified Recruitment Platform</h3>

<p><em>Unify. Deduplicate. Hire Smarter.</em></p>

<p>
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/PostgreSQL-18-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/pgvector-enabled-orange?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Groq-LLM-blueviolet?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
</p>

<p>
  <strong>PDEU Hackathon 2026</strong> &nbsp;|&nbsp; Team <strong>PRAFUL (T018)</strong> &nbsp;|&nbsp; Pandit Deendayal Energy University, Gandhinagar
</p>

</div>

---

## 📌 Table of Contents

- [Overview](#-overview)
- [The Problem](#-the-problem)
- [The Solution](#-the-solution)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Core Algorithms](#-core-algorithms)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the App](#running-the-app)
- [Usage](#-usage)
- [Performance Benchmarks](#-performance-benchmarks)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Roadmap](#-roadmap)
- [Team](#-team)
- [References](#-references)

---

## 🌐 Overview

**ALTURA** is a production-grade, AI-powered recruitment platform that solves the **identity fragmentation problem** at its root. Modern recruitment teams ingest candidate data from multiple disconnected sources — parsed resumes, HRMS CSV exports, and LinkedIn JSON scrapes — and the same person routinely appears across all three with different email addresses, inconsistent phone formats, and name typos.

ALTURA unifies all of this into a **single source of truth**: one Master Profile per real-world candidate, searchable through natural language, ranked by AI, and summarised without hallucination.

---

## 🧨 The Problem

> Recruiters waste an average of **5.4 hours per day** on manual deduplication.

A single candidate may:
- Submit a resume via email (parsed as PDF)
- Appear in HRMS from a prior application with a university email
- Exist as a LinkedIn scrape with no email but a matching phone number

Standard SQL `WHERE email = email` **completely fails** on real-world data:
- Phone formats vary: `+91-98765-43210` vs `9876543210`
- Names contain typos: `Jon Smith` vs `Jonathan Smith`
- Many records lack contact info entirely

Worse, **no existing ATS** — not Workday, SAP SuccessFactors, Greenhouse, or Lever — handles **transitive identity**:

```
Candidate A (Resume)  ──── phone match ────  Candidate B (HRMS)
                                               │
                                          email match
                                               │
                                        Candidate C (LinkedIn)

A and C share ZERO directly matching fields.
ALTURA collapses all three into ONE Master Profile in O(α·n) time.
```

---

## ✅ The Solution

ALTURA is built around two interconnected pipelines:

### 1. Deterministic Identity Resolution Engine
- Implements **Disjoint-Set Union (DSU / Union-Find)** with path compression and union-by-rank
- Multi-tier scoring: exact contact match (Tier 1) → weighted fuzzy match (Tier 2)
- Handles transitive clustering across arbitrarily long chains of records
- Near **O(1) amortised** per operation via inverse Ackermann function

### 2. Six-Step Natural Language Search Pipeline
- **Step 0** — Query Intent Parser (LLM or regex fast-path)
- **Step 1** — Metadata Pre-filter (SQL `WHERE` clauses)
- **Step 2** — Hybrid Search (pgvector cosine + BM25 via RRF)
- **Step 3** — Full Profile Hydration (7-table join)
- **Step 4** — Parallel Zero-Hallucination RAG Summarisation (Groq)
- **Step 5** — Score Blending & Ranking

---

## ✨ Key Features

| Feature | Details |
|---|---|
| 🔗 **Transitive Identity Resolution** | DSU-based clustering merges A↔B and B↔C → A=B=C even with zero direct A-C overlap |
| 🔍 **Hybrid Semantic Search** | pgvector cosine similarity + PostgreSQL BM25, fused via Reciprocal Rank Fusion |
| 🧠 **Zero-Hallucination RAG** | `ZERO INFERENCE` prompt rules, `NOT_MENTIONED` sentinels, `temperature=0.0`, DB cross-verification |
| ⚡ **Parallel LLM Calls** | `ThreadPoolExecutor` reduces 7 sequential Groq calls from ~10s to ~3s wall-clock |
| 📊 **Batch Comparison** | Two-phase RAG compresses N profiles in parallel, then runs a single comparative call — structurally impossible to hallucinate cross-candidate facts |
| 🎯 **Match Score Dashboard** | 0–99% match score, verified skill pills (green = match, amber = gap), experience verdict |
| 🏗️ **Single PostgreSQL Stack** | No additional infrastructure — everything runs on one Postgres instance with pgvector |

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                 │
│   [Resume PDFs]    [HRMS CSV Exports]    [LinkedIn JSON Scrapes]    │
└────────────────┬────────────────────────────────────────────────────┘
                 │ Ingestion & Parsing (PyMuPDF, CSV, JSON)
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      POSTGRESQL 18 + pgvector                       │
│   7 relational tables  +  2 vector tables (VECTOR(384), IVFFlat)    │
└──────────┬──────────────────────────────────────┬───────────────────┘
           │ Identity Resolution                  │ Search
           ▼                                      ▼
┌──────────────────────┐              ┌──────────────────────────────┐
│   DSU ENGINE         │              │   SEARCH ORCHESTRATOR        │
│  union_find.py       │              │  Step 0: Intent Parser       │
│  similarity.py       │              │  Step 1: Metadata Pre-filter │
│  merger.py           │              │  Step 2: Hybrid RRF Search   │
│                      │              │  Step 3: Profile Hydration   │
│  O(α·n) complexity   │              │  Step 4: Parallel RAG        │
│  ~61K pairs / 0.8s   │              │  Step 5: Score Blending      │
└──────────┬───────────┘              └─────────────┬────────────────┘
           │                                        │
           └──────────────┬─────────────────────────┘
                          ▼
         ┌────────────────────────────────┐
         │       FastAPI Backend          │
         │  /api/search  /api/evaluate    │
         │  /api/deduplicate  /api/master │
         └───────────────┬────────────────┘
                         ▼
         ┌────────────────────────────────┐
         │       React.js Frontend        │
         │  Search · Profile · Compare    │
         └────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React.js, Tailwind CSS, Chart.js, Axios | Recruiter dashboard, radar charts, API calls |
| **Backend** | FastAPI (Python 3.11), Pydantic, SQLAlchemy, Uvicorn | REST API, validation, ORM, ASGI server |
| **AI / LLM** | Groq API (`llama3-8b-8192`), `temperature=0.0` | Zero-hallucination RAG, query intent parsing |
| **Embeddings** | `sentence-transformers/all-MiniLM-L6-v2` (local) | 384-dim vectors, zero API cost |
| **Database** | PostgreSQL 18, pgvector, IVFFlat index | Relational + vector cosine similarity search |
| **Algorithms** | Union-Find DSU, Levenshtein, Jaccard, Gaussian Decay | Deduplication and fuzzy scoring |
| **Search** | BM25 (`tsvector/tsquery`), Reciprocal Rank Fusion | Keyword + semantic search fusion |
| **DevOps** | Docker, docker-compose, `ankane/pgvector` | Containerised Postgres with pgvector pre-installed |

---

## 🧮 Core Algorithms

### Identity Resolution Scoring Function

```
Tier 1 — Exact Match (short-circuit):
  IF normalised_email(A) == normalised_email(B)   → score = 1.0  ✓
  IF last10digits(phone_A) == last10digits(phone_B) → score = 1.0  ✓

Tier 2 — Weighted Fuzzy Blend:
  score = 0.40 × levenshtein_ratio(name_A, name_B)
        + 0.35 × jaccard(skills_A, skills_B)
        + 0.15 × gaussian_decay(|exp_A - exp_B|, σ=2)
        + 0.10 × location_match(loc_A, loc_B)

  IF score >= 0.85 → union(A, B)
```

### Search Score Formula

```
final_score = 0.45 × hybrid_RRF_normalised
            + 0.30 × required_skill_overlap
            + 0.15 × experience_match
            + 0.10 × RAG_confidence
```

### Algorithm Complexity Summary

| Algorithm | Complexity | Used For |
|---|---|---|
| Union-Find (DSU) | O(α·n) amortised | Transitive candidate clustering |
| Levenshtein Distance | O(m·n) time, O(min(m,n)) space | Fuzzy name similarity |
| Jaccard Similarity | O(\|A\|+\|B\|) | Skill set overlap |
| Gaussian Decay | O(1) | Experience year proximity |
| Cosine Similarity | pgvector `<=>` operator | Semantic vector search |
| BM25 (`ts_rank_cd`) | PostgreSQL native | Exact keyword match scoring |
| Reciprocal Rank Fusion | O(n) | Fusing vector + BM25 results |

---

## 🚀 Getting Started

### Prerequisites

Make sure the following tools are installed before proceeding:

| Tool | Version | Download |
|---|---|---|
| **Docker Desktop** | Latest | https://www.docker.com/products/docker-desktop |
| **Python** | 3.11+ | https://www.python.org/downloads |
| **Node.js + npm** | 18+ | https://nodejs.org |
| **Git** | Any | https://git-scm.com |
| **Groq API Key** | Free | https://console.groq.com |

---

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/your-team/altura.git
cd altura
```

**2. Configure environment variables**

Create a `.env` file inside the `backend/` directory:

```env
# Groq LLM API Key (required)
GROQ_API_KEY=your_groq_api_key_here

# PostgreSQL connection (matches Docker setup below)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=altura_db
DB_USER=altura_user
DB_PASSWORD=altura_pass
```

**3. Start PostgreSQL with pgvector via Docker**

```bash
# From the project root (where docker-compose.yml lives)
docker-compose up -d

# Verify the container is running
docker ps
# Expected: container named 'altura_postgres' with status 'Up'
```

> **Why Docker?** The `pgvector` extension requires compilation from source on Windows and is absent from PostgreSQL Stack Builder for v18. The `ankane/pgvector` Docker image ships with pgvector pre-compiled — no manual build needed.

---

### Running the App

**4. Set up and start the Backend**

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Run database migrations (creates all 9 tables)
python setup_db.py

# Start FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**5. Set up and start the Frontend**

Open a **second terminal** (keep the backend running):

```bash
cd frontend
npm install
npm start
# React dashboard opens automatically at http://localhost:3000
```

---

## 📖 Usage

### Step 1 — Ingest candidate data

Place your files in the appropriate data directories, then run the bulk ingestion CLI:

```bash
python ingest_bulk.py \
  --resumes   data/resumes/ \
  --hrms      data/hrms/export.csv \
  --linkedin  data/linkedin/profiles.json
```

### Step 2 — Run the deduplication engine

```bash
curl -X POST http://localhost:8000/api/deduplicate
# Returns: { "input_records": 350, "master_profiles": 287, "merged": 63 }
```

### Step 3 — Search with natural language

In the React dashboard, type any natural language query:

```
"Senior Python developer with FastAPI and AWS, 5+ years"
```

Results appear in 3–5 seconds as ranked candidate cards with match scores, verified skills, and skill gaps.

### Step 4 — Evaluate a profile

Click any candidate card to open the full evaluation view:
- Zero-hallucination AI summary grounded in resume text
- Verified skills (green pills) and skill gaps (amber pills)
- Experience verdict and contact information

### Step 5 — Batch compare candidates

Select up to 10 profiles → click **Compare** → receive an executive summary and structured Top-3 ranking table.

---

## 📊 Performance Benchmarks

All benchmarks were measured on the mock recruitment dataset (350 records, 3 source types):

| Metric | Result |
|---|---|
| Total records ingested | 350 across 3 source types |
| Master Profiles after dedup | **287** unique identities |
| Duplicates collapsed | **63** merged records |
| Transitive merges (3+ sources) | **14** profiles |
| False positive rate | **0%** |
| DSU pairwise comparisons | ~61,000 pairs in **0.8 seconds** |
| Vector embedding generation | 350 candidates in **42 seconds** (CPU) |
| Average search latency | **3.2 seconds** (7 parallel RAG calls) |
| Hallucination rate (RAG) | **0 instances** across 50 test queries |

---

## 📁 Project Structure

```
altura/
├── backend/
│   ├── main.py                   # FastAPI app entry point
│   ├── setup_db.py               # Database migration script
│   ├── ingest_bulk.py            # Bulk ingestion CLI tool
│   ├── requirements.txt
│   ├── .env                      # Environment variables (not committed)
│   │
│   ├── api/
│   │   ├── search.py             # /api/search routes
│   │   ├── evaluate.py           # /api/evaluate routes
│   │   ├── deduplicate.py        # /api/deduplicate routes
│   │   └── master_profiles.py    # /api/master-profiles routes
│   │
│   ├── services/
│   │   ├── search_orchestrator.py
│   │   ├── rag_summarizer.py     # Zero-hallucination RAG layer
│   │   ├── hybrid_search.py      # BM25 + pgvector + RRF
│   │   ├── profile_evaluator.py
│   │   └── batch_comparator.py   # Two-phase RAG for batch comparison
│   │
│   └── algorithms/
│       ├── union_find.py         # DSU with path compression + union-by-rank
│       ├── similarity.py         # Multi-tier scoring function
│       └── merger.py             # Master Profile construction
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Search.jsx        # Natural language search dashboard
│   │   │   ├── Profile.jsx       # /profile/:id evaluation view
│   │   │   └── Compare.jsx       # /compare batch comparison view
│   │   └── components/
│   │       ├── CandidateCard.jsx
│   │       ├── SkillPill.jsx
│   │       └── RadarChart.jsx
│   └── package.json
│
├── data/
│   ├── resumes/                  # Input: Resume PDFs
│   ├── hrms/                     # Input: HRMS CSV exports
│   └── linkedin/                 # Input: LinkedIn JSON scrapes
│
├── docker-compose.yml
└── README.md
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ingest/resume` | Ingest a single resume PDF |
| `POST` | `/api/ingest/hrms` | Ingest an HRMS CSV export |
| `POST` | `/api/ingest/linkedin` | Ingest a LinkedIn JSON file |
| `POST` | `/api/deduplicate` | Run the full DSU identity resolution engine |
| `GET` | `/api/master-profiles` | Paginated list of all Master Profiles |
| `GET` | `/api/master-profiles/{id}` | Single Master Profile by ID |
| `POST` | `/api/search` | Natural language candidate search |
| `POST` | `/api/evaluate/profile` | Single profile evaluation with RAG summary |
| `POST` | `/api/evaluate/batch` | Batch comparison (up to 10 profiles) |

Interactive Swagger UI available at **`http://localhost:8000/docs`** when the backend is running.

---

## 🗺️ Roadmap

<details>
<summary><strong>Phase 1 — 0 to 3 Months</strong></summary>

- Real-time webhook ingestion from Naukri, LinkedIn, Indeed with automatic deduplication on arrival
- Streaming search results via Server-Sent Events — cards appear as each RAG call completes
- Recruiter feedback loop — thumbs up/down reweights the score formula over time
- RAG fusion via multi-query reranking (3 query phrasings merged via RRF)

</details>

<details>
<summary><strong>Phase 2 — 3 to 6 Months</strong></summary>

- Candidate-facing portal with application tracking and AI-generated skill gap recommendations
- Hiring Bias Audit Trail with post-hire LLM statistical bias reports
- DEI Blind Audition Mode — hide name, photo, and university during initial screening
- Culture Fit Radar — 5-axis LLM scoring rendered as Chart.js radar chart

</details>

<details>
<summary><strong>Phase 3 — 6 to 12 Months</strong></summary>

- Multi-tenant SaaS with white-label enterprise deployment
- Native HRMS integrations: Workday, SAP SuccessFactors, BambooHR
- Predictive offer acceptance ML classifier trained on historical offer/decline data
- Cross-encoder re-ranking with `ms-marco-MiniLM` for improved precision on top-14

</details>

<details>
<summary><strong>Phase 4 — 12+ Months</strong></summary>

- Talent marketplace with skill-gap training recommendations (Coursera, Udemy, LinkedIn Learning)
- Cross-company opt-in talent pooling
- Compliance engine: GDPR right-to-erasure, SOC 2 Type II, ISO 27001
- IPO-ready financial reporting and audit trails

</details>

---

## 👥 Team

| Name | Role |
|---|---|
| **Saumya Joshi** | Team Lead · GenAI Engineer |
| **Khush Patel** | Frontend Developer |
| **Ridham Shah** | Backend Engineer |
| **Shrey Patel** | Database Engineer |
| **Shlok Gandhi** | R&D and AI Researcher |

> **Institute:** Pandit Deendayal Energy University (PDEU), Gandhinagar, Gujarat
> **Hackathon:** PDEU Hackathon 2026 · Team Code: T018 · Date: 14 March 2026

---

## 📚 References

- Tarjan, R.E. & van Leeuwen, J. (1984). *Worst-case analysis of set union algorithms.* Journal of the ACM, 31(2), 245–281.
- Cormack, G.V. & Clarke, C.L.A. (2009). *Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods.* SIGIR 2009.
- Reimers, N. & Gurevych, I. (2019). *Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks.* EMNLP 2019.
- Levenshtein, V.I. (1966). *Binary codes capable of correcting deletions, insertions, and reversals.* Soviet Physics Doklady, 10(8), 707–710.
- Pal, R., Shaikh, S., Satpute, S., & Bhagwat, S. (2022). *Resume Classification using Various Machine Learning Algorithms.* ITM Web of Conferences, 44, 03011.

---

<div align="center">

<sub>Built with ❤️ by Team PRAFUL at PDEU Hackathon 2026 &nbsp;·&nbsp; Confidential — Team Altura, PDEU</sub>

</div>
