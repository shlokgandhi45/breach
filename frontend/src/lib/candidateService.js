'use client';
/**
 * src/lib/candidateService.js
 *
 * Central data-fetching service. Every function tries the API first,
 * then falls back to mock data if the backend is unavailable.
 *
 * This means the frontend works identically whether the backend is
 * running or not — no blank screens.
 */

import { apiGet, apiPost, apiPatch, apiUpload } from './api';
import { normalizeCandidateList, normalizeCandidate } from './normalizer';
import { candidates as mockCandidates, pipelineStages } from '@/data/candidates';

// ─── Helpers ───────────────────────────────────────────────────────
function warn(endpoint, err) {
    console.warn(`[BREACH] API ${endpoint} unavailable — using mock data.`, err?.message || '');
}

// ─── Candidates ────────────────────────────────────────────────────

/**
 * Fetch all candidates, with optional filters.
 * @param {{ search?: string, status?: string, source?: string }} filters
 * @returns {Promise<object[]>}
 */
export async function fetchCandidates(filters = {}) {
    try {
        const data = await apiGet('/api/candidates', filters);
        return normalizeCandidateList(data);
    } catch (err) {
        warn('/api/candidates', err);
        // Apply filters to mock data
        let result = [...mockCandidates];
        if (filters.search) {
            const term = filters.search.toLowerCase();
            result = result.filter(c =>
                c.name.toLowerCase().includes(term) ||
                c.role.toLowerCase().includes(term)
            );
        }
        if (filters.status && filters.status !== 'All') {
            result = result.filter(c => c.status === filters.status);
        }
        if (filters.source) {
            result = result.filter(c => c.source === filters.source);
        }
        return result;
    }
}

/**
 * Fetch a single candidate by ID.
 * @param {string|number} id
 * @returns {Promise<object|null>}
 */
export async function fetchCandidateById(id) {
    try {
        const data = await apiGet(`/api/candidates/${id}`);
        return normalizeCandidate(data);
    } catch (err) {
        warn(`/api/candidates/${id}`, err);
        return mockCandidates.find(c => String(c.id) === String(id)) || mockCandidates[0] || null;
    }
}

// ─── Dashboard ─────────────────────────────────────────────────────

/**
 * Fetch dashboard stats (total, pipeline counts, top candidates, interviews).
 * @returns {Promise<object>}
 */
export async function fetchDashboardStats() {
    try {
        const data = await apiGet('/api/dashboard/stats');
        return {
            total_candidates:     data.total_candidates,
            pipeline_counts:      data.pipeline_counts,
            top_candidates:       normalizeCandidateList(data.top_candidates || []),
            interview_candidates: normalizeCandidateList(data.interview_candidates || []),
        };
    } catch (err) {
        warn('/api/dashboard/stats', err);
        // Build stats from mock data
        const pipeline_counts = {};
        pipelineStages.forEach(s => { pipeline_counts[s] = 0; });
        mockCandidates.forEach(c => {
            if (pipeline_counts[c.status] !== undefined) pipeline_counts[c.status]++;
        });
        return {
            total_candidates:     mockCandidates.length,
            pipeline_counts,
            top_candidates:       mockCandidates.filter(c => c.matchScore >= 80).slice(0, 4),
            interview_candidates: mockCandidates.filter(c => ['Interview', 'Technical'].includes(c.status)).slice(0, 3),
        };
    }
}

// ─── Pipeline ──────────────────────────────────────────────────────

/**
 * Fetch the pipeline board (candidates grouped by stage).
 * @returns {Promise<{ stages: string[], board: Record<string, object[]> }>}
 */
export async function fetchPipelineBoard() {
    try {
        const data = await apiGet('/api/pipeline/board');
        // Normalize each stage's candidates
        const board = {};
        for (const stage of (data.stages || pipelineStages)) {
            board[stage] = normalizeCandidateList(data.board?.[stage] || []);
        }
        return { stages: data.stages || pipelineStages, board };
    } catch (err) {
        warn('/api/pipeline/board', err);
        // Build board from mock data
        const board = {};
        pipelineStages.forEach(s => { board[s] = []; });
        mockCandidates.forEach(c => {
            if (board[c.status]) board[c.status].push(c);
        });
        return { stages: pipelineStages, board };
    }
}

/**
 * Move a candidate to a different pipeline stage.
 * @param {string} candidateId
 * @param {string} targetStage
 * @returns {Promise<{ success: boolean }>}
 */
export async function movePipelineCandidate(candidateId, targetStage) {
    try {
        return await apiPatch('/api/pipeline/move', {
            candidate_id: String(candidateId),
            target_stage: targetStage,
        });
    } catch (err) {
        warn('/api/pipeline/move', err);
        // In mock mode, the local state handles the move — just return success
        return { success: true, mock: true };
    }
}

// ─── AI Search ─────────────────────────────────────────────────────

/**
 * Natural language AI-powered search.
 * @param {string} query - e.g. "ML engineer with PyTorch in Seattle"
 * @param {number} topK  - max results (default 7)
 * @returns {Promise<{ query: string, total_found: number, results: object[] }>}
 */
export async function searchCandidates(query, topK = 7) {
    try {
        const data = await apiPost('/api/search', { query, top_k: topK });
        return {
            query:       data.query,
            total_found: data.total_found,
            results:     normalizeCandidateList(data.results || []),
        };
    } catch (err) {
        warn('/api/search', err);
        // Local fallback: simple text search
        const term = query.toLowerCase();
        const matched = mockCandidates.filter(c =>
            c.name.toLowerCase().includes(term) ||
            c.role.toLowerCase().includes(term) ||
            c.skills.some(s => s.toLowerCase().includes(term))
        );
        return {
            query,
            total_found: matched.length,
            results: matched,
        };
    }
}

// ─── Resume Upload ─────────────────────────────────────────────────

/**
 * Upload a single resume PDF.
 * @param {File} file - PDF file object
 * @param {string} source - resume source ('pdf_upload', 'linkedin', etc.)
 * @returns {Promise<object>}
 */
export async function uploadResume(file, source = 'pdf_upload') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('resume_source', source);
    try {
        return await apiUpload('/api/ingest/upload', formData);
    } catch (err) {
        warn('/api/ingest/upload', err);
        return { success: false, error: 'Backend unavailable. Please start the backend server to upload resumes.' };
    }
}

// ─── Intelligence ──────────────────────────────────────────────────

/**
 * AI culture fit analysis from resume text.
 * @param {string} text - resume/candidate text
 * @returns {Promise<object>} - 5-axis scores + reasoning
 */
export async function analyzeCultureFit(text) {
    try {
        return await apiPost('/api/intelligence/culture-fit', { text });
    } catch (err) {
        warn('/api/intelligence/culture-fit', err);
        return {
            communication_clarity: 72, leadership_signal: 65, technical_depth: 85,
            collaboration: 78, growth_mindset: 80,
            reasoning: {
                communication_clarity: 'Mock: Clear technical writing style observed.',
                leadership_signal: 'Mock: Some leadership indicators present.',
                technical_depth: 'Mock: Strong technical vocabulary and specificity.',
                collaboration: 'Mock: References to cross-functional teamwork.',
                growth_mindset: 'Mock: Evidence of continuous learning and side projects.',
            },
            _mock: true,
        };
    }
}

/**
 * Skill gap analysis + bridge recommendations.
 * @param {{ skills: object[], match_score: number, role: string }} payload
 * @returns {Promise<object>} - bridges, total_weeks, recommendation
 */
export async function analyzeSkillGaps(payload) {
    try {
        return await apiPost('/api/intelligence/gap-bridge', payload);
    } catch (err) {
        warn('/api/intelligence/gap-bridge', err);
        return {
            bridges: [
                { skill: 'Example Skill', course: 'Advanced Course — Udemy', weeks_to_ready: 4, difficulty: 'intermediate' },
            ],
            total_weeks_to_hire_ready: 4,
            hire_now_recommendation: 'Mock: Candidate shows strong potential. Minor upskilling recommended.',
            _mock: true,
        };
    }
}

/**
 * Draft a personalized outreach email.
 * @param {object} payload - { candidate_name, candidate_email, role, top_trait, gap_weeks, gap_skills }
 * @returns {Promise<{ subject: string, body: string }>}
 */
export async function draftOutreachEmail(payload) {
    try {
        return await apiPost('/api/intelligence/draft-outreach', payload);
    } catch (err) {
        warn('/api/intelligence/draft-outreach', err);
        return {
            subject: `Exciting ${payload.role} opportunity — your ${payload.top_trait} stood out`,
            body: `Hi ${payload.candidate_name},\n\nI came across your profile and was genuinely impressed by your ${payload.top_trait}. We have an open ${payload.role} position that aligns well with your background.\n\nI noticed you'd benefit from some growth in ${payload.gap_skills}, but our team has a structured onboarding that could bridge that in about ${payload.gap_weeks} weeks.\n\nWould you be open to a quick 15-minute call this week?\n\nBest,\n[Recruiter Name]`,
            _mock: true,
        };
    }
}

/**
 * Send an email (mock or Gmail).
 * @param {{ to: string, subject: string, body: string }} payload
 * @param {boolean} useMock - use mock sender
 * @returns {Promise<object>}
 */
export async function sendEmail(payload, useMock = true) {
    const endpoint = useMock ? '/api/intelligence/send-email/mock' : '/api/intelligence/send-email/gmail';
    try {
        return await apiPost(endpoint, payload);
    } catch (err) {
        warn(endpoint, err);
        return { success: false, error: 'Backend unavailable. Cannot send email.', _mock: true };
    }
}
/**
 * Schedule an interview and sync to Google Sheets.
 * @param {string} candidateId 
 * @returns {Promise<object>}
 */
export async function scheduleInterview(candidateId) {
    try {
        return await apiPost('/api/scheduling/interview', { candidate_id: String(candidateId) });
    } catch (err) {
        warn('/api/scheduling/interview', err);
        return { 
            success: true, 
            message: 'Interview scheduled locally. (Mock mode: Google Sheet sync skipped)',
            _mock: true 
        };
    }
}

/**
 * Fetch the archive of scheduled interviews from the Google Sheet.
 * @returns {Promise<object[]>}
 */
export async function fetchScheduleArchive() {
    try {
        const data = await apiGet('/api/scheduling/archive');
        return data.rows || [];
    } catch (err) {
        warn('/api/scheduling/archive', err);
        // Fallback to mock data
        return [
            { ID: "1", Name: "Aisha Patel", Email: "aisha@example.com", Role: "ML Engineer", Company: "TechFlow", Score: 92, Location: "Mumbai", Status: "Interview Scheduled" },
            { ID: "2", Name: "Vikram Singh", Email: "vikram@example.com", Role: "Backend Dev", Company: "DataStream", Score: 88, Location: "Bangalore", Status: "Interview Scheduled" },
        ];
    }
}

