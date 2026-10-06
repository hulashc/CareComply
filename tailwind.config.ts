import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        gold: { DEFAULT: "hsl(var(--gold))", foreground: "hsl(var(--gold-foreground))" },
        mint: { DEFAULT: "hsl(var(--mint))", foreground: "hsl(var(--mint-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--mint-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--card-foreground))" },
        sidebar: { DEFAULT: "hsl(var(--sidebar))", foreground: "hsl(var(--sidebar-foreground))", accent: "hsl(var(--sidebar-accent))" },
      },
      fontFamily: {
        sans: ["var(--font-roboto)", "system-ui", "sans-serif"],
        serif: ["var(--font-roboto-slab)", "Georgia", "serif"],
      },
      // Material look: ~4px corners. Existing rounded-xl/2xl usages scale down with these.
      borderRadius: {
        sm: "calc(var(--radius) - 2px)",
        md: "var(--radius)",
        lg: "calc(var(--radius) + 2px)",
        xl: "calc(var(--radius) + 2px)",
        "2xl": "calc(var(--radius) + 4px)",
        "3xl": "calc(var(--radius) + 8px)",
        pill: "9999px",
      },
      // Material elevations.
      boxShadow: {
        card: "0 2px 6px 0 rgb(60 20 90 / 0.10), 0 1px 3px 0 rgb(0 0 0 / 0.08)",
        elevated: "0 10px 30px -10px rgb(60 20 90 / 0.35), 0 4px 10px -4px rgb(0 0 0 / 0.12)",
        glow: "0 4px 20px 0 rgb(60 20 90 / 0.14)",
        "card-hover": "0 14px 34px -10px rgb(60 20 90 / 0.40), 0 6px 12px -4px rgb(0 0 0 / 0.14)",
        "sidebar": "0 4px 20px 0 rgb(30 10 60 / 0.35)",
        button: "0 2px 2px 0 rgb(0 0 0 / 0.14), 0 3px 1px -2px rgb(0 0 0 / 0.12), 0 1px 5px 0 rgb(0 0 0 / 0.2)",
        "button-primary": "0 4px 20px 0 rgb(0 0 0 / 0.14), 0 7px 10px -5px hsl(340 80% 46% / 0.4)",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "scale-in": { "0%": { opacity: "0", transform: "scale(0.95)" }, "100%": { opacity: "1", transform: "scale(1)" } },
        "slide-right": { "0%": { transform: "translateX(-8px)", opacity: "0" }, "100%": { transform: "translateX(0)", opacity: "1" } },
        "slide-in-left": { "0%": { transform: "translateX(-16px)", opacity: "0" }, "100%": { transform: "translateX(0)", opacity: "1" } },
        "float": { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        "shimmer": { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        "pulse-soft": { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.7" } },
      },
      animation: {
        "fade-up": "fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scale-in 0.2s ease-out",
        "slide-right": "slide-right 0.3s ease-out",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "float": "float 3s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
