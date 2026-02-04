/**
 * KeyboardShortcuts - 键盘快捷键管理测试
 * 
 * 覆盖：
 * - 快捷键注册/注销
 * - 按键事件匹配
 * - 修饰键解析
 * - 快捷键格式化
 * - 全局启用/禁用
 * - 输入框中的行为
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeyboardShortcuts, formatShortcut, ShortcutAction } from './KeyboardShortcuts';

describe('KeyboardShortcuts', () => {
  let shortcuts: KeyboardShortcuts;
  
  beforeEach(() => {
    shortcuts = new KeyboardShortcuts();
    shortcuts.init();
  });
  
  afterEach(() => {
    shortcuts.destroy();
  });
  
  // ============================================
  // 基础功能测试
  // ============================================
  
  describe('基础功能', () => {
    it('应该正确创建实例', () => {
      expect(shortcuts).toBeInstanceOf(KeyboardShortcuts);
    });
    
    it('应该正确初始化', () => {
      const newShortcuts = new KeyboardShortcuts();
      expect(() => newShortcuts.init()).not.toThrow();
      newShortcuts.destroy();
    });
    
    it('应该正确销毁', () => {
      const newShortcuts = new KeyboardShortcuts();
      newShortcuts.init();
      expect(() => newShortcuts.destroy()).not.toThrow();
    });
    
    it('销毁后应该清空所有注册', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'test',
        name: 'Test',
        description: 'Test shortcut',
        keys: ['Ctrl', 'T'],
        callback,
      });
      
      shortcuts.destroy();
      expect(shortcuts.getAll()).toHaveLength(0);
    });
  });
  
  // ============================================
  // 快捷键注册测试
  // ============================================
  
  describe('快捷键注册', () => {
    it('应该正确注册快捷键', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'test-shortcut',
        name: 'Test Shortcut',
        description: 'A test shortcut',
        keys: ['Ctrl', 'Shift', 'T'],
        callback,
      });
      
      const all = shortcuts.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('test-shortcut');
    });
    
    it('应该正确注销快捷键', () => {
      shortcuts.register({
        id: 'to-remove',
        name: 'To Remove',
        description: '',
        keys: ['Ctrl', 'R'],
        callback: vi.fn(),
      });
      
      expect(shortcuts.getAll()).toHaveLength(1);
      
      shortcuts.unregister('to-remove');
      expect(shortcuts.getAll()).toHaveLength(0);
    });
    
    it('注册时默认启用', () => {
      shortcuts.register({
        id: 'default-enabled',
        name: 'Default Enabled',
        description: '',
        keys: ['Ctrl', 'D'],
        callback: vi.fn(),
      });
      
      const action = shortcuts.getAll()[0];
      expect(action.enabled).toBe(true);
    });
    
    it('可以注册为禁用状态', () => {
      shortcuts.register({
        id: 'disabled',
        name: 'Disabled',
        description: '',
        keys: ['Ctrl', 'X'],
        callback: vi.fn(),
        enabled: false,
      });
      
      const action = shortcuts.getAll()[0];
      expect(action.enabled).toBe(false);
    });
    
    it('应该正确覆盖同 ID 的快捷键', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      shortcuts.register({
        id: 'same-id',
        name: 'First',
        description: '',
        keys: ['Ctrl', 'A'],
        callback: callback1,
      });
      
      shortcuts.register({
        id: 'same-id',
        name: 'Second',
        description: '',
        keys: ['Ctrl', 'B'],
        callback: callback2,
      });
      
      const all = shortcuts.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe('Second');
    });
  });
  
  // ============================================
  // 批量注册测试
  // ============================================
  
  describe('批量注册默认快捷键', () => {
    it('应该正确批量注册快捷键', () => {
      const callbacks = {
        'toggle-chat': vi.fn(),
        'toggle-settings': vi.fn(),
        'toggle-theme': vi.fn(),
      };
      
      shortcuts.registerDefaults(callbacks);
      
      const all = shortcuts.getAll();
      expect(all.length).toBe(3);
      
      const ids = all.map(a => a.id);
      expect(ids).toContain('toggle-chat');
      expect(ids).toContain('toggle-settings');
      expect(ids).toContain('toggle-theme');
    });
    
    it('只注册有回调的快捷键', () => {
      shortcuts.registerDefaults({
        'toggle-chat': vi.fn(),
        // 其他使用默认列表中的键但不提供回调
      });
      
      expect(shortcuts.getAll()).toHaveLength(1);
    });
    
    it('应该返回默认快捷键列表', () => {
      const defaults = KeyboardShortcuts.getDefaults();
      expect(defaults.length).toBeGreaterThan(0);
      
      // 检查必需的默认快捷键
      const ids = defaults.map(d => d.id);
      expect(ids).toContain('toggle-chat');
      expect(ids).toContain('toggle-settings');
      expect(ids).toContain('toggle-voice');
      expect(ids).toContain('toggle-tracking');
      expect(ids).toContain('expression-happy');
      expect(ids).toContain('toggle-theme');
      expect(ids).toContain('toggle-fullscreen');
      expect(ids).toContain('help');
    });
  });
  
  // ============================================
  // 启用/禁用测试
  // ============================================
  
  describe('启用/禁用控制', () => {
    it('应该正确启用/禁用单个快捷键', () => {
      shortcuts.register({
        id: 'toggleable',
        name: 'Toggleable',
        description: '',
        keys: ['Ctrl', 'Z'],
        callback: vi.fn(),
      });
      
      shortcuts.setEnabled('toggleable', false);
      expect(shortcuts.getAll()[0].enabled).toBe(false);
      
      shortcuts.setEnabled('toggleable', true);
      expect(shortcuts.getAll()[0].enabled).toBe(true);
    });
    
    it('对不存在的 ID 操作应该安全', () => {
      expect(() => shortcuts.setEnabled('non-existent', false)).not.toThrow();
    });
    
    it('应该支持全局启用/禁用', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'test',
        name: 'Test',
        description: '',
        keys: ['Ctrl', 'T'],
        callback,
      });
      
      shortcuts.setGlobalEnabled(false);
      
      // 触发快捷键（模拟）- 全局禁用时不应该触发
      const event = new KeyboardEvent('keydown', {
        key: 't',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
      
      expect(callback).not.toHaveBeenCalled();
    });
    
    it('全局启用后应该恢复响应', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'test',
        name: 'Test',
        description: '',
        keys: ['Ctrl', 'T'],
        callback,
      });
      
      shortcuts.setGlobalEnabled(false);
      shortcuts.setGlobalEnabled(true);
      
      const event = new KeyboardEvent('keydown', {
        key: 't',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
  
  // ============================================
  // 按键事件触发测试
  // ============================================
  
  describe('按键事件触发', () => {
    it('应该正确触发 Ctrl+Key 组合', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'ctrl-a',
        name: 'Ctrl+A',
        description: '',
        keys: ['Ctrl', 'A'],
        callback,
      });
      
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
    
    it('应该正确触发 Ctrl+Shift+Key 组合', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'ctrl-shift-s',
        name: 'Ctrl+Shift+S',
        description: '',
        keys: ['Ctrl', 'Shift', 'S'],
        callback,
      });
      
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
    
    it('应该正确触发 Alt+Key 组合', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'alt-f',
        name: 'Alt+F',
        description: '',
        keys: ['Alt', 'F'],
        callback,
      });
      
      const event = new KeyboardEvent('keydown', {
        key: 'f',
        altKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
    
    it('应该正确触发功能键', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'f11',
        name: 'F11',
        description: '',
        keys: ['F11'],
        callback,
      });
      
      const event = new KeyboardEvent('keydown', {
        key: 'f11',
        bubbles: true,
      });
      document.dispatchEvent(event);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
    
    it('应该正确触发 Escape', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'escape',
        name: 'Escape',
        description: '',
        keys: ['Escape'],
        callback,
      });
      
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(event);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
    
    it('修饰键不匹配时不应该触发', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'ctrl-s',
        name: 'Ctrl+S',
        description: '',
        keys: ['Ctrl', 'S'],
        callback,
      });
      
      // 只按 S，没有 Ctrl
      const event1 = new KeyboardEvent('keydown', {
        key: 's',
        bubbles: true,
      });
      document.dispatchEvent(event1);
      
      // Ctrl+Shift+S (多了 Shift)
      const event2 = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event2);
      
      expect(callback).not.toHaveBeenCalled();
    });
    
    it('禁用的快捷键不应该触发', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'disabled',
        name: 'Disabled',
        description: '',
        keys: ['Ctrl', 'D'],
        callback,
        enabled: false,
      });
      
      const event = new KeyboardEvent('keydown', {
        key: 'd',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
      
      expect(callback).not.toHaveBeenCalled();
    });
    
    it('macOS 上 Meta 键应该等同于 Ctrl', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'ctrl-c',
        name: 'Ctrl+C',
        description: '',
        keys: ['Ctrl', 'C'],
        callback,
      });
      
      // 使用 metaKey (macOS Command)
      const event = new KeyboardEvent('keydown', {
        key: 'c',
        metaKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
  
  // ============================================
  // 事件监听测试
  // ============================================
  
  describe('事件监听', () => {
    it('应该正确通知触发监听器', () => {
      const callback = vi.fn();
      const listener = vi.fn();
      
      shortcuts.register({
        id: 'test',
        name: 'Test',
        description: '',
        keys: ['Ctrl', 'T'],
        callback,
      });
      
      shortcuts.onTrigger(listener);
      
      const event = new KeyboardEvent('keydown', {
        key: 't',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].id).toBe('test');
    });
    
    it('应该正确取消监听', () => {
      const callback = vi.fn();
      const listener = vi.fn();
      
      shortcuts.register({
        id: 'test',
        name: 'Test',
        description: '',
        keys: ['Ctrl', 'T'],
        callback,
      });
      
      const unsubscribe = shortcuts.onTrigger(listener);
      unsubscribe();
      
      const event = new KeyboardEvent('keydown', {
        key: 't',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
      
      expect(listener).not.toHaveBeenCalled();
    });
    
    it('多个监听器都应该被通知', () => {
      const callback = vi.fn();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      shortcuts.register({
        id: 'test',
        name: 'Test',
        description: '',
        keys: ['Ctrl', 'T'],
        callback,
      });
      
      shortcuts.onTrigger(listener1);
      shortcuts.onTrigger(listener2);
      
      const event = new KeyboardEvent('keydown', {
        key: 't',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });
  
  // ============================================
  // 回调错误处理测试
  // ============================================
  
  describe('错误处理', () => {
    it('回调抛出错误不应该影响其他功能', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();
      
      // 注册一个会抛错的快捷键
      shortcuts.register({
        id: 'error',
        name: 'Error',
        description: '',
        keys: ['Ctrl', 'E'],
        callback: errorCallback,
      });
      
      // 注册一个正常的快捷键
      shortcuts.register({
        id: 'normal',
        name: 'Normal',
        description: '',
        keys: ['Ctrl', 'N'],
        callback: normalCallback,
      });
      
      // 触发会抛错的快捷键
      const errorEvent = new KeyboardEvent('keydown', {
        key: 'e',
        ctrlKey: true,
        bubbles: true,
      });
      
      // 不应该抛出错误
      expect(() => document.dispatchEvent(errorEvent)).not.toThrow();
      expect(errorCallback).toHaveBeenCalled();
      
      // 正常快捷键仍应该能工作
      const normalEvent = new KeyboardEvent('keydown', {
        key: 'n',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(normalEvent);
      
      expect(normalCallback).toHaveBeenCalled();
    });
  });
  
  // ============================================
  // 数字键快捷键测试
  // ============================================
  
  describe('数字键快捷键', () => {
    it('应该正确触发 Ctrl+1', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'ctrl-1',
        name: 'Ctrl+1',
        description: '',
        keys: ['Ctrl', '1'],
        callback,
      });
      
      const event = new KeyboardEvent('keydown', {
        key: '1',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
    
    it('应该正确触发 Ctrl+0', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'ctrl-0',
        name: 'Ctrl+0',
        description: '',
        keys: ['Ctrl', '0'],
        callback,
      });
      
      const event = new KeyboardEvent('keydown', {
        key: '0',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});

// ============================================
// formatShortcut 函数测试
// ============================================

describe('formatShortcut', () => {
  // 模拟不同平台
  const originalPlatform = navigator.platform;
  
  afterEach(() => {
    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });
  
  describe('非 Mac 平台', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        writable: true,
      });
    });
    
    it('应该格式化 Ctrl 键', () => {
      expect(formatShortcut(['Ctrl', 'S'])).toBe('Ctrl+S');
    });
    
    it('应该格式化 Shift 键', () => {
      expect(formatShortcut(['Shift', 'A'])).toBe('Shift+A');
    });
    
    it('应该格式化 Alt 键', () => {
      expect(formatShortcut(['Alt', 'F4'])).toBe('Alt+F4');
    });
    
    it('应该格式化组合键', () => {
      expect(formatShortcut(['Ctrl', 'Shift', 'S'])).toBe('Ctrl+Shift+S');
    });
    
    it('应该格式化特殊键', () => {
      expect(formatShortcut(['Enter'])).toBe('↵');
      expect(formatShortcut(['Escape'])).toBe('Esc');
      expect(formatShortcut(['Space'])).toBe('␣');
      expect(formatShortcut(['Backspace'])).toBe('⌫');
      expect(formatShortcut(['Delete'])).toBe('⌦');
      expect(formatShortcut(['Tab'])).toBe('⇥');
    });
    
    it('应该格式化方向键', () => {
      expect(formatShortcut(['ArrowUp'])).toBe('↑');
      expect(formatShortcut(['ArrowDown'])).toBe('↓');
      expect(formatShortcut(['ArrowLeft'])).toBe('←');
      expect(formatShortcut(['ArrowRight'])).toBe('→');
    });
    
    it('应该大写普通字母', () => {
      expect(formatShortcut(['a'])).toBe('A');
      expect(formatShortcut(['z'])).toBe('Z');
    });
  });
  
  describe('Mac 平台', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        writable: true,
      });
    });
    
    it('应该使用 Mac 符号格式化 Ctrl', () => {
      expect(formatShortcut(['Ctrl', 'S'])).toBe('⌃S');
    });
    
    it('应该使用 Mac 符号格式化 Shift', () => {
      expect(formatShortcut(['Shift', 'A'])).toBe('⇧A');
    });
    
    it('应该使用 Mac 符号格式化 Alt/Option', () => {
      expect(formatShortcut(['Alt', 'F'])).toBe('⌥F');
      expect(formatShortcut(['Option', 'F'])).toBe('⌥F');
    });
    
    it('应该使用 Mac 符号格式化 Command', () => {
      expect(formatShortcut(['Meta', 'C'])).toBe('⌘C');
      expect(formatShortcut(['Cmd', 'C'])).toBe('⌘C');
      expect(formatShortcut(['Command', 'C'])).toBe('⌘C');
      expect(formatShortcut(['⌘', 'C'])).toBe('⌘C');
    });
    
    it('Mac 上组合键不使用 + 连接', () => {
      expect(formatShortcut(['Ctrl', 'Shift', 'S'])).toBe('⌃⇧S');
    });
  });
  
  describe('别名处理', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        writable: true,
      });
    });
    
    it('应该识别 Control 别名', () => {
      expect(formatShortcut(['Control', 'S'])).toBe('Ctrl+S');
    });
    
    it('应该识别 Esc 别名', () => {
      expect(formatShortcut(['Esc'])).toBe('Esc');
    });
    
    it('应该识别 Return 别名', () => {
      expect(formatShortcut(['Return'])).toBe('↵');
    });
  });
});

// ============================================
// 边界情况测试
// ============================================

describe('边界情况', () => {
  let shortcuts: KeyboardShortcuts;
  
  beforeEach(() => {
    shortcuts = new KeyboardShortcuts();
    shortcuts.init();
  });
  
  afterEach(() => {
    shortcuts.destroy();
  });
  
  it('getAll 在没有注册时返回空数组', () => {
    expect(shortcuts.getAll()).toEqual([]);
  });
  
  it('注销不存在的快捷键应该安全', () => {
    expect(() => shortcuts.unregister('non-existent')).not.toThrow();
  });
  
  it('多次初始化应该安全', () => {
    expect(() => {
      shortcuts.init();
      shortcuts.init();
    }).not.toThrow();
  });
  
  it('多次销毁应该安全', () => {
    expect(() => {
      shortcuts.destroy();
      shortcuts.destroy();
    }).not.toThrow();
  });
  
  it('空 keys 数组的行为测试', () => {
    const callback = vi.fn();
    shortcuts.register({
      id: 'empty-keys',
      name: 'Empty Keys',
      description: '',
      keys: [],
      callback,
    });
    
    // 空 keys 数组 -> parsed.key 为 '' -> 匹配无修饰键无主键的情况
    // 带修饰键的按键不应该触发
    const eventWithCtrl = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(eventWithCtrl);
    
    // 带 Ctrl 的不触发（因为 parsed.ctrl=false 而 event.ctrlKey=true）
    expect(callback).not.toHaveBeenCalled();
  });
  
  it('formatShortcut 空数组应该返回空字符串', () => {
    expect(formatShortcut([])).toBe('');
  });
});
