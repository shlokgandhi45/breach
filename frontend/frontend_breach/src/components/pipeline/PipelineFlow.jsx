'use client';
import { useState, useMemo } from 'react';
import { Users, Target, Activity, Zap, ShieldCheck, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import KanbanCard from './KanbanCard';

const stageColors = {
    Applied: '#60A5FA',    // blue-400
    Screening: '#818CF8',  // indigo-400
    Technical: '#A78BFA',  // violet-400
    Interview: '#FB923C',  // orange-400
    Offer: '#34D399',      // emerald-400
    Hired: '#4ADE80',      // green-400
};

export default function PipelineFlow({ stages, board, onDragStart, onDragEnd, onDragOver, onDrop }) {
    const [selectedStage, setSelectedStage] = useState(null);
    const [hoveredNode, setHoveredNode] = useState(null);

    const canvasWidth = useMemo(() => Math.max(1200, (stages.length * 320) + 200), [stages]);

    const nodes = useMemo(() => {
        return stages.map((stage, i) => ({
            id: stage,
            x: 150 + i * 320,
            y: 350 + (i % 2 === 0 ? -80 : 80),
            color: stageColors[stage] || '#9CA3AF'
        }));
    }, [stages]);

    const getBezierPath = (start, end) => {
        const midX = (start.x + end.x) / 2;
        return `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;
    };

    return (
        <div className="relative min-h-[750px] w-full bg-[#020617] rounded-[40px] overflow-x-auto overflow-y-hidden border border-white/10 shadow-[0_0_80px_-20px_rgba(0,0,0,0.8)] custom-scrollbar select-none">
            {/* Neural Matrix Grid Background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            
            <div className="relative h-full py-20" style={{ minWidth: canvasWidth, width: canvasWidth }}>
                {/* Ambient Depth Glows */}
                <div className="absolute top-[20%] left-[10%] w-[600px] h-[600px] bg-primary/10 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute bottom-[20%] right-[10%] w-[600px] h-[600px] bg-violet-600/10 blur-[150px] rounded-full animate-pulse [animation-delay:2s]" />

                {/* Header Decoration */}
                <div className="absolute top-10 left-12 z-20">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                            <Grid3X3 size={10} className="text-primary" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">Core Engine V8.4</span>
                        </div>
                        <div className="h-px w-8 bg-white/10" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">System Integrity: 99.9%</span>
                    </div>
                    <h3 className="text-[28px] font-black text-white tracking-tighter flex items-center gap-4">
                        Talent Network Matrix
                        <div className="flex gap-1">
                            <div className="w-1.5 h-6 bg-primary rounded-full animate-[bounce_1.5s_infinite]" />
                            <div className="w-1.5 h-6 bg-violet-500 rounded-full animate-[bounce_1.5s_infinite_0.2s]" />
                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full animate-[bounce_1.5s_infinite_0.4s]" />
                        </div>
                    </h3>
                </div>

                {/* SVG Connections Layer */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <defs>
                        <filter id="glowLayer" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="4" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>

                    {nodes.map((node, i) => {
                        if (i === nodes.length - 1) return null;
                        const next = nodes[i + 1];
                        const path = getBezierPath(node, next);
                        const isActive = hoveredNode === node.id || hoveredNode === next.id || selectedStage === node.id || selectedStage === next.id;
                        
                        return (
                            <g key={`edge-${i}`}>
                                {/* Deep Background Path */}
                                <path 
                                    d={path} 
                                    stroke="rgba(255,255,255,0.03)" 
                                    strokeWidth="4" 
                                    fill="none"
                                />
                                
                                {/* Dynamic Glow Path */}
                                <path 
                                    d={path} 
                                    stroke={node.color} 
                                    strokeWidth="2" 
                                    fill="none"
                                    className={cn(
                                        "transition-all duration-1000",
                                        isActive ? "opacity-30" : "opacity-5"
                                    )}
                                    filter="url(#glowLayer)"
                                />

                                {/* Flow Particles */}
                                <circle r="2.5" fill={node.color} opacity="0.6" filter="url(#glowLayer)">
                                    <animateMotion path={path} dur={`${4 + Math.random() * 2}s`} repeatCount="indefinite" />
                                </circle>
                                <circle r="1.5" fill="white" opacity="0.4">
                                    <animateMotion path={path} dur={`${5 + Math.random() * 2}s`} repeatCount="indefinite" begin="1s" />
                                </circle>
                            </g>
                        );
                    })}
                </svg>

                {/* Nodes Layer */}
                <div className="relative w-full h-full">
                    {nodes.map((node) => {
                        const isSelected = selectedStage === node.id;
                        const isHovered = hoveredNode === node.id;
                        const candidates = board[node.id] || [];
                        
                        return (
                            <div 
                                key={node.id}
                                className="absolute transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
                                style={{ 
                                    left: node.x, 
                                    top: node.y,
                                    transform: 'translate(-50%, -50%)'
                                }}
                            >
                                {/* Advanced Cyber Node */}
                                <div 
                                    className={cn(
                                        "relative w-32 h-32 rounded-[32px] flex flex-col items-center justify-center cursor-pointer transition-all duration-500",
                                        "backdrop-blur-2xl border-[1.5px]",
                                        isSelected 
                                            ? "bg-white/10 scale-110 shadow-[0_0_60px_-10px_rgba(255,255,255,0.2)] border-white/30" 
                                            : "bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:scale-105 hover:border-white/20"
                                    )}
                                    style={{ 
                                        borderColor: (isSelected || isHovered) ? node.color : 'rgba(255,255,255,0.05)',
                                    }}
                                    onClick={() => setSelectedStage(isSelected ? null : node.id)}
                                    onMouseEnter={() => setHoveredNode(node.id)}
                                    onMouseLeave={() => setHoveredNode(null)}
                                    onDragOver={onDragOver}
                                    onDrop={(e) => onDrop(e, node.id)}
                                >
                                    {/* Geometric Corner Accents */}
                                    <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-white/20" />
                                    <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-white/20" />
                                    <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-white/20" />
                                    <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-white/20" />

                                    <div 
                                        className="w-5 h-5 rounded-lg mb-2 flex items-center justify-center rotate-45 group-hover:rotate-180 transition-transform duration-700 shadow-[0_0_20px]" 
                                        style={{ 
                                            backgroundColor: node.color,
                                            boxShadow: `0 0 20px ${node.color}80`
                                        }}
                                    >
                                        <Zap size={10} className="text-white -rotate-45" />
                                    </div>
                                    
                                    <span className="text-[13px] font-black text-white tracking-[0.1em] uppercase">{node.id}</span>
                                    <div className="mt-1 flex items-center gap-2">
                                        <div className="px-2 py-0.5 rounded-full bg-white/5 border border-white/5 flex items-center gap-1">
                                            <Users size={9} className="text-white/40" />
                                            <span className="text-[10px] text-white/50 font-mono font-bold tracking-widest">{candidates.length.toString().padStart(2, '0')}</span>
                                        </div>
                                    </div>

                                    {/* Pulse Ring */}
                                    <svg className="absolute inset-0 -rotate-90 pointer-events-none">
                                        <circle 
                                            cx="64" cy="64" r="58" 
                                            fill="none" 
                                            stroke={node.color} 
                                            strokeWidth="2.5" 
                                            strokeDasharray="364"
                                            strokeDashoffset={364 * (1 - Math.min(candidates.length / 10, 1))}
                                            strokeLinecap="round"
                                            className="transition-all duration-1000 ease-out"
                                            opacity={isSelected || isHovered ? 1 : 0.1}
                                        />
                                    </svg>
                                </div>

                                {/* Floating Intelligence Stream Portal */}
                                {isSelected && (
                                    <div className="absolute top-[160px] left-1/2 -translate-x-1/2 w-[380px] z-[100] animate-in fade-in slide-in-from-top-6 duration-700 ease-[cubic-bezier(0.19,1,0.22,1)]">
                                        <div className="bg-[#020617]/95 backdrop-blur-[40px] rounded-[40px] border border-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] overflow-hidden">
                                            <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-white/[0.02] to-transparent">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2.5 rounded-2xl bg-white/5 shadow-inner">
                                                        <Target size={18} style={{ color: node.color }} />
                                                    </div>
                                                    <div>
                                                        <span className="block text-[15px] font-black text-white tracking-tight">{node.id} Cluster</span>
                                                        <span className="block text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">Neural Path Active</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                                                    <ShieldCheck size={12} className="text-emerald-500" />
                                                    <span className="text-[9px] font-black text-emerald-500 uppercase">Verified</span>
                                                </div>
                                            </div>
                                            <div className="p-5 max-h-[450px] overflow-y-auto space-y-3 custom-scrollbar">
                                                {candidates.map(c => (
                                                    <div key={c.id} className="group/card transition-all duration-500 hover:translate-x-1">
                                                        <KanbanCard candidate={c} onDragStart={onDragStart} onDragEnd={onDragEnd} />
                                                    </div>
                                                ))}
                                                {candidates.length === 0 && (
                                                    <div className="py-20 text-center flex flex-col items-center gap-4">
                                                        <div className="w-12 h-12 rounded-full bg-white/[0.02] flex items-center justify-center animate-pulse">
                                                            <Activity size={24} className="text-white/10" />
                                                        </div>
                                                        <p className="text-[13px] text-white/20 font-bold uppercase tracking-widest">No Active Signals</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Dynamic Connection Trace */}
                                        <div className="h-12 w-0.5 bg-gradient-to-b from-white/20 via-white/5 to-transparent mx-auto flex flex-col items-center">
                                            <div className="w-1 h-1 rounded-full bg-white/40 mt-2 animate-ping" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Matrix HUD Controls */}
            <div className="absolute bottom-12 left-12 flex items-center gap-8 bg-[#0F172A]/80 backdrop-blur-2xl px-8 py-4 rounded-[24px] border border-white/10 shadow-3xl z-30">
                <div className="flex flex-col gap-1.5 border-r border-white/5 pr-8">
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Flow Legend</span>
                    <div className="flex items-center gap-5">
                        <div className="flex items-center gap-2.5">
                            <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.6)]" />
                            <span className="text-[12px] font-bold text-white/80 tracking-tight">Applied</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_12px_rgba(129,140,248,0.6)]" />
                            <span className="text-[12px] font-bold text-white/80 tracking-tight">Screening</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
                            <span className="text-[12px] font-bold text-white/80 tracking-tight">Selected</span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Engine Stat</span>
                    <div className="flex items-center gap-2 text-white/90">
                        <Zap size={14} className="text-yellow-400" />
                        <span className="text-[12px] font-mono font-bold tracking-tighter">LATENCY: 14ms</span>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-12 right-12 flex flex-col items-end gap-1.5 opacity-40 hover:opacity-100 transition-opacity duration-500 cursor-default">
                <div className="flex items-center gap-3">
                    <Activity size={14} className="text-primary animate-pulse" />
                    <span className="text-[11px] font-black text-white tracking-[0.2em] uppercase">Matrix Node Live Stream</span>
                </div>
                <div className="px-3 py-1 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-primary font-bold tracking-tighter shadow-sm">
                    PROCESS_ID: {Math.random().toString(16).slice(2, 10).toUpperCase()} // PDEU_NODE_PRIMARY
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    height: 6px;
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.02);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </div>
    );
}
