'use client';
import { useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import CandidateRow from '@/components/candidates/CandidateRow';
import CandidateCard from '@/components/candidates/CandidateCard';
import FilterBar from '@/components/candidates/FilterBar';
import { candidates } from '@/data/candidates';
import { List, LayoutGrid } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

export default function CandidatesPage() {
    const searchParams = useSearchParams();
    const sourceParam = searchParams.get('source');

    const [view, setView] = useState('list');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    const filtered = candidates.filter(c => {
        const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.role.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'All' || c.status === statusFilter;
        const matchSource = !sourceParam || c.source === sourceParam;
        return matchSearch && matchStatus && matchSource;
    });

    return (
        <AppShell title="Candidates" subtitle={`${filtered.length} candidates`}>
            <div className="flex items-center justify-between mb-4">
                <FilterBar
                    search={search} setSearch={setSearch}
                    statusFilter={statusFilter} setStatusFilter={setStatusFilter}
                />
                <div className="flex items-center gap-1 border border-[#E5E7EB] rounded-[8px] p-0.5 bg-white ml-3 flex-shrink-0">
                    <button
                        onClick={() => setView('list')}
                        className={`p-1.5 rounded-[6px] transition-colors ${view === 'list' ? 'bg-[#F3F4F6] text-[#111827]' : 'text-[#9CA3AF]'}`}
                    >
                        <List size={15} />
                    </button>
                    <button
                        onClick={() => setView('grid')}
                        className={`p-1.5 rounded-[6px] transition-colors ${view === 'grid' ? 'bg-[#F3F4F6] text-[#111827]' : 'text-[#9CA3AF]'}`}
                    >
                        <LayoutGrid size={15} />
                    </button>
                </div>
            </div>

            {view === 'list' ? (
                <div className="section-card overflow-hidden">
                    <div className="flex items-center gap-4 px-4 py-2 border-b border-[#F3F4F6] bg-[#F8F9FB]">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] flex-1">Candidate</p>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] hidden md:block w-32">Location</p>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] w-20">Status</p>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] hidden lg:block w-24 text-right">Applied</p>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] w-10 text-center">Match</p>
                    </div>
                    {filtered.map(c => <CandidateRow key={c.id} candidate={c} />)}
                    {filtered.length === 0 && (
                        <p className="text-center text-[13px] text-[#9CA3AF] py-12">No candidates found.</p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map(c => <CandidateCard key={c.id} candidate={c} />)}
                </div>
            )}
        </AppShell>
    );
}
