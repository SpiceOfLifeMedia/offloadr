import type { ProviderAdapter, ProviderName } from "./types";
import { stubProvider } from "./stub";
import { shotstackProvider } from "./shotstack";
import { makeNotConfiguredProvider } from "./notConfigured";

// Real adapters will replace these `makeNotConfiguredProvider(...)` calls.
// Until env keys land, every call cleanly returns { status: "not_configured" }.
// shotstack: real adapter. Reports `not_configured` itself if SHOTSTACK_API_KEY
// is missing, so the UI surfaces "Provider not configured yet" instead of a 500.
const registry: Record<ProviderName, ProviderAdapter> = {
  stub: stubProvider,
  shotstack: shotstackProvider,
  descript: makeNotConfiguredProvider("descript", "DESCRIPT_API_KEY"),
  vizard: makeNotConfiguredProvider("vizard", "VIZARD_API_KEY"),
  creatomate: makeNotConfiguredProvider("creatomate", "CREATOMATE_API_KEY"),
  remotion: makeNotConfiguredProvider("remotion", "REMOTION_API_KEY"),
};

export function getProvider(name: ProviderName): ProviderAdapter {
  return registry[name];
}

export function listProviders(): Array<{ name: ProviderName; configured: boolean }> {
  return (Object.keys(registry) as ProviderName[]).map((n) => ({ name: n, configured: registry[n].isConfigured() }));
}

export type { ProviderAdapter, ProviderName } from "./types";
