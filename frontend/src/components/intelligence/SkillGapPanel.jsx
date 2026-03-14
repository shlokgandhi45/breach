'use client';
import { useState } from 'react';
import { Loader2, BookOpen, Clock, AlertCircle, ArrowUpRight } from 'lucide-react';
import { analyzeSkillGaps } from '@/lib/candidateService';

const DIFFICULTY_COLORS = {
    beginner: 'bg-emerald-50 text-emerald-700',
    intermediate: 'bg-amber-50 text-amber-700',
    advanced: 'bg-red-50 text-red-700',
};

export default function SkillGapPanel({ candidate }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    async function runAnalysis() {
        setLoading(true);
        const skills = (candidate?.skills || []).map((s, i) => ({
            name: s,
            candidateLevel: Math.min(3, 3 - Math.floor(i / 3)),
            requiredLevel: 3,
        }));
        const payload = {
            skills,
            match_score: candidate?.matchScore || 80,
            role: candidate?.role || 'Software Engineer',
        };
        const result = await analyzeSkillGaps(payload);
        setData(result);
        setLoading(false);
    }

    if (!data && !loading) {
        return (
            <div className="text-center py-12 animate-in fade-in duration-500">
                <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
                    <BookOpen size={28} className="text-orange-600" />
                </div>
                <h3 className="text-[16px] font-bold text-[#111827] mb-2">Skill Gap Bridge</h3>
                <p className="text-[13px] text-[#6B7280] max-w-[380px] mx-auto leading-relaxed mb-6">
                    AI identifies skill gaps and recommends specific courses with estimated timelines to bridge each gap.
                </p>
                <button onClick={runAnalysis} className="btn-primary !text-[13px] !px-6">
                    Analyze Skill Gaps
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="text-center py-16 animate-in fade-in duration-500">
                <Loader2 size={28} className="animate-spin text-primary mx-auto mb-4" />
                <p className="text-[14px] font-semibold text-[#6B7280]">Analyzing skill gaps…</p>
                <p className="text-[12px] text-[#9CA3AF] mt-1">Generating learning bridge recommendations</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Bridges */}
            {(data?.bridges || []).length > 0 ? (
                <div className="space-y-4">
                    {data.bridges.map((b, i) => (
                        <div key={i} className="bg-white border border-[#E5E7EB] rounded-2xl p-5 hover:border-primary/30 hover:shadow-sm transition-all">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h4 className="text-[15px] font-bold text-[#111827]">{b.skill}</h4>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${DIFFICULTY_COLORS[b.difficulty] || DIFFICULTY_COLORS.intermediate}`}>
                                            {b.difficulty}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[13px] text-primary font-medium mb-2">
                                        <ArrowUpRight size={14} />
                                        <span>{b.course}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 bg-[#F8F9FB] rounded-lg px-3 py-2 flex-shrink-0">
                                    <Clock size={14} className="text-[#9CA3AF]" />
                                    <span className="text-[13px] font-bold text-[#374151] font-mono">{b.weeks_to_ready}</span>
                                    <span className="text-[11px] text-[#9CA3AF]">wks</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8 bg-emerald-50 rounded-2xl">
                    <p className="text-[14px] font-semibold text-emerald-700">No skill gaps detected!</p>
                    <p className="text-[12px] text-emerald-600 mt-1">Candidate is hire-ready for this role</p>
                </div>
            )}

            {/* Summary */}
            <div className="bg-[#F8F9FB] rounded-2xl p-5 border border-[#F3F4F6]">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[13px] font-semibold text-[#6B7280]">Time to Hire-Ready</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[24px] font-bold font-mono text-primary">{data?.total_weeks_to_hire_ready || 0}</span>
                        <span className="text-[12px] text-[#9CA3AF]">weeks</span>
                    </div>
                </div>
                <p className="text-[13px] text-[#4B5563] leading-relaxed">{data?.hire_now_recommendation || ''}</p>
            </div>

            {data?._mock && (
                <p className="text-[11px] text-amber-500 text-center">⚠ Showing mock data — start the backend for real AI analysis</p>
            )}

            <button onClick={runAnalysis} className="btn-secondary !text-[12px] w-full">Re-analyze</button>
        </div>
    );
}
