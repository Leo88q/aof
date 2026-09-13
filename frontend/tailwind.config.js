/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
      aof: {
        concrete: "var(--aof-concrete)",
        oak: { DEFAULT: "var(--aof-oak)", light: "var(--aof-oak-light)", dark: "var(--aof-oak-dark)" },
        copper: { DEFAULT: "var(--aof-copper)", bright: "var(--aof-copper-bright)", dark: "var(--aof-copper-dark)" },
        terracotta: "var(--aof-terracotta)", sage: "var(--aof-sage)", golden: "var(--aof-golden)",
        forest: "var(--aof-forest)", parchment: "var(--aof-parchment)", ember: "var(--aof-ember)",
      },
        // Дизайн-система MANOR (см. src/theme/manor.css). Старые имена оставлены,
        // чтобы не менять TSX: soil = дерево, wheat = золото/янтарь, sprout = изумруд, water = стекло.
        soil: {
          950: "#1A1A2E", // ночное небо — фон приложения
          900: "#2C1810", // тёмный дуб
          850: "#3E2723", // орех — поверхности карточек
          800: "#43291a",
          700: "#5a3a26",
          600: "#6b501a", // тёмная бронза (линии)
        },
        wheat: {
          500: "#FFBF00", // янтарь (свечение, легенда)
          600: "#D4AF37", // золото (акцент, кнопки)
          700: "#8B6919", // бронза
          800: "#6B1F1F", // бордо
        },
        sprout: { 500: "#50C878", 600: "#3aa66e", 700: "#2D4A3E" },
        water: { 500: "#5aa0e6", 600: "#3d7fc4" },
        parchment: "#F5E6D3",
        straw: "#c9b08a",
        gold: "#D4AF37",
        ember: "#E0115F",
        manor: {
          bordeaux: "#6B1F1F", forest: "#2D4A3E", walnut: "#3E2723", bronze: "#8B6919",
          gold: "#D4AF37", amber: "#FFBF00", emerald: "#50C878", ruby: "#E0115F",
          parchment: "#F5E6D3", oak: "#2C1810", night: "#1A1A2E",
        },
      },
      fontFamily: {
        sans: ["Cormorant Garamond", "EB Garamond", "Georgia", "serif"],
        display: ["Cinzel", "Trajan Pro", "Georgia", "serif"],
        title: ["Cinzel Decorative", "Cinzel", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 18px 34px -14px rgba(96,64,160,0.55), 0 6px 14px -8px rgba(0,0,0,0.7)",
        glow: "0 0 22px rgba(255,191,0,0.35)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fill-up": "fillUp 1.2s ease-out forwards",
        shimmer: "shimmer 2s linear infinite",
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
      },
    },
  },
  plugins: [],
};
