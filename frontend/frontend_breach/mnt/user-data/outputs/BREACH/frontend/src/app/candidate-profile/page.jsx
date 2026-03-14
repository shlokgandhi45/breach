
'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin, Briefcase, Mail, ChevronLeft, Sparkles,
  GitCompare, PlusCircle, Calendar, ExternalLink,
  Clock, FileText, Star
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import Avatar from '@/components/ui/Avatar';
import MatchScore from '@/components/ui/MatchScore';
import StatusBadge from '@/components/ui/StatusBadge';
import SkillTag from '@/components/ui/SkillTag';
import { candidates } from '@/data/candidates';
import { getSourceIcon } from '@/lib/utils';

const tabs = ['Overview', 'Experience', 'Skills', 'Resume', 'Activity'];

function timelineIcon(type) {
  if (type === 'apply')  return <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><PlusCircle size={13} /></div>;
  if (type === 'review') return <div className="w-7 h-7 rounded-full bg-violet-50 flex items-center justify-center text-violet-600"><Star size={13} /></div>;
  if (type === 'stage')  return <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600"><GitCompare size={13} /></div>;
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
      {/* Back */}
      <Link href="/candidates" className="inline-flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-[#111827] mb-5 transition-colors">
        <ChevronLeft size={14} />Back to Candidates
      </Link>

      {/* Profile Header */}
      <div className="section-card p-6 mb-5">
        <div className="flex items-start gap-5">
          <Avatar initials={candidate.initials} color={candidate.color} size="xl" />
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">{candidate.name}</h1>
                <p className="text-[14px] text-[#6B7280] mt-0.5">{candidate.role} · {candidate.currentCompany}</p>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-[12px] text-[#6B7280]">
                  <span className="flex items-center gap-1"><MapPin size={12} />{candidate.location}</span>
                  <span className="flex items-center gap-1"><Briefcase size={12} />{candidate.experienceYears} years experience</span>
                  <span className="flex items-center gap-1"><Mail size={12} />{candidate.email}</span>
                  <span className="flex items-center gap-1">{getSourceIcon(candidate.source)} {candidate.source}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {candidate.tags.map(t => <SkillTag key={t} skill={t} variant="blue" />)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <MatchScore score={candidate.matchScore} size="md" />
                <StatusBadge status={candidate.status} />
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2 ml-4">
            <Link href="/pipeline">
              <button className="btn-secondary gap-2"><PlusCircle size={14} />Add to Pipeline</button>
            </Link>
            <Link href="/compare">
              <button className="btn-secondary gap-2"><GitCompare size={14} />Compare</button>
            </Link>
            <button className="btn-primary gap-2"><Calendar size={14} />Schedule Interview</button>
          </div>
        </div>
      </div>

      {/* Tabs + Content */}
      <div className="grid grid-cols-[1fr_300px] gap-5">
        <div>
          {/* Tab nav */}
          <div className="flex items-center gap-1 border-b border-[#E5E7EB] mb-5">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all duration-150 -mb-px ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-[#6B7280] hover:text-[#374151]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'Overview' && (
            <div className="space-y-4">
              <div className="section-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={14} className="text-primary" />
                  <h3 className="text-[13px] font-semibold text-[#111827]">AI Summary</h3>
                </div>
                <p className="text-[13px] text-[#374151] leading-relaxed">{candidate.summary}</p>
              </div>
              <div className="section-card p-5">
                <h3 className="text-[13px] font-semibold text-[#111827] mb-3">Key Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Current Company', value: candidate.currentCompany },
                    { label: 'Education',        value: candidate.education },
                    { label: 'Expected Salary',  value: candidate.salary },
                    { label: 'Notice Period',    value: candidate.noticePeriod },
                    { label: 'Applied On',       value: candidate.appliedDate },
                    { label: 'Last Activity',    value: candidate.lastActivity },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-0.5">{label}</p>
                      <p className="text-[13px] font-medium text-[#374151]">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="section-card p-5">
                <h3 className="text-[13px] font-semibold text-[#111827] mb-3">Previous Companies</h3>
                <div className="flex flex-wrap gap-2">
                  {candidate.previousCompanies.map(co => (
                    <span key={co} className="text-[12px] font-medium bg-[#F8F9FB] border border-[#E5E7EB] text-[#374151] px-3 py-1 rounded-full">
                      {co}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Experience Tab */}
          {activeTab === 'Experience' && (
            <div className="section-card p-5">
              <h3 className="text-[13px] font-semibold text-[#111827] mb-5">Experience Timeline</h3>
              <div className="relative pl-6 space-y-6">
                <div className="absolute left-2 top-0 bottom-0 w-px bg-[#E5E7EB]" />
                {[candidate.currentCompany, ...candidate.previousCompanies].map((co, i) => (
                  <div key={co} className="relative">
                    <div className="absolute -left-4 w-3 h-3 rounded-full border-2 border-primary bg-white" />
                    <p className="text-[13px] font-semibold text-[#111827]">{candidate.role}</p>
                    <p className="text-[12px] text-[#6B7280]">{co}</p>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">{i === 0 ? 'Current' : `${2024 - i * 2} – ${2024 - i * 2 + 2}`}</p>
                    <p className="text-[12px] text-[#374151] mt-1.5">Led key engineering initiatives and delivered high-impact projects at scale.</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills Tab */}
          {activeTab === 'Skills' && (
            <div className="section-card p-5">
              <h3 className="text-[13px] font-semibold text-[#111827] mb-4">Skills & Proficiency</h3>
              <div className="space-y-3">
                {candidate.skills.map((skill, i) => {
                  const pct = 95 - i * 8;
                  return (
                    <div key={skill}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[13px] font-medium text-[#374151]">{skill}</span>
                        <span className="text-[11px] font-mono text-[#6B7280]">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resume Tab */}
          {activeTab === 'Resume' && (
            <div className="section-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13px] font-semibold text-[#111827]">Resume</h3>
                <button className="btn-secondary gap-1.5 !text-xs"><ExternalLink size={12} />Download</button>
              </div>
              <div className="border border-[#E5E7EB] rounded-[10px] bg-[#F8F9FB] min-h-[480px] flex items-center justify-center">
                <div className="text-center">
                  <FileText size={32} className="text-[#D1D5DB] mx-auto mb-2" />
                  <p className="text-[13px] font-medium text-[#6B7280]">{candidate.name}_Resume.pdf</p>
                  <p className="text-[12px] text-[#9CA3AF] mt-1">PDF viewer — upload resume to preview</p>
                </div>
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'Activity' && (
            <div className="section-card p-5">
              <h3 className="text-[13px] font-semibold text-[#111827] mb-4">Activity Timeline</h3>
              <div className="space-y-4">
                {candidate.timeline.map((event, i) => (
                  <div key={i} className="flex items-start gap-3">
                    {timelineIcon(event.type)}
                    <div className="flex-1 pt-0.5">
                      <p className="text-[13px] font-medium text-[#374151]">{event.event}</p>
                      <p className="text-[11px] text-[#9CA3AF] flex items-center gap-1 mt-0.5">
                        <Clock size={10} />{event.date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* LinkedIn */}
          <div className="section-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[12px] font-semibold text-[#111827]">LinkedIn</h3>
              <ExternalLink size={12} className="text-[#9CA3AF]" />
            </div>
            <div className="bg-[#F8F9FB] rounded-[8px] p-3 text-[12px] text-[#6B7280]">
              <p className="font-medium text-[#374151]">{candidate.name}</p>
              <p className="text-[11px] mt-0.5">{candidate.role}</p>
              <p className="text-[11px] mt-2 text-primary">{candidate.currentCompany} · {candidate.experienceYears}+ years</p>
            </div>
          </div>

          {/* Recruiter Notes */}
          <div className="section-card p-4">
            <h3 className="text-[12px] font-semibold text-[#111827] mb-3">Recruiter Notes</h3>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add private notes about this candidate..."
              className="input-field !text-[12px] resize-none"
              rows={5}
            />
            <button className="btn-primary w-full mt-2 justify-center !text-xs">Save Note</button>
          </div>

          {/* Quick Stats */}
          <div className="section-card p-4">
            <h3 className="text-[12px] font-semibold text-[#111827] mb-3">Quick Stats</h3>
            <div className="space-y-2">
              {[
                { label: 'Match Score', value: `${candidate.matchScore}%` },
                { label: 'Notice Period', value: candidate.noticePeriod },
                { label: 'Expected CTC', value: candidate.salary },
                { label: 'Applied', value: candidate.appliedDate },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-[#F3F4F6] last:border-0">
                  <span className="text-[12px] text-[#6B7280]">{label}</span>
                  <span className="text-[12px] font-semibold text-[#374151]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function CandidateProfilePage() {
  return (
    <Suspense fallback={<div className="p-10 text-[#9CA3AF]">Loading...</div>}>
      <ProfileContent />
    </Suspense>
  );
}
