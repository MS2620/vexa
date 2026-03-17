"use client";

import Image from "next/image";
import { Clock, MonitorPlay, Play, Star } from "lucide-react";
import { AvailabilityBadge, Badge } from "./Badge";
import { MediaDetail } from "@/lib/types";

type MediaHeroProps = {
  backdropUrl: string | null;
  posterUrl: string | null;
  title: string;
  year?: string;
  overallStatus: string;
  detail: MediaDetail;
  type: string;
  genres?: string[];
  onRequestClick: () => void;
};

export default function MediaHero({
  backdropUrl,
  posterUrl,
  title,
  year,
  overallStatus,
  detail,
  type,
  genres,
  onRequestClick,
}: MediaHeroProps) {
  const voteAverage = detail.vote_average ?? 0;

  return (
    <div className="relative -mt-4 lg:-mt-8 -mx-4 md:-mx-8 mb-8 lg:mb-16">
      <div className="relative w-full h-[35vh] lg:h-[85vh] min-h-125 overflow-hidden bg-[#0f111a] -mt-12 md:mt-4 lg:mt-8">
        {backdropUrl ? (
          <Image
            width={1280}
            height={720}
            src={backdropUrl}
            className="w-full h-full object-cover object-[center_15%]"
            alt={title}
          />
        ) : (
          <div className="w-full h-full bg-linear-to-br from-indigo-900/20 to-gray-900" />
        )}
        <div className="absolute inset-0 bg-linear-to-r from-[#0f111a] via-[#0f111a]/80 lg:via-[#0f111a]/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-[#0f111a] to-transparent" />
      </div>

      <div className="absolute inset-0 flex flex-col lg:flex-row items-end lg:items-center px-6 md:px-12 pb-8 lg:pb-0 z-10 mx-auto max-w-7xl pt-24">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 w-full items-start">
          {posterUrl && (
            <div className="hidden lg:block w-56 xl:w-72 shrink-0 rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border border-white/10 ring-1 ring-black/20 group transform hover:scale-[1.02] transition-transform duration-500">
              <Image
                src={posterUrl}
                width={288}
                height={432}
                className="w-full h-full object-cover"
                alt={`${title} Poster`}
              />
            </div>
          )}

          <div className="flex flex-col justify-end w-full lg:mb-6">
            <div className="flex flex-wrap gap-2 mb-4">
              {overallStatus && <AvailabilityBadge status={overallStatus} />}
              {detail.status && (
                <Badge className="bg-white/5 text-gray-300 border-white/10">
                  {detail.status}
                </Badge>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black text-white leading-tight mb-2 drop-shadow-lg">
              {title}{" "}
              <span className="text-white/50 font-normal">({year})</span>
            </h1>

            {detail.tagline && (
              <p className="text-lg lg:text-xl text-indigo-200/80 italic mb-5 font-light max-w-3xl">
                &quot;{detail.tagline}&quot;
              </p>
            )}

            <div className="flex items-center gap-4 text-sm text-gray-300 mb-6 flex-wrap font-medium">
              {detail.content_ratings?.results?.[0]?.rating && (
                <span className="flex items-center justify-center px-2 py-0.5 rounded bg-white/10 border border-white/20 text-white font-bold">
                  {detail.content_ratings.results[0].rating}
                </span>
              )}
              {type === "tv" && detail.number_of_seasons && (
                <span className="flex items-center gap-1.5">
                  <MonitorPlay className="w-4 h-4 opacity-70" />{" "}
                  {detail.number_of_seasons} Seasons
                </span>
              )}
              {detail.runtime && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 opacity-70" /> {detail.runtime} min
                </span>
              )}
              {voteAverage > 0 && (
                <span className="flex items-center gap-1.5 text-yellow-500">
                  <Star className="w-4 h-4 fill-current" />{" "}
                  {voteAverage.toFixed(1)}
                </span>
              )}
            </div>

            <div className="flex gap-2 mb-6 flex-wrap">
              {genres?.map((genre: string) => (
                <span
                  key={genre}
                  className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-gray-300 backdrop-blur-sm"
                >
                  {genre}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-3 flex-wrap mt-2">
              {(overallStatus === "available" ||
                overallStatus === "partial") && (
                <button className="flex items-center gap-2 bg-linear-to-r from-[#e5a00d] to-[#f5b324] hover:from-[#d4940c] hover:to-[#e5a00d] text-black font-extrabold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-yellow-900/20">
                  <Play className="w-5 h-5 fill-current" /> Play on Plex
                </button>
              )}
              <button
                onClick={onRequestClick}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-indigo-900/40 border border-indigo-500/50"
              >
                <Play className="w-5 h-5 fill-white" />{" "}
                {type === "movie" ? "Request Movie" : "Request Episode"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
