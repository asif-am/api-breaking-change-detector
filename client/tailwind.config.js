/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f5f2ea',
        surface: '#fbf9f3',
        sunken: '#efece1',
        ink: '#1b1a16',
        graphite: '#55524a',
        muted: '#807b6b',
        line: '#ddd8c9',
        prussian: '#1f4a7c',
        'prussian-soft': '#e8eef5',
        rust: '#9c3323',
        'rust-soft': '#f6eae6',
        ochre: '#8a6417',
        'ochre-soft': '#f5eedd',
        moss: '#2f6b4a',
        'moss-soft': '#e8f0e9',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
