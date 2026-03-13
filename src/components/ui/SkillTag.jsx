const variantCls = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    gray: 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]',
};

export default function SkillTag({ skill, variant = 'gray' }) {
    return (
        <span className={`inline-block text-[11px] font-medium px-2.5 py-1 rounded-full border ${variantCls[variant]}`}>
            {skill}
        </span>
    );
}
