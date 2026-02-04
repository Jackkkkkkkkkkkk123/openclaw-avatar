/**
 * KeyboardShortcuts 单元测试
 * 
 * 测试键盘快捷键管理功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeyboardShortcuts, formatShortcut, ShortcutAction } from './KeyboardShortcuts';

// Mock navigator.platform
const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');

describe('KeyboardShortcuts', () => {
  let shortcuts: KeyboardShortcuts;
  
  beforeEach(() => {
    shortcuts = new KeyboardShortcuts();
  });
  
  afterEach(() => {
    shortcuts.destroy();
  });
  
  describe('基础功能', () => {
    it('应该能创建实例', () => {
      expect(shortcuts).toBeInstanceOf(KeyboardShortcuts);
    });
    
    it('应该能初始化并绑定事件监听', () => {
      const addSpy = vi.spyOn(document, 'addEventListener');
      shortcuts.init();
      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function), { capture: true });
      addSpy.mockRestore();
    });
    
    it('销毁时应该移除事件监听', () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener');
      shortcuts.init();
      shortcuts.destroy();
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function), { capture: true });
      removeSpy.mockRestore();
    });
  });
  
  describe('快捷键注册', () => {
    it('应该能注册单个快捷键', () => {
      const callback = vi.fn();
      const action: ShortcutAction = {
        id: 'test-action',
        name: '测试动作',
        description: '这是测试',
        keys: ['Ctrl', 'T'],
        callback,
      };
      
      shortcuts.register(action);
      const all = shortcuts.getAll();
      
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('test-action');
      expect(all[0].enabled).toBe(true);
    });
    
    it('注册时 enabled=false 应该正确保存', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'disabled-action',
        name: '禁用动作',
        description: '测试',
        keys: ['Ctrl', 'D'],
        callback,
        enabled: false,
      });
      
      const all = shortcuts.getAll();
      expect(all[0].enabled).toBe(false);
    });
    
    it('应该能批量注册默认快捷键', () => {
      const callbacks = {
        'toggle-chat': vi.fn(),
        'toggle-settings': vi.fn(),
        'expression-happy': vi.fn(),
      };
      
      shortcuts.registerDefaults(callbacks);
      const all = shortcuts.getAll();
      
      expect(all.length).toBe(3);
      expect(all.map(a => a.id)).toContain('toggle-chat');
      expect(all.map(a => a.id)).toContain('toggle-settings');
      expect(all.map(a => a.id)).toContain('expression-happy');
    });
    
    it('应该能注销快捷键', () => {
      shortcuts.register({
        id: 'to-remove',
        name: '待删除',
        description: '测试',
        keys: ['Ctrl', 'X'],
        callback: vi.fn(),
      });
      
      expect(shortcuts.getAll()).toHaveLength(1);
      
      shortcuts.unregister('to-remove');
      expect(shortcuts.getAll()).toHaveLength(0);
    });
    
    it('注销不存在的快捷键不应报错', () => {
      expect(() => shortcuts.unregister('non-existent')).not.toThrow();
    });
  });
  
  describe('启用/禁用控制', () => {
    it('应该能启用/禁用特定快捷键', () => {
      shortcuts.register({
        id: 'toggleable',
        name: '可切换',
        description: '测试',
        keys: ['Ctrl', 'T'],
        callback: vi.fn(),
      });
      
      shortcuts.setEnabled('toggleable', false);
      expect(shortcuts.getAll()[0].enabled).toBe(false);
      
      shortcuts.setEnabled('toggleable', true);
      expect(shortcuts.getAll()[0].enabled).toBe(true);
    });
    
    it('设置不存在的快捷键启用状态不应报错', () => {
      expect(() => shortcuts.setEnabled('non-existent', true)).not.toThrow();
    });
    
    it('应该能全局禁用所有快捷键', () => {
      shortcuts.setGlobalEnabled(false);
      // 内部状态无法直接检查，但不应报错
      expect(() => shortcuts.setGlobalEnabled(true)).not.toThrow();
    });
  });
  
  describe('快捷键触发', () => {
    beforeEach(() => {
      shortcuts.init();
    });
    
    it('应该在按下匹配的快捷键时触发回调', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'ctrl-t',
        name: '测试',
        description: '测试',
        keys: ['Ctrl', 't'],
        callback,
      });
      
      const event = new KeyboardEvent('keydown', {
        key: 't',
        ctrlKey: true,
        bubbles: true,
      });
      
      document.dispatchEvent(event);
      expect(callback).toHaveBeenCalled();
    });
    
    it('应该在按下 Shift 组合键时触发', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'ctrl-shift-s',
        name: '测试',
        description: '测试',
        keys: ['Ctrl', 'Shift', 's'],
        callback,
      });
      
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      
      document.dispatchEvent(event);
      expect(callback).toHaveBeenCalled();
    });
    
    it('不匹配的快捷键不应触发', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'ctrl-t',
        name: '测试',
        description: '测试',
        keys: ['Ctrl', 't'],
        callback,
      });
      
      // 按下 Ctrl+S 而不是 Ctrl+T
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
      });
      
      document.dispatchEvent(event);
      expect(callback).not.toHaveBeenCalled();
    });
    
    it('禁用的快捷键不应触发', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'disabled',
        name: '测试',
        description: '测试',
        keys: ['Ctrl', 'd'],
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
    
    it('全局禁用时不应触发任何快捷键', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'test',
        name: '测试',
        description: '测试',
        keys: ['Ctrl', 't'],
        callback,
      });
      
      shortcuts.setGlobalEnabled(false);
      
      const event = new KeyboardEvent('keydown', {
        key: 't',
        ctrlKey: true,
        bubbles: true,
      });
      
      document.dispatchEvent(event);
      expect(callback).not.toHaveBeenCalled();
    });
    
    it('应该阻止事件默认行为和冒泡', () => {
      const callback = vi.fn();
      shortcuts.register({
        id: 'test',
        name: '测试',
        description: '测试',
        keys: ['Ctrl', 't'],
        callback,
      });
      
      const event = new KeyboardEvent('keydown', {
        key: 't',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      
      const preventSpy = vi.spyOn(event, 'preventDefault');
      const stopSpy = vi.spyOn(event, 'stopPropagation');
      
      document.dispatchEvent(event);
      
      expect(preventSpy).toHaveBeenCalled();
      expect(stopSpy).toHaveBeenCalled();
    });
    
    it('回调抛出错误不应中断程序', () => {
      const callback = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      
      shortcuts.register({
        id: 'error-test',
        name: '测试',
        description: '测试',
        keys: ['Ctrl', 'e'],
        callback,
      });
      
      const event = new KeyboardEvent('keydown', {
        key: 'e',
        ctrlKey: true,
        bubbles: true,
      });
      
      expect(() => document.dispatchEvent(event)).not.toThrow();
      expect(callback).toHaveBeenCalled();
    });
  });
  
  describe('触发监听', () => {
    beforeEach(() => {
      shortcuts.init();
    });
    
    it('应该能监听快捷键触发事件', () => {
      const callback = vi.fn();
      const listener = vi.fn();
      
      shortcuts.register({
        id: 'observed',
        name: '被监听',
        description: '测试',
        keys: ['Ctrl', 'o'],
        callback,
      });
      
      shortcuts.onTrigger(listener);
      
      const event = new KeyboardEvent('keydown', {
        key: 'o',
        ctrlKey: true,
        bubbles: true,
      });
      
      document.dispatchEvent(event);
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        id: 'observed',
      }));
    });
    
    it('应该能取消监听', () => {
      const callback = vi.fn();
      const listener = vi.fn();
      
      shortcuts.register({
        id: 'test',
        name: '测试',
        description: '测试',
        keys: ['Ctrl', 't'],
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
  });
  
  describe('静态方法', () => {
    it('getDefaults 应该返回默认快捷键列表', () => {
      const defaults = KeyboardShortcuts.getDefaults();
      
      expect(Array.isArray(defaults)).toBe(true);
      expect(defaults.length).toBeGreaterThan(0);
      expect(defaults[0]).toHaveProperty('id');
      expect(defaults[0]).toHaveProperty('keys');
      expect(defaults[0]).not.toHaveProperty('callback');
    });
    
    it('默认快捷键应该包含常用操作', () => {
      const defaults = KeyboardShortcuts.getDefaults();
      const ids = defaults.map(d => d.id);
      
      expect(ids).toContain('toggle-chat');
      expect(ids).toContain('toggle-settings');
      expect(ids).toContain('toggle-theme');
      expect(ids).toContain('help');
    });
  });
});

describe('formatShortcut', () => {
  describe('Windows 平台', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true,
      });
    });
    
    afterEach(() => {
      if (originalPlatform) {
        Object.defineProperty(navigator, 'platform', originalPlatform);
      }
    });
    
    it('应该格式化 Ctrl 组合键', () => {
      expect(formatShortcut(['Ctrl', 'S'])).toBe('Ctrl+S');
    });
    
    it('应该格式化 Ctrl+Shift 组合键', () => {
      expect(formatShortcut(['Ctrl', 'Shift', 'S'])).toBe('Ctrl+Shift+S');
    });
    
    it('应该格式化 Alt 组合键', () => {
      expect(formatShortcut(['Alt', 'F4'])).toBe('Alt+F4');
    });
    
    it('应该格式化特殊按键', () => {
      expect(formatShortcut(['Enter'])).toBe('↵');
      expect(formatShortcut(['Escape'])).toBe('Esc');
      expect(formatShortcut(['Space'])).toBe('␣');
      expect(formatShortcut(['Tab'])).toBe('⇥');
    });
    
    it('应该格式化方向键', () => {
      expect(formatShortcut(['ArrowUp'])).toBe('↑');
      expect(formatShortcut(['ArrowDown'])).toBe('↓');
      expect(formatShortcut(['ArrowLeft'])).toBe('←');
      expect(formatShortcut(['ArrowRight'])).toBe('→');
    });
  });
  
  describe('Mac 平台', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      });
    });
    
    afterEach(() => {
      if (originalPlatform) {
        Object.defineProperty(navigator, 'platform', originalPlatform);
      }
    });
    
    it('应该使用 Mac 符号格式化 Ctrl', () => {
      expect(formatShortcut(['Ctrl', 'S'])).toBe('⌃S');
    });
    
    it('应该使用 Mac 符号格式化 Shift', () => {
      expect(formatShortcut(['Shift', 'S'])).toBe('⇧S');
    });
    
    it('应该使用 Mac 符号格式化 Alt/Option', () => {
      expect(formatShortcut(['Alt', 'S'])).toBe('⌥S');
      expect(formatShortcut(['Option', 'S'])).toBe('⌥S');
    });
    
    it('应该使用 Mac 符号格式化 Command', () => {
      expect(formatShortcut(['Cmd', 'S'])).toBe('⌘S');
      expect(formatShortcut(['Command', 'S'])).toBe('⌘S');
      expect(formatShortcut(['Meta', 'S'])).toBe('⌘S');
      expect(formatShortcut(['⌘', 'S'])).toBe('⌘S');
    });
    
    it('Mac 上组合键不使用加号分隔', () => {
      expect(formatShortcut(['Ctrl', 'Shift', 'S'])).toBe('⌃⇧S');
    });
  });
  
  describe('特殊按键别名', () => {
    it('应该识别 Control 别名', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true,
      });
      expect(formatShortcut(['Control', 'S'])).toBe('Ctrl+S');
    });
    
    it('应该识别 Return 别名', () => {
      expect(formatShortcut(['Return'])).toContain('↵');
    });
    
    it('应该识别 Esc 别名', () => {
      expect(formatShortcut(['Esc'])).toBe('Esc');
    });
    
    it('应该识别 Backspace 和 Delete', () => {
      expect(formatShortcut(['Backspace'])).toBe('⌫');
      expect(formatShortcut(['Delete'])).toBe('⌦');
    });
  });
});
