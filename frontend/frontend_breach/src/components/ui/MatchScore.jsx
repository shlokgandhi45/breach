export default function MatchScore({ score, size = 'sm' }) {
    const color = score >= 90 ? 'text-emerald-600' : score >= 75 ? 'text-blue-600' : 'text-orange-500';
    const ring = score >= 90 ? 'border-emerald-500' : score >= 75 ? 'border-blue-500' : 'border-orange-400';
    const sizeCls = size === 'md'
        ? 'w-14 h-14 text-[18px] border-[3px]'
        : 'w-10 h-10 text-[13px] border-2';

    return (
        <div className={`rounded-full flex flex-col items-center justify-center font-mono font-bold ${color} ${ring} border-solid ${sizeCls}`}>
            <span>{score}</span>
            {size === 'md' && <span className="text-[8px] font-sans font-semibold opacity-60 tracking-wide">MATCH</span>}
        </div>
    );
}
