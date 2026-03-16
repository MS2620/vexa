"use client";
import { useState, useEffect } from "react";
import { X, Loader2, Play, ChevronRight, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const [recentlyAdded, setRecentlyAdded] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [upcomingEpisodes, setUpcomingEpisodes] = useState<any[]>([]);
  const router = useRouter();
  const [recentRequests, setRecentRequests] = useState<any[]>([]);

  // Modal State
  const [selectedMedia, setSelectedMedia] = useState<any>(null);

  useEffect(() => {
    // Fetch all dashboard rows
    Promise.all([
      fetch("/api/dashboard/plex-recent").then((res) => res.json()),
      fetch("/api/dashboard/trending").then((res) => res.json()),
      fetch("/api/dashboard/watchlist").then((res) => res.json()),
      fetch("/api/dashboard/upcoming-episodes").then((res) => res.json()),
      fetch("/api/dashboard/requests").then((res) => res.json()),
    ]).then(
      ([plexData, trendingData, watchlistData, upcomingData, requestsData]) => {
        setRecentlyAdded(plexData.results || []);
        setTrending(trendingData.results || []);
        setWatchlist(watchlistData.results || []);
        setUpcomingEpisodes(upcomingData.results || []);
        setRecentRequests(requestsData.results || []);
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

  return (
    <>
      <div className="space-y-6 md:space-y-8 mt-4 md:mt-6 animate-in fade-in">
        {/** Shared carousel controls style applied per row */}

        {/* ROW 1: Recently Added */}
        <section className={sectionClass}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-100">Recently Added</h2>
            <Link
              href="/recently-added"
              className="text-gray-500 hover:text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
          <div className="relative">
            <button
              onClick={() => scrollCarousel("carousel-recent", "left")}
              className={`${navButtonClass} left-0.5 md:left-1`}
              aria-label="Scroll Recently Added left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollCarousel("carousel-recent", "right")}
              className={`${navButtonClass} right-0.5 md:right-1`}
              aria-label="Scroll Recently Added right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div id="carousel-recent" className={carouselClass}>
              {recentlyAdded.length > 0 ? (
                // Everything here is definitely on Plex
                recentlyAdded.map((media) => (
                  <PosterCard
                    key={`recent-${media.id}`}
                    media={media}
                    isAvailable={true}
                  />
                ))
              ) : (
                <div className="text-gray-500 text-sm py-8 px-4 bg-[#161824] rounded-xl border border-gray-800 w-full">
                  No recent media found in Plex.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ROW 2: Recent Requests */}
        <section className={sectionClass}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
              Recent Requests
            </h2>
            <a
              href="/requests"
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              View All →
            </a>
          </div>
          <div className="relative">
            <button
              onClick={() => scrollCarousel("carousel-requests", "left")}
              className={`${navButtonClass} left-0.5 md:left-1`}
              aria-label="Scroll Recent Requests left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollCarousel("carousel-requests", "right")}
              className={`${navButtonClass} right-0.5 md:right-1`}
              aria-label="Scroll Recent Requests right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div id="carousel-requests" className={carouselClass}>
              {recentRequests.length > 0 ? (
                recentRequests.map((req) => (
                  <RequestCard
                    key={req.id}
                    title={req.title}
                    year={req.requested_at?.substring(0, 4)}
                    user={req.requested_by}
                    status={req.status}
                    seasons={req.season ? [req.season] : undefined}
                    img={
                      req.poster_path
                        ? `https://image.tmdb.org/t/p/w500${req.poster_path}`
                        : ""
                    }
                  />
                ))
              ) : (
                <div className="text-gray-500 text-sm py-8 px-4 bg-[#161824] rounded-xl border border-gray-800 w-full">
                  No requests yet.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ROW 3: Your Watchlist */}
        <section className={sectionClass}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
              Your Watchlist <ChevronRight className="w-4 h-4 text-gray-500" />
            </h2>
          </div>
          <div className="relative">
            <button
              onClick={() => scrollCarousel("carousel-watchlist", "left")}
              className={`${navButtonClass} left-0.5 md:left-1`}
              aria-label="Scroll Watchlist left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollCarousel("carousel-watchlist", "right")}
              className={`${navButtonClass} right-0.5 md:right-1`}
              aria-label="Scroll Watchlist right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div id="carousel-watchlist" className={carouselClass}>
              {watchlist.length > 0 ? (
                watchlist.map((media) => (
                  <PosterCard
                    key={`watch-${media.id}`}
                    media={media}
                    isAvailable={true}
                  />
                ))
              ) : (
                <div className="text-gray-500 text-sm py-8 px-4 bg-[#161824] rounded-xl border border-gray-800 w-full">
                  No ongoing series found in your Plex TV library.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ROW 4: Trending */}
        <section className={sectionClass}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
              Upcoming Episodes{" "}
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </h2>
          </div>
          <div className="relative">
            <button
              onClick={() => scrollCarousel("carousel-upcoming", "left")}
              className={`${navButtonClass} left-0.5 md:left-1`}
              aria-label="Scroll Upcoming Episodes left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollCarousel("carousel-upcoming", "right")}
              className={`${navButtonClass} right-0.5 md:right-1`}
              aria-label="Scroll Upcoming Episodes right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div id="carousel-upcoming" className={carouselClass}>
              {upcomingEpisodes.length > 0 ? (
                upcomingEpisodes.map((episode) => (
                  <div
                    key={`${episode.tmdb_id}-${episode.season_number}-${episode.episode_number}`}
                    onClick={() => router.push(`/media/tv/${episode.tmdb_id}`)}
                    className="min-w-[280px] sm:min-w-[300px] md:min-w-[340px] bg-[#161824] border border-gray-800 rounded-xl p-4 flex gap-4 shrink-0 hover:border-gray-700 transition-colors cursor-pointer snap-start"
                  >
                    <div className="flex-1 flex flex-col">
                      <span className="text-xs text-indigo-300 mb-0.5">
                        {formatAirDate(episode.air_date)}
                      </span>
                      <h3 className="font-bold text-white leading-tight mb-1">
                        {episode.show_name}
                      </h3>
                      <p className="text-sm text-gray-300 mb-2 line-clamp-2">
                        {episode.episode_name}
                      </p>
                      <div className="mt-auto inline-flex items-center gap-2 text-xs text-gray-400">
                        <span className="px-2 py-0.5 rounded bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-bold">
                          S{String(episode.season_number).padStart(2, "0")}E
                          {String(episode.episode_number).padStart(2, "0")}
                        </span>
                      </div>
                    </div>
                    <div className="w-24 aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden shrink-0">
                      {episode.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w500${episode.poster_path}`}
                          alt={episode.show_name}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-sm py-8 px-4 bg-[#161824] rounded-xl border border-gray-800 w-full">
                  No upcoming episodes in the next 60 days from your watchlist.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ROW 5: Trending */}
        <section className={sectionClass}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
              Trending <ChevronRight className="w-4 h-4 text-gray-500" />
            </h2>
          </div>
          <div className="relative">
            <button
              onClick={() => scrollCarousel("carousel-trending", "left")}
              className={`${navButtonClass} left-0.5 md:left-1`}
              aria-label="Scroll Trending left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollCarousel("carousel-trending", "right")}
              className={`${navButtonClass} right-0.5 md:right-1`}
              aria-label="Scroll Trending right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div id="carousel-trending" className={carouselClass}>
              {trending.map((media) => {
                // Check if this TMDB item exists in our known Plex array
                const onPlex = recentlyAdded.some(
                  (plexItem) =>
                    (plexItem.title || plexItem.name) ===
                    (media.title || media.name),
                );
                return (
                  <PosterCard
                    key={`trending-${media.id}`}
                    media={media}
                    isAvailable={onPlex}
                  />
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* MODAL (Unchanged) */}
      {selectedMedia && (
        <div className="fixed inset-0 bg-[#0f111a]/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#161824] border border-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            {/* ... Modal content is identical ... */}
          </div>
        </div>
      )}
    </>
  );
}
