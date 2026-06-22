// Shotstack provider adapter — V1 (school news report only).
//
// What this adapter does and does not do:
//   - DOES build a real Shotstack render from uploaded video clips,
//     produces a real MP4, and reports its status back into render_jobs.
//   - DOES gracefully report `not_configured` when SHOTSTACK_API_KEY is
//     missing instead of throwing.
//   - DOES NOT pick clips, detect highlights, or do speech recognition.
//     The composer plays clips in upload order with a title + end card.
//   - DOES NOT verify the webhook signature — Shotstack's stage env
//     doesn't sign. Instead `handleWebhook` re-fetches the render
//     status from the API using the id in the body, which is both
//     cheap (one HTTP GET) and forgery-proof (an attacker can't make
//     the API say a render exists when it doesn't).

import type {
  ProviderAdapter,
  SubmitJobInput,
  SubmitJobResult,
  CheckStatusResult,
  NormalisedOutput,
} from "../types";
import { ShotstackClient, readShotstackConfig } from "./client";
import { buildNewsReportTimeline, type ComposerSourceClip } from "./composer";

interface SmartDraftPayload {
  projectName: string;
  classGroup?: string | null;
  callbackUrl?: string;
  clips: ComposerSourceClip[];
}

function isSmartDraftPayload(p: Record<string, unknown>): boolean {
  if (typeof p["projectName"] !== "string") return false;
  if (!Array.isArray(p["clips"])) return false;
  return true;
}

export const shotstackProvider: ProviderAdapter = {
  name: "shotstack",

  isConfigured(): boolean {
    return readShotstackConfig() !== null;
  },

  async submitJob(input: SubmitJobInput): Promise<SubmitJobResult> {
    const cfg = readShotstackConfig();
    if (!cfg) {
      return {
        status: "not_configured",
        message: "shotstack adapter is not configured. Set SHOTSTACK_API_KEY to enable.",
      };
    }

    if (input.kind !== "smart_draft" && input.kind !== "final_render") {
      return {
        status: "failed",
        message: `Shotstack adapter does not support job kind "${input.kind}".`,
      };
    }

    if (!isSmartDraftPayload(input.payload)) {
      return {
        status: "failed",
        message: "Shotstack adapter received an invalid payload (need projectName + clips[]).",
      };
    }

    const payload = input.payload as unknown as SmartDraftPayload;

    if (payload.clips.length === 0) {
      return {
        status: "failed",
        message: "No uploaded video clips found for this project. Upload at least one clip first.",
      };
    }

    const timeline = buildNewsReportTimeline({
      projectName: payload.projectName,
      classGroup: payload.classGroup ?? null,
      clips: payload.clips,
      callbackUrl: payload.callbackUrl,
    });

    try {
      const client = new ShotstackClient(cfg);
      const res = await client.submitRender(timeline);
      const id = res.response?.id;
      if (!id) {
        return {
          status: "failed",
          message: `Shotstack returned success but no render id: ${res.message ?? "unknown"}`,
          rawPayload: { response: res as unknown as Record<string, unknown> },
        };
      }
      return {
        status: "submitted",
        externalJobId: id,
        message: res.message ?? "Shotstack accepted the render.",
        // Deliberately do NOT persist `submittedTimeline` here — it
        // contains short-lived presigned R2 GET URLs. They are needed
        // only long enough for Shotstack to fetch the clips; keeping
        // them in the DB row would leak signed URLs to anyone with
        // render_jobs read access (frontend included). Store just
        // metadata Shotstack returned.
        rawPayload: {
          env: cfg.env,
          clipCount: payload.clips.length,
          response: res as unknown as Record<string, unknown>,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: "failed",
        message,
        rawPayload: { error: message },
      };
    }
  },

  async checkStatus(externalJobId: string): Promise<CheckStatusResult> {
    const cfg = readShotstackConfig();
    if (!cfg) {
      return { status: "not_configured", errorMessage: "SHOTSTACK_API_KEY is not set." };
    }
    try {
      const client = new ShotstackClient(cfg);
      const res = await client.getStatus(externalJobId);
      const r = res.response;
      const ssStatus = r?.status;
      let mapped: CheckStatusResult["status"];
      switch (ssStatus) {
        case "queued":
          mapped = "queued";
          break;
        case "fetching":
        case "rendering":
        case "saving":
          mapped = "processing";
          break;
        case "done":
          mapped = "complete";
          break;
        case "failed":
          mapped = "failed";
          break;
        default:
          mapped = "processing";
      }
      return {
        status: mapped,
        previewUrl: r?.url ?? undefined,
        finalExportUrl: mapped === "complete" ? (r?.url ?? undefined) : undefined,
        errorMessage: r?.error ?? undefined,
        rawPayload: (r ?? {}) as Record<string, unknown>,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "failed", errorMessage: message, rawPayload: { error: message } };
    }
  },

  // We do not trust the webhook body. Shotstack's stage env does not
  // sign webhooks; even on prod, the safest pattern is to take the
  // render id out of the body and re-query the API for ground truth.
  async handleWebhook(body): Promise<{ externalJobId: string; result: CheckStatusResult } | null> {
    if (!body || typeof body !== "object") return null;
    const b = body as Record<string, unknown>;
    const id = typeof b["id"] === "string" ? (b["id"] as string) : null;
    if (!id) return null;
    const result = await shotstackProvider.checkStatus(id);
    if (result.status === "not_configured") return null;
    return { externalJobId: id, result };
  },

  normaliseOutput(raw: Record<string, unknown>): NormalisedOutput {
    return {
      previewUrl: typeof raw["url"] === "string" ? (raw["url"] as string) : undefined,
      finalExportUrl: typeof raw["url"] === "string" ? (raw["url"] as string) : undefined,
    };
  },
};
