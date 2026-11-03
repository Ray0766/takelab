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
        if (
          (force && Math.abs(video.currentTime - target) > 0.001) ||
          Math.abs(video.currentTime - target) > 0.1
        ) {
          if (force || !video.seeking) video.currentTime = target;
        }
        const shouldPlay = play && at + offset < length;
        if (shouldPlay && video.paused && !video.seeking)
          void video.play().catch((error: unknown) => {
            // Seeking/pausing can cancel an earlier play request normally.
            if (
              active.current &&
              !(error instanceof DOMException && error.name === "AbortError")
            )
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
      setTime(current.current);
      setBuffering(false);
      return;
    }
    let frame = 0;
    let lastUI = 0;
    const tick = (now: number) => {
      // Do not let a stalled decoder or a background tab race past unseen frames.
      const stalled = [...players.current.values()].some(
        (p) =>
          current.current + p.offset < p.duration - 0.05 &&
          !p.video.error &&
          (p.video.readyState < 3 || p.video.seeking),
      );
      // Follow the longest available source's actual media clock. A wall clock
      // can outrun audio startup at 2x and repeatedly seek every decoder.
      const leader = [...players.current.values()]
        .filter((p) => !p.video.error && p.video.readyState >= 2)
        .sort((a, b) => b.duration - b.offset - (a.duration - a.offset))[0];
      if (!stalled && leader && !leader.video.paused)
        current.current = clamp(
          leader.video.currentTime - leader.offset,
          0,
          durationRef.current,
        );
      if (!stalled && leader?.video.ended)
        current.current = durationRef.current;
      if (current.current >= durationRef.current) {
        current.current = loop ? 0 : durationRef.current;
        setTime(current.current);
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
  const pause = useCallback(() => {
    // Freeze the actual media position before publishing the final readout.
    // Playback updates the UI at 25 Hz; a pause can fall between those updates.
    if (active.current) {
      const leader = [...players.current.values()]
        .filter(
          (p) => !p.video.error && p.video.readyState >= 2 && !p.video.seeking,
        )
        .sort((a, b) => b.duration - b.offset - (a.duration - a.offset))[0];
      if (leader)
        current.current = clamp(
          leader.video.currentTime - leader.offset,
          0,
          durationRef.current,
        );
    }
    active.current = false;
    sync(current.current, false, rate, true);
    setTime(current.current);
    setPlaying(false);
  }, [rate, sync]);
  const toggle = useCallback(() => {
    if (durationRef.current <= 0) return;
    if (active.current) {
      pause();
      return;
    }
    if (current.current >= durationRef.current) seek(0);
    setPlaying(true);
  }, [pause, seek]);
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
    pause,
    getTime: () => current.current,
  };
}
export type Transport = ReturnType<typeof useTransport>;
