/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: "#fbfbfa",
        surface: "#ffffff",
        ink: {
          DEFAULT: "#111111",
          2: "#787774",
          3: "#a8a7a3",
        },
        line: "#eaeaea",
        bone: "#f7f6f3",
        spot: {
          DEFAULT: "#1f6c9f",
          bg: "#e1f3fe",
        },
        pale: {
          green: "#edf3ec",
          greentext: "#346538",
          red: "#fdebec",
          redtext: "#9f2f2d",
          yellow: "#fbf3db",
          yellowtext: "#956400",
        },
      },
      fontFamily: {
        sans: [
          "SF Pro Display",
          "SF Pro Text",
          "-apple-system",
          "BlinkMacSystemFont",
          "Helvetica Neue",
          "system-ui",
          "sans-serif",
        ],
        mono: ["SF Mono", "Geist Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
        lg: "10px",
        xl: "12px",
      },
      boxShadow: {
        lift: "0 2px 8px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [],
};
