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
    <html lang="pt-BR">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,300;0,7..72,400;0,7..72,500;0,7..72,600;0,7..72,700;1,7..72,300;1,7..72,400&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning={true}>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}