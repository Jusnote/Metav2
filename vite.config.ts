import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    allowedHosts: ["8080-ijiz6o5puod83drimvcel-11659719.manus.computer", "8080-i9s1fno5vreb5dctutw6s-f3193a57.manus.computer", "8080-i6sl8vszd1cka4nya8tyz-da42ed7a.manusvm.computer", "8080-izuvlezckgaqudj4p2x3h-da42ed7a.manusvm.computer"],
    hmr: {
      host: "8080-ijiz6o5puod83drimvcel-11659719.manus.computer",
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
