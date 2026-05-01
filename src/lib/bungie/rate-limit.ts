import "server-only";

interface QueueEntry {
  chain: Promise<unknown>;
  lastTickAt: number;
  inFlight: number;
}

const PER_USER_MIN_GAP_MS = 50;
const PER_USER_MAX_CONCURRENCY = 4;

const queues = new Map<string, QueueEntry>();

export async function withUserRateLimit<T>(
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const entry =
    queues.get(userId) ??
    (() => {
      const e: QueueEntry = { chain: Promise.resolve(), lastTickAt: 0, inFlight: 0 };
      queues.set(userId, e);
      return e;
    })();

  const next = entry.chain.then(async () => {
    while (entry.inFlight >= PER_USER_MAX_CONCURRENCY) {
      await sleep(25);
    }
    const now = Date.now();
    const wait = Math.max(0, entry.lastTickAt + PER_USER_MIN_GAP_MS - now);
    if (wait > 0) await sleep(wait);
    entry.lastTickAt = Date.now();
    entry.inFlight++;
    try {
      return await fn();
    } finally {
      entry.inFlight--;
    }
  });

  entry.chain = next.catch(() => undefined);
  return next as Promise<T>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withBackoff<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseMs ?? 250;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      const delay = base * 2 ** attempt + Math.random() * base;
      await sleep(delay);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("withBackoff failed");
}
