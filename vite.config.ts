import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Đổi '/calendar/' thành tên repo GitHub của bạn
export default defineConfig({
  plugins: [react()],
  base: '/calendar/',
})
