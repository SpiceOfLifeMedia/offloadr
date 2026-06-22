// Stub provider: always "configured", returns deterministic fake results.
// Used so the submission → smart-draft → render UX flow can be exercised
// end-to-end before Descript / Shotstack credentials are wired up.

import type { ProviderAdapter, SubmitJobInput, SubmitJobResult, CheckStatusResult, NormalisedOutput } from "./types";

export const stubProvider: ProviderAdapter = {
  name: "stub",

  isConfigured(): boolean {
    return true;
  },

  async submitJob(input: SubmitJobInput): Promise<SubmitJobResult> {
    const externalJobId = `stub_${input.kind}_${Date.now()}`;
    return {
      status: "submitted",
      externalJobId,
      message: "Stub provider accepted the job. No real render will run.",
      rawPayload: { input },
    };
  },

  async checkStatus(externalJobId: string): Promise<CheckStatusResult> {
    return {
      status: "complete",
      previewUrl: `https://stub.local/preview/${externalJobId}.mp4`,
      finalExportUrl: `https://stub.local/final/${externalJobId}.mp4`,
      rawPayload: { stub: true },
    };
  },

  async handleWebhook(body) {
    if (body && typeof body === "object" && "stubJobId" in (body as Record<string, unknown>)) {
      const id = String((body as Record<string, unknown>)["stubJobId"]);
      return { externalJobId: id, result: await this.checkStatus(id) };
    }
    return null;
  },

  normaliseOutput(raw: Record<string, unknown>): NormalisedOutput {
    return {
      previewUrl: typeof raw["previewUrl"] === "string" ? (raw["previewUrl"] as string) : undefined,
      finalExportUrl: typeof raw["finalExportUrl"] === "string" ? (raw["finalExportUrl"] as string) : undefined,
      timelineData: { clips: [], generatedBy: "stub" },
    };
  },
};
