import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        sunken: "rgb(var(--sunken) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        jade: {
          DEFAULT: "rgb(var(--jade) / <alpha-value>)",
          soft: "rgb(var(--jade-soft) / <alpha-value>)",
          deep: "rgb(var(--jade-deep) / <alpha-value>)",
        },
        saffron: {
          DEFAULT: "rgb(var(--saffron) / <alpha-value>)",
          soft: "rgb(var(--saffron-soft) / <alpha-value>)",
        },
        rose: {
          DEFAULT: "rgb(var(--rose) / <alpha-value>)",
          soft: "rgb(var(--rose-soft) / <alpha-value>)",
        },
        sky: {
          DEFAULT: "rgb(var(--sky) / <alpha-value>)",
          soft: "rgb(var(--sky-soft) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ['"Instrument Sans Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        group: "20px",
        ctl: "12px",
      },
      boxShadow: {
        float: "0 1px 2px rgb(16 24 20 / 0.04), 0 8px 24px -8px rgb(16 24 20 / 0.12)",
        sheet: "0 -8px 40px -12px rgb(16 24 20 / 0.25)",
      },
      keyframes: {
        "sheet-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pop": { "0%": { transform: "scale(.96)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        "pulse-ring": { "0%": { transform: "scale(1)", opacity: ".5" }, "100%": { transform: "scale(1.8)", opacity: "0" } },
        float: { "0%,100%": { transform: "translate3d(0,0,var(--z,0))" }, "50%": { transform: "translate3d(0,-14px,var(--z,0))" } },
      },
      animation: {
        "sheet-up": "sheet-up .32s cubic-bezier(.2,.9,.3,1)",
        "fade-in": "fade-in .2s ease-out",
        pop: "pop .18s ease-out",
        "pulse-ring": "pulse-ring 1.4s ease-out infinite",
        float: "float 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
