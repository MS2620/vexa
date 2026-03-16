"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  Play,
  Bell,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Clock,
  Film,
  Star,
  MonitorPlay,
  Zap,
  ShieldBan,
} from "lucide-react";
import Image from "next/image";

const Badge = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    className={`px-2.5 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-md border ${className}`}
  >
    {children}
  </span>
);

const AvailabilityBadge = ({ status }: { status: string }) => {
  if (status === "available")
    return (
      <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
        Available
      </Badge>
    );
  if (status === "partial")
    return (
      <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
        Partially Available
      </Badge>
    );
  return (
    <Badge className="bg-gray-800/50 text-gray-400 border-gray-700/50">
      Not Available
    </Badge>
  );
};

export default function MediaDetailPage() {
  const params = useParams();
  const type = params.type as string;
  const id = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSeasons, setExpandedSeasons] = useState<
    Record<number, boolean>
  >({});

  const [streams, setStreams] = useState<any[]>([]);
  const [streamModal, setStreamModal] = useState<{
    season?: number;
    episode?: number;
  } | null>(null);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [downloadingHash, setDownloadingHash] = useState<string | null>(null);
  const [filterRes, setFilterRes] = useState<string>("all");
  const [filterLang, setFilterLang] = useState<string>("all");

  useEffect(() => {
    fetch(`/api/media/${type}/${id}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        if (type === "tv" && d?.detail?.seasons) {
          const firstValidSeason = d.detail.seasons.find(
            (s: any) => s.season_number > 0,
          );
          if (firstValidSeason)
            setExpandedSeasons({ [firstValidSeason.season_number]: true });
        }
        setLoading(false);
      });
  }, [type, id]);

  const toggleSeason = (seasonNum: number) =>
    setExpandedSeasons((prev) => ({ ...prev, [seasonNum]: !prev[seasonNum] }));

  const fetchStreams = async (
    season = 1,
    episode = 1,
    tvMode: "episode" | "season" = "episode",
  ) => {
    setLoadingStreams(true);
    setStreams([]);
    const fetchEp = tvMode === "season" ? 1 : episode;
    const res = await fetch(
      `/api/streams?tmdbId=${id}&type=${type}&s=${season}&e=${fetchEp}`,
    );
    setStreams((await res.json()).streams || []);
    setLoadingStreams(false);
  };

  const openStreamModal = (season?: number, episode?: number) => {
    setFilterRes("all");
    setFilterLang("all");
    setStreamModal({ season, episode });
    if (type === "movie") fetchStreams();
    else if (season) fetchStreams(season, episode || 1);
  };

  const handleDownload = async (infoHash: string, streamIndex: number = 0) => {
    setDownloadingHash(infoHash);
    try {
      const title = data.detail.title || data.detail.name;
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          infoHash,
          tmdbId: id,
          title,
          posterPath: data.detail.poster_path,
          mediaType: type,
          season: streamModal?.season || null,
          episode: streamModal?.episode || null,
        }),
      });
      const resData = await res.json();
      if (!resData.success) {
        if (resData.code === "infringing_file") {
          const nextStream = streams[streamIndex + 1];
          if (nextStream?.infoHash) {
            setDownloadingHash(null);
            await new Promise((resolve) => setTimeout(resolve, 500));
            return handleDownload(nextStream.infoHash, streamIndex + 1);
          } else
            toast.error(
              "All available streams are blocked by Real-Debrid for this title.",
            );
        } else toast.error(`Failed: ${resData.error}`);
      } else {
        setStreamModal(null);
        toast.success(
          resData.pending
            ? "Request matched and sent for approval!"
            : "Sent to Real-Debrid and Plex!",
        );
      }
    } catch (err) {
      toast.error("Something went wrong. Check the console.");
    } finally {
      setDownloadingHash(null);
    }
  };

  const getResolution = (stream: any) => {
    const combined = `${stream.name} ${stream.title}`.toLowerCase();
    if (
      combined.includes("2160p") ||
      combined.includes("4k") ||
      combined.includes("uhd")
    )
      return "2160p";
    if (combined.includes("1080p")) return "1080p";
    if (combined.includes("720p")) return "720p";
    if (combined.includes("480p")) return "480p";
    return "unknown";
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-gray-400 font-medium animate-pulse">
          Loading details...
        </p>
      </div>
    );

  if (!data?.detail)
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <ShieldBan className="w-16 h-16 text-red-500/50" />
        <p className="text-xl font-semibold text-gray-300">Media not found</p>
        <p className="text-gray-500">
          The metadata could not be loaded from TMDB.
        </p>
      </div>
    );

  const { detail, credits, keywords, plexAvailability } = data;
  const title = detail.title || detail.name;
  const year = (detail.release_date || detail.first_air_date)?.substring(0, 4);
  const backdropUrl = detail.backdrop_path
    ? `https://image.tmdb.org/t/p/original${detail.backdrop_path}`
    : null;
  const posterUrl = detail.poster_path
    ? `https://image.tmdb.org/t/p/w500${detail.poster_path}`
    : null;
  const genres = detail.genres?.map((g: any) => g.name);
  const creators =
    credits?.crew
      ?.filter(
        (c: any) =>
          c.job === "Director" ||
          c.job === "Creator" ||
          c.department === "Writing",
      )
      .slice(0, 6) || [];

  const overallTvStatus = Object.values(plexAvailability).some(
    (v) => v === "available" || v === "partial",
  )
    ? Object.values(plexAvailability).every((v) => v === "available")
      ? "available"
      : "partial"
    : "unavailable";
  const overallStatus =
    type === "movie" ? plexAvailability["movie"] : overallTvStatus;
  const seasons = (detail.seasons || []).filter(
    (s: any) => s.season_number > 0,
  );

  return (
    <div className="animate-in fade-in duration-700 pb-20">
      <div className="relative -mt-4 lg:-mt-8 -mx-6 md:-mx-12 mb-8 lg:mb-16">
        <div className="relative w-full h-[60vh] lg:h-[85vh] min-h-125 overflow-hidden bg-[#0f111a] mt-6">
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

        <div className="absolute inset-0 flex flex-col lg:flex-row items-end lg:items-center px-6 md:px-12 pb-8 lg:pb-0 z-10 mx-auto max-w-7xl pt-20">
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
                    <Clock className="w-4 h-4 opacity-70" /> {detail.runtime}{" "}
                    min
                  </span>
                )}
                {detail.vote_average > 0 && (
                  <span className="flex items-center gap-1.5 text-yellow-500">
                    <Star className="w-4 h-4 fill-current" />{" "}
                    {detail.vote_average.toFixed(1)}
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
                  <button className="flex items-center gap-2 bg-linear-to-r from-[#e5a00d] to-[#f5b324] hover:from-[#d4940c] hover:to-[#e5a00d] text-black font-extrabold px-6 py-3 rounded-xl transition-all shadow-lg shadow-yellow-900/20 transform hover:-translate-y-0.5">
                    <Play className="w-5 h-5 fill-current" /> Play on Plex
                  </button>
                )}
                <button
                  onClick={() => openStreamModal(type === "tv" ? 1 : undefined)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/40 border border-indigo-500/50 transform hover:-translate-y-0.5"
                >
                  <Play className="w-5 h-5 fill-white" />{" "}
                  {type === "movie" ? "Request Movie" : "Request Episode"}
                </button>
                <button className="p-3 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-xl transition-colors border border-white/10 text-gray-300 hover:text-white">
                  <Bell className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse lg:flex-row gap-8 lg:gap-12 max-w-7xl mx-auto px-6 md:px-0">
        <div className="flex-1 min-w-0 space-y-12">
          {detail.overview && (
            <section className="bg-[#161824]/50 rounded-2xl p-6 md:p-8 border border-white/5">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Film className="w-5 h-5 text-indigo-400" /> Storyline
              </h2>
              <p className="text-gray-300 leading-relaxed text-base md:text-lg opacity-90">
                {detail.overview}
              </p>
            </section>
          )}

          {creators.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                Featured Crew
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {creators.map((person: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-[#161824] p-3 rounded-xl border border-white/5 flex flex-col justify-center"
                  >
                    <p className="text-[11px] text-indigo-400 uppercase font-bold tracking-wider mb-1">
                      {person.job}
                    </p>
                    <p className="font-semibold text-gray-200 text-sm">
                      {person.name}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {type === "tv" && seasons.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Seasons</h2>
                <span className="text-sm font-medium text-gray-400 bg-white/5 px-3 py-1 rounded-full">
                  {seasons.length} Total
                </span>
              </div>
              <div className="space-y-4">
                {seasons.map((season: any) => {
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
                          {Array.from(
                            { length: episodeCount },
                            (_, i) => i + 1,
                          ).map((ep) => (
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
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="w-full lg:w-80 shrink-0">
          <div className="sticky top-24 space-y-6">
            <div className="bg-[#161824] border border-white/5 rounded-2xl p-6 shadow-xl shadow-black/20">
              <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                Information
              </h3>
              <div className="space-y-4">
                {[
                  {
                    label: "Original Name",
                    value: detail.original_title || detail.original_name,
                  },
                  {
                    label: "First Air Date",
                    value: detail.first_air_date || detail.release_date,
                  },
                  {
                    label: "Next Air Date",
                    value: detail.next_episode_to_air?.air_date,
                  },
                  {
                    label: "Language",
                    value: detail.original_language?.toUpperCase(),
                  },
                  {
                    label: "Network",
                    value:
                      detail.networks?.[0]?.name ||
                      detail.production_companies?.[0]?.name,
                  },
                  {
                    label: "Budget",
                    value: detail.budget
                      ? `$${(detail.budget / 1000000).toFixed(1)}M`
                      : null,
                  },
                  {
                    label: "Revenue",
                    value: detail.revenue
                      ? `$${(detail.revenue / 1000000).toFixed(1)}M`
                      : null,
                  },
                ]
                  .filter((item) => item.value)
                  .map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex flex-col gap-1 border-b border-white/5 pb-3 last:border-0 last:pb-0"
                    >
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        {label}
                      </span>
                      <span className="text-sm font-medium text-gray-200">
                        {value}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            {keywords.length > 0 && (
              <div className="bg-[#161824] border border-white/5 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                  Keywords
                </h3>
                <div className="flex flex-wrap gap-2">
                  {keywords.slice(0, 20).map((kw: any) => (
                    <span
                      key={kw.id}
                      className="text-[11px] px-2.5 py-1 bg-white/5 border border-white/10 rounded-md text-gray-300"
                    >
                      {kw.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {streamModal !== null && (
        <div className="fixed inset-0 bg-[#0f111a]/95 backdrop-blur-md flex items-center justify-center z-100 p-4 sm:p-6 fade-in animate-in duration-300">
          <div className="bg-[#161824] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl shadow-indigo-900/20 overflow-hidden relative">
            <div className="flex justify-between items-start p-6 bg-linear-to-b from-white/5 to-transparent border-b border-white/5">
              <div>
                <h2 className="text-2xl font-black text-white">{title}</h2>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="text-indigo-400 font-medium bg-indigo-500/10 px-3 py-1 rounded-md text-sm">
                    {streamModal.season
                      ? `Season ${streamModal.season}${streamModal.episode ? ` — Episode ${streamModal.episode}` : " (All Episodes)"}`
                      : "Feature Film"}
                  </span>
                  {loadingStreams && (
                    <span className="flex items-center gap-2 text-xs font-medium text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded-md animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" /> Scraping
                      Torrentio...
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setStreamModal(null)}
                className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {streams.length > 0 && !loadingStreams && (
              <div className="flex items-center gap-3 px-6 py-4 bg-black/20 border-b border-white/5 flex-wrap">
                <div className="flex gap-2">
                  <select
                    value={filterRes}
                    onChange={(e) => setFilterRes(e.target.value)}
                    className="bg-[#0f111a] border border-white/10 rounded-lg px-4 py-2 text-sm text-gray-200 font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all hover:border-white/20"
                  >
                    <option value="all">All Resolutions</option>
                    <option value="2160p">4K UHD</option>
                    <option value="1080p">1080p FHD</option>
                    <option value="720p">720p HD</option>
                    <option value="480p">480p SD</option>
                  </select>
                  <select
                    value={filterLang}
                    onChange={(e) => setFilterLang(e.target.value)}
                    className="bg-[#0f111a] border border-white/10 rounded-lg px-4 py-2 text-sm text-gray-200 font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all hover:border-white/20"
                  >
                    <option value="all">All Languages</option>
                    <option value="en">English</option>
                    <option value="multi">Multi-Language</option>
                  </select>
                </div>
                <div className="ml-auto text-xs font-bold text-gray-500 bg-[#0f111a] px-3 py-2 rounded-lg border border-white/5">
                  Found{" "}
                  {
                    streams.filter(
                      (s) =>
                        (filterRes === "all" ||
                          getResolution(s) === filterRes) &&
                        (filterLang === "all" ||
                          `${s.name} ${s.title}`
                            .toLowerCase()
                            .includes(filterLang)),
                    ).length
                  }{" "}
                  Streams
                </div>
              </div>
            )}

            <div
              className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0f111a] space-y-3"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "#1f2233 #0f111a",
              }}
            >
              {loadingStreams && (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                  <p className="text-gray-400 font-medium animate-pulse">
                    Finding the best sources...
                  </p>
                </div>
              )}
              {!loadingStreams && streams.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-500">
                  <ShieldBan className="w-12 h-12 opacity-20" />
                  <p>No streams available.</p>
                </div>
              )}
              {!loadingStreams &&
                streams
                  .filter(
                    (s) =>
                      (filterRes === "all" || getResolution(s) === filterRes) &&
                      (filterLang === "all" ||
                        `${s.name} ${s.title}`
                          .toLowerCase()
                          .includes(filterLang)),
                  )
                  .map((stream, idx) => (
                    <div
                      key={idx}
                      className="bg-[#161824] p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between border border-white/5 hover:border-indigo-500/40 hover:bg-white/5 transition-all gap-4 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                          <span className="px-2 py-0.5 bg-black/50 rounded text-[10px] font-black text-indigo-400 border border-indigo-500/20 shadow-inner">
                            {stream.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black border shadow-inner ${getResolution(stream) === "2160p" ? "bg-purple-500/10 text-purple-400 border-purple-500/30" : getResolution(stream) === "1080p" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : getResolution(stream) === "720p" ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-gray-800 text-gray-400 border-gray-700"}`}
                          >
                            {getResolution(stream)}
                          </span>
                          {(`${stream.name} ${stream.title}`
                            .toLowerCase()
                            .includes("[rd+]") ||
                            `${stream.name} ${stream.title}`
                              .toLowerCase()
                              .includes("[rd]")) && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/30 rounded text-[10px] font-black shadow-inner tracking-wider">
                              <Zap className="w-3 h-3 fill-current" /> RD CACHED
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-300 break-all leading-snug">
                          {stream.title}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0 sm:opacity-50 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDownload(stream.infoHash, idx)}
                          disabled={downloadingHash === stream.infoHash}
                          className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-colors disabled:opacity-50 shadow-lg shadow-indigo-900/20"
                        >
                          {downloadingHash === stream.infoHash ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4 fill-current" />
                          )}{" "}
                          {downloadingHash === stream.infoHash
                            ? "Sending..."
                            : "Download"}
                        </button>
                        <button
                          onClick={async () => {
                            await fetch("/api/blocklist", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                infoHash: stream.infoHash,
                                title: stream.title,
                              }),
                            });
                            setStreams((prev) =>
                              prev.filter(
                                (s) => s.infoHash !== stream.infoHash,
                              ),
                            );
                          }}
                          className="p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                          title="Block this torrent"
                        >
                          <ShieldBan className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
