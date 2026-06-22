import type { ProviderAdapter, ProviderName, SubmitJobResult, CheckStatusResult } from "./types";

// Factory for real providers that don't have credentials yet.
// They surface a clean "not_configured" state instead of throwing,
// so the UI shows "Provider not configured yet" rather than a 500.
export function makeNotConfiguredProvider(name: ProviderName, envKeyHint: string): ProviderAdapter {
  const message = `${name} adapter is not configured. Set ${envKeyHint} to enable.`;
  return {
    name,
    isConfigured: () => false,
    async submitJob(): Promise<SubmitJobResult> {
      return { status: "not_configured", message };
    },
    async checkStatus(): Promise<CheckStatusResult> {
      return { status: "not_configured", errorMessage: message };
    },
    async handleWebhook() {
      return null;
    },
    normaliseOutput() {
      return {};
    },
  };
}
