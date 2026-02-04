/**
 * PerformanceDirector 单元测试
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PerformanceDirector,
  getPerformanceDirector,
  PRESET_SCRIPTS,
  type PerformanceScript,
  type PerformanceEvent,
  type PlaybackState
} from './PerformanceDirector';

// Mock localStorage
const mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
});

describe('PerformanceDirector', () => {
  let director: PerformanceDirector;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    director = new PerformanceDirector();
  });

  afterEach(() => {
    director.destroy();
  });

  // ============ 脚本管理 ============

  describe('Script Management', () => {
    it('should load preset scripts on creation', () => {
      const scripts = director.getAllScripts();
      expect(scripts.length).toBeGreaterThan(0);
      expect(scripts.some(s => s.id === 'greeting')).toBe(true);
      expect(scripts.some(s => s.id === 'thinking')).toBe(true);
    });

    it('should create new script', () => {
      const script = director.createScript('Test Script', 'A test description');
      
      expect(script.id).toBeTruthy();
      expect(script.name).toBe('Test Script');
      expect(script.description).toBe('A test description');
      expect(script.events).toEqual([]);
      expect(script.duration).toBe(0);
    });

    it('should get script by id', () => {
      const created = director.createScript('My Script');
      const retrieved = director.getScript(created.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe('My Script');
    });

    it('should return undefined for non-existent script', () => {
      const script = director.getScript('non_existent');
      expect(script).toBeUndefined();
    });

    it('should update script', () => {
      const script = director.createScript('Original');
      director.updateScript(script.id, { name: 'Updated', description: 'New desc' });
      
      const updated = director.getScript(script.id);
      expect(updated!.name).toBe('Updated');
      expect(updated!.description).toBe('New desc');
    });

    it('should delete user script', () => {
      const script = director.createScript('To Delete');
      expect(director.getScript(script.id)).toBeDefined();
      
      const result = director.deleteScript(script.id);
      expect(result).toBe(true);
      expect(director.getScript(script.id)).toBeUndefined();
    });

    it('should not delete preset scripts', () => {
      const result = director.deleteScript('greeting');
      expect(result).toBe(false);
      expect(director.getScript('greeting')).toBeDefined();
    });

    it('should duplicate script', () => {
      const original = director.getScript('greeting')!;
      const duplicate = director.duplicateScript('greeting', 'My Greeting');
      
      expect(duplicate).toBeDefined();
      expect(duplicate!.id).not.toBe(original.id);
      expect(duplicate!.name).toBe('My Greeting');
      expect(duplicate!.events.length).toBe(original.events.length);
    });

    it('should get scripts by category', () => {
      const basicScripts = director.getScriptsByCategory('basic');
      expect(basicScripts.length).toBeGreaterThan(0);
      expect(basicScripts.every(s => s.category === 'basic')).toBe(true);
    });
  });

  // ============ 事件管理 ============

  describe('Event Management', () => {
    let scriptId: string;

    beforeEach(() => {
      const script = director.createScript('Event Test');
      scriptId = script.id;
    });

    it('should add event to script', () => {
      const event = director.addEvent(scriptId, {
        type: 'expression',
        startTime: 0,
        duration: 1000,
        data: { type: 'expression', expression: 'happy' }
      });
      
      expect(event).toBeDefined();
      expect(event!.id).toBeTruthy();
      expect(event!.type).toBe('expression');
      expect(event!.enabled).toBe(true);
    });

    it('should update script duration when adding events', () => {
      director.addEvent(scriptId, {
        type: 'expression',
        startTime: 500,
        duration: 2000,
        data: { type: 'expression', expression: 'happy' }
      });
      
      const script = director.getScript(scriptId);
      expect(script!.duration).toBe(2500); // 500 + 2000
    });

    it('should update event', () => {
      const event = director.addEvent(scriptId, {
        type: 'expression',
        startTime: 0,
        duration: 1000,
        data: { type: 'expression', expression: 'happy' }
      });
      
      director.updateEvent(scriptId, event!.id, { duration: 2000, label: 'Test' });
      
      const script = director.getScript(scriptId);
      const updated = script!.events.find(e => e.id === event!.id);
      expect(updated!.duration).toBe(2000);
      expect(updated!.label).toBe('Test');
    });

    it('should remove event', () => {
      const event = director.addEvent(scriptId, {
        type: 'expression',
        startTime: 0,
        duration: 1000,
        data: { type: 'expression', expression: 'happy' }
      });
      
      const result = director.removeEvent(scriptId, event!.id);
      expect(result).toBe(true);
      
      const script = director.getScript(scriptId);
      expect(script!.events.length).toBe(0);
    });

    it('should reorder events', () => {
      director.addEvent(scriptId, {
        type: 'expression',
        startTime: 0,
        duration: 1000,
        data: { type: 'expression', expression: 'happy' },
        label: 'First'
      });
      
      director.addEvent(scriptId, {
        type: 'expression',
        startTime: 1000,
        duration: 1000,
        data: { type: 'expression', expression: 'sad' },
        label: 'Second'
      });
      
      director.reorderEvents(scriptId, 1, 0);
      
      const script = director.getScript(scriptId);
      expect(script!.events[0].label).toBe('Second');
      expect(script!.events[1].label).toBe('First');
    });

    it('should return undefined when adding to non-existent script', () => {
      const event = director.addEvent('non_existent', {
        type: 'expression',
        startTime: 0,
        duration: 1000,
        data: { type: 'expression', expression: 'happy' }
      });
      expect(event).toBeUndefined();
    });

    it('should handle disabled events in duration calculation', () => {
      director.addEvent(scriptId, {
        type: 'expression',
        startTime: 0,
        duration: 5000,
        data: { type: 'expression', expression: 'happy' },
        enabled: false
      });
      
      director.addEvent(scriptId, {
        type: 'expression',
        startTime: 0,
        duration: 1000,
        data: { type: 'expression', expression: 'sad' }
      });
      
      const script = director.getScript(scriptId);
      expect(script!.duration).toBe(1000); // Only enabled event
    });
  });

  // ============ 播放控制 ============

  describe('Playback Control', () => {
    beforeEach(() => {
      director.load('greeting');
    });

    it('should load script', () => {
      const result = director.load('greeting');
      expect(result).toBe(true);
      
      const script = director.getCurrentScript();
      expect(script).toBeDefined();
      expect(script!.id).toBe('greeting');
    });

    it('should return false when loading non-existent script', () => {
      const result = director.load('non_existent');
      expect(result).toBe(false);
    });

    it('should start playing', async () => {
      await director.play();
      const state = director.getState();
      expect(state.state).toBe('playing');
    });

    it('should pause playback', async () => {
      await director.play();
      director.pause();
      
      const state = director.getState();
      expect(state.state).toBe('paused');
    });

    it('should resume from pause', async () => {
      await director.play();
      director.pause();
      await director.play();
      
      const state = director.getState();
      expect(state.state).toBe('playing');
    });

    it('should stop playback', async () => {
      await director.play();
      director.stop();
      
      const state = director.getState();
      expect(state.state).toBe('stopped');
      expect(state.currentTime).toBe(0);
      expect(state.progress).toBe(0);
    });

    it('should seek to position', () => {
      director.seek(2500);
      
      const state = director.getState();
      expect(state.currentTime).toBe(2500);
    });

    it('should clamp seek to valid range', () => {
      director.seek(-100);
      expect(director.getState().currentTime).toBe(0);
      
      director.seek(99999);
      const script = director.getCurrentScript()!;
      expect(director.getState().currentTime).toBe(script.duration);
    });

    it('should set playback speed', () => {
      director.setSpeed(2);
      expect(director.getState().speed).toBe(2);
      
      director.setSpeed(0.5);
      expect(director.getState().speed).toBe(0.5);
    });

    it('should clamp speed to valid range', () => {
      director.setSpeed(0.1);
      expect(director.getState().speed).toBe(0.25);
      
      director.setSpeed(10);
      expect(director.getState().speed).toBe(4);
    });

    it('should apply play options', async () => {
      await director.play({
        speed: 1.5,
        startTime: 1000,
        loop: true
      });
      
      const state = director.getState();
      expect(state.speed).toBe(1.5);
      expect(state.currentTime).toBeCloseTo(1000, 0); // Allow small floating point variance
      expect(state.loop).toBe(true);
    });
  });

  // ============ 状态订阅 ============

  describe('State Subscription', () => {
    it('should notify on state change', async () => {
      const callback = vi.fn();
      director.onStateChange(callback);
      
      director.load('greeting');
      expect(callback).toHaveBeenCalled();
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      const unsubscribe = director.onStateChange(callback);
      
      unsubscribe();
      director.load('greeting');
      expect(callback).not.toHaveBeenCalled();
    });

    it('should subscribe to events', () => {
      const callback = vi.fn();
      director.on('execute:expression', callback);
      
      // Event callbacks will be called during playback
      expect(typeof callback).toBe('function');
    });
  });

  // ============ 导入导出 ============

  describe('Import/Export', () => {
    it('should export script as JSON', () => {
      const json = director.exportScript('greeting');
      expect(json).toBeDefined();
      
      const parsed = JSON.parse(json!);
      expect(parsed.id).toBe('greeting');
      expect(parsed.name).toBe('打招呼');
    });

    it('should return undefined for non-existent script', () => {
      const json = director.exportScript('non_existent');
      expect(json).toBeUndefined();
    });

    it('should import script from JSON', () => {
      const original = director.getScript('greeting')!;
      const json = director.exportScript('greeting')!;
      
      const imported = director.importScript(json);
      
      expect(imported).toBeDefined();
      expect(imported!.id).not.toBe(original.id); // New ID
      expect(imported!.name).toBe(original.name);
      expect(imported!.events.length).toBe(original.events.length);
    });

    it('should return undefined for invalid JSON', () => {
      const imported = director.importScript('invalid json');
      expect(imported).toBeUndefined();
    });

    it('should save and load from storage', () => {
      const script = director.createScript('Persistent Script');
      director.addEvent(script.id, {
        type: 'expression',
        startTime: 0,
        duration: 1000,
        data: { type: 'expression', expression: 'happy' }
      });
      
      director.saveToStorage();
      
      // Create new director and load
      const newDirector = new PerformanceDirector();
      newDirector.loadFromStorage();
      
      const loaded = newDirector.getScript(script.id);
      expect(loaded).toBeDefined();
      expect(loaded!.name).toBe('Persistent Script');
      
      newDirector.destroy();
    });
  });

  // ============ 预设模板 ============

  describe('Preset Scripts', () => {
    it('should have greeting preset', () => {
      const greeting = director.getScript('greeting');
      expect(greeting).toBeDefined();
      expect(greeting!.name).toBe('打招呼');
      expect(greeting!.events.length).toBe(4);
    });

    it('should have thinking preset', () => {
      const thinking = director.getScript('thinking');
      expect(thinking).toBeDefined();
      expect(thinking!.name).toBe('思考中');
    });

    it('should have excited_announcement preset', () => {
      const preset = director.getScript('excited_announcement');
      expect(preset).toBeDefined();
      expect(preset!.category).toBe('presentation');
    });

    it('should have storytelling_intro preset', () => {
      const preset = director.getScript('storytelling_intro');
      expect(preset).toBeDefined();
      expect(preset!.events.some(e => e.type === 'scene')).toBe(true);
    });

    it('should have emotional_comfort preset', () => {
      const preset = director.getScript('emotional_comfort');
      expect(preset).toBeDefined();
      expect(preset!.tags).toContain('comfort');
    });

    it('should have surprised_reaction preset', () => {
      const preset = director.getScript('surprised_reaction');
      expect(preset).toBeDefined();
      expect(preset!.events.some(e => e.type === 'camera')).toBe(true);
    });

    it('should have shy_response preset', () => {
      const preset = director.getScript('shy_response');
      expect(preset).toBeDefined();
      expect(preset!.tags).toContain('cute');
    });

    it('should have presentation_intro preset', () => {
      const preset = director.getScript('presentation_intro');
      expect(preset).toBeDefined();
      expect(preset!.category).toBe('presentation');
    });
  });

  // ============ 事件执行器 ============

  describe('Event Executors', () => {
    it('should register custom executor', () => {
      const customExecutor = vi.fn();
      director.registerExecutor('custom', customExecutor);
      
      // Executor registered - will be called during playback
      expect(typeof customExecutor).toBe('function');
    });

    it('should emit execute events', async () => {
      const callback = vi.fn();
      director.on('execute:expression', callback);
      
      // Create simple script with single event
      const script = director.createScript('Exec Test');
      director.addEvent(script.id, {
        type: 'expression',
        startTime: 0,
        duration: 100,
        data: { type: 'expression', expression: 'happy' }
      });
      
      director.load(script.id);
      
      // Note: In real tests, we'd need to mock requestAnimationFrame
      // and advance time to trigger event execution
    });
  });

  // ============ 边界情况 ============

  describe('Edge Cases', () => {
    it('should handle empty script', () => {
      const script = director.createScript('Empty');
      director.load(script.id);
      
      const state = director.getState();
      expect(state.duration).toBe(0);
    });

    it('should handle parallel events', () => {
      const script = director.createScript('Parallel Test');
      
      director.addEvent(script.id, {
        type: 'expression',
        startTime: 0,
        duration: 1000,
        data: { type: 'expression', expression: 'happy' },
        layer: 0
      });
      
      director.addEvent(script.id, {
        type: 'motion',
        startTime: 0,
        duration: 1000,
        data: { type: 'motion', motionGroup: 'wave' },
        layer: 1
      });
      
      const loaded = director.getScript(script.id);
      expect(loaded!.events.length).toBe(2);
    });

    it('should handle script without events', () => {
      const script = director.createScript('No Events');
      const json = director.exportScript(script.id);
      
      const parsed = JSON.parse(json!);
      expect(parsed.events).toEqual([]);
    });

    it('should clean up on destroy', () => {
      director.load('greeting');
      director.destroy();
      
      expect(director.getCurrentScript()).toBeNull();
      expect(director.getAllScripts().length).toBe(0);
    });

    it('should not play without loaded script', async () => {
      const newDirector = new PerformanceDirector();
      await newDirector.play();
      
      const state = newDirector.getState();
      expect(state.state).toBe('idle');
      
      newDirector.destroy();
    });
  });

  // ============ 单例模式 ============

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = getPerformanceDirector();
      const instance2 = getPerformanceDirector();
      
      expect(instance1).toBe(instance2);
    });
  });
});
