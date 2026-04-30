import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#1f4e78", accent: "#ffc000" },
      },
    },
  },
  plugins: [],
};
export default config;
