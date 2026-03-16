"use client";
import { useState, useEffect, useCallback } from "react";
import { Loader2, Film, Tv, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    Requested: "bg-indigo-600/30 text-indigo-400 border border-indigo-500/30",
    Available: "bg-green-600/30 text-green-400 border border-green-500/30",
    Downloading: "bg-yellow-600/30 text-yellow-400 border border-yellow-500/30",
    "Pending Approval":
      "bg-yellow-600/30 text-yellow-400 border border-yellow-500/30",
    Denied: "bg-red-600/30 text-red-400 border border-red-500/30",
    Failed: "bg-red-600/30 text-red-400 border border-red-500/30",
  };
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${styles[status] || styles.Requested}`}
    >
      {status}
    </span>
  );
};

type Request = {
  id: string | number;
  title: string;
  poster_path?: string;
  requested_by: string;
  season?: number;
  episode?: number;
  tmdb_id?: string | number;
  media_type: string;
  requested_at: string;
  status: string;
};

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [pendingApproval, setPendingApproval] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(true);
  const router = useRouter();

  // FIX 1: Extract as a standalone named function so approve/deny can call it
  const fetchRequests = useCallback(async () => {
    try {
      setSyncing(true);

      // Fetch pending approvals and sync in parallel
      const [pendingRes] = await Promise.all([
        fetch("/api/dashboard/requests?status=pending"),
        fetch("/api/request/sync", { method: "POST" }),
      ]);

      const pendingData = await pendingRes.json();
      setPendingApproval(pendingData.results || []);
      setSyncing(false);

      // Fetch the updated main requests list
      const res = await fetch("/api/dashboard/requests");
      const data = await res.json();
      setRequests(data.results || []);
    } catch (error) {
      console.error("Failed to load requests:", error);
      setSyncing(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return (
    <div className="pt-6 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-indigo-400">Requests</h1>
          {syncing && (
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Syncing with Plex...
            </p>
          )}
        </div>
        <span className="text-sm text-gray-500">{requests.length} total</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* FIX 2: Pending Approval is OUTSIDE the empty state check so it always renders */}
          {pendingApproval.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                ⏳ Pending Approval
                <span className="bg-yellow-600/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full border border-yellow-600/30">
                  {pendingApproval.length}
                </span>
              </h2>
              <div className="space-y-3">
                {pendingApproval.map((req) => (
                  <div
                    key={req.id}
                    className="bg-[#161824] border border-yellow-600/20 rounded-xl p-4 flex items-center gap-4"
                  >
                    <div className="w-10 h-14 bg-gray-800 rounded overflow-hidden shrink-0">
                      {req.poster_path && (
                        <Image
                          alt={`${req.title} poster`}
                          src={`https://image.tmdb.org/t/p/w200${req.poster_path}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">
                        {req.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Requested by{" "}
                        <span className="text-indigo-400">
                          {req.requested_by}
                        </span>
                        {req.season &&
                          ` · Season ${req.season}${req.episode ? ` E${req.episode}` : ""}`}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={async () => {
                          await fetch(`/api/request/${req.id}/approve`, {
                            method: "POST",
                          });
                          fetchRequests(); // FIX 1: Now works correctly
                        }}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={async () => {
                          await fetch(`/api/request/${req.id}/approve`, {
                            method: "DELETE",
                          });
                          fetchRequests(); // FIX 1: Now works correctly
                        }}
                        className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-700/30 text-red-400 rounded-lg text-xs font-medium transition-colors"
                      >
                        ✕ Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Requests List */}
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-gray-500 gap-4">
              <Clock className="w-12 h-12 opacity-30" />
              <p>No requests yet. Find something to watch!</p>
              <button
                onClick={() => router.push("/")}
                className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
              >
                Browse Discover →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  onClick={() =>
                    req.tmdb_id &&
                    router.push(`/media/${req.media_type}/${req.tmdb_id}`)
                  }
                  className="bg-[#161824] border border-gray-800 rounded-xl p-4 flex items-center gap-5 hover:border-gray-700 transition-colors cursor-pointer group"
                >
                  {/* Poster */}
                  <div className="w-12 h-16 bg-gray-800 rounded-lg overflow-hidden shrink-0">
                    {req.poster_path ? (
                      <Image
                        alt={`${req.title} poster`}
                        src={`https://image.tmdb.org/t/p/w200${req.poster_path}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {req.media_type === "tv" ? (
                          <Tv className="w-5 h-5 text-gray-600" />
                        ) : (
                          <Film className="w-5 h-5 text-gray-600" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                        {req.media_type === "tv" ? "Series" : "Movie"}
                      </span>
                      <h3 className="font-semibold text-white truncate">
                        {req.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full bg-pink-600 flex items-center justify-center text-[8px] font-bold text-white shrink-0">
                          {req.requested_by?.charAt(0).toUpperCase()}
                        </div>
                        <span>{req.requested_by}</span>
                      </div>
                      {req.season && (
                        <span className="text-gray-500">
                          Season {req.season}
                          {req.episode
                            ? ` · Episode ${req.episode}`
                            : " · Full Season"}
                        </span>
                      )}
                      <span className="text-gray-600">
                        {new Date(req.requested_at).toLocaleDateString(
                          "en-GB",
                          { day: "numeric", month: "short", year: "numeric" },
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0">
                    <StatusBadge status={req.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
