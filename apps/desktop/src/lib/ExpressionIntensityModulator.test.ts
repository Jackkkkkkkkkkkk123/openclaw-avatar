/**
 * ExpressionIntensityModulator 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ExpressionIntensityModulator,
  modulateIntensity,
  getIntensityModulator,
  type IntensityProfile,
  type IntensityContext,
  type ModulationResult
} from './ExpressionIntensityModulator';

describe('ExpressionIntensityModulator', () => {
  let modulator: ExpressionIntensityModulator;

  beforeEach(() => {
    ExpressionIntensityModulator.resetInstance();
    modulator = ExpressionIntensityModulator.getInstance();
  });

  afterEach(() => {
    modulator.destroy();
  });

  describe('基础功能', () => {
    it('应该创建单例实例', () => {
      const instance1 = ExpressionIntensityModulator.getInstance();
      const instance2 = ExpressionIntensityModulator.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('应该使用默认配置', () => {
      const profile = modulator.getProfile();
      expect(profile.baseIntensity).toBe(0.7);
      expect(profile.minIntensity).toBe(0.2);
      expect(profile.maxIntensity).toBe(1.0);
      expect(profile.timeOfDayInfluence).toBe(true);
      expect(profile.personalizedLearning).toBe(true);
    });

    it('应该允许更新配置', () => {
      modulator.updateProfile({ baseIntensity: 0.8 });
      const profile = modulator.getProfile();
      expect(profile.baseIntensity).toBe(0.8);
    });

    it('resetInstance 应该清除单例', () => {
      const instance1 = ExpressionIntensityModulator.getInstance();
      ExpressionIntensityModulator.resetInstance();
      const instance2 = ExpressionIntensityModulator.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('强度调节', () => {
    it('应该返回调节结果', () => {
      const result = modulator.modulate(0.8);
      
      expect(result).toHaveProperty('originalIntensity');
      expect(result).toHaveProperty('modulatedIntensity');
      expect(result).toHaveProperty('factors');
      expect(result).toHaveProperty('recommendation');
      expect(result.originalIntensity).toBe(0.8);
    });

    it('应该在边界范围内调节', () => {
      const result = modulator.modulate(1.5);
      expect(result.modulatedIntensity).toBeLessThanOrEqual(1.0);
      
      const result2 = modulator.modulate(0.05);
      expect(result2.modulatedIntensity).toBeGreaterThanOrEqual(0.2);
    });

    it('应该根据情绪类型调节', () => {
      const excitedResult = modulator.modulate(0.8, 'excited');
      const neutralResult = modulator.modulate(0.8, 'neutral');
      
      // excited 应该有更高的强度
      expect(excitedResult.factors.emotional).toBeGreaterThan(neutralResult.factors.emotional);
    });

    it('应该处理未知情绪类型', () => {
      const result = modulator.modulate(0.8, 'unknown_emotion');
      expect(result.modulatedIntensity).toBeGreaterThan(0);
      expect(result.factors.emotional).toBe(1.0);
    });
  });

  describe('批量调节', () => {
    it('应该批量调节多个强度值', () => {
      const intensities = new Map<string, number>([
        ['happy', 0.8],
        ['sad', 0.6],
        ['neutral', 0.5]
      ]);
      
      const result = modulator.modulateBatch(intensities);
      
      expect(result.size).toBe(3);
      expect(result.has('happy')).toBe(true);
      expect(result.has('sad')).toBe(true);
      expect(result.has('neutral')).toBe(true);
    });

    it('应该对空 Map 返回空 Map', () => {
      const result = modulator.modulateBatch(new Map());
      expect(result.size).toBe(0);
    });
  });

  describe('疲劳系统', () => {
    it('初始疲劳应该为 0', () => {
      expect(modulator.getFatigueLevel()).toBe(0);
    });

    it('多次调节后疲劳应该增加', () => {
      // 模拟多轮对话
      for (let i = 0; i < 20; i++) {
        modulator.modulate(0.8);
      }
      
      expect(modulator.getFatigueLevel()).toBeGreaterThan(0);
    });

    it('疲劳应该影响输出强度', () => {
      const fresh = modulator.modulate(0.8);
      
      // 模拟很多轮对话产生疲劳
      for (let i = 0; i < 30; i++) {
        modulator.modulate(0.8);
      }
      
      const fatigued = modulator.modulate(0.8);
      
      // 疲劳后强度应该降低
      expect(fatigued.modulatedIntensity).toBeLessThan(fresh.modulatedIntensity);
    });

    it('重置会话应该清除疲劳', () => {
      for (let i = 0; i < 10; i++) {
        modulator.modulate(0.8);
      }
      
      expect(modulator.getFatigueLevel()).toBeGreaterThan(0);
      
      modulator.resetSession();
      
      expect(modulator.getFatigueLevel()).toBe(0);
    });
  });

  describe('上下文更新', () => {
    it('应该更新对话上下文', () => {
      modulator.updateContext({
        conversationLength: 5,
        emotionalWeight: 0.8,
        urgency: 0.9
      });
      
      // 高紧急程度应该增加强度
      const result = modulator.modulate(0.7);
      expect(result.factors.conversational).toBeGreaterThan(0.7);
    });

    it('应该更新亲密度', () => {
      modulator.updateContext({ intimacyLevel: 0.9 });
      const result = modulator.modulate(0.7);
      expect(result).toBeDefined();
    });

    it('应该更新最后交互时间', () => {
      const before = Date.now();
      modulator.updateContext({ conversationLength: 1 });
      // 上下文更新应该更新最后交互时间
      // 这会影响恢复计算
    });
  });

  describe('时间感知', () => {
    it('应该返回当前时间段', () => {
      const zone = modulator.getCurrentTimeZone();
      expect(['high', 'low', 'normal']).toContain(zone);
    });

    it('应该允许更新时间配置', () => {
      modulator.updateTimeConfig({
        highEnergyStart: 10,
        highEnergyEnd: 20
      });
      
      const config = modulator.getTimeConfig();
      expect(config.highEnergyStart).toBe(10);
      expect(config.highEnergyEnd).toBe(20);
    });

    it('禁用时间影响后因子应该为 1', () => {
      modulator.updateProfile({ timeOfDayInfluence: false });
      
      const result = modulator.modulate(0.8);
      expect(result.factors.timeOfDay).toBe(1.0);
    });
  });

  describe('用户反馈学习', () => {
    it('应该记录用户正面反馈', () => {
      modulator.modulate(0.8);
      modulator.recordUserResponse('positive');
      
      const preferred = modulator.getPreferredIntensity();
      expect(preferred).not.toBeNull();
    });

    it('应该记录用户负面反馈', () => {
      modulator.modulate(0.9);
      modulator.recordUserResponse('negative');
      
      const preferred = modulator.getPreferredIntensity();
      expect(preferred).not.toBeNull();
      expect(preferred).toBeLessThan(0.9);
    });

    it('中性反馈不应该更新偏好', () => {
      modulator.modulate(0.8);
      modulator.recordUserResponse('neutral');
      
      // 中性反馈不更新偏好
      // 但历史记录会保存
    });

    it('禁用学习后不应该记录反馈', () => {
      modulator.updateProfile({ personalizedLearning: false });
      
      modulator.modulate(0.8);
      modulator.recordUserResponse('positive');
      
      const preferred = modulator.getPreferredIntensity();
      expect(preferred).toBeNull();
    });

    it('应该获取情绪学习数据', () => {
      // 初始应该为空
      const learning = modulator.getEmotionLearning('happy');
      expect(learning).toBeNull();
    });
  });

  describe('会话统计', () => {
    it('应该返回会话统计', () => {
      modulator.modulate(0.8);
      modulator.modulate(0.7);
      
      const stats = modulator.getSessionStats();
      
      expect(stats).toHaveProperty('duration');
      expect(stats).toHaveProperty('turns');
      expect(stats).toHaveProperty('averageIntensity');
      expect(stats).toHaveProperty('fatigueLevel');
      expect(stats.turns).toBe(2);
    });

    it('重置会话后统计应该清零', () => {
      modulator.modulate(0.8);
      modulator.modulate(0.7);
      modulator.resetSession();
      
      const stats = modulator.getSessionStats();
      expect(stats.turns).toBe(0);
      expect(stats.fatigueLevel).toBe(0);
    });
  });

  describe('回调订阅', () => {
    it('应该在调节时触发回调', () => {
      const callback = vi.fn();
      modulator.onModulation(callback);
      
      modulator.modulate(0.8);
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        originalIntensity: 0.8
      }));
    });

    it('应该支持多个回调', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      modulator.onModulation(callback1);
      modulator.onModulation(callback2);
      
      modulator.modulate(0.8);
      
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('应该支持取消订阅', () => {
      const callback = vi.fn();
      const unsubscribe = modulator.onModulation(callback);
      
      modulator.modulate(0.8);
      expect(callback).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      modulator.modulate(0.8);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('回调错误不应该影响其他回调', () => {
      const errorCallback = vi.fn(() => { throw new Error('Test error'); });
      const normalCallback = vi.fn();
      
      modulator.onModulation(errorCallback);
      modulator.onModulation(normalCallback);
      
      modulator.modulate(0.8);
      
      expect(normalCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('数据导入导出', () => {
    it('应该导出学习数据', () => {
      modulator.modulate(0.8);
      modulator.recordUserResponse('positive');
      
      const exported = modulator.exportLearningData();
      
      expect(exported).toHaveProperty('history');
      expect(exported).toHaveProperty('preferences');
      expect(exported).toHaveProperty('preferredIntensity');
      expect(exported.history.length).toBeGreaterThan(0);
    });

    it('应该导入学习数据', () => {
      const data = {
        history: [
          { timestamp: Date.now(), inputIntensity: 0.8, outputIntensity: 0.7, userResponse: 'positive' as const }
        ],
        preferredIntensity: 0.75
      };
      
      modulator.importLearningData(data);
      
      const preferred = modulator.getPreferredIntensity();
      expect(preferred).toBe(0.75);
    });

    it('应该清除学习数据', () => {
      modulator.modulate(0.8);
      modulator.recordUserResponse('positive');
      
      modulator.clearLearningData();
      
      const preferred = modulator.getPreferredIntensity();
      expect(preferred).toBeNull();
      
      const exported = modulator.exportLearningData();
      expect(exported.history.length).toBe(0);
    });
  });

  describe('建议生成', () => {
    it('应该生成适当的建议', () => {
      const result = modulator.modulate(0.8);
      expect(typeof result.recommendation).toBe('string');
      expect(result.recommendation.length).toBeGreaterThan(0);
    });

    it('低强度时应该建议休息', () => {
      modulator.updateProfile({ maxIntensity: 0.35 });
      const result = modulator.modulate(0.3);
      expect(result.recommendation).toContain('休息');
    });
  });

  describe('情绪特定因子', () => {
    it('excited 应该有高情绪因子', () => {
      const result = modulator.modulate(0.8, 'excited');
      expect(result.factors.emotional).toBe(1.2);
    });

    it('neutral 应该有低情绪因子', () => {
      const result = modulator.modulate(0.8, 'neutral');
      expect(result.factors.emotional).toBe(0.8);
    });

    it('surprised 应该有较高情绪因子', () => {
      const result = modulator.modulate(0.8, 'surprised');
      expect(result.factors.emotional).toBe(1.15);
    });

    it('thinking 应该有较低情绪因子', () => {
      const result = modulator.modulate(0.8, 'thinking');
      expect(result.factors.emotional).toBe(0.85);
    });

    it('bored 应该有很低情绪因子', () => {
      const result = modulator.modulate(0.8, 'bored');
      expect(result.factors.emotional).toBe(0.7);
    });

    it('tired 应该有最低情绪因子', () => {
      const result = modulator.modulate(0.8, 'tired');
      expect(result.factors.emotional).toBe(0.6);
    });
  });

  describe('边界情况', () => {
    it('应该处理 0 强度输入', () => {
      const result = modulator.modulate(0);
      expect(result.modulatedIntensity).toBeGreaterThanOrEqual(0);
    });

    it('应该处理负数强度输入', () => {
      const result = modulator.modulate(-0.5);
      expect(result.modulatedIntensity).toBeGreaterThanOrEqual(0);
    });

    it('应该处理超大强度输入', () => {
      const result = modulator.modulate(10);
      expect(result.modulatedIntensity).toBeLessThanOrEqual(1.0);
    });

    it('destroy 后应该清除状态', () => {
      modulator.modulate(0.8);
      modulator.recordUserResponse('positive');
      
      modulator.destroy();
      
      // 获取新实例
      const newModulator = ExpressionIntensityModulator.getInstance();
      expect(newModulator.getPreferredIntensity()).toBeNull();
    });
  });

  describe('便捷函数', () => {
    it('modulateIntensity 应该工作', () => {
      const result = modulateIntensity(0.8, 'happy');
      expect(result).toHaveProperty('modulatedIntensity');
      expect(result.originalIntensity).toBe(0.8);
    });

    it('getIntensityModulator 应该返回实例', () => {
      const instance = getIntensityModulator();
      expect(instance).toBe(ExpressionIntensityModulator.getInstance());
    });
  });

  describe('综合因子计算', () => {
    it('综合因子应该在合理范围内', () => {
      const result = modulator.modulate(0.8);
      expect(result.factors.combined).toBeGreaterThanOrEqual(0.3);
      expect(result.factors.combined).toBeLessThanOrEqual(1.5);
    });

    it('所有因子应该存在', () => {
      const result = modulator.modulate(0.8);
      expect(result.factors).toHaveProperty('fatigue');
      expect(result.factors).toHaveProperty('timeOfDay');
      expect(result.factors).toHaveProperty('conversational');
      expect(result.factors).toHaveProperty('emotional');
      expect(result.factors).toHaveProperty('personalized');
      expect(result.factors).toHaveProperty('combined');
    });
  });

  describe('历史记录管理', () => {
    it('应该限制历史记录数量', () => {
      // 添加超过 100 条记录
      for (let i = 0; i < 120; i++) {
        modulator.modulate(0.8);
      }
      
      const exported = modulator.exportLearningData();
      expect(exported.history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('个性化因子', () => {
    it('无偏好时个性化因子应该为 1', () => {
      const result = modulator.modulate(0.8);
      expect(result.factors.personalized).toBe(1.0);
    });

    it('有偏好时个性化因子应该变化', () => {
      // 记录偏好
      modulator.modulate(0.8);
      modulator.recordUserResponse('positive');
      modulator.modulate(0.8);
      modulator.recordUserResponse('positive');
      
      const result = modulator.modulate(0.8);
      // 应该不再是 1.0
      expect(result.factors.personalized).not.toBe(1.0);
    });
  });
});
