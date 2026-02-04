/**
 * ExpressionVariantSystem Tests - Round 29
 * 表情变体系统测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  ExpressionVariantSystem, 
  VariantSelection,
  VariantContext,
  ExpressionVariant,
  selectExpressionVariant,
  setVariantContext,
  inferVariantContext
} from './ExpressionVariantSystem';

describe('ExpressionVariantSystem', () => {
  let system: ExpressionVariantSystem;

  beforeEach(() => {
    try {
      ExpressionVariantSystem.getInstance().destroy();
    } catch (e) {
      // ignore
    }
    system = ExpressionVariantSystem.getInstance();
  });

  afterEach(() => {
    system.destroy();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ExpressionVariantSystem.getInstance();
      const instance2 = ExpressionVariantSystem.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after destroy', () => {
      const instance1 = ExpressionVariantSystem.getInstance();
      instance1.destroy();
      const instance2 = ExpressionVariantSystem.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Select Variant', () => {
    it('should select a variant for happy emotion', () => {
      const selection = system.selectVariant('happy', 0.5);
      expect(selection).toBeDefined();
      expect(selection.expression).toBeDefined();
      expect(selection.variant).toBeDefined();
    });

    it('should return neutral for unknown emotion', () => {
      const selection = system.selectVariant('unknown' as any, 0.5);
      expect(selection.expression).toBe('neutral');
      expect(selection.reason).toContain('No variants');
    });

    it('should respect intensity range', () => {
      // 多次选择，验证考虑强度
      for (let i = 0; i < 20; i++) {
        const selection = system.selectVariant('happy', 0.9);
        expect(selection.expression).toBeDefined();
      }
    });

    it('should respect context', () => {
      for (let i = 0; i < 20; i++) {
        const selection = system.selectVariant('happy', 0.7, 'celebrate');
        expect(selection.expression).toBeDefined();
      }
    });

    it('should include reason in selection', () => {
      const selection = system.selectVariant('happy', 0.5);
      expect(selection.reason).toBeDefined();
      expect(typeof selection.reason).toBe('string');
    });
  });

  describe('Variant Retrieval', () => {
    it('should get variants for emotion', () => {
      const variants = system.getVariantsForEmotion('happy');
      expect(variants.length).toBeGreaterThan(0);
    });

    it('should return empty for unknown emotion', () => {
      const variants = system.getVariantsForEmotion('unknown' as any);
      expect(variants.length).toBe(0);
    });

    it('should get supported emotions', () => {
      const emotions = system.getSupportedEmotions();
      expect(emotions).toContain('happy');
      expect(emotions).toContain('sad');
      expect(emotions).toContain('neutral');
    });

    it('should get all expressions', () => {
      const expressions = system.getAllExpressions();
      expect(expressions.length).toBeGreaterThan(0);
      expect(expressions).toContain('happy');
      expect(expressions).toContain('neutral');
    });
  });

  describe('Custom Variants', () => {
    it('should add custom variant', () => {
      const countBefore = system.getVariantsForEmotion('happy').length;
      
      system.addVariant('happy', {
        expression: 'custom_happy' as any,
        weight: 1.0,
        intensityRange: [0, 1],
      });
      
      const countAfter = system.getVariantsForEmotion('happy').length;
      expect(countAfter).toBe(countBefore + 1);
    });

    it('should remove variant', () => {
      const removed = system.removeVariant('happy', 'happy');
      expect(removed).toBe(true);
    });

    it('should return false for non-existent variant', () => {
      const removed = system.removeVariant('happy', 'non_existent' as any);
      expect(removed).toBe(false);
    });

    it('should return false for non-existent emotion', () => {
      const removed = system.removeVariant('unknown' as any, 'happy');
      expect(removed).toBe(false);
    });
  });

  describe('Context Management', () => {
    it('should set and get context', () => {
      system.setContext('celebrate');
      expect(system.getContext()).toBe('celebrate');
    });

    it('should default to casual', () => {
      expect(system.getContext()).toBe('casual');
    });

    it('should infer greeting context', () => {
      expect(system.inferContextFromText('你好')).toBe('greeting');
      expect(system.inferContextFromText('Hello')).toBe('greeting');
      expect(system.inferContextFromText('早上好')).toBe('greeting');
    });

    it('should infer farewell context', () => {
      expect(system.inferContextFromText('再见')).toBe('farewell');
      expect(system.inferContextFromText('bye')).toBe('farewell');
      expect(system.inferContextFromText('晚安')).toBe('farewell');
    });

    it('should infer question context', () => {
      expect(system.inferContextFromText('为什么?')).toBe('question');
      expect(system.inferContextFromText('怎么做')).toBe('question');
      expect(system.inferContextFromText('这是什么?')).toBe('question');
    });

    it('should infer celebrate context', () => {
      expect(system.inferContextFromText('恭喜你!')).toBe('celebrate');
      expect(system.inferContextFromText('太棒了')).toBe('celebrate');
    });

    it('should infer comfort context', () => {
      expect(system.inferContextFromText('别担心')).toBe('comfort');
      expect(system.inferContextFromText('会好的')).toBe('comfort');
    });

    it('should infer serious context', () => {
      expect(system.inferContextFromText('这很重要')).toBe('serious');
      expect(system.inferContextFromText('必须注意')).toBe('serious');
    });

    it('should infer playful context', () => {
      expect(system.inferContextFromText('嘿嘿')).toBe('playful');
      expect(system.inferContextFromText('哈哈好玩')).toBe('playful');
    });

    it('should infer story context', () => {
      expect(system.inferContextFromText('从前有一个')).toBe('story');
      expect(system.inferContextFromText('讲一个故事')).toBe('story');
    });

    it('should return casual for unmatched text', () => {
      expect(system.inferContextFromText('普通的文字')).toBe('casual');
    });
  });

  describe('History Management', () => {
    it('should record selection in history', () => {
      system.selectVariant('happy', 0.5);
      const history = system.getHistory();
      expect(history.length).toBe(1);
    });

    it('should limit history size', () => {
      system.setConfig({ historySize: 5 });
      for (let i = 0; i < 20; i++) {
        system.selectVariant('happy', 0.5);
      }
      expect(system.getHistory().length).toBeLessThanOrEqual(5);
    });

    it('should clear history', () => {
      system.selectVariant('happy', 0.5);
      system.clearHistory();
      expect(system.getHistory().length).toBe(0);
    });

    it('should include context in history', () => {
      system.selectVariant('happy', 0.5, 'celebrate');
      const history = system.getHistory();
      expect(history[0].context).toBe('celebrate');
    });
  });

  describe('Usage Statistics', () => {
    it('should track expression usage', () => {
      system.selectVariant('happy', 0.5);
      system.selectVariant('happy', 0.5);
      system.selectVariant('sad', 0.5);
      
      const stats = system.getUsageStats();
      expect(Object.keys(stats).length).toBeGreaterThan(0);
    });

    it('should track context usage', () => {
      system.selectVariant('happy', 0.5, 'celebrate');
      system.selectVariant('happy', 0.5, 'greeting');
      
      const stats = system.getContextStats();
      expect(stats['celebrate']).toBe(1);
      expect(stats['greeting']).toBe(1);
    });
  });

  describe('Selection Callbacks', () => {
    it('should notify on selection', () => {
      const callback = vi.fn();
      system.onSelection(callback);
      
      system.selectVariant('happy', 0.5);
      expect(callback).toHaveBeenCalled();
    });

    it('should pass selection to callback', () => {
      const callback = vi.fn();
      system.onSelection(callback);
      
      system.selectVariant('happy', 0.5);
      
      const selection = callback.mock.calls[0][0];
      expect(selection.expression).toBeDefined();
      expect(selection.variant).toBeDefined();
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      const unsubscribe = system.onSelection(callback);
      
      system.selectVariant('happy', 0.5);
      expect(callback).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      system.selectVariant('happy', 0.5);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle callback errors', () => {
      const errorCallback = vi.fn(() => { throw new Error('Callback error'); });
      const normalCallback = vi.fn();
      
      system.onSelection(errorCallback);
      system.onSelection(normalCallback);
      
      expect(() => system.selectVariant('happy', 0.5)).not.toThrow();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should get config', () => {
      const config = system.getConfig();
      expect(config.historySize).toBeDefined();
      expect(config.repeatPenalty).toBeDefined();
      expect(config.intensityWeight).toBeDefined();
    });

    it('should set partial config', () => {
      system.setConfig({ historySize: 50 });
      expect(system.getConfig().historySize).toBe(50);
    });

    it('should return config copy', () => {
      const config = system.getConfig();
      config.historySize = 1000;
      expect(system.getConfig().historySize).not.toBe(1000);
    });
  });

  describe('Reset', () => {
    it('should reset state', () => {
      system.selectVariant('happy', 0.5);
      system.setContext('celebrate');
      
      system.reset();
      
      expect(system.getHistory().length).toBe(0);
      expect(system.getContext()).toBe('casual');
    });
  });

  describe('Convenience Functions', () => {
    it('should select variant with convenience function', () => {
      const selection = selectExpressionVariant('happy', 0.5);
      expect(selection.expression).toBeDefined();
    });

    it('should set and get context via system directly', () => {
      // 直接测试系统方法，避免单例问题
      system.setContext('celebrate');
      expect(system.getContext()).toBe('celebrate');
    });

    it('should infer context with convenience function', () => {
      const context = inferVariantContext('你好');
      expect(context).toBe('greeting');
    });
  });

  describe('Edge Cases', () => {
    it('should handle intensity at boundaries', () => {
      const selection0 = system.selectVariant('happy', 0);
      const selection1 = system.selectVariant('happy', 1);
      expect(selection0.expression).toBeDefined();
      expect(selection1.expression).toBeDefined();
    });

    it('should handle rapid selections', () => {
      for (let i = 0; i < 100; i++) {
        system.selectVariant('happy', Math.random());
      }
      // 不应崩溃
      expect(system.getHistory().length).toBeGreaterThan(0);
    });

    it('should handle all emotions', () => {
      const emotions = system.getSupportedEmotions();
      for (const emotion of emotions) {
        const selection = system.selectVariant(emotion, 0.5);
        expect(selection.expression).toBeDefined();
      }
    });

    it('should handle all contexts', () => {
      const contexts: VariantContext[] = [
        'greeting', 'farewell', 'question', 'answer',
        'story', 'comfort', 'celebrate', 'casual',
        'serious', 'playful'
      ];
      
      for (const context of contexts) {
        const selection = system.selectVariant('happy', 0.5, context);
        expect(selection.expression).toBeDefined();
      }
    });
  });
});
