/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5', // indigo-600
          hover: '#4338CA',
          light: '#EEF2FF',
        },
        surface: '#FFFFFF',
        canvas: '#FAFAFA',
        muted: '#F3F4F6',
        ink: '#1F2937', // Texte principal (plus clair que le noir pur)
        edge: '#E5E7EB',
      
        panel: "#0f1626",
        panel2: "#15203a",
        //edge: "#1f2a44",
        accent: "#3b82f6",
        accent2: "#2563eb",
        gold: "#c9a24b",
        good: "#22c55e",
        warn: "#f59e0b",
        bad: "#ef4444",
      },
      
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
      boxShadow: {
        node: "0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};
