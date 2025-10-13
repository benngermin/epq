import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(async ({ mode }) => {
  const plugins = [react()];
  
  // Only load dev plugins in development mode and when REPL_ID is set
  if (mode !== "production" && process.env.REPL_ID) {
    try {
      const [{ cartographer }, overlay] = await Promise.all([
        import("@replit/vite-plugin-cartographer"),
        import("@replit/vite-plugin-runtime-error-modal")
      ]);
      plugins.push(cartographer(), overlay.default());
    } catch (error) {
      console.warn("Could not load Replit dev plugins:", error);
    }
  }
  
  return {
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
  };
});