/**
 * EmotionPredictionModel - 情绪预测模型
 * 
 * 基于多维度特征预测下一个情绪状态：
 * - 文本情感分析
 * - 对话上下文
 * - 时间模式
 * - 用户偏好
 * - 情绪惯性
 */

export type EmotionLabel = 
  | 'neutral' | 'happy' | 'sad' | 'angry'
  | 'surprised' | 'fear' | 'disgust' | 'contempt'
  | 'excited' | 'calm' | 'confused' | 'thinking'
  | 'shy' | 'proud' | 'grateful' | 'hopeful';

export interface EmotionPrediction {
  emotion: EmotionLabel;
  confidence: number;        // 0-1
  alternatives: Array<{
    emotion: EmotionLabel;
    confidence: number;
  }>;
  reasoning: string[];       // 预测依据
}

export interface TextFeatures {
  sentiment: number;         // -1 到 1
  arousal: number;           // 0 到 1 (激活程度)
  dominance: number;         // 0 到 1 (控制感)
  hasQuestion: boolean;
  hasExclamation: boolean;
  wordCount: number;
  emotionWords: string[];
}

export interface ContextFeatures {
  previousEmotions: EmotionLabel[];
  turnIndex: number;
  conversationPhase: string;
  topicCategory: string;
  userEngagement: number;
}

export interface PredictionConfig {
  textWeight: number;        // 文本特征权重
  contextWeight: number;     // 上下文权重
  inertiaWeight: number;     // 惯性权重
  minConfidence: number;     // 最小置信度阈值
  topK: number;              // 返回前 K 个候选
}

// 情绪词典
const EMOTION_LEXICON: Record<EmotionLabel, string[]> = {
  neutral: ['好的', '嗯', '明白', '知道了', '行'],
  happy: ['开心', '高兴', '快乐', '太好了', '哈哈', '嘿嘿', '棒', '赞', '爱', '喜欢', '感谢', '谢谢'],
  sad: ['难过', '伤心', '失望', '遗憾', '可惜', '唉', '呜', '委屈', '心痛'],
  angry: ['生气', '愤怒', '烦', '讨厌', '恨', '气死', '可恶', '混蛋', '操'],
  surprised: ['哇', '天啊', '真的吗', '不会吧', '没想到', '居然', '震惊', '惊讶'],
  fear: ['害怕', '恐惧', '担心', '紧张', '不敢', '可怕', '吓人'],
  disgust: ['恶心', '讨厌', '烦', '无语', '服了', '醉了'],
  contempt: ['切', '呵呵', '鄙视', '懒得', '无所谓'],
  excited: ['太棒了', '激动', '期待', '迫不及待', '超级', '特别'],
  calm: ['平静', '放松', '安心', '舒服', '自在', '淡定'],
  confused: ['困惑', '不懂', '什么意思', '搞不懂', '糊涂', '迷惑'],
  thinking: ['想想', '让我想想', '思考', '考虑', '斟酌', '琢磨'],
  shy: ['害羞', '不好意思', '脸红', '羞涩', '腼腆'],
  proud: ['骄傲', '自豪', '厉害', '了不起', '成就'],
  grateful: ['感谢', '谢谢', '感激', '多亏', '幸亏'],
  hopeful: ['希望', '期望', '期待', '盼望', '愿意']
};

// 情绪转移概率（简化的马尔可夫转移矩阵）
const EMOTION_TRANSITIONS: Partial<Record<EmotionLabel, Partial<Record<EmotionLabel, number>>>> = {
  neutral: { happy: 0.3, neutral: 0.4, thinking: 0.1, calm: 0.2 },
  happy: { happy: 0.5, excited: 0.2, neutral: 0.2, grateful: 0.1 },
  sad: { sad: 0.4, neutral: 0.3, calm: 0.2, hopeful: 0.1 },
  angry: { angry: 0.4, neutral: 0.3, calm: 0.2, sad: 0.1 },
  surprised: { surprised: 0.2, happy: 0.3, confused: 0.2, excited: 0.2, neutral: 0.1 },
  excited: { excited: 0.4, happy: 0.4, neutral: 0.2 },
  calm: { calm: 0.5, neutral: 0.3, happy: 0.2 },
  thinking: { thinking: 0.3, neutral: 0.3, confused: 0.2, calm: 0.2 },
  confused: { confused: 0.3, thinking: 0.3, surprised: 0.2, neutral: 0.2 }
};

// 文本情感映射
const SENTIMENT_EMOTION_MAP: Array<{ range: [number, number]; emotions: EmotionLabel[] }> = [
  { range: [-1, -0.6], emotions: ['angry', 'sad', 'fear', 'disgust'] },
  { range: [-0.6, -0.2], emotions: ['sad', 'confused', 'disappointed'] },
  { range: [-0.2, 0.2], emotions: ['neutral', 'calm', 'thinking'] },
  { range: [0.2, 0.6], emotions: ['happy', 'hopeful', 'grateful'] },
  { range: [0.6, 1], emotions: ['happy', 'excited', 'proud'] }
];

type PredictionCallback = (prediction: EmotionPrediction) => void;

export class EmotionPredictionModel {
  private config: PredictionConfig;
  private emotionHistory: EmotionLabel[] = [];
  private textHistory: string[] = [];
  private callbacks: Set<PredictionCallback> = new Set();

  constructor(config?: Partial<PredictionConfig>) {
    this.config = {
      textWeight: 0.5,
      contextWeight: 0.3,
      inertiaWeight: 0.2,
      minConfidence: 0.3,
      topK: 3,
      ...config
    };
  }

  /**
   * 预测情绪
   */
  predict(text: string, context?: Partial<ContextFeatures>): EmotionPrediction {
    // 提取文本特征
    const textFeatures = this.extractTextFeatures(text);
    
    // 构建上下文特征
    const contextFeatures: ContextFeatures = {
      previousEmotions: this.emotionHistory.slice(-5),
      turnIndex: this.textHistory.length,
      conversationPhase: context?.conversationPhase || 'main',
      topicCategory: context?.topicCategory || 'casual',
      userEngagement: context?.userEngagement ?? 0.7
    };
    
    // 计算各情绪的得分
    const scores = this.calculateScores(textFeatures, contextFeatures);
    
    // 排序并生成预测
    const sorted = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.topK);
    
    const totalScore = sorted.reduce((sum, [_, score]) => sum + score, 0);
    
    const prediction: EmotionPrediction = {
      emotion: sorted[0][0] as EmotionLabel,
      confidence: totalScore > 0 ? sorted[0][1] / totalScore : 0,
      alternatives: sorted.slice(1).map(([emotion, score]) => ({
        emotion: emotion as EmotionLabel,
        confidence: totalScore > 0 ? score / totalScore : 0
      })),
      reasoning: this.generateReasoning(textFeatures, contextFeatures, sorted[0][0] as EmotionLabel)
    };
    
    // 更新历史
    this.textHistory.push(text);
    this.emotionHistory.push(prediction.emotion);
    
    // 限制历史长度
    if (this.textHistory.length > 20) this.textHistory.shift();
    if (this.emotionHistory.length > 20) this.emotionHistory.shift();
    
    this.notifyCallbacks(prediction);
    
    return prediction;
  }

  /**
   * 批量预测
   */
  predictBatch(texts: string[]): EmotionPrediction[] {
    return texts.map(text => this.predict(text));
  }

  /**
   * 仅分析文本情感（不更新历史）
   */
  analyzeText(text: string): TextFeatures {
    return this.extractTextFeatures(text);
  }

  /**
   * 获取情绪转移概率
   */
  getTransitionProbability(from: EmotionLabel, to: EmotionLabel): number {
    if (from === to) return 0.5;
    return EMOTION_TRANSITIONS[from]?.[to] ?? 0.1;
  }

  /**
   * 手动更新情绪历史（用于校准）
   */
  updateHistory(emotion: EmotionLabel): void {
    this.emotionHistory.push(emotion);
    if (this.emotionHistory.length > 20) this.emotionHistory.shift();
  }

  /**
   * 获取情绪历史
   */
  getHistory(): EmotionLabel[] {
    return [...this.emotionHistory];
  }

  /**
   * 获取情绪趋势
   */
  getEmotionTrend(): { dominant: EmotionLabel; stability: number } {
    if (this.emotionHistory.length === 0) {
      return { dominant: 'neutral', stability: 1 };
    }
    
    // 计算情绪频率
    const counts: Partial<Record<EmotionLabel, number>> = {};
    for (const emotion of this.emotionHistory) {
      counts[emotion] = (counts[emotion] || 0) + 1;
    }
    
    // 找出主导情绪
    let dominant: EmotionLabel = 'neutral';
    let maxCount = 0;
    for (const [emotion, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = emotion as EmotionLabel;
      }
    }
    
    // 计算稳定性（主导情绪占比）
    const stability = maxCount / this.emotionHistory.length;
    
    return { dominant, stability };
  }

  /**
   * 订阅预测结果
   */
  onPrediction(callback: PredictionCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 重置
   */
  reset(): void {
    this.emotionHistory = [];
    this.textHistory = [];
  }

  /**
   * 获取配置
   */
  getConfig(): PredictionConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<PredictionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取可用情绪列表
   */
  static getAvailableEmotions(): EmotionLabel[] {
    return Object.keys(EMOTION_LEXICON) as EmotionLabel[];
  }

  /**
   * 获取情绪词汇
   */
  static getEmotionKeywords(emotion: EmotionLabel): string[] {
    return [...(EMOTION_LEXICON[emotion] || [])];
  }

  private extractTextFeatures(text: string): TextFeatures {
    const lower = text.toLowerCase();
    
    // 检测情绪词汇
    const emotionWords: string[] = [];
    let sentimentSum = 0;
    let emotionCount = 0;
    
    for (const [emotion, keywords] of Object.entries(EMOTION_LEXICON)) {
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          emotionWords.push(keyword);
          // 计算情感值
          const emotionSentiment = this.getEmotionSentiment(emotion as EmotionLabel);
          sentimentSum += emotionSentiment;
          emotionCount++;
        }
      }
    }
    
    const sentiment = emotionCount > 0 ? sentimentSum / emotionCount : 0;
    
    // 计算激活程度（基于标点和词汇）
    const exclamCount = (text.match(/[!！]/g) || []).length;
    const questionCount = (text.match(/[?？]/g) || []).length;
    const arousal = Math.min(1, (exclamCount * 0.2 + questionCount * 0.1 + emotionWords.length * 0.1));
    
    return {
      sentiment,
      arousal,
      dominance: 0.5 + sentiment * 0.3,  // 简化计算
      hasQuestion: questionCount > 0,
      hasExclamation: exclamCount > 0,
      wordCount: text.length,
      emotionWords
    };
  }

  private getEmotionSentiment(emotion: EmotionLabel): number {
    const sentimentMap: Record<EmotionLabel, number> = {
      neutral: 0,
      happy: 0.7,
      sad: -0.6,
      angry: -0.8,
      surprised: 0.2,
      fear: -0.5,
      disgust: -0.7,
      contempt: -0.4,
      excited: 0.8,
      calm: 0.3,
      confused: -0.1,
      thinking: 0,
      shy: 0.1,
      proud: 0.6,
      grateful: 0.7,
      hopeful: 0.5
    };
    return sentimentMap[emotion] ?? 0;
  }

  private calculateScores(
    textFeatures: TextFeatures, 
    contextFeatures: ContextFeatures
  ): Record<EmotionLabel, number> {
    const scores: Record<EmotionLabel, number> = {} as Record<EmotionLabel, number>;
    const emotions = EmotionPredictionModel.getAvailableEmotions();
    
    for (const emotion of emotions) {
      let score = 0;
      
      // 1. 文本特征得分
      const textScore = this.calculateTextScore(emotion, textFeatures);
      score += textScore * this.config.textWeight;
      
      // 2. 上下文得分
      const contextScore = this.calculateContextScore(emotion, contextFeatures);
      score += contextScore * this.config.contextWeight;
      
      // 3. 惯性得分
      const inertiaScore = this.calculateInertiaScore(emotion, contextFeatures.previousEmotions);
      score += inertiaScore * this.config.inertiaWeight;
      
      scores[emotion] = Math.max(0, score);
    }
    
    return scores;
  }

  private calculateTextScore(emotion: EmotionLabel, features: TextFeatures): number {
    let score = 0;
    
    // 检查是否有该情绪的关键词
    const keywords = EMOTION_LEXICON[emotion] || [];
    for (const word of features.emotionWords) {
      if (keywords.includes(word)) {
        score += 0.3;
      }
    }
    
    // 基于情感值匹配
    const emotionSentiment = this.getEmotionSentiment(emotion);
    const sentimentDiff = Math.abs(features.sentiment - emotionSentiment);
    score += Math.max(0, 1 - sentimentDiff) * 0.3;
    
    // 激活程度匹配
    const highArousalEmotions: EmotionLabel[] = ['excited', 'angry', 'surprised', 'fear'];
    const lowArousalEmotions: EmotionLabel[] = ['calm', 'sad', 'neutral', 'thinking'];
    
    if (features.arousal > 0.5 && highArousalEmotions.includes(emotion)) {
      score += 0.2;
    } else if (features.arousal < 0.5 && lowArousalEmotions.includes(emotion)) {
      score += 0.2;
    }
    
    // 问号倾向于困惑/思考
    if (features.hasQuestion && (emotion === 'confused' || emotion === 'thinking')) {
      score += 0.2;
    }
    
    return score;
  }

  private calculateContextScore(emotion: EmotionLabel, context: ContextFeatures): number {
    let score = 0;
    
    // 对话阶段影响
    if (context.conversationPhase === 'greeting' && emotion === 'happy') {
      score += 0.3;
    } else if (context.conversationPhase === 'farewell' && (emotion === 'calm' || emotion === 'grateful')) {
      score += 0.3;
    }
    
    // 话题类别影响
    if (context.topicCategory === 'emotion') {
      // 情感话题更可能有强烈情绪
      if (['happy', 'sad', 'angry', 'fear'].includes(emotion)) {
        score += 0.2;
      }
    } else if (context.topicCategory === 'task') {
      // 任务话题更可能是中性/思考
      if (['neutral', 'thinking', 'calm'].includes(emotion)) {
        score += 0.2;
      }
    }
    
    // 用户参与度影响
    if (context.userEngagement > 0.7 && ['happy', 'excited', 'grateful'].includes(emotion)) {
      score += 0.1;
    }
    
    return score;
  }

  private calculateInertiaScore(emotion: EmotionLabel, previousEmotions: EmotionLabel[]): number {
    if (previousEmotions.length === 0) return 0.5;
    
    const lastEmotion = previousEmotions[previousEmotions.length - 1];
    
    // 转移概率
    const transitionProb = this.getTransitionProbability(lastEmotion, emotion);
    
    // 历史频率
    const frequency = previousEmotions.filter(e => e === emotion).length / previousEmotions.length;
    
    return transitionProb * 0.6 + frequency * 0.4;
  }

  private generateReasoning(
    textFeatures: TextFeatures, 
    context: ContextFeatures, 
    predicted: EmotionLabel
  ): string[] {
    const reasons: string[] = [];
    
    if (textFeatures.emotionWords.length > 0) {
      reasons.push(`检测到情绪词汇: ${textFeatures.emotionWords.slice(0, 3).join(', ')}`);
    }
    
    if (textFeatures.sentiment > 0.3) {
      reasons.push('文本情感偏积极');
    } else if (textFeatures.sentiment < -0.3) {
      reasons.push('文本情感偏消极');
    }
    
    if (textFeatures.hasExclamation) {
      reasons.push('包含感叹号，情感较强烈');
    }
    
    if (textFeatures.hasQuestion) {
      reasons.push('包含疑问，可能有困惑或好奇');
    }
    
    if (context.previousEmotions.length > 0) {
      const lastEmotion = context.previousEmotions[context.previousEmotions.length - 1];
      reasons.push(`前一情绪为 ${lastEmotion}，转移概率影响`);
    }
    
    reasons.push(`对话阶段: ${context.conversationPhase}`);
    
    return reasons;
  }

  private notifyCallbacks(prediction: EmotionPrediction): void {
    for (const callback of this.callbacks) {
      try {
        callback(prediction);
      } catch (e) {
        console.error('[EmotionPrediction] Callback error:', e);
      }
    }
  }
}
