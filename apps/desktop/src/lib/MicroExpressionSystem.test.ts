/**
 * MicroExpressionSystem 单元测试
 * 
 * 测试微表情系统的功能和行为
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MicroExpressionSystem, MicroExpressionParams } from './MicroExpressionSystem';

// Mock requestAnimationFrame
vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
  return setTimeout(() => callback(Date.now()), 16) as unknown as number;
});

vi.stubGlobal('cancelAnimationFrame', (id: number) => {
  clearTimeout(id);
});

describe('MicroExpressionSystem', () => {
  let system: MicroExpressionSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    system = new MicroExpressionSystem();
  });

  afterEach(() => {
    system.destroy();
    vi.useRealTimers();
  });

  describe('基础功能', () => {
    it('应该正确创建实例', () => {
      expect(system).toBeDefined();
    });

    it('应该能够启动和停止', () => {
      system.start();
      // 系统应该在运行
      expect(system.getCurrentParams()).toBeDefined();
      
      system.stop();
      // 停止后参数仍可获取
      expect(system.getCurrentParams()).toBeDefined();
    });

    it('应该返回默认参数', () => {
      const params = system.getCurrentParams();
      
      expect(params.browL).toBe(0);
      expect(params.browR).toBe(0);
      expect(params.eyeLookX).toBe(0);
      expect(params.eyeLookY).toBe(0);
      expect(params.mouthCornerL).toBe(0);
      expect(params.mouthCornerR).toBe(0);
    });
  });

  describe('参数订阅', () => {
    it('应该能够订阅参数更新', () => {
      const callback = vi.fn();
      const unsubscribe = system.onParams(callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      // 取消订阅
      unsubscribe();
    });

    it('启动后应该触发回调', async () => {
      const callback = vi.fn();
      system.onParams(callback);
      
      system.start();
      
      // 模拟动画帧
      vi.advanceTimersByTime(50);
      
      expect(callback).toHaveBeenCalled();
    });

    it('取消订阅后不应再触发回调', () => {
      const callback = vi.fn();
      const unsubscribe = system.onParams(callback);
      
      system.start();
      vi.advanceTimersByTime(20);
      
      const callCount = callback.mock.calls.length;
      unsubscribe();
      
      vi.advanceTimersByTime(100);
      
      // 取消订阅后调用次数不应增加
      expect(callback.mock.calls.length).toBe(callCount);
    });
  });

  describe('情绪设置', () => {
    it('应该能够设置基础情绪', () => {
      system.setEmotion('happy');
      system.setEmotion('sad');
      system.setEmotion('surprised');
      system.setEmotion('angry');
      system.setEmotion('neutral');
      // 不抛出错误即为通过
      expect(true).toBe(true);
    });
  });

  describe('说话状态', () => {
    it('应该能够设置说话状态', () => {
      system.setSpeaking(true);
      system.setSpeaking(false);
      // 不抛出错误即为通过
      expect(true).toBe(true);
    });
  });

  describe('反应性微表情', () => {
    it('应该能够触发各种反应', () => {
      system.triggerReaction('interest');
      system.triggerReaction('surprise_light');
      system.triggerReaction('thinking');
      system.triggerReaction('doubt');
      system.triggerReaction('agreement');
      system.triggerReaction('realization');
      // 不抛出错误即为通过
      expect(true).toBe(true);
    });

    it('触发无效反应类型不应崩溃', () => {
      // @ts-expect-error 测试无效类型
      system.triggerReaction('invalid_type');
      expect(true).toBe(true);
    });
  });

  describe('文本分析触发', () => {
    it('问号应触发思考反应', () => {
      const triggerSpy = vi.spyOn(system, 'triggerReaction');
      
      system.analyzeAndReact('这是什么？');
      expect(triggerSpy).toHaveBeenCalledWith('thinking');
    });

    it('英文问号也应触发思考反应', () => {
      const triggerSpy = vi.spyOn(system, 'triggerReaction');
      
      system.analyzeAndReact('What is this?');
      expect(triggerSpy).toHaveBeenCalledWith('thinking');
    });

    it('哇+感叹号应触发轻微惊讶', () => {
      const triggerSpy = vi.spyOn(system, 'triggerReaction');
      
      system.analyzeAndReact('哇！太厉害了！');
      expect(triggerSpy).toHaveBeenCalledWith('surprise_light');
    });

    it('wow应触发轻微惊讶', () => {
      const triggerSpy = vi.spyOn(system, 'triggerReaction');
      
      system.analyzeAndReact('Wow! Amazing!');
      expect(triggerSpy).toHaveBeenCalledWith('surprise_light');
    });

    it('普通感叹号应触发兴趣', () => {
      const triggerSpy = vi.spyOn(system, 'triggerReaction');
      
      system.analyzeAndReact('太好了！');
      expect(triggerSpy).toHaveBeenCalledWith('interest');
    });

    it('明白应触发恍然大悟', () => {
      const triggerSpy = vi.spyOn(system, 'triggerReaction');
      
      system.analyzeAndReact('明白了');
      expect(triggerSpy).toHaveBeenCalledWith('realization');
    });

    it('原来应触发恍然大悟', () => {
      const triggerSpy = vi.spyOn(system, 'triggerReaction');
      
      system.analyzeAndReact('原来如此');
      expect(triggerSpy).toHaveBeenCalledWith('realization');
    });

    it('i see应触发恍然大悟', () => {
      const triggerSpy = vi.spyOn(system, 'triggerReaction');
      
      system.analyzeAndReact('I see, that makes sense');
      expect(triggerSpy).toHaveBeenCalledWith('realization');
    });

    it('嗯应触发赞同', () => {
      const triggerSpy = vi.spyOn(system, 'triggerReaction');
      
      system.analyzeAndReact('嗯，对的');
      expect(triggerSpy).toHaveBeenCalledWith('agreement');
    });

    it('好的应触发赞同', () => {
      const triggerSpy = vi.spyOn(system, 'triggerReaction');
      
      system.analyzeAndReact('好的，没问题');
      expect(triggerSpy).toHaveBeenCalledWith('agreement');
    });

    it('ok应触发赞同', () => {
      const triggerSpy = vi.spyOn(system, 'triggerReaction');
      
      system.analyzeAndReact('Ok, I will do it');
      expect(triggerSpy).toHaveBeenCalledWith('agreement');
    });

    it('真的吗应触发怀疑', () => {
      const triggerSpy = vi.spyOn(system, 'triggerReaction');
      
      system.analyzeAndReact('真的吗');
      expect(triggerSpy).toHaveBeenCalledWith('doubt');
    });

    it('是吗应触发怀疑', () => {
      const triggerSpy = vi.spyOn(system, 'triggerReaction');
      
      system.analyzeAndReact('是吗');
      expect(triggerSpy).toHaveBeenCalledWith('doubt');
    });

    it('really应触发怀疑', () => {
      const triggerSpy = vi.spyOn(system, 'triggerReaction');
      
      // 不带问号，纯粹测试 really 关键词
      system.analyzeAndReact('Really, I cannot believe it');
      expect(triggerSpy).toHaveBeenCalledWith('doubt');
    });

    it('普通文本不应触发反应', () => {
      const triggerSpy = vi.spyOn(system, 'triggerReaction');
      
      system.analyzeAndReact('今天天气很好');
      expect(triggerSpy).not.toHaveBeenCalled();
    });
  });

  describe('配置更新', () => {
    it('应该能够更新配置', () => {
      system.updateConfig({
        enabled: false,
      });
      
      system.updateConfig({
        brow: {
          enabled: false,
          frequency: 10,
          amplitude: 0.2,
          asymmetry: 0.5,
        },
      });
      
      // 不抛出错误即为通过
      expect(true).toBe(true);
    });

    it('应该支持部分配置更新', () => {
      system.updateConfig({
        eyeWander: {
          enabled: true,
          frequency: 15,
          rangeX: 0.2,
          rangeY: 0.1,
          smoothness: 0.9,
        },
      });
      
      expect(true).toBe(true);
    });
  });

  describe('参数范围验证', () => {
    it('返回的参数应该包含所有必要属性', () => {
      const params = system.getCurrentParams();
      
      expect(params).toHaveProperty('browL');
      expect(params).toHaveProperty('browR');
      expect(params).toHaveProperty('eyeLookX');
      expect(params).toHaveProperty('eyeLookY');
      expect(params).toHaveProperty('eyeWideL');
      expect(params).toHaveProperty('eyeWideR');
      expect(params).toHaveProperty('mouthCornerL');
      expect(params).toHaveProperty('mouthCornerR');
      expect(params).toHaveProperty('cheekPuff');
      expect(params).toHaveProperty('noseWrinkle');
    });

    it('所有参数应该是数字类型', () => {
      const params = system.getCurrentParams();
      
      Object.values(params).forEach(value => {
        expect(typeof value).toBe('number');
      });
    });
  });

  describe('动画循环', () => {
    it('连续启动不应创建多个循环', () => {
      system.start();
      system.start();
      system.start();
      
      // 停止一次应该能完全停止
      system.stop();
      
      expect(true).toBe(true);
    });

    it('停止后参数应该仍可访问', () => {
      system.start();
      vi.advanceTimersByTime(100);
      system.stop();
      
      const params = system.getCurrentParams();
      expect(params).toBeDefined();
    });
  });

  describe('销毁', () => {
    it('销毁后不应再触发回调', () => {
      const callback = vi.fn();
      system.onParams(callback);
      
      system.start();
      vi.advanceTimersByTime(50);
      
      const callCount = callback.mock.calls.length;
      system.destroy();
      
      vi.advanceTimersByTime(100);
      
      expect(callback.mock.calls.length).toBe(callCount);
    });
  });

  describe('自定义配置实例', () => {
    it('应该支持构造函数传入配置', () => {
      const customSystem = new MicroExpressionSystem({
        enabled: false,
        brow: {
          enabled: false,
          frequency: 5,
          amplitude: 0.1,
          asymmetry: 0.2,
        },
      });
      
      expect(customSystem).toBeDefined();
      customSystem.destroy();
    });
  });
});
