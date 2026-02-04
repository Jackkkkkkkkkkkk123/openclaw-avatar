/**
 * ExpressionVariantSystem - 表情随机变体系统
 * 
 * SOTA 优化 Round 26
 * 
 * 功能：
 * - 情绪到多表情变体的映射
 * - 智能变体选择（避免重复）
 * - 情绪强度影响变体选择
 * - 变体权重和偏好设置
 * - 上下文感知的变体推荐
 */

import type { Expression } from './AvatarController';
import type { Emotion } from './EmotionDetector';

// ========== 类型定义 ==========

export interface ExpressionVariant {
  expression: Expression;
  weight: number;           // 选择权重 (0-1)
  intensityRange: [number, number];  // 适用的强度范围
  contexts?: VariantContext[];       // 适用的上下文
  cooldown?: number;        // 冷却时间 (ms)，避免频繁使用
}

export type VariantContext = 
  | 'greeting'      // 打招呼场景
  | 'farewell'      // 告别场景
  | 'question'      // 提问场景
  | 'answer'        // 回答场景
  | 'story'         // 讲故事
  | 'comfort'       // 安慰场景
  | 'celebrate'     // 庆祝场景
  | 'casual'        // 日常闲聊
  | 'serious'       // 严肃话题
  | 'playful';      // 玩耍场景

export interface VariantSelection {
  expression: Expression;
  variant: ExpressionVariant;
  reason: string;
}

export interface VariantHistory {
  emotion: Emotion;
  expression: Expression;
  timestamp: number;
  context?: VariantContext;
}

export interface VariantConfig {
  historySize: number;          // 历史记录大小
  repeatPenalty: number;        // 重复惩罚 (0-1)
  intensityWeight: number;      // 强度影响权重
  contextWeight: number;        // 上下文影响权重
  randomnessFactor: number;     // 随机性因子 (0-1)
}

type SelectionCallback = (selection: VariantSelection) => void;

// ========== 情绪变体定义 ==========

const EMOTION_VARIANTS: Record<Emotion, ExpressionVariant[]> = {
  // 开心 - 6 种变体
  happy: [
    { expression: 'happy', weight: 1.0, intensityRange: [0.4, 0.8] },
    { expression: 'excited', weight: 0.7, intensityRange: [0.7, 1.0], contexts: ['celebrate'] },
    { expression: 'amused', weight: 0.6, intensityRange: [0.3, 0.6], contexts: ['playful', 'casual'] },
    { expression: 'playful', weight: 0.5, intensityRange: [0.4, 0.7], contexts: ['playful'] },
    { expression: 'grateful', weight: 0.4, intensityRange: [0.5, 0.9], contexts: ['greeting', 'farewell'] },
    { expression: 'proud', weight: 0.4, intensityRange: [0.6, 1.0], contexts: ['celebrate', 'answer'] },
  ],
  
  // 悲伤 - 5 种变体
  sad: [
    { expression: 'sad', weight: 1.0, intensityRange: [0.4, 0.8] },
    { expression: 'disappointed', weight: 0.8, intensityRange: [0.3, 0.6] },
    { expression: 'lonely', weight: 0.6, intensityRange: [0.5, 0.9] },
    { expression: 'hopeful', weight: 0.3, intensityRange: [0.2, 0.5], contexts: ['comfort'] },  // 悲伤中的希望
    { expression: 'relieved', weight: 0.3, intensityRange: [0.1, 0.4] },  // 悲伤后的释然
  ],
  
  // 惊讶 - 4 种变体
  surprised: [
    { expression: 'surprised', weight: 1.0, intensityRange: [0.5, 1.0] },
    { expression: 'curious', weight: 0.7, intensityRange: [0.3, 0.6], contexts: ['question'] },
    { expression: 'confused', weight: 0.5, intensityRange: [0.4, 0.7], contexts: ['question'] },
    { expression: 'excited', weight: 0.6, intensityRange: [0.6, 1.0], contexts: ['celebrate'] },
  ],
  
  // 愤怒 - 4 种变体
  angry: [
    { expression: 'angry', weight: 1.0, intensityRange: [0.6, 1.0] },
    { expression: 'disgusted', weight: 0.6, intensityRange: [0.5, 0.9] },
    { expression: 'disappointed', weight: 0.5, intensityRange: [0.3, 0.6] },
    { expression: 'determined', weight: 0.4, intensityRange: [0.4, 0.8], contexts: ['serious'] },
  ],
  
  // 恐惧 - 4 种变体
  fear: [
    { expression: 'fear', weight: 1.0, intensityRange: [0.5, 1.0] },
    { expression: 'anxious', weight: 0.8, intensityRange: [0.3, 0.7] },
    { expression: 'surprised', weight: 0.4, intensityRange: [0.4, 0.8] },
    { expression: 'confused', weight: 0.3, intensityRange: [0.2, 0.5] },
  ],
  
  // 思考 - 4 种变体
  thinking: [
    { expression: 'thinking', weight: 1.0, intensityRange: [0.3, 0.7] },
    { expression: 'curious', weight: 0.8, intensityRange: [0.4, 0.8], contexts: ['question'] },
    { expression: 'confused', weight: 0.5, intensityRange: [0.5, 0.9] },
    { expression: 'determined', weight: 0.4, intensityRange: [0.6, 1.0], contexts: ['serious', 'answer'] },
  ],
  
  // 害羞 - 4 种变体
  shy: [
    { expression: 'embarrassed', weight: 1.0, intensityRange: [0.4, 0.8] },
    { expression: 'happy', weight: 0.5, intensityRange: [0.3, 0.6], contexts: ['greeting'] },
    { expression: 'playful', weight: 0.4, intensityRange: [0.2, 0.5], contexts: ['playful'] },
    { expression: 'grateful', weight: 0.4, intensityRange: [0.4, 0.7] },
  ],
  
  // 爱/温柔 - 4 种变体
  loving: [
    { expression: 'loving', weight: 1.0, intensityRange: [0.4, 1.0] },
    { expression: 'grateful', weight: 0.7, intensityRange: [0.5, 0.9] },
    { expression: 'happy', weight: 0.5, intensityRange: [0.3, 0.6] },
    { expression: 'hopeful', weight: 0.4, intensityRange: [0.4, 0.8], contexts: ['comfort'] },
  ],
  
  // 好奇 - 4 种变体
  curious: [
    { expression: 'curious', weight: 1.0, intensityRange: [0.3, 0.8] },
    { expression: 'thinking', weight: 0.7, intensityRange: [0.4, 0.7] },
    { expression: 'surprised', weight: 0.5, intensityRange: [0.5, 0.9] },
    { expression: 'excited', weight: 0.4, intensityRange: [0.6, 1.0], contexts: ['question'] },
  ],
  
  // 中性 - 4 种变体
  neutral: [
    { expression: 'neutral', weight: 1.0, intensityRange: [0, 0.5] },
    { expression: 'thinking', weight: 0.5, intensityRange: [0.2, 0.5], contexts: ['question', 'answer'] },
    { expression: 'curious', weight: 0.4, intensityRange: [0.3, 0.6], contexts: ['casual'] },
    { expression: 'bored', weight: 0.3, intensityRange: [0.1, 0.3] },
  ],
  
  // 厌恶
  disgusted: [
    { expression: 'disgusted', weight: 1.0, intensityRange: [0.4, 1.0] },
    { expression: 'angry', weight: 0.5, intensityRange: [0.6, 1.0] },
    { expression: 'disappointed', weight: 0.5, intensityRange: [0.3, 0.6] },
  ],
  
  // 焦虑
  anxious: [
    { expression: 'anxious', weight: 1.0, intensityRange: [0.4, 0.9] },
    { expression: 'fear', weight: 0.6, intensityRange: [0.6, 1.0] },
    { expression: 'confused', weight: 0.5, intensityRange: [0.3, 0.6] },
    { expression: 'hopeful', weight: 0.3, intensityRange: [0.2, 0.5] },
  ],
};

// ========== ExpressionVariantSystem 类 ==========

export class ExpressionVariantSystem {
  private static instance: ExpressionVariantSystem | null = null;
  
  private history: VariantHistory[] = [];
  private cooldowns: Map<Expression, number> = new Map();
  private callbacks: Set<SelectionCallback> = new Set();
  private currentContext: VariantContext = 'casual';
  
  private config: VariantConfig = {
    historySize: 15,
    repeatPenalty: 0.6,
    intensityWeight: 0.3,
    contextWeight: 0.4,
    randomnessFactor: 0.2,
  };

  private constructor() {
    console.log('[ExpressionVariantSystem] 表情变体系统初始化');
  }

  static getInstance(): ExpressionVariantSystem {
    if (!ExpressionVariantSystem.instance) {
      ExpressionVariantSystem.instance = new ExpressionVariantSystem();
    }
    return ExpressionVariantSystem.instance;
  }

  // ========== 核心功能 ==========

  /**
   * 为情绪选择变体表情
   */
  selectVariant(
    emotion: Emotion,
    intensity: number = 0.5,
    context?: VariantContext
  ): VariantSelection {
    const variants = this.getVariantsForEmotion(emotion);
    
    if (variants.length === 0) {
      // 默认返回 neutral
      return {
        expression: 'neutral',
        variant: { expression: 'neutral', weight: 1, intensityRange: [0, 1] },
        reason: 'No variants defined for emotion',
      };
    }

    const effectiveContext = context || this.currentContext;
    const scores = this.calculateVariantScores(variants, intensity, effectiveContext);
    
    // 加权随机选择
    const selected = this.weightedRandomSelect(variants, scores);
    
    // 记录选择
    this.recordSelection(emotion, selected.expression, effectiveContext);
    
    // 更新冷却
    if (selected.cooldown) {
      this.cooldowns.set(selected.expression, Date.now() + selected.cooldown);
    }
    
    const selection: VariantSelection = {
      expression: selected.expression,
      variant: selected,
      reason: this.generateSelectionReason(selected, intensity, effectiveContext),
    };
    
    // 通知回调
    this.notifySelection(selection);
    
    return selection;
  }

  /**
   * 计算每个变体的得分
   */
  private calculateVariantScores(
    variants: ExpressionVariant[],
    intensity: number,
    context: VariantContext
  ): number[] {
    const now = Date.now();
    
    return variants.map(variant => {
      let score = variant.weight;
      
      // 1. 强度匹配得分
      const [minIntensity, maxIntensity] = variant.intensityRange;
      if (intensity >= minIntensity && intensity <= maxIntensity) {
        // 在范围内，给予额外加分
        const rangeCenter = (minIntensity + maxIntensity) / 2;
        const distanceFromCenter = Math.abs(intensity - rangeCenter);
        const rangeBonud = 1 - distanceFromCenter / ((maxIntensity - minIntensity) / 2 + 0.1);
        score += rangeBonud * this.config.intensityWeight;
      } else {
        // 不在范围内，降低得分
        score *= 0.3;
      }
      
      // 2. 上下文匹配得分
      if (variant.contexts) {
        if (variant.contexts.includes(context)) {
          score += this.config.contextWeight;
        }
      }
      
      // 3. 冷却检查
      const cooldownEnd = this.cooldowns.get(variant.expression);
      if (cooldownEnd && now < cooldownEnd) {
        score *= 0.1;  // 冷却中大幅降低得分
      }
      
      // 4. 重复惩罚
      const recentUsage = this.countRecentUsage(variant.expression);
      if (recentUsage > 0) {
        score *= Math.pow(1 - this.config.repeatPenalty, recentUsage);
      }
      
      // 5. 添加随机性
      score *= (1 - this.config.randomnessFactor) + 
               (Math.random() * this.config.randomnessFactor * 2);
      
      return Math.max(0.01, score);  // 确保最小得分
    });
  }

  /**
   * 加权随机选择
   */
  private weightedRandomSelect(
    variants: ExpressionVariant[],
    scores: number[]
  ): ExpressionVariant {
    const totalScore = scores.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalScore;
    
    for (let i = 0; i < variants.length; i++) {
      random -= scores[i];
      if (random <= 0) {
        return variants[i];
      }
    }
    
    return variants[variants.length - 1];
  }

  /**
   * 统计最近使用次数
   */
  private countRecentUsage(expression: Expression): number {
    return this.history.filter(h => h.expression === expression).length;
  }

  /**
   * 记录选择历史
   */
  private recordSelection(
    emotion: Emotion,
    expression: Expression,
    context?: VariantContext
  ): void {
    this.history.push({
      emotion,
      expression,
      timestamp: Date.now(),
      context,
    });
    
    // 限制历史大小
    while (this.history.length > this.config.historySize) {
      this.history.shift();
    }
  }

  /**
   * 生成选择原因（用于调试）
   */
  private generateSelectionReason(
    variant: ExpressionVariant,
    intensity: number,
    context: VariantContext
  ): string {
    const reasons: string[] = [];
    
    const [minI, maxI] = variant.intensityRange;
    if (intensity >= minI && intensity <= maxI) {
      reasons.push(`intensity ${intensity.toFixed(2)} in range [${minI}, ${maxI}]`);
    }
    
    if (variant.contexts?.includes(context)) {
      reasons.push(`matches context: ${context}`);
    }
    
    reasons.push(`weight: ${variant.weight.toFixed(2)}`);
    
    return reasons.join(', ') || 'random selection';
  }

  // ========== 变体管理 ==========

  /**
   * 获取情绪的所有变体
   */
  getVariantsForEmotion(emotion: Emotion): ExpressionVariant[] {
    return EMOTION_VARIANTS[emotion] || [];
  }

  /**
   * 添加自定义变体
   */
  addVariant(emotion: Emotion, variant: ExpressionVariant): void {
    if (!EMOTION_VARIANTS[emotion]) {
      EMOTION_VARIANTS[emotion] = [];
    }
    EMOTION_VARIANTS[emotion].push(variant);
  }

  /**
   * 移除变体
   */
  removeVariant(emotion: Emotion, expression: Expression): boolean {
    const variants = EMOTION_VARIANTS[emotion];
    if (!variants) return false;
    
    const index = variants.findIndex(v => v.expression === expression);
    if (index !== -1) {
      variants.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 获取支持的所有情绪
   */
  getSupportedEmotions(): Emotion[] {
    return Object.keys(EMOTION_VARIANTS) as Emotion[];
  }

  /**
   * 获取所有可用表情（去重）
   */
  getAllExpressions(): Expression[] {
    const expressionSet = new Set<Expression>();
    
    for (const variants of Object.values(EMOTION_VARIANTS)) {
      for (const variant of variants) {
        expressionSet.add(variant.expression);
      }
    }
    
    return Array.from(expressionSet);
  }

  // ========== 上下文管理 ==========

  /**
   * 设置当前上下文
   */
  setContext(context: VariantContext): void {
    this.currentContext = context;
  }

  /**
   * 获取当前上下文
   */
  getContext(): VariantContext {
    return this.currentContext;
  }

  /**
   * 根据文本推断上下文
   */
  inferContextFromText(text: string): VariantContext {
    const lowerText = text.toLowerCase();
    
    if (this.containsAny(lowerText, ['你好', '嗨', 'hello', 'hi', '早上好', '晚上好'])) {
      return 'greeting';
    }
    
    if (this.containsAny(lowerText, ['再见', '拜拜', 'bye', 'goodbye', '晚安', '下次见'])) {
      return 'farewell';
    }
    
    if (this.containsAny(lowerText, ['?', '？', '为什么', '怎么', '什么', 'why', 'how', 'what'])) {
      return 'question';
    }
    
    if (this.containsAny(lowerText, ['恭喜', '太棒了', '成功', 'congratulations', 'celebrate', '庆祝'])) {
      return 'celebrate';
    }
    
    if (this.containsAny(lowerText, ['别担心', '没事', '加油', '陪你', 'don\'t worry', '会好的'])) {
      return 'comfort';
    }
    
    if (this.containsAny(lowerText, ['认真', '重要', '必须', 'serious', 'important', '注意'])) {
      return 'serious';
    }
    
    if (this.containsAny(lowerText, ['玩', '嘿嘿', '哈哈', 'play', 'fun', '游戏'])) {
      return 'playful';
    }
    
    if (this.containsAny(lowerText, ['从前', '故事', '听说', 'story', 'once upon', '讲一个'])) {
      return 'story';
    }
    
    return 'casual';
  }

  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  }

  // ========== 历史和统计 ==========

  /**
   * 获取选择历史
   */
  getHistory(): VariantHistory[] {
    return [...this.history];
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.history = [];
    this.cooldowns.clear();
  }

  /**
   * 获取表情使用统计
   */
  getUsageStats(): Record<Expression, number> {
    const stats: Record<string, number> = {};
    
    for (const h of this.history) {
      stats[h.expression] = (stats[h.expression] || 0) + 1;
    }
    
    return stats as Record<Expression, number>;
  }

  /**
   * 获取上下文使用统计
   */
  getContextStats(): Record<VariantContext, number> {
    const stats: Record<string, number> = {};
    
    for (const h of this.history) {
      if (h.context) {
        stats[h.context] = (stats[h.context] || 0) + 1;
      }
    }
    
    return stats as Record<VariantContext, number>;
  }

  // ========== 回调 ==========

  /**
   * 订阅选择事件
   */
  onSelection(callback: SelectionCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifySelection(selection: VariantSelection): void {
    this.callbacks.forEach(cb => {
      try {
        cb(selection);
      } catch (e) {
        console.error('[ExpressionVariantSystem] Callback error:', e);
      }
    });
  }

  // ========== 配置 ==========

  /**
   * 设置配置
   */
  setConfig(config: Partial<VariantConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): VariantConfig {
    return { ...this.config };
  }

  // ========== 销毁 ==========

  /**
   * 重置
   */
  reset(): void {
    this.history = [];
    this.cooldowns.clear();
    this.currentContext = 'casual';
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.history = [];
    this.cooldowns.clear();
    this.callbacks.clear();
    ExpressionVariantSystem.instance = null;
  }
}

// 单例导出
export const expressionVariantSystem = ExpressionVariantSystem.getInstance();

// 便捷函数
export function selectExpressionVariant(
  emotion: Emotion,
  intensity?: number,
  context?: VariantContext
): VariantSelection {
  return expressionVariantSystem.selectVariant(emotion, intensity, context);
}

export function setVariantContext(context: VariantContext): void {
  expressionVariantSystem.setContext(context);
}

export function inferVariantContext(text: string): VariantContext {
  return expressionVariantSystem.inferContextFromText(text);
}
