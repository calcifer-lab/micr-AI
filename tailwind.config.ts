import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f5fbff",
          100: "#e0f2ff",
          200: "#b9e2ff",
          300: "#82cfff",
          400: "#43b0ff",
          500: "#198cf2",
          600: "#0d6fd2",
          700: "#0b56a5",
          800: "#0d4785",
          900: "#0e3b6e",
        },
        accent: {
          100: "#f2f7f2",
          200: "#dff0df",
          300: "#bde2bd",
          400: "#8dcd8d",
          500: "#5cb85c",
          600: "#3a923a",
          700: "#2f6f2f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
