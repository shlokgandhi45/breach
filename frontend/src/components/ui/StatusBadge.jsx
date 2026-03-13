const variants = {
    Applied: 'bg-gray-100 text-gray-600',
    Screening: 'bg-blue-50 text-blue-700',
    Technical: 'bg-violet-50 text-violet-700',
    Interview: 'bg-orange-50 text-orange-700',
    Offer: 'bg-emerald-50 text-emerald-700',
    Hired: 'bg-green-100 text-green-800',
};

export default function StatusBadge({ status }) {
    return (
        <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full ${variants[status] || 'bg-gray-100 text-gray-600'}`}>
            {status}
        </span>
    );
}
