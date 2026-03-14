'use client';
import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { fetchDashboardStats } from '@/lib/candidateService';

const stageColors = {
    'Applied':   'bg-gray-200',
    'Screening': 'bg-blue-200',
    'Technical': 'bg-violet-200',
    'Interview': 'bg-orange-200',
    'Offer':     'bg-emerald-200',
    'Hired':     'bg-green-300',
};

const STAGE_ORDER = ['Applied', 'Screening', 'Technical', 'Interview', 'Offer', 'Hired'];

export default function PipelineFlow() {
    const [stages, setStages] = useState([]);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            const data = await fetchDashboardStats();
            if (!cancelled) {
                const built = STAGE_ORDER.map(label => ({
                    label,
                    count: data.pipeline_counts?.[label] || 0,
                    color: stageColors[label] || 'bg-gray-200',
                }));
                setStages(built);
            }
        }
        load();
        return () => { cancelled = true; };
    }, []);

    const max = Math.max(...stages.map(s => s.count), 1);

    return (
        <div className="section-card p-5 mb-5">
            <h2 className="text-[13px] font-semibold text-[#111827] mb-4">Hiring Pipeline</h2>
            <div className="flex items-end gap-2">
                {stages.map((stage, i) => (
                    <div key={stage.label} className="flex-1 flex flex-col items-center gap-1.5">
                        <span className="text-[12px] font-mono font-bold text-[#374151]">{stage.count}</span>
                        <div
                            className={`w-full rounded-[6px] ${stage.color} transition-all`}
                            style={{ height: `${(stage.count / max) * 80 + 20}px` }}
                        />
                        <span className="text-[10px] font-medium text-[#6B7280] text-center">{stage.label}</span>
                        {i < stages.length - 1 && (
                            <ArrowRight size={10} className="absolute text-[#D1D5DB] hidden" />
                        )}
                    </div>
                ))}
                {stages.length === 0 && (
                    <p className="text-[12px] text-[#9CA3AF] text-center w-full py-4">Loading pipeline…</p>
                )}
            </div>
        </div>
    );
}
