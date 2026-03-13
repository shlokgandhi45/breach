import Avatar from '@/components/ui/Avatar';
import MatchScore from '@/components/ui/MatchScore';
import StatusBadge from '@/components/ui/StatusBadge';
import Link from 'next/link';

export default function KanbanCard({ candidate, onDragStart, onDragEnd }) {
    return (
        <div
            draggable
            onDragStart={e => onDragStart(e, candidate)}
            onDragEnd={onDragEnd}
            className="bg-white border border-[#E5E7EB] rounded-[10px] p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow"
        >
            <div className="flex items-center gap-2 mb-2">
                <Avatar initials={candidate.initials} color={candidate.color} size="sm" />
                <div className="flex-1 min-w-0">
                    <Link href={`/candidate-profile?id=${candidate.id}`}>
                        <p className="text-[12.5px] font-semibold text-[#111827] truncate hover:text-primary transition-colors">{candidate.name}</p>
                    </Link>
                    <p className="text-[11px] text-[#9CA3AF] truncate">{candidate.role}</p>
                </div>
            </div>
            <div className="flex items-center justify-between">
                <StatusBadge status={candidate.status} />
                <MatchScore score={candidate.matchScore} />
            </div>
        </div>
    );
}
