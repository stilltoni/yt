import React, { useState, useEffect, useRef } from "react";
import { 
  Youtube, 
  Scissors, 
  Download, 
  Play, 
  Clock, 
  Info, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Volume2, 
  VolumeX, 
  Settings, 
  ExternalLink,
  Sliders,
  Terminal,
  ChevronDown,
  ChevronUp,
  FileVideo,
  Radio,
  CornerDownRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface VideoInfo {
  id: string;
  title: string;
  author: string;
  duration: number;
  isLive: boolean;
  thumbnail: string;
  resolutions: string[];
}

interface JobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  title: string;
  logs: string[];
}

export default function App() {
  // Input URL State
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);

  // Advanced Bypass Cookies State
  const [cookies, setCookies] = useState(() => localStorage.getItem("youtube_cookies") || "");
  const [showSettings, setShowSettings] = useState(false);

  // Focus cookies input helper
  const handleFocusCookies = () => {
    setShowSettings(true);
    setTimeout(() => {
      const el = document.getElementById("youtube-cookies-input");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
    }, 150);
  };

  // Clipping Configurations
  const [quality, setQuality] = useState("720p");
  const [mode, setMode] = useState<'fast' | 'precise'>("fast");
  
  // Start Time State (hh:mm:ss modeler)
  const [startHH, setStartHH] = useState("0");
  const [startMM, setStartMM] = useState("0");
  const [startSS, setStartSS] = useState("0");
  const [duration, setDuration] = useState(30); // Default 30s Segment

  // Job & Progress Poller
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Sync cookies with localStorage
  useEffect(() => {
    localStorage.setItem("youtube_cookies", cookies);
  }, [cookies]);

  // Audio preview play state (optional)
  const [previewPlaying, setPreviewPlaying] = useState(false);

  // Auto scroll logs
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [jobStatus?.logs, showLogs]);

  // Handle active polling for background clipper job
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (jobId) {
      const pollStatus = async () => {
        try {
          const res = await fetch(`/api/status/${jobId}`);
          if (!res.ok) throw new Error("Status endpoint returned error");
          const data: JobStatus = await res.json();
          setJobStatus(data);

          if (data.status === 'completed' || data.status === 'failed') {
            if (interval) clearInterval(interval);
            setJobId(null); // Stop polling
          }
        } catch (err) {
          console.error("Polling status error:", err);
        }
      };

      // Initial Call
      pollStatus();
      // Setup interval
      interval = setInterval(pollStatus, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jobId]);

  // Pre-configured YouTube examples
  const examples = [
    {
      name: "NASA Earth Live Stream (Live)",
      url: "https://www.youtube.com/watch?v=EEIk7gwjgIM",
      isLive: true
    },
    {
      name: "Relaxing Piano Music (UHD)",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      isLive: false
    },
    {
      name: "Lo-Fi Beats 24/7 Radio (Live)",
      url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
      isLive: true
    }
  ];

  // Helper to sync timestamps from slider
  const handleTimelineSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoInfo) return;
    const value = parseInt(e.target.value, 10);
    
    const hrs = Math.floor(value / 3600);
    const mins = Math.floor((value % 3600) / 60);
    const secs = value % 60;

    setStartHH(hrs.toString());
    setStartMM(mins.toString());
    setStartSS(secs.toString());
  };

  // Calculate cumulative start seconds
  const getStartSeconds = () => {
    const h = parseInt(startHH, 10) || 0;
    const m = parseInt(startMM, 10) || 0;
    const s = parseInt(startSS, 10) || 0;
    return h * 3600 + m * 60 + s;
  };

  // Convert digital values to formatted timestamp e.g. "01:05:30"
  const getFormattedStartTime = () => {
    const h = (parseInt(startHH, 10) || 0).toString().padStart(2, '0');
    const m = (parseInt(startMM, 10) || 0).toString().padStart(2, '0');
    const s = (parseInt(startSS, 10) || 0).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // Analyze the YouTube URL
  const handleAnalyze = async (inputUrl: string) => {
    if (!inputUrl.trim()) return;
    setLoading(true);
    setError(null);
    setVideoInfo(null);
    setJobId(null);
    setJobStatus(null);

    try {
      // Clean query parameters from URL besides video ID for cleaner request
      const cleanUrl = inputUrl.trim();
      const res = await fetch(`/api/analyze?url=${encodeURIComponent(cleanUrl)}`, {
        headers: cookies.trim() ? {
          "x-youtube-cookies": cookies.trim()
        } : {}
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ndodhi një gabim gjatë procesimit të videos.");
      }

      setVideoInfo(data);
      if (data.resolutions && data.resolutions.length > 0) {
        // Set default quality to top available or 720p
        if (data.resolutions.includes("720p")) {
          setQuality("720p");
        } else {
          setQuality(data.resolutions[0]);
        }
      }
      
      // Reset start time selectors
      setStartHH("0");
      setStartMM("0");
      setStartSS("0");
      setDuration(30); // reset to default 30s segment
    } catch (err: any) {
      setError(err.message || "Lidhja dështoi. Sigurohuni që keni vendosur një vegë të vlefshme YouTube Live ose Video.");
    } finally {
      setLoading(false);
    }
  };

  // Set preset examples
  const useExample = (presetUrl: string) => {
    setUrl(presetUrl);
    handleAnalyze(presetUrl);
  };

  // Initiate the clipping request
  const handleStartClipping = async () => {
    if (!videoInfo) return;
    setError(null);
    setJobId(null);
    setJobStatus(null);

    const startSecs = getStartSeconds();
    if (!videoInfo.isLive && startSecs >= videoInfo.duration) {
      setError("Koha e fillimit nuk mund të jetë më e madhe se kohëzgjatja e plotë e videos.");
      return;
    }

    try {
      const formattedStart = getFormattedStartTime();
      const payload = {
        url: url.trim(),
        startTime: formattedStart,
        duration: duration,
        quality: quality,
        mode: mode
      };

      const res = await fetch("/api/clip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookies.trim() ? { "x-youtube-cookies": cookies.trim() } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Dështoi fillimi i punës së prerjes.");
      }

      setJobId(data.jobId);
    } catch (err: any) {
      setError(err.message || "Ndodhi një gabim gjatë kërkesës së klipit gërshërë.");
    }
  };

  // Clear current active state to allow clipping a new video
  const handleReset = () => {
    setError(null);
    setVideoInfo(null);
    setJobId(null);
    setJobStatus(null);
    setUrl("");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased selection:bg-red-500/30 selection:text-red-200">
      
      {/* Top Navigation Bar adhering to the Sleek Interface theme */}
      <nav className="h-16 border-b border-slate-800 flex items-center justify-between px-6 sm:px-8 bg-slate-900/50 backdrop-blur-md relative z-25">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-900/20">
            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-1"></div>
          </div>
          <span className="text-xl font-bold tracking-tight text-white">LiveCutter <span className="text-red-500">Pro</span></span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm text-slate-400 font-medium select-none">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Server Status: <span className="text-green-400 font-semibold">Aktiv</span>
          </div>
        </div>
      </nav>

      {/* Absolute Ambient Background Glows */}
      <div className="absolute top-0 left-12 w-96 h-96 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 right-20 w-80 h-80 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Primary Container */}
      <div className="max-w-4xl w-full mx-auto px-4 py-8 flex-grow flex flex-col justify-start relative z-10">
        
        {/* Elegant Header Display */}
        <header className="text-center mb-8 mt-4">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-800/80 shadow-inner mb-4"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-xs font-mono font-semibold tracking-wider text-red-400 uppercase">
              SHKARKUES GJENERALIST LIVE & VOD
            </span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="text-3xl sm:text-4xl font-sans font-bold tracking-tight text-white mb-2"
          >
            Saktësi maksimale në <span className="bg-gradient-to-r from-red-500 via-orange-400 to-amber-500 bg-clip-text text-transparent">Klipim & Ruajtje</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-sm text-slate-400 max-w-lg mx-auto"
          >
            Prisni dhe shkarkoni segmentin tuaj të dëshiruar nga çdo video apo transmetim i drejtëpërdrejtë në YouTube, shpejt dhe pa humbje cilësie.
          </motion.p>
        </header>

        {/* Global Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-950/40 text-red-200 flex flex-col sm:flex-row items-stretch sm:items-start gap-4 shadow-lg"
            >
              <div className="flex gap-3 items-start flex-grow">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-grow">
                  <h4 className="text-sm font-semibold text-red-350">Ka ndodhur një gabim</h4>
                  <p className="text-xs mt-1 text-red-200 leading-relaxed">{error}</p>
                  {(error.includes("bot") || error.includes("cookies") || error.includes("bllokoi") || error.includes("kufizim") || error.includes("Cookies")) && (
                    <button
                      onClick={handleFocusCookies}
                      className="mt-2.5 px-3 py-1.5 bg-red-650 hover:bg-red-600 active:bg-red-750 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-2 border border-red-500/35 hover:scale-[1.02]"
                    >
                      <Settings className="w-3.5 h-3.5 animate-spin-slow" />
                      Vendos "YouTube Cookies" për të kaluar bllokimin
                    </button>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setError(null)} 
                className="text-red-400 hover:text-red-200 text-xs font-mono px-3 py-1.5 sm:py-0.5 rounded border border-red-500/25 hover:bg-red-500/10 cursor-pointer self-end sm:self-start shrink-0 text-center"
              >
                Mbyll
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video Analyzer Form State */}
        {!videoInfo && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl mb-6 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-red-600" />

            <div className="mb-4">
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-2 font-bold">
                BURIMI I VIDEOS (YOUTUBE LIVE URL MULTIPLE)
              </label>
              
              <div className="relative flex flex-col sm:flex-row gap-3">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Youtube className="w-5 h-5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="Shembull: https://www.youtube.com/watch?v=..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyze(url)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 transition-all font-sans text-sm shadow-inner"
                    disabled={loading}
                  />
                </div>
                
                <button
                  onClick={() => handleAnalyze(url)}
                  disabled={loading || !url.trim()}
                  className="px-6 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-900/20 transition-all disabled:opacity-40 cursor-pointer text-nowrap"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Duke Analizuar...
                    </>
                  ) : (
                    <>
                      <Scissors className="w-4 h-4" />
                      Ngarko Burimin
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Advanced/Bypass Cookies configuration accordion */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors cursor-pointer select-none"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Cilësime të avancuara (Bypass IP Blocks / Kufizimet e YouTube)</span>
                {showSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800"
                  >
                    <div className="flex items-start gap-2.5 text-xs text-amber-500 mb-3 bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        YouTube shpesh bllokon shkarkimet nga serverat cloud (p.sh. Cloud Run) me gabimin <code className="font-mono bg-amber-500/10 px-1 py-0.5 rounded text-amber-400 font-semibold">Video unavailable</code>, veçanërisht për videot muzikore të mbrojtura apo ato me kufizim moshe.
                        <br />
                        <span className="font-bold text-amber-450 mt-1 block">Zgjidhja:</span> Mund të kopjoni e të ngjitni <strong>Cookies</strong> e llogarisë suaj të YouTube në fushën e mëposhtme për të vërtetuar kërkesat si një përdorues real!
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                          YOUTUBE COOKIES (JSON, NETSCAPE, OSE RAW STRING):
                        </label>
                        {cookies && (
                          <button
                            type="button"
                            onClick={() => setCookies("")}
                            className="text-[10px] font-mono text-red-400 hover:text-red-300 underline cursor-pointer"
                          >
                            Pastro Cookies
                          </button>
                        )}
                      </div>
                      
                      <textarea
                        id="youtube-cookies-input"
                        rows={4}
                        placeholder={`Kopjo cookies këtu. Mbështet formatet:\n- Netscape format (nga shtesa 'Get cookies.txt')\n- JSON Array [{ "name": "...", "value": "..." }]\n- Rresht direkt Cookie ("GPS=1; YSC=...")`}
                        value={cookies}
                        onChange={(e) => setCookies(e.target.value)}
                        className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-600 focus:outline-none focus:border-red-500 transition-all font-mono text-xs focus:ring-1 focus:ring-red-500"
                      />
                      
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        <strong>Si t'i merrni:</strong> Shkarkoni një shtesë si <a href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/ccmclmfeidgnoihmgebeffondidfljbd" target="_blank" rel="noreferrer" className="text-red-400 hover:underline">Get cookies.txt Locally</a>, hapni YouTube.com, shkarkoni cookies për youtube, hapni skedarin dhe kopjoni të gjithë tekstin këtu. Të dhënat ruhen vetëm në shfletuesin tuaj lokal (localStorage).
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Configured Demo Video Section */}
            <div className="border-t border-slate-800/60 pt-5 mt-6">
              <h3 className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3 font-semibold">
                Testo Menjëherë me Shembuj të Shpejtë:
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {examples.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => useExample(ex.url)}
                    disabled={loading}
                    className="p-3 bg-slate-950/40 hover:bg-slate-950/90 rounded-xl border border-slate-800/60 hover:border-slate-700 transition-all text-left flex items-start gap-2.5 group cursor-pointer"
                  >
                    {ex.isLive ? (
                      <Radio className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 animate-pulse" />
                    ) : (
                      <FileVideo className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-slate-300 truncate group-hover:text-white transition-colors">{ex.name}</p>
                      <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">YouTube Stream Preset</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Processing/Completed Box Progress Overlay */}
        <AnimatePresence>
          {jobStatus && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl mb-6 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-red-600 via-orange-500 to-green-500 transition-all duration-300" style={{ width: `${jobStatus.progress}%` }} />

              {/* Status Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/60 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">STATUSI AKTUAL:</span>
                    <span className={`px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider rounded font-bold ${
                      jobStatus.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      jobStatus.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      'bg-red-500/10 text-red-450 border border-red-500/20 animate-pulse'
                    }`}>
                      {jobStatus.status === 'pending' && 'Në Pritje'}
                      {jobStatus.status === 'processing' && 'Duke u Kryer'}
                      {jobStatus.status === 'completed' && 'Përfunduar'}
                      {jobStatus.status === 'failed' && 'Gabim'}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white truncate mt-1.5 max-w-md">
                    {jobStatus.title}
                  </h3>
                </div>

                {jobStatus.status === 'completed' && (
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/download/${jobStatus.id}`}
                      target="_blank"
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-950/20 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      SHKARKO SEGMENTIN
                    </a>
                    
                    <button
                      onClick={handleReset}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-705 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all border border-slate-700 cursor-pointer"
                    >
                      Prisni një tjetër
                    </button>
                  </div>
                )}

                {jobStatus.status === 'failed' && (
                  <button
                    onClick={handleReset}
                    className="px-3 py-2 bg-red-950/40 hover:bg-red-900/40 rounded-lg text-xs font-medium text-red-300 hover:text-red-100 transition-all border border-red-500/20 cursor-pointer"
                  >
                    Rifillo n`fillim
                  </button>
                )}
              </div>

              {/* Progress Slider Display */}
              <div className="my-5">
                <div className="flex justify-between text-xs font-mono text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 animate-spin text-red-500" />
                    Segmentimi dhe bashkimi i rrjedhës...
                  </span>
                  <span className="font-semibold text-red-400">{jobStatus.progress}%</span>
                </div>

                <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800/80">
                  <div 
                    className="h-full bg-gradient-to-r from-red-600 via-orange-400 to-green-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${jobStatus.progress}%` }}
                  />
                </div>
              </div>

              {/* Live Preview Embed on completion */}
              {jobStatus.status === 'completed' && (
                <div className="mb-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 mb-2 text-xs font-mono text-slate-400">
                    <Play className="w-3.5 h-3.5 text-red-500" />
                    <span>PARAPAMJA E SEGMENTIT (PËR PREVIEW)</span>
                  </div>
                  <video 
                    src={`/api/download/${jobStatus.id}`} 
                    controls 
                    className="w-full h-auto rounded-lg max-h-80 bg-black aspect-video outline-none shadow-inner" 
                    playsInline
                  />
                  <div className="mt-2 text-[10px] font-mono text-slate-500 text-center uppercase tracking-wide">
                    Mund të luani direkt apo shkarkoni përmes player-it sipër.
                  </div>
                </div>
              )}

              {/* Toggleable Logs Drawer Terminal style */}
              <div className="border border-slate-800 bg-slate-950 rounded-xl overflow-hidden mt-4">
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="w-full px-4 py-2.5 bg-slate-900/60 hover:bg-slate-900 transition-colors flex justify-between items-center text-xs font-mono text-slate-400 font-medium cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-red-450" />
                    LOG-ET E PROCESIMIT TË FFmpeg
                  </span>
                  {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showLogs && (
                  <div className="p-3 bg-black max-h-40 overflow-y-auto font-mono text-[10px] leading-relaxed text-slate-400/80 border-t border-slate-800 select-text">
                    {jobStatus.logs.map((log, index) => (
                      <div key={index} className="border-b border-slate-910 pb-0.5 mb-0.5 truncate">
                        <span className="text-slate-600 mr-1">[{index + 1}]</span> {log}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Detailed Video Action Panel */}
        <AnimatePresence>
          {videoInfo && !jobStatus && (
            <motion.div
              initial={{ opacity: 0, scale: 0.99, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden mb-6"
            >
              {/* Media Card Main Info */}
              <div className="flex flex-col md:flex-row gap-6 p-6">
                
                {/* Embedded Thumbnail card with Live overlay */}
                <div className="w-full md:w-5/12 shrink-0 relative aspect-video rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-md">
                  <img 
                    src={videoInfo.thumbnail} 
                    alt={videoInfo.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  
                  {videoInfo.isLive ? (
                    <span className="absolute top-3 left-3 px-2 py-0.5 text-[9px] font-mono tracking-widest font-extrabold uppercase rounded bg-red-650 text-white flex items-center gap-1 shadow-md border border-red-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      LIVE TRANSMETIM
                    </span>
                  ) : (
                    <span className="absolute bottom-3 right-3 px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-black/85 text-white border border-slate-800/40">
                      {Math.floor(videoInfo.duration / 60)} min {videoInfo.duration % 60}s
                    </span>
                  )}
                </div>

                {/* Right text Details info */}
                <div className="flex-grow flex flex-col justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white leading-snug line-clamp-2">
                      {videoInfo.title}
                    </h2>
                    
                    <p className="text-xs text-red-400 font-mono mt-1 font-medium flex items-center gap-1">
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                      Sjellë nga kanali: {videoInfo.author}
                    </p>
                  </div>

                  <div className="border-t border-slate-800 pt-4 mt-4 flex items-center justify-between">
                    <button
                      onClick={handleReset}
                      className="text-xs font-mono font-medium text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-950"
                    >
                      Ndrysho Adresën (URL)
                    </button>

                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1.5"
                    >
                      Hape në YouTube
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Segment Segmentator Control panel */}
              <div className="border-t border-slate-800 bg-slate-900/30 p-6 flex flex-col gap-6">
                <div>
                  <h3 className="text-sm uppercase tracking-widest text-slate-500 font-bold mb-4 flex items-center gap-1.25">
                    <Sliders className="w-3.5 h-3.5 text-red-500" />
                    Parametrat e Segmentit
                  </h3>

                  {/* Standard Double Time Selectors */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                    
                    {/* Time Seek Selection box */}
                    <div className="p-4 bg-slate-950/45 rounded-xl border border-slate-800 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-400 block mb-2 uppercase">
                          {videoInfo.isLive ? 'Koha e fillimit (Timestamp)' : 'Koha e fillimit'}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col items-center">
                            <span className="text-[8px] font-mono text-slate-500 mb-0.5 uppercase">HH</span>
                            <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800">
                              <input
                                type="number"
                                min="0"
                                max="23"
                                value={startHH}
                                onChange={(e) => setStartHH(Math.max(0, parseInt(e.target.value, 10) || 0).toString())}
                                className="w-12 py-1.5 text-center bg-transparent text-sm focus:outline-none focus:text-red-400 font-mono font-semibold"
                              />
                            </div>
                          </div>
                          
                          <span className="text-slate-600 font-mono mt-3 font-bold">:</span>

                          <div className="flex flex-col items-center">
                            <span className="text-[8px] font-mono text-slate-500 mb-0.5 uppercase">MM</span>
                            <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800">
                              <input
                                type="number"
                                min="0"
                                max="59"
                                value={startMM}
                                onChange={(e) => setStartMM(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)).toString())}
                                className="w-12 py-1.5 text-center bg-transparent text-sm focus:outline-none focus:text-red-400 font-mono font-semibold"
                              />
                            </div>
                          </div>

                          <span className="text-slate-600 font-mono mt-3 font-bold">:</span>

                          <div className="flex flex-col items-center">
                            <span className="text-[8px] font-mono text-slate-500 mb-0.5 uppercase">SS</span>
                            <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800">
                              <input
                                type="number"
                                min="0"
                                max="59"
                                value={startSS}
                                onChange={(e) => setStartSS(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)).toString())}
                                className="w-12 py-1.5 text-center bg-transparent text-sm focus:outline-none focus:text-red-400 font-mono font-semibold"
                              />
                            </div>
                          </div>

                          <div className="ml-2 mt-4 text-xs font-mono text-slate-500">
                            (Pika e nisjes)
                          </div>
                        </div>
                      </div>

                      {/* Info on seekers for livestreams */}
                      {videoInfo.isLive && (
                        <div className="text-[10px] text-amber-300 mt-2 flex items-start gap-1 leading-relaxed">
                          <Info className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                          <span>Për live, 00:00:00 fillon nga fillimi i playlistës aktive, ose lëreni bosh për transmetim nga pika aktuale.</span>
                        </div>
                      )}
                    </div>

                    {/* Duration input box section */}
                    <div className="p-4 bg-slate-950/45 rounded-xl border border-slate-800 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-400 block mb-2 uppercase">
                          Kohëzgjatja e klipit (Sekonda)
                        </span>
                        
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min="2"
                            max="900"
                            value={duration}
                            onChange={(e) => setDuration(Math.min(900, Math.max(2, parseInt(e.target.value, 10) || 2)))}
                            className="px-3 py-1.5 bg-slate-900 rounded-lg border border-slate-800 text-sm font-semibold text-red-400 font-mono max-w-24 focus:outline-none focus:border-red-500/50"
                          />
                          
                          <div className="text-xs font-mono text-slate-500">
                            sekonda max. (15 m)
                          </div>
                        </div>
                      </div>

                      {/* Duration quick selects */}
                      <div className="flex flex-wrap gap-1.5 mt-3 pt-2">
                        {[15, 30, 60, 120, 300].map((sec) => (
                          <button
                            key={sec}
                            onClick={() => setDuration(sec)}
                            className={`px-2 py-1 rounded text-[10px] font-mono transition-all cursor-pointer border ${
                              duration === sec 
                                ? 'bg-red-500/10 text-red-400 border-red-500/40 font-semibold' 
                                : 'bg-slate-900 text-slate-500 border-transparent hover:bg-slate-850 hover:text-slate-300'
                            }`}
                          >
                            {sec < 60 ? `${sec}s` : `${sec / 60}m`}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Visual timeline slider if VOD is short/medium adhering to Sleek Interface timeline */}
                  <div className="p-4 bg-slate-950/30 rounded-xl border border-slate-800 mb-5">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-sm uppercase tracking-widest text-slate-500 font-bold">Timeline Vizual</h2>
                      <span className="text-xs font-mono text-slate-400">Kohëzgjatja e zgjedhur: {duration}s (fillon nga {getFormattedStartTime()})</span>
                    </div>
                    
                    <div className="relative h-12 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden flex items-center">
                      {/* Interactive range slider on top */}
                      {!videoInfo.isLive && videoInfo.duration > 0 ? (
                        <input
                          type="range"
                          min="0"
                          max={videoInfo.duration}
                          value={getStartSeconds()}
                          onChange={handleTimelineSliderChange}
                          className="absolute inset-x-0 w-full h-full opacity-60 accent-red-650 cursor-pointer z-20"
                        />
                      ) : null}

                      {/* Custom selection bounds resembling mockup timeline */}
                      <div className="absolute h-full bg-red-600/20 border-x-2 border-red-500 left-1/3 w-1/4 flex items-center justify-between px-2 z-10 pointer-events-none">
                        <div className="w-1 h-6 bg-red-500 rounded-full"></div>
                        <div className="w-1 h-6 bg-red-500 rounded-full"></div>
                      </div>

                      {/* Waveform bits fake resembling a live audio/video bitstream */}
                      <div className="absolute inset-0 flex items-center justify-around px-4 opacity-15 pointer-events-none">
                        <div className="w-1 h-4 bg-white"></div><div className="w-1 h-8 bg-white"></div><div className="w-1 h-6 bg-white"></div><div className="w-1 h-10 bg-white"></div>
                        <div className="w-1 h-4 bg-white"></div><div className="w-1 h-8 bg-white"></div><div className="w-1 h-6 bg-white"></div><div className="w-1 h-10 bg-white"></div>
                        <div className="w-1 h-4 bg-white"></div><div className="w-1 h-8 bg-white"></div><div className="w-1 h-6 bg-white"></div><div className="w-1 h-10 bg-white"></div>
                        <div className="w-1 h-4 bg-white"></div><div className="w-1 h-8 bg-white"></div><div className="w-1 h-6 bg-white"></div><div className="w-1 h-10 bg-white"></div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between mt-2 text-[10px] font-mono text-slate-550">
                      <span>{getFormattedStartTime()}</span>
                      <span>Kushtuar: {videoInfo.isLive ? 'Transmetim aktiv live' : formatDuration(videoInfo.duration)}</span>
                    </div>
                  </div>

                  {/* Advanced Configuration Settings (Quality label / re-code mode) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Quality Formats Dropdown selection */}
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/20">
                      <label className="text-xs font-semibold text-slate-400 block mb-2 uppercase">
                        Cilësia e Shkarkimit
                      </label>
                      <div className="relative">
                        <select
                          value={quality}
                          onChange={(e) => setQuality(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-950 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 focus:outline-none focus:border-red-500 appearance-none cursor-pointer"
                        >
                          {videoInfo.resolutions.map((resOption) => (
                            <option key={resOption} value={resOption}>
                              {resOption} (Rezolutë e plotë)
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    {/* Processing Mode selector */}
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/20">
                      <label className="text-xs font-semibold text-slate-400 block mb-2 uppercase flex items-center justify-between">
                        Saktësia/Metoda
                        <span className="text-[9px] font-normal text-slate-500 lowercase normal-case">kopjo vs ri-kodifiko</span>
                      </label>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setMode('fast')}
                          className={`py-2 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                            mode === 'fast'
                              ? 'bg-red-500/10 border-red-550 text-red-400 shadow-md'
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <span>Kopjim Shpejtë</span>
                          <span className="text-[8px] opacity-75 mt-0.5 font-mono">Ekstra-Shpejtë ⚡</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => setMode('precise')}
                          className={`py-2 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                            mode === 'precise'
                              ? 'bg-red-500/10 border-red-550 text-red-400 shadow-md'
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <span>Prerje Preçize</span>
                          <span className="text-[8px] opacity-75 mt-0.5 font-mono">Saktësi Kuadri 🎯</span>
                        </button>
                      </div>
                    </div>

                  </div>

                </div>

                {/* Confirm starting button */}
                <div className="pt-2">
                  <button
                    onClick={handleStartClipping}
                    className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-3 cursor-pointer group uppercase tracking-widest text-sm"
                  >
                    <Download className="w-5 h-5 transition-transform group-hover:translate-y-0.5" />
                    Bëj Klipin dhe Fillo Shkarkimin
                  </button>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Structured Mockup Status Bar Footer */}
      <footer className="h-10 bg-slate-900 border-t border-slate-800 flex items-center px-4 sm:px-8 justify-between text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-auto select-none relative z-25">
        <div className="flex gap-4 sm:gap-6">
          <span>DISK SPACE: 42.1 GB LIRË</span>
          <span className="hidden sm:inline">BUFFER: 100%</span>
        </div>
        <div className="text-red-400 text-right">SISTEMI GATI PËR EKSPORTIM</div>
      </footer>

    </div>
  );
}

// Utility to format duration properly for readable displays
function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [
    h > 0 ? h : null,
    m.toString().padStart(h > 0 ? 2 : 1, '0'),
    s.toString().padStart(2, '0')
  ].filter(x => x !== null).join(':');
}
