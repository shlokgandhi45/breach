import { candidates } from '@/data/candidates';
import { TrendingUp, Users, GitBranch, CalendarCheck } from 'lucide-react';

const stats = [
    { label: 'Total Candidates', value: '47', delta: '+12 this week', icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Active Pipeline', value: '23', delta: '5 moved stages', icon: GitBranch, color: 'text-violet-600 bg-violet-50' },
    { label: 'Interviews Scheduled', value: '8', delta: '3 this week', icon: CalendarCheck, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Offer Accept Rate', value: '84%', delta: '+6% vs last month', icon: TrendingUp, color: 'text-orange-600 bg-orange-50' },
];

export default function StatCards() {
    return (
        <div className="grid grid-cols-4 gap-4 mb-5">
            {stats.map(({ label, value, delta, icon: Icon, color }) => (
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
