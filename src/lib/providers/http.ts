import "server-only";

export class ProviderHttpError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "ProviderHttpError";
  }
}

interface FetchJsonOptions extends RequestInit {
  timeoutMs?: number;
}

// Every provider client funnels through here so timeouts and error shape are
// consistent, and so a 401/403 (bad credential) is distinguishable from a
// network failure by callers that need to mark a credential invalid.
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = 15_000, ...init } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let body: unknown = undefined;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!res.ok) {
      const message =
        body && typeof body === "object" && "error" in body
          ? JSON.stringify((body as { error: unknown }).error)
          : `HTTP ${res.status}`;
      throw new ProviderHttpError(message, res.status, body);
    }

    return body as T;
  } catch (err) {
    if (err instanceof ProviderHttpError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ProviderHttpError(`Request timed out after ${timeoutMs}ms`);
    }
    throw new ProviderHttpError(err instanceof Error ? err.message : "Unknown network error");
  } finally {
    clearTimeout(timeout);
  }
}
