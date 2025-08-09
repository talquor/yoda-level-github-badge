import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Yoda Level GitHub Badge',
  description: 'Shields-style badge generator: Rank → Persona (Grade)',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
