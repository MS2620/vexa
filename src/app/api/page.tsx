'use client';
import { useState, useEffect } from 'react';
import { Loader2, Film, Tv, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    Requested: 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/30',
    Available: 'bg-green-600/30 text-green-400 border border-green-500/30',
    Downloading: 'bg-yellow-600/30 text-yellow-400 border border-yellow-500/30',
    Failed: 'bg-red-600/30 text-red-400 border border-red-500/30',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${styles[status] || styles.Requested}`}>
      {status}
    </span>
  );
};

export default function RequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/dashboard/requests')
      .then(res => res.json())
      .then(data => {
        setRequests(data.results || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="pt-6 animate-in fade-in">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-indigo-400">Requests</h1>
        <span className="text-sm text-gray-500">{requests.length} total</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-gray-500">
          <Clock className="w-12 h-12 mb-4 opacity-30" />
          <p>No requests yet. Find something to watch!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              onClick={() => req.tmdb_id && router.push(`/media/${req.media_type}/${req.tmdb_id}`)}
              className="bg-[#161824] border border-gray-800 rounded-xl p-4 flex items-center gap-5 hover:border-gray-700 transition-colors cursor-pointer"
            >
              {/* Poster */}
              <div className="w-12 h-16 bg-gray-800 rounded-lg overflow-hidden shrink-0">
                {req.poster_path ? (
                  <img src={`https://image.tmdb.org/t/p/w200${req.poster_path}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {req.media_type === 'tv' ? <Tv className="w-5 h-5 text-gray-600" /> : <Film className="w-5 h-5 text-gray-600" />}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                    {req.media_type === 'tv' ? 'Series' : 'Movie'}
                  </span>
                  <h3 className="font-semibold text-white truncate">{req.title}</h3>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-pink-600 flex items-center justify-center text-[8px] font-bold text-white">
                      {req.requested_by?.charAt(0).toUpperCase()}
                    </div>
                    {req.requested_by}
                  </div>
                  {req.season && (
                    <span>Season {req.season}{req.episode ? ` · Episode ${req.episode}` : ' (Full Season)'}</span>
                  )}
                  <span>{new Date(req.requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>

              {/* Status */}
              <div className="shrink-0">
                <StatusBadge status={req.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
