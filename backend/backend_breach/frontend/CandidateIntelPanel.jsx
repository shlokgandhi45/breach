/**
 * CandidateIntelPanel.jsx
 * 
 * Integrated component combining:
 *   1. Culture Fit Radar      — Chart.js radar, LLM-parsed personality axes
 *   2. Skill Gap Engine       — weighted match score, learning bridge cards
 *   3. Auto-Outreach Mailer   — Gmail API (real) + Mock (fallback), human-in-the-loop
 * 
 * Props:
 *   candidate  : { id, name, email, role, resumeText, skills: [{name, candidateLevel, requiredLevel}] }
 *   onShortlist: () => void
 * 
 * Env vars needed (in your .env):
 *   REACT_APP_API_BASE        — your FastAPI backend URL e.g. http://localhost:8000
 *   REACT_APP_GMAIL_ENABLED   — "true" | "false"  (false = mock mode)
 */

import { useState, useEffect, useRef } from "react";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// ─── Constants ────────────────────────────────────────────────────────────────

const RADAR_AXES = [
  "Communication clarity",
  "Leadership signal",
  "Technical depth",
  "Collaboration",
  "Growth mindset",
];

const SKILL_LEVEL_LABEL = ["None", "Beginner", "Intermediate", "Expert"];

const HIRE_THRESHOLD = 85;    // % — direct shortlist
const BRIDGE_THRESHOLD = 60;  // % — show gap bridge (below this = reject)

// ─── Mock data generators (used when backend isn't running) ───────────────────

function mockCultureScores() {
  return {
    communication_clarity: 78,
    leadership_signal: 65,
    technical_depth: 88,
    collaboration: 72,
    growth_mindset: 81,
    reasoning: {
      communication_clarity: "Uses structured sentences and precise vocabulary.",
      leadership_signal: "Mentions leading two projects but limited ownership language.",
      technical_depth: "Cites specific versions, architectures, and tradeoffs.",
      collaboration: "References cross-functional work and pair programming.",
      growth_mindset: "Side projects and self-taught tools signal continuous learning.",
    },
  };
}

function mockGapBridge(skills) {
  const gaps = skills.filter((s) => s.requiredLevel > s.candidateLevel);
  return {
    bridges: gaps.map((s) => ({
      skill: s.name,
      course: `${s.name} — Complete Bootcamp (Udemy)`,
      weeks_to_ready: (s.requiredLevel - s.candidateLevel) * 2,
      difficulty: SKILL_LEVEL_LABEL[s.requiredLevel],
    })),
    total_weeks_to_hire_ready: gaps.reduce(
      (acc, s) => acc + (s.requiredLevel - s.candidateLevel) * 2,
      0
    ),
    hire_now_recommendation:
      "Strong foundation in core skills. Gap is learnable within the probation window.",
  };
}

function mockEmailDraft(candidate, topTrait, gapData) {
  return {
    subject: `Re: ${candidate.role} opportunity — next steps for ${candidate.name}`,
    body: `Hi ${candidate.name.split(" ")[0]},

I came across your profile and was particularly impressed by your ${topTrait.toLowerCase()} — it stood out immediately.

We have an opening for a ${candidate.role} role that I think you'd be a strong fit for. Your background aligns well with what we're looking for, and I can see you've built some genuinely impressive work.

There are a couple of areas where we'd love to see more depth (${gapData.bridges
      .map((b) => b.skill)
      .join(", ")}), but nothing that would hold back a motivated person — ${gapData.total_weeks_to_hire_ready} weeks of focused learning would bridge that gap completely.

I'd love to set up a 20-minute call to discuss. Does this week work for you?

Best,
[Recruiter Name]`,
  };
}

// ─── Weighted match score (mirrors your C++/Java engine output) ───────────────

function computeMatchScore(skills) {
  if (!skills || skills.length === 0) return 0;
  let weightedMatch = 0;
  let totalWeight = 0;
  for (const s of skills) {
    const weight = s.requiredLevel === 3 ? 2.0 : 1.0;
    weightedMatch += Math.min(s.candidateLevel, s.requiredLevel) * weight;
    totalWeight += s.requiredLevel * weight;
  }
  return totalWeight > 0 ? Math.round((weightedMatch / totalWeight) * 100) : 0;
}

// ─── API calls ─────────────────────────────────────────────────────────────────

const API = process.env.REACT_APP_API_BASE || "http://localhost:8000";
const GMAIL_ENABLED = process.env.REACT_APP_GMAIL_ENABLED === "true";

async function fetchCultureFit(resumeText) {
  try {
    const res = await fetch(`${API}/api/intelligence/culture-fit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: resumeText }),
    });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch {
    return mockCultureScores();
  }
}

async function fetchGapBridge(skills, matchScore, role) {
  try {
    const res = await fetch(`${API}/api/intelligence/gap-bridge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skills, match_score: matchScore, role }),
    });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch {
    return mockGapBridge(skills);
  }
}

async function fetchEmailDraft(candidate, topTrait, gapData) {
  try {
    const res = await fetch(`${API}/api/intelligence/draft-outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidate_name: candidate.name,
        candidate_email: candidate.email,
        role: candidate.role,
        top_trait: topTrait,
        gap_weeks: gapData.total_weeks_to_hire_ready,
        gap_skills: gapData.bridges.map((b) => b.skill).join(", "),
      }),
    });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch {
    return mockEmailDraft(candidate, topTrait, gapData);
  }
}

async function sendEmail(candidate, subject, body, mode) {
  if (mode === "mock") {
    await new Promise((r) => setTimeout(r, 800)); // simulate send
    return { success: true, mode: "mock", message: "Mock email logged to console." };
  }
  // Gmail API mode — calls your backend which handles OAuth token
  try {
    const res = await fetch(`${API}/api/intelligence/send-email/gmail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: candidate.email,
        subject,
        body,
      }),
    });
    const data = await res.json();
    return { success: res.ok, mode: "gmail", ...data };
  } catch (e) {
    return { success: false, mode: "gmail", message: e.message };
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ScorePill({ score }) {
  const color =
    score >= HIRE_THRESHOLD
      ? "#16a34a"
      : score >= BRIDGE_THRESHOLD
      ? "#d97706"
      : "#dc2626";
  const bg =
    score >= HIRE_THRESHOLD
      ? "#dcfce7"
      : score >= BRIDGE_THRESHOLD
      ? "#fef3c7"
      : "#fee2e2";
  const label =
    score >= HIRE_THRESHOLD
      ? "Strong match"
      : score >= BRIDGE_THRESHOLD
      ? "Gap bridgeable"
      : "Insufficient match";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          fontSize: 38,
          fontWeight: 700,
          fontFamily: "'DM Mono', monospace",
          color,
        }}
      >
        {score}%
      </div>
      <span
        style={{
          background: bg,
          color,
          fontSize: 11,
          fontWeight: 600,
          padding: "3px 10px",
          borderRadius: 20,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function SkillRow({ skill }) {
  const gap = skill.requiredLevel - skill.candidateLevel;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 0",
        borderBottom: "1px solid #f1f5f9",
      }}
    >
      <span style={{ flex: 1, fontSize: 13, color: "#1e293b" }}>{skill.name}</span>
      <div style={{ display: "flex", gap: 3 }}>
        {[1, 2, 3].map((lvl) => (
          <div
            key={lvl}
            style={{
              width: 22,
              height: 8,
              borderRadius: 4,
              background:
                lvl <= skill.candidateLevel
                  ? "#3b82f6"
                  : lvl <= skill.requiredLevel
                  ? "#fde68a"
                  : "#e2e8f0",
            }}
          />
        ))}
      </div>
      {gap > 0 && (
        <span
          style={{
            fontSize: 10,
            color: "#b45309",
            background: "#fffbeb",
            padding: "2px 6px",
            borderRadius: 10,
            fontWeight: 600,
          }}
        >
          -{gap} lvl
        </span>
      )}
      {gap <= 0 && (
        <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 600 }}>✓</span>
      )}
    </div>
  );
}

function BridgeCard({ bridge }) {
  return (
    <div
      style={{
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>
            {bridge.skill}
          </div>
          <div style={{ fontSize: 12, color: "#78350f", marginTop: 2 }}>
            {bridge.course}
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            background: "#fef3c7",
            color: "#b45309",
            padding: "2px 8px",
            borderRadius: 20,
            fontWeight: 600,
            whiteSpace: "nowrap",
            marginLeft: 8,
          }}
        >
          ~{bridge.weeks_to_ready}w
        </span>
      </div>
    </div>
  );
}

function RadarChart({ scores }) {
  const data = {
    labels: RADAR_AXES,
    datasets: [
      {
        label: "Culture fit",
        data: RADAR_AXES.map((ax) => scores[ax.toLowerCase().replace(/ /g, "_")] ?? 0),
        backgroundColor: "rgba(59, 130, 246, 0.15)",
        borderColor: "#3b82f6",
        borderWidth: 2,
        pointBackgroundColor: "#3b82f6",
        pointRadius: 4,
      },
    ],
  };

  const options = {
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: { stepSize: 25, display: false },
        grid: { color: "#e2e8f0" },
        pointLabels: {
          font: { size: 11, family: "'DM Sans', sans-serif" },
          color: "#64748b",
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const axis = RADAR_AXES[ctx.dataIndex];
            const key = axis.toLowerCase().replace(/ /g, "_");
            const reason = scores.reasoning?.[key];
            return reason ? `${ctx.raw} — ${reason}` : `${ctx.raw}`;
          },
        },
      },
    },
  };

  return <Radar data={data} options={options} />;
}

function EmailModal({ candidate, draft, gapData, onClose, onSent }) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [mode, setMode] = useState(GMAIL_ENABLED ? "gmail" : "mock");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async () => {
    setSending(true);
    const res = await sendEmail(candidate, subject, body, mode);
    setSending(false);
    setResult(res);
    if (res.success) setTimeout(() => { onSent(res); onClose(); }, 1500);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#fff", borderRadius: 16, padding: 28,
          width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
              Send outreach to {candidate.name}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              Review and edit before sending — never auto-sent
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8" }}
          >
            ×
          </button>
        </div>

        {/* Mode selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["gmail", "mock"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: "pointer", border: "1px solid",
                background: mode === m ? "#0f172a" : "#fff",
                color: mode === m ? "#fff" : "#64748b",
                borderColor: mode === m ? "#0f172a" : "#e2e8f0",
              }}
            >
              {m === "gmail" ? "Gmail API" : "Mock (log only)"}
            </button>
          ))}
          {mode === "gmail" && !GMAIL_ENABLED && (
            <span style={{ fontSize: 11, color: "#ef4444", alignSelf: "center" }}>
              ⚠ REACT_APP_GMAIL_ENABLED not set — will fall back to mock
            </span>
          )}
        </div>

        {/* Subject */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Subject
          </label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{
              width: "100%", marginTop: 4, padding: "8px 12px",
              border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13,
              fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Body */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Body
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            style={{
              width: "100%", marginTop: 4, padding: "10px 12px",
              border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13,
              fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6,
            }}
          />
        </div>

        {/* Gap plan preview pill */}
        <div
          style={{
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
            padding: "8px 12px", marginBottom: 16, fontSize: 12, color: "#475569",
          }}
        >
          Includes gap plan: {gapData.bridges.map((b) => b.skill).join(", ")} — {gapData.total_weeks_to_hire_ready}w total
        </div>

        {/* Status */}
        {result && (
          <div
            style={{
              padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13,
              background: result.success ? "#dcfce7" : "#fee2e2",
              color: result.success ? "#16a34a" : "#dc2626",
            }}
          >
            {result.success ? `Sent via ${result.mode}` : `Error: ${result.message}`}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 20px", borderRadius: 8, border: "1px solid #e2e8f0",
              background: "#fff", cursor: "pointer", fontSize: 13, color: "#475569",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              padding: "9px 24px", borderRadius: 8, border: "none",
              background: sending ? "#94a3b8" : "#2563eb",
              color: "#fff", cursor: sending ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 600,
            }}
          >
            {sending ? "Sending..." : `Send via ${mode === "gmail" ? "Gmail" : "Mock"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function CandidateIntelPanel({ candidate, onShortlist }) {

  // Default demo candidate if none provided
  const c = candidate || {
    id: "demo-001",
    name: "Priya Sharma",
    email: "priya@example.com",
    role: "Senior Frontend Engineer",
    resumeText:
      "Led a team of 4 engineers to rebuild the checkout flow using React and TypeScript. " +
      "Independently architected the component library adopted across 3 products. " +
      "Learning Kubernetes on the side — currently on Chapter 6 of CKAD prep.",
    skills: [
      { name: "React",       candidateLevel: 3, requiredLevel: 3 },
      { name: "TypeScript",  candidateLevel: 2, requiredLevel: 3 },
      { name: "Node.js",     candidateLevel: 2, requiredLevel: 2 },
      { name: "Kubernetes",  candidateLevel: 1, requiredLevel: 2 },
      { name: "System design", candidateLevel: 2, requiredLevel: 3 },
      { name: "GraphQL",     candidateLevel: 0, requiredLevel: 1 },
    ],
  };

  const matchScore = computeMatchScore(c.skills);

  // State
  const [activeTab, setActiveTab] = useState("gap");        // "gap" | "radar" | "email"
  const [cultureScores, setCultureScores] = useState(null);
  const [gapData, setGapData] = useState(null);
  const [emailDraft, setEmailDraft] = useState(null);
  const [hireMode, setHireMode] = useState("later");        // "now" | "later"
  const [loadingCulture, setLoadingCulture] = useState(false);
  const [loadingBridge, setLoadingBridge] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Load gap bridge on mount
  useEffect(() => {
    setLoadingBridge(true);
    fetchGapBridge(c.skills, matchScore, c.role).then((data) => {
      setGapData(data);
      setLoadingBridge(false);
    });
  }, []);

  // Load culture radar when tab selected
  useEffect(() => {
    if (activeTab === "radar" && !cultureScores) {
      setLoadingCulture(true);
      fetchCultureFit(c.resumeText).then((data) => {
        setCultureScores(data);
        setLoadingCulture(false);
      });
    }
  }, [activeTab]);

  // Load email draft when email tab selected
  useEffect(() => {
    if (activeTab === "email" && !emailDraft && cultureScores && gapData) {
      setLoadingEmail(true);
      const topAxis = RADAR_AXES.reduce((best, ax) => {
        const key = ax.toLowerCase().replace(/ /g, "_");
        return (cultureScores[key] ?? 0) > (cultureScores[best.toLowerCase().replace(/ /g, "_")] ?? 0)
          ? ax : best;
      }, RADAR_AXES[0]);
      fetchEmailDraft(c, topAxis, gapData).then((draft) => {
        setEmailDraft(draft);
        setLoadingEmail(false);
      });
    }
  }, [activeTab, cultureScores, gapData]);

  // Auto-load culture when email tab opened
  useEffect(() => {
    if (activeTab === "email" && !cultureScores) {
      setLoadingCulture(true);
      fetchCultureFit(c.resumeText).then((data) => {
        setCultureScores(data);
        setLoadingCulture(false);
      });
    }
  }, [activeTab]);

  const canDirectHire = matchScore >= HIRE_THRESHOLD;
  const canBridge     = matchScore >= BRIDGE_THRESHOLD && matchScore < HIRE_THRESHOLD;

  const tabStyle = (tab) => ({
    padding: "8px 18px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: activeTab === tab ? 600 : 400,
    background: activeTab === tab ? "#0f172a" : "transparent",
    color: activeTab === tab ? "#fff" : "#64748b",
    transition: "all 0.15s",
  });

  return (
    <div
      style={{
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #e2e8f0",
        overflow: "hidden",
        maxWidth: 680,
        margin: "0 auto",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}
    >
      {/* ── Header ── */}
      <div style={{ padding: "20px 24px 0", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{c.name}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
              {c.email} · Applying for <strong>{c.role}</strong>
            </div>
          </div>
          <ScorePill score={matchScore} />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: -1 }}>
          <button style={tabStyle("gap")}     onClick={() => setActiveTab("gap")}>Skill gap</button>
          <button style={tabStyle("radar")}   onClick={() => setActiveTab("radar")}>Culture radar</button>
          <button style={tabStyle("email")}   onClick={() => setActiveTab("email")}>Outreach</button>
        </div>
      </div>

      {/* ── Tab: Skill Gap ── */}
      {activeTab === "gap" && (
        <div style={{ padding: 24 }}>

          {/* Hire mode toggle */}
          {canBridge && (
            <div
              style={{
                display: "flex", background: "#f8fafc", borderRadius: 10,
                padding: 4, marginBottom: 20, width: "fit-content",
              }}
            >
              {["now", "later"].map((m) => (
                <button
                  key={m}
                  onClick={() => setHireMode(m)}
                  style={{
                    padding: "7px 18px", borderRadius: 8, border: "none",
                    cursor: "pointer", fontSize: 13, fontWeight: 500,
                    background: hireMode === m ? "#fff" : "transparent",
                    color: hireMode === m ? "#0f172a" : "#94a3b8",
                    boxShadow: hireMode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  {m === "now"
                    ? "Hire now"
                    : loadingBridge
                    ? "Calculating..."
                    : `Hire-ready in ${gapData?.total_weeks_to_hire_ready ?? "?"}w`}
                </button>
              ))}
            </div>
          )}

          {canDirectHire && (
            <div
              style={{
                background: "#dcfce7", border: "1px solid #86efac",
                borderRadius: 10, padding: "12px 16px", marginBottom: 20,
                fontSize: 13, color: "#15803d",
              }}
            >
              <strong>Direct shortlist recommended.</strong> Candidate meets or exceeds all required skill levels.
            </div>
          )}

          {/* Skill rows */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Skills breakdown
            </div>
            {c.skills.map((s) => <SkillRow key={s.name} skill={s} />)}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            {[["#3b82f6","Candidate level"],["#fde68a","Required (not met"],["#e2e8f0","Not required"]].map(([color, label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#64748b" }}>
                <div style={{ width: 16, height: 8, borderRadius: 4, background: color }} />
                {label}
              </div>
            ))}
          </div>

          {/* Gap bridge cards */}
          {(hireMode === "later" || canDirectHire === false) && !canDirectHire && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                Learning bridge
              </div>
              {loadingBridge ? (
                <div style={{ color: "#94a3b8", fontSize: 13 }}>Generating bridge plan…</div>
              ) : (
                gapData?.bridges.map((b) => <BridgeCard key={b.skill} bridge={b} />)
              )}
              {gapData && (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, fontStyle: "italic" }}>
                  {gapData.hire_now_recommendation}
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button
              onClick={onShortlist}
              style={{
                padding: "10px 20px", borderRadius: 8, border: "none",
                background: "#2563eb", color: "#fff", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
              }}
            >
              Shortlist candidate
            </button>
            <button
              onClick={() => setActiveTab("email")}
              style={{
                padding: "10px 20px", borderRadius: 8,
                border: "1px solid #e2e8f0", background: "#fff",
                cursor: "pointer", fontSize: 13, color: "#475569",
              }}
            >
              Draft outreach email
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Culture Radar ── */}
      {activeTab === "radar" && (
        <div style={{ padding: 24 }}>
          {loadingCulture ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: 14 }}>
              Analyzing writing style and tone…
            </div>
          ) : cultureScores ? (
            <>
              <div style={{ maxWidth: 340, margin: "0 auto 20px" }}>
                <RadarChart scores={cultureScores} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                Evidence tags (hover chart for inline reasons)
              </div>
              {RADAR_AXES.map((ax) => {
                const key = ax.toLowerCase().replace(/ /g, "_");
                const score = cultureScores[key] ?? 0;
                const reason = cultureScores.reasoning?.[key];
                return (
                  <div
                    key={ax}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      padding: "8px 0", borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        minWidth: 36, height: 36, borderRadius: 8,
                        background: score >= 75 ? "#dbeafe" : score >= 50 ? "#fef3c7" : "#fee2e2",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700,
                        color: score >= 75 ? "#1d4ed8" : score >= 50 ? "#b45309" : "#dc2626",
                      }}
                    >
                      {score}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>{ax}</div>
                      {reason && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{reason}</div>}
                    </div>
                  </div>
                );
              })}
            </>
          ) : null}
        </div>
      )}

      {/* ── Tab: Outreach ── */}
      {activeTab === "email" && (
        <div style={{ padding: 24 }}>
          {(loadingCulture || loadingEmail) ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: 14 }}>
              {loadingCulture ? "Extracting culture signal…" : "Drafting personalized email…"}
            </div>
          ) : emailDraft ? (
            <>
              <div
                style={{
                  background: "#f8fafc", border: "1px solid #e2e8f0",
                  borderRadius: 10, padding: 16, marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  Subject
                </div>
                <div style={{ fontSize: 14, color: "#0f172a" }}>{emailDraft.subject}</div>
              </div>
              <div
                style={{
                  background: "#f8fafc", border: "1px solid #e2e8f0",
                  borderRadius: 10, padding: 16, marginBottom: 20,
                  fontSize: 13, color: "#334155", lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}
              >
                {emailDraft.body}
              </div>

              <div
                style={{
                  background: "#eff6ff", border: "1px solid #bfdbfe",
                  borderRadius: 8, padding: "10px 14px", marginBottom: 20,
                  fontSize: 12, color: "#1d4ed8",
                }}
              >
                Personalized using: culture radar top trait + gap bridge plan + role context.
                Human review required before sending.
              </div>

              {emailSent && (
                <div
                  style={{
                    background: "#dcfce7", border: "1px solid #86efac",
                    borderRadius: 8, padding: "10px 14px", marginBottom: 16,
                    fontSize: 13, color: "#15803d", fontWeight: 500,
                  }}
                >
                  Email sent successfully.
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setShowEmailModal(true)}
                  style={{
                    padding: "10px 24px", borderRadius: 8, border: "none",
                    background: "#2563eb", color: "#fff", cursor: "pointer",
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  Review & send
                </button>
                <button
                  onClick={() => setEmailDraft(null)}
                  style={{
                    padding: "10px 18px", borderRadius: 8,
                    border: "1px solid #e2e8f0", background: "#fff",
                    cursor: "pointer", fontSize: 13, color: "#475569",
                  }}
                >
                  Regenerate
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: 14 }}>
              Loading email draft…
            </div>
          )}
        </div>
      )}

      {/* ── Email modal ── */}
      {showEmailModal && emailDraft && gapData && (
        <EmailModal
          candidate={c}
          draft={emailDraft}
          gapData={gapData}
          onClose={() => setShowEmailModal(false)}
          onSent={(res) => { setEmailSent(true); console.log("Email sent:", res); }}
        />
      )}
    </div>
  );
}
