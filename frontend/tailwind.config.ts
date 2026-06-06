import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf6ee",
          100: "#f9e7d2",
          200: "#f2cba2",
          300: "#e9aa6c",
          400: "#e08a42",
          500: "#d4711f", // หลัก: โทนคาราเมล/ครอฟเฟิล
          600: "#b85a16",
          700: "#934514",
          800: "#763917",
          900: "#613016",
        },
      },
    },
  },
  plugins: [],
};

export default config;
