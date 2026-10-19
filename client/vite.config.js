import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allow external access
    allowedHosts: ['.ngrok-free.dev', '.ngrok.io'], // Allow all ngrok domains
    proxy: {
      // Proxy Socket.io requests to backend server
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true, // Enable WebSocket proxy
        changeOrigin: true
      }
    }
  }
})
