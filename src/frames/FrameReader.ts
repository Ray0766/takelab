import type {
  CapturedFrame,
  DecodedFrame,
  FrameCommand,
  FrameInfo,
} from "./types";

export class FrameReader {
  private worker = new Worker(new URL("./frame.worker.ts", import.meta.url), {
    type: "module",
  });
  private sequence = 0;
  private closed = false;
  private pending = new Map<
    number,
    {
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor() {
    this.worker.onmessage = ({ data }) => {
      const request = this.pending.get(data.id);
      if (!request) {
        data.value?.bitmap?.close();
        return;
      }
      this.pending.delete(data.id);
      clearTimeout(request.timer);
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data.value);
    };
    this.worker.onerror = () => this.close("READER_FAILED");
  }
  private request<T>(command: FrameCommand): Promise<T> {
    if (this.closed) return Promise.reject(new Error("READER_CLOSED"));
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(
        () => this.close("READER_TIMEOUT"),
        command.op === "open" ? 60000 : 15000,
      );
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject, timer });
      this.worker.postMessage({ ...command, id });
    });
  }
  open(blob: Blob, expectedHash?: string) {
    return this.request<FrameInfo>({ op: "open", blob, expectedHash });
  }
  frame(index: number) {
    return this.request<DecodedFrame>({ op: "frame", index });
  }
  capture(index: number) {
    return this.request<CapturedFrame>({ op: "capture", index });
  }
  close(reason = "READER_CLOSED") {
    if (this.closed) return;
    this.closed = true;
    this.worker.terminate();
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error(reason));
    }
    this.pending.clear();
  }
}
