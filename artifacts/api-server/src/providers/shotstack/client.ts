// Minimal Shotstack HTTP client. We deliberately don't pull in the
// official SDK — the surface we need is two endpoints (submit, status)
// and one webhook verification, and the SDK's transitive deps are
// heavier than the rest of the storage stack combined.

export type ShotstackEnvironment = "stage" | "v1";

export interface ShotstackConfig {
  apiKey: string;
  env: ShotstackEnvironment;
  baseUrl: string;
}

function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function readShotstackConfig(): ShotstackConfig | null {
  const apiKey = readEnv("SHOTSTACK_API_KEY");
  if (!apiKey) return null;
  // Default to STAGE so first-time setup never accidentally bills the
  // production environment. Flip via SHOTSTACK_ENV=v1 once a school
  // pilot is actually shipping renders.
  const envRaw = (readEnv("SHOTSTACK_ENV") ?? "stage").toLowerCase();
  const env: ShotstackEnvironment = envRaw === "v1" || envRaw === "prod" || envRaw === "production" ? "v1" : "stage";
  return {
    apiKey,
    env,
    baseUrl: `https://api.shotstack.io/edit/${env}`,
  };
}

export interface ShotstackSubmitResponse {
  success: boolean;
  message?: string;
  response?: { id?: string; message?: string };
}

export interface ShotstackStatusResponse {
  success: boolean;
  message?: string;
  response?: {
    id?: string;
    owner?: string;
    plan?: string;
    status?: "queued" | "fetching" | "rendering" | "saving" | "done" | "failed";
    error?: string;
    url?: string;
    poster?: string;
    thumbnail?: string;
    duration?: number;
    renderTime?: number;
    data?: Record<string, unknown>;
  };
}

export class ShotstackClient {
  constructor(private readonly cfg: ShotstackConfig) {}

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.cfg.apiKey,
    };
  }

  async submitRender(timeline: Record<string, unknown>): Promise<ShotstackSubmitResponse> {
    const res = await fetch(`${this.cfg.baseUrl}/render`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(timeline),
    });
    const text = await res.text();
    let json: ShotstackSubmitResponse;
    try {
      json = JSON.parse(text) as ShotstackSubmitResponse;
    } catch {
      throw new Error(`Shotstack submit returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok || json.success === false) {
      throw new Error(
        `Shotstack submit failed (HTTP ${res.status}): ${json.message ?? json.response?.message ?? "unknown error"}`,
      );
    }
    return json;
  }

  async getStatus(renderId: string): Promise<ShotstackStatusResponse> {
    const res = await fetch(`${this.cfg.baseUrl}/render/${encodeURIComponent(renderId)}?data=true`, {
      method: "GET",
      headers: this.headers(),
    });
    const text = await res.text();
    let json: ShotstackStatusResponse;
    try {
      json = JSON.parse(text) as ShotstackStatusResponse;
    } catch {
      throw new Error(`Shotstack status returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok || json.success === false) {
      throw new Error(
        `Shotstack status failed (HTTP ${res.status}): ${json.message ?? json.response?.error ?? "unknown error"}`,
      );
    }
    return json;
  }
}
