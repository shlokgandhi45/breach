import KanbanCard from './KanbanCard';

const stageColors = {
    Applied: 'border-t-gray-300',
    Screening: 'border-t-blue-400',
    Technical: 'border-t-violet-400',
    Interview: 'border-t-orange-400',
    Offer: 'border-t-emerald-400',
    Hired: 'border-t-green-500',
};

export default function KanbanColumn({ stage, candidates, onDragStart, onDragEnd, onDragOver, onDrop }) {
    return (
        <div
            className={`flex-shrink-0 w-56 bg-[#F8F9FB] rounded-[12px] border-t-4 ${stageColors[stage] || 'border-t-gray-300'} overflow-hidden`}
            onDragOver={onDragOver}
            onDrop={e => onDrop(e, stage)}
        >
            <div className="flex items-center justify-between px-3 py-2.5">
                <p className="text-[12px] font-bold text-[#374151]">{stage}</p>
                <span className="text-[10px] font-bold bg-white border border-[#E5E7EB] text-[#6B7280] px-1.5 py-0.5 rounded-full">
                    {candidates.length}
                </span>
            </div>
            <div className="px-2 pb-3 space-y-2 min-h-[200px]">
                {candidates.map(c => (
                    <KanbanCard
                        key={c.id}
                        candidate={c}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                    />
                ))}
                {candidates.length === 0 && (
                    <div className="flex items-center justify-center h-24 text-[11px] text-[#D1D5DB] font-medium border-2 border-dashed border-[#E5E7EB] rounded-[8px]">
                        Drop here
                    </div>
                )}
            </div>
        </div>
    );
}
