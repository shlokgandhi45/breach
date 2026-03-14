import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';
import MatchScore from '@/components/ui/MatchScore';
import StatusBadge from '@/components/ui/StatusBadge';

export default function CandidateRow({ candidate }) {
    return (
        <Link href={`/candidate-profile?id=${candidate.id}`}>
            <div className="flex items-center gap-4 px-4 py-3 border-b border-[#F3F4F6] hover:bg-[#F8F9FB] transition-colors cursor-pointer last:border-0">
                <Avatar initials={candidate.initials} color={candidate.color} size="sm" />
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#111827] truncate">{candidate.name}</p>
                    <p className="text-[12px] text-[#6B7280] truncate">{candidate.role} · {candidate.currentCompany}</p>
                </div>
                <div className="text-[12px] text-[#6B7280] hidden md:block w-32 truncate">{candidate.location}</div>
                <div className="w-20"><StatusBadge status={candidate.status} /></div>
                <div className="hidden lg:block text-[11px] text-[#6B7280] w-24 text-right">{candidate.appliedDate}</div>
                <MatchScore score={candidate.matchScore} />
            </div>
        </Link>
    );
}
