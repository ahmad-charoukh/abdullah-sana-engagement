import type { Metadata } from 'next';
import '@fontsource/aref-ruqaa/arabic-400.css';
import '@fontsource/aref-ruqaa/arabic-700.css';
import '@fontsource/amiri/arabic-400.css';
import '@fontsource/amiri/arabic-700.css';
import '@fontsource/cormorant-garamond/latin-400.css';
import './globals.css';
export const metadata: Metadata = { title: 'عبدالله وسنا | دعوة حفل خطبة', description: 'بكل حب، ندعوكم لمشاركتنا فرحة حفل خطبتنا.', robots: {index:false,follow:false} };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="ar" dir="rtl"><body>{children}</body></html>}
