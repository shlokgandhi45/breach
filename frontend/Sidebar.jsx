
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, GitBranch, BarChart2,
  UserPlus, Settings, ChevronLeft, ChevronRight, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Candidates', href: '/candidates', icon: Users, badge: '47' },
  { label: 'Pipeline', href: '/pipeline', icon: GitBranch },
  { label: 'Compare', href: '/compare', icon: BarChart2 },
  { label: 'Applicant List', href: '/referrals', icon: UserPlus, badge: '3' },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', collapsed ? '64px' : '240px');
  }, [collapsed]);

  return (
    <aside className={cn(
      'fixed left-0 top-0 bottom-0 z-50 bg-white border-r border-[#E5E7EB] flex flex-col transition-all duration-200 ease-in-out overflow-hidden',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-[#F3F4F6] flex-shrink-0">
        <div className="w-8 h-8 bg-primary rounded-[8px] flex items-center justify-center flex-shrink-0">
          <Sparkles size={15} className="text-white" />
        </div>
        {!collapsed && (
          <span className="text-[15px] font-bold tracking-tight text-[#111827] whitespace-nowrap overflow-hidden">
            BREACH
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] px-5 pb-2 pt-1">
            Navigation
          </p>
        )}
        {navItems.map(({ label, href, icon: Icon, badge }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href}>
              <div className={cn(
                'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-[8px] mb-0.5 transition-all duration-150 cursor-pointer',
                collapsed && 'justify-center',
                active
                  ? 'bg-[#EFF6FF] text-primary font-semibold'
                  : 'text-[#6B7280] hover:bg-[#F8F9FB] hover:text-[#111827]'
              )}>
                <Icon size={17} className="flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="text-[13.5px] whitespace-nowrap flex-1">{label}</span>
                    {badge && (
                      <span className="text-[10px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full leading-none">
                        {badge}
                      </span>
                    )}
                  </>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[#F3F4F6] p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
          PS
        </div>
        {!collapsed && (
          <div className="flex-1 overflow-hidden">
            <p className="text-[13px] font-semibold text-[#111827] truncate">Priya Sharma</p>
            <p className="text-[11px] text-[#9CA3AF]">Sr. Recruiter</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-6 h-6 flex items-center justify-center text-[#9CA3AF] hover:text-[#6B7280] rounded transition-colors flex-shrink-0 ml-auto"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
