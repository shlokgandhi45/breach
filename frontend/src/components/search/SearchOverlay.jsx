'use client';
import { useState, useRef, useEffect } from 'react';
import { X, Search, Sparkles, MapPin, Briefcase, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';
import MatchScore from '@/components/ui/MatchScore';
import SkillTag from '@/components/ui/SkillTag';
import StatusBadge from '@/components/ui/StatusBadge';
import { searchCandidates } from '@/lib/candidateService';

export default function SearchOverlay({ open, onClose }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [totalFound, setTotalFound] = useState(0);
    const inputRef = useRef(null);

    useEffect(() => {
        if (open && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
        if (!open) {
            setResults(null);
            setQuery('');
        }
    }, [open]);

    // Close on Escape
    useEffect(() => {
        function handleKey(e) {
            if (e.key === 'Escape') onClose?.();
        }
        if (open) window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    async function handleSearch(e) {
        e.preventDefault();
        if (!query.trim()) return;
        setLoading(true);
        const data = await searchCandidates(query.trim());
        setResults(data.results);
        setTotalFound(data.total_found);
        setLoading(false);
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="absolute inset-x-0 top-0 max-h-[90vh] flex flex-col bg-white border-b border-[#E5E7EB] shadow-2xl animate-in slide-in-from-top-2 duration-300">
                {/* Search Input */}
                <form onSubmit={handleSearch} className="flex items-center gap-3 px-6 py-4 border-b border-[#F3F4F6]">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Sparkles size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 relative">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 text-[15px] bg-[#F8F9FB] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-[#B0B8C4] font-medium"
                            placeholder="Try: 'Senior React developer in SF with 5+ years' or 'ML engineer with PyTorch'..."
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !query.trim()}
                        className="btn-primary !px-6 !py-3 !text-[13px] rounded-xl disabled:opacity-40 flex items-center gap-2"
                    >
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                        {loading ? 'Searching…' : 'AI Search'}
                    </button>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#6B7280] transition-all flex-shrink-0"
                    >
                        <X size={18} />
                    </button>
                </form>

                {/* Results */}
                <div className="flex-1 overflow-y-auto px-6 py-4" style={{ maxHeight: 'calc(90vh - 80px)' }}>
                    {loading && (
                        <div className="text-center py-16">
                            <div className="inline-block w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-[14px] font-semibold text-[#6B7280]">Running AI search pipeline…</p>
                            <p className="text-[12px] text-[#9CA3AF] mt-1">Query parsing → Metadata filtering → Hybrid search → RAG summaries</p>
                        </div>
                    )}

                    {!loading && results && results.length === 0 && (
                        <div className="text-center py-16">
                            <Search size={40} className="mx-auto text-[#D1D5DB] mb-4" />
                            <p className="text-[15px] font-semibold text-[#6B7280]">No candidates found</p>
                            <p className="text-[13px] text-[#9CA3AF] mt-1">Try a different query or broader search terms</p>
                        </div>
                    )}

                    {!loading && results && results.length > 0 && (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Sparkles size={14} className="text-primary" />
                                    <p className="text-[13px] font-semibold text-[#111827]">
                                        {totalFound} candidates found
                                    </p>
                                </div>
                                <p className="text-[11px] text-[#9CA3AF]">Ranked by AI relevance score</p>
                            </div>
                            <div className="space-y-3">
                                {results.map((c, i) => (
                                    <Link
                                        key={c.id}
                                        href={`/candidate-profile?id=${c.id}`}
                                        onClick={onClose}
                                    >
                                        <div className="group bg-white border border-[#E5E7EB] rounded-2xl p-5 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all cursor-pointer">
                                            <div className="flex items-start gap-4">
                                                {/* Rank badge */}
                                                <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-[12px] font-mono font-bold text-[#6B7280] flex-shrink-0 mt-0.5">
                                                    {i + 1}
                                                </div>

                                                {/* Avatar */}
                                                <Avatar initials={c.initials} color={c.color} size="md" />

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div>
                                                            <h3 className="text-[15px] font-bold text-[#111827] group-hover:text-primary transition-colors">{c.name}</h3>
                                                            <p className="text-[13px] font-medium text-[#6B7280]">{c.role} · {c.currentCompany}</p>
                                                        </div>
                                                        <MatchScore score={c.matchScore} size="md" />
                                                    </div>

                                                    <div className="flex items-center gap-4 mt-2 text-[12px] text-[#9CA3AF]">
                                                        <span className="flex items-center gap-1"><MapPin size={12} />{c.location}</span>
                                                        <span className="flex items-center gap-1"><Briefcase size={12} />{c.experienceYears || 0} yrs exp</span>
                                                        <StatusBadge status={c.status} />
                                                    </div>

                                                    {c.summary && (
                                                        <p className="mt-3 text-[13px] text-[#4B5563] leading-relaxed line-clamp-2 bg-[#F8F9FB] rounded-lg p-3 border border-[#F3F4F6]">
                                                            {c.summary}
                                                        </p>
                                                    )}

                                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                                        {(c.skills || []).slice(0, 5).map(s => <SkillTag key={s} skill={s} />)}
                                                        {(c.skills || []).length > 5 && (
                                                            <span className="text-[11px] text-[#9CA3AF] font-medium px-2 py-0.5">+{c.skills.length - 5} more</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </>
                    )}

                    {!results && !loading && (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                <Sparkles size={28} className="text-primary" />
                            </div>
                            <h3 className="text-[16px] font-bold text-[#111827] mb-2">AI-Powered Candidate Search</h3>
                            <p className="text-[13px] text-[#6B7280] max-w-[400px] mx-auto leading-relaxed">
                                Describe what you're looking for in natural language. Our 6-step AI pipeline will parse your query,
                                filter by metadata, run hybrid search, and generate grounded RAG summaries.
                            </p>
                            <div className="flex flex-wrap gap-2 justify-center mt-6">
                                {['Senior React dev in SF', 'Backend engineer, AWS + startup', 'ML engineer, PyTorch, 3+ yrs'].map(eg => (
                                    <button
                                        key={eg}
                                        onClick={() => setQuery(eg)}
                                        className="px-4 py-2 text-[12px] font-medium bg-[#F3F4F6] text-[#6B7280] rounded-lg hover:bg-primary/10 hover:text-primary transition-all"
                                    >
                                        "{eg}"
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
