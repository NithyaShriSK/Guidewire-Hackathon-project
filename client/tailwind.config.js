/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef9ff',
          100: '#d9f2ff',
          200: '#bce9ff',
          300: '#8fd9ff',
          400: '#55c2f5',
          500: '#20a8e0',
          600: '#1887db',
          700: '#1447b1',
          800: '#133c9e',
          900: '#143472',
        },
        success: {
          50: '#f4fee5',
          100: '#e8fcc5',
          200: '#d4f88d',
          300: '#b7ee4f',
          400: '#95df1c',
          500: '#7bdd00',
          600: '#55b600',
          700: '#439000',
          800: '#357100',
          900: '#2d5e08',
        },
        warning: {
          50: '#fffceb',
          100: '#fff5bf',
          200: '#ffea7a',
          300: '#ffe45d',
          400: '#ffd633',
          500: '#ffc107',
          600: '#f4a100',
          700: '#cc7b02',
          800: '#a85f08',
          900: '#8a4f0f',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
