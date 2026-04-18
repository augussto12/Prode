import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import GuruChat from '../chat/GuruChat';
import PageSkeleton from '../skeletons/PageSkeleton';

export default function Layout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-6 md:pt-8 px-4 md:px-8 pb-24 md:pb-8 max-w-[1600px] mx-auto">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <GuruChat />
    </div>
  );
}

