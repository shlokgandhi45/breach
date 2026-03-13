import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export function getSourceIcon(source) {
    const icons = {
        LinkedIn: '💼',
        Referral: '🤝',
        'Job Board': '📋',
        GitHub: '🐙',
        Direct: '✉️',
    };
    return icons[source] || '📄';
}
