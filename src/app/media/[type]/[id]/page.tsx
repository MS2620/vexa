"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Play,
  Bell,
  Settings2,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

const AvailabilityBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    available: "bg-green-600/30 text-green-400 border border-green-500/30",
    partial: "bg-yellow-600/30 text-yellow-400 border border-yellow-500/30",
    unavailable: "bg-gray-700/50 text-gray-400 border border-gray-600/30",
  };
  const labels: Record<string, string> = {
    available: "Available",
    partial: "Partially Available",
    unavailable: "Not Available",
  };
  return (
    <span
      className={`text-xs px-3 py-1 rounded-full font-semibold ${styles[status] || styles.unavailable}`}
    >
      {labels[status] || "Unknown"}
    </span>
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

  // Stream modal state
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
        setLoading(false);
      });
  }, [type, id]);

  const toggleSeason = (seasonNum: number) => {
    setExpandedSeasons((prev) => ({ ...prev, [seasonNum]: !prev[seasonNum] }));
  };

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
    const d = await res.json();
    setStreams(d.streams || []);
    setLoadingStreams(false);
  };

  const openStreamModal = (season?: number, episode?: number) => {
    setStreamModal({ season, episode });
    if (type === "movie") {
      fetchStreams();
    } else if (season) {
      fetchStreams(season, episode || 1);
    }
  };

  const handleDownload = async (infoHash: string, streamIndex: number = 0) => {
    setDownloadingHash(infoHash);

    try {
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          infoHash,
          tmdbId: id,
          title,
          posterPath: detail.poster_path,
          mediaType: type,
          season: streamModal?.season || null,
          episode: streamModal?.episode || null,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        // If RD blocked this torrent, silently try the next one in the list
        if (data.code === "infringing_file") {
          const nextStream = streams[streamIndex + 1];
          if (nextStream?.infoHash) {
            console.warn(
              `Stream ${streamIndex} blocked by RD, trying stream ${streamIndex + 1}...`,
            );
            setDownloadingHash(null);
            // Small delay so the user sees the button reset before trying again
            await new Promise((resolve) => setTimeout(resolve, 500));
            return handleDownload(nextStream.infoHash, streamIndex + 1);
          } else {
            // We've exhausted all streams
            alert(
              "All available streams are blocked by Real-Debrid for this title. Try a different quality or search again later.",
            );
          }
        } else {
          // For all other errors, show the message
          alert(`Failed: ${data.error}`);
        }
      } else {
        // Success!
        setStreamModal(null);
        alert("Sent to Real-Debrid and Plex!");
      }
    } catch (err) {
      alert("Something went wrong. Check the console.");
      console.error(err);
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
      <div className="flex items-center justify-center h-full py-32">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );

  if (!data?.detail)
    return (
      <div className="p-8 text-red-400">Failed to load media details.</div>
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
  const genres = detail.genres?.map((g: any) => g.name).join(", ");
  const creators =
    credits?.crew
      ?.filter(
        (c: any) =>
          c.job === "Director" ||
          c.job === "Creator" ||
          c.department === "Writing",
      )
      .slice(0, 6) || [];
  const movieStatus = plexAvailability["movie"];
  const overallTvStatus = Object.values(plexAvailability).some(
    (v) => v === "available" || v === "partial",
  )
    ? Object.values(plexAvailability).every((v) => v === "available")
      ? "available"
      : "partial"
    : "unavailable";
  const overallStatus = type === "movie" ? movieStatus : overallTvStatus;
  const seasons = (detail.seasons || []).filter(
    (s: any) => s.season_number > 0,
  );

  return (
    <div className="animate-in fade-in">
      {/* HERO SECTION */}
      <div className="relative w-full min-h-[300px] rounded-2xl overflow-hidden mb-8">
        {/* Backdrop */}
        {backdropUrl && (
          <div className="absolute inset-0">
            <img src={backdropUrl} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0f111a] via-[#0f111a]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f111a] via-transparent to-transparent" />
          </div>
        )}

        {/* Content over backdrop */}
        <div className="relative z-10 flex gap-8 p-8 pt-10">
          {/* Poster */}
          {posterUrl && (
            <div className="w-40 shrink-0 rounded-xl overflow-hidden shadow-2xl border border-gray-700/50 hidden md:block">
              <img src={posterUrl} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Info */}
          <div className="flex flex-col justify-end pb-2">
            {overallStatus && (
              <div className="mb-3">
                <AvailabilityBadge status={overallStatus} />
              </div>
            )}
            <h1 className="text-4xl font-bold text-white mb-2">
              {title}{" "}
              <span className="text-gray-400 font-normal">({year})</span>
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-300 mb-4 flex-wrap">
              {detail.content_ratings?.results?.[0]?.rating && (
                <span className="border border-gray-500 px-2 py-0.5 rounded text-xs">
                  {detail.content_ratings.results[0].rating}
                </span>
              )}
              {type === "tv" && detail.number_of_seasons && (
                <span>
                  {detail.number_of_seasons} Season
                  {detail.number_of_seasons > 1 ? "s" : ""}
                </span>
              )}
              {genres && <span>{genres}</span>}
              {detail.runtime && <span>{detail.runtime} min</span>}
            </div>
            {detail.tagline && (
              <p className="text-gray-400 italic mb-3">{detail.tagline}</p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              {(overallStatus === "available" ||
                overallStatus === "partial") && (
                <button className="flex items-center gap-2 bg-[#e5a00d] hover:bg-[#d4940c] text-black font-semibold px-5 py-2.5 rounded-lg transition-colors">
                  <Play className="w-4 h-4 fill-current" /> Play on Plex
                </button>
              )}
              <button
                onClick={() => openStreamModal(type === "tv" ? 1 : undefined)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >
                <Play className="w-4 h-4" />{" "}
                {type === "movie" ? "Find Streams" : "Find Episode"}
              </button>
              <button className="p-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700">
                <Bell className="w-4 h-4" />
              </button>
              <button className="p-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700">
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN BODY */}
      <div className="flex gap-8">
        {/* LEFT COLUMN */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* Overview */}
          {detail.overview && (
            <section>
              <h2 className="text-xl font-bold mb-3">Overview</h2>
              <p className="text-gray-300 leading-relaxed">{detail.overview}</p>
            </section>
          )}

          {/* Crew */}
          {creators.length > 0 && (
            <section>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {creators.map((person: any, idx: number) => (
                  <div key={idx}>
                    <p className="text-sm text-gray-400">{person.job}</p>
                    <p className="font-semibold text-white">{person.name}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Keywords */}
          {keywords.length > 0 && (
            <section>
              <div className="flex flex-wrap gap-2">
                {keywords.slice(0, 15).map((kw: any) => (
                  <span
                    key={kw.id}
                    className="text-xs px-3 py-1.5 bg-[#161824] border border-gray-700/50 rounded-full text-gray-300 hover:border-gray-500 transition-colors cursor-default flex items-center gap-1"
                  >
                    🏷 {kw.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* SEASONS (TV only) */}
          {type === "tv" && seasons.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4">Seasons</h2>
              <div className="space-y-2">
                {seasons.map((season: any) => {
                  const seasonStatus =
                    plexAvailability[season.season_number] || "unavailable";
                  const isExpanded = expandedSeasons[season.season_number];
                  const episodeCount = season.episode_count || 0;

                  return (
                    <div
                      key={season.season_number}
                      className="bg-[#161824] border border-gray-800 rounded-xl overflow-hidden"
                    >
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/30 transition-colors"
                        onClick={() => toggleSeason(season.season_number)}
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-semibold text-white">
                            Season {season.season_number}
                          </span>
                          <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                            {episodeCount} Episodes
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <AvailabilityBadge status={seasonStatus} />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openStreamModal(season.season_number, 1);
                            }}
                            className="text-xs bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-lg hover:bg-indigo-600/40 transition-colors"
                          >
                            Get Season
                          </button>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Expanded Episode List */}
                      {isExpanded && (
                        <div className="border-t border-gray-800 divide-y divide-gray-800/50">
                          {Array.from(
                            { length: episodeCount },
                            (_, i) => i + 1,
                          ).map((ep) => (
                            <div
                              key={ep}
                              className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/20 transition-colors"
                            >
                              <span className="text-sm text-gray-300">
                                Episode {ep}
                              </span>
                              <button
                                onClick={() =>
                                  openStreamModal(season.season_number, ep)
                                }
                                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg transition-colors"
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

        {/* RIGHT SIDEBAR */}
        <div className="w-72 shrink-0 space-y-6">
          <div className="bg-[#161824] border border-gray-800 rounded-xl p-5 space-y-4">
            {[
              { label: "Status", value: detail.status },
              {
                label: "First Air Date",
                value: detail.first_air_date || detail.release_date,
              },
              {
                label: "Next Air Date",
                value: detail.next_episode_to_air?.air_date,
              },
              {
                label: "Original Language",
                value: detail.original_language?.toUpperCase(),
              },
              {
                label: "Network",
                value:
                  detail.networks?.[0]?.name ||
                  detail.production_companies?.[0]?.name,
              },
              {
                label: "Production Countries",
                value: detail.production_countries
                  ?.map((c: any) => c.name)
                  .join(", "),
              },
            ]
              .filter((item) => item.value)
              .map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-sm text-gray-400 shrink-0">
                    {label}
                  </span>
                  <span className="text-sm text-white text-right">{value}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* STREAM MODAL */}
      {streamModal !== null && (
        <div className="fixed inset-0 bg-[#0f111a]/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#161824] border border-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold">{title}</h2>
                <p className="text-gray-400 text-sm mt-1">
                  {streamModal.season
                    ? `Season ${streamModal.season}${streamModal.episode ? ` — Episode ${streamModal.episode}` : " (Season Pack)"}`
                    : "Movie"}
                </p>
              </div>
              <button
                onClick={() => setStreamModal(null)}
                className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Bar — only shows once streams are loaded */}
            {streams.length > 0 && (
              <div className="flex gap-3 mb-4 flex-wrap shrink-0">
                <select
                  value={filterRes}
                  onChange={(e) => setFilterRes(e.target.value)}
                  className="bg-[#0f111a] border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Resolutions</option>
                  <option value="2160p">4K (2160p)</option>
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                </select>
                <select
                  value={filterLang}
                  onChange={(e) => setFilterLang(e.target.value)}
                  className="bg-[#0f111a] border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Languages</option>
                  <option value="en">English</option>
                  <option value="multi">Multi</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="es">Spanish</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                </select>
                <span className="text-xs text-gray-500 self-center">
                  {
                    streams.filter((s) => {
                      const resOk =
                        filterRes === "all" || getResolution(s) === filterRes;
                      const langOk =
                        filterLang === "all" ||
                        `${s.name} ${s.title}`
                          .toLowerCase()
                          .includes(filterLang);
                      return resOk && langOk;
                    }).length
                  }{" "}
                  results
                </span>
              </div>
            )}

            {/* Streams List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingStreams && (
                <div className="flex items-center gap-2 text-gray-400 py-4">
                  <Loader2 className="animate-spin w-5 h-5" /> Scraping
                  sources...
                </div>
              )}

              {!loadingStreams && streams.length === 0 && (
                <p className="text-gray-500 py-4">No streams found.</p>
              )}

              {!loadingStreams &&
                streams
                  .filter((stream) => {
                    const resOk =
                      filterRes === "all" ||
                      getResolution(stream) === filterRes;
                    const combined =
                      `${stream.name} ${stream.title}`.toLowerCase();
                    const langOk =
                      filterLang === "all" || combined.includes(filterLang);
                    return resOk && langOk;
                  })
                  .map((stream, idx) => (
                    <div
                      key={idx}
                      className="bg-[#0f111a] p-4 rounded-lg flex justify-between items-center border border-gray-800 hover:border-indigo-500/50 transition-colors"
                    >
                      <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="px-2 py-1 bg-[#161824] rounded text-[10px] font-bold text-indigo-400 border border-gray-700 uppercase">
                            {stream.name}
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-[10px] font-bold border uppercase ${
                              getResolution(stream) === "2160p"
                                ? "bg-purple-900/30 text-purple-400 border-purple-700"
                                : getResolution(stream) === "1080p"
                                  ? "bg-blue-900/30 text-blue-400 border-blue-700"
                                  : getResolution(stream) === "720p"
                                    ? "bg-green-900/30 text-green-400 border-green-700"
                                    : "bg-gray-800 text-gray-400 border-gray-700"
                            }`}
                          >
                            {getResolution(stream)}
                          </span>
                          {(`${stream.name} ${stream.title}`
                            .toLowerCase()
                            .includes("[rd+]") ||
                            `${stream.name} ${stream.title}`
                              .toLowerCase()
                              .includes("[rd]")) && (
                            <span className="px-2 py-1 bg-green-900/30 text-green-400 border border-green-700 rounded text-[10px] font-bold uppercase">
                              ⚡ Cached
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-300 line-clamp-2">
                          {stream.title}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleDownload(stream.infoHash, idx)}
                          disabled={downloadingHash === stream.infoHash}
                          className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {downloadingHash === stream.infoHash
                            ? "Trying..."
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
                            // Remove from local state immediately
                            setStreams((prev) =>
                              prev.filter(
                                (s) => s.infoHash !== stream.infoHash,
                              ),
                            );
                          }}
                          className="p-2 hover:bg-red-900/30 border border-gray-700 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                          title="Block this torrent"
                        >
                          🚫
                        </button>
                      </div>
                    </div>
                  ))}

              {!loadingStreams &&
                streams.length > 0 &&
                streams.filter((s) => {
                  const resOk =
                    filterRes === "all" || getResolution(s) === filterRes;
                  const langOk =
                    filterLang === "all" ||
                    `${s.name} ${s.title}`.toLowerCase().includes(filterLang);
                  return resOk && langOk;
                }).length === 0 && (
                  <p className="text-gray-500 text-sm py-4">
                    No streams match your filters. Try broadening them.
                  </p>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
