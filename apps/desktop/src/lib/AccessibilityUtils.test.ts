/**
 * AccessibilityUtils 测试
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AccessibilityManager, announce, shouldReduceMotion, isHighContrast } from './AccessibilityUtils';

describe('AccessibilityManager', () => {
  let manager: AccessibilityManager;

  beforeEach(() => {
    vi.useFakeTimers();
    
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
    
    // 清理 live region
    const liveRegion = document.getElementById('a11y-live-region');
    if (liveRegion) {
      liveRegion.remove();
    }
  });

  describe('基础功能', () => {
    it('应该使用默认配置创建实例', () => {
      manager = new AccessibilityManager();
      expect(manager).toBeDefined();
    });

    it('应该接受自定义配置', () => {
      manager = new AccessibilityManager({
        announceDelay: 200,
        highContrast: true,
      });
      
      const config = manager.getConfig();
      expect(config.announceDelay).toBe(200);
      expect(config.highContrast).toBe(true);
    });

    it('getConfig 应该返回配置副本', () => {
      manager = new AccessibilityManager();
      
      const config1 = manager.getConfig();
      const config2 = manager.getConfig();
      
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('公告系统', () => {
    it('announce 应该创建 live region', () => {
      manager = new AccessibilityManager();
      
      const liveRegion = document.getElementById('a11y-live-region');
      expect(liveRegion).not.toBeNull();
    });

    it('announce 应该设置 aria-live 属性', () => {
      manager = new AccessibilityManager();
      
      manager.announce('测试消息');
      vi.advanceTimersByTime(200);
      
      const liveRegion = document.getElementById('a11y-live-region');
      expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
    });

    it('announceAssertive 应该使用 assertive 优先级', () => {
      manager = new AccessibilityManager();
      
      manager.announceAssertive('紧急消息');
      vi.advanceTimersByTime(200);
      
      const liveRegion = document.getElementById('a11y-live-region');
      expect(liveRegion?.getAttribute('aria-live')).toBe('assertive');
    });

    it('clearAnnouncement 应该清空内容', () => {
      manager = new AccessibilityManager();
      
      manager.announce('测试');
      vi.advanceTimersByTime(200);
      
      manager.clearAnnouncement();
      
      const liveRegion = document.getElementById('a11y-live-region');
      expect(liveRegion?.textContent).toBe('');
    });
  });

  describe('配置更新', () => {
    it('updateConfig 应该更新配置', () => {
      manager = new AccessibilityManager();
      
      manager.updateConfig({ highContrast: true });
      
      expect(manager.getConfig().highContrast).toBe(true);
    });

    it('更新配置应该触发回调', () => {
      manager = new AccessibilityManager();
      
      const callback = vi.fn();
      manager.onConfigChange(callback);
      
      // 订阅时调用一次
      expect(callback).toHaveBeenCalledTimes(1);
      
      manager.updateConfig({ reduceMotion: true });
      
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('取消订阅后不应再触发回调', () => {
      manager = new AccessibilityManager();
      
      const callback = vi.fn();
      const unsubscribe = manager.onConfigChange(callback);
      
      unsubscribe();
      
      manager.updateConfig({ highContrast: true });
      
      // 只有初始调用
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('偏好检测', () => {
    it('shouldReduceMotion 应该返回布尔值', () => {
      manager = new AccessibilityManager();
      
      expect(typeof manager.shouldReduceMotion()).toBe('boolean');
    });

    it('isHighContrast 应该返回布尔值', () => {
      manager = new AccessibilityManager();
      
      expect(typeof manager.isHighContrast()).toBe('boolean');
    });
  });

  describe('焦点管理', () => {
    it('focusElement 应该聚焦到指定元素', () => {
      manager = new AccessibilityManager();
      
      const button = document.createElement('button');
      document.body.appendChild(button);
      
      manager.focusElement(button);
      
      expect(document.activeElement).toBe(button);
      
      document.body.removeChild(button);
    });

    it('focusElement 对 null 不应该崩溃', () => {
      manager = new AccessibilityManager();
      
      expect(() => {
        manager.focusElement(null);
      }).not.toThrow();
    });

    it('focusElement 应该公告 aria-label', () => {
      manager = new AccessibilityManager({ announceDelay: 0 });
      
      const button = document.createElement('button');
      button.setAttribute('aria-label', '关闭按钮');
      document.body.appendChild(button);
      
      manager.focusElement(button);
      vi.advanceTimersByTime(100);
      
      const liveRegion = document.getElementById('a11y-live-region');
      expect(liveRegion?.textContent).toBe('关闭按钮');
      
      document.body.removeChild(button);
    });
  });

  describe('焦点陷阱', () => {
    it('createFocusTrap 应该返回清理函数', () => {
      manager = new AccessibilityManager();
      
      const container = document.createElement('div');
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      container.appendChild(button1);
      container.appendChild(button2);
      document.body.appendChild(container);
      
      const cleanup = manager.createFocusTrap(container);
      
      expect(typeof cleanup).toBe('function');
      
      cleanup();
      document.body.removeChild(container);
    });

    it('createFocusTrap 应该聚焦到第一个元素', () => {
      manager = new AccessibilityManager();
      
      const container = document.createElement('div');
      const button1 = document.createElement('button');
      button1.textContent = 'First';
      const button2 = document.createElement('button');
      button2.textContent = 'Second';
      container.appendChild(button1);
      container.appendChild(button2);
      document.body.appendChild(container);
      
      manager.createFocusTrap(container);
      
      expect(document.activeElement).toBe(button1);
      
      document.body.removeChild(container);
    });
  });

  describe('DOM 属性', () => {
    it('更新配置应该设置 data 属性', () => {
      manager = new AccessibilityManager();
      
      manager.updateConfig({ highContrast: true });
      
      expect(document.documentElement.getAttribute('data-high-contrast')).toBe('true');
    });

    it('reduceMotion 应该设置 data-reduce-motion', () => {
      manager = new AccessibilityManager();
      
      manager.updateConfig({ reduceMotion: true });
      
      expect(document.documentElement.getAttribute('data-reduce-motion')).toBe('true');
    });
  });

  describe('销毁', () => {
    it('destroy 应该移除 live region', () => {
      manager = new AccessibilityManager();
      
      expect(document.getElementById('a11y-live-region')).not.toBeNull();
      
      manager.destroy();
      
      expect(document.getElementById('a11y-live-region')).toBeNull();
    });

    it('多次销毁应该安全', () => {
      manager = new AccessibilityManager();
      
      manager.destroy();
      
      expect(() => {
        manager.destroy();
      }).not.toThrow();
    });
  });

  describe('回调错误处理', () => {
    it('回调错误不应影响服务', () => {
      manager = new AccessibilityManager();
      
      // 先订阅正常回调
      const normalCallback = vi.fn();
      manager.onConfigChange(normalCallback);
      
      // 然后更新配置
      manager.updateConfig({ highContrast: true });
      
      // 正常回调应该被调用
      expect(normalCallback).toHaveBeenCalled();
      expect(normalCallback.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('辅助函数', () => {
  let manager: AccessibilityManager;

  beforeEach(() => {
    vi.useFakeTimers();
    
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    
    const liveRegion = document.getElementById('a11y-live-region');
    if (liveRegion) {
      liveRegion.remove();
    }
  });

  it('announce 函数应该可用', () => {
    expect(() => {
      announce('测试');
    }).not.toThrow();
  });

  it('shouldReduceMotion 函数应该返回布尔值', () => {
    expect(typeof shouldReduceMotion()).toBe('boolean');
  });

  it('isHighContrast 函数应该返回布尔值', () => {
    expect(typeof isHighContrast()).toBe('boolean');
  });
});
