'use client';
import { useState, useCallback } from 'react';
import { Bell, Search, Sparkles } from 'lucide-react';
import SearchOverlay from '@/components/search/SearchOverlay';

export default function Topbar({ title, subtitle }) {
    const [searchOpen, setSearchOpen] = useState(false);

    const openSearch = useCallback(() => setSearchOpen(true), []);
    const closeSearch = useCallback(() => setSearchOpen(false), []);

    return (
        <>
            <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-6 sticky top-0 z-40">
                <div>
                    <h1 className="text-[16px] font-bold text-[#111827] tracking-tight">{title}</h1>
                    {subtitle && <p className="text-[12px] text-[#6B7280] mt-0.5">{subtitle}</p>}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={openSearch}
                        className="group relative flex items-center gap-2 w-56 pl-3 pr-3 py-2 text-[12.5px] bg-[#F8F9FB] border border-[#E5E7EB] rounded-[8px] hover:border-primary/40 hover:bg-primary/5 transition-all text-left cursor-pointer"
                    >
                        <Search size={13} className="text-[#9CA3AF] group-hover:text-primary transition-colors" />
                        <span className="text-[#9CA3AF] group-hover:text-[#6B7280] transition-colors flex-1">Search candidates…</span>
                        <Sparkles size={12} className="text-primary/40 group-hover:text-primary transition-colors" />
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] rounded-[8px] relative transition-colors">
                        <Bell size={16} />
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
                    </button>
                </div>
            </header>

            <SearchOverlay open={searchOpen} onClose={closeSearch} />
        </>
    );
}
