import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** 开发时 /api 转发到 Python 后端（默认 8788） */
const apiProxyTarget =
  process.env.VITE_API_PROXY ?? "http://127.0.0.1:8788";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
