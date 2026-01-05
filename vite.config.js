export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Memisahkan Firebase menjadi chunk tersendiri
            if (id.includes('firebase')) {
              return 'firebase-vendor';
            }
            // Memisahkan library lainnya
            return 'vendor';
          }
        },
      },
    },
  },
})
