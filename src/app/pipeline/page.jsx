'use client';
import { useState, useRef } from 'react';
import { Plus } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import KanbanColumn from '@/components/pipeline/KanbanColumn';
import { candidates as initialCandidates, pipelineStages } from '@/data/candidates';

export default function PipelinePage() {
    const [board, setBoard] = useState(() => {
        const map = {};
        pipelineStages.forEach(s => { map[s] = []; });
        initialCandidates.forEach(c => {
            if (map[c.status]) map[c.status].push(c);
        });
        return map;
    });

    const dragItem = useRef(null);
    const dragSource = useRef(null);

    function handleDragStart(e, candidate) {
        dragItem.current = candidate;
        dragSource.current = candidate.status;
        e.dataTransfer.effectAllowed = 'move';
    }
    function handleDragEnd() { dragItem.current = null; dragSource.current = null; }
    function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
    function handleDrop(e, targetStage) {
        e.preventDefault();
        const item = dragItem.current;
        const source = dragSource.current;
        if (!item || source === targetStage) return;
        setBoard(prev => {
            const next = { ...prev };
            next[source] = next[source].filter(c => c.id !== item.id);
            next[targetStage] = [...next[targetStage], { ...item, status: targetStage }];
            return next;
        });
    }

    const totalCandidates = Object.values(board).flat().length;

    return (
        <AppShell title="Pipeline" subtitle={`${totalCandidates} candidates across ${pipelineStages.length} stages`}>
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-4">
                    {pipelineStages.map(stage => (
                        <div key={stage} className="flex items-center gap-1.5 text-[12px] text-[#6B7280]">
                            <span className="font-semibold text-[#111827]">{board[stage].length}</span>
                            <span>{stage}</span>
                        </div>
                    ))}
                </div>
                <button className="btn-primary"><Plus size={14} />Add Stage</button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-6">
                {pipelineStages.map(stage => (
                    <KanbanColumn
                        key={stage}
                        stage={stage}
                        candidates={board[stage]}
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
