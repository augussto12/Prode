import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import GuruChat from '../chat/GuruChat';

export default function Layout() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 p-4 pb-24 md:pb-4 max-w-7xl mx-auto">
        <Outlet />
      </main>
      <GuruChat />
    </div>
  );
}
