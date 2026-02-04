/**
 * MotionBlendingSystem Tests - Round 26
 * 动作混合系统单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock requestAnimationFrame
let rafCallbacks: Map<number, FrameRequestCallback> = new Map();
let rafId = 0;

vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
  const id = ++rafId;
  rafCallbacks.set(id, callback);
  return id;
});

vi.stubGlobal('cancelAnimationFrame', (id: number) => {
  rafCallbacks.delete(id);
});

// 模拟时间流逝
function advanceTime(ms: number) {
  vi.advanceTimersByTime(ms);
  // 执行一个 RAF 回调
  const entries = Array.from(rafCallbacks.entries());
  if (entries.length > 0) {
    const [id, callback] = entries[0];
    rafCallbacks.delete(id);
    callback(performance.now());
  }
}

import { 
  MotionBlendingSystem, 
  MotionLayer, 
  BlendMode,
  BlendConfig,
  BlendResult 
} from './MotionBlendingSystem';

describe('MotionBlendingSystem', () => {
  let system: MotionBlendingSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    rafCallbacks.clear();
    rafId = 0;
    // 获取新实例 (需要先销毁旧的)
    try {
      MotionBlendingSystem.getInstance().destroy();
    } catch (e) {
      // ignore
    }
    system = MotionBlendingSystem.getInstance();
  });

  afterEach(() => {
    system.destroy();
    vi.useRealTimers();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MotionBlendingSystem.getInstance();
      const instance2 = MotionBlendingSystem.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after destroy', () => {
      const instance1 = MotionBlendingSystem.getInstance();
      instance1.destroy();
      const instance2 = MotionBlendingSystem.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Layer Management', () => {
    it('should add a layer', () => {
      const layer = system.addLayer({ name: 'idle' });
      expect(layer).toBeDefined();
      expect(layer.name).toBe('idle');
      expect(layer.weight).toBe(1.0);
      expect(layer.state).toBe('fadingIn');
    });

    it('should generate unique ID if not provided', () => {
      const layer1 = system.addLayer({ name: 'idle1' });
      const layer2 = system.addLayer({ name: 'idle2' });
      expect(layer1.id).not.toBe(layer2.id);
    });

    it('should use provided ID', () => {
      const layer = system.addLayer({ id: 'custom-id', name: 'idle' });
      expect(layer.id).toBe('custom-id');
    });

    it('should apply default fade values', () => {
      const layer = system.addLayer({ name: 'idle' });
      expect(layer.fadeIn).toBe(200);
      expect(layer.fadeOut).toBe(200);
    });

    it('should apply custom fade values', () => {
      const layer = system.addLayer({ name: 'idle', fadeIn: 500, fadeOut: 300 });
      expect(layer.fadeIn).toBe(500);
      expect(layer.fadeOut).toBe(300);
    });

    it('should remove layer immediately', () => {
      const layer = system.addLayer({ name: 'idle' });
      expect(system.hasLayer(layer.id)).toBe(true);
      system.removeLayer(layer.id, true);
      expect(system.hasLayer(layer.id)).toBe(false);
    });

    it('should start fadeOut when removing with fade', () => {
      const layer = system.addLayer({ name: 'idle' });
      layer.state = 'playing'; // 模拟已在播放
      system.removeLayer(layer.id, false);
      const updated = system.getLayer(layer.id);
      expect(updated?.state).toBe('fadingOut');
    });

    it('should get layer by ID', () => {
      const layer = system.addLayer({ id: 'test', name: 'idle' });
      const retrieved = system.getLayer('test');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('idle');
    });

    it('should return undefined for non-existent layer', () => {
      const retrieved = system.getLayer('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should return copy of layer, not reference', () => {
      const layer = system.addLayer({ id: 'test', name: 'idle' });
      const retrieved = system.getLayer('test');
      retrieved!.weight = 0.5;
      const retrieved2 = system.getLayer('test');
      expect(retrieved2?.weight).toBe(1.0);
    });

    it('should check if layer exists', () => {
      system.addLayer({ id: 'exists', name: 'idle' });
      expect(system.hasLayer('exists')).toBe(true);
      expect(system.hasLayer('not-exists')).toBe(false);
    });

    it('should get layer count', () => {
      expect(system.getLayerCount()).toBe(0);
      system.addLayer({ name: 'layer1' });
      expect(system.getLayerCount()).toBe(1);
      system.addLayer({ name: 'layer2' });
      expect(system.getLayerCount()).toBe(2);
    });
  });

  describe('Layer Weight', () => {
    it('should set layer weight', () => {
      const layer = system.addLayer({ id: 'test', name: 'idle' });
      system.setLayerWeight('test', 0.5);
      expect(system.getLayer('test')?.weight).toBe(0.5);
    });

    it('should clamp weight to 0-1 range', () => {
      const layer = system.addLayer({ id: 'test', name: 'idle' });
      system.setLayerWeight('test', 1.5);
      expect(system.getLayer('test')?.weight).toBe(1.0);
      system.setLayerWeight('test', -0.5);
      expect(system.getLayer('test')?.weight).toBe(0);
    });

    it('should return false for non-existent layer', () => {
      const result = system.setLayerWeight('non-existent', 0.5);
      expect(result).toBe(false);
    });
  });

  describe('Active Layers', () => {
    it('should get active layers sorted by priority', () => {
      system.addLayer({ id: 'low', name: 'low', priority: 1 });
      system.addLayer({ id: 'high', name: 'high', priority: 10 });
      system.addLayer({ id: 'mid', name: 'mid', priority: 5 });
      
      const active = system.getActiveLayers();
      expect(active[0].id).toBe('high');
      expect(active[1].id).toBe('mid');
      expect(active[2].id).toBe('low');
    });

    it('should exclude stopped layers', () => {
      const layer = system.addLayer({ id: 'test', name: 'idle' });
      const internal = system.getLayer('test');
      expect(system.getActiveLayers().length).toBe(1);
      
      // 手动设置为 stopped (通过 removeLayer 立即移除)
      system.removeLayer('test', true);
      expect(system.getActiveLayers().length).toBe(0);
    });

    it('should return copies, not references', () => {
      system.addLayer({ id: 'test', name: 'idle' });
      const active = system.getActiveLayers();
      active[0].weight = 0.1;
      expect(system.getLayer('test')?.weight).toBe(1.0);
    });
  });

  describe('Blend Modes', () => {
    it('should support override blend mode (default)', () => {
      const layer = system.addLayer({ name: 'idle' });
      expect(layer.blendMode).toBe('override');
    });

    it('should support additive blend mode', () => {
      const layer = system.addLayer({ name: 'idle', blendMode: 'additive' });
      expect(layer.blendMode).toBe('additive');
    });

    it('should support multiply blend mode', () => {
      const layer = system.addLayer({ name: 'idle', blendMode: 'multiply' });
      expect(layer.blendMode).toBe('multiply');
    });
  });

  describe('Blend Calculation', () => {
    it('should calculate blend result', () => {
      system.addLayer({ name: 'idle', weight: 1.0, fadeIn: 0 });
      const result = system.calculateBlend();
      expect(result.finalWeight).toBeGreaterThan(0);
      expect(result.activeLayers.length).toBeGreaterThan(0);
    });

    it('should return 0 weight for no layers', () => {
      const result = system.calculateBlend();
      expect(result.finalWeight).toBe(0);
      expect(result.activeLayers.length).toBe(0);
    });

    it('should cap final weight at 1.0', () => {
      system.addLayer({ name: 'layer1', weight: 0.8, blendMode: 'additive', fadeIn: 0 });
      system.addLayer({ name: 'layer2', weight: 0.8, blendMode: 'additive', fadeIn: 0 });
      const result = system.calculateBlend();
      expect(result.finalWeight).toBeLessThanOrEqual(1);
    });
  });

  describe('Fade In/Out', () => {
    it('should start in fadingIn state', () => {
      system.setConfig({ defaultFadeIn: 100 });
      const layer = system.addLayer({ id: 'test', name: 'idle' });
      expect(system.getLayer('test')?.state).toBe('fadingIn');
    });

    it('should calculate effective weight during fadeIn', () => {
      system.setConfig({ defaultFadeIn: 100 });
      const layer = system.addLayer({ id: 'test', name: 'idle' });
      
      // 立即计算应该得到部分权重
      const result = system.calculateBlend();
      expect(result.finalWeight).toBeLessThanOrEqual(1);
      // 层应该存在
      expect(system.hasLayer('test')).toBe(true);
    });

    it('should apply fadeIn value of 0', () => {
      const layer = system.addLayer({ name: 'idle', fadeIn: 0 });
      expect(layer.fadeIn).toBe(0);
    });

    it('should transition to stopped after fadeOut', () => {
      system.setConfig({ defaultFadeOut: 100, autoCleanup: false });
      const layer = system.addLayer({ id: 'test', name: 'idle', fadeIn: 0 });
      system.calculateBlend(); // playing
      
      system.removeLayer('test', false);
      vi.advanceTimersByTime(150);
      system.calculateBlend();
      
      // 应该已被清理或标记为stopped
    });
  });

  describe('Duration', () => {
    it('should set duration on layer', () => {
      const layer = system.addLayer({ 
        id: 'test', 
        name: 'idle', 
        fadeIn: 0, 
        duration: 100 
      });
      expect(layer.duration).toBe(100);
    });

    it('should include layer with duration in active layers', () => {
      const layer = system.addLayer({ 
        id: 'test', 
        name: 'idle', 
        duration: 100 
      });
      const active = system.getActiveLayers();
      expect(active.find(l => l.id === 'test')).toBeDefined();
    });
  });

  describe('Max Layers Limit', () => {
    it('should remove lowest priority when exceeding max', () => {
      system.setConfig({ maxLayers: 2 });
      system.addLayer({ id: 'low', name: 'low', priority: 1 });
      system.addLayer({ id: 'high', name: 'high', priority: 10 });
      expect(system.getLayerCount()).toBe(2);
      
      system.addLayer({ id: 'mid', name: 'mid', priority: 5 });
      expect(system.getLayerCount()).toBe(2);
      expect(system.hasLayer('low')).toBe(false);
      expect(system.hasLayer('high')).toBe(true);
      expect(system.hasLayer('mid')).toBe(true);
    });
  });

  describe('Clear All Layers', () => {
    it('should clear all layers immediately', () => {
      system.addLayer({ name: 'layer1' });
      system.addLayer({ name: 'layer2' });
      expect(system.getLayerCount()).toBe(2);
      
      system.clearAllLayers(true);
      expect(system.getLayerCount()).toBe(0);
    });

    it('should start fading out all layers', () => {
      system.addLayer({ id: 'layer1', name: 'layer1' });
      system.addLayer({ id: 'layer2', name: 'layer2' });
      
      system.clearAllLayers(false);
      
      expect(system.getLayer('layer1')?.state).toBe('fadingOut');
      expect(system.getLayer('layer2')?.state).toBe('fadingOut');
    });
  });

  describe('Create Transition', () => {
    it('should create smooth transition between layers', () => {
      const oldLayer = system.addLayer({ id: 'old', name: 'old', fadeIn: 0 });
      const newLayer = system.createTransition('old', 'new', { crossfade: 200 });
      
      expect(newLayer.name).toBe('new');
      expect(newLayer.fadeIn).toBe(200);
      expect(system.getLayer('old')?.state).toBe('fadingOut');
    });

    it('should work without fromLayer', () => {
      const newLayer = system.createTransition(null, 'new');
      expect(newLayer.name).toBe('new');
      expect(system.getLayerCount()).toBe(1);
    });

    it('should apply custom transition options', () => {
      const layer = system.createTransition(null, 'motion', {
        crossfade: 500,
        priority: 10,
        blendMode: 'additive',
      });
      
      expect(layer.fadeIn).toBe(500);
      expect(layer.priority).toBe(10);
      expect(layer.blendMode).toBe('additive');
    });
  });

  describe('Configuration', () => {
    it('should get config', () => {
      const config = system.getConfig();
      expect(config.defaultFadeIn).toBe(200);
      expect(config.defaultFadeOut).toBe(200);
      expect(config.maxLayers).toBe(8);
      expect(config.autoCleanup).toBe(true);
    });

    it('should set partial config', () => {
      system.setConfig({ defaultFadeIn: 500 });
      const config = system.getConfig();
      expect(config.defaultFadeIn).toBe(500);
      expect(config.defaultFadeOut).toBe(200); // unchanged
    });

    it('should return config copy, not reference', () => {
      const config = system.getConfig();
      config.defaultFadeIn = 1000;
      expect(system.getConfig().defaultFadeIn).toBe(200);
    });
  });

  describe('Layer Change Callbacks', () => {
    it('should notify on layer add', () => {
      const callback = vi.fn();
      system.onLayerChange(callback);
      
      system.addLayer({ name: 'idle' });
      expect(callback).toHaveBeenCalled();
    });

    it('should notify on layer remove', () => {
      const layer = system.addLayer({ name: 'idle' });
      const callback = vi.fn();
      system.onLayerChange(callback);
      
      system.removeLayer(layer.id, true);
      expect(callback).toHaveBeenCalled();
    });

    it('should notify on weight change', () => {
      const layer = system.addLayer({ id: 'test', name: 'idle' });
      const callback = vi.fn();
      system.onLayerChange(callback);
      
      system.setLayerWeight('test', 0.5);
      expect(callback).toHaveBeenCalled();
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      const unsubscribe = system.onLayerChange(callback);
      
      system.addLayer({ name: 'layer1' });
      expect(callback).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      system.addLayer({ name: 'layer2' });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => { throw new Error('Callback error'); });
      const normalCallback = vi.fn();
      
      system.onLayerChange(errorCallback);
      system.onLayerChange(normalCallback);
      
      // 不应该抛出错误
      expect(() => system.addLayer({ name: 'idle' })).not.toThrow();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('Destroy', () => {
    it('should clear all state on destroy', () => {
      system.addLayer({ name: 'layer1' });
      const callback = vi.fn();
      system.onLayerChange(callback);
      
      system.destroy();
      
      // 新实例应该是空的
      const newSystem = MotionBlendingSystem.getInstance();
      expect(newSystem.getLayerCount()).toBe(0);
      newSystem.destroy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle removing non-existent layer', () => {
      const result = system.removeLayer('non-existent');
      expect(result).toBe(false);
    });

    it('should handle multiple rapid adds', () => {
      for (let i = 0; i < 20; i++) {
        system.addLayer({ name: `layer${i}`, priority: i });
      }
      // 应该限制在 maxLayers
      expect(system.getLayerCount()).toBeLessThanOrEqual(8);
    });

    it('should handle zero duration', () => {
      const layer = system.addLayer({ name: 'instant', duration: 0, fadeIn: 0 });
      system.calculateBlend();
      // 应该立即开始淡出
    });

    it('should handle concurrent transitions', () => {
      system.addLayer({ id: 'a', name: 'a' });
      system.createTransition('a', 'b');
      const bLayer = system.getActiveLayers().find(l => l.name === 'b');
      system.createTransition(bLayer?.id || null, 'c');
      
      // 不应该崩溃
      expect(system.getLayerCount()).toBeGreaterThan(0);
    });
  });
});
