"use client";
import "./globals.css";
import Navigation from "./Navigation";
import { Search, Bell } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { Toaster } from "react-hot-toast";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);

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

            <div className="flex items-center gap-4 ml-6">
              <button className="relative p-2.5 rounded-full hover:bg-white/5 transition-colors text-gray-400 hover:text-white border border-transparent hover:border-white/5">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2.5 right-3 w-2 h-2 rounded-full bg-indigo-500 border border-[#0f111a]"></span>
              </button>
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
