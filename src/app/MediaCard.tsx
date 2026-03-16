"use client";

import { Play, Calendar, Star, Check, Clock, Film } from "lucide-react";
import { useRouter } from "next/navigation";

interface MediaCardProps {
  media: any;
  type?: "poster" | "wide";
  isAvailable?: boolean;
  status?: string;
  user?: string;
  onClick?: () => void;
  className?: string;
}

export default function MediaCard({
  media,
  type = "poster",
  isAvailable = false,
  status,
  user,
  onClick,
  className,
}: MediaCardProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }

    // Default navigation logic
    const mediaType =
      media.media_type || (media.first_air_date ? "tv" : "movie");
    const id = media.tmdb_id || media.id;
    if (id) {
      router.push(`/media/${mediaType}/${id}`);
    }
  };

  const title = media.title || media.name || media.show_name;
  const date = media.release_date || media.first_air_date || media.air_date;
  const year = date ? new Date(date).getFullYear() : "";

  const imageUrl = media.poster_path
    ? media.poster_path.startsWith("http")
      ? media.poster_path
      : `https://image.tmdb.org/t/p/w500${media.poster_path}`
    : null;

  if (type === "wide") {
    return (
      <div
        onClick={handleClick}
        className="group min-w-[280px] sm:min-w-[300px] md:min-w-[340px] bg-[#161824]/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex gap-4 shrink-0 hover:bg-white/5 hover:border-white/10 hover:shadow-xl hover:shadow-indigo-500/5 transition-all cursor-pointer snap-start"
      >
        <div className="flex-1 flex flex-col relative z-10">
          <span className="text-xs font-medium text-indigo-300 mb-1 flex items-center gap-1.5">
            <Calendar className="w-3 h-3" /> {year}
          </span>
          <h3 className="font-bold text-white leading-tight mb-1 text-base group-hover:text-indigo-200 transition-colors line-clamp-2">
            {title}
          </h3>

          {media.episode_name && (
            <p className="text-sm text-gray-400 mb-2 line-clamp-1">
              {media.episode_name}
            </p>
          )}

          {user && (
            <div className="flex items-center gap-2 mb-3 mt-1">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 text-[9px] flex items-center justify-center font-bold text-white ring-1 ring-white/10">
                {user.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-gray-400 font-medium">{user}</span>
            </div>
          )}

          <div className="mt-auto flex items-center gap-2">
            {status && (
              <span
                className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider ${
                  status === "Available"
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                }`}
              >
                {status}
              </span>
            )}

            {media.season_number && (
              <span className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-gray-300 font-bold text-[10px]">
                S{String(media.season_number).padStart(2, "0")}E
                {String(media.episode_number).padStart(2, "0")}
              </span>
            )}
          </div>
        </div>

        <div className="w-24 aspect-[2/3] bg-gray-800 rounded-xl overflow-hidden shrink-0 relative shadow-lg group-hover:shadow-indigo-500/20 transition-all">
          {imageUrl ? (
            <img
              src={imageUrl}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <Play className="w-8 h-8 text-gray-700" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Poster Style
  return (
    <div
      onClick={handleClick}
      className={`group cursor-pointer relative snap-start ${className || "w-[140px] sm:w-[155px] md:w-[180px] shrink-0"}`}
    >
      <div className="relative w-full aspect-[2/3] bg-[#161824] rounded-2xl overflow-hidden shadow-lg shadow-black/20 group-hover:shadow-indigo-500/20 transition-all duration-300 ring-1 ring-white/5 group-hover:ring-indigo-500/50">
        {/* Type Badge */}
        {(media.media_type || media.first_air_date) && (
          <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md border border-white/10 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow-sm z-20 uppercase tracking-wider">
            {media.media_type === "tv" || media.first_air_date
              ? "Series"
              : "Movie"}
          </div>
        )}

        {/* Availability Badge */}
        {isAvailable && (
          <div className="absolute top-2.5 right-2.5 bg-green-500 text-white w-5 h-5 flex items-center justify-center rounded-full shadow-lg shadow-green-900/20 z-20 ring-2 ring-black/20">
            <Check className="w-3 h-3 stroke-[4px]" />
          </div>
        )}

        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 text-center p-2 text-sm bg-gray-900">
            <Film className="w-8 h-8 mb-2 opacity-50" />
            <span className="opacity-50">{title}</span>
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
          <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-3 text-white ring-1 ring-white/20 hover:bg-white/20 hover:scale-110 transition-all">
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </div>
            <p className="text-white text-sm font-bold truncate text-center">
              {title}
            </p>
            <p className="text-gray-300 text-xs text-center font-medium mt-0.5">
              {year}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
