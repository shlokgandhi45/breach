'use client';
import { Bell, Search } from 'lucide-react';

export default function Topbar({ title, subtitle }) {
    return (
        <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-6 sticky top-0 z-40">
            <div>
                <h1 className="text-[16px] font-bold text-[#111827] tracking-tight">{title}</h1>
                {subtitle && <p className="text-[12px] text-[#6B7280] mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-3">
                <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                        className="w-52 pl-8 pr-3 py-2 text-[12.5px] bg-[#F8F9FB] border border-[#E5E7EB] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-[#9CA3AF]"
                        placeholder="Search candidates…"
                    />
                </div>
                <button className="w-8 h-8 flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] rounded-[8px] relative transition-colors">
                    <Bell size={16} />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
                </button>
            </div>
        </header>
    );
}
