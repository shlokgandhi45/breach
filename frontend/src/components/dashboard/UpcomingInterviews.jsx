import { Calendar, Clock } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { candidates } from '@/data/candidates';

const times = ['10:00 AM', '1:30 PM', '3:00 PM'];

export default function UpcomingInterviews() {
    const interviewers = candidates.filter(c => ['Interview', 'Technical'].includes(c.status)).slice(0, 3);
    return (
        <div className="section-card p-5">
            <div className="flex items-center gap-2 mb-4">
                <Calendar size={14} className="text-primary" />
                <h2 className="text-[13px] font-semibold text-[#111827]">Upcoming Interviews</h2>
            </div>
            <div className="space-y-3">
                {interviewers.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-[8px] bg-[#F8F9FB]">
                        <Avatar initials={c.initials} color={c.color} size="sm" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-[#111827] truncate">{c.name}</p>
                            <p className="text-[11px] text-[#6B7280] truncate">{c.role}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[11px] font-semibold text-[#374151]">Today</p>
                            <p className="text-[10px] text-[#9CA3AF] flex items-center gap-0.5 justify-end">
                                <Clock size={9} />{times[i]}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
