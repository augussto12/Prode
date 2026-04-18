import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import GuruChat from '../chat/GuruChat';

export default function Layout() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-6 md:pt-8 px-4 md:px-8 pb-24 md:pb-8 max-w-[1600px] mx-auto">
        <Suspense fallback={
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-3 border-white/20 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        }>
          <Outlet />
        </Suspense>
      </main>
      <GuruChat />
    </div>
  );
}

