"use client";

import { Play } from "lucide-react";
import Image from "next/image";

interface DiscoverHeroProps {
  heroItem: any;
  onDetails: () => void;
  className?: string;
}

export default function DiscoverHero({
  heroItem,
  onDetails,
  className = "-mt-12 md:mt-2 lg:mt-0",
}: DiscoverHeroProps) {
  if (!heroItem) return null;

  return (
    <div
      className={`relative w-full aspect-2/1 md:aspect-2.5/1 lg:aspect-3/1 rounded-3xl overflow-hidden shadow-2xl shadow-black/50 group ${className}`}
    >
      <div className="absolute inset-0">
        <Image
          width={1280}
          height={720}
          src={`https://image.tmdb.org/t/p/original${heroItem.backdrop_path || heroItem.poster_path}`}
          alt={heroItem.title || heroItem.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-linear-to-t from-[#0f111a] via-[#0f111a]/60 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-r from-[#0f111a] via-[#0f111a]/40 to-transparent" />

      <div className="absolute bottom-0 left-0 p-6 md:p-10 w-full md:w-2/3 lg:w-1/2">
        <span className="inline-block px-3 py-1 rounded-full bg-indigo-600/80 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider mb-4 border border-indigo-500/50">
          Featured
        </span>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 leading-tight">
          {heroItem.title || heroItem.name}
        </h1>
        <p className="text-gray-300 text-sm md:text-base line-clamp-2 md:line-clamp-3 mb-6 max-w-xl">
          {heroItem.overview}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={onDetails}
            className="px-6 py-3 rounded-xl bg-white/10 backdrop-blur-md text-white font-bold flex items-center gap-2 hover:bg-white/20 transition-colors border border-white/10 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            Details
          </button>
        </div>
      </div>
    </div>
  );
}
