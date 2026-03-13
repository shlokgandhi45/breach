import { ArrowRight } from 'lucide-react';

const stages = [
    { label: 'Applied', count: 14, color: 'bg-gray-200' },
    { label: 'Screening', count: 8, color: 'bg-blue-200' },
    { label: 'Technical', count: 6, color: 'bg-violet-200' },
    { label: 'Interview', count: 4, color: 'bg-orange-200' },
    { label: 'Offer', count: 3, color: 'bg-emerald-200' },
    { label: 'Hired', count: 2, color: 'bg-green-300' },
];

export default function PipelineFlow() {
    const max = Math.max(...stages.map(s => s.count));
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
            </div>
        </div>
    );
}
