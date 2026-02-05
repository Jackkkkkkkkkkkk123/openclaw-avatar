// 增强版配置 - 添加Session管理功能

// Session 预设
export const SESSION_PRESETS = {
  avatar: 'agent:main:avatar',        // 默认Avatar session
  test: 'agent:main:avatar-test',     // 测试专用 
  dev: 'agent:main:avatar-dev',       // 开发调试
  personal: 'agent:main:avatar-personal', // 个人定制
  demo: 'agent:main:avatar-demo',     // 演示模式
};

export const SESSION_DESCRIPTIONS = {
  [SESSION_PRESETS.avatar]: '默认Avatar session（推荐）',
  [SESSION_PRESETS.test]: '测试和实验功能',
  [SESSION_PRESETS.dev]: '开发调试模式',  
  [SESSION_PRESETS.personal]: '个人定制配置',
  [SESSION_PRESETS.demo]: '演示展示模式',
};

// 检查Session是否为主session（避免冲突）
export function isMainSession(sessionKey: string): boolean {
  const mainSessions = [
    'agent:main:main',      // 主要session
    'agent:main',           // 简化主session
    '',                     // 空字符串默认主session
    undefined,              // undefined默认主session
  ];
  return mainSessions.includes(sessionKey);
}

// 验证Session配置
export function validateSessionConfig(sessionKey: string): { 
  isValid: boolean; 
  warning?: string; 
  suggestion?: string; 
} {
  if (!sessionKey) {
    return {
      isValid: false,
      warning: 'Session key不能为空',
      suggestion: '使用默认的 agent:main:avatar'
    };
  }
  
  if (isMainSession(sessionKey)) {
    return {
      isValid: false,
      warning: '⚠️ 此session会与主对话冲突！',
      suggestion: '请选择Avatar专用session'
    };
  }
  
  if (!sessionKey.startsWith('agent:main:avatar')) {
    return {
      isValid: true,
      warning: '自定义session，请确保不会冲突',
      suggestion: '建议使用 agent:main:avatar-xxx 格式'
    };
  }
  
  return { isValid: true };
}

// Session管理工具
export const sessionManager = {
  getCurrentSession: () => config().sessionKey,
  
  switchToPreset: (preset: keyof typeof SESSION_PRESETS) => {
    const newSessionKey = SESSION_PRESETS[preset];
    updateConfig({ sessionKey: newSessionKey });
    console.log(`[SessionManager] 切换到预设: ${preset} (${newSessionKey})`);
  },
  
  setCustomSession: (customSessionKey: string) => {
    const validation = validateSessionConfig(customSessionKey);
    if (!validation.isValid) {
      throw new Error(`无效的Session: ${validation.warning}`);
    }
    updateConfig({ sessionKey: customSessionKey });
    console.log(`[SessionManager] 设置自定义Session: ${customSessionKey}`);
  },
  
  resetToDefault: () => {
    updateConfig({ sessionKey: SESSION_PRESETS.avatar });
    console.log('[SessionManager] 重置为默认Session');
  }
};

// 将这些功能集成到现有的 configStore.ts 中...
// （这个文件是增强示例，实际需要合并到原文件）