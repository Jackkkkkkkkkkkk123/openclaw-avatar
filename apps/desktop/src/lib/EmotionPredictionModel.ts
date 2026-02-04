/**
 * EmotionPredictionModel - 情绪预测模型
 * 
 * 基于多维度特征预测下一个情绪状态：
 * - 文本情感分析 (通过真实 LLM)
 * - 对话上下文
 * - 时间模式
 * - 用户偏好
 * - 情绪惯性
 * 
 * v2.0: 接入 OpenClaw LLM 实现真实 AI 情绪分析
 */

import { llmService, EmotionAnalysisResult } from './LLMService';

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
  source: 'llm' | 'local';   // 预测来源
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
  useLLM: boolean;           // 是否使用 LLM (true=真实AI, false=本地fallback)
  llmPredictionInterval: number; // LLM 预测间隔
}

// 情绪词典 (仅作为 LLM 不可用时的 fallback)
const EMOTION_LEXICON_FALLBACK: Record<EmotionLabel, string[]> = {
  neutral: ['好的', '嗯', '明白', '知道了', '行'],
  happy: ['开心', '高兴', '快乐', '太好了', '哈哈', '嘿嘿', '棒', '赞', '爱', '喜欢', '感谢', '谢谢'],
  sad: ['难过', '伤心', '失望', '遗憾', '可惜', '唉', '呜', '委屈', '心痛'],
  angry: ['生气', '愤怒', '烦', '讨厌', '恨', '气死', '可恶', '混蛋'],
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

type PredictionCallback = (prediction: EmotionPrediction) => void;

export class EmotionPredictionModel {
  private config: PredictionConfig;
  private emotionHistory: EmotionLabel[] = [];
  private textHistory: string[] = [];
  private callbacks: Set<PredictionCallback> = new Set();
  private predictionsSinceLLM = 0;
  private isPredicting = false;

  constructor(config?: Partial<PredictionConfig>) {
    this.config = {
      textWeight: 0.5,
      contextWeight: 0.3,
      inertiaWeight: 0.2,
      minConfidence: 0.3,
      topK: 3,
      useLLM: true,           // 默认使用真实 LLM
      llmPredictionInterval: 1, // 每次都尝试 LLM
      ...config
    };
  }

  /**
   * 预测情绪 (同步，本地分析，向后兼容)
   */
  predict(text: string, context?: Partial<ContextFeatures>): EmotionPrediction {
    return this.predictLocal(text, context);
  }

  /**
   * 预测情绪 (异步，优先使用 LLM)
   */
  async predictAsync(text: string, context?: Partial<ContextFeatures>): Promise<EmotionPrediction> {
    this.predictionsSinceLLM++;

    // 优先尝试 LLM 分析
    if (this.config.useLLM && 
        this.predictionsSinceLLM >= this.config.llmPredictionInterval &&
        llmService.isConnected() &&
        !this.isPredicting) {
      
      const llmPrediction = await this.predictWithLLM(text);
      if (llmPrediction) {
        this.predictionsSinceLLM = 0;
        
        // 更新历史
        this.textHistory.push(text);
        this.emotionHistory.push(llmPrediction.emotion);
        if (this.textHistory.length > 20) this.textHistory.shift();
        if (this.emotionHistory.length > 20) this.emotionHistory.shift();
        
        this.notifyCallbacks(llmPrediction);
        return llmPrediction;
      }
    }

    // Fallback 到本地分析
    return this.predictLocal(text, context);
  }

  /**
   * 使用 LLM 预测情绪
   */
  private async predictWithLLM(text: string): Promise<EmotionPrediction | null> {
    this.isPredicting = true;
    
    try {
      const result = await llmService.analyzeEmotion(text);
      
      if (result) {
        const prediction: EmotionPrediction = {
          emotion: this.normalizeEmotion(result.emotion),
          confidence: result.confidence,
          alternatives: (result.alternatives || []).map(alt => ({
            emotion: this.normalizeEmotion(alt.emotion),
            confidence: alt.confidence
          })),
          reasoning: [result.reasoning, '(由 OpenClaw LLM 分析)'],
          source: 'llm'
        };

        console.log('[EmotionPrediction] LLM 分析结果:', 
          prediction.emotion, 
          `(置信度: ${(prediction.confidence * 100).toFixed(0)}%)`);

        return prediction;
      }
    } catch (e) {
      console.error('[EmotionPrediction] LLM 分析错误:', e);
    } finally {
      this.isPredicting = false;
    }

    return null;
  }

  /**
   * 本地预测 (fallback)
   */
  predictLocal(text: string, context?: Partial<ContextFeatures>): EmotionPrediction {
    const textFeatures = this.extractTextFeatures(text);
    
    const contextFeatures: ContextFeatures = {
      previousEmotions: this.emotionHistory.slice(-5),
      turnIndex: this.textHistory.length,
      conversationPhase: context?.conversationPhase || 'main',
      topicCategory: context?.topicCategory || 'casual',
      userEngagement: context?.userEngagement ?? 0.7
    };
    
    const scores = this.calculateScores(textFeatures, contextFeatures);
    
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
      reasoning: this.generateReasoning(textFeatures, contextFeatures, sorted[0][0] as EmotionLabel),
      source: 'local'
    };
    
    // 更新历史
    this.textHistory.push(text);
    this.emotionHistory.push(prediction.emotion);
    
    if (this.textHistory.length > 20) this.textHistory.shift();
    if (this.emotionHistory.length > 20) this.emotionHistory.shift();
    
    this.notifyCallbacks(prediction);
    
    return prediction;
  }

  /**
   * 同步预测（别名，用于测试或快速场景）
   * @deprecated 直接使用 predict() 即可
   */
  predictSync(text: string, context?: Partial<ContextFeatures>): EmotionPrediction {
    return this.predict(text, context);
  }

  /**
   * 批量预测 (异步)
   */
  async predictBatch(texts: string[]): Promise<EmotionPrediction[]> {
    const results: EmotionPrediction[] = [];
    for (const text of texts) {
      results.push(await this.predict(text));
    }
    return results;
  }

  /**
   * 仅分析文本情感（不更新历史）
   */
  analyzeText(text: string): TextFeatures {
    return this.extractTextFeatures(text);
  }

  /**
   * 强制使用 LLM 分析 (不等待间隔)
   */
  async forceLLMPrediction(text: string): Promise<EmotionPrediction | null> {
    if (!this.config.useLLM || !llmService.isConnected()) {
      return null;
    }
    return this.predictWithLLM(text);
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
    
    const counts: Partial<Record<EmotionLabel, number>> = {};
    for (const emotion of this.emotionHistory) {
      counts[emotion] = (counts[emotion] || 0) + 1;
    }
    
    let dominant: EmotionLabel = 'neutral';
    let maxCount = 0;
    for (const [emotion, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = emotion as EmotionLabel;
      }
    }
    
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
    this.predictionsSinceLLM = 0;
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
   * 设置是否使用 LLM
   */
  setUseLLM(useLLM: boolean): void {
    this.config.useLLM = useLLM;
  }

  /**
   * 检查 LLM 是否可用
   */
  isLLMAvailable(): boolean {
    return this.config.useLLM && llmService.isConnected();
  }

  /**
   * 获取可用情绪列表
   */
  static getAvailableEmotions(): EmotionLabel[] {
    return Object.keys(EMOTION_LEXICON_FALLBACK) as EmotionLabel[];
  }

  /**
   * 获取情绪词汇
   */
  static getEmotionKeywords(emotion: EmotionLabel): string[] {
    return [...(EMOTION_LEXICON_FALLBACK[emotion] || [])];
  }

  // === 私有方法 ===

  private normalizeEmotion(emotion: string): EmotionLabel {
    const lower = emotion.toLowerCase();
    const availableEmotions = EmotionPredictionModel.getAvailableEmotions();
    
    // 直接匹配
    if (availableEmotions.includes(lower as EmotionLabel)) {
      return lower as EmotionLabel;
    }
    
    // 映射常见变体
    const mappings: Record<string, EmotionLabel> = {
      'joy': 'happy',
      'happiness': 'happy',
      'sadness': 'sad',
      'anger': 'angry',
      'surprise': 'surprised',
      'fearful': 'fear',
      'disgusted': 'disgust',
      'excitement': 'excited',
      'calmness': 'calm',
      'confusion': 'confused',
      'shyness': 'shy',
      'pride': 'proud',
      'gratitude': 'grateful',
      'hope': 'hopeful'
    };
    
    if (mappings[lower]) {
      return mappings[lower];
    }
    
    return 'neutral';
  }

  private extractTextFeatures(text: string): TextFeatures {
    const lower = text.toLowerCase();
    
    const emotionWords: string[] = [];
    let sentimentSum = 0;
    let emotionCount = 0;
    
    for (const [emotion, keywords] of Object.entries(EMOTION_LEXICON_FALLBACK)) {
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          emotionWords.push(keyword);
          const emotionSentiment = this.getEmotionSentiment(emotion as EmotionLabel);
          sentimentSum += emotionSentiment;
          emotionCount++;
        }
      }
    }
    
    const sentiment = emotionCount > 0 ? sentimentSum / emotionCount : 0;
    
    const exclamCount = (text.match(/[!！]/g) || []).length;
    const questionCount = (text.match(/[?？]/g) || []).length;
    const arousal = Math.min(1, (exclamCount * 0.2 + questionCount * 0.1 + emotionWords.length * 0.1));
    
    return {
      sentiment,
      arousal,
      dominance: 0.5 + sentiment * 0.3,
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
      
      const textScore = this.calculateTextScore(emotion, textFeatures);
      score += textScore * this.config.textWeight;
      
      const contextScore = this.calculateContextScore(emotion, contextFeatures);
      score += contextScore * this.config.contextWeight;
      
      const inertiaScore = this.calculateInertiaScore(emotion, contextFeatures.previousEmotions);
      score += inertiaScore * this.config.inertiaWeight;
      
      scores[emotion] = Math.max(0, score);
    }
    
    return scores;
  }

  private calculateTextScore(emotion: EmotionLabel, features: TextFeatures): number {
    let score = 0;
    
    const keywords = EMOTION_LEXICON_FALLBACK[emotion] || [];
    for (const word of features.emotionWords) {
      if (keywords.includes(word)) {
        score += 0.3;
      }
    }
    
    const emotionSentiment = this.getEmotionSentiment(emotion);
    const sentimentDiff = Math.abs(features.sentiment - emotionSentiment);
    score += Math.max(0, 1 - sentimentDiff) * 0.3;
    
    const highArousalEmotions: EmotionLabel[] = ['excited', 'angry', 'surprised', 'fear'];
    const lowArousalEmotions: EmotionLabel[] = ['calm', 'sad', 'neutral', 'thinking'];
    
    if (features.arousal > 0.5 && highArousalEmotions.includes(emotion)) {
      score += 0.2;
    } else if (features.arousal < 0.5 && lowArousalEmotions.includes(emotion)) {
      score += 0.2;
    }
    
    if (features.hasQuestion && (emotion === 'confused' || emotion === 'thinking')) {
      score += 0.2;
    }
    
    return score;
  }

  private calculateContextScore(emotion: EmotionLabel, context: ContextFeatures): number {
    let score = 0;
    
    if (context.conversationPhase === 'greeting' && emotion === 'happy') {
      score += 0.3;
    } else if (context.conversationPhase === 'farewell' && (emotion === 'calm' || emotion === 'grateful')) {
      score += 0.3;
    }
    
    if (context.topicCategory === 'emotion') {
      if (['happy', 'sad', 'angry', 'fear'].includes(emotion)) {
        score += 0.2;
      }
    } else if (context.topicCategory === 'task') {
      if (['neutral', 'thinking', 'calm'].includes(emotion)) {
        score += 0.2;
      }
    }
    
    if (context.userEngagement > 0.7 && ['happy', 'excited', 'grateful'].includes(emotion)) {
      score += 0.1;
    }
    
    return score;
  }

  private calculateInertiaScore(emotion: EmotionLabel, previousEmotions: EmotionLabel[]): number {
    if (previousEmotions.length === 0) return 0.5;
    
    const lastEmotion = previousEmotions[previousEmotions.length - 1];
    
    const transitionProb = this.getTransitionProbability(lastEmotion, emotion);
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
    reasons.push('(本地分析 - LLM 不可用)');
    
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
