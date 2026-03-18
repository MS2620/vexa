"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  Save,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  SkipForward,
} from "lucide-react";

const DEFAULT_VAPID_SUBJECT = "mailto:notifications@yourdomain.com";

type SyncItem = {
  status: "synced" | "skipped" | "failed";
  filename: string;
  title?: string;
  reason?: string;
};
type SyncSummary = { synced: number; skipped: number; failed: number };

type CollectionSyncItem = {
  status: "created" | "updated" | "skipped" | "failed";
  title: string;
  reason?: string;
};

type CollectionSyncSummary = {
  scannedMovies: number;
  matchedCollections: number;
  created: number;
  updated: number;
  skippedNoTmdb: number;
  skippedNoCollection: number;
  tmdbFailures: number;
  plexFailures: number;
  skipped: number;
  failed: number;
};

export default function Settings() {
  const [formData, setFormData] = useState({
    tmdb_key: "",
    rd_token: "",
    plex_url: "",
    plex_token: "",
    plex_lib_id: "",
    plex_tv_lib_id: "",
    preferred_resolution: "1080p",
    preferred_language: "en",
    vapid_subject: DEFAULT_VAPID_SUBJECT,
    smtp_host: "",
    smtp_port: "587",
    smtp_user: "",
    smtp_pass: "",
    smtp_from: "",
  });
  const [serviceStatus, setServiceStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [syncState, setSyncState] = useState<"idle" | "running" | "done">(
    "idle",
  );
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [syncItems, setSyncItems] = useState<SyncItem[]>([]);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncTab, setSyncTab] = useState<"synced" | "skipped" | "failed">(
    "synced",
  );
  const [collectionSyncState, setCollectionSyncState] = useState<
    "idle" | "running" | "done"
  >("idle");
  const [collectionProgress, setCollectionProgress] = useState({
    current: 0,
    total: 0,
  });
  const [collectionItems, setCollectionItems] = useState<CollectionSyncItem[]>(
    [],
  );
  const [collectionSummary, setCollectionSummary] =
    useState<CollectionSyncSummary | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [collectionTab, setCollectionTab] = useState<
    "created" | "updated" | "skipped" | "failed"
  >("created");
  const [collectionPhaseLabel, setCollectionPhaseLabel] = useState(
    "Preparing collection sync…",
  );

  const handleSync = async () => {
    setSyncState("running");
    setSyncItems([]);
    setSyncProgress({ current: 0, total: 0 });
    setSyncSummary(null);
    setSyncError(null);
    setSyncTab("synced");

    const res = await fetch("/api/symlinks/sync", { method: "POST" });
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      setSyncError(body.error ?? "Sync failed");
      setSyncState("done");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value).split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === "total")
            setSyncProgress({ current: 0, total: event.count });
          else if (event.type === "progress")
            setSyncProgress({ current: event.current, total: event.total });
          else if (event.type === "item")
            setSyncItems((prev) => [...prev, event]);
          else if (event.type === "done") {
            setSyncSummary(event);
            setSyncState("done");
          } else if (event.type === "error") setSyncState("done");
        } catch {
          /* malformed line */
        }
      }
    }
  };

  // Load saved settings
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) =>
        setFormData((prev) => ({
          ...prev,
          ...data,
          vapid_subject:
            typeof data?.vapid_subject === "string" && data.vapid_subject.trim()
              ? data.vapid_subject.trim()
              : DEFAULT_VAPID_SUBJECT,
        })),
      );
  }, []);

  // Load live service status
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => {
        setServiceStatus(data);
        setStatusLoading(false);
      });
  }, []);

  const handleSave = async () => {
    toast.promise(
      fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      }),
      {
        loading: "Saving...",
        success: "Saved successfully!",
        error: "Failed to save configuration",
      },
    );
  };

  const handleCollectionSync = async () => {
    setCollectionSyncState("running");
    setCollectionItems([]);
    setCollectionProgress({ current: 0, total: 0 });
    setCollectionSummary(null);
    setCollectionError(null);
    setCollectionTab("created");
    setCollectionPhaseLabel("Preparing collection sync…");
    let hasStreamError = false;

    try {
      const response = await fetch("/api/plex/collections/sync", {
        method: "POST",
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        setCollectionError(data?.error || "Collection sync failed");
        setCollectionSyncState("done");
        toast.error(data?.error || "Collection sync failed");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;

          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "phase") {
              setCollectionPhaseLabel(event.message || "Syncing collections…");
            } else if (event.type === "total") {
              setCollectionProgress({ current: 0, total: event.count || 0 });
            } else if (event.type === "progress") {
              setCollectionProgress({
                current: event.current || 0,
                total: event.total || 0,
              });
            } else if (event.type === "item") {
              setCollectionItems((previous) => [...previous, event]);
            } else if (event.type === "done") {
              setCollectionSummary(event);
              setCollectionSyncState("done");
            } else if (event.type === "error") {
              hasStreamError = true;
              setCollectionError(event.error || "Collection sync failed");
              setCollectionSyncState("done");
            }
          } catch {
            // malformed chunk
          }
        }
      }

      if (!hasStreamError) {
        setCollectionSyncState("done");
        toast.success("Collection sync complete");
      }
    } catch {
      setCollectionError("Collection sync failed");
      setCollectionSyncState("done");
      toast.error("Collection sync failed");
    }
  };

  return (
    <div className="pt-4 pb-12 px-6 md:px-12 animate-in fade-in duration-500 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Configuration</h1>
          <p className="text-gray-400 text-sm">
            Manage API keys, integrations, and preferences
          </p>
        </div>
      </div>

      {/* ── LIVE STATUS PANEL ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Real-Debrid Card */}
        <div className="bg-[#161824] border border-white/5 rounded-xl p-6 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Real-Debrid</h3>
            {statusLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            ) : (
              <span
                className={`text-xs px-2 py-1 rounded-full font-bold border ${
                  serviceStatus?.rd?.status === "connected"
                    ? "bg-green-600/20 text-green-400 border-green-600/30"
                    : "bg-red-600/20 text-red-400 border-red-600/30"
                }`}
              >
                {serviceStatus?.rd?.status === "connected"
                  ? "● Connected"
                  : "● Error"}
              </span>
            )}
          </div>
          {serviceStatus?.rd?.user && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Username</span>
                <span className="text-white">
                  {serviceStatus.rd.user.username}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Premium Days Left</span>
                <span
                  className={
                    serviceStatus.rd.user.premium > 2592000
                      ? "text-green-400"
                      : "text-yellow-400"
                  }
                >
                  {Math.floor(serviceStatus.rd.user.premium / 86400)} days
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Points</span>
                <span className="text-white">
                  {serviceStatus.rd.user.points?.toLocaleString()}
                </span>
              </div>
            </div>
          )}
          {serviceStatus?.rd?.torrents?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">
                Recent Torrents
              </p>
              <div className="space-y-2">
                {serviceStatus.rd.torrents.slice(0, 3).map((t: any) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <p className="text-xs text-gray-300 truncate flex-1">
                      {t.filename}
                    </p>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        t.status === "downloaded"
                          ? "bg-green-900/30 text-green-400"
                          : t.status === "downloading"
                            ? "bg-blue-900/30 text-blue-400"
                            : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Plex Card */}
        <div className="bg-[#161824] border border-white/5 rounded-xl p-6 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Plex</h3>
            {statusLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            ) : (
              <span
                className={`text-xs px-2 py-1 rounded-full font-bold border ${
                  serviceStatus?.plex?.status === "connected"
                    ? "bg-green-600/20 text-green-400 border-green-600/30"
                    : "bg-red-600/20 text-red-400 border-red-600/30"
                }`}
              >
                {serviceStatus?.plex?.status === "connected"
                  ? "● Connected"
                  : "● Unreachable"}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400">
            {statusLoading
              ? "Checking connection..."
              : serviceStatus?.plex?.status === "connected"
                ? "Plex server is reachable and responding."
                : "Cannot reach Plex. Check your URL and token below."}
          </p>
        </div>

        {/* Mount Health Card */}
        <div className="bg-[#161824] border border-white/5 rounded-xl p-6 shadow-lg shadow-black/20 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Mount Health</h3>
            {statusLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            ) : serviceStatus?.mounts?.debrid_mount?.readable &&
              serviceStatus?.mounts?.plex_symlink_root?.writable ? (
              <span className="text-xs px-2 py-1 rounded-full font-bold border bg-green-600/20 text-green-400 border-green-600/30">
                ● Healthy
              </span>
            ) : (
              <span className="text-xs px-2 py-1 rounded-full font-bold border bg-yellow-600/20 text-yellow-300 border-yellow-600/30">
                ● Attention Needed
              </span>
            )}
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-gray-300 font-medium">Debrid Mount</p>
                <p className="text-xs text-gray-500 break-all">
                  {serviceStatus?.mounts?.debrid_mount?.path ||
                    "/mnt/zurg/__all__"}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full font-bold border whitespace-nowrap ${
                  serviceStatus?.mounts?.debrid_mount?.readable
                    ? "bg-green-600/20 text-green-400 border-green-600/30"
                    : "bg-red-600/20 text-red-400 border-red-600/30"
                }`}
              >
                {serviceStatus?.mounts?.debrid_mount?.readable
                  ? "Readable"
                  : "Not Readable"}
              </span>
            </div>

            {!statusLoading &&
              !serviceStatus?.mounts?.debrid_mount?.readable && (
                <p className="text-xs text-yellow-300/90 wrap-break-word">
                  {serviceStatus?.mounts?.debrid_mount?.error ||
                    "Debrid mount is not accessible. Ensure rclone is mounted and visible to the app container."}
                </p>
              )}

            <div className="pt-2 border-t border-white/5" />

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-gray-300 font-medium">Plex Symlink Root</p>
                <p className="text-xs text-gray-500 break-all">
                  {serviceStatus?.mounts?.plex_symlink_root?.path ||
                    "/mnt/plex_symlinks"}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full font-bold border whitespace-nowrap ${
                  serviceStatus?.mounts?.plex_symlink_root?.writable
                    ? "bg-green-600/20 text-green-400 border-green-600/30"
                    : "bg-red-600/20 text-red-400 border-red-600/30"
                }`}
              >
                {serviceStatus?.mounts?.plex_symlink_root?.writable
                  ? "Writable"
                  : "Not Writable"}
              </span>
            </div>

            {!statusLoading &&
              !serviceStatus?.mounts?.plex_symlink_root?.writable && (
                <p className="text-xs text-yellow-300/90 wrap-break-word">
                  {serviceStatus?.mounts?.plex_symlink_root?.error ||
                    "Symlink root is not writable. Match APP_UID/APP_GID with host ownership and chmod/chown the directory."}
                </p>
              )}
          </div>
        </div>
      </div>

      {/* ── CONFIGURATION FORM ── */}
      <div className="bg-[#161824] border border-white/5 rounded-xl p-6 md:p-8 space-y-8 shadow-lg shadow-black/20">
        {/* Core API Keys */}
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            API Keys
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                TMDB API Key
              </label>
              <input
                type="password"
                value={formData.tmdb_key || ""}
                onChange={(e) =>
                  setFormData({ ...formData, tmdb_key: e.target.value })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Real-Debrid Token
              </label>
              <input
                type="password"
                value={formData.rd_token || ""}
                onChange={(e) =>
                  setFormData({ ...formData, rd_token: e.target.value })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-white/5" />

        {/* Plex */}
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Plex
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Plex Local URL
              </label>
              <input
                type="text"
                placeholder="http://192.168.1.X:32400"
                value={formData.plex_url || ""}
                onChange={(e) =>
                  setFormData({ ...formData, plex_url: e.target.value })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Plex Token
              </label>
              <input
                type="password"
                value={formData.plex_token || ""}
                onChange={(e) =>
                  setFormData({ ...formData, plex_token: e.target.value })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Plex Movie Library ID
              </label>
              <input
                type="text"
                placeholder="e.g. 1"
                value={formData.plex_lib_id || ""}
                onChange={(e) =>
                  setFormData({ ...formData, plex_lib_id: e.target.value })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Plex TV Library ID
              </label>
              <input
                type="text"
                placeholder="e.g. 2"
                value={formData.plex_tv_lib_id || ""}
                onChange={(e) =>
                  setFormData({ ...formData, plex_tv_lib_id: e.target.value })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-white/5" />

        {/* Stream Preferences */}
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Stream Preferences
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Preferred Resolution
              </label>
              <select
                value={formData.preferred_resolution || "1080p"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    preferred_resolution: e.target.value,
                  })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              >
                <option value="2160p">4K (2160p)</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Preferred Language
              </label>
              <select
                value={formData.preferred_language || "en"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    preferred_language: e.target.value,
                  })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              >
                <option value="en">English</option>
                <option value="multi">Multi</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="es">Spanish</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="zh">Chinese</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-white/5" />

        {/* Push Notifications */}
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Push Notifications
          </h2>
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                VAPID Subject
              </label>
              <input
                type="text"
                placeholder="mailto:you@domain.com"
                value={formData.vapid_subject || ""}
                onChange={(e) =>
                  setFormData({ ...formData, vapid_subject: e.target.value })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              />
              <p className="mt-2 text-xs text-gray-500">
                VAPID keys are generated automatically. Only this contact
                subject is required for web-push.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/5" />

        {/* SMTP Notifications */}
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Email Notifications (SMTP)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                SMTP Host
              </label>
              <input
                type="text"
                placeholder="smtp.gmail.com"
                value={formData.smtp_host || ""}
                onChange={(e) =>
                  setFormData({ ...formData, smtp_host: e.target.value })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                SMTP Port
              </label>
              <input
                type="text"
                placeholder="587"
                value={formData.smtp_port || ""}
                onChange={(e) =>
                  setFormData({ ...formData, smtp_port: e.target.value })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                SMTP Username
              </label>
              <input
                type="text"
                value={formData.smtp_user || ""}
                onChange={(e) =>
                  setFormData({ ...formData, smtp_user: e.target.value })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                SMTP Password
              </label>
              <input
                type="password"
                value={formData.smtp_pass || ""}
                onChange={(e) =>
                  setFormData({ ...formData, smtp_pass: e.target.value })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-2">
                From Address
              </label>
              <input
                type="email"
                placeholder="vexa@yourdomain.com"
                value={formData.smtp_from || ""}
                onChange={(e) =>
                  setFormData({ ...formData, smtp_from: e.target.value })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-2 flex items-center justify-between border-t border-white/5">
          <span className="text-green-400 text-sm"></span>
          <button
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-lg shadow-indigo-500/25"
          >
            <Save className="w-5 h-5" /> Save Configuration
          </button>
        </div>
      </div>

      {/* ── PLEX COLLECTION SYNC ── */}
      <div className="bg-[#161824] border border-white/5 rounded-xl p-6 md:p-8 space-y-6 shadow-lg shadow-black/20">
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-1">
            Plex Collection Sync
          </h2>
          <p className="text-sm text-gray-500">
            Scan your Plex movie library, match TMDB collections, and
            create/update Plex collections automatically.
          </p>
        </div>

        {collectionError && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-2.5">
            <XCircle className="w-4 h-4 shrink-0" />
            {collectionError}
          </div>
        )}

        {collectionSyncState === "running" && collectionProgress.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>{collectionPhaseLabel}</span>
              <span>
                {collectionProgress.current} / {collectionProgress.total}
              </span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{
                  width: `${
                    collectionProgress.total > 0
                      ? (collectionProgress.current /
                          collectionProgress.total) *
                        100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {collectionSummary && (
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-green-400">
              ✓ {collectionSummary.created} created
            </span>
            <span className="text-indigo-300">
              ↻ {collectionSummary.updated} updated
            </span>
            <span className="text-yellow-400">
              ⊘ {collectionSummary.skipped} skipped
            </span>
            <span className="text-red-400">
              ✗ {collectionSummary.failed} failed
            </span>
            <span className="text-gray-400">
              ({collectionSummary.scannedMovies} scanned,{" "}
              {collectionSummary.matchedCollections} matched)
            </span>
          </div>
        )}

        {collectionItems.length > 0 && (
          <div className="rounded-lg bg-[#0f111a] border border-white/5 overflow-hidden">
            <div className="flex border-b border-white/5">
              {(
                [
                  { key: "created", label: "Created", color: "text-green-400" },
                  {
                    key: "updated",
                    label: "Updated",
                    color: "text-indigo-300",
                  },
                  {
                    key: "skipped",
                    label: "Skipped",
                    color: "text-yellow-400",
                  },
                  { key: "failed", label: "Failed", color: "text-red-400" },
                ] as const
              ).map(({ key, label, color }) => {
                const count = collectionItems.filter(
                  (item) => item.status === key,
                ).length;
                return (
                  <button
                    key={key}
                    onClick={() => setCollectionTab(key)}
                    className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
                      collectionTab === key
                        ? `bg-[#161824] border-b-2 ${
                            key === "created"
                              ? "border-green-500"
                              : key === "updated"
                                ? "border-indigo-400"
                                : key === "skipped"
                                  ? "border-yellow-500"
                                  : "border-red-500"
                          } ${color}`
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {label}{" "}
                    <span
                      className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                        collectionTab === key ? "bg-gray-700" : "bg-gray-800"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="max-h-64 overflow-y-auto p-3 space-y-1">
              {collectionItems.filter((item) => item.status === collectionTab)
                .length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-4">
                  No {collectionTab} items yet
                </p>
              ) : (
                collectionItems
                  .filter((item) => item.status === collectionTab)
                  .map((item, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs">
                      {item.status === "created" && (
                        <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                      )}
                      {item.status === "updated" && (
                        <RefreshCw className="w-3.5 h-3.5 text-indigo-300 mt-0.5 shrink-0" />
                      )}
                      {item.status === "skipped" && (
                        <SkipForward className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
                      )}
                      {item.status === "failed" && (
                        <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="text-gray-300 block truncate">
                          {item.title}
                        </span>
                        {item.reason && (
                          <span className="text-gray-600 block truncate">
                            {item.reason}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleCollectionSync}
          disabled={collectionSyncState === "running"}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/25"
        >
          {collectionSyncState === "running" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Syncing Collections…
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" /> Sync Plex Collections
            </>
          )}
        </button>
      </div>

      {/* ── LIBRARY SYNC ── */}
      <div className="bg-[#161824] border border-white/5 rounded-xl p-6 md:p-8 space-y-6 shadow-lg shadow-black/20">
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-1">
            Library Sync
          </h2>
          <p className="text-sm text-gray-500">
            Scan your existing Real-Debrid library and create Plex symlinks for
            all downloaded torrents. Safe to re-run — existing symlinks are
            skipped.
          </p>
        </div>

        {/* Error banner */}
        {syncError && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-2.5">
            <XCircle className="w-4 h-4 shrink-0" />
            {syncError}
          </div>
        )}

        {/* Progress bar */}
        {syncState === "running" && syncProgress.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Processing torrents…</span>
              <span>
                {syncProgress.current} / {syncProgress.total}
              </span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{
                  width: `${(syncProgress.current / syncProgress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Summary */}
        {syncSummary && (
          <div className="flex gap-4 text-sm">
            <span className="text-green-400">
              ✓ {syncSummary.synced} synced
            </span>
            <span className="text-yellow-400">
              ⊘ {syncSummary.skipped} skipped
            </span>
            <span className="text-red-400">✗ {syncSummary.failed} failed</span>
          </div>
        )}

        {/* Tabbed results */}
        {syncItems.length > 0 && (
          <div className="rounded-lg bg-[#0f111a] border border-white/5 overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-white/5">
              {(
                [
                  { key: "synced", label: "Synced", color: "text-green-400" },
                  {
                    key: "skipped",
                    label: "Skipped",
                    color: "text-yellow-400",
                  },
                  { key: "failed", label: "Failed", color: "text-red-400" },
                ] as const
              ).map(({ key, label, color }) => {
                const count = syncItems.filter((i) => i.status === key).length;
                return (
                  <button
                    key={key}
                    onClick={() => setSyncTab(key)}
                    className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
                      syncTab === key
                        ? `bg-[#161824] border-b-2 ${
                            key === "synced"
                              ? "border-green-500"
                              : key === "skipped"
                                ? "border-yellow-500"
                                : "border-red-500"
                          } ${color}`
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {label}{" "}
                    <span
                      className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                        syncTab === key ? "bg-gray-700" : "bg-gray-800"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="max-h-64 overflow-y-auto p-3 space-y-1">
              {syncItems.filter((i) => i.status === syncTab).length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-4">
                  No {syncTab} items yet
                </p>
              ) : (
                syncItems
                  .filter((i) => i.status === syncTab)
                  .map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      {item.status === "synced" && (
                        <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                      )}
                      {item.status === "skipped" && (
                        <SkipForward className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
                      )}
                      {item.status === "failed" && (
                        <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="text-gray-300 block truncate">
                          {item.status === "synced"
                            ? item.title
                            : item.filename}
                        </span>
                        {item.status === "synced" && item.filename && (
                          <span className="text-gray-600 block truncate">
                            {item.filename}
                          </span>
                        )}
                        {item.reason && (
                          <span className="text-gray-600">{item.reason}</span>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleSync}
          disabled={syncState === "running"}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/25"
        >
          {syncState === "running" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Syncing…
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" /> Sync RD Library
            </>
          )}
        </button>
      </div>
    </div>
  );
}
