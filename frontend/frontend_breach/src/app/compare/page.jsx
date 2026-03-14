'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Avatar from '@/components/ui/Avatar';
import MatchScore from '@/components/ui/MatchScore';
import StatusBadge from '@/components/ui/StatusBadge';
import SkillTag from '@/components/ui/SkillTag';
import { Plus, X, Sparkles } from 'lucide-react';
import { fetchCandidates } from '@/lib/candidateService';

export default function ComparePage() {
    const [allCandidates, setAllCandidates] = useState([]);
    const [selected, setSelected] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            const data = await fetchCandidates();
            if (!cancelled) {
                setAllCandidates(data);
                setSelected([data[0], data[1]].filter(Boolean));
                setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, []);

    const fields = [
        { label: 'Current Company', key: 'currentCompany' },
        { label: 'Experience', key: c => `${c.experienceYears || 0} years` },
        { label: 'Location', key: 'location' },
        { label: 'Education', key: 'education' },
        { label: 'Expected Salary', key: 'salary' },
        { label: 'Notice Period', key: 'noticePeriod' },
        { label: 'Source', key: 'source' },
        { label: 'Applied', key: 'appliedDate' },
    ];

    const getValue = (c, key) => {
        const val = typeof key === 'function' ? key(c) : c[key];
        return val || '—';
    };

    if (loading) {
        return (
            <AppShell title="Compare" subtitle="Loading…">
                <div className="section-card p-12 text-center">
                    <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-[13px] text-[#9CA3AF]">Loading candidates…</p>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell title="Compare" subtitle="Side-by-side candidate comparison">
            {/* Candidate selectors */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[0, 1, 2].map(i => {
                    const c = selected[i];
                    return (
                        <div key={i} className="section-card p-4">
                            {c ? (
                                <div className="flex items-center gap-3">
                                    <Avatar initials={c.initials} color={c.color} size="md" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-semibold text-[#111827] truncate">{c.name}</p>
                                        <p className="text-[11px] text-[#6B7280] truncate">{c.role}</p>
                                    </div>
                                    <MatchScore score={c.matchScore} />
                                    <button onClick={() => setSelected(p => p.filter((_, idx) => idx !== i))} className="text-[#D1D5DB] hover:text-red-400 transition-colors">
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-[12px] text-[#9CA3AF]">
                                    <Plus size={14} />
                                    <select
                                        className="input-field !py-1 !text-[12px]"
                                        onChange={e => {
                                            const cid = e.target.value;
                                            const candidate = allCandidates.find(c => String(c.id) === String(cid));
                                            if (candidate) setSelected(p => { const n = [...p]; n[i] = candidate; return n; });
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>+ Add candidate</option>
                                        {allCandidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Comparison table */}
            <div className="section-card overflow-hidden">
                <div className="grid" style={{ gridTemplateColumns: `160px repeat(${selected.length}, 1fr)` }}>
                    {/* Header row */}
                    <div className="bg-[#F8F9FB] px-4 py-3 border-b border-[#E5E7EB] text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Field</div>
                    {selected.map(c => (
                        <div key={c.id} className="bg-[#F8F9FB] px-4 py-3 border-b border-[#E5E7EB] border-l border-l-[#F3F4F6]">
                            <p className="text-[13px] font-semibold text-[#111827]">{c.name}</p>
                            <StatusBadge status={c.status} />
                        </div>
                    ))}

                    {/* Field rows */}
                    {fields.map(({ label, key }) => (
                        <div key={label} className="contents">
                            <div className="px-4 py-3 border-b border-[#F3F4F6] text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider bg-[#FAFAFA]">{label}</div>
                            {selected.map(c => (
                                <div key={c.id} className="px-4 py-3 border-b border-[#F3F4F6] border-l border-l-[#F3F4F6] text-[13px] text-[#374151]">
                                    {getValue(c, key)}
                                </div>
                            ))}
                        </div>
                    ))}

                    {/* Skills row */}
                    <div className="px-4 py-3 border-b border-[#F3F4F6] text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider bg-[#FAFAFA]">Top Skills</div>
                    {selected.map(c => (
                        <div key={c.id} className="px-4 py-3 border-b border-[#F3F4F6] border-l border-l-[#F3F4F6]">
                            <div className="flex flex-wrap gap-1">
                                {(c.skills || []).slice(0, 3).map(s => <SkillTag key={s} skill={s} />)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Best Match Highlight */}
            {selected.length > 0 && (() => {
                const best = [...selected].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))[0];
                return (
                    <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex items-center gap-2 mb-4 ml-1">
                            <Sparkles size={16} className="text-primary" />
                            <h3 className="text-[15px] font-bold text-[#111827]">AI Recommendation: Best Possible Match</h3>
                        </div>

                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-violet-200/20 to-primary/20 rounded-[28px] blur-sm opacity-50 group-hover:opacity-100 transition duration-1000"></div>

                            <div className="relative section-card !bg-white/80 backdrop-blur-md p-8 border-primary/20 shadow-lg shadow-primary/5">
                                <div className="flex flex-col md:flex-row items-center gap-8">
                                    <div className="relative">
                                        <Avatar initials={best.initials} color={best.color} size="xl" className="w-24 h-24 text-[28px] rounded-[24px]" />
                                        <div className="absolute -top-2 -right-2 transform translate-x-1 translate-y-1">
                                            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white shadow-lg border-2 border-white">
                                                <Sparkles size={16} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 text-center md:text-left">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div>
                                                <h2 className="text-[24px] font-bold text-[#111827] mb-1">{best.name}</h2>
                                                <p className="text-[15px] font-medium text-[#6B7280]">{best.role} <span className="text-[#D1D5DB] mx-1">·</span> {best.currentCompany}</p>
                                            </div>
                                            <div className="flex flex-col items-center md:items-end">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-[32px] font-bold text-primary leading-none font-mono">{best.matchScore}</span>
                                                    <span className="text-[14px] font-bold text-primary uppercase">Score</span>
                                                </div>
                                                <p className="text-[11px] font-medium text-[#9CA3AF] mt-1">Based on skills & experience</p>
                                            </div>
                                        </div>

                                        <div className="mt-6 flex flex-wrap gap-2 justify-center md:justify-start">
                                            {(best.skills || []).map(s => <SkillTag key={s} skill={s} variant="blue" />)}
                                        </div>

                                        <p className="mt-6 text-[14px] text-[#4B5563] leading-relaxed max-w-[600px] font-medium">
                                            {best.name} is the strongest candidate in this comparison due to their high technical proficiency in <span className="text-primary">{(best.skills || [])[0] || 'their domain'}</span> and direct industry experience at <span className="text-primary">{best.currentCompany || 'their company'}</span>. They align most closely with the core requirements of this role.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-8 pt-8 border-t border-[#F3F4F6] flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <Link href={`/candidate-profile?id=${best.id}`}><button className="btn-secondary !text-[13px] !px-6">View Full Profile</button></Link>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button className="btn-secondary text-[13px] border-red-100 text-red-500 hover:bg-red-50">Archive</button>
                                        <button className="btn-primary text-[13px] shadow-md shadow-primary/20 !px-8">Finalize Selection</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </AppShell>
    );
}
