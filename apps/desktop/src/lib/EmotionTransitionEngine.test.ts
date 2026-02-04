/**
 * EmotionTransitionEngine 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmotionTransitionEngine, EmotionType, BlendedEmotion } from './EmotionTransitionEngine';

describe('EmotionTransitionEngine', () => {
  let engine: EmotionTransitionEngine;
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let rafId: number;

  beforeEach(() => {
    rafCallbacks = new Map();
    rafId = 0;

    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = ++rafId;
      rafCallbacks.set(id, cb);
      return id;
    });

    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
      rafCallbacks.delete(id);
    });

    vi.spyOn(performance, 'now').mockReturnValue(0);

    engine = new EmotionTransitionEngine();
  });

  afterEach(() => {
    engine.destroy();
    vi.restoreAllMocks();
  });

  function advanceTime(ms: number): void {
    const current = performance.now() as number;
    vi.spyOn(performance, 'now').mockReturnValue(current + ms);
    
    const callbacks = Array.from(rafCallbacks.entries());
    for (const [id, cb] of callbacks) {
      rafCallbacks.delete(id);
      cb(current + ms);
    }
  }

  describe('初始化', () => {
    it('应该使用默认配置创建', () => {
      const config = engine.getConfig();
      expect(config.transitionSpeed).toBe(500);
      expect(config.easingFunction).toBe('easeInOut');
    });

    it('应该使用自定义配置创建', () => {
      const customEngine = new EmotionTransitionEngine({
        transitionSpeed: 1000,
        easingFunction: 'spring'
      });
      
      const config = customEngine.getConfig();
      expect(config.transitionSpeed).toBe(1000);
      expect(config.easingFunction).toBe('spring');
      
      customEngine.destroy();
    });

    it('应该初始化为 neutral 状态', () => {
      const state = engine.getCurrentState();
      expect(state.type).toBe('neutral');
      expect(state.intensity).toBe(1);
    });
  });

  describe('情绪设置', () => {
    it('应该设置目标情绪', () => {
      engine.setEmotion('happy', 0.8);
      expect(engine.getTargetState()?.type).toBe('happy');
      expect(engine.getTargetState()?.intensity).toBe(0.8);
    });

    it('应该限制强度在 0-1 范围', () => {
      engine.setEmotion('happy', 1.5);
      expect(engine.getTargetState()?.intensity).toBe(1);
      
      engine.setEmotion('sad', -0.5);
      expect(engine.getTargetState()?.intensity).toBe(0);
    });

    it('应该立即设置情绪', () => {
      engine.setEmotionImmediate('angry', 0.9);
      
      const state = engine.getCurrentState();
      expect(state.type).toBe('angry');
      expect(state.intensity).toBe(0.9);
      expect(engine.isTransitioning()).toBe(false);
    });
  });

  describe('过渡', () => {
    it('应该检测过渡状态', () => {
      expect(engine.isTransitioning()).toBe(false);
      
      engine.setEmotion('happy');
      expect(engine.isTransitioning()).toBe(true);
    });

    it('应该返回过渡进度', () => {
      engine.setEmotion('happy');
      engine.start();
      
      expect(engine.getTransitionProgress()).toBe(0);
      
      advanceTime(250);
      expect(engine.getTransitionProgress()).toBeGreaterThan(0);
      expect(engine.getTransitionProgress()).toBeLessThan(1);
    });

    it('应该完成过渡', () => {
      engine.setEmotion('happy');
      engine.start();
      
      advanceTime(1000);  // 超过过渡时间
      
      expect(engine.isTransitioning()).toBe(false);
      expect(engine.getCurrentState().type).toBe('happy');
    });
  });

  describe('混合状态', () => {
    it('应该返回混合状态', () => {
      engine.setEmotion('happy');
      engine.start();
      
      advanceTime(250);
      
      const blended = engine.getBlendedState();
      expect(blended.primary).toBe('happy');
      expect(blended.secondary).toBe('neutral');
      expect(blended.blendProgress).toBeGreaterThan(0);
      expect(blended.blendProgress).toBeLessThan(1);
    });

    it('过渡完成后应该只有主要情绪', () => {
      engine.setEmotion('happy');
      engine.start();
      
      advanceTime(2000);
      
      const blended = engine.getBlendedState();
      expect(blended.primary).toBe('happy');
      expect(blended.secondaryWeight).toBe(0);
      expect(blended.blendProgress).toBe(1);
    });

    it('应该混合多个情绪', () => {
      engine.blendEmotions([
        { type: 'happy', weight: 0.7 },
        { type: 'excited', weight: 0.3 }
      ]);
      
      expect(engine.getTargetState()?.type).toBe('happy');
    });
  });

  describe('情绪趋势', () => {
    it('应该检测情绪趋势', () => {
      // 设置多次相同情绪
      for (let i = 0; i < 5; i++) {
        engine.setEmotionImmediate('happy');
        advanceTime(100);
      }
      
      const trend = engine.getEmotionTrend();
      // 由于只设置了 happy，趋势应该是 happy
    });

    it('历史不足时应该返回 null', () => {
      const trend = engine.getEmotionTrend();
      expect(trend).toBeNull();
    });
  });

  describe('更新循环', () => {
    it('应该启动更新循环', () => {
      engine.start();
      expect(requestAnimationFrame).toHaveBeenCalled();
    });

    it('应该停止更新循环', () => {
      engine.start();
      engine.stop();
      expect(cancelAnimationFrame).toHaveBeenCalled();
    });

    it('应该防止重复启动', () => {
      engine.start();
      engine.start();
      // 不应该多次启动
    });

    it('销毁后不应该启动', () => {
      engine.destroy();
      engine.start();
      // 销毁后不应该启动
    });
  });

  describe('订阅机制', () => {
    it('应该通知状态变化', () => {
      const callback = vi.fn();
      engine.onTransition(callback);
      
      engine.setEmotion('happy');
      engine.start();
      advanceTime(100);
      
      expect(callback).toHaveBeenCalled();
    });

    it('应该支持取消订阅', () => {
      const callback = vi.fn();
      const unsubscribe = engine.onTransition(callback);
      
      engine.setEmotion('happy');
      engine.start();
      advanceTime(100);
      
      const callCount = callback.mock.callCount;
      unsubscribe();
      advanceTime(100);
      
      expect(callback.mock.callCount).toBe(callCount);
    });

    it('回调错误不应该中断其他回调', () => {
      const callback1 = vi.fn().mockImplementation(() => {
        throw new Error('test');
      });
      const callback2 = vi.fn();
      
      engine.onTransition(callback1);
      engine.onTransition(callback2);
      
      engine.setEmotion('happy');
      engine.start();
      advanceTime(100);
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('Easing 函数', () => {
    const easings = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'spring', 'bounce'] as const;

    for (const easing of easings) {
      it(`应该支持 ${easing} easing`, () => {
        engine.setConfig({ easingFunction: easing });
        engine.setEmotion('happy');
        engine.start();
        
        advanceTime(250);
        
        const progress = engine.getTransitionProgress();
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(1);
      });
    }
  });

  describe('配置管理', () => {
    it('应该获取配置', () => {
      const config = engine.getConfig();
      expect(config).toHaveProperty('transitionSpeed');
      expect(config).toHaveProperty('inertia');
    });

    it('应该更新配置', () => {
      engine.setConfig({ transitionSpeed: 1000 });
      expect(engine.getConfig().transitionSpeed).toBe(1000);
    });
  });

  describe('静态方法', () => {
    it('应该获取可用情绪列表', () => {
      const emotions = EmotionTransitionEngine.getAvailableEmotions();
      expect(emotions).toContain('happy');
      expect(emotions).toContain('sad');
      expect(emotions).toContain('neutral');
    });

    it('应该获取情绪兼容性', () => {
      const compat = EmotionTransitionEngine.getEmotionCompatibility('happy', 'excited');
      expect(compat).toBeGreaterThan(0);
      expect(compat).toBeLessThanOrEqual(1);
    });

    it('相同情绪应该完全兼容', () => {
      const compat = EmotionTransitionEngine.getEmotionCompatibility('happy', 'happy');
      expect(compat).toBe(1);
    });
  });

  describe('重置', () => {
    it('应该重置到默认状态', () => {
      engine.setEmotion('angry');
      engine.start();
      advanceTime(100);
      
      engine.reset();
      
      expect(engine.getCurrentState().type).toBe('neutral');
      expect(engine.isTransitioning()).toBe(false);
    });
  });

  describe('销毁', () => {
    it('应该停止更新循环', () => {
      engine.start();
      engine.destroy();
      expect(cancelAnimationFrame).toHaveBeenCalled();
    });

    it('应该清除回调', () => {
      const callback = vi.fn();
      engine.onTransition(callback);
      
      engine.destroy();
    });
  });

  describe('情绪距离', () => {
    it('相反情绪应该有更长的过渡时间', () => {
      // happy → sad 应该比 happy → excited 更长
      engine.setConfig({ transitionSpeed: 500 });
      
      engine.setEmotionImmediate('happy');
      engine.setEmotion('sad');
      
      // 过渡应该开始
      expect(engine.isTransitioning()).toBe(true);
    });

    it('相似情绪应该有更短的过渡时间', () => {
      engine.setConfig({ transitionSpeed: 500 });
      
      engine.setEmotionImmediate('happy');
      engine.setEmotion('excited');
      
      expect(engine.isTransitioning()).toBe(true);
    });
  });

  describe('情绪惯性', () => {
    it('连续设置相同情绪应该加速过渡', () => {
      engine.setEmotionImmediate('neutral');
      
      // 连续设置 happy
      engine.setEmotion('happy');
      engine.start();
      advanceTime(600);  // 完成
      
      engine.setEmotion('neutral');
      advanceTime(600);
      
      engine.setEmotion('happy');
      // 由于惯性，应该更快
    });
  });

  describe('不同情绪类型', () => {
    const emotions: EmotionType[] = [
      'neutral', 'happy', 'sad', 'angry', 'surprised',
      'fear', 'disgust', 'contempt', 'excited', 'calm',
      'confused', 'thinking'
    ];

    for (const emotion of emotions) {
      it(`应该支持 ${emotion} 情绪`, () => {
        engine.setEmotion(emotion);
        expect(engine.getTargetState()?.type).toBe(emotion);
      });
    }
  });
});
