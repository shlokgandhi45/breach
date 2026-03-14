'use client';
import { useState } from 'react';
import { Loader2, Mail, Send, Copy, CheckCircle, RefreshCw } from 'lucide-react';
import { draftOutreachEmail, sendEmail } from '@/lib/candidateService';

export default function OutreachPanel({ candidate }) {
    const [draft, setDraft] = useState(null);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [sendError, setSendError] = useState(null);
    const [copied, setCopied] = useState(false);

    // Editable fields
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');

    async function generateDraft() {
        setLoading(true);
        setSent(false);
        const result = await draftOutreachEmail({
            candidate_name: candidate?.name || 'Candidate',
            candidate_email: candidate?.email || 'candidate@example.com',
            role: candidate?.role || 'Software Engineer',
            top_trait: 'technical depth',
            gap_weeks: 4,
            gap_skills: (candidate?.skills || []).slice(-2).join(', ') || 'emerging skills',
        });
        setDraft(result);
        setSubject(result.subject || '');
        setBody(result.body || '');
        setLoading(false);
    }

    async function handleSend() {
        setSending(true);
        setSendError(null);
        
        const res = await sendEmail({
            to: candidate?.email || 'candidate@example.com',
            subject,
            body,
        }, false); // useMock = false enforces SMTP
        
        setSending(false);
        if (res.success) {
            setSent(true);
        } else {
            setSendError(res.error || "Failed to send email");
        }
    }

    function handleCopy() {
        navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    if (!draft && !loading) {
        return (
            <div className="text-center py-12 animate-in fade-in duration-500">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                    <Mail size={28} className="text-blue-600" />
                </div>
                <h3 className="text-[16px] font-bold text-[#111827] mb-2">AI Outreach Email</h3>
                <p className="text-[13px] text-[#6B7280] max-w-[380px] mx-auto leading-relaxed mb-6">
                    Generate a hyper-personalized outreach email that references the candidate's strengths,
                    acknowledges skill gaps as growth opportunities, and includes a clear call-to-action.
                </p>
                <button onClick={generateDraft} className="btn-primary !text-[13px] !px-6">
                    Draft Email with AI
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="text-center py-16 animate-in fade-in duration-500">
                <Loader2 size={28} className="animate-spin text-primary mx-auto mb-4" />
                <p className="text-[14px] font-semibold text-[#6B7280]">Crafting personalized email…</p>
                <p className="text-[12px] text-[#9CA3AF] mt-1">Combining personality analysis + skill gap data</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* To */}
            <div className="flex items-center gap-3 bg-[#F8F9FB] rounded-xl p-3 border border-[#F3F4F6]">
                <span className="text-[12px] font-semibold text-[#9CA3AF] uppercase tracking-wider w-16">To</span>
                <span className="text-[13px] font-medium text-[#374151]">{candidate?.email || 'candidate@example.com'}</span>
            </div>

            {/* Subject */}
            <div className="flex items-center gap-3">
                <span className="text-[12px] font-semibold text-[#9CA3AF] uppercase tracking-wider w-16 flex-shrink-0">Subject</span>
                <input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="flex-1 text-[13px] font-medium text-[#111827] bg-white border border-[#E5E7EB] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
            </div>

            {/* Body */}
            <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                className="w-full bg-white border border-[#E5E7EB] rounded-2xl p-5 text-[14px] text-[#374151] leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none min-h-[250px] font-medium"
            />

            {draft?._mock && (
                <p className="text-[11px] text-amber-500 text-center">⚠ Showing mock draft — start the backend for AI-generated emails</p>
            )}

            {sendError && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-xl p-3 text-[13px] font-semibold">
                    <span>⚠</span> {sendError}
                </div>
            )}

            {sent && (
                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-xl p-3 text-[13px] font-semibold">
                    <CheckCircle size={16} />Email sent successfully
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
                <div className="flex gap-2">
                    <button onClick={generateDraft} className="btn-secondary !text-[12px] flex items-center gap-1.5">
                        <RefreshCw size={13} />Regenerate
                    </button>
                    <button onClick={handleCopy} className="btn-secondary !text-[12px] flex items-center gap-1.5">
                        {copied ? <CheckCircle size={13} className="text-emerald-600" /> : <Copy size={13} />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>
                <button
                    onClick={handleSend}
                    disabled={sending || sent}
                    className="btn-primary !text-[13px] !px-6 flex items-center gap-2 disabled:opacity-40"
                >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {sending ? 'Sending…' : sent ? 'Sent ✓' : 'Send Email'}
                </button>
            </div>
        </div>
    );
}
