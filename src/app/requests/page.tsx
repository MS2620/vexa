"use client";
import { useState, useEffect, useCallback } from "react";
import { Loader2, Clock, Filter, SortDesc } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import MediaCard from "../components/MediaCard";

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
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  const fetchRequests = useCallback(async () => {
    try {
      setSyncing(true);

      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      const meData = await meRes.json();
      const admin = meData?.role === "admin";
      setIsAdmin(admin);

      const requestCalls = [fetch("/api/request/sync", { method: "POST" })];

      if (admin) {
        requestCalls.unshift(fetch("/api/dashboard/requests?status=pending"));
      }

      const responses = await Promise.all(requestCalls);

      if (admin) {
        const pendingData = await responses[0].json();
        setPendingApproval(pendingData.results || []);
      } else {
        setPendingApproval([]);
      }

      setSyncing(false);

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
    <div className="pt-4 pb-12 px-6 md:px-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Requests</h1>
          <p className="text-gray-400 text-sm flex items-center gap-2">
            Status of your content requests
            {syncing && (
              <span className="flex items-center gap-1.5 text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded text-xs font-medium animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" /> Syncing with
                Plex...
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-[#161824] border border-white/10 rounded-xl text-sm text-gray-300 hover:text-white hover:border-indigo-500/50 hover:bg-[#1f2233] transition-all shadow-lg shadow-black/20">
            <SortDesc className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Recent</span>
          </button>
          <div className="bg-[#161824] border border-white/10 rounded-xl px-4 py-2 text-sm text-gray-400 shadow-lg shadow-black/20">
            <span className="text-indigo-400 font-bold">{requests.length}</span>{" "}
            Total
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-32">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="space-y-12">
          {/* Pending Approval Section */}
          {isAdmin && pendingApproval.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center gap-2 px-1">
                ⏳ Pending Approval
                <span className="bg-yellow-500/10 text-yellow-400 text-xs px-2.5 py-0.5 rounded-full border border-yellow-500/20 font-mono">
                  {pendingApproval.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pendingApproval.map((req) => (
                  <div
                    key={req.id}
                    className="bg-[#161824] border border-yellow-500/20 rounded-2xl p-4 flex gap-4 group hover:border-yellow-500/40 transition-colors shadow-lg shadow-black/20"
                  >
                    <div className="w-16 h-24 bg-gray-800 rounded-lg overflow-hidden shrink-0 shadow-md">
                      {req.poster_path && (
                        <img
                          alt={`${req.title} poster`}
                          src={`https://image.tmdb.org/t/p/w200${req.poster_path}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <h3 className="font-bold text-white truncate text-base mb-0.5">
                        {req.title}
                      </h3>
                      <p className="text-xs text-gray-400 mb-3">
                        Requested by{" "}
                        <span className="text-indigo-400 font-medium">
                          {req.requested_by}
                        </span>
                        {req.season &&
                          ` • S${req.season} E${req.episode || "All"}`}
                      </p>

                      <div className="flex gap-2 mt-auto">
                        <button
                          onClick={async () => {
                            const response = await fetch(
                              `/api/request/${req.id}/approve`,
                              {
                                method: "POST",
                              },
                            );
                            const body = await response
                              .json()
                              .catch(() => ({}));
                            if (!response.ok) {
                              toast.error(body?.error || "Approval failed");
                              return;
                            }
                            toast.success("Request approved");
                            fetchRequests();
                          }}
                          className="flex-1 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 rounded-lg text-xs font-bold uppercase tracking-wide transition-all hover:shadow-lg hover:shadow-green-900/20 cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={async () => {
                            const response = await fetch(
                              `/api/request/${req.id}/approve`,
                              {
                                method: "DELETE",
                              },
                            );
                            const body = await response
                              .json()
                              .catch(() => ({}));
                            if (!response.ok) {
                              toast.error(body?.error || "Deny failed");
                              return;
                            }
                            toast.success("Request denied");
                            fetchRequests();
                          }}
                          className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-xs font-bold uppercase tracking-wide transition-all hover:shadow-lg hover:shadow-red-900/20 cursor-pointer"
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Requests List */}
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-gray-500 gap-4 border-2 border-dashed border-gray-800 rounded-3xl bg-[#13151f]/50">
              <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mb-2">
                <Clock className="w-8 h-8 opacity-40" />
              </div>
              <p className="text-lg font-medium text-gray-400">
                No requests yet
              </p>
              <button
                onClick={() => router.push("/")}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
              >
                Find something to request
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {requests.map((req) => (
                <MediaCard
                  key={req.id}
                  media={{
                    ...req,
                    // Map request fields to what MediaCard expects if needed
                    season_number: req.season,
                    episode_number: req.episode,
                  }}
                  type="wide" // Using the wide card style
                  status={req.status}
                  user={req.requested_by}
                  className="w-full"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
