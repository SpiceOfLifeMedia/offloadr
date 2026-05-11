import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const isReplit = process.env.REPL_ID !== undefined;
const isProduction = process.env.NODE_ENV === "production";

const basePath = process.env.BASE_PATH ?? "/";

const rawPort = process.env.PORT;
const parsedPort = rawPort ? Number(rawPort) : NaN;
const devPort =
  Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 5173;

const apiPort = process.env.API_PORT ?? "5001";

const replitDevPlugins = await (async () => {
  if (!isReplit || isProduction) return [];
  const [{ default: runtimeErrorOverlay }, cartographer, devBanner] =
    await Promise.all([
      import("@replit/vite-plugin-runtime-error-modal"),
      import("@replit/vite-plugin-cartographer"),
      import("@replit/vite-plugin-dev-banner"),
    ]);
  return [
    runtimeErrorOverlay(),
    cartographer.cartographer({
      root: path.resolve(import.meta.dirname, ".."),
    }),
    devBanner.devBanner(),
  ];
})();

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), ...replitDevPlugins],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: devPort,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: false,
    },
    proxy: {
      [`${basePath}api`]: {
        target: `http://localhost:${apiPort}`,
        changeOrigin: false,
      },
    },
  },
  preview: {
    port: devPort,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
