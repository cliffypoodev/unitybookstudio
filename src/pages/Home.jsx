import React from 'react';
import NovelHero from '@/components/home/NovelHero';
import ExplainerSection from '@/components/home/ExplainerSection';
import ActionLinks from '@/components/home/ActionLinks';

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-accent/35 blur-3xl" />
        <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-secondary blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10 lg:px-16 lg:py-14">
        <NovelHero />
        <ExplainerSection />
        <ActionLinks />
      </div>
    </main>
  );
}