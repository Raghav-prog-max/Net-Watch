/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        card: "var(--nw-bg-panel)",
        "card-foreground": "var(--nw-text-primary)",
        "muted-foreground": "var(--nw-text-muted)",
        border: "var(--nw-line)",
      },
    },
  },
  plugins: [],
};
