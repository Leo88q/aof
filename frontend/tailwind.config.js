/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* ─── NeuroForge · «Морозное стекло» (2026-09-28) ───────────────────
           Имена групп (soil/wheat/sprout/parchment/straw) сохранены намеренно:
           они используются в 43 страницах. Меняются только значения, поэтому
           вся игра переходит на новую гамму без правки разметки. Смысл имени
           больше не связан с фермерской темой — это просто ступени
           поверхности и акцента. */
        aof: {
          concrete: "var(--fg-deep)",
          oak: { DEFAULT: "var(--fg-bezel)", light: "var(--fg-tile)", dark: "var(--fg-void)" },
          copper: { DEFAULT: "var(--fg-glow)", bright: "var(--fg-accent)", dark: "var(--fg-accent-dim)" },
          terracotta: "var(--fg-reward)", sage: "var(--fg-ok)", golden: "var(--fg-reward)",
          forest: "var(--fg-ok)", parchment: "var(--fg-text)", ember: "var(--fg-err)",
        },
        /* Поверхности прибора: от глубокого фона к корпусу и плитке */
        soil: {
          950: "#0B0D11",   // фон приложения (палитра A)
          900: "#0D1013",   // подложка окна
          850: "#12161A",   // корпус прибора (бортик)
          800: "#171C21",   // плитка внутри экрана
          700: "#1E242A",   // приподнятый блок
          600: "#2A3138",   // разделитель
        },
        /* Акцент: морозный циан. Свет идёт от значений и ламп, не от рамки */
        wheat: {
          500: "#7AD3E2",   // акцентный текст и значения
          600: "#5FC9DA",   // основной свет
          700: "#3F9CAB",   // нажатие
          800: "#2C5D66",   // приглушённый контур
        },
        /* Состояния */
        sprout: { 500: "#5FD3A8", 600: "#45B98F", 700: "#1E4A3C" },
        water: { 500: "#8FB3DE", 600: "#6488B4" },
        /* Текст */
        parchment: "#E6EBF0",
        straw: "#9AA7B4",
        gold: "#E0708A",     // награды: маджента палитры A, не янтарь
        ember: "#E2685F",
        /* Семантическая группа manor: имена оставлены для совместимости */
        manor: {
          bordeaux: "#2C5D66", forest: "#1E4A3C", walnut: "#12161A", bronze: "#3F9CAB",
          gold: "#E3A6C2", amber: "#5FC9DA", emerald: "#5FD3A8", ruby: "#E2685F",
          parchment: "#E6EBF0", oak: "#0D1013", night: "#08090C",
        },
        nf: {
          cyan: "#5FC9DA",
          purple: "#A99BEC",
          magenta: "#E0708A",
          green: "#5FD3A8",
          amber: "#E0708A",
          danger: "#E2685F",
          panel: "#12161A",
          "panel-light": "#171C21",
          "panel-dark": "#0D1013",
          glow: "rgba(95, 201, 218, 0.15)",
          "glow-purple": "rgba(167, 155, 216, 0.15)",
        },
      },
      /* Rajdhani и Orbitron не были подключены — «display» молча падал в Inter.
         Теперь display/title — реальный загруженный шрифт (см. src/ui/fonts.ts). */
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
        display: ["Exo 2", "Manrope", "system-ui", "sans-serif"],
        title: ["Exo 2", "Manrope", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 18px 40px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        glow: "0 14px 34px rgba(0, 0, 0, 0.5)",
        "glow-purple": "0 14px 34px rgba(0, 0, 0, 0.5)",
        "glow-green": "0 12px 28px rgba(0, 0, 0, 0.45)",
        neon: "0 6px 18px rgba(0, 0, 0, 0.4)",
      },
      animation: {
        /* Спокойные пульсации вместо неоновых: амплитуда 4–8 % яркости */
        "pulse-slow": "fgCalm 3.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fill-up": "fillUp 1.2s ease-out forwards",
        shimmer: "fgShimmer 3s linear infinite",
        "neon-pulse": "fgCalm 3.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "grid-drift": "gridDrift 20s linear infinite",
      },
      keyframes: {
        fillUp: {
          "0%": { height: "0%", opacity: 0.5 },
          "100%": { height: "100%", opacity: 1 },
        },
        fgShimmer: {
          "0%": { backgroundPosition: "-600px 0" },
          "100%": { backgroundPosition: "600px 0" },
        },
        fgCalm: {
          "0%, 100%": { opacity: "0.72" },
          "50%": { opacity: "0.92" },
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
