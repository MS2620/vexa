"use client";
import "./globals.css";
import Navigation from "./components/Navigation";
import { Search, Bell } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useState, useEffect, useRef } from "react";
import { Toaster } from "react-hot-toast";

type PendingRequestNotification = {
  id: string | number;
  type?: "request" | "automation";
  title: string;
  subtitle?: string;
  created_at?: string;
  target_path?: string;
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [pendingNotifications, setPendingNotifications] = useState<
    PendingRequestNotification[]
  >([]);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  const getPageTitle = (path: string) => {
    if (path.startsWith("/media/")) return "Media Details";

    const titles: Record<string, string> = {
      "/": "Discover",
      "/movies": "Movies",
      "/series": "Series",
      "/calendar": "Calendar",
      "/requests": "Requests",
      "/search": "Search",
      "/settings": "Settings",
      "/users": "Users",
      "/logs": "Logs",
      "/blocklist": "Blocklist",
      "/login": "Login",
      "/setup": "Setup",
      "/api": "API",
    };

    return titles[path] ?? "Control Panel";
  };

  useEffect(() => {
    document.title = `${getPageTitle(pathname)} • Vexa`;
  }, [pathname]);

  const fetchNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const res = await fetch("/api/dashboard/requests?status=pending", {
        cache: "no-store",
      });
      const data = await res.json();
      setPendingNotifications(data.results || []);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      setPendingNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const intervalId = setInterval(() => {
      fetchNotifications();
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // When navigating away from /search, clear the search bar
  useEffect(() => {
    if (!pathname.startsWith("/search")) {
      setSearchQuery("");
    }
  }, [pathname]);

  // Handle scroll effect for header
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (value.length >= 3) {
      router.push(`/search?q=${encodeURIComponent(value)}`);
    } else if (value.length === 0) {
      router.push("/");
    }
  };

  // Plain layout for auth pages
  if (pathname === "/login" || pathname === "/setup") {
    return (
      <html lang="en">
        <head>
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link rel="shortcut icon" href="/favicon.ico" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        </head>
        <body className="bg-[#0f111a] text-white font-sans">
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#161824",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.1)",
              },
            }}
          />
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="bg-[#0f111a] text-white font-sans min-h-screen">
        <Navigation />

        {/* MAIN CONTENT WRAPPER */}
        <main className="md:pl-72 flex flex-col min-h-screen pt-16 md:pt-0 transition-all duration-300">
          {/* DESKTOP HEADER */}
          <header
            className={`hidden md:flex items-center justify-between px-8 py-4 sticky top-0 z-30 transition-all duration-300 ${scrolled ? "bg-[#0f111a]/90 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20" : "bg-transparent"}`}
          >
            <div className="relative w-full max-w-xl group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search movies, series, people..."
                className="w-full bg-[#161824] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-[#1b1e2b] transition-all text-white placeholder-gray-500 shadow-inner"
              />
            </div>

            <div className="flex items-center gap-4 ml-6" ref={notificationRef}>
              <button
                onClick={() => setIsNotificationsOpen((previous) => !previous)}
                className="relative p-2.5 rounded-full hover:bg-white/5 transition-colors text-gray-400 hover:text-white border border-transparent hover:border-white/5"
              >
                <Bell className="w-5 h-5" />
                {pendingNotifications.length > 0 && (
                  <span className="absolute top-2.5 right-3 w-2 h-2 rounded-full bg-indigo-500 border border-[#0f111a]"></span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 max-w-[90vw] bg-[#161824] border border-white/10 rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <h3 className="text-sm font-semibold text-white">
                      Notifications
                    </h3>
                    <span className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                      {pendingNotifications.length} alerts
                    </span>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {notificationsLoading ? (
                      <p className="text-sm text-gray-400 px-4 py-4">
                        Loading notifications...
                      </p>
                    ) : pendingNotifications.length === 0 ? (
                      <p className="text-sm text-gray-400 px-4 py-4">
                        No notifications right now.
                      </p>
                    ) : (
                      pendingNotifications.slice(0, 8).map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => {
                            setIsNotificationsOpen(false);
                            router.push(
                              notification.target_path || "/requests",
                            );
                          }}
                          className="w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-white truncate">
                              {notification.title}
                            </p>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${
                                notification.type === "automation"
                                  ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                                  : "text-indigo-300 bg-indigo-500/10 border-indigo-500/20"
                              }`}
                            >
                              {notification.type === "automation"
                                ? "Automation"
                                : "Request"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {notification.subtitle || "Notification"}
                          </p>
                        </button>
                      ))
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setIsNotificationsOpen(false);
                      router.push("/requests");
                    }}
                    className="w-full py-2.5 text-sm text-indigo-300 hover:text-white hover:bg-indigo-500/10 transition-colors border-t border-white/10"
                  >
                    View all requests
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* PAGE CONTENT */}
          <div className="flex-1 px-4 md:px-8 pb-24 md:pb-12 animate-in fade-in duration-500">
            {children}
          </div>
        </main>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#161824",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.1)",
            },
          }}
        />
      </body>
    </html>
  );
}
