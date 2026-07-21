// SPDX-License-Identifier: AGPL-3.0-only
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        console: '#17130F',
        bakelite: '#26201A',
        hairline: '#3A3127',
        cream: '#F2E8D8',
        'cream-dim': '#B7AA96',
        tally: '#E5484D',
        'vu-amber': '#F0A83C',
        phosphor: '#4CC38A',
      },
      fontFamily: {
        display: ['Archivo Variable', 'sans-serif'],
        body: ['IBM Plex Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
