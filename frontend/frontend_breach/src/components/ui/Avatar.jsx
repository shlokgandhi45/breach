import { cn } from '@/lib/utils';

export default function Avatar({ initials, color, size = 'md' }) {
    const sizes = {
        sm: 'w-7 h-7 text-[11px]',
        md: 'w-9 h-9 text-[13px]',
        lg: 'w-12 h-12 text-[15px]',
        xl: 'w-16 h-16 text-[18px]',
    };
    return (
        <div className={cn('rounded-full flex items-center justify-center font-bold flex-shrink-0', sizes[size], color)}>
            {initials}
        </div>
    );
}
