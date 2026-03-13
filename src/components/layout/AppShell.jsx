'use client';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppShell({ children, title, subtitle }) {
    return (
        <div className="flex min-h-screen bg-[#F8F9FB]">
            <Sidebar />
            <div
                className="flex-1 flex flex-col transition-all duration-200"
                style={{ marginLeft: 'var(--sidebar-width, 240px)' }}
            >
                <Topbar title={title} subtitle={subtitle} />
                <main className="flex-1 p-6 overflow-auto">{children}</main>
            </div>
        </div>
    );
}
