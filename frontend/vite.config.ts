import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const devBackend = process.env.VITE_DEV_BACKEND_URL;

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: devBackend
      ? {
          "/api": {
            target: devBackend,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ""),
          },
        }
      : undefined,
  },
});
