import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';
import MatchScore from '@/components/ui/MatchScore';
import StatusBadge from '@/components/ui/StatusBadge';
import SkillTag from '@/components/ui/SkillTag';

export default function CandidateCard({ candidate }) {
    return (
        <Link href={`/candidate-profile?id=${candidate.id}`}>
            <div className="section-card p-4 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                    <Avatar initials={candidate.initials} color={candidate.color} size="md" />
                    <MatchScore score={candidate.matchScore} />
                </div>
                <p className="text-[14px] font-bold text-[#111827]">{candidate.name}</p>
                <p className="text-[12px] text-[#6B7280] mt-0.5">{candidate.role}</p>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">{candidate.currentCompany} · {candidate.location}</p>
                <div className="flex flex-wrap gap-1 mt-3">
                    {candidate.skills.slice(0, 3).map(s => <SkillTag key={s} skill={s} />)}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F3F4F6]">
                    <StatusBadge status={candidate.status} />
                    <span className="text-[11px] text-[#9CA3AF]">{candidate.lastActivity}</span>
                </div>
            </div>
        </Link>
    );
}
