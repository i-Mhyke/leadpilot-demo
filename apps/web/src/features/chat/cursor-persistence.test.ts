import { describe, expect, it, vi } from "vitest";
import {
  createCursorPersistenceQueue,
  cursorPersistenceRequestsEqual,
} from "./cursor-persistence";

const firstRequest = {
  firmSlug: "demo-law",
  browserSessionId: "browser-1",
  conversationId: "conv-1",
  cursor: {
    sessionId: "eve-1",
    continuationToken: "tok-1",
    streamIndex: 1,
  },
};

describe("cursorPersistenceRequestsEqual", () => {
  it("treats equivalent cursor persistence requests as equal", () => {
    expect(cursorPersistenceRequestsEqual(firstRequest, { ...firstRequest })).toBe(true);
  });

  it("detects stream index changes", () => {
    expect(
      cursorPersistenceRequestsEqual(firstRequest, {
        ...firstRequest,
        cursor: { ...firstRequest.cursor, streamIndex: 2 },
      }),
    ).toBe(false);
  });
});

describe("createCursorPersistenceQueue", () => {
  it("stages cursor changes without opening a request", () => {
    const persist = vi.fn().mockResolvedValue({});
    const queue = createCursorPersistenceQueue(persist);

    queue.stage(firstRequest);

    expect(persist).not.toHaveBeenCalled();
  });

  it("flushes only the latest staged cursor", async () => {
    const persist = vi.fn().mockResolvedValue({});
    const queue = createCursorPersistenceQueue(persist);

    queue.stage(firstRequest);
    await queue.flush({
      ...firstRequest,
      cursor: { ...firstRequest.cursor, streamIndex: 3 },
    });

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith({
      ...firstRequest,
      cursor: { ...firstRequest.cursor, streamIndex: 3 },
    });
  });

  it("does not start a second request while one is in flight", async () => {
    let releaseFirst!: () => void;
    const firstPersist = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const persist = vi.fn().mockReturnValueOnce(firstPersist).mockResolvedValue({});
    const queue = createCursorPersistenceQueue(persist);

    const firstFlush = queue.flush(firstRequest);
    const secondFlush = queue.flush({
      ...firstRequest,
      cursor: { ...firstRequest.cursor, streamIndex: 4 },
    });

    expect(persist).toHaveBeenCalledTimes(1);

    releaseFirst();
    await firstFlush;
    await secondFlush;

    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenLastCalledWith({
      ...firstRequest,
      cursor: { ...firstRequest.cursor, streamIndex: 4 },
    });
  });

  it("skips duplicate flushes after a cursor is already persisted", async () => {
    const persist = vi.fn().mockResolvedValue({});
    const queue = createCursorPersistenceQueue(persist);

    await queue.flush(firstRequest);
    await queue.flush({ ...firstRequest });

    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("does not persist a terminal reset cursor after a completed stream", async () => {
    const persist = vi.fn().mockResolvedValue({});
    const queue = createCursorPersistenceQueue(persist);

    queue.stage({
      ...firstRequest,
      cursor: { streamIndex: 0 },
    });
    await queue.flush();

    expect(persist).not.toHaveBeenCalled();
  });

  it("does not let a terminal reset cursor overwrite the last resumable cursor", async () => {
    const persist = vi.fn().mockResolvedValue({});
    const queue = createCursorPersistenceQueue(persist);

    queue.stage(firstRequest);
    queue.stage({
      ...firstRequest,
      cursor: { streamIndex: 0 },
    });
    await queue.flush();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith(firstRequest);
  });
});
