/**
 * Emotion Detector - 从文本中检测情绪
 * 
 * 根据 AI 回复的文本内容，推断应该展示的表情
 * 简单的关键词匹配 + 情感分析
 */

import type { Expression } from './AvatarController';

// 情绪关键词映射
const EMOTION_KEYWORDS: Record<Expression, string[]> = {
  happy: [
    // 中文
    '哈哈', '嘻嘻', '开心', '高兴', '太棒了', '好耶', '真好', '喜欢', '爱',
    '棒', '赞', '厉害', '牛', '酷', '漂亮', '美', '可爱', '萌', '甜',
    '恭喜', '祝贺', '成功', '胜利', '完美', '精彩', '有趣', '好玩',
    '感谢', '谢谢', '❤️', '💕', '😊', '😄', '🎉', '✨',
    // English
    'happy', 'glad', 'great', 'awesome', 'wonderful', 'amazing',
    'love', 'like', 'cute', 'nice', 'good', 'excellent', 'perfect',
    'thanks', 'congratulations', 'yay', 'haha', 'lol',
  ],
  sad: [
    // 中文
    '难过', '伤心', '悲伤', '哭', '呜呜', '唉', '叹气', '遗憾',
    '抱歉', '对不起', '不好意思', '失败', '糟糕', '可惜', '失望',
    '孤独', '寂寞', '累', '疲惫', '辛苦', '痛苦', '😢', '😭', '💔',
    // English
    'sad', 'sorry', 'unfortunately', 'regret', 'disappointed',
    'lonely', 'tired', 'exhausted', 'failed', 'miss you',
  ],
  surprised: [
    // 中文
    '哇', '天啊', '什么', '真的吗', '不会吧', '居然', '竟然',
    '没想到', '意外', '惊讶', '震惊', '不敢相信', '好厉害',
    '？！', '！？', '😮', '😲', '🤯', '❗', '❓',
    // English
    'wow', 'omg', 'what', 'really', 'seriously', 'amazing',
    'incredible', 'unbelievable', 'surprising', 'shocked',
  ],
  neutral: [
    // 这些词保持中性表情
    '好的', '嗯', '是的', '明白', '了解', '知道了',
    'ok', 'okay', 'yes', 'sure', 'understood', 'i see',
  ],
};

// 情绪强度权重
const EMOTION_WEIGHTS: Record<Expression, number> = {
  happy: 1.0,
  sad: 1.2,      // 悲伤情绪权重略高，优先响应
  surprised: 1.5, // 惊讶情绪权重最高，容易触发
  neutral: 0.5,
};

export interface EmotionResult {
  emotion: Expression;
  confidence: number;
  keywords: string[];
}

/**
 * 检测文本中的情绪
 */
export function detectEmotion(text: string): EmotionResult {
  const lowerText = text.toLowerCase();
  const scores: Record<Expression, { score: number; keywords: string[] }> = {
    happy: { score: 0, keywords: [] },
    sad: { score: 0, keywords: [] },
    surprised: { score: 0, keywords: [] },
    neutral: { score: 0, keywords: [] },
  };

  // 遍历每种情绪的关键词
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      // 计算关键词出现次数
      let count = 0;
      let pos = 0;
      while ((pos = lowerText.indexOf(lowerKeyword, pos)) !== -1) {
        count++;
        pos += lowerKeyword.length;
      }
      
      if (count > 0) {
        const emotionKey = emotion as Expression;
        scores[emotionKey].score += count * EMOTION_WEIGHTS[emotionKey];
        if (!scores[emotionKey].keywords.includes(keyword)) {
          scores[emotionKey].keywords.push(keyword);
        }
      }
    }
  }

  // 找出得分最高的情绪
  let maxEmotion: Expression = 'neutral';
  let maxScore = 0;

  for (const [emotion, data] of Object.entries(scores)) {
    if (data.score > maxScore) {
      maxScore = data.score;
      maxEmotion = emotion as Expression;
    }
  }

  // 计算置信度 (0-1)
  const totalScore = Object.values(scores).reduce((sum, d) => sum + d.score, 0);
  const confidence = totalScore > 0 ? maxScore / totalScore : 0;

  // 如果没有明显情绪，返回 neutral
  if (maxScore < 0.5) {
    return {
      emotion: 'neutral',
      confidence: 1,
      keywords: [],
    };
  }

  return {
    emotion: maxEmotion,
    confidence: Math.min(1, confidence),
    keywords: scores[maxEmotion].keywords,
  };
}

/**
 * 分析一段流式文本，返回情绪变化序列
 * 用于长文本的分段情绪检测
 */
export function analyzeEmotionStream(text: string, chunkSize = 50): EmotionResult[] {
  const results: EmotionResult[] = [];
  
  // 按句子或固定长度分割
  const sentences = text.split(/[。！？\n.!?]/g).filter(s => s.trim());
  
  for (const sentence of sentences) {
    if (sentence.length > 0) {
      results.push(detectEmotion(sentence));
    }
  }
  
  // 如果句子太少，按字符分割
  if (results.length === 0 && text.length > 0) {
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize);
      results.push(detectEmotion(chunk));
    }
  }
  
  return results;
}

/**
 * 根据情绪结果获取建议的表情持续时间 (ms)
 */
export function getEmotionDuration(result: EmotionResult): number {
  const baseDuration = 3000;
  
  // 根据情绪类型调整
  const multiplier: Record<Expression, number> = {
    happy: 1.2,
    sad: 1.5,
    surprised: 0.8, // 惊讶表情持续较短
    neutral: 1.0,
  };
  
  return baseDuration * multiplier[result.emotion] * result.confidence;
}
