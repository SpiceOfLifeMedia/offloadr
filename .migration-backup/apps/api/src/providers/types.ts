// Provider adapter contract. Every Smart Draft / render / highlight provider
// implements this. Adapters MUST NOT throw on missing credentials — they
// should return { status: "not_configured", message: "..." } so the UI can
// surface "Provider not configured yet" instead of a 500.

export type ProviderName = "descript" | "shotstack" | "vizard" | "creatomate" | "remotion" | "stub";
export type ProviderJobKind = "smart_draft" | "final_render" | "highlight";

export interface SubmitJobInput {
  projectId: number;
  kind: ProviderJobKind;
  // Provider-agnostic payload. Each adapter decides what it actually needs.
  // For Smart Draft this is typically the list of source media files;
  // for final render it's a timeline id + render template settings.
  payload: Record<string, unknown>;
}

export interface SubmitJobResult {
  status: "submitted" | "not_configured" | "failed";
  externalJobId?: string;
  message?: string;
  rawPayload?: Record<string, unknown>;
}

export interface CheckStatusResult {
  status: "queued" | "processing" | "complete" | "failed" | "not_configured";
  previewUrl?: string;
  finalExportUrl?: string;
  errorMessage?: string;
  rawPayload?: Record<string, unknown>;
}

export interface NormalisedOutput {
  previewUrl?: string;
  finalExportUrl?: string;
  // For Smart Draft: a serialisable timeline blob the editor UI will read later.
  timelineData?: Record<string, unknown>;
}

export interface ProviderAdapter {
  name: ProviderName;
  /** Returns true when env keys are present. Adapters never throw. */
  isConfigured(): boolean;
  submitJob(input: SubmitJobInput): Promise<SubmitJobResult>;
  checkStatus(externalJobId: string): Promise<CheckStatusResult>;
  /** Verify + parse a webhook body. Return null when the body isn't ours. */
  handleWebhook(body: unknown, headers: Record<string, string | string[] | undefined>): Promise<{ externalJobId: string; result: CheckStatusResult } | null>;
  normaliseOutput(raw: Record<string, unknown>): NormalisedOutput;
}
