"use client";

import { useEffect, useState } from "react";
import {
  Terminal,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  Download,
  Trash2,
} from "lucide-react";

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    // Auto refresh every 5 seconds
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const clearLogs = async () => {
    const confirmed = window.confirm("Clear all logs? This cannot be undone.");
    if (!confirmed) return;

    setClearing(true);
    try {
      const res = await fetch("/api/logs", { method: "DELETE" });
      if (res.ok) {
        setLogs([]);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to clear logs");
      }
    } catch {
      alert("Failed to clear logs");
    } finally {
      setClearing(false);
    }
  };

  const downloadLogs = () => {
    const lines = logs.map((log) => {
      const timestamp = new Date(log.timestamp).toISOString();
      const level = String(log.level || "info").toUpperCase();
      const message = String(log.message || "");
      const context = log.context ? ` | context: ${log.context}` : "";
      return `[${timestamp}] [${level}] ${message}${context}`;
    });

    const content = lines.join("\n") || "No logs found.";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    anchor.href = url;
    anchor.download = `vexa-logs-${stamp}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "warn":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLevelStyle = (level: string) => {
    switch (level) {
      case "error":
        return "border-l-4 border-red-500 bg-red-500/5";
      case "success":
        return "border-l-4 border-green-500 bg-green-500/5";
      case "warn":
        return "border-l-4 border-yellow-500 bg-yellow-500/5";
      default:
        return "border-l-4 border-blue-500 bg-blue-500/5";
    }
  };

  return (
    <div className="pt-4 pb-12 px-6 md:px-12 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-3">
            <Terminal className="w-8 h-8 text-indigo-500" /> System Logs
          </h1>
          <p className="text-gray-400 text-sm">
            Monitor live background processes and request stages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadLogs}
            className="flex items-center justify-center gap-2 bg-[#161824] hover:bg-white/5 border border-white/5 px-4 py-2 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download .txt
          </button>
          <button
            onClick={clearLogs}
            disabled={clearing}
            className="flex items-center justify-center gap-2 bg-[#161824] hover:bg-red-500/10 border border-white/5 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 className={`w-4 h-4 ${clearing ? "animate-pulse" : ""}`} />
            Clear All
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-[#161824] hover:bg-white/5 border border-white/5 px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-[#0f111a] border border-white/5 rounded-xl shadow-xl shadow-black/40 p-4 font-mono text-sm max-h-[70vh] overflow-y-auto w-full">
        {logs.length === 0 && !loading ? (
          <div className="text-center py-10 text-gray-500">No logs found.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`flex flex-col p-3 rounded-r-lg ${getLevelStyle(log.level)} transition-colors hover:bg-white/5`}
              >
                <div className="flex items-start md:items-center gap-3">
                  {getLevelIcon(log.level)}
                  <span className="text-gray-500 text-xs shrink-0 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                  <span className="text-gray-200 font-medium ml-2">
                    {log.message}
                  </span>
                </div>
                {log.context && (
                  <div className="mt-2 ml-7 pl-6 border-l border-white/10 text-xs text-gray-400">
                    {log.context}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
