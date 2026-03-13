import './globals.css';

export const metadata = {
    title: 'BREACH — AI Recruitment Platform',
    description: 'Production-grade AI recruitment dashboard',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
