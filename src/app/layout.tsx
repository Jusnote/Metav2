import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'FlashCards - Repetição Espaçada',
  description: 'Sistema de flashcards com repetição espaçada para aprendizado eficiente',
  openGraph: {
    title: 'FlashCards - Repetição Espaçada',
    description: 'Sistema de flashcards com repetição espaçada para aprendizado eficiente',
    type: 'website',
    images: ['https://lovable.dev/opengraph-image-p98pqg.png'],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@lovable_dev',
    images: ['https://lovable.dev/opengraph-image-p98pqg.png'],
  },
  authors: [{ name: 'Lovable' }],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}