import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// `vite build --mode preview` genera un único HTML autocontenido (útil para compartir una vista previa).
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === "preview" ? [viteSingleFile()] : [])],
  resolve: { alias: { "@shared": r("./shared"), "@": r("./src") } },
  server: { proxy: { "/api": "http://localhost:8787" } },
  build: { outDir: mode === "preview" ? "dist-preview" : "dist", target: "es2022" },
}));
