import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://kkigon.github.io/card/'),
  title: 'Mnemonica — 52장을 내 것으로',
  description: '모바일로 가볍게 익히는 Mnemonica Stack 암기 트레이너',
  applicationName: 'Mnemonica',
  openGraph: {
    title: 'Mnemonica — 52장을 내 것으로',
    description: '플래시 카드, 구간 학습, 퀴즈로 익히는 Mnemonica Stack',
    type: 'website',
    locale: 'ko_KR',
    url: 'https://kkigon.github.io/card/',
    images: [{ url: 'og.png', width: 1730, height: 909, alt: 'Mnemonica — 52장을 내 것으로' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mnemonica — 52장을 내 것으로',
    description: '플래시 카드, 구간 학습, 퀴즈로 익히는 Mnemonica Stack',
    images: ['og.png'],
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f3f0e8' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body className={geist.variable}>{children}</body></html>;
}
