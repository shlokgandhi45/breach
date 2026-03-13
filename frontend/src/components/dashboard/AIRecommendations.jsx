import { Sparkles } from 'lucide-react';
import { candidates } from '@/data/candidates';
import Avatar from '@/components/ui/Avatar';
import MatchScore from '@/components/ui/MatchScore';
import Link from 'next/link';

export default function AIRecommendations() {
    const top = candidates.filter(c => c.matchScore >= 80).slice(0, 4);
    return (
        <div className="section-card p-5">
            <div className="flex items-center gap-2 mb-4">
                <Sparkles size={14} className="text-primary" />
                <h2 className="text-[13px] font-semibold text-[#111827]">AI Recommendations</h2>
            </div>
            <div className="space-y-3">
                {top.map(c => (
                    <Link href={`/candidate-profile?id=${c.id}`} key={c.id}>
                        <div className="flex items-center gap-3 p-3 rounded-[8px] hover:bg-[#F8F9FB] transition-colors cursor-pointer">
                            <Avatar initials={c.initials} color={c.color} size="sm" />
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-[#111827] truncate">{c.name}</p>
                                <p className="text-[11px] text-[#6B7280] truncate">{c.role}</p>
                            </div>
                            <MatchScore score={c.matchScore} />
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
