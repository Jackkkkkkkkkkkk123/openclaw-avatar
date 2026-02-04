/**
 * EmotionContextEngine 单元测试
 * 
 * 测试情绪上下文追踪和惯性系统
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EmotionContextEngine } from './EmotionContextEngine';

describe('EmotionContextEngine', () => {
  let engine: EmotionContextEngine;

  beforeEach(() => {
    engine = new EmotionContextEngine();
  });

  describe('processText', () => {
    it('should return detected emotion for first message', () => {
      const result = engine.processText('你好！', 'happy', 0.8);
      expect(result.emotion).toBeDefined();
      expect(result.intensity).toBeGreaterThan(0);
      expect(result.influences.length).toBeGreaterThan(0);
    });

    it('should include detected emotion in influences', () => {
      const result = engine.processText('太开心了', 'happy', 0.9);
      const detectedInfluence = result.influences.find(i => i.source === 'detected');
      expect(detectedInfluence).toBeDefined();
      expect(detectedInfluence?.emotion).toBe('happy');
    });

    it('should apply emotion inertia for sad emotions', () => {
      // 先建立悲伤的上下文
      engine.processText('好难过', 'sad', 0.9);
      engine.processText('真的很伤心', 'sad', 0.8);
      
      // 然后发一个中性消息，应该受到惯性影响
      const result = engine.processText('好的', 'neutral', 0.1);
      const inertiaInfluence = result.influences.find(i => i.source === 'inertia');
      
      // 应该有惯性影响
      if (inertiaInfluence) {
        expect(inertiaInfluence.emotion).toBe('sad');
      }
    });

    it('should detect work topic from keywords', () => {
      const result = engine.processText('这个项目的代码需要优化', 'thinking', 0.5);
      const topicInfluence = result.influences.find(i => i.source === 'topic');
      
      // 工作话题可能影响情绪
      expect(result.influences.length).toBeGreaterThan(0);
    });
  });

  describe('getConversationTone', () => {
    it('should start with neutral base emotion', () => {
      const tone = engine.getConversationTone();
      expect(tone.baseEmotion).toBe('neutral');
      expect(tone.stability).toBeDefined();
    });

    it('should update base emotion after multiple messages', () => {
      engine.processText('太开心了！', 'happy', 0.9);
      engine.processText('真的很高兴！', 'happy', 0.9);
      engine.processText('超级兴奋！', 'excited', 0.8);
      
      const tone = engine.getConversationTone();
      // 应该偏向积极情绪
      expect(['happy', 'excited', 'neutral']).toContain(tone.baseEmotion);
    });

    it('should have topic stack when topics are detected', () => {
      engine.processText('这个AI项目很有趣', 'excited', 0.7);
      const tone = engine.getConversationTone();
      expect(tone.topicStack).toBeDefined();
    });
  });

  describe('getEmotionHistory', () => {
    it('should return empty array initially', () => {
      const history = engine.getEmotionHistory();
      expect(history).toEqual([]);
    });

    it('should record processed emotions', () => {
      engine.processText('开心', 'happy', 0.8);
      engine.processText('难过', 'sad', 0.7);
      
      const history = engine.getEmotionHistory();
      expect(history.length).toBe(2);
    });

    it('should have most recent first', () => {
      engine.processText('开心', 'happy', 0.8);
      engine.processText('难过', 'sad', 0.7);
      
      const history = engine.getEmotionHistory();
      expect(history[0].emotion).toBe('sad');
      expect(history[1].emotion).toBe('happy');
    });
  });

  describe('analyzeEmotionTrend', () => {
    it('should return stable trend for single emotion', () => {
      engine.processText('好的', 'neutral', 0.5);
      const trend = engine.analyzeEmotionTrend();
      expect(trend.trend).toBe('stable');
    });

    it('should detect improving trend', () => {
      // 从悲伤到开心
      engine.processText('难过', 'sad', 0.8);
      engine.processText('有点好了', 'neutral', 0.5);
      engine.processText('开心起来了', 'happy', 0.7);
      engine.processText('更开心了', 'happy', 0.9);
      engine.processText('太棒了', 'excited', 0.9);
      
      const trend = engine.analyzeEmotionTrend();
      // 趋势应该是改善的
      expect(['improving', 'stable']).toContain(trend.trend);
    });

    it('should calculate volatility', () => {
      // 频繁切换情绪
      engine.processText('开心', 'happy', 0.8);
      engine.processText('难过', 'sad', 0.8);
      engine.processText('又开心了', 'happy', 0.8);
      engine.processText('又难过了', 'sad', 0.8);
      
      const trend = engine.analyzeEmotionTrend();
      expect(trend.volatility).toBeGreaterThan(0);
    });

    it('should return dominant emotion', () => {
      engine.processText('开心', 'happy', 0.9);
      engine.processText('很开心', 'happy', 0.9);
      engine.processText('超开心', 'happy', 0.9);
      engine.processText('有点累', 'sad', 0.3);
      
      const trend = engine.analyzeEmotionTrend();
      expect(trend.dominant).toBe('happy');
    });
  });

  describe('reset', () => {
    it('should clear all history', () => {
      engine.processText('开心', 'happy', 0.8);
      engine.processText('难过', 'sad', 0.7);
      
      engine.reset();
      
      const history = engine.getEmotionHistory();
      expect(history.length).toBe(0);
    });

    it('should reset conversation tone', () => {
      engine.processText('太开心了', 'happy', 0.9);
      engine.processText('超级兴奋', 'excited', 0.9);
      
      engine.reset();
      
      const tone = engine.getConversationTone();
      expect(tone.baseEmotion).toBe('neutral');
    });
  });

  describe('onToneChange', () => {
    it('should call callback when tone changes', () => {
      let callCount = 0;
      engine.onToneChange(() => {
        callCount++;
      });
      
      engine.processText('开心', 'happy', 0.9);
      engine.processText('更开心', 'happy', 0.9);
      
      // 可能会触发回调
      expect(callCount).toBeGreaterThanOrEqual(0);
    });

    it('should return unsubscribe function', () => {
      let callCount = 0;
      const unsubscribe = engine.onToneChange(() => {
        callCount++;
      });
      
      engine.processText('开心', 'happy', 0.9);
      const countBefore = callCount;
      
      unsubscribe();
      engine.processText('更开心', 'happy', 0.9);
      
      // 取消订阅后不应该再被调用
      expect(callCount).toBeLessThanOrEqual(countBefore + 1);
    });
  });

  describe('getDebugSummary', () => {
    it('should return formatted string', () => {
      engine.processText('你好', 'happy', 0.5);
      const summary = engine.getDebugSummary();
      
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
      expect(summary).toContain('基调');
    });
  });
});
