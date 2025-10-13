import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Only load Replit cartographer plugin in development with a proper Replit environment
const isDevelopment = process.env.NODE_ENV !== "production";
const isReplitEnv = process.env.REPL_ID !== undefined;
const shouldLoadCartographer = isDevelopment && isReplitEnv;

const plugins = [
  react(),
  runtimeErrorOverlay(),
];

// Add cartographer only in development to avoid build issues
if (shouldLoadCartographer) {
  try {
    const cartographerModule = await import("@replit/vite-plugin-cartographer");
    plugins.push(cartographerModule.cartographer());
  } catch (error) {
    console.warn("Could not load Replit cartographer plugin:", error);
  }
}

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
