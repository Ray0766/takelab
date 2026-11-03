import { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "./model";

interface Player {
  video: HTMLVideoElement;
  offset: number;
  duration: number;
}
export function useTransport(duration: number, fps: number) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const players = useRef(new Map<string, Player>());
  const current = useRef(0);
  const active = useRef(false);
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const sync = useCallback(
    (at: number, play: boolean, speed: number, force = false) => {
      for (const {
        video,
        offset,
        duration: length,
      } of players.current.values()) {
        const target = clamp(at + offset, 0, Math.max(0, length - 0.001));
        if (video.readyState < 1) continue;
        video.playbackRate = speed;
        if (force || Math.abs(video.currentTime - target) > 0.1) {
          if (force || !video.seeking) video.currentTime = target;
        }
        const shouldPlay = play && at + offset < length;
        if (shouldPlay && video.paused && !video.seeking)
          void video.play().catch(() => {
            setPlaying(false);
          });
        if (!shouldPlay && !video.paused) video.pause();
      }
    },
    [],
  );
  const seek = useCallback(
    (value: number) => {
      current.current = clamp(value, 0, durationRef.current);
      setTime(current.current);
      sync(current.current, active.current, rate, true);
    },
    [rate, sync],
  );
  const register = useCallback(
    (
      id: string,
      video: HTMLVideoElement | null,
      offset: number,
      length: number,
    ) => {
      if (video) {
        players.current.set(id, { video, offset, duration: length });
        if (video.readyState >= 1)
          video.currentTime = clamp(
            current.current + offset,
            0,
            Math.max(0, length - 0.001),
          );
      } else {
        players.current.get(id)?.video.pause();
        players.current.delete(id);
      }
    },
    [],
  );
  useEffect(() => {
    active.current = playing;
    sync(current.current, playing, rate, true);
    if (!playing) {
      setBuffering(false);
      return;
    }
    let frame = 0;
    let previous = performance.now();
    let lastUI = 0;
    const tick = (now: number) => {
      // Do not let a stalled decoder or a background tab race past unseen frames.
      const stalled = [...players.current.values()].some(
        (p) =>
          current.current + p.offset < p.duration - 0.05 &&
          !p.video.error &&
          (p.video.readyState < 3 || p.video.seeking),
      );
      const delta = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      if (!stalled) current.current += delta * rate;
      if (current.current >= durationRef.current) {
        current.current = loop ? 0 : durationRef.current;
        if (!loop) setPlaying(false);
        sync(current.current, loop, rate, true);
      } else sync(current.current, !stalled, rate);
      if (now - lastUI > 40) {
        setTime(current.current);
        setBuffering(stalled);
        lastUI = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const visibility = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
      for (const p of players.current.values()) p.video.pause();
    };
  }, [playing, rate, loop, sync]);
  useEffect(() => {
    if (current.current > duration) seek(duration);
    if (!duration) setPlaying(false);
  }, [duration, seek]);
  const toggle = useCallback(() => {
    if (durationRef.current <= 0) return;
    if (current.current >= durationRef.current) seek(0);
    setPlaying((v) => !v);
  }, [seek]);
  const step = useCallback(
    (direction: number) => {
      setPlaying(false);
      active.current = false;
      seek((Math.round(current.current * fps) + direction) / fps);
    },
    [fps, seek],
  );
  return {
    time,
    playing,
    buffering,
    rate,
    setRate,
    loop,
    setLoop,
    seek,
    toggle,
    step,
    register,
    pause: () => setPlaying(false),
  };
}
export type Transport = ReturnType<typeof useTransport>;
