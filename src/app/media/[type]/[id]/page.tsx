"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { Film, ShieldBan } from "lucide-react";
import MediaHero from "@/app/components/MediaHero";
import SeasonsList from "@/app/components/SeasonsList";
import InfoSidebar from "@/app/components/InfoSidebar";
import StreamModal from "@/app/components/StreamModal";

export default function MediaDetailPage() {
  const params = useParams();
  const type = params.type as string;
  const id = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [plexUrl, setPlexUrl] = useState("");
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

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((settings) => setPlexUrl(settings?.plex_url || ""))
      .catch(() => setPlexUrl(""));
  }, []);

  useEffect(() => {
    const detail = data?.detail;
    if (!detail) return;

    const mediaTitle = detail.title || detail.name;
    if (!mediaTitle) return;

    const mediaYear = (detail.release_date || detail.first_air_date)?.substring(
      0,
      4,
    );

    document.title = mediaYear
      ? `${mediaTitle} (${mediaYear}) • Vexa`
      : `${mediaTitle} • Vexa`;
  }, [data]);

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
      console.error(err);
    } finally {
      setDownloadingHash(null);
    }
  };

  const blockStream = async (stream: any) => {
    await fetch("/api/blocklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        infoHash: stream.infoHash,
        title: stream.title,
      }),
    });
    setStreams((prev) => prev.filter((s) => s.infoHash !== stream.infoHash));
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

  const availabilityMap = plexAvailability || {};
  const overallTvStatus = Object.values(availabilityMap).some(
    (v) => v === "available" || v === "partial",
  )
    ? Object.values(availabilityMap).every((v) => v === "available")
      ? "available"
      : "partial"
    : "unavailable";
  const overallStatus =
    type === "movie" ? availabilityMap["movie"] : overallTvStatus;
  const seasons = (detail.seasons || []).filter(
    (s: any) => s.season_number > 0,
  );

  return (
    <div className="animate-in fade-in duration-700 pb-20">
      <MediaHero
        backdropUrl={backdropUrl}
        posterUrl={posterUrl}
        title={title}
        year={year}
        overallStatus={overallStatus}
        detail={detail}
        type={type}
        plexUrl={plexUrl}
        genres={genres}
        onRequestClick={() => openStreamModal(type === "tv" ? 1 : undefined)}
      />

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
            <SeasonsList
              seasons={seasons}
              plexAvailability={availabilityMap}
              expandedSeasons={expandedSeasons}
              toggleSeason={toggleSeason}
              openStreamModal={openStreamModal}
            />
          )}
        </div>

        <InfoSidebar detail={detail} keywords={keywords} />
      </div>

      {streamModal !== null && (
        <StreamModal
          title={title}
          streamModal={streamModal}
          loadingStreams={loadingStreams}
          streams={streams}
          filterRes={filterRes}
          setFilterRes={setFilterRes}
          filterLang={filterLang}
          setFilterLang={setFilterLang}
          getResolution={getResolution}
          downloadingHash={downloadingHash}
          handleDownload={handleDownload}
          onBlockStream={blockStream}
          onClose={() => setStreamModal(null)}
        />
      )}
    </div>
  );
}
