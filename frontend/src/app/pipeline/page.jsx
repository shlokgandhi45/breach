'use client';
import { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import KanbanColumn from '@/components/pipeline/KanbanColumn';
import { fetchPipelineBoard, movePipelineCandidate } from '@/lib/candidateService';

export default function PipelinePage() {
    const [stages, setStages] = useState([]);
    const [board, setBoard] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            const data = await fetchPipelineBoard();
            if (!cancelled) {
                setStages(data.stages);
                setBoard(data.board);
                setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, []);

    const dragItem = useRef(null);
    const dragSource = useRef(null);

    function handleDragStart(e, candidate) {
        dragItem.current = candidate;
        dragSource.current = candidate.status;
        e.dataTransfer.effectAllowed = 'move';
    }
    function handleDragEnd() { dragItem.current = null; dragSource.current = null; }
    function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
    async function handleDrop(e, targetStage) {
        e.preventDefault();
        const item = dragItem.current;
        const source = dragSource.current;
        if (!item || source === targetStage) return;

        // Optimistic UI update
        setBoard(prev => {
            const next = { ...prev };
            next[source] = next[source].filter(c => c.id !== item.id);
            next[targetStage] = [...next[targetStage], { ...item, status: targetStage }];
            return next;
        });

        // Persist to backend (non-blocking)
        movePipelineCandidate(item.id, targetStage);
    }

    const totalCandidates = Object.values(board).flat().length;

    if (loading) {
        return (
            <AppShell title="Pipeline" subtitle="Loading…">
                <div className="section-card p-12 text-center">
                    <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-[13px] text-[#9CA3AF]">Loading pipeline…</p>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell title="Pipeline" subtitle={`${totalCandidates} candidates across ${stages.length} stages`}>
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-4">
                    {stages.map(stage => (
                        <div key={stage} className="flex items-center gap-1.5 text-[12px] text-[#6B7280]">
                            <span className="font-semibold text-[#111827]">{(board[stage] || []).length}</span>
                            <span>{stage}</span>
                        </div>
                    ))}
                </div>
                <button className="btn-primary"><Plus size={14} />Add Stage</button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-6">
                {stages.map(stage => (
                    <KanbanColumn
                        key={stage}
                        stage={stage}
                        candidates={board[stage] || []}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    />
                ))}
            </div>
        </AppShell>
    );
}
