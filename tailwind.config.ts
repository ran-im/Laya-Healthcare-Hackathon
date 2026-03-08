import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        laya: {
          dark:   '#003C3A',
          mid:    '#005C58',
          teal:   '#00A89D',
          accent: '#00D4C8',
          warm:   '#F2FAF9',
          gold:   '#E8A020',
          rose:   '#E8505B',
          slate:  '#2D3E3D',
        },
        border: '#E2E8F0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'laya-sm': '0 2px 8px rgba(0,60,58,0.08)',
        'laya-md': '0 6px 24px rgba(0,60,58,0.12)',
        'laya-lg': '0 16px 48px rgba(0,60,58,0.16)',
      },
      borderRadius: {
        'laya': '12px',
      },
    },
  },
  plugins: [],
}
export default config
