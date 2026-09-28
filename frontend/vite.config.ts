import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const devBackend = process.env.VITE_DEV_BACKEND_URL || "http://127.0.0.1:8080";

export default defineConfig({
  plugins: [react()],
  // Production browser code is public; never publish source maps.
  build: { sourcemap: false },
  // Предпросмотр сборки ходит по тому же адресу, что и разработка: без явного
  // хоста он слушает только localhost и в песочнице предпросмотра не виден.
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: true,
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: devBackend,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
