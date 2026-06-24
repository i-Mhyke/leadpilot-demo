// @ts-ignore — file is consumed by Vite, not tsc
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { resolveAgentBaseUrl } from "./src/lib/agent-base-url";

function loadMonorepoEnv(mode, rootDir) {
  return {
    name: "leadpilot:load-monorepo-env",
    enforce: "post",
    configResolved() {
      Object.assign(process.env, loadEnv(mode, rootDir, ""));
    },
  };
}

export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(__dirname, "../..");
  const env = loadEnv(mode, rootDir, "");
  const agentTarget = resolveAgentBaseUrl(env);

  return {
    envDir: rootDir,
    server: {
      port: 3000,
      proxy: {
        "/agents": { target: agentTarget, changeOrigin: true },
        "/api": { target: agentTarget, changeOrigin: true },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [
      tanstackStart(),
      viteReact(),
      tailwindcss(),
      loadMonorepoEnv(mode, rootDir),
    ],
  };
});
