/// <reference types="vitest" />
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [solid()],
  
  // 🧪 测试配置
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: '0.0.0.0',  // 允许外部访问
    allowedHosts: ['avatar.sngxai.com', 'localhost'],  // 允许的域名
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    // 代理配置
    proxy: {
      // Fish Audio API 代理（绕过 CORS）
      '/api/fish-tts': {
        target: 'https://api.fish.audio',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fish-tts/, '/v1/tts'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const auth = req.headers['authorization'];
            if (auth) {
              proxyReq.setHeader('Authorization', auth);
            }
          });
        },
      },
      // OpenClaw Bridge 代理（让外网也能访问 Bridge）
      '/api/bridge': {
        target: 'http://localhost:12394',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bridge/, ''),
      },
      // OpenClaw Gateway WebSocket 代理
      '/api/gateway': {
        target: 'ws://localhost:18789',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api\/gateway/, ''),
      },
    },
  },
  
  // 🚀 Phase 5: 性能优化
  build: {
    // 代码分割
    rollupOptions: {
      output: {
        manualChunks: {
          // Live2D 相关单独分块
          'live2d': ['pixi.js', 'pixi-live2d-display'],
          // UI 组件单独分块
          'ui': ['@kobalte/core'],
        },
      },
    },
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 生产环境移除 console
        drop_debugger: true,
      },
    },
    // 资源内联阈值 (4KB 以下内联)
    assetsInlineLimit: 4096,
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 源码映射 (生产环境关闭)
    sourcemap: false,
    // 目标浏览器
    target: 'esnext',
    // chunk 大小警告阈值
    chunkSizeWarningLimit: 1000,
  },
  
  // 依赖优化
  optimizeDeps: {
    include: ['solid-js', 'pixi.js', 'pixi-live2d-display'],
    exclude: ['@tauri-apps/api', '@tauri-apps/plugin-opener'],
  },
  
  // esbuild 配置
  esbuild: {
    // 生产环境移除 console
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
}));
