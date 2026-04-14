"use client";

import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings,
  RotateCcw,
  RotateCw,
} from "lucide-react";

interface VideoPlayerProps {
  src: string;
  onEnded?: () => void;
  poster?: string;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayer({ src, onEnded, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [rate, setRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showCenterIcon, setShowCenterIcon] = useState<"play" | "pause" | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset on src change
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
  }, [src]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setShowCenterIcon("play");
    } else {
      v.pause();
      setShowCenterIcon("pause");
    }
    setTimeout(() => setShowCenterIcon(null), 400);
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.buffered.length > 0) {
      setBuffered(v.buffered.end(v.buffered.length - 1));
    }
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
  };

  const handleSeek = (pct: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = pct * duration;
  };

  const skip = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + delta));
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const setVol = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
  };

  const toggleFullscreen = async () => {
    const c = containerRef.current;
    if (!c) return;
    if (!document.fullscreenElement) {
      await c.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  };

  const changeRate = (r: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = r;
    setRate(r);
    setShowSpeedMenu(false);
  };

  // Keep fullscreen state in sync
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Auto-hide controls when playing
  const scheduleHide = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setControlsVisible(true);
    if (playing) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2500);
    }
  };

  useEffect(() => {
    scheduleHide();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) {
        return;
      }
      if (["INPUT", "TEXTAREA"].includes((document.activeElement?.tagName || ""))) return;
      if (!videoRef.current) return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") {
        skip(5);
      } else if (e.key === "ArrowLeft") {
        skip(-5);
      } else if (e.key === "m") {
        toggleMute();
      } else if (e.key === "f") {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const fmt = (s: number) => {
    if (!Number.isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={scheduleHide}
      onMouseLeave={() => playing && setControlsVisible(false)}
      className={`group relative bg-black overflow-hidden shadow-2xl ${
        fullscreen ? "w-screen h-screen rounded-none" : "rounded-2xl"
      }`}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          onEnded?.();
        }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onProgress={handleTimeUpdate}
        playsInline
        className="w-full h-full block aspect-video cursor-pointer"
      />

      {/* Center big play button when paused */}
      {!playing && (
        <button
          onClick={togglePlay}
          aria-label="Reproducir"
          className="absolute inset-0 flex items-center justify-center group/play"
        >
          <div className="w-20 h-20 rounded-full bg-[#ff9900]/90 hover:bg-[#ff9900] shadow-2xl flex items-center justify-center transition-transform group-hover/play:scale-110">
            <Play className="w-10 h-10 text-white fill-white ml-1" />
          </div>
        </button>
      )}

      {/* Fade center play/pause feedback */}
      {showCenterIcon && playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center animate-[playPulse_0.4s_ease-out]">
            {showCenterIcon === "play" ? (
              <Play className="w-7 h-7 text-white fill-white ml-0.5" />
            ) : (
              <Pause className="w-7 h-7 text-white fill-white" />
            )}
          </div>
        </div>
      )}

      {/* Top gradient */}
      <div
        className={`pointer-events-none absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/60 to-transparent transition-opacity ${
          controlsVisible ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Bottom controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-4 pb-3 pt-10 bg-gradient-to-t from-black/80 via-black/50 to-transparent transition-opacity ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Progress bar */}
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            handleSeek(pct);
          }}
          className="relative h-1.5 bg-white/25 rounded-full cursor-pointer group/bar hover:h-2 transition-all mb-2"
        >
          <div
            className="absolute inset-y-0 left-0 bg-white/40 rounded-full"
            style={{ width: `${bufferPct}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-[#ff9900] rounded-full"
            style={{ width: `${progressPct}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#ff9900] shadow-lg scale-0 group-hover/bar:scale-100 transition-transform"
            style={{ left: `calc(${progressPct}% - 6px)` }}
          />
        </div>

        <div className="flex items-center gap-2 text-white">
          <button onClick={togglePlay} className="p-1.5 hover:bg-white/15 rounded-full transition" aria-label={playing ? "Pausar" : "Reproducir"}>
            {playing ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
          </button>

          <button onClick={() => skip(-10)} className="p-1.5 hover:bg-white/15 rounded-full transition" aria-label="Retroceder 10s">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={() => skip(10)} className="p-1.5 hover:bg-white/15 rounded-full transition" aria-label="Avanzar 10s">
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1.5 group/vol">
            <button onClick={toggleMute} className="p-1.5 hover:bg-white/15 rounded-full transition">
              {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => setVol(Number(e.target.value))}
              className="w-0 group-hover/vol:w-20 transition-all accent-[#ff9900] cursor-pointer"
            />
          </div>

          <span className="text-xs font-mono tabular-nums">
            {fmt(currentTime)} <span className="text-white/50">/ {fmt(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-1">
            {/* Playback speed */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu((s) => !s)}
                className="p-1.5 hover:bg-white/15 rounded-full transition flex items-center gap-1"
                aria-label="Velocidad"
              >
                <Settings className="w-4 h-4" />
                {rate !== 1 && (
                  <span className="text-xs font-semibold">{rate}x</span>
                )}
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-sm rounded-lg p-1 min-w-[90px] shadow-xl">
                  {PLAYBACK_RATES.map((r) => (
                    <button
                      key={r}
                      onClick={() => changeRate(r)}
                      className={`block w-full text-left px-3 py-1.5 text-xs rounded hover:bg-white/15 ${
                        r === rate ? "text-[#ff9900] font-semibold" : "text-white"
                      }`}
                    >
                      {r}x {r === 1 && "(normal)"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={toggleFullscreen} className="p-1.5 hover:bg-white/15 rounded-full transition" aria-label="Pantalla completa">
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes playPulse {
          0% { opacity: 0; transform: scale(0.6); }
          40% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
