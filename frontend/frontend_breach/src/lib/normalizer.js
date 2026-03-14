/**
 * src/lib/normalizer.js
 *
 * Transforms backend API responses into the exact shape that frontend
 * components expect. Acts as a safety net — if the backend already sends
 * the correct shape (via response_adapter.py), this is mostly a passthrough.
 *
 * This file is the frontend's single source of truth for data shapes.
 */

/**
 * Avatar color palette — must match backend response_adapter.py
 */
const AVATAR_COLORS = [
    'bg-violet-100 text-violet-700',
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-orange-100 text-orange-700',
    'bg-pink-100 text-pink-700',
    'bg-cyan-100 text-cyan-700',
    'bg-amber-100 text-amber-700',
    'bg-indigo-100 text-indigo-700',
    'bg-rose-100 text-rose-700',
    'bg-teal-100 text-teal-700',
];

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash);
}

function getInitials(name) {
    if (!name) return '??';
    return name
        .split(' ')
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase() || '')
        .join('');
}

function getColor(name) {
    if (!name) return AVATAR_COLORS[0];
    return AVATAR_COLORS[hashString(name) % AVATAR_COLORS.length];
}

/**
 * Normalize a single candidate object from the backend API response.
 * Handles both the response_adapter format and the raw search result format.
 *
 * @param {object} raw - Backend candidate object
 * @returns {object} - Frontend-compatible candidate object
 */
export function normalizeCandidate(raw) {
    if (!raw) return null;

    const name = raw.name || raw.full_name || 'Unknown';

    return {
        // Core identity
        id:               raw.id || raw.candidate_id || '',
        name:             name,
        initials:         raw.initials || getInitials(name),
        color:            raw.color || getColor(name),

        // Professional
        role:             raw.role || raw.current_role || raw.job_title || null,
        currentCompany:   raw.currentCompany || raw.company || null,
        previousCompanies: raw.previousCompanies || [],

        // Contact
        location:         raw.location || null,
        email:            raw.email || null,
        phone:            raw.phone || null,
        linkedinUrl:      raw.linkedinUrl || raw.linkedin_url || null,
        portfolioUrl:     raw.portfolioUrl || raw.portfolio_url || null,

        // Experience
        experienceYears:  raw.experienceYears ?? (
            raw.experience_years != null
                ? (typeof raw.experience_years === 'string'
                    ? parseInt(raw.experience_years)
                    : Math.round(raw.experience_years))
                : null
        ),

        // Match & Pipeline
        matchScore:       raw.matchScore ?? raw.final_score ?? 0,
        status:           raw.status || raw.pipeline_stage || 'Applied',
        source:           raw.source || raw.resume_source || 'Upload',

        // Skills & Education
        skills:           raw.skills || raw.all_skills || [],
        education:        raw.education || null,

        // Compensation
        salary:           raw.salary || null,
        noticePeriod:     raw.noticePeriod || raw.notice_period || null,

        // Timestamps
        appliedDate:      raw.appliedDate || raw.applied_date || null,
        lastActivity:     raw.lastActivity || raw.last_activity || null,

        // AI
        summary:          raw.summary || raw.ai_summary || null,
        matchedSkills:    raw.matchedSkills || raw.matched_skills || [],
        skillGaps:        raw.skillGaps || raw.skill_gaps || [],
        confidence:       raw.confidence || null,

        // Display extras
        tags:             raw.tags || [],
        timeline:         raw.timeline || [],

        // Resume
        resumeUrl:        raw.resumeUrl || raw.resume_url || null,
    };
}

/**
 * Normalize an array of candidates.
 * @param {object[]} rawList
 * @returns {object[]}
 */
export function normalizeCandidateList(rawList) {
    if (!Array.isArray(rawList)) return [];
    return rawList.map(normalizeCandidate).filter(Boolean);
}
