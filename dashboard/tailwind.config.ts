import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      screens: {
        'xs': '475px',  // Très petits mobiles
        'sm': '640px',  // Mobiles landscape / petits tablettes
        'md': '768px',  // Tablettes
        'lg': '1024px', // Desktop petit
        'xl': '1280px', // Desktop
        '2xl': '1536px', // Desktop large
      },
    },
  },
  plugins: [],
}

export default config

