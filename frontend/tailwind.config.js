/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Ocean & Sand identity
        sand: "#FBF6EF",        // page background
        ivory: "#FFFFFF",       // cards
        pine: {
          DEFAULT: "#114B5E",   // sidebar / brand (lightened)
          light: "#145A6E",
          darker: "#082A38",
        },
        terracotta: {
          DEFAULT: "#F2A65A",   // primary CTA / action
          hover: "#D9903E",     // hover
          soft: "#FEF3E2",
        },
        brass: {
          DEFAULT: "#7FA9B8",   // inactive icons / subtle accent
          soft: "#DCEEF0",     // verified badge bg
        },
        charcoal: "#1F2D33",    // body text
        sage: "#8C8171",        // muted text
        // tokens mapped to the identity
        border: "#DFE6E9",
        input: "#D3DDE2",
        ring: "#0E3B4D",
        background: "#E3EBEF",
        foreground: "#1F2D33",
        primary: { DEFAULT: "#F2A65A", foreground: "#FFFFFF" },
        secondary: { DEFAULT: "#0E3B4D", foreground: "#E3EBEF" },
        destructive: { DEFAULT: "#C0392B", foreground: "#FFFFFF" },
        muted: { DEFAULT: "#E4ECEF", foreground: "#8C8171" },
        accent: { DEFAULT: "#DCEEF0", foreground: "#0E3B4D" },
        card: { DEFAULT: "#FFFFFF", foreground: "#1F2D33" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
      boxShadow: {
        card: "0 1px 4px rgba(0,0,0,.06)",
        raised: "0 4px 12px rgba(14,59,77,0.08)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};  