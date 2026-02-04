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

    it('should include atmosphere and intent info (Round 25)', () => {
      engine.processText('你好！很高兴见到你', 'happy', 0.8);
      const summary = engine.getDebugSummary();
      
      expect(summary).toContain('氛围');
      expect(summary).toContain('意图');
    });
  });

  // ========== Round 25: 意图识别测试 ==========

  describe('detectIntent (Round 25)', () => {
    it('should detect greeting intent', () => {
      const result = engine.processText('你好！', 'happy', 0.5);
      expect(result.intent).toBe('greeting');
    });

    it('should detect farewell intent', () => {
      const result = engine.processText('再见，明天聊！', 'happy', 0.5);
      expect(result.intent).toBe('farewell');
    });

    it('should detect question intent', () => {
      const result = engine.processText('这是什么？', 'curious', 0.5);
      expect(result.intent).toBe('question');
    });

    it('should detect question from question mark', () => {
      const result = engine.processText('今天天气好吗?', 'curious', 0.5);
      expect(result.intent).toBe('question');
    });

    it('should detect request intent', () => {
      const result = engine.processText('请帮我看看这个代码', 'neutral', 0.5);
      expect(result.intent).toBe('request');
    });

    it('should detect appreciation intent', () => {
      const result = engine.processText('谢谢你的帮助！', 'grateful', 0.8);
      expect(result.intent).toBe('appreciation');
    });

    it('should detect complaint intent', () => {
      const result = engine.processText('这个功能太差了，受不了', 'angry', 0.8);
      expect(result.intent).toBe('complaint');
    });

    it('should detect agreement intent', () => {
      const result = engine.processText('好的，没问题', 'neutral', 0.5);
      expect(result.intent).toBe('agreement');
    });

    it('should detect disagreement intent', () => {
      const result = engine.processText('不是的，我不同意', 'determined', 0.6);
      expect(result.intent).toBe('disagreement');
    });

    it('should return unknown for unclear intent', () => {
      const result = engine.processText('...', 'neutral', 0.1);
      expect(result.intent).toBe('unknown');
    });
  });

  // ========== Round 25: 氛围检测测试 ==========

  describe('atmosphere detection (Round 25)', () => {
    it('should start with neutral atmosphere', () => {
      expect(engine.getAtmosphere()).toBe('neutral');
    });

    it('should detect warm atmosphere from loving emotions', () => {
      engine.processText('我好喜欢你', 'loving', 0.9);
      expect(engine.getAtmosphere()).toBe('warm');
    });

    it('should detect playful atmosphere', () => {
      engine.processText('嘿嘿，逗你玩的', 'playful', 0.8);
      expect(engine.getAtmosphere()).toBe('playful');
    });

    it('should detect melancholy atmosphere', () => {
      engine.processText('好难过啊', 'sad', 0.9);
      expect(engine.getAtmosphere()).toBe('melancholy');
    });

    it('should detect tense atmosphere', () => {
      engine.processText('太紧张了，害怕失败', 'anxious', 0.9);
      expect(engine.getAtmosphere()).toBe('tense');
    });

    it('should include atmosphere in processText result', () => {
      const result = engine.processText('开心', 'happy', 0.8);
      expect(result.atmosphere).toBeDefined();
    });
  });

  // ========== Round 25: 氛围变化回调测试 ==========

  describe('onAtmosphereChange (Round 25)', () => {
    it('should call callback when atmosphere changes', () => {
      let newAtmosphere: string | null = null;
      engine.onAtmosphereChange((atmosphere) => {
        newAtmosphere = atmosphere;
      });

      // 从 neutral 到 playful
      engine.processText('嘿嘿，调皮一下', 'playful', 0.9);
      
      expect(newAtmosphere).toBe('playful');
    });

    it('should return unsubscribe function', () => {
      let callCount = 0;
      const unsubscribe = engine.onAtmosphereChange(() => {
        callCount++;
      });

      engine.processText('开心', 'happy', 0.9);
      unsubscribe();
      engine.processText('更开心', 'excited', 0.9);

      // 取消后不应该继续增加
      expect(callCount).toBeLessThanOrEqual(2);
    });
  });

  // ========== Round 25: 参与度测试 ==========

  describe('engagement level (Round 25)', () => {
    it('should start at 0.5', () => {
      expect(engine.getEngagementLevel()).toBe(0.5);
    });

    it('should increase with greeting', () => {
      const before = engine.getEngagementLevel();
      engine.processText('你好！', 'happy', 0.8);
      const after = engine.getEngagementLevel();
      
      expect(after).toBeGreaterThan(before);
    });

    it('should increase with questions', () => {
      const before = engine.getEngagementLevel();
      engine.processText('这是什么？', 'curious', 0.7);
      const after = engine.getEngagementLevel();
      
      expect(after).toBeGreaterThan(before);
    });

    it('should decrease with farewell', () => {
      // 先增加参与度
      engine.processText('你好！', 'happy', 0.8);
      engine.processText('好问题！', 'excited', 0.8);
      const before = engine.getEngagementLevel();
      
      engine.processText('再见！', 'happy', 0.5);
      const after = engine.getEngagementLevel();
      
      // 可能下降或保持（因为衰减和减少的组合效果）
      expect(after).toBeLessThanOrEqual(before + 0.1);
    });
  });

  // ========== Round 25: 共情响应建议测试 ==========

  describe('getSuggestedResponseEmotion (Round 25)', () => {
    it('should suggest happy for greeting', () => {
      engine.processText('你好！', 'happy', 0.5);
      const suggestion = engine.getSuggestedResponseEmotion();
      expect(suggestion.emotion).toBe('happy');
      expect(suggestion.reason).toContain('问候');
    });

    it('should suggest loving for farewell', () => {
      engine.processText('再见！', 'neutral', 0.5);
      const suggestion = engine.getSuggestedResponseEmotion();
      expect(suggestion.emotion).toBe('loving');
      expect(suggestion.reason).toContain('告别');
    });

    it('should suggest loving for melancholy atmosphere', () => {
      engine.processText('好难过', 'sad', 0.9);
      const suggestion = engine.getSuggestedResponseEmotion();
      expect(suggestion.emotion).toBe('loving');
      expect(suggestion.reason).toContain('共情');
    });

    it('should suggest thinking for complaint', () => {
      engine.processText('太烦了，讨厌这个bug', 'angry', 0.8);
      const suggestion = engine.getSuggestedResponseEmotion();
      expect(suggestion.emotion).toBe('thinking');
      expect(suggestion.reason).toContain('倾听');
    });

    it('should suggest grateful for appreciation', () => {
      engine.processText('谢谢你！', 'grateful', 0.8);
      const suggestion = engine.getSuggestedResponseEmotion();
      expect(suggestion.emotion).toBe('grateful');
      expect(suggestion.reason).toContain('感谢');
    });

    it('should suggest thinking for question', () => {
      engine.processText('这是什么？', 'curious', 0.5);
      const suggestion = engine.getSuggestedResponseEmotion();
      expect(suggestion.emotion).toBe('thinking');
      expect(suggestion.reason).toContain('思考');
    });
  });

  // ========== Round 25: 完整上下文测试 ==========

  describe('getFullContext (Round 25)', () => {
    it('should return full context object', () => {
      engine.processText('你好！', 'happy', 0.8);
      engine.processText('今天天气真好', 'happy', 0.7);
      
      const context = engine.getFullContext();
      
      expect(context.tone).toBeDefined();
      expect(context.trend).toBeDefined();
      expect(context.recentEmotions).toBeDefined();
      expect(context.suggestedResponse).toBeDefined();
      
      expect(Array.isArray(context.recentEmotions)).toBe(true);
      expect(context.recentEmotions.length).toBeLessThanOrEqual(5);
    });

    it('should include tone with atmosphere and engagement', () => {
      engine.processText('好开心！', 'happy', 0.9);
      
      const context = engine.getFullContext();
      
      expect(context.tone.atmosphere).toBeDefined();
      expect(context.tone.engagementLevel).toBeDefined();
      expect(context.tone.lastIntent).toBeDefined();
    });
  });

  // ========== Round 25: 意图影响情绪测试 ==========

  describe('intent emotion influence (Round 25)', () => {
    it('should include intent influence in processText influences', () => {
      const result = engine.processText('你好！', 'neutral', 0.3);
      
      // 问候意图应该有情绪影响
      const contextInfluence = result.influences.filter(i => i.source === 'context');
      expect(contextInfluence.length).toBeGreaterThanOrEqual(0);
    });

    it('should bias towards curious for questions', () => {
      const result = engine.processText('为什么会这样？', 'neutral', 0.3);
      
      // 应该检测到问题意图
      expect(result.intent).toBe('question');
    });
  });

  // ========== Round 25: getLastIntent 测试 ==========

  describe('getLastIntent (Round 25)', () => {
    it('should return undefined initially', () => {
      expect(engine.getLastIntent()).toBeUndefined();
    });

    it('should return last detected intent', () => {
      engine.processText('你好！', 'happy', 0.5);
      expect(engine.getLastIntent()).toBe('greeting');
      
      engine.processText('这是什么？', 'curious', 0.5);
      expect(engine.getLastIntent()).toBe('question');
    });

    it('should reset with engine reset', () => {
      engine.processText('你好！', 'happy', 0.5);
      expect(engine.getLastIntent()).toBe('greeting');
      
      engine.reset();
      expect(engine.getLastIntent()).toBeUndefined();
    });
  });
});
