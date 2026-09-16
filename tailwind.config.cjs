/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontSize: {
        xs: '13px',
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar-hide'),
    require('@tailwindcss/line-clamp'),
    require('@tailwindcss/typography'),
    require('daisyui'),
  ],

  daisyui: {
    styled: true,
    themes: [{
      light: {
        ...require("daisyui/src/colors/themes")["[data-theme=light]"],
        "--rounded-btn": "0.15rem",
        "primary": "rgb(0, 174, 236)",
        "base-100": "#ffffff",
        "base-200": "#f4f5f7",
        "base-300": "#e5e7eb",
        "base-content": "#18191c",
      },
    }, {
      dark: {
        ...require("daisyui/src/colors/themes")["[data-theme=dark]"],
        "--rounded-btn": "0.15rem",
        "primary": "rgb(0, 174, 236)",
        "base-100": "#18191c",
        "base-200": "#22242b",
        "base-300": "#2f323c",
        "base-content": "#e3e5e7",
      },
    }, {
      eyecare: {
        "color-scheme": "light",
        "--rounded-btn": "0.15rem",
        "primary": "#d97706",
        "primary-content": "#ffffff",
        "secondary": "#a8a29e",
        "secondary-content": "#2e261e",
        "accent": "#ca8a04",
        "accent-content": "#ffffff",
        "neutral": "#4a3e31",
        "neutral-content": "#fbf7ee",
        "base-100": "#faf5ea",
        "base-200": "#f0e7d5",
        "base-300": "#e2d6be",
        "base-content": "#362b20",
        "info": "#0284c7",
        "success": "#16a34a",
        "warning": "#d97706",
        "error": "#dc2626",
      },
    }],
    base: true,
    utils: true,
    logs: true,
    rtl: false,
    prefix: "",
    darkTheme: "dark",
  },
}
