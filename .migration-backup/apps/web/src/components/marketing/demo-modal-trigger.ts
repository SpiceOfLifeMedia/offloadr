export const OPEN_DEMO_EVENT = "offloadr:open-demo";

export function openDemoModal() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_DEMO_EVENT));
}
