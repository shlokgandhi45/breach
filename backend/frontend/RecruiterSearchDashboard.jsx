/**
 * RecruiterSearchDashboard.jsx
 *
 * Full natural language search UI for the recruiter dashboard.
 * Shows top 5-7 candidate cards with:
 *   - Match score %
 *   - AI-grounded summary
 *   - Why they match THIS query
 *   - Matched skills (green) + skill gaps (amber)
 *   - Experience, current role, contact info
 *
 * Props:
 *   apiBase: string — e.g. "http://localhost:8000" (defaults to env var)
 *
 * No external UI library needed — pure Tailwind + inline styles.
 */

import { useState, useRef, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

// ─── Score colour helpers ──────────────────────────────────────────────────────

function scoreColor(score) {
  if (score >= 75) return { bg: "#dcfce7", text: "#15803d", border: "#86efac" };
  if (score >= 55) return { bg: "#fef3c7", text: "#b45309", border: "#fcd34d" };
  return               { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" };
}

function confidenceBadge(confidence) {
  const map = {
    high:   { bg: "#dbeafe", text: "#1d4ed8", label: "High confidence" },
    medium: { bg: "#fef9c3", text: "#854d0e", label: "Medium confidence" },
    low:    { bg: "#fce7f3", text: "#9d174d", label: "Low confidence" },
  };
  return map[confidence] || map.medium;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SkillPill({ name, matched }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      margin: "2px 3px 2px 0",
      background: matched ? "#dcfce7" : "#f1f5f9",
      color:      matched ? "#15803d" : "#475569",
      border:     `1px solid ${matched ? "#86efac" : "#e2e8f0"}`,
    }}>
      {matched && <span style={{ marginRight: 3 }}>✓</span>}
      {name}
    </span>
  );
}

function GapPill({ name }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      margin: "2px 3px 2px 0",
      background: "#fffbeb",
      color: "#b45309",
      border: "1px solid #fcd34d",
    }}>
      ⚠ {name}
    </span>
  );
}

function ContactLink({ href, label, icon }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 12, color: "#2563eb", textDecoration: "none",
        padding: "3px 10px", borderRadius: 6,
        background: "#eff6ff", border: "1px solid #bfdbfe",
        marginRight: 6,
      }}
    >
      {icon} {label}
    </a>
  );
}

function CandidateCard({ candidate, query, rank }) {
  const [expanded, setExpanded] = useState(false);
  const sc   = scoreColor(candidate.final_score);
  const conf = confidenceBadge(candidate.confidence);

  const matchedSet = new Set((candidate.matched_skills || []).map(s => s.toLowerCase()));
  const displaySkills = (candidate.all_skills || []).slice(0, expanded ? 999 : 12);

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: 14,
      padding: "20px 22px",
      marginBottom: 14,
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      transition: "box-shadow 0.15s",
      position: "relative",
    }}>
      {/* Rank badge */}
      <div style={{
        position: "absolute", top: 16, left: -12,
        width: 26, height: 26, borderRadius: "50%",
        background: "#0f172a", color: "#fff",
        fontSize: 11, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {rank}
      </div>

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
            {candidate.full_name}
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
            {[candidate.current_role, candidate.location].filter(Boolean).join("  ·  ")}
          </div>
          {candidate.experience_years && (
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 1 }}>
              {candidate.experience_years} experience
              {candidate.education ? `  ·  ${candidate.education}` : ""}
            </div>
          )}
        </div>

        {/* Score + confidence */}
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
          <div style={{
            fontSize: 28, fontWeight: 800,
            color: sc.text,
            fontFamily: "'DM Mono', monospace",
            lineHeight: 1,
          }}>
            {candidate.final_score}%
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>match</div>
          <span style={{
            display: "inline-block", marginTop: 4,
            padding: "2px 8px", borderRadius: 10,
            fontSize: 10, fontWeight: 600,
            background: conf.bg, color: conf.text,
          }}>
            {conf.label}
          </span>
        </div>
      </div>

      {/* AI Summary */}
      {candidate.summary && (
        <div style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 12,
          fontSize: 13,
          color: "#334155",
          lineHeight: 1.6,
        }}>
          {candidate.summary}
        </div>
      )}

      {/* Why they match this query */}
      {candidate.query_match_reason && (
        <div style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 8,
          padding: "8px 14px",
          marginBottom: 12,
          fontSize: 12,
          color: "#166534",
          lineHeight: 1.6,
        }}>
          <span style={{ fontWeight: 600, marginRight: 4 }}>Why matched:</span>
          {candidate.query_match_reason}
        </div>
      )}

      {/* Skills */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
          Skills
        </div>
        {displaySkills.map(skill => (
          <SkillPill
            key={skill}
            name={skill}
            matched={matchedSet.has(skill.toLowerCase())}
          />
        ))}
        {(candidate.all_skills || []).length > 12 && !expanded && (
          <span
            onClick={() => setExpanded(true)}
            style={{ fontSize: 11, color: "#2563eb", cursor: "pointer", marginLeft: 4 }}
          >
            +{candidate.all_skills.length - 12} more
          </span>
        )}
      </div>

      {/* Skill gaps */}
      {candidate.skill_gaps && candidate.skill_gaps.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
            Gaps vs query
          </div>
          {candidate.skill_gaps.map(gap => (
            <GapPill key={gap} name={gap} />
          ))}
        </div>
      )}

      {/* Contact + links */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
        {candidate.email && (
          <ContactLink href={`mailto:${candidate.email}`} label={candidate.email} icon="✉" />
        )}
        {candidate.phone && (
          <ContactLink href={`tel:${candidate.phone}`} label={candidate.phone} icon="☏" />
        )}
        {candidate.linkedin_url && (
          <ContactLink href={candidate.linkedin_url} label="LinkedIn" icon="in" />
        )}
        {candidate.portfolio_url && (
          <ContactLink href={candidate.portfolio_url} label="Portfolio" icon="↗" />
        )}
        {candidate.resume_url && (
          <ContactLink href={candidate.resume_url} label="Resume PDF" icon="📄" />
        )}
      </div>
    </div>
  );
}

function SearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  const handleSubmit = () => {
    if (query.trim() && !loading) onSearch(query.trim());
  };

  const handleKey = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  const exampleQueries = [
    "React developer with 3+ years and startup experience",
    "Backend engineer who knows AWS and system design",
    "ML engineer with Python, PyTorch and research background",
    "Full stack developer with Node.js and PostgreSQL",
  ];

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Search input */}
      <div style={{
        display: "flex", gap: 10,
        background: "#fff",
        border: "1.5px solid #e2e8f0",
        borderRadius: 12,
        padding: "6px 6px 6px 16px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder='e.g. "React developer with 3 years and startup experience"'
          style={{
            flex: 1, border: "none", outline: "none",
            fontSize: 15, color: "#0f172a", background: "transparent",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !query.trim()}
          style={{
            padding: "10px 22px",
            borderRadius: 8, border: "none",
            background: loading || !query.trim() ? "#94a3b8" : "#2563eb",
            color: "#fff", cursor: loading || !query.trim() ? "not-allowed" : "pointer",
            fontSize: 14, fontWeight: 600, whiteSpace: "nowrap",
            transition: "background 0.15s",
          }}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {/* Example queries */}
      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
        <span style={{ fontSize: 11, color: "#94a3b8", alignSelf: "center" }}>Try:</span>
        {exampleQueries.map(q => (
          <button
            key={q}
            onClick={() => { setQuery(q); setTimeout(() => onSearch(q), 50); }}
            style={{
              padding: "4px 12px", borderRadius: 20,
              border: "1px solid #e2e8f0", background: "#f8fafc",
              cursor: "pointer", fontSize: 11, color: "#475569",
              transition: "all 0.1s",
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function SearchStats({ results, query, duration }) {
  if (!results || results.length === 0) return null;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginBottom: 16, padding: "8px 0",
      borderBottom: "1px solid #f1f5f9",
    }}>
      <div style={{ fontSize: 13, color: "#64748b" }}>
        <span style={{ fontWeight: 600, color: "#0f172a" }}>{results.length} candidates</span>
        {" "}matched for{" "}
        <span style={{ fontStyle: "italic", color: "#2563eb" }}>"{query}"</span>
      </div>
      {duration && (
        <div style={{ fontSize: 11, color: "#94a3b8" }}>
          {(duration / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  );
}

function EmptyState({ query }) {
  return (
    <div style={{
      textAlign: "center", padding: "48px 24px",
      background: "#f8fafc", borderRadius: 12,
      border: "1px dashed #e2e8f0",
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>
        No candidates found
      </div>
      <div style={{ fontSize: 13, color: "#64748b" }}>
        No resumes in the database match "{query}". <br />
        Try broader terms or check that resumes have been ingested.
      </div>
    </div>
  );
}

// ─── Main dashboard ────────────────────────────────────────────────────────────

export default function RecruiterSearchDashboard({ apiBase }) {
  const base = apiBase || API_BASE;

  const [results,   setResults]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [lastQuery, setLastQuery] = useState("");
  const [duration,  setDuration]  = useState(null);
  const [searched,  setSearched]  = useState(false);

  const handleSearch = useCallback(async (query) => {
    setLoading(true);
    setError(null);
    setSearched(true);
    setLastQuery(query);
    const t0 = Date.now();

    try {
      const res = await fetch(`${base}/api/search`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ query, top_k: 7 }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Search failed");
      }

      const data = await res.json();
      setResults(data.results || []);
      setDuration(Date.now() - t0);
    } catch (e) {
      setError(e.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [base]);

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      maxWidth: 780,
      margin: "0 auto",
      padding: "32px 20px",
    }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 }}>
          Candidate search
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          Search in natural language — AI matches candidates from the resume database
        </p>
      </div>

      <SearchBar onSearch={handleSearch} loading={loading} />

      {/* Loading skeleton */}
      {loading && (
        <div>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              background: "#f8fafc", borderRadius: 14,
              height: 160, marginBottom: 14,
              animation: "pulse 1.5s ease-in-out infinite",
              opacity: 1 - i * 0.15,
            }} />
          ))}
          <div style={{ textAlign: "center", fontSize: 13, color: "#94a3b8", marginTop: 8 }}>
            Analyzing resumes and generating summaries…
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{
          background: "#fee2e2", border: "1px solid #fca5a5",
          borderRadius: 10, padding: "12px 16px",
          fontSize: 13, color: "#b91c1c", marginBottom: 16,
        }}>
          Error: {error}
        </div>
      )}

      {/* Results */}
      {!loading && !error && searched && (
        <>
          <SearchStats results={results} query={lastQuery} duration={duration} />

          {results.length === 0
            ? <EmptyState query={lastQuery} />
            : results.map((candidate, i) => (
                <CandidateCard
                  key={candidate.candidate_id}
                  candidate={candidate}
                  query={lastQuery}
                  rank={i + 1}
                />
              ))
          }
        </>
      )}

      {/* Initial state */}
      {!searched && !loading && (
        <div style={{
          textAlign: "center", padding: "64px 24px", color: "#94a3b8",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>⌕</div>
          <div style={{ fontSize: 14 }}>
            Enter a natural language query to find matching candidates
          </div>
        </div>
      )}
    </div>
  );
}
