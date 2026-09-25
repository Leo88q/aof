/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* ─── NeuroForge: AI / Cyberpunk palette ─── */
        aof: {
          concrete: "var(--nf-concrete)",
          oak: { DEFAULT: "var(--nf-panel)", light: "var(--nf-panel-light)", dark: "var(--nf-panel-dark)" },
          copper: { DEFAULT: "var(--nf-cyan)", bright: "var(--nf-cyan-bright)", dark: "var(--nf-cyan-dark)" },
          terracotta: "var(--nf-magenta)", sage: "var(--nf-green)", golden: "var(--nf-amber)",
          forest: "var(--nf-green-dark)", parchment: "var(--nf-text)", ember: "var(--nf-danger)",
        },
        /* Core surfaces — dark graphite with blue undertones */
        soil: {
          950: "#06060F",   // deep void — app background
          900: "#0A0A1A",   // deep space
          850: "#10101F",   // panel surface
          800: "#161628",
          700: "#1E1E36",
          600: "#2A2A48",   // border / separator
        },
        /* Accent: neon cyan → gold (warm highlight kept for rewards) */
        wheat: {
          500: "#00D4FF",   // primary neon cyan
          600: "#00A8CC",   // cyan press
          700: "#007A99",   // cyan dark
          800: "#6B1F1F",   // bordeaux (legacy compat)
        },
        /* Success: neon green */
        sprout: { 500: "#00E5A0", 600: "#00C488", 700: "#1A4A3E" },
        /* Info: electric blue */
        water: { 500: "#4F7BFF", 600: "#3D60CC" },
        /* Text: cool white / silver */
        parchment: "#E0E4F0",
        straw: "#8890B0",
        gold: "#FFD700",
        ember: "#FF3366",
        /* Semantic palette */
        manor: {
          bordeaux: "#6B1F1F", forest: "#1A4A3E", walnut: "#10101F", bronze: "#007A99",
          gold: "#FFD700", amber: "#00D4FF", emerald: "#00E5A0", ruby: "#FF3366",
          parchment: "#E0E4F0", oak: "#0A0A1A", night: "#06060F",
        },
        /* NeuroForge-specific */
        nf: {
          cyan: "#00D4FF",
          purple: "#9B59FF",
          magenta: "#FF3CAC",
          green: "#00E5A0",
          amber: "#FFD700",
          danger: "#FF3366",
          panel: "#10101F",
          "panel-light": "#1A1A30",
          "panel-dark": "#0A0A14",
          glow: "rgba(0, 212, 255, 0.15)",
          "glow-purple": "rgba(155, 89, 255, 0.15)",
        },
      },
      fontFamily: {
        sans: ["Inter", "SF Pro Display", "system-ui", "sans-serif"],
        display: ["Rajdhani", "Inter", "system-ui", "sans-serif"],
        title: ["Orbitron", "Rajdhani", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 1px rgba(0, 212, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.03)",
        glow: "0 0 20px rgba(0, 212, 255, 0.25), 0 0 40px rgba(0, 212, 255, 0.1)",
        "glow-purple": "0 0 20px rgba(155, 89, 255, 0.25), 0 0 40px rgba(155, 89, 255, 0.1)",
        "glow-green": "0 0 20px rgba(0, 229, 160, 0.25), 0 0 40px rgba(0, 229, 160, 0.1)",
        neon: "0 0 6px rgba(0, 212, 255, 0.4), 0 0 18px rgba(0, 212, 255, 0.2)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fill-up": "fillUp 1.2s ease-out forwards",
        shimmer: "shimmer 2s linear infinite",
        "neon-pulse": "neonPulse 2s ease-in-out infinite",
        "grid-drift": "gridDrift 20s linear infinite",
      },
      keyframes: {
        fillUp: {
          "0%": { height: "0%", opacity: 0.5 },
          "100%": { height: "100%", opacity: 1 },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        neonPulse: {
          "0%, 100%": { boxShadow: "0 0 6px rgba(0,212,255,0.3), 0 0 18px rgba(0,212,255,0.15)" },
          "50%": { boxShadow: "0 0 12px rgba(0,212,255,0.5), 0 0 30px rgba(0,212,255,0.25)" },
        },
        gridDrift: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "40px 40px" },
        },
      },
    },
  },
  plugins: [],
};
