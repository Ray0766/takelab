import { useEffect, useRef, useState } from "react";
import type { Take } from "../model";
import { sourceBlob } from "../media";
import { FrameReader } from "./FrameReader";
import { frameAt } from "./types";
import type { DecodedFrame, FrameInfo } from "./types";

type Session = {
  readers: FrameReader[];
  closed: boolean;
  pending?: number[];
  running: boolean;
};
export function useFramePair(
  takes: Take[],
  initialTime: number,
  retry: number,
) {
  const [infos, setInfos] = useState<FrameInfo[]>([]);
  const [frames, setFrames] = useState<DecodedFrame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const session = useRef<Session | null>(null);
  const displayed = useRef<DecodedFrame[]>([]);
  const key = takes.map((t) => t.id).join("/");
  const request = (indices: number[]) => {
    const s = session.current;
    if (!s || s.closed) return;
    s.pending = indices;
    setLoading(true);
    setError("");
    if (s.running) return;
    s.running = true;
    void (async () => {
      while (s.pending && !s.closed) {
        const next = s.pending;
        s.pending = undefined;
        const result = await Promise.allSettled(
          s.readers.map((r, i) => r.frame(next[i])),
        );
        const good = result.flatMap((r) =>
          r.status === "fulfilled" ? [r.value] : [],
        );
        if (s.closed || s.pending || good.length !== result.length) {
          good.forEach((f) => f.bitmap.close());
          if (!s.closed && !s.pending) {
            const failed = result.find(
              (r) => r.status === "rejected",
            ) as PromiseRejectedResult;
            setError(String(failed.reason?.message || "READER_FAILED"));
            setLoading(false);
          }
          continue;
        }
        displayed.current.forEach((f) => f.bitmap.close());
        displayed.current = good;
        setFrames(good);
        setLoading(false);
      }
      s.running = false;
    })();
  };
  useEffect(() => {
    const abort = new AbortController();
    const s: Session = { readers: [], closed: false, running: false };
    session.current = s;
    setLoading(true);
    setError("");
    setInfos([]);
    setFrames([]);
    void (async () => {
      try {
        if (
          !takes.length ||
          typeof Worker === "undefined" ||
          typeof OffscreenCanvas === "undefined" ||
          typeof VideoDecoder === "undefined"
        )
          throw new Error("UNSUPPORTED_BROWSER");
        const blobs = await Promise.all(
          takes.map((t) => sourceBlob(t, abort.signal)),
        );
        if (s.closed) return;
        if (blobs.some((b) => !b)) throw new Error("SOURCE_MISSING");
        s.readers = takes.map(() => new FrameReader());
        const info = await Promise.all(
          s.readers.map((r, i) => r.open(blobs[i]!, takes[i].sourceHash)),
        );
        if (s.closed) return;
        setInfos(info);
        request(
          info.map((f, i) => frameAt(f.ptsUs, initialTime + takes[i].offset)),
        );
      } catch (e) {
        if (!s.closed) {
          setError(e instanceof Error ? e.message : "READER_FAILED");
          setLoading(false);
        }
        s.readers.forEach((r) => r.close());
      }
    })();
    return () => {
      s.closed = true;
      abort.abort();
      s.readers.forEach((r) => r.close());
      displayed.current.forEach((f) => f.bitmap.close());
      displayed.current = [];
    };
    // A verdict, note or anchor change must not recreate decoders.
  }, [key, retry]);
  return {
    infos,
    frames,
    loading,
    error,
    request,
    capture: (slot: number, index: number) => {
      const s = session.current;
      if (!s || s.closed || s.running || s.pending)
        return Promise.reject(new Error("READER_BUSY"));
      return s.readers[slot].capture(index);
    },
  };
}
