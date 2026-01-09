/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        'terminal': {
          'bg': '#0d1117',
          'surface': '#161b22',
          'border': '#30363d',
          'text': '#c9d1d9',
          'muted': '#8b949e',
          'green': '#3fb950',
          'red': '#f85149',
          'orange': '#d29922',
          'blue': '#58a6ff',
          'purple': '#a371f7'
        }
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
