'use client';
import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { uploadResume } from '@/lib/candidateService';

export default function ResumeUploadModal({ open, onClose }) {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [results, setResults] = useState([]);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef(null);

    const handleFiles = useCallback((fileList) => {
        const pdfs = Array.from(fileList).filter(f => f.type === 'application/pdf');
        setFiles(prev => [...prev, ...pdfs]);
    }, []);

    function handleDrop(e) {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
    }

    function removeFile(idx) {
        setFiles(prev => prev.filter((_, i) => i !== idx));
    }

    async function handleUpload() {
        if (files.length === 0) return;
        setUploading(true);
        setResults([]);
        const uploadResults = [];

        for (const file of files) {
            try {
                const res = await uploadResume(file);
                uploadResults.push({
                    name: file.name,
                    success: res.success !== false,
                    candidateName: res.full_name || null,
                    error: res.error || null,
                });
            } catch (err) {
                uploadResults.push({ name: file.name, success: false, error: err.message });
            }
        }

        setResults(uploadResults);
        setUploading(false);
        setFiles([]);
    }

    function handleClose() {
        setFiles([]);
        setResults([]);
        setUploading(false);
        onClose?.();
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={handleClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 animate-in zoom-in-95 fade-in duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[#F3F4F6]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Upload size={18} className="text-primary" />
                        </div>
                        <div>
                            <h2 className="text-[16px] font-bold text-[#111827]">Upload Resumes</h2>
                            <p className="text-[12px] text-[#9CA3AF]">PDF files • AI-parsed automatically</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#6B7280] transition-all">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {/* Drop Zone */}
                    <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => inputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all
                            ${dragOver
                                ? 'border-primary bg-primary/5 scale-[1.02]'
                                : 'border-[#E5E7EB] hover:border-primary/40 hover:bg-[#F8F9FB]'}`}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mx-auto mb-4">
                            <FileText size={24} className={`transition-colors ${dragOver ? 'text-primary' : 'text-[#9CA3AF]'}`} />
                        </div>
                        <p className="text-[14px] font-semibold text-[#374151] mb-1">
                            {dragOver ? 'Drop PDF here' : 'Drag & drop PDF resumes'}
                        </p>
                        <p className="text-[12px] text-[#9CA3AF]">or click to browse files</p>
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".pdf"
                            multiple
                            className="hidden"
                            onChange={e => handleFiles(e.target.files)}
                        />
                    </div>

                    {/* Queued Files */}
                    {files.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {files.map((f, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-[#F8F9FB] rounded-xl">
                                    <FileText size={16} className="text-primary flex-shrink-0" />
                                    <span className="text-[13px] font-medium text-[#374151] flex-1 truncate">{f.name}</span>
                                    <span className="text-[11px] text-[#9CA3AF]">{(f.size / 1024).toFixed(0)} KB</span>
                                    <button onClick={() => removeFile(i)} className="text-[#D1D5DB] hover:text-red-400 transition-colors">
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Upload Results */}
                    {results.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {results.map((r, i) => (
                                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${r.success ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                    {r.success
                                        ? <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />
                                        : <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                                    }
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-semibold text-[#374151] truncate">{r.name}</p>
                                        <p className="text-[11px] text-[#6B7280]">
                                            {r.success
                                                ? (r.candidateName ? `Parsed: ${r.candidateName}` : 'Uploaded successfully')
                                                : (r.error || 'Upload failed')
                                            }
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 pt-0">
                    <p className="text-[11px] text-[#9CA3AF]">
                        {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} queued` : 'No files selected'}
                    </p>
                    <div className="flex gap-2">
                        <button onClick={handleClose} className="btn-secondary !text-[13px] !px-5">Cancel</button>
                        <button
                            onClick={handleUpload}
                            disabled={files.length === 0 || uploading}
                            className="btn-primary !text-[13px] !px-6 flex items-center gap-2 disabled:opacity-40"
                        >
                            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                            {uploading ? 'Uploading…' : 'Upload & Parse'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
