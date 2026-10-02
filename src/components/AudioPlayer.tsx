/**
 * @file src/components/AudioPlayer.tsx
 * Lightweight, stable audio preview player for generated narrations.
 * Avoids recreating Audio instances on every render.
 */

import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Download, RotateCcw } from "lucide-react";

interface AudioPlayerProps {
  src: string; // Object URL
  fileName?: string;
  onDurationLoaded?: (durationSeconds: number) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, fileName, onDurationLoaded }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      const dur = audio.duration || 0;
      setDuration(dur);
      if (onDurationLoaded && dur > 0) {
        onDurationLoaded(dur);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, [src, onDurationLoaded]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => console.warn("Error reproduciendo audio:", err));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const newTime = (parseFloat(e.target.value) / 100) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(parseFloat(e.target.value));
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    setProgress(0);
    audio.play().catch(() => {});
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = fileName || "narration.mp3";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="audio-player-container">
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="audio-controls-row">
        <button
          type="button"
          onClick={togglePlay}
          className={`btn-play-pause ${isPlaying ? "playing" : ""}`}
          title={isPlaying ? "Pausar" : "Reproducir"}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={handleRestart}
          className="btn-icon-subtle"
          title="Reiniciar"
        >
          <RotateCcw size={12} />
        </button>

        <div className="seek-bar-wrapper">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progress || 0}
            onChange={handleSeek}
            className="seek-slider"
          />
        </div>

        <div className="time-display">
          <span>{formatTime(currentTime)}</span>
          <span className="time-divider">/</span>
          <span>{formatTime(duration)}</span>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          className="btn-icon-subtle download-btn"
          title="Descargar MP3"
        >
          <Download size={13} />
        </button>
      </div>
    </div>
  );
};
