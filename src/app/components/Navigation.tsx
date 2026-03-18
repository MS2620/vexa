"use client";

import {
  Compass,
  Film,
  Tv,
  Clock,
  ShieldBan,
  Users,
  Settings,
  Play,
  Menu,
  X,
  Search,
  LogOut,
  ChevronRight,
  Calendar,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Logo from "./Logo";

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: string;
  } | null>(null);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsMobileSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileSearchOpen) {
      setMobileSearchQuery("");
    }
  }, [isMobileSearchOpen]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        setCurrentUser({
          username: data.username || "User",
          role: data.role || "user",
        });
      } catch {
        setCurrentUser(null);
      }
    };

    loadCurrentUser();
  }, []);

  const navItems = [
    { href: "/", label: "Discover", icon: Compass },
    { href: "/movies", label: "Movies", icon: Film },
    { href: "/series", label: "Series", icon: Tv },
    { href: "/calendar", label: "Calendar", icon: Calendar },
    { href: "/requests", label: "Requests", icon: Clock },
  ];

  const adminItems = [
    { href: "/blocklist", label: "Blocklist", icon: ShieldBan },
    { href: "/logs", label: "Logs", icon: Terminal },
    { href: "/users", label: "Users", icon: Users },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const isActivePath = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  const submitMobileSearch = () => {
    const query = mobileSearchQuery.trim();
    if (!query) return;

    router.push(`/search?q=${encodeURIComponent(query)}`);
    setIsMobileSearchOpen(false);
  };

  const username = currentUser?.username || "User";
  const role = currentUser?.role || "user";
  const userInitial = username.charAt(0).toUpperCase();
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  if (pathname === "/login" || pathname === "/setup") return null;

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-72 bg-[#0f111a] border-r border-white/5 flex-col h-screen fixed left-0 top-0 z-40 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <Logo />
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white leading-none">
                Vexa
              </span>
              <span className="text-[10px] font-medium text-indigo-400/80 tracking-widest uppercase mt-1">
                Control Panel
              </span>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Menu
              </div>
              <div className="space-y-1">
                {navItems.map((item) => {
                  const isActive = isActivePath(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                        isActive
                          ? "text-white bg-white/10 shadow-[0_1px_10px_-1px_rgba(255,255,255,0.1)] border border-white/5"
                          : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 transition-colors ${isActive ? "text-indigo-400" : "text-gray-500 group-hover:text-white"}`}
                      />
                      <span className="font-medium text-sm">{item.label}</span>
                      {isActive && (
                        <ChevronRight className="w-4 h-4 ml-auto text-indigo-400 opacity-50" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Admin
              </div>
              <div className="space-y-1">
                {adminItems.map((item) => {
                  const isActive = isActivePath(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                        isActive
                          ? "text-white bg-white/10 shadow-[0_1px_10px_-1px_rgba(255,255,255,0.1)] border border-white/5"
                          : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 transition-colors ${isActive ? "text-indigo-400" : "text-gray-500 group-hover:text-white"}`}
                      />
                      <span className="font-medium text-sm">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto p-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-full bg-linear-to-br from-pink-500 to-rose-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-pink-500/20 ring-2 ring-[#0f111a] group-hover:ring-white/10 transition-all">
              {userInitial}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-white truncate">
                {username}
              </span>
              <span className="text-xs text-gray-400 truncate">
                {roleLabel}
              </span>
            </div>
            <LogOut className="w-4 h-4 text-gray-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#0f111a]/80 backdrop-blur-xl border-b border-white/5 z-50 flex items-center justify-between px-4 transition-all duration-300">
        <div className="flex items-center gap-3">
          <Logo className="w-8 h-8 rounded-lg" iconClassName="w-4 h-4" />
          <span className="font-bold text-lg text-white">Vexa</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              setIsMobileSearchOpen(true);
            }}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 border border-white/5 hover:bg-white/10"
            aria-label="Open search"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setIsMobileSearchOpen(false);
              setIsMobileMenuOpen(true);
            }}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 border border-white/5 hover:bg-white/10"
            aria-label="Open navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 border border-white/5 hover:bg-white/10"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <Link
            href="/settings"
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 border border-white/5 hover:bg-white/10"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* MOBILE SEARCH OVERLAY */}
      {isMobileSearchOpen && (
        <div
          className="md:hidden fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsMobileSearchOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#161824] border border-white/10 rounded-xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border border-white/10 rounded-lg px-3 py-2 bg-[#0f111a]">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                autoFocus
                type="text"
                value={mobileSearchQuery}
                onChange={(e) => setMobileSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    submitMobileSearch();
                  }
                }}
                placeholder="Search movies, series, people..."
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none"
              />
              <button
                onClick={() => setIsMobileSearchOpen(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={submitMobileSearch}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE NAV MENU */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-start justify-end p-4 pt-20"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="w-full max-w-xs bg-[#161824] border border-white/10 rounded-xl p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 mb-2 border-b border-white/10">
              <p className="text-sm font-semibold text-white truncate">
                {username}
              </p>
              <p className="text-xs text-gray-400 truncate">{roleLabel}</p>
            </div>

            <div className="space-y-1">
              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(item.href);
                return (
                  <Link
                    key={`mobile-admin-${item.href}`}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "text-white bg-white/10 border border-white/10"
                        : "text-gray-300 hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0f111a]/90 backdrop-blur-xl border-t border-white/10 pb-safe safe-area-pb">
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const isActive = isActivePath(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-300 ${
                  isActive
                    ? "text-indigo-400"
                    : "text-gray-500 hover:text-white"
                }`}
              >
                <div
                  className={`p-1 rounded-lg transition-all ${isActive ? "bg-indigo-500/10" : ""}`}
                >
                  <Icon
                    className={`w-5 h-5 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`}
                  />
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Spacer for fixed navs */}
      <div className="md:hidden h-20" />
    </>
  );
}
