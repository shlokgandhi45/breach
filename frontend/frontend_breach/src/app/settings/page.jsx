'use client';
import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { User, Bell, Sparkles, Users, Shield, Briefcase, Plus, X } from 'lucide-react';

const tabs = [
    { label: 'Profile', icon: User },
    { label: 'Notifications', icon: Bell },
    { label: 'AI Config', icon: Sparkles },
    { label: 'Job Roles', icon: Briefcase },
    { label: 'Team', icon: Users },
    { label: 'Security', icon: Shield },
];

export default function SettingsPage() {
    const [active, setActive] = useState('Profile');
    
    // AI Config State
    const [skillWeight, setSkillWeight] = useState(40);
    const [expWeight, setExpWeight] = useState(30);
    const [cultureWeight, setCultureWeight] = useState(20);
    const [eduWeight, setEduWeight] = useState(10);
    
    // Job Roles State
    const [jobRoles, setJobRoles] = useState([]);
    const [newRole, setNewRole] = useState('');

    useEffect(() => {
        // Load AI Config
        fetch('/api/ai-config')
            .then(res => res.json())
            .then(data => {
                if (data && data.weights) {
                    setSkillWeight(data.weights.skill_weight);
                    setExpWeight(data.weights.experience_weight);
                    setCultureWeight(data.weights.culture_fit_weight);
                    setEduWeight(data.weights.education_weight);
                }
            })
            .catch(err => console.error("Failed to fetch AI Config:", err));

        // Load Job Roles
        fetch('/api/job-roles')
            .then(res => res.json())
            .then(data => setJobRoles(data || []))
            .catch(err => console.error("Failed to fetch Job Roles:", err));
    }, []);

    const handleSaveAIConfig = async () => {
        try {
            const res = await fetch('/api/ai-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    skill_weight: skillWeight,
                    experience_weight: expWeight,
                    culture_fit_weight: cultureWeight,
                    education_weight: eduWeight,
                })
            });
            const data = await res.json();
            if (data && data.final_weights) {
                setSkillWeight(data.final_weights.skill_weight);
                setExpWeight(data.final_weights.experience_weight);
                setCultureWeight(data.final_weights.culture_fit_weight);
                setEduWeight(data.final_weights.education_weight);
                alert("AI Config saved" + (data.normalized ? " (Values were normalized to 100%)" : "!"));
            }
        } catch (error) {
            console.error("Failed to save AI config:", error);
            alert("Failed to save AI Config");
        }
    };

    const handleAddJobRole = async (e) => {
        e.preventDefault();
        if (!newRole.trim()) return;
        try {
            const res = await fetch('/api/job-roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role_title: newRole.trim(), created_by: 'priya@company.com' })
            });
            const data = await res.json();
            if (data && data.role_id) {
                setJobRoles([...jobRoles, data]);
                setNewRole('');
            }
        } catch (error) {
            console.error("Failed to add job role:", error);
        }
    };

    const handleDeleteJobRole = async (roleId) => {
        try {
            await fetch(`/api/job-roles/${roleId}`, { method: 'DELETE' });
            setJobRoles(jobRoles.filter(role => role.role_id !== roleId));
        } catch (error) {
            console.error("Failed to delete job role:", error);
        }
    };

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
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-[12px] font-medium text-[#374151]">Skill weight</span>
                                        <span className="text-[12px] font-mono text-[#6B7280]">{skillWeight}%</span>
                                    </div>
                                    <input type="range" min="0" max="100" value={skillWeight} onChange={e => setSkillWeight(Number(e.target.value))} className="w-full accent-primary" />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-[12px] font-medium text-[#374151]">Experience weight</span>
                                        <span className="text-[12px] font-mono text-[#6B7280]">{expWeight}%</span>
                                    </div>
                                    <input type="range" min="0" max="100" value={expWeight} onChange={e => setExpWeight(Number(e.target.value))} className="w-full accent-primary" />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-[12px] font-medium text-[#374151]">Culture fit weight</span>
                                        <span className="text-[12px] font-mono text-[#6B7280]">{cultureWeight}%</span>
                                    </div>
                                    <input type="range" min="0" max="100" value={cultureWeight} onChange={e => setCultureWeight(Number(e.target.value))} className="w-full accent-primary" />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-[12px] font-medium text-[#374151]">Education weight</span>
                                        <span className="text-[12px] font-mono text-[#6B7280]">{eduWeight}%</span>
                                    </div>
                                    <input type="range" min="0" max="100" value={eduWeight} onChange={e => setEduWeight(Number(e.target.value))} className="w-full accent-primary" />
                                </div>
                                <button className="btn-primary mt-2" onClick={handleSaveAIConfig}>Save AI Config</button>
                            </div>
                        </div>
                    )}

                    {active === 'Job Roles' && (
                        <div className="section-card p-6">
                            <h2 className="text-[15px] font-bold text-[#111827] mb-2">Required Job Roles</h2>
                            <p className="text-[12px] text-[#6B7280] mb-5">Manage saved job role templates to quickly filter candidates in AI search.</p>
                            
                            <form onSubmit={handleAddJobRole} className="flex gap-3 mb-6">
                                <input 
                                    className="input-field flex-1" 
                                    placeholder="e.g. Senior Frontend Engineer" 
                                    value={newRole}
                                    onChange={(e) => setNewRole(e.target.value)}
                                />
                                <button type="submit" className="btn-primary flex items-center gap-2 whitespace-nowrap" disabled={!newRole.trim()}>
                                    <Plus size={16} /> Add Role
                                </button>
                            </form>
                            
                            <div className="space-y-2">
                                {jobRoles.length === 0 ? (
                                    <p className="text-[13px] text-[#6B7280] italic text-center py-4 bg-[#F8F9FB] rounded-lg border border-[#F3F4F6]">No templates saved yet.</p>
                                ) : (
                                    jobRoles.map(role => (
                                        <div key={role.role_id} className="flex items-center justify-between py-3 px-4 bg-white border border-[#E5E7EB] rounded-lg group hover:border-[#D1D5DB] transition-all">
                                            <div>
                                                <p className="text-[14px] font-semibold text-[#111827]">{role.role_title}</p>
                                                {role.created_by && <p className="text-[11px] text-[#9CA3AF]">Added by {role.created_by}</p>}
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteJobRole(role.role_id)}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:bg-red-50 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))
                                )}
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
