"use client";

import { ChevronDown, ChevronUp, Film } from "lucide-react";
import Image from "next/image";
import { AvailabilityBadge } from "./Badge";
import { SeasonData } from "@/lib/types";

type SeasonsListProps = {
  seasons: SeasonData[];
  plexAvailability: Record<string | number, string>;
  expandedSeasons: Record<number, boolean>;
  toggleSeason: (seasonNum: number) => void;
  openStreamModal: (season?: number, episode?: number) => void;
};

export default function SeasonsList({
  seasons,
  plexAvailability,
  expandedSeasons,
  toggleSeason,
  openStreamModal,
}: SeasonsListProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Seasons</h2>
        <span className="text-sm font-medium text-gray-400 bg-white/5 px-3 py-1 rounded-full">
          {seasons.length} Total
        </span>
      </div>
      <div className="space-y-4">
        {seasons.map((season) => {
          const seasonStatus =
            plexAvailability[season.season_number] || "unavailable";
          const isExpanded = expandedSeasons[season.season_number];
          const episodeCount = season.episode_count || 0;

          return (
            <div
              key={season.season_number}
              className="bg-[#161824] border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 ring-1 ring-black/5"
            >
              <div
                className="flex flex-col sm:flex-row sm:items-center justify-between p-5 cursor-pointer hover:bg-white/5 transition-colors gap-4"
                onClick={() => toggleSeason(season.season_number)}
              >
                <div className="flex items-center gap-5">
                  {season.poster_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w200${season.poster_path}`}
                      className="hidden sm:block w-12 h-16 rounded-md object-cover shadow-md"
                      alt={`Season ${season.season_number}`}
                      width={48}
                      height={64}
                    />
                  ) : (
                    <div className="hidden sm:flex w-12 h-16 rounded-md bg-gray-800 items-center justify-center border border-gray-700">
                      <Film className="w-5 h-5 opacity-30" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">
                      Season {season.season_number}
                    </h3>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-medium text-gray-400">
                        {episodeCount} Episodes
                      </span>
                      {season.air_date && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-gray-400">
                            {new Date(season.air_date).getFullYear()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                  <AvailabilityBadge status={seasonStatus} />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openStreamModal(season.season_number, 1);
                      }}
                      className="text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-lg hover:bg-indigo-500/20 transition-colors uppercase tracking-wide opacity-0 group-hover:opacity-100 sm:opacity-100"
                    >
                      Get Season
                    </button>
                    <div className="p-2 bg-black/20 rounded-lg">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {isExpanded && (
                <div className="bg-black/20 border-t border-white/5 divide-y divide-white/5">
                  {Array.from({ length: episodeCount }, (_, i) => i + 1).map(
                    (ep) => (
                      <div
                        key={ep}
                        className="flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors group"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-bold text-gray-500 w-6">
                            {ep.toString().padStart(2, "0")}
                          </span>
                          <span className="text-sm font-medium text-gray-200 group-hover:text-indigo-300 transition-colors">
                            Episode {ep}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            openStreamModal(season.season_number, ep)
                          }
                          className="opacity-0 group-hover:opacity-100 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md font-medium transition-all transform translate-x-2 group-hover:translate-x-0"
                        >
                          Get Episode
                        </button>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
