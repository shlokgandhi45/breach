'use client';
import { useState } from 'react';
import { Radar, Loader2, AlertCircle } from 'lucide-react';
import { analyzeCultureFit } from '@/lib/candidateService';

const AXES = [
    { key: 'communication_clarity', label: 'Communication', color: '#3B82F6' },
    { key: 'leadership_signal', label: 'Leadership', color: '#8B5CF6' },
    { key: 'technical_depth', label: 'Technical Depth', color: '#10B981' },
    { key: 'collaboration', label: 'Collaboration', color: '#F59E0B' },
    { key: 'growth_mindset', label: 'Growth Mindset', color: '#EF4444' },
];

export default function CultureFitPanel({ candidate }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    async function runAnalysis() {
        setLoading(true);
        setError(null);
        const text = candidate?.summary || `${candidate?.name}, ${candidate?.role} at ${candidate?.currentCompany}. Skills: ${(candidate?.skills || []).join(', ')}.`;
        const result = await analyzeCultureFit(text);
        if (result) {
            setData(result);
        } else {
            setError('Analysis failed. Please try again.');
        }
        setLoading(false);
    }

    if (!data && !loading) {
        return (
            <div className="text-center py-12 animate-in fade-in duration-500">
                <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
                    <Radar size={28} className="text-violet-600" />
                </div>
                <h3 className="text-[16px] font-bold text-[#111827] mb-2">Culture Fit Analysis</h3>
                <p className="text-[13px] text-[#6B7280] max-w-[380px] mx-auto leading-relaxed mb-6">
                    AI analyzes the candidate's resume to score 5 personality axes: communication, leadership, technical depth, collaboration, and growth mindset.
                </p>
                <button onClick={runAnalysis} className="btn-primary !text-[13px] !px-6">
                    Run AI Analysis
                </button>
                {error && <p className="text-[12px] text-red-500 mt-3 flex items-center gap-1 justify-center"><AlertCircle size={12} />{error}</p>}
            </div>
        );
    }

    if (loading) {
        return (
            <div className="text-center py-16 animate-in fade-in duration-500">
                <Loader2 size={28} className="animate-spin text-primary mx-auto mb-4" />
                <p className="text-[14px] font-semibold text-[#6B7280]">Analyzing culture fit…</p>
                <p className="text-[12px] text-[#9CA3AF] mt-1">AI is reading the candidate's profile</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Score bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                {AXES.map(({ key, label, color }) => {
                    const score = data?.[key] ?? 0;
                    return (
                        <div key={key} className="group">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[14px] font-bold text-[#374151] group-hover:text-primary transition-colors">{label}</span>
                                <span className="text-[13px] font-mono font-bold" style={{ color }}>{score}</span>
                            </div>
                            <div className="h-2.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${score}%`, backgroundColor: color }}
                                />
                            </div>
                            {data?.reasoning?.[key] && (
                                <p className="text-[11px] text-[#9CA3AF] mt-1.5 leading-snug italic">
                                    "{data.reasoning[key]}"
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Overall summary */}
            <div className="bg-[#F8F9FB] rounded-2xl p-5 border border-[#F3F4F6]">
                <p className="text-[13px] font-semibold text-[#6B7280] mb-1">Overall Culture Score</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-[28px] font-bold font-mono text-primary">
                        {Math.round(AXES.reduce((sum, { key }) => sum + (data?.[key] ?? 0), 0) / AXES.length)}
                    </span>
                    <span className="text-[13px] text-[#9CA3AF] font-medium">/ 100</span>
                </div>
            </div>

            {data?._mock && (
                <p className="text-[11px] text-amber-500 text-center">⚠ Showing mock data — start the backend for real AI analysis</p>
            )}

            <button onClick={runAnalysis} className="btn-secondary !text-[12px] w-full">Re-run Analysis</button>
        </div>
    );
}
