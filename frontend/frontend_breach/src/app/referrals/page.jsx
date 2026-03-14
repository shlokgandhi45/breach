'use client';
import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import Link from 'next/link';
import { Mail, Users, Database, FileText, ChevronRight, Upload } from 'lucide-react';
import { fetchCandidates } from '@/lib/candidateService';
import ResumeUploadModal from '@/components/upload/ResumeUploadModal';

const sourcingChannels = [
    {
        title: 'Email applicants',
        description: 'Candidates who applied via direct email or attachments.',
        icon: Mail,
        source: 'Email',
        color: 'bg-blue-50 text-blue-600',
        hover: 'hover:bg-blue-100',
    },
    {
        title: 'Referrals',
        description: 'Internal employee referrals and personal recommendations.',
        icon: Users,
        source: 'Referral',
        color: 'bg-emerald-50 text-emerald-600',
        hover: 'hover:bg-emerald-100',
    },
    {
        title: 'HRMS Applicants',
        description: 'Applicants synced from your HR management system.',
        icon: Database,
        source: 'HRMS',
        color: 'bg-violet-50 text-violet-600',
        hover: 'hover:bg-violet-100',
    },
    {
        title: 'Resume Uploaded candidates',
        description: 'Bulk resume uploads and manual entry files.',
        icon: FileText,
        source: 'Upload',
        color: 'bg-orange-50 text-orange-600',
        hover: 'hover:bg-orange-100',
    },
];

export default function SourcingHubPage() {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadOpen, setUploadOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            const data = await fetchCandidates();
            if (!cancelled) {
                setCandidates(data);
                setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, []);

    return (
        <>
        <AppShell title="Sourcing Hub" subtitle="Manage candidates across all incoming channels">
            <div className="flex items-center justify-between mb-4">
                <div />
                <button onClick={() => setUploadOpen(true)} className="btn-primary !text-[13px] flex items-center gap-2">
                    <Upload size={14} />Upload Resumes
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sourcingChannels.map((channel) => {
                    const Icon = channel.icon;
                    const count = loading ? '—' : candidates.filter(c => c.source === channel.source).length;

                    return (
                        <Link
                            key={channel.title}
                            href={`/candidates?source=${channel.source}`}
                            className={`section-card p-8 flex flex-col transition-all duration-300 group ${channel.hover}`}
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${channel.color}`}>
                                    <Icon size={28} />
                                </div>
                                <div className="text-right">
                                    <span className="text-[32px] font-bold text-[#111827] font-mono leading-none">{count}</span>
                                    <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mt-1">Total</p>
                                </div>
                            </div>

                            <div className="flex-1">
                                <h2 className="text-[18px] font-bold text-[#111827] mb-2 group-hover:text-primary transition-colors">
                                    {channel.title}
                                </h2>
                                <p className="text-[14px] text-[#6B7280] leading-relaxed max-w-[280px]">
                                    {channel.description}
                                </p>
                            </div>

                            <div className="mt-8 pt-6 border-t border-[#F3F4F6] flex items-center justify-between group">
                                <span className="text-[13px] font-semibold text-primary">View Applicants</span>
                                <div className="w-8 h-8 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#9CA3AF] group-hover:text-primary group-hover:border-primary transition-all">
                                    <ChevronRight size={16} />
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </AppShell>
        <ResumeUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
        </>
    );
}
