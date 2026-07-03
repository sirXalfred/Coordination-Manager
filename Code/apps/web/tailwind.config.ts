import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        sm: '100%',
        md: '100%',
        lg: '100%',
        xl: '100%',
        '2xl': '1800px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        icon: 'hsl(var(--icon))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'unmarked-pulse': {
          '0%, 100%': { boxShadow: '0 0 4px rgba(251,191,36,0.3)', borderColor: 'rgb(251,191,36)' },
          '50%': { boxShadow: '0 0 12px rgba(251,191,36,0.6)', borderColor: 'rgb(245,158,11)' },
        },
        'cyan-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 2px rgba(34,211,238,0.25), 0 0 6px rgba(34,211,238,0.35)' },
          '50%': { boxShadow: '0 0 0 3px rgba(34,211,238,0.45), 0 0 16px rgba(34,211,238,0.65)' },
        },
        'spin-once': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'fade-in-out': {
          '0%': { opacity: '0', transform: 'translate(-50%, 8px)' },
          '15%, 80%': { opacity: '1', transform: 'translate(-50%, 0)' },
          '100%': { opacity: '0', transform: 'translate(-50%, 8px)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'unmarked-pulse': 'unmarked-pulse 2s ease-in-out infinite',
        'cyan-pulse': 'cyan-pulse 2.2s ease-in-out infinite',
        'spin-once': 'spin-once 0.5s ease-out',
        'gradient-shift': 'gradient-shift 3.6s ease-in-out infinite',
        'fade-in-out': 'fade-in-out 1.8s ease-in-out forwards',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config
