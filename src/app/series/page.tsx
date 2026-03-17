"use client";
import { useState, useEffect } from "react";
import { Loader2, Filter, SortDesc, ChevronDown } from "lucide-react";
import MediaCard from "../components/MediaCard";

export default function SeriesPage() {
  const [series, setSeries] = useState<any[]>([]);

  // Pagination State
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("popularity.desc");
  const [minVote, setMinVote] = useState("0");
  const [genre, setGenre] = useState("");
  const [year, setYear] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1979 }, (_, idx) =>
    String(currentYear - idx),
  );

  // Fetch movies when 'page' state changes
  useEffect(() => {
    const fetchSeries = async () => {
      if (page === 1) setLoadingInitial(true);
      else setLoadingMore(true);

      try {
        const params = new URLSearchParams({
          page: String(page),
          sort_by: sortBy,
          min_vote: minVote,
          genre,
          year,
        });
        const res = await fetch(`/api/series?${params.toString()}`);
        const data = await res.json();

        const newSeries = data.results || [];

        // If TMDB returns an empty array, we've reached the end
        if (newSeries.length === 0) {
          setHasMore(false);
        } else {
          // If it's page 1, replace. If > 1, append to existing array.
          setSeries((prev) =>
            page === 1 ? newSeries : [...prev, ...newSeries],
          );
        }
      } catch (error) {
        console.error("Failed to fetch series", error);
      } finally {
        setLoadingInitial(false);
        setLoadingMore(false);
      }
    };
    fetchSeries();
  }, [page, sortBy, minVote, genre, year]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  const updateSortBy = (value: string) => {
    setSortBy(value);
    setPage(1);
    setHasMore(true);
  };

  const updateMinVote = (value: string) => {
    setMinVote(value);
    setPage(1);
    setHasMore(true);
  };

  const updateGenre = (value: string) => {
    setGenre(value);
    setPage(1);
    setHasMore(true);
  };

  const updateYear = (value: string) => {
    setYear(value);
    setPage(1);
    setHasMore(true);
  };

  const hasActiveFilters =
    sortBy !== "popularity.desc" ||
    minVote !== "0" ||
    genre !== "" ||
    year !== "";

  const resetFilters = () => {
    setSortBy("popularity.desc");
    setMinVote("0");
    setGenre("");
    setYear("");
    setPage(1);
    setHasMore(true);
  };

  return (
    <div className="pt-4 pb-12 px-6 md:px-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">TV Shows</h1>
          <p className="text-gray-400 text-sm">
            Binge-worthy series and latest episodes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2 bg-[#161824] border border-white/10 rounded-xl text-sm text-gray-300 hover:text-white hover:border-indigo-500/50 hover:bg-[#1f2233] transition-all shadow-lg shadow-black/20">
            <SortDesc className="w-4 h-4 text-indigo-400" />
            <select
              value={sortBy}
              onChange={(e) => updateSortBy(e.target.value)}
              className="bg-transparent text-gray-300 text-sm focus:outline-none"
            >
              <option value="popularity.desc" className="bg-[#161824]">
                Popularity
              </option>
              <option value="vote_average.desc" className="bg-[#161824]">
                Rating
              </option>
              <option value="first_air_date.desc" className="bg-[#161824]">
                Newest
              </option>
            </select>
          </label>

          <label className="flex items-center gap-2 px-4 py-2 bg-[#161824] border border-white/10 rounded-xl text-sm text-gray-300 hover:text-white hover:border-indigo-500/50 hover:bg-[#1f2233] transition-all shadow-lg shadow-black/20">
            <Filter className="w-4 h-4 text-indigo-400" />
            <select
              value={minVote}
              onChange={(e) => updateMinVote(e.target.value)}
              className="bg-transparent text-gray-300 text-sm focus:outline-none"
            >
              <option value="0" className="bg-[#161824]">
                All
              </option>
              <option value="7" className="bg-[#161824]">
                Rating 7+
              </option>
              <option value="8" className="bg-[#161824]">
                Rating 8+
              </option>
            </select>
          </label>

          <label className="flex items-center gap-2 px-4 py-2 bg-[#161824] border border-white/10 rounded-xl text-sm text-gray-300 hover:text-white hover:border-indigo-500/50 hover:bg-[#1f2233] transition-all shadow-lg shadow-black/20">
            <Filter className="w-4 h-4 text-indigo-400" />
            <select
              value={genre}
              onChange={(e) => updateGenre(e.target.value)}
              className="bg-transparent text-gray-300 text-sm focus:outline-none"
            >
              <option value="" className="bg-[#161824]">
                Genre
              </option>
              <option value="10759" className="bg-[#161824]">
                Action & Adventure
              </option>
              <option value="35" className="bg-[#161824]">
                Comedy
              </option>
              <option value="80" className="bg-[#161824]">
                Crime
              </option>
              <option value="18" className="bg-[#161824]">
                Drama
              </option>
              <option value="9648" className="bg-[#161824]">
                Mystery
              </option>
              <option value="10765" className="bg-[#161824]">
                Sci-Fi & Fantasy
              </option>
            </select>
          </label>

          <label className="flex items-center gap-2 px-4 py-2 bg-[#161824] border border-white/10 rounded-xl text-sm text-gray-300 hover:text-white hover:border-indigo-500/50 hover:bg-[#1f2233] transition-all shadow-lg shadow-black/20">
            <Filter className="w-4 h-4 text-indigo-400" />
            <select
              value={year}
              onChange={(e) => updateYear(e.target.value)}
              className="bg-transparent text-gray-300 text-sm focus:outline-none"
            >
              <option value="" className="bg-[#161824]">
                Year
              </option>
              {yearOptions.map((yearValue) => (
                <option
                  key={yearValue}
                  value={yearValue}
                  className="bg-[#161824]"
                >
                  {yearValue}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            className="px-4 py-2 bg-[#161824] border border-white/10 rounded-xl text-sm text-gray-300 hover:text-white hover:border-indigo-500/50 hover:bg-[#1f2233] transition-all shadow-lg shadow-black/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Initial Loading State */}
      {loadingInitial ? (
        <div className="flex justify-center py-32">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        </div>
      ) : (
        <>
          {/* Dense Poster Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 mb-10">
            {series.map((media, idx) => (
              <div
                key={`${media.id}-${idx}`}
                className="flex justify-center w-full"
              >
                <MediaCard media={media} className="w-full max-w-70" />
              </div>
            ))}
          </div>

          {/* Load More Button / Pagination */}
          {hasMore && (
            <div className="flex justify-center mt-12">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="group flex items-center gap-3 px-8 py-3 bg-[#161824] hover:bg-indigo-600 border border-white/10 hover:border-indigo-500 text-gray-300 hover:text-white rounded-full font-medium transition-all shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading more
                    series...
                  </>
                ) : (
                  <>
                    Load More{" "}
                    <ChevronDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
