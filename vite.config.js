import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/so-dong-tien/', // đổi thành đúng tên repo GitHub bạn sẽ tạo ở Bước 5
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sổ Dòng Tiền',
        short_name: 'Dòng Tiền',
        description: 'Quản lý chi tiêu cá nhân theo dòng tiền thực',
        theme_color: '#1B211A',
        background_color: '#1B211A',
        display: 'standalone',
        start_url: '/so-dong-tien/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})