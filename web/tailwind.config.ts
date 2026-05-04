import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1f4e78",
          accent: "#ffc000",
          50: "#eef5fb",
          100: "#d6e6f3",
          500: "#2d6a9f",
          600: "#1f4e78",
          700: "#173a5a",
        },
        hot: {
          50: "#fff1f2",
          100: "#ffe4e6",
          500: "#ef4444",
          600: "#e02424",
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Heebo", "Arial", "sans-serif"],
      },
      boxShadow: {
        soft: "0 4px 20px rgba(31, 78, 120, 0.08)",
        glow: "0 0 0 4px rgba(31, 78, 120, 0.12)",
        hot: "0 8px 30px rgba(239, 68, 68, 0.25)",
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #1f4e78 0%, #2d6a9f 100%)",
        "gradient-hot": "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
        "gradient-success": "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
