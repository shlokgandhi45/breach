'use client';
import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import MatchScore from '@/components/ui/MatchScore';
import Link from 'next/link';
import { fetchDashboardStats } from '@/lib/candidateService';

export default function AIRecommendations() {
    const [top, setTop] = useState([]);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            const data = await fetchDashboardStats();
            if (!cancelled) setTop(data.top_candidates || []);
        }
        load();
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="section-card p-5">
            <div className="flex items-center gap-2 mb-4">
                <Sparkles size={14} className="text-primary" />
                <h2 className="text-[13px] font-semibold text-[#111827]">AI Recommendations</h2>
            </div>
            <div className="space-y-3">
                {top.length === 0 && (
                    <p className="text-[12px] text-[#9CA3AF] text-center py-4">Loading…</p>
                )}
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
