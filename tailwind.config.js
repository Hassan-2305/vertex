/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-card": "var(--bg-card)",
        "bg-elevated": "var(--bg-elevated)",
        border: "var(--border)",
        "border-hover": "var(--border-hover)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        "text-dim": "var(--text-dim)",
        accent: "var(--accent)",
        "accent-dim": "var(--accent-dim)",
        "accent-border": "var(--accent-border)",
        green: "var(--green)",
        "green-dim": "var(--green-dim)",
        red: "var(--red)",
        "red-dim": "var(--red-dim)",
        amber: "var(--amber)",
        "amber-dim": "var(--amber-dim)",
      },
      fontFamily: {
        head: "var(--font-head)",
        body: "var(--font-body)",
      }
    },
  },
  plugins: [],
}
