// @ts-ignore — file is consumed by Vite, not tsc
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { resolveAgentBaseUrl } from "./src/lib/agent-base-url";

export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(__dirname, "../..");
  const env = loadEnv(mode, rootDir, "");
  // Nitro reads process.env during its plugin `config` hook (before `configResolved`).
  // Assign monorepo env synchronously so SSR/server functions see DATABASE_URL, etc.
  Object.assign(process.env, env);
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
      nitro(),
      viteReact(),
      tailwindcss(),
    ],
  };
});
