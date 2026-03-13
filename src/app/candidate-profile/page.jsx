'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    MapPin, Briefcase, Mail, ChevronLeft, Sparkles,
    GitCompare, PlusCircle, Calendar, ExternalLink,
    Clock, FileText, Star, GraduationCap, DollarSign,
    History
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import Avatar from '@/components/ui/Avatar';
import MatchScore from '@/components/ui/MatchScore';
import StatusBadge from '@/components/ui/StatusBadge';
import SkillTag from '@/components/ui/SkillTag';
import { candidates } from '@/data/candidates';
import { getSourceIcon } from '@/lib/utils';

const tabs = [
    { id: 'Overview', icon: FileText },
    { id: 'Experience', icon: History },
    { id: 'Skills', icon: Sparkles },
    { id: 'Resume', icon: FileText },
    { id: 'Activity', icon: Clock },
];

function timelineIcon(type) {
    if (type === 'apply') return <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><PlusCircle size={13} /></div>;
    if (type === 'review') return <div className="w-7 h-7 rounded-full bg-violet-50 flex items-center justify-center text-violet-600"><Star size={13} /></div>;
    if (type === 'stage') return <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600"><GitCompare size={13} /></div>;
    return <div className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center text-orange-600"><Mail size={13} /></div>;
}

function ProfileContent() {
    const params = useSearchParams();
    const id = parseInt(params.get('id') || '1');
    const candidate = candidates.find(c => c.id === id) || candidates[0];
    const [activeTab, setActiveTab] = useState('Overview');
    const [note, setNote] = useState('');

    return (
        <AppShell title="Candidate Profile" subtitle={candidate.name}>
            <div className="max-w-[960px] mx-auto px-4 pb-12">
                <Link href="/candidates" className="inline-flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-[#111827] mb-6 transition-colors group">
                    <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />Back to Candidates
                </Link>

                {/* Main Profile Card */}
                <div className="bg-white border border-[#E5E7EB] rounded-[24px] shadow-sm overflow-hidden mb-6">
                    {/* Header Section */}
                    <div className="p-8 border-b border-[#F3F4F6] bg-[#F8F9FB]/50">
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                            <div className="relative">
                                <Avatar initials={candidate.initials} color={candidate.color} size="xl" className="w-[100px] h-[100px] text-[32px] rounded-[28px] shadow-sm border-4 border-white" />
                                <div className="absolute -bottom-2 -right-2 transform scale-110">
                                    <MatchScore score={candidate.matchScore} size="sm" className="shadow-md bg-white rounded-full p-0.5" />
                                </div>
                            </div>

                            <div className="flex-1 text-center md:text-left">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h1 className="text-[28px] font-bold text-[#111827] tracking-tight mb-1">{candidate.name}</h1>
                                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-1.5 text-[14px] text-[#6B7280]">
                                            <span className="font-medium text-[#374151]">{candidate.role}</span>
                                            <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
                                            <span>{candidate.currentCompany}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-center gap-2">
                                        <StatusBadge status={candidate.status} className="!px-3 !py-1" />
                                        <div className="h-8 w-px bg-[#E5E7EB] mx-1 hidden md:block" />
                                        <button className="p-2 text-[#9CA3AF] hover:text-[#111827] hover:bg-white hover:shadow-sm rounded-lg transition-all border border-transparent hover:border-[#E5E7EB]">
                                            <ExternalLink size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-5 mt-5 text-[12.5px] text-[#6B7280]">
                                    <span className="flex items-center gap-1.5"><MapPin size={14} className="text-[#9CA3AF]" />{candidate.location}</span>
                                    <span className="flex items-center gap-1.5"><Briefcase size={14} className="text-[#9CA3AF]" />{candidate.experienceYears} years exp.</span>
                                    <span className="flex items-center gap-1.5"><Mail size={14} className="text-[#9CA3AF]" />{candidate.email}</span>
                                    <span className="flex items-center gap-1.5">{getSourceIcon(candidate.source)} {candidate.source}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 mt-8">
                            <Link href="/compare"><button className="btn-secondary !text-[13px] px-5 py-2.5 rounded-xl border-[#E5E7EB] hover:bg-white shadow-sm transition-all">Compare</button></Link>
                            <button className="btn-primary !text-[13px] px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">Schedule Interview</button>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="px-8 bg-white border-b border-[#F3F4F6]">
                        <div className="flex items-center gap-8 overflow-x-auto no-scrollbar">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-1 py-5 text-[13.5px] font-semibold border-b-2 transition-all duration-200 whitespace-nowrap ${activeTab === tab.id
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-[#9CA3AF] hover:text-[#6B7280]'
                                        }`}
                                >
                                    <tab.icon size={15} />
                                    {tab.id}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="p-8 min-h-[500px]">
                        {activeTab === 'Overview' && (
                            <div className="space-y-8 animate-in fade-in duration-500">
                                <section>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-primary">
                                            <Sparkles size={16} />
                                        </div>
                                        <h3 className="text-[15px] font-bold text-[#111827]">AI Analysis Summary</h3>
                                    </div>
                                    <div className="bg-[#F8F9FB] rounded-[16px] p-5 border border-[#F3F4F6]">
                                        <p className="text-[14px] text-[#4B5563] leading-[1.6] font-medium">
                                            {candidate.summary}
                                        </p>
                                    </div>
                                </section>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                                    <section>
                                        <h3 className="text-[13px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-4">Detailed Profile</h3>
                                        <div className="space-y-4">
                                            {[
                                                { label: 'Academic Background', value: candidate.education, icon: GraduationCap },
                                                { label: 'Salary Expectation', value: candidate.salary, icon: DollarSign },
                                                { label: 'Notice Period', value: candidate.noticePeriod, icon: Clock },
                                                { label: 'Application Date', value: candidate.appliedDate, icon: FileText },
                                            ].map((item) => (
                                                <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl border border-[#F3F4F6] hover:border-[#E5E7EB] transition-colors">
                                                    <item.icon size={16} className="text-[#9CA3AF]" />
                                                    <div>
                                                        <p className="text-[11px] font-semibold text-[#9CA3AF] tracking-wide">{item.label}</p>
                                                        <p className="text-[13px] font-bold text-[#374151] mt-0.5">{item.value}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section>
                                        <h3 className="text-[13px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-4">Core Skills</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {candidate.skills.map(skill => (
                                                <span key={skill} className="px-4 py-2 bg-white border border-[#E5E7EB] text-[#374151] rounded-xl text-[13px] font-semibold hover:border-primary/30 hover:bg-blue-50/30 transition-all cursor-default">
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>

                                        <h3 className="text-[13px] font-bold uppercase tracking-widest text-[#9CA3AF] mt-8 mb-4">Recruiter Notes</h3>
                                        <textarea
                                            value={note}
                                            onChange={e => setNote(e.target.value)}
                                            placeholder="Add private observations..."
                                            className="w-full bg-[#F8F9FB] border border-[#F3F4F6] rounded-xl p-4 text-[13px] text-[#4B5563] focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none min-h-[120px]"
                                        />
                                        <button className="btn-primary !py-2 !px-4 !text-[12px] mt-2 ml-auto block">Save Private Note</button>
                                    </section>
                                </div>
                            </div>
                        )}

                        {activeTab === 'Experience' && (
                            <div className="animate-in fade-in duration-500">
                                <div className="relative pl-8 space-y-12 py-4">
                                    <div className="absolute left-[11px] top-6 bottom-6 w-[2px] bg-gradient-to-b from-primary via-[#E5E7EB] to-transparent" />
                                    {[candidate.currentCompany, ...candidate.previousCompanies].map((co, i) => (
                                        <div key={co} className="relative group">
                                            <div className="absolute -left-[27px] top-1.5 w-4 h-4 rounded-full border-4 border-white bg-primary shadow-sm group-hover:scale-125 transition-transform" />
                                            <div>
                                                <span className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1 block">
                                                    {i === 0 ? 'Present · Since 2021' : `${2021 - i * 2} – ${2023 - i * 2}`}
                                                </span>
                                                <h4 className="text-[17px] font-bold text-[#111827]">{candidate.role}</h4>
                                                <div className="flex items-center gap-2 mt-1 mb-4">
                                                    <span className="text-[14px] font-semibold text-primary">{co}</span>
                                                    <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
                                                    <span className="text-[13px] text-[#6B7280]">Full-time</span>
                                                </div>
                                                <div className="bg-[#F8F9FB] rounded-[16px] p-5 border border-[#F3F4F6]">
                                                    <p className="text-[13.5px] text-[#4B5563] leading-relaxed">
                                                        Spearheaded high-impact engineering initiatives and successfully delivered scalable solutions at {co}.
                                                        Owned the complete product development lifecycle from architecting the system to deployment and performance optimization.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'Skills' && (
                            <div className="space-y-6 animate-in fade-in duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                    {candidate.skills.map((skill, i) => {
                                        const pct = 95 - i * 8;
                                        return (
                                            <div key={skill} className="group">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[14px] font-bold text-[#374151] group-hover:text-primary transition-colors">{skill}</span>
                                                    <span className="text-[12px] font-mono font-bold text-primary">{pct}%</span>
                                                </div>
                                                <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden p-0.5">
                                                    <div
                                                        className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {activeTab === 'Resume' && (
                            <div className="animate-in fade-in duration-500">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-[15px] font-bold text-[#111827]">Curriculum Vitae</h3>
                                        <p className="text-[12px] text-[#9CA3AF] mt-0.5">Uploaded on {candidate.appliedDate}</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button className="btn-secondary !text-[12px] gap-2 px-4"><ExternalLink size={14} />View Full</button>
                                        <button className="btn-primary !text-[12px] gap-2 px-4 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:border-primary/40 shadow-none"><FileText size={14} />Download PDF</button>
                                    </div>
                                </div>
                                <div className="aspect-[1/1.4] border-2 border-dashed border-[#E5E7EB] rounded-[24px] bg-[#F8F9FB] flex flex-col items-center justify-center p-12 text-center group hover:border-primary/30 transition-all">
                                    <div className="w-20 h-20 rounded-[28px] bg-white shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                        <FileText size={40} className="text-[#D1D5DB] group-hover:text-primary transition-colors" />
                                    </div>
                                    <h4 className="text-[16px] font-bold text-[#4B5563] mb-2">{candidate.name}_Resume_v2.pdf</h4>
                                    <p className="max-w-[300px] text-[13px] text-[#9CA3AF] leading-relaxed">
                                        Interactive PDF viewer placeholder. In a production environment, the resume would be rendered here using PDF.js.
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'Activity' && (
                            <div className="animate-in fade-in duration-500">
                                <div className="space-y-6">
                                    {candidate.timeline.map((event, i) => (
                                        <div key={i} className="flex items-start gap-4 p-4 rounded-2xl hover:bg-[#F8F9FB] transition-colors group">
                                            {timelineIcon(event.type)}
                                            <div className="flex-1 pt-1">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[14px] font-bold text-[#374151]">{event.event}</p>
                                                    <span className="text-[11px] font-mono text-[#9CA3AF]">{event.date}</span>
                                                </div>
                                                <p className="text-[12px] text-[#6B7280] mt-1">Processed by Recruiting System Auto-log</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Quick Actions */}
                <div className="flex items-center justify-between px-6">
                    <p className="text-[12px] text-[#9CA3AF] italic">Automatically parsed by BREACH Engine v2.4</p>
                    <button className="text-[13px] font-bold text-red-500 hover:text-red-600 transition-colors">Reject Candidate</button>
                </div>
            </div>
        </AppShell>
    );
}

export default function CandidateProfilePage() {
    return (
        <Suspense fallback={<div className="p-10 text-[#9CA3AF] text-center font-medium">Processing Profile...</div>}>
            <ProfileContent />
        </Suspense>
    );
}
