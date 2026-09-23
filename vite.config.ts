import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
          if (id.includes('/components/QuarterlySwitchEngine') || id.includes('/components/SavingsProposalPdfModal') || id.includes('/components/DigitalSignatureModal')) {
            return 'feature-switch-engine';
          }
          if (id.includes('/components/CommissionManager')) {
            return 'feature-commissions';
          }
          if (id.includes('/components/SecurityAuditDashboard')) {
            return 'feature-security';
          }
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
});

