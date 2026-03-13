'use client';
import { Search, Filter } from 'lucide-react';

export default function FilterBar({ search, setSearch, statusFilter, setStatusFilter }) {
    const statuses = ['All', 'Applied', 'Screening', 'Technical', 'Interview', 'Offer', 'Hired'];
    return (
        <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                    className="input-field pl-8"
                    placeholder="Search candidates…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
            <div className="flex items-center gap-1.5">
                {statuses.map(s => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`text-[11.5px] font-medium px-3 py-1.5 rounded-full border transition-all ${statusFilter === s
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:border-primary hover:text-primary'
                            }`}
                    >
                        {s}
                    </button>
                ))}
            </div>
        </div>
    );
}
