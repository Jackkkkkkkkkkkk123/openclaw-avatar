/**
 * DialogueActionPredictor Tests - Round 28
 * 对话动作预测系统测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  DialogueActionPredictor, 
  ActionPrediction,
  PredictedAction,
  DialoguePattern,
  DialogueTurn
} from './DialogueActionPredictor';

describe('DialogueActionPredictor', () => {
  let predictor: DialogueActionPredictor;

  beforeEach(() => {
    try {
      DialogueActionPredictor.getInstance().destroy();
    } catch (e) {
      // ignore
    }
    predictor = DialogueActionPredictor.getInstance();
  });

  afterEach(() => {
    predictor.destroy();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = DialogueActionPredictor.getInstance();
      const instance2 = DialogueActionPredictor.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after destroy', () => {
      const instance1 = DialogueActionPredictor.getInstance();
      instance1.destroy();
      const instance2 = DialogueActionPredictor.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Default Patterns', () => {
    it('should have patterns initialized', () => {
      const count = predictor.getPatternCount();
      expect(count).toBeGreaterThan(0);
    });

    it('should get patterns list', () => {
      const patterns = predictor.getPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]).toHaveProperty('pattern');
      expect(patterns[0]).toHaveProperty('action');
    });
  });

  describe('Greeting Detection', () => {
    it('should detect 你好 as greet', () => {
      const prediction = predictor.predict('你好', 'user');
      expect(prediction?.action).toBe('greet');
    });

    it('should detect hello as greet', () => {
      const prediction = predictor.predict('hello', 'user');
      expect(prediction?.action).toBe('greet');
    });

    it('should detect hi as greet', () => {
      const prediction = predictor.predict('hi', 'user');
      expect(prediction?.action).toBe('greet');
    });

    it('should detect 早上好 as greet', () => {
      const prediction = predictor.predict('早上好', 'user');
      expect(prediction?.action).toBe('greet');
    });
  });

  describe('Farewell Detection', () => {
    it('should detect 再见 as farewell', () => {
      const prediction = predictor.predict('再见', 'user');
      expect(prediction?.action).toBe('farewell');
    });

    it('should detect bye as farewell', () => {
      const prediction = predictor.predict('bye', 'user');
      expect(prediction?.action).toBe('farewell');
    });

    it('should detect 晚安 as farewell', () => {
      const prediction = predictor.predict('晚安', 'user');
      expect(prediction?.action).toBe('farewell');
    });
  });

  describe('Agreement Detection', () => {
    it('should detect 好的 as nod', () => {
      const prediction = predictor.predict('好的', 'user');
      expect(prediction?.action).toBe('nod');
    });

    it('should detect ok as nod', () => {
      const prediction = predictor.predict('ok', 'user');
      expect(prediction?.action).toBe('nod');
    });

    it('should detect 是的 as nod', () => {
      const prediction = predictor.predict('是的', 'user');
      expect(prediction?.action).toBe('nod');
    });
  });

  describe('Disagreement Detection', () => {
    it('should detect 不 as shake_head', () => {
      const prediction = predictor.predict('不', 'user');
      expect(prediction?.action).toBe('shake_head');
    });

    it('should detect no as shake_head', () => {
      const prediction = predictor.predict('no', 'user');
      expect(prediction?.action).toBe('shake_head');
    });

    it('should detect 不行 as shake_head', () => {
      const prediction = predictor.predict('不行', 'user');
      expect(prediction?.action).toBe('shake_head');
    });
  });

  describe('Question Detection', () => {
    it('should detect questions with tilt_head', () => {
      const prediction = predictor.predict('什么？', 'user');
      expect(prediction?.action).toBe('tilt_head');
    });

    it('should detect 为什么 as tilt_head', () => {
      const prediction = predictor.predict('为什么', 'user');
      expect(prediction?.action).toBe('tilt_head');
    });

    it('should detect question mark as tilt_head', () => {
      const prediction = predictor.predict('真的?', 'user');
      expect(prediction?.action).toBe('tilt_head');
    });
  });

  describe('Thinking Detection', () => {
    it('should detect 让我想想 as think', () => {
      const prediction = predictor.predict('让我想想', 'assistant');
      expect(prediction?.action).toBe('think');
    });

    it('should detect 嗯... as think', () => {
      const prediction = predictor.predict('嗯...', 'assistant');
      expect(prediction?.action).toBe('think');
    });
  });

  describe('Celebration Detection', () => {
    it('should detect 太棒了 as celebrate', () => {
      const prediction = predictor.predict('太棒了', 'assistant');
      expect(prediction?.action).toBe('celebrate');
    });

    it('should detect 恭喜 as celebrate', () => {
      const prediction = predictor.predict('恭喜你!', 'assistant');
      expect(prediction?.action).toBe('celebrate');
    });

    it('should detect amazing as celebrate', () => {
      const prediction = predictor.predict('amazing!', 'assistant');
      expect(prediction?.action).toBe('celebrate');
    });
  });

  describe('Thank Detection', () => {
    it('should detect 谢谢 as bow', () => {
      const prediction = predictor.predict('谢谢', 'user');
      expect(prediction?.action).toBe('bow');
    });

    it('should detect thanks as bow', () => {
      const prediction = predictor.predict('thanks', 'user');
      expect(prediction?.action).toBe('bow');
    });
  });

  describe('Comfort Detection', () => {
    it('should detect 没关系 as comfort', () => {
      const prediction = predictor.predict('没关系', 'assistant');
      expect(prediction?.action).toBe('comfort');
    });

    it('should detect 别担心 as comfort', () => {
      const prediction = predictor.predict('别担心', 'assistant');
      expect(prediction?.action).toBe('comfort');
    });
  });

  describe('Shrug Detection', () => {
    it('should detect 不知道 as shrug', () => {
      const prediction = predictor.predict('不知道', 'assistant');
      expect(prediction?.action).toBe('shrug');
    });

    it('should detect 不确定 as shrug', () => {
      const prediction = predictor.predict('不确定', 'assistant');
      expect(prediction?.action).toBe('shrug');
    });
  });

  describe('Add Turn', () => {
    it('should add turn to history', () => {
      predictor.addTurn('user', '你好');
      const history = predictor.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].content).toBe('你好');
      expect(history[0].role).toBe('user');
    });

    it('should return prediction when confidence is met', () => {
      const result = predictor.addTurn('user', '你好');
      expect(result).not.toBeNull();
      expect(result?.action).toBe('greet');
    });

    it('should limit history size', () => {
      predictor.setConfig({ historyWindow: 2 });
      for (let i = 0; i < 10; i++) {
        predictor.addTurn('user', `message ${i}`);
      }
      const history = predictor.getHistory();
      expect(history.length).toBeLessThanOrEqual(4); // 2 * historyWindow
    });

    it('should return null for low confidence', () => {
      predictor.setConfig({ minConfidence: 1.0 }); // Impossible threshold
      const result = predictor.addTurn('user', 'random text');
      expect(result).toBeNull();
    });
  });

  describe('History Management', () => {
    it('should get history', () => {
      predictor.addTurn('user', 'hello');
      predictor.addTurn('assistant', 'hi there');
      
      const history = predictor.getHistory();
      expect(history.length).toBe(2);
    });

    it('should clear history', () => {
      predictor.addTurn('user', 'hello');
      predictor.clearHistory();
      expect(predictor.getHistory().length).toBe(0);
    });

    it('should return history copy', () => {
      predictor.addTurn('user', 'hello');
      const history = predictor.getHistory();
      history.push({ role: 'user', content: 'fake', timestamp: 0 });
      expect(predictor.getHistory().length).toBe(1);
    });
  });

  describe('Last Prediction', () => {
    it('should store last prediction', () => {
      predictor.addTurn('user', '你好');
      const last = predictor.getLastPrediction();
      expect(last).not.toBeNull();
      expect(last?.action).toBe('greet');
    });

    it('should return null initially', () => {
      expect(predictor.getLastPrediction()).toBeNull();
    });

    it('should return copy of prediction', () => {
      predictor.addTurn('user', '你好');
      const last = predictor.getLastPrediction();
      last!.confidence = 0;
      expect(predictor.getLastPrediction()?.confidence).not.toBe(0);
    });
  });

  describe('Custom Patterns', () => {
    it('should add custom pattern', () => {
      const initialCount = predictor.getPatternCount();
      predictor.addPattern({
        pattern: /custom_trigger/,
        action: 'wave',
        confidence: 0.9,
        timing: {},
        description: 'Custom pattern',
      });
      expect(predictor.getPatternCount()).toBe(initialCount + 1);
    });

    it('should match custom pattern', () => {
      predictor.addPattern({
        pattern: /magic_word/,
        action: 'celebrate',
        confidence: 0.95,
        timing: {},
        description: 'Magic word',
      });
      
      const prediction = predictor.predict('magic_word', 'user');
      expect(prediction?.action).toBe('celebrate');
    });

    it('should remove pattern', () => {
      const initialCount = predictor.getPatternCount();
      predictor.removePattern('greet');
      expect(predictor.getPatternCount()).toBe(initialCount - 1);
    });

    it('should return false for non-existent pattern removal', () => {
      const result = predictor.removePattern('nonexistent' as any);
      expect(result).toBe(false);
    });
  });

  describe('Prediction Callbacks', () => {
    it('should notify on prediction', () => {
      const callback = vi.fn();
      predictor.onPrediction(callback);
      
      predictor.addTurn('user', '你好');
      expect(callback).toHaveBeenCalled();
    });

    it('should pass prediction to callback', () => {
      const callback = vi.fn();
      predictor.onPrediction(callback);
      
      predictor.addTurn('user', '你好');
      
      const prediction = callback.mock.calls[0][0];
      expect(prediction.action).toBe('greet');
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      const unsubscribe = predictor.onPrediction(callback);
      
      predictor.addTurn('user', '你好');
      expect(callback).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      predictor.addTurn('user', '再见');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle callback errors', () => {
      const errorCallback = vi.fn(() => { throw new Error('Callback error'); });
      const normalCallback = vi.fn();
      
      predictor.onPrediction(errorCallback);
      predictor.onPrediction(normalCallback);
      
      expect(() => predictor.addTurn('user', '你好')).not.toThrow();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should get config', () => {
      const config = predictor.getConfig();
      expect(config.historyWindow).toBeDefined();
      expect(config.minConfidence).toBeDefined();
      expect(config.defaultTiming).toBeDefined();
    });

    it('should set partial config', () => {
      predictor.setConfig({ minConfidence: 0.5 });
      expect(predictor.getConfig().minConfidence).toBe(0.5);
    });

    it('should return config copy', () => {
      const config = predictor.getConfig();
      config.minConfidence = 999;
      expect(predictor.getConfig().minConfidence).not.toBe(999);
    });
  });

  describe('Action Timing', () => {
    it('should get action timing', () => {
      const timing = predictor.getActionTiming('greet');
      expect(timing.delay).toBeDefined();
      expect(timing.duration).toBeDefined();
      expect(timing.interruptible).toBeDefined();
    });

    it('should use default timing for unknown action', () => {
      const timing = predictor.getActionTiming('none');
      expect(timing).toEqual(predictor.getConfig().defaultTiming);
    });
  });

  describe('Batch Prediction', () => {
    it('should predict batch of contents', () => {
      const contents = ['你好', '再见', 'random text'];
      const predictions = predictor.predictBatch(contents);
      expect(predictions.length).toBeGreaterThan(0);
    });

    it('should filter out null predictions', () => {
      const contents = ['你好', 'xyz123abc', '再见'];
      const predictions = predictor.predictBatch(contents);
      predictions.forEach(p => {
        expect(p).not.toBeNull();
      });
    });
  });

  describe('Context Bonus', () => {
    it('should reduce confidence for repeated actions', () => {
      predictor.addTurn('user', '你好');
      const first = predictor.getLastPrediction();
      
      predictor.addTurn('user', 'hello');
      const second = predictor.getLastPrediction();
      
      // 第二次相同动作应该有较低置信度
      if (first && second && first.action === second.action) {
        expect(second.confidence).toBeLessThan(first.confidence);
      }
    });

    it('should boost greet at conversation start', () => {
      const prediction = predictor.predict('你好', 'user');
      expect(prediction?.action).toBe('greet');
      // 开始时应该有较高置信度
      expect(prediction?.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Reset', () => {
    it('should reset to initial state', () => {
      predictor.addTurn('user', '你好');
      predictor.removePattern('greet');
      
      predictor.reset();
      
      expect(predictor.getHistory().length).toBe(0);
      expect(predictor.getLastPrediction()).toBeNull();
      // 模式应该被恢复
      const prediction = predictor.predict('你好', 'user');
      expect(prediction?.action).toBe('greet');
    });
  });

  describe('Destroy', () => {
    it('should clear all state', () => {
      predictor.addTurn('user', '你好');
      const callback = vi.fn();
      predictor.onPrediction(callback);
      
      predictor.destroy();
      
      const newPredictor = DialogueActionPredictor.getInstance();
      expect(newPredictor.getHistory().length).toBe(0);
      newPredictor.destroy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const prediction = predictor.predict('', 'user');
      expect(prediction).toBeNull();
    });

    it('should handle very long content', () => {
      const longContent = '你好'.repeat(1000);
      const prediction = predictor.predict(longContent, 'user');
      // 应该仍能匹配开头的你好
      expect(prediction?.action).toBe('greet');
    });

    it('should handle special characters', () => {
      const prediction = predictor.predict('你好！！！🎉', 'user');
      expect(prediction?.action).toBe('greet');
    });

    it('should handle mixed case', () => {
      const prediction = predictor.predict('HELLO', 'user');
      expect(prediction?.action).toBe('greet');
    });

    it('should handle rapid turns', () => {
      for (let i = 0; i < 50; i++) {
        predictor.addTurn(i % 2 === 0 ? 'user' : 'assistant', `message ${i}`);
      }
      // 不应崩溃
      expect(predictor.getHistory().length).toBeGreaterThan(0);
    });
  });
});
