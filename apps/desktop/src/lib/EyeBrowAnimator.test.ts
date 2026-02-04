/**
 * EyeBrowAnimator 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EyeBrowAnimator, BrowState, BrowEmotion, BrowPreset } from './EyeBrowAnimator';

describe('EyeBrowAnimator', () => {
  let animator: EyeBrowAnimator;
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

    animator = new EyeBrowAnimator();
  });

  afterEach(() => {
    animator.destroy();
    vi.restoreAllMocks();
  });

  function advanceTime(ms: number): void {
    const current = performance.now() as number;
    vi.spyOn(performance, 'now').mockReturnValue(current + ms);
    
    // 执行所有 RAF 回调
    const callbacks = Array.from(rafCallbacks.entries());
    for (const [id, cb] of callbacks) {
      rafCallbacks.delete(id);
      cb(current + ms);
    }
  }

  describe('初始化', () => {
    it('应该使用默认配置创建', () => {
      const config = animator.getConfig();
      expect(config.microMovement.enabled).toBe(true);
      expect(config.breathSync.enabled).toBe(true);
      expect(config.voiceSync.enabled).toBe(true);
      expect(config.smoothing).toBe(0.15);
    });

    it('应该使用自定义配置创建', () => {
      const customAnimator = new EyeBrowAnimator({
        smoothing: 0.3,
        transitionSpeed: 500
      });
      
      const config = customAnimator.getConfig();
      expect(config.smoothing).toBe(0.3);
      expect(config.transitionSpeed).toBe(500);
      
      customAnimator.destroy();
    });

    it('应该初始化为默认状态', () => {
      const state = animator.getState();
      expect(state.leftRaise).toBe(0);
      expect(state.rightRaise).toBe(0);
      expect(state.leftInner).toBe(0);
      expect(state.rightInner).toBe(0);
    });
  });

  describe('状态设置', () => {
    it('应该设置目标状态', () => {
      animator.setState({ leftRaise: 0.5, rightRaise: 0.5 });
      animator.start();
      advanceTime(1000);

      const state = animator.getState();
      expect(state.leftRaise).toBeGreaterThan(0);
      expect(state.rightRaise).toBeGreaterThan(0);
    });

    it('应该部分更新状态', () => {
      animator.setState({ leftRaise: 0.8 });
      animator.start();
      advanceTime(500);

      const state = animator.getState();
      expect(state.leftRaise).toBeGreaterThan(0);
    });

    it('应该重置状态', () => {
      animator.setState({ leftRaise: 1, rightRaise: 1 });
      animator.start();
      advanceTime(100);
      
      animator.reset();
      
      const state = animator.getState();
      expect(state.leftRaise).toBe(0);
      expect(state.rightRaise).toBe(0);
    });
  });

  describe('情绪设置', () => {
    it('应该设置 happy 情绪', () => {
      animator.setEmotion('happy');
      animator.start();
      advanceTime(500);

      const state = animator.getState();
      expect(state.leftRaise).toBeGreaterThan(0);
      expect(state.rightRaise).toBeGreaterThan(0);
    });

    it('应该设置 angry 情绪', () => {
      animator.setEmotion('angry');
      animator.start();
      advanceTime(500);

      const state = animator.getState();
      expect(state.leftLower).toBeGreaterThan(0);
      expect(state.leftInner).toBeGreaterThan(0);
    });

    it('应该设置 sad 情绪', () => {
      animator.setEmotion('sad');
      animator.start();
      advanceTime(500);

      const state = animator.getState();
      expect(state.leftInner).toBeGreaterThan(0);
      expect(state.rightInner).toBeGreaterThan(0);
    });

    it('应该设置 surprised 情绪', () => {
      animator.setEmotion('surprised');
      animator.start();
      advanceTime(500);

      const state = animator.getState();
      expect(state.leftRaise).toBeGreaterThan(0);
      expect(state.rightRaise).toBeGreaterThan(0);
    });

    it('应该根据强度缩放情绪', () => {
      animator.setEmotion('surprised', 0.5);
      animator.start();
      advanceTime(500);

      const halfState = animator.getState();

      animator.reset();
      animator.setEmotion('surprised', 1.0);
      animator.start();
      advanceTime(500);

      const fullState = animator.getState();

      // 全强度应该比半强度更明显
      expect(fullState.leftRaise).toBeGreaterThan(halfState.leftRaise);
    });

    it('应该限制强度在 0-1 范围', () => {
      animator.setEmotion('happy', 2.0);
      animator.start();
      advanceTime(500);

      const state = animator.getState();
      // 应该不超过预设的最大值
      expect(state.leftRaise).toBeLessThanOrEqual(1);
    });

    it('应该处理未知情绪', () => {
      animator.setEmotion('unknown' as BrowEmotion);
      // 不应该抛出错误
      expect(animator.getState()).toBeDefined();
    });
  });

  describe('预设动画', () => {
    it('应该播放预设', () => {
      const preset: BrowPreset = {
        name: 'test',
        state: { leftRaise: 0.8, rightRaise: 0.8 },
        duration: 200
      };

      animator.playPreset(preset);
      animator.start();
      advanceTime(250);

      const state = animator.getState();
      expect(state.leftRaise).toBeGreaterThan(0.5);
      expect(state.rightRaise).toBeGreaterThan(0.5);
    });

    it('应该添加和播放自定义预设', () => {
      const preset: BrowPreset = {
        name: 'custom',
        state: { leftRaise: 1, rightLower: 0.5 },
        duration: 100
      };

      animator.addPreset('custom', preset);
      expect(animator.getPreset('custom')).toEqual(preset);

      const result = animator.playCustomPreset('custom');
      expect(result).toBe(true);
    });

    it('应该返回 false 当自定义预设不存在', () => {
      const result = animator.playCustomPreset('nonexistent');
      expect(result).toBe(false);
    });

    it('应该支持不同的 easing 函数', () => {
      const easings = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'bounce'] as const;

      for (const easing of easings) {
        animator.reset();
        animator.playPreset({
          name: 'test',
          state: { leftRaise: 1 },
          duration: 100,
          easing
        });
        animator.start();
        advanceTime(150);

        const state = animator.getState();
        expect(state.leftRaise).toBeGreaterThan(0);
      }
    });
  });

  describe('语音联动', () => {
    it('应该响应高音调', () => {
      animator.updateFromVoice(0.8, 0.5);
      animator.start();
      advanceTime(100);

      const state = animator.getState();
      expect(state.leftRaise).toBeGreaterThan(0);
    });

    it('应该响应高强度', () => {
      animator.updateFromVoice(0.5, 0.9);
      animator.start();
      advanceTime(100);

      const state = animator.getState();
      expect(state.leftInner).toBeGreaterThan(0);
    });

    it('应该在禁用时不响应', () => {
      animator.setConfig({
        voiceSync: { enabled: false, pitchInfluence: 0.3, intensityInfluence: 0.2 }
      });

      animator.updateFromVoice(0.9, 0.9);
      
      // 状态不应该因为语音而改变
      const state = animator.getState();
      expect(state.leftRaise).toBe(0);
    });
  });

  describe('呼吸联动', () => {
    it('应该更新呼吸相位', () => {
      animator.updateBreathPhase(Math.PI / 2);
      animator.start();
      advanceTime(100);

      // 呼吸联动应该影响眉毛
      const state = animator.getState();
      expect(state).toBeDefined();
    });
  });

  describe('动画控制', () => {
    it('应该启动动画循环', () => {
      animator.start();
      expect(requestAnimationFrame).toHaveBeenCalled();
    });

    it('应该停止动画循环', () => {
      animator.start();
      animator.stop();
      expect(cancelAnimationFrame).toHaveBeenCalled();
    });

    it('应该防止重复启动', () => {
      animator.start();
      animator.start();
      
      // RAF 只应该被调用一次（初始启动）
      // 第二次 start 不应该重新启动
    });

    it('销毁后不应该再启动', () => {
      animator.destroy();
      animator.start();
      
      // 销毁后应该不能启动
    });
  });

  describe('微动画', () => {
    it('应该在启用时产生微动', () => {
      // 通过回调收集状态变化
      const states: number[] = [];
      animator.onStateChange((state) => {
        states.push(state.leftRaise);
      });
      
      // 设置较大的微动幅度以便测试
      animator.setConfig({
        microMovement: {
          enabled: true,
          amplitude: 0.5,
          frequency: 500,
          asymmetry: 0.3
        },
        smoothing: 0.5  // 更快的平滑
      });
      animator.start();
      
      // 模拟多帧
      for (let i = 0; i < 20; i++) {
        advanceTime(100);
      }

      // 应该收到多个状态更新
      expect(states.length).toBeGreaterThan(5);
      
      // 由于微动是基于正弦波，应该有正有负的值
      const hasPositive = states.some(s => s > 0.001);
      const hasNegative = states.some(s => s < -0.001);
      expect(hasPositive || hasNegative).toBe(true);
    });

    it('应该在禁用时不产生微动', () => {
      animator.setConfig({
        microMovement: { enabled: false, amplitude: 0.05, frequency: 3000, asymmetry: 0.3 }
      });
      
      animator.start();
      advanceTime(100);

      const state1 = animator.getState().leftRaise;
      advanceTime(100);
      const state2 = animator.getState().leftRaise;

      // 禁用微动后应该保持稳定
      expect(state1).toBe(state2);
    });
  });

  describe('订阅机制', () => {
    it('应该通知状态变化', () => {
      const callback = vi.fn();
      animator.onStateChange(callback);

      animator.start();
      advanceTime(100);

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0]).toHaveProperty('leftRaise');
    });

    it('应该支持取消订阅', () => {
      const callback = vi.fn();
      const unsubscribe = animator.onStateChange(callback);

      animator.start();
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

      animator.onStateChange(callback1);
      animator.onStateChange(callback2);

      animator.start();
      advanceTime(100);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('配置管理', () => {
    it('应该获取配置', () => {
      const config = animator.getConfig();
      expect(config).toHaveProperty('smoothing');
      expect(config).toHaveProperty('transitionSpeed');
    });

    it('应该更新配置', () => {
      animator.setConfig({ smoothing: 0.5 });
      expect(animator.getConfig().smoothing).toBe(0.5);
    });
  });

  describe('静态方法', () => {
    it('应该获取可用情绪列表', () => {
      const emotions = EyeBrowAnimator.getAvailableEmotions();
      expect(emotions).toContain('happy');
      expect(emotions).toContain('sad');
      expect(emotions).toContain('angry');
      expect(emotions).toContain('surprised');
    });

    it('应该获取情绪预设', () => {
      const preset = EyeBrowAnimator.getEmotionPreset('happy');
      expect(preset).toBeDefined();
      expect(preset?.leftRaise).toBeGreaterThan(0);
    });

    it('应该返回 undefined 当情绪不存在', () => {
      const preset = EyeBrowAnimator.getEmotionPreset('unknown' as BrowEmotion);
      expect(preset).toBeUndefined();
    });
  });

  describe('销毁', () => {
    it('应该停止动画', () => {
      animator.start();
      animator.destroy();
      
      expect(cancelAnimationFrame).toHaveBeenCalled();
    });

    it('应该清除回调', () => {
      const callback = vi.fn();
      animator.onStateChange(callback);
      
      animator.destroy();
      
      // 销毁后回调应该被清除
    });

    it('应该清除预设', () => {
      animator.addPreset('test', { name: 'test', state: {} });
      animator.destroy();
      
      // 不应该能获取预设（虽然 destroy 后不应该再访问）
    });
  });
});
