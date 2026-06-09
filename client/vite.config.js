import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const apiPort = env.PORT || "3000";
  const devPort = Number(env.VITE_DEV_PORT || 5173);
  const apiTarget = `http://127.0.0.1:${apiPort}`;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@assets": path.resolve(__dirname, "../web_assets"),
        "@fonts": path.resolve(__dirname, "../fonts"),
      },
    },
    server: {
      host: "127.0.0.1",
      port: devPort,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/auth": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/uploads": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
