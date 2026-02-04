// 配置持久化 Store - 使用 localStorage
import { createSignal, createEffect } from 'solid-js';

export interface AppConfig {
  // 连接配置
  gatewayUrl: string;
  gatewayToken: string;
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
  showDevPanel: boolean;  // 开发者面板
  enableParticles: boolean;  // 情绪粒子特效
}

const DEFAULT_CONFIG: AppConfig = {
  gatewayUrl: 'ws://localhost:18789/ws',
  gatewayToken: 'b8fb14e82f2f29e7d81cb6853831be3ad9a6c0c0ddc07979', // 内置 Gateway Token
  fishApiKey: 'ceea7f5420dc4214807f4ce5dccb9da3', // 内置 API Key
  theme: 'dark',
  modelPath: '/live2d/001/0A-原档整理(1).model3.json',
  modelName: 'Lain',
  showChat: true,
  chatPosition: 'right',
  controlsExpanded: true,
  showDevPanel: false,  // 默认关闭开发者面板
  enableParticles: true,  // 默认开启粒子特效
};

const STORAGE_KEY = 'openclaw-avatar-config-v2'; // v2: 强制使用内置配置

// 内置配置（不允许用户覆盖）
const BUILTIN_CONFIG = {
  gatewayUrl: 'ws://localhost:18789/ws',
  gatewayToken: 'b8fb14e82f2f29e7d81cb6853831be3ad9a6c0c0ddc07979',
  fishApiKey: 'ceea7f5420dc4214807f4ce5dccb9da3',
};

// 从 localStorage 加载配置（连接配置始终使用内置值）
function loadConfig(): AppConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // 连接配置强制使用内置值，其他配置允许用户自定义
      return { ...DEFAULT_CONFIG, ...parsed, ...BUILTIN_CONFIG };
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
    name: 'Lain',
    path: '/live2d/001/0A-原档整理(1).model3.json',
    description: '白发角色 - Cubism 3 (默认)',
  },
  {
    name: 'Shizuku',
    path: '/live2d/shizuku/shizuku.model.json',
    description: '测试模型 - Cubism 2',
  },
  {
    name: 'Mao Pro',
    path: '/live2d/mao_pro/mao_pro.model3.json',
    description: '猫娘模型 - Cubism 3',
  },
];
