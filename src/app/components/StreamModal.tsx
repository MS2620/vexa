"use client";

import { Loader2, Play, ShieldBan, X, Zap } from "lucide-react";
import { StreamData } from "@/lib/types";

type StreamModalProps = {
  title: string;
  streamModal: { season?: number; episode?: number };
  loadingStreams: boolean;
  streams: StreamData[];
  filterRes: string;
  setFilterRes: (value: string) => void;
  filterLang: string;
  setFilterLang: (value: string) => void;
  getResolution: (stream: StreamData) => string;
  downloadingHash: string | null;
  handleDownload: (infoHash: string, streamIndex?: number) => void;
  onBlockStream: (stream: StreamData) => void;
  onClose: () => void;
};

export default function StreamModal({
  title,
  streamModal,
  loadingStreams,
  streams,
  filterRes,
  setFilterRes,
  filterLang,
  setFilterLang,
  getResolution,
  downloadingHash,
  handleDownload,
  onBlockStream,
  onClose,
}: StreamModalProps) {
  const filteredStreams = streams.filter(
    (s) =>
      (filterRes === "all" || getResolution(s) === filterRes) &&
      (filterLang === "all" ||
        `${s.name} ${s.title}`.toLowerCase().includes(filterLang)),
  );

  return (
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
            onClick={onClose}
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
              Found {filteredStreams.length} Streams
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
            filteredStreams.map((stream, idx) => (
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
                    onClick={() => onBlockStream(stream)}
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
  );
}
