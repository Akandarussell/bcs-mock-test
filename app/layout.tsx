import type { Metadata } from 'next';
import { FloatingTutorDrawer } from '@/components/FloatingTutorDrawer';
import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';
import { PuterProvider } from '@/components/PuterProvider';
import './globals.css';

export const metadata: Metadata = {
  title: "Shamima's BCS Preparation — 51st Special BCS (MBBS)",
  description:
    'Online 200-mark MCQ mock exam and progress tracker exclusively for the 51st Special BCS (Health Cadre) Assistant Surgeon (MBBS) exam.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-slate-50/80 text-slate-900">
        <PuterProvider>
          <Navbar />
          <main className="mx-auto w-full max-w-7xl flex-1 px-3.5 py-5 sm:px-6 sm:py-7">
            {children}
          </main>
          <Footer />
          <FloatingTutorDrawer />
        </PuterProvider>
      </body>
    </html>
  );
}

