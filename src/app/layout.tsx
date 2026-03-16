'use client';
import './globals.css';
import { Compass, Film, Tv, Clock, ShieldBan, AlertCircle, Users, Settings, Play, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // When navigating away from /search, clear the search bar
  useEffect(() => {
    if (!pathname.startsWith('/search')) {
      setSearchQuery('');
    }
  }, [pathname]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (value.length >= 3) {
      router.push(`/search?q=${encodeURIComponent(value)}`);
    } else if (value.length === 0) {
      router.push('/');
    }
  };

  const navItemClass = (path: string) => {
    const isActive = pathname === path;
    return `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium ${
      isActive 
        ? 'bg-indigo-600/20 text-indigo-400' 
        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
    }`;
  };

  // Hide the sidebar on login/setup pages
  if (pathname === '/login' || pathname === '/setup') {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="flex h-screen bg-[#0f111a] text-white font-sans overflow-hidden">
        
        {/* LEFT SIDEBAR */}
        <aside className="w-64 bg-[#161824] border-r border-gray-800/50 flex flex-col py-6">
          <div className="px-6 mb-8 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Play className="w-4 h-4 text-white fill-current" />
            </div>
            <span className="text-xl font-bold tracking-tight">seerr</span>
          </div>

          <nav className="flex-1 space-y-1 px-3">
            <Link href="/" className={navItemClass('/')}>
              <Compass className="w-5 h-5" /> Discover
            </Link>
            <Link href="/movies" className={navItemClass('/movies')}>
              <Film className="w-5 h-5" /> Movies
            </Link>
            <Link href="/series" className={navItemClass('/series')}>
              <Tv className="w-5 h-5" /> Series
            </Link>
            <Link href="/requests" className={navItemClass('/requests')}>
              <Clock className="w-5 h-5" /> Requests
            </Link>
            
            <div className="my-4 border-t border-gray-800/50" />
            
            <Link href="/blocklist" className={navItemClass('/blocklist')}>
              <ShieldBan className="w-5 h-5" /> Blocklist
            </Link>
            <Link href="/issues" className={navItemClass('/issues')}>
              <AlertCircle className="w-5 h-5" /> Issues
            </Link>
            <Link href="/users" className={navItemClass('/users')}>
              <Users className="w-5 h-5" /> Users
            </Link>
            <Link href="/settings" className={navItemClass('/settings')}>
              <Settings className="w-5 h-5" /> Settings
            </Link>
          </nav>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 flex flex-col relative">
          
          {/* TOP SEARCH BAR */}
          <header className="h-16 flex items-center px-8 shrink-0 z-20">
            <div className="relative w-full max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search Movies & TV..." 
                className="w-full bg-[#161824] border-none rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-white placeholder-gray-500"
              />
            </div>
            <div className="ml-auto">
               <div className="w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center text-sm font-bold cursor-pointer">
                 M
               </div>
            </div>
          </header>

          {/* PAGE CONTENT GOES HERE */}
          <div className="flex-1 overflow-y-auto px-8 pb-12">
            {children}
          </div>
          
        </main>
      </body>
    </html>
  );
}
