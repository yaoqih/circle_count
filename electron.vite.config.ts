import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: path.resolve(__dirname, "electron/main.ts"),
      },
      outDir: "out/main",
      rollupOptions: {
        output: {
          entryFileNames: "index.js",
        },
      },
    },
  },
  preload: {
    build: {
      lib: {
        entry: path.resolve(__dirname, "electron/preload.ts"),
      },
      outDir: "out/preload",
      rollupOptions: {
        output: {
          entryFileNames: "index.js",
        },
      },
    },
  },
  renderer: {
    root: ".",
    plugins: [react()],
    build: {
      outDir: "out/renderer",
      rollupOptions: {
        input: path.resolve(__dirname, "index.html"),
      },
    },
  },
});
