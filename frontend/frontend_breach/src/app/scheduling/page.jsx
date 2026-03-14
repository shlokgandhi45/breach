'use client';
import { useState, useEffect } from 'react';
import { 
    Calendar, Download, Search, ExternalLink, 
    Filter, ChevronRight, User, Mail, Briefcase, MapPin, Trash2
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import { fetchScheduleArchive, removeScheduledInterview } from '@/lib/candidateService';
import MatchScore from '@/components/ui/MatchScore';

export default function SchedulingArchive() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const data = await fetchScheduleArchive();
            setRows(data);
            setLoading(false);
        };
        loadData();
    }, []);

    const filteredRows = rows.filter(row => 
        row.Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.Role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.Company?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleRemove = async (candidateId) => {
        if (!confirm('Are you sure you want to remove this candidate from the interview schedule? This will also remove them from the exported CSV.')) return;

        // Optimistic UI Update
        const previousRows = [...rows];
        setRows(rows.filter(r => r.ID !== candidateId));

        try {
            const res = await removeScheduledInterview(candidateId);
            if (!res.success) throw new Error(res.error || 'Failed to remove');
        } catch (err) {
            console.error('Removal failed:', err);
            alert('Could not remove candidate. Restoring record.');
            setRows(previousRows);
        }
    };

    const downloadCSV = () => {
        if (!rows.length) return;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        window.location.href = `${apiUrl}/api/scheduling/export`;
    };

    return (
        <AppShell title="Interview Schedule" subtitle="Live synchronization with Google Sheets">
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-sm">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search scheduled candidates..."
                            className="w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={downloadCSV}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#E5E7EB] text-[#374151] rounded-xl text-[13px] font-semibold hover:bg-[#F9FAFB] transition-all shadow-sm"
                        >
                            <Download size={16} />
                            Download CSV
                        </button>
                        <a 
                            href={process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL || '#'} 
                            target="_blank"
                            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-[13px] font-semibold hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
                        >
                            <ExternalLink size={16} />
                            Open Google Sheet
                        </a>
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">Candidate</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">Role & Company</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">Location</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#6B7280] uppercase tracking-wider text-center">Score</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#6B7280] uppercase tracking-wider w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F3F4F6]">
                                {loading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan="6" className="px-6 py-8 h-16 bg-[#F9FAFB]/50"></td>
                                        </tr>
                                    ))
                                ) : filteredRows.length > 0 ? (
                                    filteredRows.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-[#F9FAFB] transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-[#EFF6FF] flex items-center justify-center text-primary text-[13px] font-bold">
                                                        {row.Name?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-[14px] font-semibold text-[#111827]">{row.Name}</p>
                                                        <p className="text-[12px] text-[#6B7280] flex items-center gap-1">
                                                            <Mail size={12} /> {row.Email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-[13.5px] font-medium text-[#374151]">{row.Role}</p>
                                                <p className="text-[12px] text-[#6B7280] flex items-center gap-1">
                                                    <Briefcase size={12} /> {row.Company}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 text-[13px] text-[#6B7280]">
                                                    <MapPin size={14} />
                                                    {row.Location || 'Remote'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center">
                                                    <MatchScore score={row.Score || 0} size="sm" />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-100 uppercase tracking-wide">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                                                    {row.Status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => handleRemove(row.ID)}
                                                        className="p-2 text-[#D1D5DB] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        title="Remove from schedule"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <button className="p-1.5 text-[#D1D5DB] hover:text-primary hover:bg-[#EFF6FF] rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                                        <ChevronRight size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3 opacity-40">
                                                <Calendar size={48} className="text-[#9CA3AF]" />
                                                <p className="text-[15px] font-medium text-[#4B5563]">No scheduled candidates found</p>
                                                <p className="text-[12px] text-[#6B7280]">Try adjusting your search filters</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="flex items-center justify-between text-[#9CA3AF] text-[12px] px-2">
                    <p>Showing {filteredRows.length} of {rows.length} records</p>
                    <p>Last synced: {new Date().toLocaleTimeString()}</p>
                </div>
            </div>
        </AppShell>
    );
}

