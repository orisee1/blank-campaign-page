import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/blank-campaign-page/",
  plugins: [react()],
  build: { sourcemap: false, target: "es2022" },
});
