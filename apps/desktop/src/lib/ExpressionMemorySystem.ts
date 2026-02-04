/**
 * ExpressionMemorySystem - 表情记忆系统
 * 
 * 学习用户偏好和对话模式，智能优化表情切换
 * 
 * 功能：
 * 1. 记录表情切换历史和效果
 * 2. 学习最佳表情组合模式
 * 3. 根据对话上下文推荐表情
 * 4. 避免不自然的表情切换
 * 5. 提供表情切换统计和分析
 */

export type EmotionType = 
  | 'neutral' | 'happy' | 'sad' | 'surprised' | 'angry' 
  | 'fear' | 'thinking' | 'shy' | 'excited' | 'loving'
  | 'grateful' | 'proud' | 'confused' | 'bored' | 'playful';

export interface ExpressionTransition {
  from: EmotionType;
  to: EmotionType;
  timestamp: number;
  context?: string;
  text?: string;
  durationMs?: number;
  wasNatural: boolean;  // 是否自然（用户反馈或系统判断）
}

export interface ExpressionPattern {
  sequence: EmotionType[];
  count: number;
  avgNaturalness: number;  // 0-1
  contexts: string[];
  lastUsed: number;
}

export interface TransitionScore {
  from: EmotionType;
  to: EmotionType;
  score: number;  // 0-1，越高越自然
  count: number;
}

export interface ExpressionRecommendation {
  expression: EmotionType;
  confidence: number;  // 0-1
  reason: string;
  alternates: EmotionType[];
}

export interface MemoryConfig {
  maxHistorySize: number;
  maxPatternLength: number;
  minPatternCount: number;
  naturalTransitionThreshold: number;
  learningRate: number;
  decayRate: number;  // 历史权重衰减
}

export interface MemoryStats {
  totalTransitions: number;
  uniquePatterns: number;
  mostUsedExpression: EmotionType;
  mostNaturalTransition: { from: EmotionType; to: EmotionType; score: number };
  leastNaturalTransition: { from: EmotionType; to: EmotionType; score: number };
  avgNaturalness: number;
}

type MemoryCallback = (transition: ExpressionTransition) => void;

// 预定义的自然过渡分数（基于情感理论）
const DEFAULT_TRANSITION_SCORES: Record<string, number> = {
  // 中性 → 其他
  'neutral→happy': 0.9,
  'neutral→sad': 0.7,
  'neutral→surprised': 0.95,
  'neutral→thinking': 0.9,
  'neutral→shy': 0.8,
  
  // 开心 → 其他
  'happy→neutral': 0.8,
  'happy→excited': 0.95,
  'happy→loving': 0.9,
  'happy→proud': 0.85,
  'happy→playful': 0.9,
  'happy→sad': 0.4,  // 不自然
  'happy→angry': 0.3,  // 很不自然
  
  // 悲伤 → 其他
  'sad→neutral': 0.7,
  'sad→happy': 0.5,  // 需要过渡
  'sad→grateful': 0.8,
  'sad→loving': 0.75,
  
  // 惊讶 → 其他
  'surprised→happy': 0.9,
  'surprised→neutral': 0.85,
  'surprised→excited': 0.95,
  'surprised→fear': 0.7,
  
  // 思考 → 其他
  'thinking→happy': 0.85,
  'thinking→surprised': 0.9,
  'thinking→neutral': 0.9,
  'thinking→confused': 0.8,
  
  // 害羞 → 其他
  'shy→happy': 0.85,
  'shy→neutral': 0.8,
  'shy→loving': 0.75,
  
  // 愤怒 → 其他
  'angry→neutral': 0.6,
  'angry→happy': 0.3,  // 很不自然
  'angry→sad': 0.7,
};

export class ExpressionMemorySystem {
  private config: MemoryConfig;
  private history: ExpressionTransition[];
  private patterns: Map<string, ExpressionPattern>;
  private transitionScores: Map<string, TransitionScore>;
  private currentExpression: EmotionType;
  private callbacks: Set<MemoryCallback>;
  
  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = {
      maxHistorySize: config.maxHistorySize ?? 500,
      maxPatternLength: config.maxPatternLength ?? 5,
      minPatternCount: config.minPatternCount ?? 3,
      naturalTransitionThreshold: config.naturalTransitionThreshold ?? 0.6,
      learningRate: config.learningRate ?? 0.1,
      decayRate: config.decayRate ?? 0.95,
    };
    
    this.history = [];
    this.patterns = new Map();
    this.transitionScores = new Map();
    this.currentExpression = 'neutral';
    this.callbacks = new Set();
    
    // 初始化默认过渡分数
    this.initializeDefaultScores();
    
    console.log('[ExpressionMemory] 表情记忆系统初始化');
  }
  
  /**
   * 初始化默认过渡分数
   */
  private initializeDefaultScores(): void {
    for (const [key, score] of Object.entries(DEFAULT_TRANSITION_SCORES)) {
      const [from, to] = key.split('→') as [EmotionType, EmotionType];
      this.transitionScores.set(key, {
        from,
        to,
        score,
        count: 0,
      });
    }
  }
  
  /**
   * 记录表情切换
   */
  recordTransition(
    to: EmotionType,
    options: {
      context?: string;
      text?: string;
      durationMs?: number;
      wasNatural?: boolean;
    } = {}
  ): void {
    const from = this.currentExpression;
    
    // 自动判断自然性（如果未提供）
    const wasNatural = options.wasNatural ?? this.isNaturalTransition(from, to);
    
    const transition: ExpressionTransition = {
      from,
      to,
      timestamp: Date.now(),
      context: options.context,
      text: options.text,
      durationMs: options.durationMs,
      wasNatural,
    };
    
    // 添加到历史
    this.history.push(transition);
    if (this.history.length > this.config.maxHistorySize) {
      this.history.shift();
    }
    
    // 更新过渡分数
    this.updateTransitionScore(from, to, wasNatural);
    
    // 更新模式
    this.updatePatterns(transition);
    
    // 更新当前表情
    this.currentExpression = to;
    
    // 通知回调
    this.notifyCallbacks(transition);
  }
  
  /**
   * 判断过渡是否自然
   */
  isNaturalTransition(from: EmotionType, to: EmotionType): boolean {
    const key = `${from}→${to}`;
    const score = this.transitionScores.get(key);
    
    if (score) {
      return score.score >= this.config.naturalTransitionThreshold;
    }
    
    // 没有数据时，使用距离启发
    return this.estimateTransitionNaturalness(from, to) >= this.config.naturalTransitionThreshold;
  }
  
  /**
   * 估算过渡自然性（基于情感维度）
   */
  private estimateTransitionNaturalness(from: EmotionType, to: EmotionType): number {
    // 定义情感的 Valence-Arousal 位置
    const emotionPositions: Record<EmotionType, { valence: number; arousal: number }> = {
      neutral: { valence: 0, arousal: 0 },
      happy: { valence: 0.8, arousal: 0.5 },
      sad: { valence: -0.7, arousal: -0.3 },
      surprised: { valence: 0.2, arousal: 0.8 },
      angry: { valence: -0.8, arousal: 0.7 },
      fear: { valence: -0.6, arousal: 0.6 },
      thinking: { valence: 0, arousal: 0.2 },
      shy: { valence: 0.2, arousal: -0.2 },
      excited: { valence: 0.9, arousal: 0.9 },
      loving: { valence: 0.9, arousal: 0.3 },
      grateful: { valence: 0.7, arousal: 0.1 },
      proud: { valence: 0.6, arousal: 0.4 },
      confused: { valence: -0.2, arousal: 0.3 },
      bored: { valence: -0.3, arousal: -0.5 },
      playful: { valence: 0.7, arousal: 0.6 },
    };
    
    const fromPos = emotionPositions[from] || { valence: 0, arousal: 0 };
    const toPos = emotionPositions[to] || { valence: 0, arousal: 0 };
    
    // 计算欧氏距离
    const distance = Math.sqrt(
      Math.pow(toPos.valence - fromPos.valence, 2) +
      Math.pow(toPos.arousal - fromPos.arousal, 2)
    );
    
    // 距离越小，自然性越高（最大距离约 2.26）
    return Math.max(0, 1 - distance / 2.26);
  }
  
  /**
   * 更新过渡分数
   */
  private updateTransitionScore(from: EmotionType, to: EmotionType, wasNatural: boolean): void {
    const key = `${from}→${to}`;
    const existing = this.transitionScores.get(key);
    
    if (existing) {
      // 使用学习率更新分数
      const newScore = existing.score * (1 - this.config.learningRate) +
        (wasNatural ? 1 : 0) * this.config.learningRate;
      
      this.transitionScores.set(key, {
        ...existing,
        score: newScore,
        count: existing.count + 1,
      });
    } else {
      // 新的过渡
      const baseScore = this.estimateTransitionNaturalness(from, to);
      this.transitionScores.set(key, {
        from,
        to,
        score: baseScore * 0.7 + (wasNatural ? 0.3 : 0),
        count: 1,
      });
    }
  }
  
  /**
   * 更新模式
   */
  private updatePatterns(transition: ExpressionTransition): void {
    // 获取最近的表情序列
    const recentHistory = this.history.slice(-this.config.maxPatternLength);
    
    // 提取序列
    for (let len = 2; len <= Math.min(recentHistory.length, this.config.maxPatternLength); len++) {
      const sequence = recentHistory.slice(-len).map(t => t.to);
      const key = sequence.join('→');
      
      const existing = this.patterns.get(key);
      if (existing) {
        // 更新现有模式
        const contexts = [...new Set([...existing.contexts, transition.context || 'unknown'])];
        const newAvgNaturalness = (existing.avgNaturalness * existing.count + (transition.wasNatural ? 1 : 0)) / (existing.count + 1);
        
        this.patterns.set(key, {
          sequence,
          count: existing.count + 1,
          avgNaturalness: newAvgNaturalness,
          contexts: contexts.slice(-10),  // 保留最近10个上下文
          lastUsed: Date.now(),
        });
      } else {
        // 新模式
        this.patterns.set(key, {
          sequence,
          count: 1,
          avgNaturalness: transition.wasNatural ? 1 : 0,
          contexts: transition.context ? [transition.context] : [],
          lastUsed: Date.now(),
        });
      }
    }
    
    // 清理低频模式
    this.cleanupPatterns();
  }
  
  /**
   * 清理低频模式
   */
  private cleanupPatterns(): void {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000;  // 7天
    
    for (const [key, pattern] of this.patterns.entries()) {
      // 删除过期且低频的模式
      if (pattern.count < this.config.minPatternCount && now - pattern.lastUsed > maxAge) {
        this.patterns.delete(key);
      }
    }
    
    // 如果模式太多，删除最不常用的
    if (this.patterns.size > 1000) {
      const sorted = Array.from(this.patterns.entries())
        .sort((a, b) => b[1].lastUsed - a[1].lastUsed);
      
      for (let i = 500; i < sorted.length; i++) {
        this.patterns.delete(sorted[i][0]);
      }
    }
  }
  
  /**
   * 获取推荐表情
   */
  getRecommendation(options: {
    text?: string;
    context?: string;
    detectedEmotion?: EmotionType;
    excludeRecent?: number;  // 排除最近 N 个表情
  } = {}): ExpressionRecommendation {
    const { text, context, detectedEmotion, excludeRecent = 2 } = options;
    
    // 收集候选表情和分数
    const candidates: { expression: EmotionType; score: number; reason: string }[] = [];
    
    // 1. 考虑检测到的情绪
    if (detectedEmotion) {
      const transitionScore = this.getTransitionScore(this.currentExpression, detectedEmotion);
      candidates.push({
        expression: detectedEmotion,
        score: transitionScore * 0.8 + 0.2,  // 基础分
        reason: `检测到情绪: ${detectedEmotion}`,
      });
    }
    
    // 2. 考虑上下文模式
    if (context) {
      const contextPatterns = this.getPatternsForContext(context);
      for (const pattern of contextPatterns.slice(0, 3)) {
        const nextExpression = pattern.sequence[pattern.sequence.length - 1];
        candidates.push({
          expression: nextExpression,
          score: pattern.avgNaturalness * 0.7,
          reason: `上下文模式: ${pattern.sequence.join('→')}`,
        });
      }
    }
    
    // 3. 考虑自然过渡
    const naturalTransitions = this.getNaturalTransitions(this.currentExpression);
    for (const transition of naturalTransitions.slice(0, 5)) {
      candidates.push({
        expression: transition.to,
        score: transition.score * 0.5,
        reason: `自然过渡: ${this.currentExpression}→${transition.to}`,
      });
    }
    
    // 排除最近使用的表情
    const recentExpressions = this.history.slice(-excludeRecent).map(t => t.to);
    const filteredCandidates = candidates.filter(c => !recentExpressions.includes(c.expression));
    
    // 如果过滤后没有候选，回退到原始候选
    const finalCandidates = filteredCandidates.length > 0 ? filteredCandidates : candidates;
    
    // 合并相同表情的分数
    const mergedCandidates = new Map<EmotionType, { score: number; reasons: string[] }>();
    for (const c of finalCandidates) {
      const existing = mergedCandidates.get(c.expression);
      if (existing) {
        existing.score = Math.max(existing.score, c.score);
        existing.reasons.push(c.reason);
      } else {
        mergedCandidates.set(c.expression, { score: c.score, reasons: [c.reason] });
      }
    }
    
    // 排序
    const sorted = Array.from(mergedCandidates.entries())
      .sort((a, b) => b[1].score - a[1].score);
    
    // 返回推荐
    if (sorted.length === 0) {
      return {
        expression: 'neutral',
        confidence: 0.5,
        reason: '默认表情',
        alternates: [],
      };
    }
    
    const [bestExpression, bestData] = sorted[0];
    
    return {
      expression: bestExpression,
      confidence: bestData.score,
      reason: bestData.reasons[0],
      alternates: sorted.slice(1, 4).map(([e]) => e),
    };
  }
  
  /**
   * 获取过渡分数
   */
  getTransitionScore(from: EmotionType, to: EmotionType): number {
    const key = `${from}→${to}`;
    const score = this.transitionScores.get(key);
    return score?.score ?? this.estimateTransitionNaturalness(from, to);
  }
  
  /**
   * 获取上下文相关的模式
   */
  private getPatternsForContext(context: string): ExpressionPattern[] {
    const matching: ExpressionPattern[] = [];
    
    for (const pattern of this.patterns.values()) {
      if (pattern.contexts.includes(context)) {
        matching.push(pattern);
      }
    }
    
    return matching.sort((a, b) => b.avgNaturalness - a.avgNaturalness);
  }
  
  /**
   * 获取自然过渡列表
   */
  private getNaturalTransitions(from: EmotionType): TransitionScore[] {
    const transitions: TransitionScore[] = [];
    
    for (const score of this.transitionScores.values()) {
      if (score.from === from) {
        transitions.push(score);
      }
    }
    
    return transitions.sort((a, b) => b.score - a.score);
  }
  
  /**
   * 获取统计信息
   */
  getStats(): MemoryStats {
    // 统计表情使用频率
    const expressionCounts = new Map<EmotionType, number>();
    for (const t of this.history) {
      expressionCounts.set(t.to, (expressionCounts.get(t.to) || 0) + 1);
    }
    
    // 找出最常用表情
    let mostUsed: EmotionType = 'neutral';
    let maxCount = 0;
    for (const [expr, count] of expressionCounts.entries()) {
      if (count > maxCount) {
        mostUsed = expr;
        maxCount = count;
      }
    }
    
    // 找出最自然和最不自然的过渡
    let mostNatural = { from: 'neutral' as EmotionType, to: 'happy' as EmotionType, score: 0 };
    let leastNatural = { from: 'neutral' as EmotionType, to: 'neutral' as EmotionType, score: 1 };
    
    for (const score of this.transitionScores.values()) {
      if (score.count > 0) {
        if (score.score > mostNatural.score) {
          mostNatural = { from: score.from, to: score.to, score: score.score };
        }
        if (score.score < leastNatural.score) {
          leastNatural = { from: score.from, to: score.to, score: score.score };
        }
      }
    }
    
    // 计算平均自然性
    const naturalCount = this.history.filter(t => t.wasNatural).length;
    const avgNaturalness = this.history.length > 0 ? naturalCount / this.history.length : 0;
    
    return {
      totalTransitions: this.history.length,
      uniquePatterns: this.patterns.size,
      mostUsedExpression: mostUsed,
      mostNaturalTransition: mostNatural,
      leastNaturalTransition: leastNatural,
      avgNaturalness,
    };
  }
  
  /**
   * 获取历史记录
   */
  getHistory(limit?: number): ExpressionTransition[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }
  
  /**
   * 获取当前表情
   */
  getCurrentExpression(): EmotionType {
    return this.currentExpression;
  }
  
  /**
   * 设置当前表情（不记录过渡）
   */
  setCurrentExpression(expression: EmotionType): void {
    this.currentExpression = expression;
  }
  
  /**
   * 订阅过渡事件
   */
  onTransition(callback: MemoryCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }
  
  /**
   * 通知回调
   */
  private notifyCallbacks(transition: ExpressionTransition): void {
    for (const callback of this.callbacks) {
      try {
        callback(transition);
      } catch (err) {
        console.error('[ExpressionMemory] Callback error:', err);
      }
    }
  }
  
  /**
   * 清空历史
   */
  clearHistory(): void {
    this.history = [];
  }
  
  /**
   * 重置系统
   */
  reset(): void {
    this.history = [];
    this.patterns.clear();
    this.transitionScores.clear();
    this.currentExpression = 'neutral';
    this.initializeDefaultScores();
    console.log('[ExpressionMemory] 系统已重置');
  }
  
  /**
   * 导出数据
   */
  exportData(): string {
    return JSON.stringify({
      history: this.history.slice(-100),  // 只导出最近100条
      patterns: Array.from(this.patterns.entries()),
      transitionScores: Array.from(this.transitionScores.entries()),
      currentExpression: this.currentExpression,
    });
  }
  
  /**
   * 导入数据
   */
  importData(json: string): void {
    try {
      const data = JSON.parse(json);
      
      if (data.history) {
        this.history = data.history;
      }
      if (data.patterns) {
        this.patterns = new Map(data.patterns);
      }
      if (data.transitionScores) {
        this.transitionScores = new Map(data.transitionScores);
      }
      if (data.currentExpression) {
        this.currentExpression = data.currentExpression;
      }
      
      console.log('[ExpressionMemory] 数据已导入');
    } catch (err) {
      console.error('[ExpressionMemory] 导入失败:', err);
    }
  }
  
  /**
   * 获取配置
   */
  getConfig(): MemoryConfig {
    return { ...this.config };
  }
  
  /**
   * 更新配置
   */
  setConfig(config: Partial<MemoryConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[ExpressionMemory] 配置已更新:', config);
  }
}

// 单例
let instance: ExpressionMemorySystem | null = null;

export function getExpressionMemorySystem(): ExpressionMemorySystem {
  if (!instance) {
    instance = new ExpressionMemorySystem();
  }
  return instance;
}

export function resetExpressionMemorySystem(): void {
  if (instance) {
    instance.reset();
  }
  instance = null;
}

// 便捷函数
export function recordExpressionTransition(
  to: EmotionType,
  options?: Parameters<ExpressionMemorySystem['recordTransition']>[1]
): void {
  getExpressionMemorySystem().recordTransition(to, options);
}

export function getExpressionRecommendation(
  options?: Parameters<ExpressionMemorySystem['getRecommendation']>[0]
): ExpressionRecommendation {
  return getExpressionMemorySystem().getRecommendation(options);
}

export function isNaturalTransition(from: EmotionType, to: EmotionType): boolean {
  return getExpressionMemorySystem().isNaturalTransition(from, to);
}
