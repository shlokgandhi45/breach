'use client';
import { useState, useEffect } from 'react';
import { TrendingUp, Users, GitBranch, CalendarCheck } from 'lucide-react';
import { fetchDashboardStats } from '@/lib/candidateService';

export default function StatCards() {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            const data = await fetchDashboardStats();
            if (!cancelled) setStats(data);
        }
        load();
        return () => { cancelled = true; };
    }, []);

    const pipelineActive = stats
        ? Object.entries(stats.pipeline_counts)
            .filter(([stage]) => !['Applied', 'Hired'].includes(stage))
            .reduce((sum, [, count]) => sum + count, 0)
        : 0;

    const interviewCount = stats
        ? (stats.pipeline_counts['Interview'] || 0) + (stats.pipeline_counts['Technical'] || 0)
        : 0;

    const cards = [
        {
            label: 'Total Candidates',
            value: stats ? String(stats.total_candidates) : '—',
            delta: 'From all sources',
            icon: Users,
            color: 'text-blue-600 bg-blue-50',
        },
        {
            label: 'Active Pipeline',
            value: stats ? String(pipelineActive) : '—',
            delta: 'In screening to offer',
            icon: GitBranch,
            color: 'text-violet-600 bg-violet-50',
        },
        {
            label: 'Interviews Scheduled',
            value: stats ? String(interviewCount) : '—',
            delta: 'Technical + Interview',
            icon: CalendarCheck,
            color: 'text-emerald-600 bg-emerald-50',
        },
        {
            label: 'Offer Accept Rate',
            value: '84%',
            delta: '+6% vs last month',
            icon: TrendingUp,
            color: 'text-orange-600 bg-orange-50',
        },
    ];

    return (
        <div className="grid grid-cols-4 gap-4 mb-5">
            {cards.map(({ label, value, delta, icon: Icon, color }) => (
                <div key={label} className="section-card p-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[12px] font-medium text-[#6B7280]">{label}</p>
                        <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center ${color}`}>
                            <Icon size={15} />
                        </div>
                    </div>
                    <p className="text-[26px] font-bold text-[#111827] font-mono tracking-tight">{value}</p>
                    <p className="text-[11px] text-emerald-600 font-medium mt-1">{delta}</p>
                </div>
            ))}
        </div>
    );
}
