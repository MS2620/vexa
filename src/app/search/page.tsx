'use client';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, Play } from 'lucide-react';
import { Suspense } from 'react';

function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => {
        setResults(data.results || []);
        setLoading(false);
      });
  }, [query]);

  return (
    <div className="pt-6 animate-in fade-in">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">
          Results for <span className="text-indigo-400">"{query}"</span>
        </h1>
        <span className="text-sm text-gray-500">{results.length} found</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-gray-500">
          <p>No results found for "{query}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {results.map((media) => {
            const isTv = media.media_type === 'tv' || media.first_air_date;
            const type = media.media_type || (isTv ? 'tv' : 'movie');
            
            return (
              <div
                key={media.id}
                onClick={() => router.push(`/media/${type}/${media.id}`)}
                className="rounded-xl overflow-hidden cursor-pointer relative group transition-transform hover:scale-105 bg-[#161824] border border-gray-800/50 hover:border-indigo-500/50"
              >
                <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg z-10 uppercase tracking-wider">
                  {isTv ? 'Series' : 'Movie'}
                </div>
                <div className="relative aspect-[2/3] w-full bg-gray-800">
                  {media.poster_path ? (
                    <img 
                      src={`https://image.tmdb.org/t/p/w500${media.poster_path}`} 
                      className="absolute inset-0 w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-center p-2 text-sm">
                      {media.title || media.name}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-10 h-10 text-white drop-shadow-lg" />
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-white text-xs font-semibold truncate">{media.title || media.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{(media.release_date || media.first_air_date)?.substring(0, 4)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Wrap in Suspense because useSearchParams requires it in Next.js App Router
export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>}>
      <SearchResults />
    </Suspense>
  );
}
