"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MediaCard from "./components/MediaCard";
import CarouselSection from "./components/CarouselSection";
import DiscoverHero from "./components/DiscoverHero";

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
    ]).then(([plexData, trendingData, watchlistData, requestsData]) => {
      setRecentlyAdded(plexData.results || []);
      const trendingResults = trendingData.results || [];
      setTrending(trendingResults);
      setWatchlist(watchlistData.results || []);
      setRecentRequests(requestsData.results || []);

      if (trendingResults.length > 0) {
        const random =
          trendingResults[
            Math.floor(Math.random() * Math.min(5, trendingResults.length))
          ];
        setHeroItem(random);
      }
    });
  }, []);

  const scrollCarousel = (id: string, direction: "left" | "right") => {
    const el = document.getElementById(id);
    if (!el) return;

    const amount = Math.max(320, Math.floor(el.clientWidth * 0.8));
    el.scrollBy({
      left: direction === "right" ? amount : -amount,
      behavior: "smooth",
    });
  };

  const carouselClass =
    "flex gap-3 md:gap-4 overflow-x-auto pt-4 pb-6 px-9 md:px-11 scrollbar-hide snap-x snap-mandatory scroll-smooth touch-pan-x overscroll-x-contain";
  const navButtonClass =
    "flex absolute top-1/2 -translate-y-1/2 z-20 w-8 h-8 md:w-10 md:h-10 items-center justify-center rounded-full border border-gray-600/80 bg-[#0b1020]/90 text-white hover:bg-[#1b2440] shadow-lg shadow-black/40";
  const sectionClass = "relative group";
  const sectionHeaderClass = "flex items-center justify-between mb-4 px-1";
  const sectionTitleClass =
    "text-xl font-bold text-white flex items-center gap-2";

  return (
    <div className="space-y-10 pb-10">
      <DiscoverHero
        heroItem={heroItem}
        onDetails={() =>
          router.push(`/media/${heroItem.media_type || "movie"}/${heroItem.id}`)
        }
      />

      <CarouselSection
        title="Recently Added"
        carouselId="carousel-recent"
        onScroll={scrollCarousel}
        viewAllHref="/recently-added"
        sectionClassName={sectionClass}
        headerClassName={sectionHeaderClass}
        titleClassName={sectionTitleClass}
        carouselClassName={carouselClass}
        navButtonClassName={navButtonClass}
      >
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
      </CarouselSection>

      <CarouselSection
        title="Recent Requests"
        carouselId="carousel-requests"
        onScroll={scrollCarousel}
        viewAllHref="/requests"
        sectionClassName={sectionClass}
        headerClassName={sectionHeaderClass}
        titleClassName={sectionTitleClass}
        carouselClassName={carouselClass}
        navButtonClassName={navButtonClass}
      >
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
      </CarouselSection>

      <CarouselSection
        title="Your Watchlist"
        carouselId="carousel-watchlist"
        onScroll={scrollCarousel}
        sectionClassName={sectionClass}
        headerClassName={sectionHeaderClass}
        titleClassName={sectionTitleClass}
        carouselClassName={carouselClass}
        navButtonClassName={navButtonClass}
      >
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
      </CarouselSection>

      <CarouselSection
        title="Trending Now"
        carouselId="carousel-trending"
        onScroll={scrollCarousel}
        sectionClassName={sectionClass}
        headerClassName={sectionHeaderClass}
        titleClassName={sectionTitleClass}
        carouselClassName={carouselClass}
        navButtonClassName={navButtonClass}
      >
        {trending.map((media) => {
          const onPlex = recentlyAdded.some(
            (plexItem) =>
              (plexItem.title || plexItem.name) === (media.title || media.name),
          );
          return (
            <MediaCard
              key={`trending-${media.id}`}
              media={media}
              isAvailable={onPlex}
            />
          );
        })}
      </CarouselSection>
    </div>
  );
}
