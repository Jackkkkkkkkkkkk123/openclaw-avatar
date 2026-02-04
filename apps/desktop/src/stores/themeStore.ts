// 主题管理 Store
import { createSignal } from 'solid-js';
import { config, updateConfig } from './configStore';

export type ThemeMode = 'dark' | 'light' | 'system';

// 检测系统主题偏好
function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// 获取实际应用的主题
function getResolvedTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'system') {
    return getSystemTheme();
  }
  return mode;
}

// 当前实际主题
const [resolvedTheme, setResolvedTheme] = createSignal<'dark' | 'light'>(
  getResolvedTheme(config().theme)
);

// 应用主题到 DOM
function applyTheme(theme: 'dark' | 'light') {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  
  // 同时设置 meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#ffffff');
  }
}

// 切换主题
export function setTheme(mode: ThemeMode) {
  updateConfig({ theme: mode });
  const resolved = getResolvedTheme(mode);
  setResolvedTheme(resolved);
  applyTheme(resolved);
}

// 快捷切换
export function toggleTheme() {
  const current = config().theme;
  const next: ThemeMode = current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark';
  setTheme(next);
}

// 初始化主题系统
export function initTheme() {
  // 应用初始主题
  const resolved = getResolvedTheme(config().theme);
  setResolvedTheme(resolved);
  applyTheme(resolved);
  
  // 监听系统主题变化
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      if (config().theme === 'system') {
        const newTheme = e.matches ? 'dark' : 'light';
        setResolvedTheme(newTheme);
        applyTheme(newTheme);
      }
    });
  }
}

// 获取主题模式图标
export function getThemeIcon(mode: ThemeMode): string {
  switch (mode) {
    case 'dark': return '🌙';
    case 'light': return '☀️';
    case 'system': return '💻';
  }
}

export { resolvedTheme };
