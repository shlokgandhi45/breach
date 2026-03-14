'use client';
import { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import PipelineFlow from '@/components/pipeline/PipelineFlow';
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
    function handleDragEnd() { 
        dragItem.current = null; 
        dragSource.current = null; 
    }
    function handleDragOver(e) { 
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'move'; 
    }
    async function handleDrop(e, targetStage) {
        e.preventDefault();
        const item = dragItem.current;
        const source = dragSource.current;
        if (!item || source === targetStage) return;

        // Optimistic UI update
        setBoard(prev => {
            const next = { ...prev };
            next[source] = (next[source] || []).filter(c => c.id !== item.id);
            next[targetStage] = [...(next[targetStage] || []), { ...item, status: targetStage }];
            return next;
        });

        // Persist to backend
        movePipelineCandidate(item.id, targetStage);
    }

    const totalCandidates = Object.values(board).flat().length;

    if (loading) {
        return (
            <AppShell title="Hiring Pipeline" subtitle="Loading platform data…">
                <div className="flex items-center justify-center p-20">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-[14px] font-medium text-[#6B7280]">Restoring flow state…</p>
                    </div>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell title="Hiring Pipeline" subtitle="Visual flow-relationship mapping">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-[18px] font-bold text-[#111827]">Process Map</h2>
                    <p className="text-[13px] text-[#6B7280]">{totalCandidates} candidates in the current cycle</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-5 py-2.5 bg-white border border-[#E5E7EB] text-[#374151] rounded-xl text-[13px] font-semibold hover:bg-[#F9FAFB] transition-all shadow-sm">
                        View Analytics
                    </button>
                    <button className="btn-primary rounded-xl px-5 py-2.5">
                        <Plus size={16} /> New Stage
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                <PipelineFlow 
                    stages={stages}
                    board={board}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                />
            </div>
        </AppShell>
    );
}
