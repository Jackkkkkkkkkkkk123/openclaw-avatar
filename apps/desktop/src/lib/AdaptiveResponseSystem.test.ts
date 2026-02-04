import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdaptiveResponseSystem, FeedbackType, AdaptationRule } from './AdaptiveResponseSystem';

describe('AdaptiveResponseSystem', () => {
  let system: AdaptiveResponseSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    system = new AdaptiveResponseSystem({
      learningRate: 1.0  // 使用 1.0 便于测试
    });
  });

  afterEach(() => {
    system.destroy();
    vi.useRealTimers();
  });

  describe('基础功能', () => {
    it('应该能创建实例', () => {
      expect(system).toBeInstanceOf(AdaptiveResponseSystem);
    });

    it('应该有默认配置', () => {
      const profile = system.getProfile();
      expect(profile.expressionIntensity).toBe(0.7);
      expect(profile.animationSpeed).toBe(1.0);
      expect(profile.responseVerbosity).toBe('normal');
    });

    it('应该能更新系统配置', () => {
      system.updateConfig({ learningRate: 0.5 });
      expect(system.getConfig().learningRate).toBe(0.5);
    });
  });

  describe('记录反馈', () => {
    it('应该能记录反馈', () => {
      system.recordFeedback('positive');
      const stats = system.getFeedbackStats();
      expect(stats.get('positive')).toBe(1);
    });

    it('应该能记录带上下文的反馈', () => {
      system.recordFeedback('positive', 'User smiled');
      const stats = system.getFeedbackStats();
      expect(stats.get('positive')).toBe(1);
    });

    it('应该累计同类型反馈', () => {
      system.recordFeedback('positive');
      system.recordFeedback('positive');
      system.recordFeedback('positive');
      
      const stats = system.getFeedbackStats();
      expect(stats.get('positive')).toBe(3);
    });

    it('应该区分不同类型的反馈', () => {
      system.recordFeedback('positive');
      system.recordFeedback('negative');
      system.recordFeedback('engaged');
      
      const stats = system.getFeedbackStats();
      expect(stats.get('positive')).toBe(1);
      expect(stats.get('negative')).toBe(1);
      expect(stats.get('engaged')).toBe(1);
    });

    it('应该清理过期的反馈', () => {
      system.recordFeedback('positive');
      
      // 前进 2 小时
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);
      
      // 再记录一个会触发清理
      system.recordFeedback('neutral');
      
      const stats = system.getFeedbackStats();
      expect(stats.get('positive')).toBeUndefined();
    });
  });

  describe('配置调整', () => {
    it('应该能手动设置配置', () => {
      system.setProfile({ expressionIntensity: 0.9 });
      expect(system.getProfile().expressionIntensity).toBe(0.9);
    });

    it('应该能重置配置', () => {
      system.setProfile({ expressionIntensity: 0.9 });
      system.resetProfile();
      expect(system.getProfile().expressionIntensity).toBe(0.7);
    });

    it('配置值应该被限制在有效范围内', () => {
      system.setProfile({ expressionIntensity: 1.5 });
      expect(system.getProfile().expressionIntensity).toBeLessThanOrEqual(1);
      
      system.setProfile({ expressionIntensity: -0.5 });
      expect(system.getProfile().expressionIntensity).toBeGreaterThanOrEqual(0);
    });

    it('动画速度应该被限制在 0.5-2.0', () => {
      system.setProfile({ animationSpeed: 3.0 });
      expect(system.getProfile().animationSpeed).toBeLessThanOrEqual(2.0);
      
      system.setProfile({ animationSpeed: 0.1 });
      expect(system.getProfile().animationSpeed).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('自适应规则', () => {
    it('正面反馈应该增加表情强度', () => {
      const initialIntensity = system.getProfile().expressionIntensity;
      
      // 触发正面规则需要 3 次
      for (let i = 0; i < 3; i++) {
        system.recordFeedback('positive');
      }
      
      expect(system.getProfile().expressionIntensity).toBeGreaterThan(initialIntensity);
    });

    it('负面反馈应该减少幽默程度', () => {
      const initialHumor = system.getProfile().humorLevel;
      
      // 触发负面规则需要 2 次
      for (let i = 0; i < 2; i++) {
        system.recordFeedback('negative');
      }
      
      expect(system.getProfile().humorLevel).toBeLessThan(initialHumor);
    });

    it('困惑反馈应该降低动画速度', () => {
      const initialSpeed = system.getProfile().animationSpeed;
      
      for (let i = 0; i < 2; i++) {
        system.recordFeedback('confused');
      }
      
      expect(system.getProfile().animationSpeed).toBeLessThan(initialSpeed);
    });

    it('不耐烦反馈应该加快速度', () => {
      const initialSpeed = system.getProfile().animationSpeed;
      
      for (let i = 0; i < 2; i++) {
        system.recordFeedback('impatient');
      }
      
      expect(system.getProfile().animationSpeed).toBeGreaterThan(initialSpeed);
    });

    it('参与度高应该增加主动性', () => {
      const initialProactivity = system.getProfile().proactivityLevel;
      
      for (let i = 0; i < 5; i++) {
        system.recordFeedback('engaged');
      }
      
      expect(system.getProfile().proactivityLevel).toBeGreaterThan(initialProactivity);
    });

    it('规则应该在时间窗口内生效', () => {
      system.recordFeedback('positive');
      
      // 前进 6 分钟（超过 5 分钟窗口）
      vi.advanceTimersByTime(6 * 60 * 1000);
      
      // 再记录 2 次（总共 3 次才触发，但第一次已过期）
      system.recordFeedback('positive');
      system.recordFeedback('positive');
      
      // 应该没有触发规则
      const profile = system.getProfile();
      expect(profile.expressionIntensity).toBe(0.7);
    });
  });

  describe('自定义规则', () => {
    it('应该能添加自定义规则', () => {
      const customRule: AdaptationRule = {
        trigger: ['positive', 'engaged'],
        minOccurrences: 1,
        timeWindowMs: 60000,
        adjustments: { humorLevel: 0.2 }
      };
      
      system.addRule(customRule);
      expect(system.getRules().length).toBeGreaterThan(6);  // 6 个默认规则
    });

    it('自定义规则应该生效', () => {
      const initialHumor = system.getProfile().humorLevel;
      
      system.addRule({
        trigger: ['neutral'],
        minOccurrences: 1,
        timeWindowMs: 60000,
        adjustments: { humorLevel: 0.2 }
      });
      
      system.recordFeedback('neutral');
      
      expect(system.getProfile().humorLevel).toBeGreaterThan(initialHumor);
    });

    it('应该能移除规则', () => {
      const initialCount = system.getRules().length;
      system.removeRule(0);
      expect(system.getRules().length).toBe(initialCount - 1);
    });

    it('移除无效索引应该返回 false', () => {
      expect(system.removeRule(-1)).toBe(false);
      expect(system.removeRule(100)).toBe(false);
    });
  });

  describe('用户情绪倾向', () => {
    it('正面反馈多时应该返回 positive', () => {
      for (let i = 0; i < 5; i++) {
        system.recordFeedback('positive');
      }
      system.recordFeedback('negative');
      
      expect(system.getUserSentiment()).toBe('positive');
    });

    it('负面反馈多时应该返回 negative', () => {
      for (let i = 0; i < 5; i++) {
        system.recordFeedback('negative');
      }
      system.recordFeedback('positive');
      
      expect(system.getUserSentiment()).toBe('negative');
    });

    it('平衡时应该返回 neutral', () => {
      system.recordFeedback('positive');
      system.recordFeedback('negative');
      
      expect(system.getUserSentiment()).toBe('neutral');
    });

    it('engaged 应该计入正面', () => {
      for (let i = 0; i < 3; i++) {
        system.recordFeedback('engaged');
      }
      
      expect(system.getUserSentiment()).toBe('positive');
    });

    it('impatient 应该计入负面', () => {
      for (let i = 0; i < 3; i++) {
        system.recordFeedback('impatient');
      }
      
      expect(system.getUserSentiment()).toBe('negative');
    });
  });

  describe('时间衰减', () => {
    it('应该让配置逐渐回归默认值', () => {
      system.setProfile({ expressionIntensity: 1.0 });
      
      system.applyDecay();
      
      const profile = system.getProfile();
      expect(profile.expressionIntensity).toBeLessThan(1.0);
      expect(profile.expressionIntensity).toBeGreaterThan(0.7);
    });

    it('多次衰减应该接近默认值', () => {
      // 使用更高的衰减率便于测试
      system.updateConfig({ decayRate: 0.1 });
      system.setProfile({ expressionIntensity: 1.0 });
      
      for (let i = 0; i < 50; i++) {
        system.applyDecay();
      }
      
      expect(system.getProfile().expressionIntensity).toBeCloseTo(0.7, 0);
    });
  });

  describe('订阅机制', () => {
    it('应该能订阅配置变化', () => {
      const callback = vi.fn();
      system.onProfileChange(callback);
      
      system.setProfile({ expressionIntensity: 0.9 });
      
      expect(callback).toHaveBeenCalled();
    });

    it('应该传递新配置给回调', () => {
      const callback = vi.fn();
      system.onProfileChange(callback);
      
      system.setProfile({ expressionIntensity: 0.9 });
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          expressionIntensity: 0.9
        })
      );
    });

    it('应该能取消订阅', () => {
      const callback = vi.fn();
      const unsubscribe = system.onProfileChange(callback);
      
      unsubscribe();
      system.setProfile({ expressionIntensity: 0.9 });
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('回调抛出错误不应中断其他回调', () => {
      const callback1 = vi.fn(() => { throw new Error('test'); });
      const callback2 = vi.fn();
      
      system.onProfileChange(callback1);
      system.onProfileChange(callback2);
      
      system.setProfile({ expressionIntensity: 0.9 });
      
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('清除和销毁', () => {
    it('应该能清除反馈历史', () => {
      system.recordFeedback('positive');
      system.recordFeedback('negative');
      
      system.clearHistory();
      
      const stats = system.getFeedbackStats();
      expect(stats.size).toBe(0);
    });

    it('销毁后应该清理资源', () => {
      const callback = vi.fn();
      system.onProfileChange(callback);
      system.recordFeedback('positive');
      
      system.destroy();
      
      // 尝试设置配置，回调不应被调用
      system.setProfile({ expressionIntensity: 0.9 });
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('反馈统计时间窗口', () => {
    it('应该支持自定义时间窗口', () => {
      system.recordFeedback('positive');
      
      vi.advanceTimersByTime(30 * 60 * 1000);  // 30 分钟
      
      system.recordFeedback('negative');
      
      // 1 小时窗口应该看到两个
      const statsHour = system.getFeedbackStats(60 * 60 * 1000);
      expect(statsHour.get('positive')).toBe(1);
      expect(statsHour.get('negative')).toBe(1);
      
      // 10 分钟窗口应该只看到最新的
      const stats10min = system.getFeedbackStats(10 * 60 * 1000);
      expect(stats10min.get('positive')).toBeUndefined();
      expect(stats10min.get('negative')).toBe(1);
    });
  });

  describe('学习速率', () => {
    it('learningRate 应该影响调整幅度', () => {
      // 创建一个低学习率的系统
      const slowSystem = new AdaptiveResponseSystem({
        learningRate: 0.1
      });
      
      const initialIntensity = slowSystem.getProfile().expressionIntensity;
      
      for (let i = 0; i < 3; i++) {
        slowSystem.recordFeedback('positive');
      }
      
      const change = slowSystem.getProfile().expressionIntensity - initialIntensity;
      
      // 与高学习率比较
      system.resetProfile();
      for (let i = 0; i < 3; i++) {
        system.recordFeedback('positive');
      }
      
      const highChange = system.getProfile().expressionIntensity - initialIntensity;
      
      expect(highChange).toBeGreaterThan(change);
      
      slowSystem.destroy();
    });
  });

  describe('responseVerbosity', () => {
    it('参与度高应该设置为 detailed', () => {
      for (let i = 0; i < 5; i++) {
        system.recordFeedback('engaged');
      }
      
      expect(system.getProfile().responseVerbosity).toBe('detailed');
    });

    it('参与度低应该设置为 minimal', () => {
      for (let i = 0; i < 3; i++) {
        system.recordFeedback('disengaged');
      }
      
      expect(system.getProfile().responseVerbosity).toBe('minimal');
    });

    it('不耐烦应该设置为 minimal', () => {
      for (let i = 0; i < 2; i++) {
        system.recordFeedback('impatient');
      }
      
      expect(system.getProfile().responseVerbosity).toBe('minimal');
    });
  });
});
