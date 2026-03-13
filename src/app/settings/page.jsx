'use client';
import { useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { User, Bell, Sparkles, Users, Shield } from 'lucide-react';

const tabs = [
    { label: 'Profile', icon: User },
    { label: 'Notifications', icon: Bell },
    { label: 'AI Config', icon: Sparkles },
    { label: 'Team', icon: Users },
    { label: 'Security', icon: Shield },
];

export default function SettingsPage() {
    const [active, setActive] = useState('Profile');

    return (
        <AppShell title="Settings" subtitle="Manage your account preferences">
            <div className="flex gap-6">
                {/* Sidebar nav */}
                <aside className="w-44 flex-shrink-0">
                    <nav className="section-card overflow-hidden">
                        {tabs.map(({ label, icon: Icon }) => (
                            <button
                                key={label}
                                onClick={() => setActive(label)}
                                className={`w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-medium border-b border-[#F3F4F6] last:border-0 transition-colors ${active === label ? 'bg-[#EFF6FF] text-primary' : 'text-[#6B7280] hover:bg-[#F8F9FB]'
                                    }`}
                            >
                                <Icon size={14} />
                                {label}
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* Content */}
                <div className="flex-1 max-w-xl">
                    {active === 'Profile' && (
                        <div className="section-card p-6 space-y-4">
                            <h2 className="text-[15px] font-bold text-[#111827] mb-4">Profile</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1">First Name</label><input className="input-field" defaultValue="Priya" /></div>
                                <div><label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1">Last Name</label><input className="input-field" defaultValue="Sharma" /></div>
                            </div>
                            <div><label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1">Email</label><input className="input-field" defaultValue="priya@company.com" /></div>
                            <div><label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1">Role</label><input className="input-field" defaultValue="Sr. Recruiter" /></div>
                            <div><label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1">Department</label><input className="input-field" defaultValue="Talent Acquisition" /></div>
                            <button className="btn-primary">Save Changes</button>
                        </div>
                    )}

                    {active === 'Notifications' && (
                        <div className="section-card p-6">
                            <h2 className="text-[15px] font-bold text-[#111827] mb-5">Notification Preferences</h2>
                            {[
                                'New candidate applications',
                                'Stage changes',
                                'Interview reminders',
                                'AI recommendations',
                                'Referral submissions',
                                'Team activity',
                            ].map(item => (
                                <div key={item} className="flex items-center justify-between py-3 border-b border-[#F3F4F6] last:border-0">
                                    <p className="text-[13px] text-[#374151]">{item}</p>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" defaultChecked className="sr-only peer" />
                                        <div className="w-9 h-5 bg-[#E5E7EB] rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-4" />
                                    </label>
                                </div>
                            ))}
                        </div>
                    )}

                    {active === 'AI Config' && (
                        <div className="section-card p-6">
                            <h2 className="text-[15px] font-bold text-[#111827] mb-2">AI Configuration</h2>
                            <p className="text-[12px] text-[#6B7280] mb-5">Fine-tune how BREACH AI scores and recommends candidates.</p>
                            <div className="space-y-4">
                                {[
                                    { label: 'Skill weight', val: 40 },
                                    { label: 'Experience weight', val: 30 },
                                    { label: 'Culture fit weight', val: 20 },
                                    { label: 'Education weight', val: 10 },
                                ].map(({ label, val }) => (
                                    <div key={label}>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-[12px] font-medium text-[#374151]">{label}</span>
                                            <span className="text-[12px] font-mono text-[#6B7280]">{val}%</span>
                                        </div>
                                        <input type="range" min="0" max="100" defaultValue={val} className="w-full accent-primary" />
                                    </div>
                                ))}
                                <button className="btn-primary mt-2">Save AI Config</button>
                            </div>
                        </div>
                    )}

                    {active === 'Team' && (
                        <div className="section-card p-6">
                            <h2 className="text-[15px] font-bold text-[#111827] mb-4">Team Members</h2>
                            {['Priya Sharma', 'James Park', 'Chen Liu', 'Aisha O\'Brien'].map((name, i) => (
                                <div key={name} className="flex items-center justify-between py-3 border-b border-[#F3F4F6] last:border-0">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-full bg-[#EFF6FF] text-primary text-[11px] font-bold flex items-center justify-center">
                                            {name.split(' ').map(n => n[0]).join('')}
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-semibold text-[#111827]">{name}</p>
                                            <p className="text-[11px] text-[#9CA3AF]">{['Sr. Recruiter', 'Recruiter', 'HR Manager', 'Talent Lead'][i]}</p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{i === 0 ? 'You' : 'Active'}</span>
                                </div>
                            ))}
                            <button className="btn-secondary mt-4 w-full justify-center">Invite Team Member</button>
                        </div>
                    )}

                    {active === 'Security' && (
                        <div className="section-card p-6 space-y-4">
                            <h2 className="text-[15px] font-bold text-[#111827] mb-4">Security</h2>
                            <div><label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1">Current Password</label><input type="password" className="input-field" placeholder="••••••••" /></div>
                            <div><label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1">New Password</label><input type="password" className="input-field" placeholder="••••••••" /></div>
                            <div><label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1">Confirm Password</label><input type="password" className="input-field" placeholder="••••••••" /></div>
                            <button className="btn-primary">Update Password</button>
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}
