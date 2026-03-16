"use client";
import "./globals.css";
import {
  Compass,
  Film,
  Tv,
  Clock,
  ShieldBan,
  AlertCircle,
  Users,
  Settings,
  Play,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const navItems = [
    { href: "/", label: "Discover", icon: Compass },
    { href: "/movies", label: "Movies", icon: Film },
    { href: "/series", label: "Series", icon: Tv },
    { href: "/requests", label: "Requests", icon: Clock },
  ];

  const adminItems = [
    { href: "/blocklist", label: "Blocklist", icon: ShieldBan },
    { href: "/issues", label: "Issues", icon: AlertCircle },
    { href: "/users", label: "Users", icon: Users },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  // When navigating away from /search, clear the search bar
  useEffect(() => {
    if (!pathname.startsWith("/search")) {
      setSearchQuery("");
    }
  }, [pathname]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (value.length >= 3) {
      router.push(`/search?q=${encodeURIComponent(value)}`);
    } else if (value.length === 0) {
      router.push("/");
    }
  };

  const isActivePath = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  const navItemClass = (path: string) => {
    const isActive = isActivePath(path);
    return `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium ${
      isActive
        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
        : "text-gray-400 hover:text-white hover:bg-gray-800/50 border border-transparent"
    }`;
  };

  const mobileNavItemClass = (path: string) => {
    const isActive = isActivePath(path);
    return `flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-xl transition-colors min-w-14 ${
      isActive
        ? "text-indigo-300 bg-indigo-600/20"
        : "text-gray-400 hover:text-white"
    }`;
  };

  // Hide the sidebar on login/setup pages
  if (pathname === "/login" || pathname === "/setup") {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="flex h-screen bg-[#0f111a] text-white font-sans overflow-hidden">
        {/* LEFT SIDEBAR (desktop/tablet) */}
        <aside className="hidden md:flex w-72 bg-[#131722] border-r border-gray-800/60 flex-col py-5 px-3">
          <div className="px-3 mb-6 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <Play className="w-4 h-4 text-white fill-current" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-semibold tracking-tight text-white">
                seerr
              </span>
              <span className="text-[11px] text-gray-400">
                Debrid Dashboard
              </span>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={navItemClass(item.href)}
                >
                  <Icon className="w-4 h-4" /> {item.label}
                </Link>
              );
            })}

            <div className="my-4 border-t border-gray-800/60" />

            {adminItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={navItemClass(item.href)}
                >
                  <Icon className="w-4 h-4" /> {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 flex flex-col relative">
          {/* TOP BAR */}
          <header className="h-16 md:h-18 flex items-center px-4 md:px-6 lg:px-8 shrink-0 z-20 border-b border-gray-800/50 bg-[#0f111a]/90 backdrop-blur">
            <div className="md:hidden mr-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
                <Play className="w-4 h-4 text-white fill-current" />
              </div>
            </div>

            <div className="relative w-full max-w-xl lg:max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search Movies & TV..."
                className="w-full bg-[#161824] border border-gray-700/60 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-white placeholder-gray-500"
              />
            </div>

            <div className="ml-3 md:ml-4">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center text-sm font-bold cursor-pointer shadow-md shadow-pink-900/40">
                M
              </div>
            </div>
          </header>

          {/* PAGE CONTENT GOES HERE */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 pb-24 md:pb-12">
            {children}
          </div>

          {/* MOBILE BOTTOM NAV */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#131722]/95 backdrop-blur border-t border-gray-800/70 px-3 py-2">
            <div className="flex items-center justify-between gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={mobileNavItemClass(item.href)}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] font-medium leading-none">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </main>
      </body>
    </html>
  );
}
