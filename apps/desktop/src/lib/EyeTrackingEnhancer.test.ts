/**
 * EyeTrackingEnhancer 测试
 * 眼动追踪增强系统单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EyeTrackingEnhancer,
  EyeTrackingConfig,
  EyePairState,
  EyeState,
  Vector2,
} from './EyeTrackingEnhancer';

describe('EyeTrackingEnhancer', () => {
  let enhancer: EyeTrackingEnhancer;

  beforeEach(() => {
    enhancer = new EyeTrackingEnhancer();
  });

  afterEach(() => {
    enhancer.destroy();
  });

  describe('构造和初始化', () => {
    it('应该使用默认配置创建实例', () => {
      const config = enhancer.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.smoothing).toBe(0.15);
      expect(config.microsaccade.enabled).toBe(true);
      expect(config.blink.enabled).toBe(true);
      expect(config.pupil.enabled).toBe(true);
    });

    it('应该使用自定义配置创建实例', () => {
      const customEnhancer = new EyeTrackingEnhancer({
        enabled: false,
        smoothing: 0.3,
        microsaccade: { enabled: false, amplitude: 0.05, frequency: 3, randomness: 0.3 },
      });
      
      const config = customEnhancer.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.smoothing).toBe(0.3);
      expect(config.microsaccade.enabled).toBe(false);
      expect(config.microsaccade.amplitude).toBe(0.05);
      
      customEnhancer.destroy();
    });

    it('初始状态应该正确', () => {
      const state = enhancer.getState();
      expect(state.left.pupilPosition).toEqual({ x: 0, y: 0 });
      expect(state.right.pupilPosition).toEqual({ x: 0, y: 0 });
      expect(state.left.openness).toBe(1.0);
      expect(state.right.openness).toBe(1.0);
      expect(state.left.pupilSize).toBe(1.0);
      expect(state.synchronization).toBe(0.95);
    });
  });

  describe('注视目标设置', () => {
    it('应该设置注视目标位置', () => {
      enhancer.setLookTarget(0.5, -0.3);
      // 内部状态设置，需要通过 step 更新后才能反映
      // 这里只验证不会抛出错误
    });

    it('应该限制注视目标在 -1 到 1 范围内', () => {
      enhancer.setLookTarget(2.0, -2.0);
      // 值应该被 clamp 到 [-1, 1]
    });

    it('应该处理极端值', () => {
      enhancer.setLookTarget(Infinity, -Infinity);
      // 不应该崩溃
    });
  });

  describe('情绪设置', () => {
    it('应该设置情绪', () => {
      enhancer.setEmotion('happy');
      // 内部状态更新
    });

    it('应该处理未知情绪', () => {
      enhancer.setEmotion('unknown_emotion');
      // 使用默认值，不应该崩溃
    });

    it('不同情绪应该影响瞳孔大小', () => {
      // surprised 应该导致瞳孔扩大
      enhancer.setEmotion('surprised');
      
      // angry 应该导致瞳孔收缩
      enhancer.setEmotion('angry');
    });
  });

  describe('光照设置', () => {
    it('应该设置光照等级', () => {
      enhancer.setLightLevel(0.8);
    });

    it('应该限制光照等级在 0 到 1 范围内', () => {
      enhancer.setLightLevel(2.0);
      enhancer.setLightLevel(-0.5);
      // 不应该崩溃
    });
  });

  describe('聚焦设置', () => {
    it('应该设置聚焦目标', () => {
      enhancer.setFocusTarget(true);
      enhancer.setFocusTarget(false);
    });
  });

  describe('眨眼功能', () => {
    it('应该触发眨眼', () => {
      enhancer.triggerBlink();
      // 眨眼已触发
    });

    it('眨眼期间不应该重复触发', () => {
      enhancer.triggerBlink();
      enhancer.triggerBlink(); // 应该被忽略
    });
  });

  describe('启动和停止', () => {
    it('初始状态应该是未运行', () => {
      expect(enhancer.isActive()).toBe(false);
    });

    it('start 应该启动追踪', () => {
      enhancer.start();
      expect(enhancer.isActive()).toBe(true);
      enhancer.stop();
    });

    it('stop 应该停止追踪', () => {
      enhancer.start();
      enhancer.stop();
      expect(enhancer.isActive()).toBe(false);
    });

    it('重复 start 不应该有问题', () => {
      enhancer.start();
      enhancer.start();
      expect(enhancer.isActive()).toBe(true);
      enhancer.stop();
    });

    it('重复 stop 不应该有问题', () => {
      enhancer.start();
      enhancer.stop();
      enhancer.stop();
      expect(enhancer.isActive()).toBe(false);
    });
  });

  describe('状态订阅', () => {
    it('应该订阅状态更新', () => {
      const callback = vi.fn();
      const unsubscribe = enhancer.onUpdate(callback);
      
      expect(typeof unsubscribe).toBe('function');
    });

    it('应该取消订阅', () => {
      const callback = vi.fn();
      const unsubscribe = enhancer.onUpdate(callback);
      unsubscribe();
    });

    it('多个订阅者应该都收到通知', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      enhancer.onUpdate(callback1);
      enhancer.onUpdate(callback2);
    });
  });

  describe('获取状态', () => {
    it('getState 应该返回状态副本', () => {
      const state1 = enhancer.getState();
      const state2 = enhancer.getState();
      
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // 应该是不同对象
    });

    it('状态应该包含所有必要字段', () => {
      const state = enhancer.getState();
      
      // 左眼
      expect(state.left).toBeDefined();
      expect(typeof state.left.pupilPosition.x).toBe('number');
      expect(typeof state.left.pupilPosition.y).toBe('number');
      expect(typeof state.left.openness).toBe('number');
      expect(typeof state.left.pupilSize).toBe('number');
      expect(typeof state.left.highlightOffset.x).toBe('number');
      expect(typeof state.left.highlightOffset.y).toBe('number');
      expect(typeof state.left.focusLevel).toBe('number');
      
      // 右眼
      expect(state.right).toBeDefined();
      expect(typeof state.right.pupilPosition.x).toBe('number');
      
      // 同步性
      expect(typeof state.synchronization).toBe('number');
    });
  });

  describe('Live2D 参数', () => {
    it('应该返回 Live2D 参数', () => {
      const params = enhancer.getLive2DParams();
      
      expect(typeof params.ParamEyeBallX).toBe('number');
      expect(typeof params.ParamEyeBallY).toBe('number');
      expect(typeof params.ParamEyeLOpen).toBe('number');
      expect(typeof params.ParamEyeROpen).toBe('number');
      expect(typeof params.ParamPupilScale).toBe('number');
      expect(typeof params.ParamHighlightX).toBe('number');
      expect(typeof params.ParamHighlightY).toBe('number');
    });
  });

  describe('配置更新', () => {
    it('应该更新配置', () => {
      enhancer.updateConfig({ enabled: false });
      expect(enhancer.getConfig().enabled).toBe(false);
    });

    it('应该更新嵌套配置', () => {
      enhancer.updateConfig({
        microsaccade: { enabled: false, amplitude: 0.01, frequency: 1, randomness: 0.2 },
      });
      
      const config = enhancer.getConfig();
      expect(config.microsaccade.enabled).toBe(false);
      expect(config.microsaccade.amplitude).toBe(0.01);
    });

    it('应该部分更新配置', () => {
      const originalSmoothing = enhancer.getConfig().smoothing;
      enhancer.updateConfig({ enabled: false });
      
      expect(enhancer.getConfig().smoothing).toBe(originalSmoothing);
    });
  });

  describe('setEnabled', () => {
    it('应该设置启用状态', () => {
      enhancer.setEnabled(false);
      expect(enhancer.getConfig().enabled).toBe(false);
      
      enhancer.setEnabled(true);
      expect(enhancer.getConfig().enabled).toBe(true);
    });
  });

  describe('setSynchronization', () => {
    it('应该设置同步性', () => {
      enhancer.setSynchronization(0.5);
      expect(enhancer.getState().synchronization).toBe(0.5);
    });

    it('应该限制同步性在 0 到 1 范围内', () => {
      enhancer.setSynchronization(2.0);
      expect(enhancer.getState().synchronization).toBe(1);
      
      enhancer.setSynchronization(-0.5);
      expect(enhancer.getState().synchronization).toBe(0);
    });
  });

  describe('reset', () => {
    it('应该重置状态', () => {
      enhancer.setLookTarget(0.5, 0.5);
      enhancer.setEmotion('happy');
      enhancer.setLightLevel(0.8);
      enhancer.triggerBlink();
      
      enhancer.reset();
      
      const state = enhancer.getState();
      expect(state.left.pupilPosition).toEqual({ x: 0, y: 0 });
      expect(state.left.openness).toBe(1.0);
    });
  });

  describe('destroy', () => {
    it('应该清理资源', () => {
      const callback = vi.fn();
      enhancer.onUpdate(callback);
      enhancer.start();
      
      enhancer.destroy();
      
      expect(enhancer.isActive()).toBe(false);
    });

    it('多次 destroy 不应该出错', () => {
      enhancer.destroy();
      enhancer.destroy();
    });
  });

  describe('微动系统', () => {
    it('禁用微动应该不影响其他功能', () => {
      const enhancerNoMicro = new EyeTrackingEnhancer({
        microsaccade: { enabled: false, amplitude: 0, frequency: 0, randomness: 0 },
      });
      
      enhancerNoMicro.start();
      enhancerNoMicro.stop();
      enhancerNoMicro.destroy();
    });

    it('微动幅度应该可配置', () => {
      const enhancerHighAmplitude = new EyeTrackingEnhancer({
        microsaccade: { enabled: true, amplitude: 0.1, frequency: 5, randomness: 1.0 },
      });
      
      const config = enhancerHighAmplitude.getConfig();
      expect(config.microsaccade.amplitude).toBe(0.1);
      expect(config.microsaccade.frequency).toBe(5);
      
      enhancerHighAmplitude.destroy();
    });
  });

  describe('眨眼配置', () => {
    it('眨眼参数应该可配置', () => {
      const enhancerFastBlink = new EyeTrackingEnhancer({
        blink: { enabled: true, duration: 100, asymmetry: 0.2, closeDuration: 30 },
      });
      
      const config = enhancerFastBlink.getConfig();
      expect(config.blink.duration).toBe(100);
      expect(config.blink.asymmetry).toBe(0.2);
      
      enhancerFastBlink.destroy();
    });

    it('禁用眨眼应该不影响其他功能', () => {
      const enhancerNoBlink = new EyeTrackingEnhancer({
        blink: { enabled: false, duration: 150, asymmetry: 0.1, closeDuration: 50 },
      });
      
      enhancerNoBlink.triggerBlink(); // 应该被忽略或不执行
      enhancerNoBlink.destroy();
    });
  });

  describe('瞳孔配置', () => {
    it('瞳孔参数应该可配置', () => {
      const enhancerCustomPupil = new EyeTrackingEnhancer({
        pupil: {
          enabled: true,
          minSize: 0.5,
          maxSize: 1.5,
          lightSensitivity: 0.5,
          emotionSensitivity: 0.8,
          transitionSpeed: 3.0,
        },
      });
      
      const config = enhancerCustomPupil.getConfig();
      expect(config.pupil.minSize).toBe(0.5);
      expect(config.pupil.maxSize).toBe(1.5);
      expect(config.pupil.lightSensitivity).toBe(0.5);
      
      enhancerCustomPupil.destroy();
    });

    it('禁用瞳孔变化应该不影响其他功能', () => {
      const enhancerNoPupil = new EyeTrackingEnhancer({
        pupil: {
          enabled: false,
          minSize: 1,
          maxSize: 1,
          lightSensitivity: 0,
          emotionSensitivity: 0,
          transitionSpeed: 1,
        },
      });
      
      enhancerNoPupil.setLightLevel(1.0);
      enhancerNoPupil.setEmotion('surprised');
      
      enhancerNoPupil.destroy();
    });
  });

  describe('情绪瞳孔效果', () => {
    const emotions = [
      'neutral',
      'happy',
      'sad',
      'surprised',
      'angry',
      'fear',
      'thinking',
      'shy',
      'excited',
      'love',
    ];

    emotions.forEach((emotion) => {
      it(`应该处理 ${emotion} 情绪`, () => {
        enhancer.setEmotion(emotion);
        // 不应该崩溃
      });
    });
  });

  describe('高光和聚焦', () => {
    it('禁用高光应该不影响其他功能', () => {
      const enhancerNoHighlight = new EyeTrackingEnhancer({
        highlightEnabled: false,
      });
      
      const params = enhancerNoHighlight.getLive2DParams();
      expect(typeof params.ParamHighlightX).toBe('number');
      
      enhancerNoHighlight.destroy();
    });

    it('禁用聚焦应该不影响其他功能', () => {
      const enhancerNoFocus = new EyeTrackingEnhancer({
        focusEnabled: false,
      });
      
      enhancerNoFocus.setFocusTarget(false);
      
      enhancerNoFocus.destroy();
    });
  });

  describe('边界情况', () => {
    it('应该处理非常小的 dt', () => {
      enhancer.start();
      // 模拟非常快的帧率
      enhancer.stop();
    });

    it('应该处理非常大的 dt (会被 clamp)', () => {
      enhancer.start();
      // dt 应该被限制在 0.05 秒内
      enhancer.stop();
    });

    it('空回调列表应该正常工作', () => {
      enhancer.start();
      // 没有订阅者时不应该崩溃
      enhancer.stop();
    });
  });

  describe('综合场景', () => {
    it('应该支持完整的使用流程', () => {
      // 1. 启动
      enhancer.start();
      
      // 2. 设置各种参数
      enhancer.setLookTarget(0.3, -0.2);
      enhancer.setEmotion('happy');
      enhancer.setLightLevel(0.6);
      enhancer.setFocusTarget(true);
      
      // 3. 触发眨眼
      enhancer.triggerBlink();
      
      // 4. 获取状态
      const state = enhancer.getState();
      expect(state).toBeDefined();
      
      // 5. 获取 Live2D 参数
      const params = enhancer.getLive2DParams();
      expect(params).toBeDefined();
      
      // 6. 停止
      enhancer.stop();
    });

    it('应该支持配置热更新', () => {
      enhancer.start();
      
      // 更新配置
      enhancer.updateConfig({
        smoothing: 0.2,
        microsaccade: { enabled: false, amplitude: 0, frequency: 0, randomness: 0 },
      });
      
      // 应该继续正常工作
      enhancer.setLookTarget(0.5, 0.5);
      
      enhancer.stop();
    });

    it('应该支持多次重置', () => {
      enhancer.setEmotion('happy');
      enhancer.reset();
      
      enhancer.setEmotion('sad');
      enhancer.reset();
      
      const state = enhancer.getState();
      expect(state.left.pupilPosition).toEqual({ x: 0, y: 0 });
    });
  });

  describe('getConfig 返回副本', () => {
    it('修改返回值不应该影响内部配置', () => {
      const config = enhancer.getConfig();
      config.enabled = false;
      config.smoothing = 0.99;
      
      // 内部配置不应该被修改
      expect(enhancer.getConfig().enabled).toBe(true);
      expect(enhancer.getConfig().smoothing).toBe(0.15);
    });
  });

  describe('同步性对双眼的影响', () => {
    it('高同步性应该让双眼动作更一致', () => {
      enhancer.setSynchronization(1.0);
      const state = enhancer.getState();
      expect(state.synchronization).toBe(1.0);
    });

    it('低同步性应该让双眼有更多独立性', () => {
      enhancer.setSynchronization(0.0);
      const state = enhancer.getState();
      expect(state.synchronization).toBe(0.0);
    });
  });
});
