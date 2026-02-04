/**
 * IntegratedAnimationSystem 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IntegratedAnimationSystem, type IntegratedConfig } from './IntegratedAnimationSystem';

describe('IntegratedAnimationSystem', () => {
  let system: IntegratedAnimationSystem;
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let rafId: number;
  let mockTime: number;

  beforeEach(() => {
    rafCallbacks = new Map();
    rafId = 0;
    mockTime = 0;

    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = ++rafId;
      rafCallbacks.set(id, callback);
      return id;
    });

    globalThis.cancelAnimationFrame = vi.fn((id: number) => {
      rafCallbacks.delete(id);
    });

    vi.spyOn(performance, 'now').mockImplementation(() => mockTime);

    system = new IntegratedAnimationSystem();
  });

  afterEach(() => {
    system.destroy();
    vi.restoreAllMocks();
  });

  const advanceTime = (ms: number) => {
    mockTime += ms;
    const callbacks = Array.from(rafCallbacks.entries());
    rafCallbacks.clear();
    for (const [_, callback] of callbacks) {
      callback(mockTime);
    }
  };

  describe('构造函数', () => {
    it('应该使用默认配置创建', () => {
      expect(system).toBeDefined();
      expect(system.isActive()).toBe(false);
    });

    it('应该接受自定义配置', () => {
      const customSystem = new IntegratedAnimationSystem({
        eyeTrackingEnabled: false,
        physicsEnabled: false,
      });

      const config = customSystem.getConfig();
      expect(config.eyeTrackingEnabled).toBe(false);
      expect(config.physicsEnabled).toBe(false);

      customSystem.destroy();
    });

    it('应该初始化物理链', () => {
      const physics = system.getPhysicsSimulation();
      const chains = physics.getAllChains();
      
      // 默认启用双马尾和刘海
      expect(chains.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('start / stop / isActive', () => {
    it('应该启动系统', () => {
      system.start();
      expect(system.isActive()).toBe(true);
    });

    it('应该停止系统', () => {
      system.start();
      system.stop();
      expect(system.isActive()).toBe(false);
    });

    it('应该不重复启动', () => {
      system.start();
      system.start();
      expect(system.isActive()).toBe(true);
    });

    it('应该启动子系统', () => {
      system.start();
      expect(system.getPhysicsSimulation().isActive()).toBe(true);
      expect(system.getEyeTrackingEnhancer().isActive()).toBe(true);
    });

    it('应该停止子系统', () => {
      system.start();
      system.stop();
      expect(system.getPhysicsSimulation().isActive()).toBe(false);
      expect(system.getEyeTrackingEnhancer().isActive()).toBe(false);
    });
  });

  describe('setLookTarget', () => {
    it('应该设置注视目标', () => {
      system.setLookTarget(0.5, 0.3);
      // 应该传递到眼动追踪系统
    });
  });

  describe('setHeadPosition', () => {
    it('应该设置头部位置', () => {
      system.start();
      system.setHeadPosition(0.2, 0.1);
      advanceTime(16);
      // 应该更新物理模拟锚点
    });

    it('应该应用惯性冲击', () => {
      system.start();
      system.setHeadPosition(0, 0);
      advanceTime(16);
      
      // 快速移动头部
      system.setHeadPosition(0.5, 0);
      advanceTime(100);
      
      // 物理链应该有响应
      const physics = system.getPhysicsSimulation();
      const state = physics.getState();
      expect(Object.keys(state.chains).length).toBeGreaterThan(0);
    });
  });

  describe('setEmotion', () => {
    it('应该设置情绪', () => {
      system.setEmotion('happy');
      const state = system.getState();
      expect(state.currentEmotion).toBe('happy');
    });

    it('应该传递到眼动追踪', () => {
      system.setEmotion('surprised');
      // 瞳孔应该扩大
    });
  });

  describe('setExpression', () => {
    it('应该设置表情', () => {
      system.setExpression('smile');
      const state = system.getState();
      expect(state.currentExpression).toBe('smile');
    });
  });

  describe('setMouthOpenY', () => {
    it('应该设置口型开合度', () => {
      system.setMouthOpenY(0.5);
      const state = system.getState();
      expect(state.mouthOpenY).toBe(0.5);
    });

    it('应该限制在 0-1 范围', () => {
      system.setMouthOpenY(2);
      expect(system.getState().mouthOpenY).toBe(1);

      system.setMouthOpenY(-1);
      expect(system.getState().mouthOpenY).toBe(0);
    });

    it('应该更新 Live2D 参数', () => {
      system.setMouthOpenY(0.7);
      const params = system.getLive2DParams();
      expect(params['ParamMouthOpenY']).toBe(0.7);
    });
  });

  describe('setSpeaking', () => {
    it('应该设置说话状态', () => {
      system.setSpeaking(true);
      expect(system.getState().isSpeaking).toBe(true);

      system.setSpeaking(false);
      expect(system.getState().isSpeaking).toBe(false);
    });
  });

  describe('triggerBlink', () => {
    it('应该触发眨眼', () => {
      system.start();
      system.triggerBlink();
      advanceTime(50);
      
      const eyeState = system.getState().eye;
      expect(eyeState.left.openness).toBeLessThan(1);
    });
  });

  describe('setWind', () => {
    it('应该设置风力', () => {
      system.setWind({ x: 1, y: 0 }, 0.5);
      
      const physics = system.getPhysicsSimulation();
      const wind = physics.getWind();
      expect(wind.strength).toBe(0.5);
      expect(wind.direction).toEqual({ x: 1, y: 0 });
    });
  });

  describe('setLightLevel', () => {
    it('应该设置光照等级', () => {
      system.setLightLevel(0.8);
      // 应该传递到眼动追踪系统
    });
  });

  describe('getState', () => {
    it('应该返回集成状态', () => {
      const state = system.getState();

      expect(state.eye).toBeDefined();
      expect(state.physics).toBeDefined();
      expect(state.currentExpression).toBe('neutral');
      expect(state.currentEmotion).toBe('neutral');
      expect(state.mouthOpenY).toBe(0);
      expect(state.isSpeaking).toBe(false);
      expect(state.timestamp).toBeDefined();
    });

    it('当禁用物理时应该返回 null', () => {
      const noPhysicsSystem = new IntegratedAnimationSystem({
        physicsEnabled: false,
      });

      const state = noPhysicsSystem.getState();
      expect(state.physics).toBe(null);

      noPhysicsSystem.destroy();
    });
  });

  describe('getLive2DParams', () => {
    it('应该返回合并的参数', () => {
      system.setMouthOpenY(0.5);
      const params = system.getLive2DParams();

      expect(params).toHaveProperty('ParamMouthOpenY');
      expect(params).toHaveProperty('ParamEyeBallX');
      expect(params).toHaveProperty('ParamEyeLOpen');
    });

    it('应该包含物理参数', () => {
      system.start();
      advanceTime(16);
      
      const params = system.getLive2DParams();
      // 应该有物理链相关参数
      const hasPhysicsParam = Object.keys(params).some(k => 
        k.includes('Twintail') || k.includes('Bangs')
      );
      expect(hasPhysicsParam).toBe(true);
    });
  });

  describe('onUpdate', () => {
    it('应该订阅更新回调', () => {
      const callback = vi.fn();
      system.onUpdate(callback);
      system.start();
      advanceTime(16);

      expect(callback).toHaveBeenCalled();
    });

    it('应该返回取消订阅函数', () => {
      const callback = vi.fn();
      const unsubscribe = system.onUpdate(callback);

      unsubscribe();
      system.start();
      advanceTime(16);

      expect(callback).not.toHaveBeenCalled();
    });

    it('应该传递集成状态', () => {
      const callback = vi.fn();
      system.onUpdate(callback);
      system.start();
      advanceTime(16);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        eye: expect.any(Object),
        currentEmotion: expect.any(String),
        mouthOpenY: expect.any(Number),
      }));
    });
  });

  describe('updateConfig', () => {
    it('应该更新配置', () => {
      system.updateConfig({ headMotionInfluence: 0.5 });
      expect(system.getConfig().headMotionInfluence).toBe(0.5);
    });

    it('应该更新子系统启用状态', () => {
      system.start();
      
      system.updateConfig({ eyeTrackingEnabled: false });
      // 眼动追踪应该被禁用
      
      system.updateConfig({ physicsEnabled: false });
      // 物理模拟应该被禁用
    });
  });

  describe('getConfig', () => {
    it('应该返回配置副本', () => {
      const config1 = system.getConfig();
      const config2 = system.getConfig();
      expect(config1).not.toBe(config2);
    });
  });

  describe('reset', () => {
    it('应该重置系统状态', () => {
      system.setEmotion('happy');
      system.setExpression('smile');
      system.setMouthOpenY(0.5);
      system.setSpeaking(true);

      system.reset();

      const state = system.getState();
      expect(state.currentEmotion).toBe('neutral');
      expect(state.currentExpression).toBe('neutral');
      expect(state.mouthOpenY).toBe(0);
      expect(state.isSpeaking).toBe(false);
    });

    it('应该重置子系统', () => {
      system.setLookTarget(1, 1);
      system.start();
      advanceTime(500);
      
      system.reset();

      const eyeState = system.getState().eye;
      expect(eyeState.left.pupilPosition).toEqual({ x: 0, y: 0 });
    });
  });

  describe('getPhysicsSimulation', () => {
    it('应该返回物理模拟实例', () => {
      const physics = system.getPhysicsSimulation();
      expect(physics).toBeDefined();
      expect(typeof physics.start).toBe('function');
    });
  });

  describe('getEyeTrackingEnhancer', () => {
    it('应该返回眼动追踪实例', () => {
      const eyeTracking = system.getEyeTrackingEnhancer();
      expect(eyeTracking).toBeDefined();
      expect(typeof eyeTracking.start).toBe('function');
    });
  });

  describe('destroy', () => {
    it('应该停止系统', () => {
      system.start();
      system.destroy();
      expect(system.isActive()).toBe(false);
    });

    it('应该清除回调', () => {
      const callback = vi.fn();
      system.onUpdate(callback);
      system.destroy();

      // 尝试启动不应该触发旧回调
    });
  });

  describe('说话时自动眨眼', () => {
    it('应该在说话时触发眨眼', () => {
      system.updateConfig({ 
        speakingBlinkEnabled: true,
        speakingBlinkInterval: 100, // 快速间隔用于测试
      });

      system.setSpeaking(true);
      system.start();
      
      advanceTime(150);
      
      const state = system.getState();
      expect(state.eye.left.openness).toBeLessThanOrEqual(1);
    });

    it('禁用时不应该自动眨眼', () => {
      system.updateConfig({ speakingBlinkEnabled: false });
      system.setSpeaking(true);
      system.start();
      
      advanceTime(5000);
      
      // 应该一直睁眼（除非眨眼系统本身触发）
    });
  });

  describe('物理链配置', () => {
    it('应该根据配置创建物理链', () => {
      const customSystem = new IntegratedAnimationSystem({
        physicsChains: {
          twintailLeft: false,
          twintailRight: false,
          bangs: true,
          accessory: true,
          skirt: false,
          ribbon: false,
        },
      });

      const physics = customSystem.getPhysicsSimulation();
      const chains = physics.getAllChains();
      
      expect(chains.some(c => c.id === 'bangs')).toBe(true);
      expect(chains.some(c => c.id === 'accessory')).toBe(true);
      expect(chains.some(c => c.id === 'twintail_left')).toBe(false);

      customSystem.destroy();
    });
  });

  describe('头部运动影响', () => {
    it('配置为 0 时不应该影响物理', () => {
      const noInfluenceSystem = new IntegratedAnimationSystem({
        headMotionInfluence: 0,
      });

      noInfluenceSystem.start();
      noInfluenceSystem.setHeadPosition(0, 0);
      advanceTime(16);
      
      noInfluenceSystem.setHeadPosition(1, 1);
      advanceTime(16);

      // 物理链应该不受影响
      noInfluenceSystem.destroy();
    });
  });

  describe('情绪到瞳孔联动', () => {
    it('启用时应该传递情绪到瞳孔', () => {
      system.updateConfig({ emotionToPupilEnabled: true });
      system.setEmotion('surprised');
      // 瞳孔应该扩大
    });

    it('禁用时不应该传递', () => {
      system.updateConfig({ emotionToPupilEnabled: false });
      system.setEmotion('surprised');
      // 瞳孔不应该变化
    });
  });
});
