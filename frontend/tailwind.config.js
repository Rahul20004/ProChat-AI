/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // support class-based dark mode
  theme: {
    extend: {
      colors: {
        chatBg: '#0b141a',
        chatPanel: '#111b21',
        chatSidebar: '#1e262c',
        chatActive: '#2a3942',
        chatBubbleSelf: '#005c4b',
        chatBubbleOther: '#202c33',
        chatText: '#e9edef',
        chatMuted: '#8696a0',
        chatBorder: '#222e35',
        chatAccent: '#00a884',
      },
      backgroundImage: {
        'chat-pattern': "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
      }
    },
  },
  plugins: [],
}
