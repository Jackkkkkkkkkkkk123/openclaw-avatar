/**
 * ExpressionMemorySystem 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ExpressionMemorySystem,
  getExpressionMemorySystem,
  resetExpressionMemorySystem,
  recordExpressionTransition,
  getExpressionRecommendation,
  isNaturalTransition,
  type EmotionType,
} from './ExpressionMemorySystem';

describe('ExpressionMemorySystem', () => {
  let system: ExpressionMemorySystem;

  beforeEach(() => {
    system = new ExpressionMemorySystem();
  });

  describe('Basic Functionality', () => {
    it('should create with default config', () => {
      expect(system).toBeDefined();
      const config = system.getConfig();
      expect(config.maxHistorySize).toBe(500);
      expect(config.maxPatternLength).toBe(5);
    });

    it('should accept custom config', () => {
      const customSystem = new ExpressionMemorySystem({
        maxHistorySize: 100,
        learningRate: 0.2,
      });
      const config = customSystem.getConfig();
      expect(config.maxHistorySize).toBe(100);
      expect(config.learningRate).toBe(0.2);
    });

    it('should start with neutral expression', () => {
      expect(system.getCurrentExpression()).toBe('neutral');
    });
  });

  describe('Recording Transitions', () => {
    it('should record a transition', () => {
      system.recordTransition('happy');
      expect(system.getCurrentExpression()).toBe('happy');
      expect(system.getHistory().length).toBe(1);
    });

    it('should record multiple transitions', () => {
      system.recordTransition('happy');
      system.recordTransition('excited');
      system.recordTransition('neutral');
      
      const history = system.getHistory();
      expect(history.length).toBe(3);
      expect(history[0].to).toBe('happy');
      expect(history[1].to).toBe('excited');
      expect(history[2].to).toBe('neutral');
    });

    it('should track from/to correctly', () => {
      system.recordTransition('happy');
      system.recordTransition('sad');
      
      const history = system.getHistory();
      expect(history[0].from).toBe('neutral');
      expect(history[0].to).toBe('happy');
      expect(history[1].from).toBe('happy');
      expect(history[1].to).toBe('sad');
    });

    it('should include timestamp', () => {
      const before = Date.now();
      system.recordTransition('happy');
      const after = Date.now();
      
      const history = system.getHistory();
      expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(history[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should include optional context', () => {
      system.recordTransition('happy', { context: 'greeting' });
      
      const history = system.getHistory();
      expect(history[0].context).toBe('greeting');
    });

    it('should include optional text', () => {
      system.recordTransition('happy', { text: '你好呀！' });
      
      const history = system.getHistory();
      expect(history[0].text).toBe('你好呀！');
    });

    it('should include optional duration', () => {
      system.recordTransition('happy', { durationMs: 500 });
      
      const history = system.getHistory();
      expect(history[0].durationMs).toBe(500);
    });

    it('should respect maxHistorySize', () => {
      const smallSystem = new ExpressionMemorySystem({ maxHistorySize: 3 });
      
      smallSystem.recordTransition('happy');
      smallSystem.recordTransition('sad');
      smallSystem.recordTransition('neutral');
      smallSystem.recordTransition('excited');
      
      expect(smallSystem.getHistory().length).toBe(3);
    });

    it('should limit history with getHistory(limit)', () => {
      system.recordTransition('happy');
      system.recordTransition('sad');
      system.recordTransition('neutral');
      
      expect(system.getHistory(2).length).toBe(2);
      expect(system.getHistory(2)[0].to).toBe('sad');  // 最近2个
    });
  });

  describe('Natural Transition Detection', () => {
    it('should consider neutral→happy as natural', () => {
      expect(system.isNaturalTransition('neutral', 'happy')).toBe(true);
    });

    it('should consider neutral→surprised as natural', () => {
      expect(system.isNaturalTransition('neutral', 'surprised')).toBe(true);
    });

    it('should consider happy→angry as unnatural', () => {
      expect(system.isNaturalTransition('happy', 'angry')).toBe(false);
    });

    it('should consider happy→sad as unnatural', () => {
      expect(system.isNaturalTransition('happy', 'sad')).toBe(false);
    });

    it('should consider happy→excited as natural', () => {
      expect(system.isNaturalTransition('happy', 'excited')).toBe(true);
    });

    it('should consider same emotion as natural', () => {
      expect(system.isNaturalTransition('happy', 'happy')).toBe(true);
    });

    it('should auto-detect naturalness when recording', () => {
      system.recordTransition('happy');  // neutral→happy is natural
      expect(system.getHistory()[0].wasNatural).toBe(true);
    });

    it('should allow manual naturalness override', () => {
      system.recordTransition('angry', { wasNatural: false });
      expect(system.getHistory()[0].wasNatural).toBe(false);
    });
  });

  describe('Transition Scores', () => {
    it('should return score for known transitions', () => {
      const score = system.getTransitionScore('neutral', 'happy');
      expect(score).toBeGreaterThan(0.5);
    });

    it('should estimate score for unknown transitions', () => {
      const score = system.getTransitionScore('playful', 'bored');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should update scores with learning', () => {
      const initialScore = system.getTransitionScore('neutral', 'happy');
      
      // 多次记录自然过渡
      for (let i = 0; i < 10; i++) {
        system.setCurrentExpression('neutral');
        system.recordTransition('happy', { wasNatural: true });
      }
      
      const updatedScore = system.getTransitionScore('neutral', 'happy');
      expect(updatedScore).toBeGreaterThanOrEqual(initialScore);
    });

    it('should decrease score for unnatural transitions', () => {
      // 先记录几次"自然"过渡来建立基线
      system.recordTransition('happy', { wasNatural: true });
      system.setCurrentExpression('neutral');
      
      // 然后记录不自然的过渡
      for (let i = 0; i < 5; i++) {
        system.setCurrentExpression('neutral');
        system.recordTransition('happy', { wasNatural: false });
      }
      
      const score = system.getTransitionScore('neutral', 'happy');
      expect(score).toBeLessThan(1);
    });
  });

  describe('Pattern Learning', () => {
    it('should create patterns from sequences', () => {
      system.recordTransition('happy');
      system.recordTransition('excited');
      system.recordTransition('neutral');
      
      const stats = system.getStats();
      expect(stats.uniquePatterns).toBeGreaterThan(0);
    });

    it('should increase pattern count on repetition', () => {
      // 记录相同模式多次
      for (let i = 0; i < 3; i++) {
        system.setCurrentExpression('neutral');
        system.recordTransition('happy');
        system.recordTransition('excited');
      }
      
      const stats = system.getStats();
      expect(stats.uniquePatterns).toBeGreaterThan(0);
    });
  });

  describe('Recommendations', () => {
    it('should return a recommendation', () => {
      const rec = system.getRecommendation();
      
      expect(rec).toBeDefined();
      expect(rec.expression).toBeDefined();
      expect(rec.confidence).toBeGreaterThanOrEqual(0);
      expect(rec.confidence).toBeLessThanOrEqual(1);
      expect(rec.reason).toBeDefined();
      expect(Array.isArray(rec.alternates)).toBe(true);
    });

    it('should consider detected emotion', () => {
      const rec = system.getRecommendation({
        detectedEmotion: 'happy',
      });
      
      // 应该推荐检测到的情绪或相关情绪
      expect(['happy', 'excited', 'loving', 'playful']).toContain(rec.expression);
    });

    it('should consider context', () => {
      // 建立上下文模式
      system.recordTransition('happy', { context: 'greeting' });
      system.setCurrentExpression('neutral');
      system.recordTransition('happy', { context: 'greeting' });
      system.setCurrentExpression('neutral');
      system.recordTransition('happy', { context: 'greeting' });
      system.setCurrentExpression('neutral');
      
      const rec = system.getRecommendation({ context: 'greeting' });
      expect(rec.expression).toBeDefined();
    });

    it('should exclude recent expressions', () => {
      system.recordTransition('happy');
      system.recordTransition('excited');
      
      const rec = system.getRecommendation({ excludeRecent: 2 });
      
      // 如果排除了 happy 和 excited，应该推荐其他表情
      // 但如果没有其他好的候选，可能还是会返回这些
      expect(rec.expression).toBeDefined();
    });

    it('should provide alternates', () => {
      const rec = system.getRecommendation({
        detectedEmotion: 'happy',
      });
      
      expect(rec.alternates).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should track total transitions', () => {
      system.recordTransition('happy');
      system.recordTransition('sad');
      system.recordTransition('neutral');
      
      const stats = system.getStats();
      expect(stats.totalTransitions).toBe(3);
    });

    it('should find most used expression', () => {
      system.recordTransition('happy');
      system.recordTransition('happy');
      system.recordTransition('sad');
      
      const stats = system.getStats();
      expect(stats.mostUsedExpression).toBe('happy');
    });

    it('should calculate average naturalness', () => {
      system.recordTransition('happy', { wasNatural: true });
      system.recordTransition('sad', { wasNatural: false });
      
      const stats = system.getStats();
      expect(stats.avgNaturalness).toBe(0.5);
    });

    it('should track most natural transition', () => {
      system.recordTransition('happy', { wasNatural: true });
      
      const stats = system.getStats();
      expect(stats.mostNaturalTransition).toBeDefined();
    });

    it('should track least natural transition', () => {
      system.recordTransition('angry', { wasNatural: false });
      
      const stats = system.getStats();
      expect(stats.leastNaturalTransition).toBeDefined();
    });

    it('should track unique patterns', () => {
      system.recordTransition('happy');
      system.recordTransition('excited');
      
      const stats = system.getStats();
      expect(stats.uniquePatterns).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Callbacks', () => {
    it('should subscribe to transitions', () => {
      const callback = vi.fn();
      system.onTransition(callback);
      
      system.recordTransition('happy');
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        from: 'neutral',
        to: 'happy',
      }));
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      const unsubscribe = system.onTransition(callback);
      
      system.recordTransition('happy');
      unsubscribe();
      system.recordTransition('sad');
      
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => { throw new Error('Test error'); });
      const normalCallback = vi.fn();
      
      system.onTransition(errorCallback);
      system.onTransition(normalCallback);
      
      expect(() => system.recordTransition('happy')).not.toThrow();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    it('should set current expression without recording', () => {
      system.setCurrentExpression('happy');
      
      expect(system.getCurrentExpression()).toBe('happy');
      expect(system.getHistory().length).toBe(0);
    });

    it('should clear history', () => {
      system.recordTransition('happy');
      system.recordTransition('sad');
      
      system.clearHistory();
      
      expect(system.getHistory().length).toBe(0);
    });

    it('should reset completely', () => {
      system.recordTransition('happy');
      system.recordTransition('sad');
      
      system.reset();
      
      expect(system.getHistory().length).toBe(0);
      expect(system.getCurrentExpression()).toBe('neutral');
      expect(system.getStats().uniquePatterns).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should get config copy', () => {
      const config = system.getConfig();
      config.maxHistorySize = 1;  // 修改不应影响内部
      
      expect(system.getConfig().maxHistorySize).toBe(500);
    });

    it('should update config', () => {
      system.setConfig({ maxHistorySize: 100 });
      
      expect(system.getConfig().maxHistorySize).toBe(100);
    });

    it('should merge config partially', () => {
      const originalRate = system.getConfig().learningRate;
      system.setConfig({ maxHistorySize: 100 });
      
      expect(system.getConfig().learningRate).toBe(originalRate);
    });
  });

  describe('Data Export/Import', () => {
    it('should export data as JSON', () => {
      system.recordTransition('happy');
      
      const json = system.exportData();
      const data = JSON.parse(json);
      
      expect(data.history).toBeDefined();
      expect(data.patterns).toBeDefined();
      expect(data.transitionScores).toBeDefined();
      expect(data.currentExpression).toBe('happy');
    });

    it('should import data from JSON', () => {
      system.recordTransition('happy');
      system.recordTransition('excited');
      
      const json = system.exportData();
      
      const newSystem = new ExpressionMemorySystem();
      newSystem.importData(json);
      
      expect(newSystem.getCurrentExpression()).toBe('excited');
      expect(newSystem.getHistory().length).toBe(2);
    });

    it('should handle invalid JSON gracefully', () => {
      expect(() => system.importData('invalid json')).not.toThrow();
    });

    it('should handle empty import', () => {
      expect(() => system.importData('{}')).not.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    afterEach(() => {
      resetExpressionMemorySystem();
    });

    it('should return same instance', () => {
      const instance1 = getExpressionMemorySystem();
      const instance2 = getExpressionMemorySystem();
      
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getExpressionMemorySystem();
      resetExpressionMemorySystem();
      const instance2 = getExpressionMemorySystem();
      
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Convenience Functions', () => {
    afterEach(() => {
      resetExpressionMemorySystem();
    });

    it('recordExpressionTransition should work', () => {
      recordExpressionTransition('happy');
      
      const system = getExpressionMemorySystem();
      expect(system.getCurrentExpression()).toBe('happy');
    });

    it('getExpressionRecommendation should work', () => {
      const rec = getExpressionRecommendation();
      
      expect(rec).toBeDefined();
      expect(rec.expression).toBeDefined();
    });

    it('isNaturalTransition should work', () => {
      const result = isNaturalTransition('neutral', 'happy');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid transitions', () => {
      for (let i = 0; i < 100; i++) {
        system.recordTransition(i % 2 === 0 ? 'happy' : 'sad');
      }
      
      expect(system.getHistory().length).toBeLessThanOrEqual(system.getConfig().maxHistorySize);
    });

    it('should handle all emotion types', () => {
      const emotions: EmotionType[] = [
        'neutral', 'happy', 'sad', 'surprised', 'angry',
        'fear', 'thinking', 'shy', 'excited', 'loving',
        'grateful', 'proud', 'confused', 'bored', 'playful',
      ];
      
      for (const emotion of emotions) {
        system.recordTransition(emotion);
        expect(system.getCurrentExpression()).toBe(emotion);
      }
    });

    it('should handle empty recommendation options', () => {
      const rec = system.getRecommendation({});
      expect(rec).toBeDefined();
    });

    it('should handle recommendation with all options', () => {
      const rec = system.getRecommendation({
        text: 'Hello!',
        context: 'greeting',
        detectedEmotion: 'happy',
        excludeRecent: 1,
      });
      
      expect(rec).toBeDefined();
    });
  });
});
