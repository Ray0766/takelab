import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 4173,
    strictPort: true,
    // Browser downloads are temporarily locked on Windows; they are not source.
    watch: {
      ignored: [
        "**/.local/**",
        "**/test-results/**",
        "**/playwright-report/**",
        "**/docs/evidence/**",
      ],
    },
  },
  preview: { port: 4173, strictPort: true },
});
