"use client";

import { useEffect, useRef, useState } from "react";

/** Decorative local video: silent, viewport-aware, and a still for reduced motion. */
export function SilentVideo({ src, poster, className = "" }: { src: string; poster: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const sync = () => {
      if (!visible || motion.matches || document.hidden) { video.pause(); return; }
      setLoad(true);
      video.muted = true;
      void video.play().catch(() => { /* Poster remains when autoplay is unavailable. */ });
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.05 });
    observer.observe(video);
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    video.addEventListener("canplay", sync);
    return () => { observer.disconnect(); video.pause(); motion.removeEventListener("change", sync); document.removeEventListener("visibilitychange", sync); video.removeEventListener("canplay", sync); };
  }, []);
  return <div className={`overflow-hidden ${className}`} aria-hidden="true">
    <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
    <video ref={ref} src={load && !failed ? src : undefined} poster={poster} muted loop playsInline controls={false} disablePictureInPicture disableRemotePlayback preload="none" onError={() => setFailed(true)} className={`absolute inset-0 h-full w-full object-cover pointer-events-none ${failed ? "invisible" : ""}`} tabIndex={-1} />
  </div>;
}
