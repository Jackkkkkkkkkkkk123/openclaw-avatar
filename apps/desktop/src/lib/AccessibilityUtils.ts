/**
 * AccessibilityUtils - 无障碍工具
 * 
 * 提供无障碍功能增强
 * - ARIA 标签管理
 * - 屏幕阅读器通知
 * - 键盘焦点管理
 * - 高对比度模式
 * 
 * Phase B+ - 用户体验增强
 */

export interface AccessibilityConfig {
  announceDelay: number;        // 公告延迟 (ms)
  highContrast: boolean;        // 高对比度模式
  reduceMotion: boolean;        // 减少动画
  focusVisible: boolean;        // 焦点可见
}

const DEFAULT_CONFIG: AccessibilityConfig = {
  announceDelay: 100,
  highContrast: false,
  reduceMotion: false,
  focusVisible: true,
};

type ConfigCallback = (config: AccessibilityConfig) => void;

/**
 * 屏幕阅读器 Live Region 管理
 */
class LiveRegion {
  private element: HTMLDivElement | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.createLiveRegion();
  }

  private createLiveRegion() {
    if (typeof document === 'undefined') return;
    
    this.element = document.createElement('div');
    this.element.id = 'a11y-live-region';
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-live', 'polite');
    this.element.setAttribute('aria-atomic', 'true');
    
    // 视觉隐藏但屏幕阅读器可见
    Object.assign(this.element.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0',
    });
    
    document.body.appendChild(this.element);
  }

  /**
   * 发送公告到屏幕阅读器
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    if (!this.element) return;
    
    this.element.setAttribute('aria-live', priority);
    
    // 清空后设置新内容，确保被读取
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    this.element.textContent = '';
    
    this.timeoutId = setTimeout(() => {
      if (this.element) {
        this.element.textContent = message;
      }
    }, 50);
  }

  /**
   * 清空公告
   */
  clear() {
    if (this.element) {
      this.element.textContent = '';
    }
  }

  /**
   * 销毁
   */
  destroy() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}

/**
 * 无障碍管理器
 */
export class AccessibilityManager {
  private config: AccessibilityConfig;
  private liveRegion: LiveRegion;
  private callbacks: Set<ConfigCallback> = new Set();
  private mediaQueryList: MediaQueryList | null = null;

  constructor(config: Partial<AccessibilityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG };
    this.liveRegion = new LiveRegion();
    
    // 先检测系统偏好
    this.detectUserPreferences();
    
    // 然后应用用户配置（覆盖系统偏好）
    this.config = { ...this.config, ...config };
    
    this.setupMediaQueryListeners();
  }

  /**
   * 检测用户偏好设置
   */
  private detectUserPreferences() {
    if (typeof window === 'undefined') return;
    
    // 检测减少动画偏好
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.config.reduceMotion = prefersReducedMotion.matches;
    
    // 检测高对比度偏好
    const prefersHighContrast = window.matchMedia('(prefers-contrast: more)');
    this.config.highContrast = prefersHighContrast.matches;
  }

  /**
   * 设置媒体查询监听
   */
  private setupMediaQueryListeners() {
    if (typeof window === 'undefined') return;
    
    // 监听减少动画变化
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.addEventListener('change', (e) => {
      this.config.reduceMotion = e.matches;
      this.notifyCallbacks();
    });
    
    // 监听高对比度变化
    const prefersHighContrast = window.matchMedia('(prefers-contrast: more)');
    prefersHighContrast.addEventListener('change', (e) => {
      this.config.highContrast = e.matches;
      this.notifyCallbacks();
    });
  }

  /**
   * 发送公告到屏幕阅读器
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    setTimeout(() => {
      this.liveRegion.announce(message, priority);
    }, this.config.announceDelay);
  }

  /**
   * 发送重要公告
   */
  announceAssertive(message: string) {
    this.announce(message, 'assertive');
  }

  /**
   * 清空公告
   */
  clearAnnouncement() {
    this.liveRegion.clear();
  }

  /**
   * 获取当前配置
   */
  getConfig(): AccessibilityConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AccessibilityConfig>) {
    this.config = { ...this.config, ...config };
    this.notifyCallbacks();
    this.applyConfigToDOM();
  }

  /**
   * 应用配置到 DOM
   */
  private applyConfigToDOM() {
    if (typeof document === 'undefined') return;
    
    const root = document.documentElement;
    
    // 高对比度模式
    root.setAttribute('data-high-contrast', this.config.highContrast ? 'true' : 'false');
    
    // 减少动画
    root.setAttribute('data-reduce-motion', this.config.reduceMotion ? 'true' : 'false');
    
    // 焦点可见
    root.setAttribute('data-focus-visible', this.config.focusVisible ? 'true' : 'false');
  }

  /**
   * 订阅配置变化
   */
  onConfigChange(callback: ConfigCallback): () => void {
    this.callbacks.add(callback);
    callback(this.config);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 通知回调
   */
  private notifyCallbacks() {
    for (const callback of this.callbacks) {
      try {
        callback(this.config);
      } catch (e) {
        console.error('[A11y] Callback error:', e);
      }
    }
  }

  /**
   * 是否应该减少动画
   */
  shouldReduceMotion(): boolean {
    return this.config.reduceMotion;
  }

  /**
   * 是否启用高对比度
   */
  isHighContrast(): boolean {
    return this.config.highContrast;
  }

  /**
   * 设置焦点到元素
   */
  focusElement(element: HTMLElement | null, options: FocusOptions = {}) {
    if (!element) return;
    
    element.focus(options);
    
    // 可选：公告元素的 aria-label
    const label = element.getAttribute('aria-label');
    if (label) {
      this.announce(label);
    }
  }

  /**
   * 创建焦点陷阱
   */
  createFocusTrap(container: HTMLElement): () => void {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };
    
    container.addEventListener('keydown', handleKeydown);
    firstElement?.focus();
    
    return () => {
      container.removeEventListener('keydown', handleKeydown);
    };
  }

  /**
   * 销毁
   */
  destroy() {
    this.liveRegion.destroy();
    this.callbacks.clear();
  }
}

// 全局实例
export const a11yManager = new AccessibilityManager();

// 辅助函数
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  a11yManager.announce(message, priority);
}

export function shouldReduceMotion(): boolean {
  return a11yManager.shouldReduceMotion();
}

export function isHighContrast(): boolean {
  return a11yManager.isHighContrast();
}
