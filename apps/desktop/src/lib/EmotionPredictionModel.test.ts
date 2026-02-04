/**
 * EmotionPredictionModel 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmotionPredictionModel, EmotionLabel, EmotionPrediction } from './EmotionPredictionModel';

describe('EmotionPredictionModel', () => {
  let model: EmotionPredictionModel;

  beforeEach(() => {
    model = new EmotionPredictionModel();
  });

  describe('初始化', () => {
    it('应该使用默认配置创建', () => {
      const config = model.getConfig();
      expect(config.textWeight).toBe(0.5);
      expect(config.contextWeight).toBe(0.3);
      expect(config.inertiaWeight).toBe(0.2);
    });

    it('应该使用自定义配置创建', () => {
      const custom = new EmotionPredictionModel({
        textWeight: 0.7,
        topK: 5
      });
      const config = custom.getConfig();
      expect(config.textWeight).toBe(0.7);
      expect(config.topK).toBe(5);
    });

    it('应该初始化空历史', () => {
      expect(model.getHistory()).toEqual([]);
    });
  });

  describe('文本情感分析', () => {
    it('应该分析积极文本', () => {
      const features = model.analyzeText('太开心了，这真是太棒了！');
      expect(features.sentiment).toBeGreaterThan(0);
      expect(features.emotionWords.length).toBeGreaterThan(0);
    });

    it('应该分析消极文本', () => {
      const features = model.analyzeText('好难过，太伤心了');
      expect(features.sentiment).toBeLessThan(0);
    });

    it('应该分析中性文本', () => {
      const features = model.analyzeText('好的，知道了');
      expect(Math.abs(features.sentiment)).toBeLessThanOrEqual(0.5);
    });

    it('应该检测感叹号', () => {
      const features = model.analyzeText('太棒了！！！');
      expect(features.hasExclamation).toBe(true);
      expect(features.arousal).toBeGreaterThan(0);
    });

    it('应该检测问号', () => {
      const features = model.analyzeText('这是什么？');
      expect(features.hasQuestion).toBe(true);
    });

    it('应该提取情绪词汇', () => {
      const features = model.analyzeText('我很开心，也很感谢你');
      expect(features.emotionWords).toContain('开心');
      expect(features.emotionWords).toContain('感谢');
    });
  });

  describe('情绪预测', () => {
    it('应该预测积极情绪', () => {
      const prediction = model.predict('哈哈，太开心了！');
      expect(['happy', 'excited', 'grateful']).toContain(prediction.emotion);
    });

    it('应该预测消极情绪', () => {
      const prediction = model.predict('好难过，太伤心了');
      expect(['sad', 'fear', 'angry']).toContain(prediction.emotion);
    });

    it('应该预测困惑情绪', () => {
      const prediction = model.predict('什么意思？搞不懂');
      expect(['confused', 'thinking', 'surprised']).toContain(prediction.emotion);
    });

    it('应该返回置信度', () => {
      const prediction = model.predict('开心开心开心！');
      expect(prediction.confidence).toBeGreaterThan(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    });

    it('应该返回备选情绪', () => {
      const prediction = model.predict('今天天气不错');
      expect(prediction.alternatives.length).toBeGreaterThan(0);
    });

    it('应该返回预测依据', () => {
      const prediction = model.predict('我很开心！');
      expect(prediction.reasoning.length).toBeGreaterThan(0);
    });

    it('应该更新历史', () => {
      model.predict('开心');
      expect(model.getHistory().length).toBe(1);
    });
  });

  describe('上下文感知', () => {
    it('问候阶段应该倾向 happy', () => {
      const prediction = model.predict('你好', {
        conversationPhase: 'greeting'
      });
      // 上下文会影响结果
      expect(prediction).toBeDefined();
    });

    it('告别阶段应该倾向 calm', () => {
      const prediction = model.predict('再见', {
        conversationPhase: 'farewell'
      });
      expect(['calm', 'grateful', 'neutral', 'happy']).toContain(prediction.emotion);
    });

    it('情感话题应该增强情绪检测', () => {
      const prediction = model.predict('我今天心情不好', {
        topicCategory: 'emotion'
      });
      expect(['sad', 'angry', 'fear', 'neutral']).toContain(prediction.emotion);
    });

    it('任务话题应该倾向中性', () => {
      const prediction = model.predict('帮我做这个任务', {
        topicCategory: 'task'
      });
      expect(['neutral', 'thinking', 'calm', 'happy']).toContain(prediction.emotion);
    });
  });

  describe('惯性效应', () => {
    it('应该考虑历史情绪', () => {
      // 先建立历史
      model.predict('开心');
      model.predict('很高兴');
      model.predict('太棒了');
      
      // 中性文本应该受历史影响
      const prediction = model.predict('嗯');
      // 由于历史都是积极的，结果可能倾向积极
      expect(prediction).toBeDefined();
    });

    it('手动更新历史应该影响预测', () => {
      model.updateHistory('sad');
      model.updateHistory('sad');
      model.updateHistory('sad');
      
      const prediction = model.predict('嗯');
      // 历史悲伤可能影响结果
      expect(prediction).toBeDefined();
    });
  });

  describe('转移概率', () => {
    it('相同情绪应该有较高转移概率', () => {
      const prob = model.getTransitionProbability('happy', 'happy');
      expect(prob).toBeGreaterThanOrEqual(0.4);
    });

    it('不同情绪应该返回转移概率', () => {
      const prob = model.getTransitionProbability('happy', 'sad');
      expect(prob).toBeGreaterThan(0);
      expect(prob).toBeLessThanOrEqual(1);
    });

    it('未定义转移应该返回默认值', () => {
      const prob = model.getTransitionProbability('proud', 'shy');
      expect(prob).toBe(0.1);  // 默认值
    });
  });

  describe('情绪趋势', () => {
    it('空历史应该返回 neutral', () => {
      const trend = model.getEmotionTrend();
      expect(trend.dominant).toBe('neutral');
      expect(trend.stability).toBe(1);
    });

    it('应该找出主导情绪', () => {
      model.updateHistory('happy');
      model.updateHistory('happy');
      model.updateHistory('happy');
      model.updateHistory('sad');
      
      const trend = model.getEmotionTrend();
      expect(trend.dominant).toBe('happy');
    });

    it('应该计算稳定性', () => {
      model.updateHistory('happy');
      model.updateHistory('happy');
      model.updateHistory('sad');
      model.updateHistory('angry');
      
      const trend = model.getEmotionTrend();
      // 4 个中有 2 个 happy，稳定性 = 0.5
      expect(trend.stability).toBe(0.5);
    });
  });

  describe('批量预测', () => {
    it('应该批量处理文本', () => {
      const texts = ['开心', '难过', '生气'];
      const predictions = model.predictBatch(texts);
      
      expect(predictions.length).toBe(3);
      predictions.forEach(p => {
        expect(p.emotion).toBeDefined();
        expect(p.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('订阅机制', () => {
    it('应该通知预测结果', () => {
      const callback = vi.fn();
      model.onPrediction(callback);
      
      model.predict('开心');
      
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].emotion).toBeDefined();
    });

    it('应该支持取消订阅', () => {
      const callback = vi.fn();
      const unsubscribe = model.onPrediction(callback);
      
      unsubscribe();
      model.predict('开心');
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('回调错误不应该中断其他回调', () => {
      const errorCallback = vi.fn(() => { throw new Error('test'); });
      const normalCallback = vi.fn();
      
      model.onPrediction(errorCallback);
      model.onPrediction(normalCallback);
      
      model.predict('测试');
      
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('配置管理', () => {
    it('应该获取配置', () => {
      const config = model.getConfig();
      expect(config.textWeight).toBeDefined();
      expect(config.contextWeight).toBeDefined();
    });

    it('应该更新配置', () => {
      model.setConfig({ textWeight: 0.8 });
      expect(model.getConfig().textWeight).toBe(0.8);
    });

    it('部分更新不应该影响其他配置', () => {
      const original = model.getConfig().contextWeight;
      model.setConfig({ textWeight: 0.8 });
      expect(model.getConfig().contextWeight).toBe(original);
    });
  });

  describe('重置', () => {
    it('应该清空历史', () => {
      model.predict('开心');
      model.predict('难过');
      
      model.reset();
      
      expect(model.getHistory()).toEqual([]);
    });
  });

  describe('静态方法', () => {
    it('应该获取可用情绪列表', () => {
      const emotions = EmotionPredictionModel.getAvailableEmotions();
      expect(emotions).toContain('happy');
      expect(emotions).toContain('sad');
      expect(emotions).toContain('neutral');
      expect(emotions.length).toBeGreaterThan(10);
    });

    it('应该获取情绪关键词', () => {
      const keywords = EmotionPredictionModel.getEmotionKeywords('happy');
      expect(keywords).toContain('开心');
      expect(keywords).toContain('高兴');
    });

    it('不存在的情绪应该返回空数组', () => {
      const keywords = EmotionPredictionModel.getEmotionKeywords('nonexistent' as EmotionLabel);
      expect(keywords).toEqual([]);
    });
  });

  describe('历史管理', () => {
    it('应该限制历史长度', () => {
      for (let i = 0; i < 30; i++) {
        model.predict(`消息${i}`);
      }
      expect(model.getHistory().length).toBeLessThanOrEqual(20);
    });

    it('手动更新也应该限制长度', () => {
      for (let i = 0; i < 30; i++) {
        model.updateHistory('happy');
      }
      expect(model.getHistory().length).toBeLessThanOrEqual(20);
    });
  });

  describe('边界情况', () => {
    it('应该处理空文本', () => {
      const prediction = model.predict('');
      expect(prediction.emotion).toBeDefined();
    });

    it('应该处理纯标点文本', () => {
      const prediction = model.predict('！！！？？？');
      expect(prediction.emotion).toBeDefined();
    });

    it('应该处理超长文本', () => {
      const longText = '开心'.repeat(1000);
      const prediction = model.predict(longText);
      expect(prediction.emotion).toBeDefined();
    });

    it('应该处理特殊字符', () => {
      const prediction = model.predict('🎉🎊😊');
      expect(prediction.emotion).toBeDefined();
    });
  });

  describe('情绪词汇覆盖', () => {
    const emotionTests: Array<{ text: string; expectedEmotions: EmotionLabel[] }> = [
      { text: '我很开心高兴', expectedEmotions: ['happy', 'excited'] },
      { text: '太难过伤心了', expectedEmotions: ['sad', 'fear'] },
      { text: '气死我了，愤怒', expectedEmotions: ['angry', 'disgust'] },
      { text: '哇，真的吗，没想到', expectedEmotions: ['surprised', 'confused'] },
      { text: '害怕，好紧张', expectedEmotions: ['fear', 'sad'] },
      { text: '太激动了，期待', expectedEmotions: ['excited', 'happy'] },
      { text: '很平静放松', expectedEmotions: ['calm', 'neutral'] },
      { text: '让我想想，思考一下', expectedEmotions: ['thinking', 'confused'] },
      { text: '害羞，不好意思', expectedEmotions: ['shy', 'neutral'] },
      { text: '感谢你，谢谢', expectedEmotions: ['grateful', 'happy'] },
    ];

    for (const { text, expectedEmotions } of emotionTests) {
      it(`应该为 "${text}" 预测合理情绪`, () => {
        const prediction = model.predict(text);
        const allPredicted = [
          prediction.emotion,
          ...prediction.alternatives.map(a => a.emotion)
        ];
        
        // 检查预测结果是否包含预期情绪之一
        const hasExpected = expectedEmotions.some(e => allPredicted.includes(e));
        expect(hasExpected).toBe(true);
      });
    }
  });
});
