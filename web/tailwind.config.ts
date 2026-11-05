import type { Config } from "tailwindcss";

/*
 * עיצוב בהיר בהשראת getlayers.ai: משטחים לבנים עם קו דק, כפתור פנינתי אחד למסך,
 * צבעי מצב רק כנקודה או טקסט. paper = צבע הטקסט הראשי, ink = טקסט על משטח כהה.
 */
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#4b5bb0",
          accent: "#e8996b",
          50: "#eef0fb",
          100: "#dfe3f8",
          500: "#5b6bc2",
          600: "#4b5bb0",
          700: "#3c4a94",
        },
        hot: { 50: "#fff1f2", 100: "#ffe4e6", 500: "#f43f5e", 600: "#e11d48" },
        ink: "#ffffff",
        paper: "#111114",
        line: "rgba(17,17,20,0.08)",
      },
      fontFamily: {
        sans: ["var(--font-heebo)", "system-ui", "-apple-system", "Arial", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(17,17,20,0.04), 0 8px 24px -16px rgba(17,17,20,0.12)",
        glow: "0 0 0 4px rgba(91,107,194,0.15)",
        hot: "0 0 0 1px rgba(244,63,94,0.25)",
      },
      backgroundImage: {
        // הכפתור הפנינתי של הרפרנס
        "gradient-brand": "linear-gradient(120deg, #d6dcff 0%, #f0dbe8 50%, #f8d6bf 100%)",
        "gradient-hot": "linear-gradient(120deg, #fbd0bd 0%, #f6a9b8 100%)",
        "gradient-success": "linear-gradient(120deg, #d3f5e4 0%, #a9e9cb 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
