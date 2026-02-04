// 配置持久化 Store - 使用 localStorage
import { createSignal, createEffect } from 'solid-js';

export interface AppConfig {
  // 连接配置
  gatewayUrl: string;
  fishApiKey: string;
  
  // 外观配置
  theme: 'dark' | 'light' | 'system';
  
  // Live2D 模型
  modelPath: string;
  modelName: string;
  
  // UI 偏好
  showChat: boolean;
  chatPosition: 'right' | 'left';
  controlsExpanded: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  gatewayUrl: 'ws://localhost:3939/ws',
  fishApiKey: '',
  theme: 'dark',
  modelPath: '/live2d/shizuku/shizuku.model.json',
  modelName: 'Shizuku',
  showChat: true,
  chatPosition: 'right',
  controlsExpanded: true,
};

const STORAGE_KEY = 'openclaw-avatar-config';

// 从 localStorage 加载配置
function loadConfig(): AppConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load config:', e);
  }
  return DEFAULT_CONFIG;
}

// 保存配置到 localStorage
function saveConfig(config: AppConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save config:', e);
  }
}

// 创建响应式配置 Store
const [config, setConfig] = createSignal<AppConfig>(loadConfig());

// 自动保存配置变化
createEffect(() => {
  saveConfig(config());
});

// 更新配置
export function updateConfig(partial: Partial<AppConfig>) {
  setConfig(prev => ({ ...prev, ...partial }));
}

// 重置配置
export function resetConfig() {
  setConfig(DEFAULT_CONFIG);
  localStorage.removeItem(STORAGE_KEY);
}

// 导出 Store
export { config, setConfig };

// 可用模型列表
export interface ModelInfo {
  name: string;
  path: string;
  thumbnail?: string;
  description?: string;
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    name: 'Shizuku',
    path: '/live2d/shizuku/shizuku.model.json',
    description: '测试模型 - 可爱女孩',
  },
  // 未来可以添加更多模型
  // {
  //   name: '初音未来',
  //   path: '/live2d/miku/miku.model.json',
  //   description: '初音未来专属模型',
  // },
];
