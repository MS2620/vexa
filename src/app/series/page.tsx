'use client';
import { useState, useEffect } from 'react';
import { X, Loader2, Play, Filter, SortDesc, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SeriesPage() {
  const [series, setSeries] = useState<any[]>([]);
  const router = useRouter();

  // Pagination State
  const [page, setPage] = useState(1);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // Modal State
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [streams, setStreams] = useState<any[]>([]);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [downloadingHash, setDownloadingHash] = useState<string | null>(null);

  // TV Show State
  const [tvMode, setTvMode] = useState<'episode' | 'season'>('episode');
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  

  // Fetch movies when 'page' state changes
  useEffect(() => {
    const fetchSeries = async () => {
      if (page === 1) setLoadingInitial(true);
      else setLoadingMore(true);

      try {
        const res = await fetch(`/api/series?page=${page}`);
        const data = await res.json();
        
        const newSeries = data.results || [];
        
        // If TMDB returns an empty array, we've reached the end
        if (newSeries.length === 0) {
          setHasMore(false);
        } else {
          // If it's page 1, replace. If > 1, append to existing array.
          setSeries(prev => page === 1 ? newSeries : [...prev, ...newSeries]);
        }
      } catch (error) {
        console.error("Failed to fetch series", error);
      } finally {
        setLoadingInitial(false);
        setLoadingMore(false);
      }
    };
    fetchSeries();
  }, [page]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const fetchStreams = async (mediaToFetch?: any) => {
    setLoadingStreams(true);
    
    // Fallback to state if we didn't pass the media directly
    const media = mediaToFetch || selectedMedia; 
    
    if (!media) return;

    // Determine type: TMDB usually provides media_type in search results. 
    // If not, we fall back to checking if it has a 'first_air_date' (which means it's a TV show)
    const type = media.media_type || (media.first_air_date ? 'tv' : 'movie');

    const fetchEpisode = tvMode === 'season' ? 1 : episode;
    
    try {
      const res = await fetch(`/api/streams?tmdbId=${media.id}&type=${type}&s=${season}&e=${fetchEpisode}`);
      const data = await res.json();
      setStreams(data.streams || []);
    } catch (err) {
      console.error("Error fetching streams", err);
      setStreams([]);
    } finally {
      setLoadingStreams(false);
    }
  };

  const handleDownload = async (infoHash: string, streamIndex: number = 0) => {
    setDownloadingHash(infoHash);
    
    try {
      const res = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          infoHash,
          tmdbId: selectedMedia?.id,
          title: selectedMedia?.title,
          posterPath: selectedMedia?.poster_path,
          mediaType: 'tv',
          season: season,
          episode: episode,
        })
      });

      const data = await res.json();

      if (!data.success) {
        // If RD blocked this torrent, silently try the next one in the list
        if (data.code === 'infringing_file') {
          const nextStream = streams[streamIndex + 1];
          if (nextStream?.infoHash) {
            console.warn(`Stream ${streamIndex} blocked by RD, trying stream ${streamIndex + 1}...`);
            setDownloadingHash(null);
            // Small delay so the user sees the button reset before trying again
            await new Promise(resolve => setTimeout(resolve, 500));
            return handleDownload(nextStream.infoHash, streamIndex + 1);
          } else {
            // We've exhausted all streams
            alert('All available streams are blocked by Real-Debrid for this title. Try a different quality or search again later.');
          }
        } else {
          // For all other errors, show the message
          alert(`Failed: ${data.error}`);
        }
      } else {
        // Success!
        setSelectedMedia(null);
        alert('Sent to Real-Debrid and Plex!');
      }
    } catch (err) {
      alert('Something went wrong. Check the console.');
      console.error(err);
    } finally {
      setDownloadingHash(null);
    }
  };



  const PosterCard = ({ media }: { media: any }) => (
    <div onClick={() => router.push(`/media/tv/${media.id}`)} className="rounded-xl overflow-hidden cursor-pointer relative group transition-transform hover:scale-105 flex flex-col h-full bg-[#161824] border border-gray-800/50 hover:border-indigo-500/50 shadow-lg">
      <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg z-10 uppercase tracking-wider">
        TV SHOW
      </div>
      <div className="relative aspect-[2/3] w-full bg-gray-800 shrink-0">
        {media.poster_path ? (
          <img src={`https://image.tmdb.org/t/p/w500${media.poster_path}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">No Image</div>
        )}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
           <Play className="w-10 h-10 text-white drop-shadow-lg" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="pt-6 pb-12 animate-in fade-in">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <h1 className="text-3xl font-bold text-indigo-400">TV Shows</h1>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-[#161824] border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white transition-colors">
            <SortDesc className="w-4 h-4" />
            Popularity Descending
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#161824] border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white transition-colors">
            <Filter className="w-4 h-4" />
            0 Active Filters
          </button>
        </div>
      </div>

      {/* Initial Loading State */}
      {loadingInitial ? (
        <div className="flex justify-center py-32">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        </div>
      ) : (
        <>
          {/* Dense Poster Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 mb-10">
              {series.map((media, idx) => (
              // Use idx appended to ID in case TMDB returns duplicates across pages
              <PosterCard key={`${media.id}-${idx}`} media={media} /> 
            ))}
          </div>

          {/* Load More Button / Pagination */}
          {hasMore && (
            <div className="flex justify-center mt-8">
              <button 
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-8 py-3 bg-[#161824] hover:bg-[#1f2233] border border-gray-700 hover:border-indigo-500 text-white rounded-full font-medium transition-all shadow-lg disabled:opacity-50"
              >
                {loadingMore ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Loading...</>
                ) : (
                  <>Load More <ChevronDown className="w-5 h-5" /></>
                )}
              </button>
            </div>
          )}
        </>
      )}

            {/* MODAL */}
            {selectedMedia && (
        <div className="fixed inset-0 bg-[#0f111a]/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#161824] border border-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold">{selectedMedia.title || selectedMedia.name}</h2>
                <p className="text-gray-400 text-sm mt-1">
                  {(selectedMedia.media_type === 'tv' || selectedMedia.first_air_date) ? 'TV Series' : 'Movie'} • {(selectedMedia.first_air_date)?.substring(0, 4)}
                </p>
              </div>
              <button onClick={() => setSelectedMedia(null)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
            </div>

            {/* TV Show Selectors (Added back so TV shows work here) */}
            {(selectedMedia.media_type === 'tv' || selectedMedia.first_air_date) && (
              <div className="flex gap-4 mb-6 bg-[#0f111a] p-4 rounded-lg">
                <div>
                  <select value={tvMode} onChange={(e) => setTvMode(e.target.value as any)} className="bg-[#161824] border border-gray-700 rounded p-2 text-sm text-white">
                    <option value="episode">Single Episode</option>
                    <option value="season">Whole Season</option>
                  </select>
                </div>
                <div>
                  <input type="number" min="1" value={season} onChange={e => setSeason(Number(e.target.value))} className="bg-[#161824] border border-gray-700 rounded p-2 w-16 text-sm" placeholder="S" />
                </div>
                {tvMode === 'episode' && (
                  <div>
                    <input type="number" min="1" value={episode} onChange={e => setEpisode(Number(e.target.value))} className="bg-[#161824] border border-gray-700 rounded p-2 w-16 text-sm" placeholder="E" />
                  </div>
                )}
                <div className="flex items-end">
                  <button onClick={() => fetchStreams()} className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded text-sm font-medium">Find Streams</button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {loadingStreams && <div className="flex items-center gap-2 text-gray-400"><Loader2 className="animate-spin w-5 h-5"/> Scraping sources...</div>}
              {!loadingStreams && streams.map((stream, idx) => (
                <div key={idx} className="bg-[#0f111a] p-4 rounded-lg flex justify-between items-center border border-gray-800 hover:border-indigo-500/50 transition-colors">
                  <div className="flex-1 pr-4">
                    <span className="inline-block px-2 py-1 bg-[#161824] rounded text-[10px] font-bold text-indigo-400 mb-2 border border-gray-700 mr-2 uppercase">{stream.name}</span>
                    <p className="text-xs text-gray-300 line-clamp-2">{stream.title}</p>
                  </div>
                  <button 
                    onClick={() => handleDownload(stream.infoHash, idx)}
                    disabled={downloadingHash === stream.infoHash}
                    className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-medium shrink-0 transition-colors"
                  >
                    {downloadingHash === stream.infoHash ? 'Trying...' : 'Download'}
                  </button>
                </div>
              ))}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
