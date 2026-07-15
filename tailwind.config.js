/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Neutral, editorial palette — fashion apps live on whitespace and photography
        ink: {
          DEFAULT: '#1a1a1a',
          soft: '#4a4a4a',
          faint: '#9a9a9a',
        },
        paper: {
          DEFAULT: '#ffffff',
          warm: '#faf9f7',
          sunken: '#f1efec',
        },
        accent: {
          DEFAULT: '#b4552d',
          soft: '#f6e3d9',
        },
        danger: '#b3261e',
      },
    },
  },
  plugins: [],
};
