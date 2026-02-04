/**
 * KeyboardShortcuts - 键盘快捷键管理
 * 
 * 提供全局键盘快捷键支持，提升操作效率
 */

export interface ShortcutAction {
  id: string;
  name: string;
  description: string;
  keys: string[];  // e.g., ['Ctrl', 'Shift', 'M']
  callback: () => void;
  enabled?: boolean;
}

type ShortcutCallback = (action: ShortcutAction) => void;

/**
 * 解析按键组合字符串
 */
function parseShortcut(keys: string[]): {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string;
} {
  const result = {
    ctrl: false,
    shift: false,
    alt: false,
    meta: false,
    key: '',
  };
  
  keys.forEach(k => {
    const lower = k.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') result.ctrl = true;
    else if (lower === 'shift') result.shift = true;
    else if (lower === 'alt' || lower === 'option') result.alt = true;
    else if (lower === 'meta' || lower === 'cmd' || lower === 'command' || lower === '⌘') result.meta = true;
    else result.key = lower;
  });
  
  return result;
}

/**
 * 格式化快捷键显示
 */
export function formatShortcut(keys: string[]): string {
  const isMac = navigator.platform.toLowerCase().includes('mac');
  
  return keys.map(k => {
    const lower = k.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') return isMac ? '⌃' : 'Ctrl';
    if (lower === 'shift') return isMac ? '⇧' : 'Shift';
    if (lower === 'alt' || lower === 'option') return isMac ? '⌥' : 'Alt';
    if (lower === 'meta' || lower === 'cmd' || lower === 'command' || lower === '⌘') return isMac ? '⌘' : 'Win';
    if (lower === 'enter' || lower === 'return') return '↵';
    if (lower === 'escape' || lower === 'esc') return 'Esc';
    if (lower === 'space') return '␣';
    if (lower === 'backspace') return '⌫';
    if (lower === 'delete') return '⌦';
    if (lower === 'tab') return '⇥';
    if (lower === 'arrowup') return '↑';
    if (lower === 'arrowdown') return '↓';
    if (lower === 'arrowleft') return '←';
    if (lower === 'arrowright') return '→';
    return k.toUpperCase();
  }).join(isMac ? '' : '+');
}

export class KeyboardShortcuts {
  private actions: Map<string, ShortcutAction> = new Map();
  private listeners: Set<ShortcutCallback> = new Set();
  private enabled = true;
  private boundHandler: (e: KeyboardEvent) => void;
  
  // 默认快捷键
  private static readonly DEFAULT_SHORTCUTS: Omit<ShortcutAction, 'callback'>[] = [
    {
      id: 'toggle-chat',
      name: '切换聊天面板',
      description: '显示/隐藏聊天面板',
      keys: ['Ctrl', 'Shift', 'C'],
    },
    {
      id: 'toggle-settings',
      name: '打开设置',
      description: '打开设置对话框',
      keys: ['Ctrl', ','],
    },
    {
      id: 'toggle-voice',
      name: '语音输入',
      description: '开始/停止语音输入',
      keys: ['Ctrl', 'Shift', 'V'],
    },
    {
      id: 'toggle-tracking',
      name: '头部追踪',
      description: '开始/停止头部追踪',
      keys: ['Ctrl', 'Shift', 'T'],
    },
    {
      id: 'expression-happy',
      name: '开心表情',
      description: '切换到开心表情',
      keys: ['Ctrl', '1'],
    },
    {
      id: 'expression-sad',
      name: '难过表情',
      description: '切换到难过表情',
      keys: ['Ctrl', '2'],
    },
    {
      id: 'expression-surprised',
      name: '惊讶表情',
      description: '切换到惊讶表情',
      keys: ['Ctrl', '3'],
    },
    {
      id: 'expression-neutral',
      name: '普通表情',
      description: '切换到普通表情',
      keys: ['Ctrl', '0'],
    },
    {
      id: 'focus-input',
      name: '聚焦输入框',
      description: '聚焦到聊天输入框',
      keys: ['Ctrl', 'L'],
    },
    {
      id: 'send-message',
      name: '发送消息',
      description: '发送当前输入的消息',
      keys: ['Ctrl', 'Enter'],
    },
    {
      id: 'clear-chat',
      name: '清空聊天',
      description: '清空聊天历史',
      keys: ['Ctrl', 'Shift', 'Delete'],
    },
    {
      id: 'toggle-theme',
      name: '切换主题',
      description: '切换深色/浅色主题',
      keys: ['Ctrl', 'Shift', 'D'],
    },
    {
      id: 'toggle-fullscreen',
      name: '全屏模式',
      description: '切换全屏模式',
      keys: ['F11'],
    },
    {
      id: 'escape',
      name: '取消/关闭',
      description: '关闭对话框或取消操作',
      keys: ['Escape'],
    },
    {
      id: 'help',
      name: '快捷键帮助',
      description: '显示快捷键列表',
      keys: ['Ctrl', '/'],
    },
  ];
  
  constructor() {
    this.boundHandler = this.handleKeyDown.bind(this);
    console.log('[Shortcuts] 键盘快捷键服务初始化');
  }
  
  /**
   * 初始化并绑定事件
   */
  init(): void {
    document.addEventListener('keydown', this.boundHandler, { capture: true });
    console.log('[Shortcuts] 快捷键监听已启动');
  }
  
  /**
   * 注册快捷键
   */
  register(action: ShortcutAction): void {
    this.actions.set(action.id, { ...action, enabled: action.enabled !== false });
    console.log(`[Shortcuts] 注册快捷键: ${action.id} (${formatShortcut(action.keys)})`);
  }
  
  /**
   * 批量注册默认快捷键
   */
  registerDefaults(callbacks: Partial<Record<string, () => void>>): void {
    KeyboardShortcuts.DEFAULT_SHORTCUTS.forEach(shortcut => {
      const callback = callbacks[shortcut.id];
      if (callback) {
        this.register({ ...shortcut, callback });
      }
    });
  }
  
  /**
   * 注销快捷键
   */
  unregister(id: string): void {
    this.actions.delete(id);
  }
  
  /**
   * 启用/禁用特定快捷键
   */
  setEnabled(id: string, enabled: boolean): void {
    const action = this.actions.get(id);
    if (action) {
      action.enabled = enabled;
    }
  }
  
  /**
   * 全局启用/禁用
   */
  setGlobalEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * 处理按键事件
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.enabled) return;
    
    // 忽略输入框中的部分快捷键
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    
    // 遍历所有注册的快捷键
    for (const [, action] of this.actions) {
      if (!action.enabled) continue;
      
      const parsed = parseShortcut(action.keys);
      
      // 检查修饰键
      if (parsed.ctrl !== (event.ctrlKey || event.metaKey)) continue;
      if (parsed.shift !== event.shiftKey) continue;
      if (parsed.alt !== event.altKey) continue;
      
      // 检查主键
      if (parsed.key && parsed.key !== event.key.toLowerCase()) continue;
      
      // 在输入框中，只响应带修饰键的快捷键
      if (isInput && !parsed.ctrl && !parsed.alt && !parsed.meta && parsed.key !== 'escape') {
        continue;
      }
      
      // 匹配成功，执行回调
      event.preventDefault();
      event.stopPropagation();
      
      console.log(`[Shortcuts] 触发: ${action.id}`);
      
      try {
        action.callback();
      } catch (err) {
        console.error(`[Shortcuts] 执行失败: ${action.id}`, err);
      }
      
      // 通知监听器
      this.listeners.forEach(cb => cb(action));
      
      return;
    }
  }
  
  /**
   * 监听快捷键触发
   */
  onTrigger(callback: ShortcutCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  /**
   * 获取所有注册的快捷键
   */
  getAll(): ShortcutAction[] {
    return Array.from(this.actions.values());
  }
  
  /**
   * 获取默认快捷键列表
   */
  static getDefaults(): Omit<ShortcutAction, 'callback'>[] {
    return KeyboardShortcuts.DEFAULT_SHORTCUTS;
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    document.removeEventListener('keydown', this.boundHandler, { capture: true });
    this.actions.clear();
    this.listeners.clear();
    console.log('[Shortcuts] 服务已销毁');
  }
}

// 单例导出
export const keyboardShortcuts = new KeyboardShortcuts();
