/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#0D2C54",
          "blue-hover": "#0a2344",
          cyan: "#2A9D8F",
          "cyan-hover": "#238276",
          green: "#388E3C",
          yellow: "#E9C46A",
          cream: "#F8F7F4",
          "gray-light": "#E0E0E0",
          "gray-dark": "#424242",
          "blue-pale": "#D0DCF0",
          "cyan-pale": "#C8F0EC",
          "green-pale": "#D6F0D7",
          "yellow-pale": "#FDF5DC",
        },
        primary: {
          DEFAULT: "#0D2C54",
          hover: "#0a2344",
          light: "#D0DCF0",
        },
        accent: {
          DEFAULT: "#2A9D8F",
          hover: "#238276",
          light: "#C8F0EC",
        },
        surface: "#FFFFFF",
        canvas: "#F8F7F4",
        muted: "#F3F2EF",
        ink: "#424242",
        edge: "#E0E0E0",
        panel: "#FFFFFF",
        panel2: "#F8F7F4",
        gold: "#E9C46A",
        good: "#388E3C",
        warn: "#E9C46A",
        bad: "#C62828",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "-apple-system", "sans-serif"],
        display: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
      boxShadow: {
        node: "0 1px 2px rgba(13,44,84,0.06), 0 4px 20px -4px rgba(13,44,84,0.12)",
        card: "0 1px 3px rgba(13,44,84,0.05), 0 8px 28px -8px rgba(13,44,84,0.1)",
        sidebar: "4px 0 24px -4px rgba(13,44,84,0.08)",
      },
      borderRadius: {
        brand: "0.625rem",
      },
    },
  },
  plugins: [],
};
