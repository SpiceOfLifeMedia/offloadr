export const colors = {
  background: "#0a0a0f",
  surface: "#141420",
  surfaceAlt: "#1a1a2c",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.15)",

  brandIndigo: "#6366f1",
  brandIndigoLight: "rgba(99,102,241,0.15)",
  brandViolet: "#8b5cf6",
  brandVioletLight: "rgba(139,92,246,0.15)",

  text: "#f4f4f5",
  textSecondary: "#a1a1aa",
  textTertiary: "#71717a",
  textDisabled: "#52525b",

  error: "#f87171",
  errorBg: "rgba(239,68,68,0.1)",
  errorBorder: "rgba(239,68,68,0.25)",

  success: "#4ade80",
  successBg: "rgba(74,222,128,0.1)",

  warning: "#fbbf24",
  warningBg: "rgba(251,191,36,0.1)",

  white: "#ffffff",
  black: "#000000",

  // Scaffold compat
  tint: "#6366f1",
  tabIconDefault: "#71717a",
  tabIconSelected: "#6366f1",
} as const;

export type Color = (typeof colors)[keyof typeof colors];

export default { light: colors, radius: 8 };
