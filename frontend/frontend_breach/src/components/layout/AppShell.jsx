'use client';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppShell({ children, title, subtitle }) {
    return (
        <div className="flex h-screen bg-[#F8F9FB] overflow-hidden">
            <Sidebar />
            <div
                className="flex-1 flex flex-col h-full transition-all duration-200"
                style={{ marginLeft: 'var(--sidebar-width, 240px)' }}
            >
                <Topbar title={title} subtitle={subtitle} />
                <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden min-h-0 bg-[#F8F9FB]">
                    <div className="max-w-[1600px] mx-auto w-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
