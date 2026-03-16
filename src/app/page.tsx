"use client";
import { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft, Play, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MediaCard from "./MediaCard";

export default function Dashboard() {
  const [recentlyAdded, setRecentlyAdded] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [heroItem, setHeroItem] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Fetch all dashboard rows
    Promise.all([
      fetch("/api/dashboard/plex-recent").then((res) => res.json()),
      fetch("/api/dashboard/trending").then((res) => res.json()),
      fetch("/api/dashboard/watchlist").then((res) => res.json()),
      fetch("/api/dashboard/requests").then((res) => res.json()),
    ]).then(
      ([plexData, trendingData, watchlistData, requestsData]) => {
        setRecentlyAdded(plexData.results || []);
        const trendingResults = trendingData.results || [];
        setTrending(trendingResults);
        setWatchlist(watchlistData.results || []);
        setRecentRequests(requestsData.results || []);

        if (trendingResults.length > 0) {
            const random = trendingResults[Math.floor(Math.random() * Math.min(5, trendingResults.length))];
            setHeroItem(random);
        }
      },
    );
  }, []);


  const formatAirDate = (airDate: string) => {
    const date = new Date(`${airDate}T00:00:00.000Z`);
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const scrollCarousel = (id: string, direction: "left" | "right") => {
    const el = document.getElementById(id);
    if (!el) return;

    const amount = Math.max(320, Math.floor(el.clientWidth * 0.8));
    el.scrollBy({
      left: direction === "right" ? amount : -amount,
      behavior: "smooth",
    });
  };

  const sectionClass =
    "rounded-2xl border border-gray-800/70 bg-[#131722]/55 p-3 sm:p-4 md:p-5";
  const carouselClass =
    "flex gap-3 md:gap-4 overflow-x-auto pb-2 px-9 md:px-11 scrollbar-hide snap-x snap-mandatory scroll-smooth touch-pan-x overscroll-x-contain";
  const navButtonClass =
    "flex absolute top-1/2 -translate-y-1/2 z-20 w-8 h-8 md:w-10 md:h-10 items-center justify-center rounded-full border border-gray-600/80 bg-[#0b1020]/90 text-white hover:bg-[#1b2440] shadow-lg shadow-black/40";

  // Standard Poster Card
  const PosterCard = ({
    media,
    isAvailable = false,
  }: {
    media: any;
    isAvailable?: boolean;
  }) => {
    const isTv = media.media_type === "tv" || media.first_air_date;
    const imageUrl = media.isPlex
      ? media.poster_path
      : media.poster_path
        ? `https://image.tmdb.org/t/p/w500${media.poster_path}`
        : null;

    return (
      <div
        onClick={() =>
          router.push(
            `/media/${media.media_type || (media.first_air_date ? "tv" : "movie")}/${media.id}`,
          )
        }
        className="w-[140px] sm:w-[155px] md:w-[180px] shrink-0 rounded-xl overflow-hidden cursor-pointer relative group transition-transform hover:scale-[1.02] snap-start"
      >
        <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg z-10 uppercase tracking-wider">
          {isTv ? "Series" : "Movie"}
        </div>

        {/* DYNAMIC GREEN TICK: Only shows if isAvailable is true */}
        {isAvailable && (
          <div className="absolute top-2 right-2 bg-green-500/90 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-lg z-10">
            ✓
          </div>
        )}

        <div className="relative w-full aspect-[2/3] bg-[#161824] border border-gray-800/50 rounded-xl overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={media.title || media.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-center p-2 text-sm">
              {media.title || media.name}
            </div>
          )}

          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
            <Play className="w-10 h-10 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-lg" />
            <p className="text-white text-sm font-bold truncate">
              {media.title || media.name}
            </p>
            <p className="text-gray-300 text-xs">
              {(media.release_date || media.first_air_date)?.substring(0, 4)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Wide Request Card (Matches the second row in your image)
  const RequestCard = ({ title, year, user, status, seasons, img }: any) => (
    <div className="min-w-[280px] sm:min-w-[300px] md:min-w-[340px] bg-[#161824] border border-gray-800 rounded-xl p-4 flex gap-4 shrink-0 hover:border-gray-700 transition-colors cursor-pointer snap-start">
      <div className="flex-1 flex flex-col">
        <span className="text-xs text-gray-400 mb-0.5">{year}</span>
        <h3 className="font-bold text-white leading-tight mb-2">{title}</h3>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded-full bg-pink-600 text-[8px] flex items-center justify-center font-bold text-white">
            {user?.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs text-gray-400">{user}</span>
        </div>
        {seasons && seasons.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-400">Seasons</span>
            <div className="flex gap-1 flex-wrap">
              {seasons.map((s: number) => (
                <div
                  key={s}
                  className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white"
                >
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">Status</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
              status === "Available"
                ? "bg-green-600/30 text-green-400 border border-green-500/30"
                : "bg-indigo-600/30 text-indigo-400 border border-indigo-500/30"
            }`}
          >
            {status}
          </span>
        </div>
      </div>
      <div className="w-24 aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden shrink-0">
        {img && <img src={img} className="w-full h-full object-cover" />}
      </div>
    </div>
  );

  const sectionHeaderClass = "flex items-center justify-between mb-4 px-1";
  const sectionTitleClass = "text-xl font-bold text-white flex items-center gap-2";

  return (
    <div className="space-y-10 pb-10">
      
      {/* HERO SECTION */}
      {heroItem && (
        <div className="relative w-full aspect-[2/1] md:aspect-[2.5/1] lg:aspect-[3/1] rounded-3xl overflow-hidden shadow-2xl shadow-black/50 group mt-4">
            <div className="absolute inset-0">
                <img 
                    src={`https://image.tmdb.org/t/p/original${heroItem.backdrop_path || heroItem.poster_path}`} 
                    alt={heroItem.title || heroItem.name}
                    className="w-full h-full object-cover"
                />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f111a] via-[#0f111a]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0f111a] via-[#0f111a]/40 to-transparent" />
            
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
                        onClick={() => router.push(`/media/${heroItem.media_type || "movie"}/${heroItem.id}`)}
                        className="px-6 py-3 rounded-xl bg-white text-black font-bold flex items-center gap-2 hover:bg-gray-200 transition-colors"
                    >
                        <Play className="w-5 h-5 fill-current" />
                        Details
                    </button>
                    <button className="px-6 py-3 rounded-xl bg-white/10 backdrop-blur-md text-white font-bold flex items-center gap-2 hover:bg-white/20 transition-colors border border-white/10">
                        <Info className="w-5 h-5" />
                        More Info
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* ROW 1: Recently Added */}
      <section className="relative group">
        <div className={sectionHeaderClass}>
          <h2 className={sectionTitleClass}>Recently Added</h2>
          <Link href="/recently-added" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1">
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        
        <button onClick={() => scrollCarousel("carousel-recent", "left")} className={`${navButtonClass} -left-4`}>
            <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={() => scrollCarousel("carousel-recent", "right")} className={`${navButtonClass} -right-4`}>
            <ChevronRight className="w-5 h-5" />
        </button>
        
        <div id="carousel-recent" className={carouselClass}>
            {recentlyAdded.length > 0 ? (
            recentlyAdded.map((media) => (
                <MediaCard
                key={`recent-${media.id}`}
                media={media}
                isAvailable={true}
                />
            ))
            ) : (
            <div className="text-gray-500 text-sm italic w-full text-center py-10 border border-dashed border-gray-800 rounded-xl">
                No recent media found in Plex.
            </div>
            )}
        </div>
      </section>

      {/* ROW 2: Recent Requests */}
      <section className="relative group">
        <div className={sectionHeaderClass}>
          <h2 className={sectionTitleClass}>Recent Requests</h2>
          <Link href="/requests" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1">
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <button onClick={() => scrollCarousel("carousel-requests", "left")} className={`${navButtonClass} -left-4`}>
            <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={() => scrollCarousel("carousel-requests", "right")} className={`${navButtonClass} -right-4`}>
            <ChevronRight className="w-5 h-5" />
        </button>

        <div id="carousel-requests" className={carouselClass}>
            {recentRequests.length > 0 ? (
            recentRequests.map((req) => (
                <MediaCard
                key={`req-${req.id}`}
                media={req}
                type="wide"
                status={req.status}
                user={req.requested_by}
                />
            ))
            ) : (
            <div className="text-gray-500 text-sm italic w-full text-center py-10 border border-dashed border-gray-800 rounded-xl">
                No requests yet.
            </div>
            )}
        </div>
      </section>



      {/* ROW 4: Watchlist */}
      <section className="relative group">
        <div className={sectionHeaderClass}>
          <h2 className={sectionTitleClass}>Your Watchlist</h2>
        </div>
        
        <button onClick={() => scrollCarousel("carousel-watchlist", "left")} className={`${navButtonClass} -left-4`}>
            <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={() => scrollCarousel("carousel-watchlist", "right")} className={`${navButtonClass} -right-4`}>
            <ChevronRight className="w-5 h-5" />
        </button>

        <div id="carousel-watchlist" className={carouselClass}>
            {watchlist.length > 0 ? (
            watchlist.map((media) => (
                <MediaCard
                key={`watch-${media.id}`}
                media={media}
                isAvailable={true}
                />
            ))
            ) : (
            <div className="text-gray-500 text-sm italic w-full text-center py-10 border border-dashed border-gray-800 rounded-xl">
                Your watchlist is empty.
            </div>
            )}
        </div>
      </section>

      {/* ROW 5: Trending */}
      <section className="relative group">
        <div className={sectionHeaderClass}>
          <h2 className={sectionTitleClass}>Trending Now</h2>
        </div>
        
        <button onClick={() => scrollCarousel("carousel-trending", "left")} className={`${navButtonClass} -left-4`}>
            <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={() => scrollCarousel("carousel-trending", "right")} className={`${navButtonClass} -right-4`}>
            <ChevronRight className="w-5 h-5" />
        </button>

        <div id="carousel-trending" className={carouselClass}>
            {trending.map((media) => {
            const onPlex = recentlyAdded.some(
                (plexItem) =>
                (plexItem.title || plexItem.name) ===
                (media.title || media.name),
            );
            return (
                <MediaCard
                key={`trending-${media.id}`}
                media={media}
                isAvailable={onPlex}
                />
            );
            })}
        </div>
      </section>
    </div>
  );
}
