/**
 * AdaptiveResponseSystem - 自适应响应系统
 * 
 * 根据用户的反馈和行为模式，自动调整 Avatar 的响应方式
 * 让交互更加个性化和自然
 */

export interface UserFeedback {
  type: FeedbackType;
  context?: string;
  timestamp: number;
}

export type FeedbackType =
  | 'positive'      // 用户表现出正面反馈
  | 'negative'      // 用户表现出负面反馈
  | 'neutral'       // 中性
  | 'engaged'       // 用户参与度高
  | 'disengaged'    // 用户参与度低
  | 'confused'      // 用户困惑
  | 'impatient';    // 用户不耐烦

export interface ResponseProfile {
  expressionIntensity: number;      // 表情强度 0-1
  animationSpeed: number;           // 动画速度倍率
  responseVerbosity: 'minimal' | 'normal' | 'detailed';
  emotionalRange: number;           // 情感表达范围 0-1
  humorLevel: number;               // 幽默程度 0-1
  formalityLevel: number;           // 正式程度 0-1
  empathyLevel: number;             // 同理心程度 0-1
  proactivityLevel: number;         // 主动性程度 0-1
}

export interface AdaptationRule {
  trigger: FeedbackType[];
  minOccurrences: number;
  timeWindowMs: number;
  adjustments: Partial<ResponseProfile>;
}

export interface AdaptiveConfig {
  learningRate: number;             // 学习速率 0-1
  decayRate: number;                // 衰减速率 0-1
  adaptationThreshold: number;      // 触发调整的阈值
  maxProfileDeviation: number;      // 最大偏离默认值的幅度
}

type ProfileCallback = (profile: ResponseProfile) => void;

// 默认响应配置
const DEFAULT_PROFILE: ResponseProfile = {
  expressionIntensity: 0.7,
  animationSpeed: 1.0,
  responseVerbosity: 'normal',
  emotionalRange: 0.6,
  humorLevel: 0.5,
  formalityLevel: 0.5,
  empathyLevel: 0.7,
  proactivityLevel: 0.5
};

// 预设的适应规则
const DEFAULT_RULES: AdaptationRule[] = [
  {
    // 用户频繁给出正面反馈 → 增加表情强度和情感表达
    trigger: ['positive'],
    minOccurrences: 3,
    timeWindowMs: 5 * 60 * 1000,  // 5 分钟
    adjustments: {
      expressionIntensity: 0.1,
      emotionalRange: 0.1,
      humorLevel: 0.05
    }
  },
  {
    // 用户频繁给出负面反馈 → 减少幽默，增加同理心
    trigger: ['negative'],
    minOccurrences: 2,
    timeWindowMs: 5 * 60 * 1000,
    adjustments: {
      humorLevel: -0.1,
      empathyLevel: 0.1,
      expressionIntensity: -0.05
    }
  },
  {
    // 用户参与度高 → 增加主动性和详细度
    trigger: ['engaged'],
    minOccurrences: 5,
    timeWindowMs: 10 * 60 * 1000,
    adjustments: {
      proactivityLevel: 0.1,
      responseVerbosity: 'detailed' as const
    }
  },
  {
    // 用户参与度低 → 简化响应
    trigger: ['disengaged'],
    minOccurrences: 3,
    timeWindowMs: 5 * 60 * 1000,
    adjustments: {
      responseVerbosity: 'minimal' as const,
      proactivityLevel: -0.1
    }
  },
  {
    // 用户困惑 → 降低速度，增加详细度
    trigger: ['confused'],
    minOccurrences: 2,
    timeWindowMs: 3 * 60 * 1000,
    adjustments: {
      animationSpeed: -0.1,
      responseVerbosity: 'detailed' as const,
      formalityLevel: 0.1
    }
  },
  {
    // 用户不耐烦 → 加快速度，简化响应
    trigger: ['impatient'],
    minOccurrences: 2,
    timeWindowMs: 2 * 60 * 1000,
    adjustments: {
      animationSpeed: 0.2,
      responseVerbosity: 'minimal' as const,
      proactivityLevel: -0.1
    }
  }
];

export class AdaptiveResponseSystem {
  private config: AdaptiveConfig;
  private currentProfile: ResponseProfile;
  private feedbackHistory: UserFeedback[] = [];
  private rules: AdaptationRule[];
  private callbacks: Set<ProfileCallback> = new Set();

  constructor(config?: Partial<AdaptiveConfig>) {
    this.config = {
      learningRate: 0.1,
      decayRate: 0.01,
      adaptationThreshold: 0.05,
      maxProfileDeviation: 0.4,
      ...config
    };
    
    this.currentProfile = { ...DEFAULT_PROFILE };
    this.rules = [...DEFAULT_RULES];
  }

  /**
   * 记录用户反馈
   */
  recordFeedback(type: FeedbackType, context?: string): void {
    const feedback: UserFeedback = {
      type,
      context,
      timestamp: Date.now()
    };
    
    this.feedbackHistory.push(feedback);
    
    // 清理旧反馈（保留最近 1 小时）
    const cutoff = Date.now() - 60 * 60 * 1000;
    this.feedbackHistory = this.feedbackHistory.filter(f => f.timestamp >= cutoff);
    
    // 检查并应用适应规则
    this.checkAndApplyRules();
  }

  /**
   * 获取当前响应配置
   */
  getProfile(): ResponseProfile {
    return { ...this.currentProfile };
  }

  /**
   * 手动设置配置
   */
  setProfile(profile: Partial<ResponseProfile>): void {
    this.currentProfile = {
      ...this.currentProfile,
      ...profile
    };
    this.clampProfile();
    this.notifyCallbacks();
  }

  /**
   * 重置为默认配置
   */
  resetProfile(): void {
    this.currentProfile = { ...DEFAULT_PROFILE };
    this.notifyCallbacks();
  }

  /**
   * 获取反馈统计
   */
  getFeedbackStats(windowMs?: number): Map<FeedbackType, number> {
    const window = windowMs || 60 * 60 * 1000;  // 默认 1 小时
    const cutoff = Date.now() - window;
    
    const stats = new Map<FeedbackType, number>();
    
    for (const feedback of this.feedbackHistory) {
      if (feedback.timestamp >= cutoff) {
        stats.set(feedback.type, (stats.get(feedback.type) || 0) + 1);
      }
    }
    
    return stats;
  }

  /**
   * 获取用户情绪倾向
   */
  getUserSentiment(): 'positive' | 'negative' | 'neutral' {
    const stats = this.getFeedbackStats(30 * 60 * 1000);  // 30 分钟窗口
    
    const positive = (stats.get('positive') || 0) + (stats.get('engaged') || 0);
    const negative = (stats.get('negative') || 0) + (stats.get('disengaged') || 0) + 
                     (stats.get('impatient') || 0);
    
    if (positive > negative + 2) return 'positive';
    if (negative > positive + 2) return 'negative';
    return 'neutral';
  }

  /**
   * 添加自定义规则
   */
  addRule(rule: AdaptationRule): void {
    this.rules.push(rule);
  }

  /**
   * 移除规则
   */
  removeRule(index: number): boolean {
    if (index < 0 || index >= this.rules.length) return false;
    this.rules.splice(index, 1);
    return true;
  }

  /**
   * 获取所有规则
   */
  getRules(): AdaptationRule[] {
    return [...this.rules];
  }

  /**
   * 应用时间衰减（让配置逐渐回归默认值）
   */
  applyDecay(): void {
    const decay = this.config.decayRate;
    
    this.currentProfile.expressionIntensity = this.decayTowards(
      this.currentProfile.expressionIntensity, 
      DEFAULT_PROFILE.expressionIntensity, 
      decay
    );
    this.currentProfile.animationSpeed = this.decayTowards(
      this.currentProfile.animationSpeed, 
      DEFAULT_PROFILE.animationSpeed, 
      decay
    );
    this.currentProfile.emotionalRange = this.decayTowards(
      this.currentProfile.emotionalRange, 
      DEFAULT_PROFILE.emotionalRange, 
      decay
    );
    this.currentProfile.humorLevel = this.decayTowards(
      this.currentProfile.humorLevel, 
      DEFAULT_PROFILE.humorLevel, 
      decay
    );
    this.currentProfile.formalityLevel = this.decayTowards(
      this.currentProfile.formalityLevel, 
      DEFAULT_PROFILE.formalityLevel, 
      decay
    );
    this.currentProfile.empathyLevel = this.decayTowards(
      this.currentProfile.empathyLevel, 
      DEFAULT_PROFILE.empathyLevel, 
      decay
    );
    this.currentProfile.proactivityLevel = this.decayTowards(
      this.currentProfile.proactivityLevel, 
      DEFAULT_PROFILE.proactivityLevel, 
      decay
    );
    
    this.notifyCallbacks();
  }

  /**
   * 订阅配置变化
   */
  onProfileChange(callback: ProfileCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 更新系统配置
   */
  updateConfig(config: Partial<AdaptiveConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取系统配置
   */
  getConfig(): AdaptiveConfig {
    return { ...this.config };
  }

  /**
   * 清除反馈历史
   */
  clearHistory(): void {
    this.feedbackHistory = [];
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.callbacks.clear();
    this.feedbackHistory = [];
  }

  // 私有方法

  private checkAndApplyRules(): void {
    const now = Date.now();
    
    for (const rule of this.rules) {
      // 统计时间窗口内的触发次数
      const count = this.feedbackHistory.filter(f => 
        rule.trigger.includes(f.type) && 
        f.timestamp >= now - rule.timeWindowMs
      ).length;
      
      if (count >= rule.minOccurrences) {
        this.applyAdjustments(rule.adjustments);
      }
    }
  }

  private applyAdjustments(adjustments: Partial<ResponseProfile>): void {
    const rate = this.config.learningRate;
    
    if (adjustments.expressionIntensity !== undefined) {
      this.currentProfile.expressionIntensity += adjustments.expressionIntensity * rate;
    }
    if (adjustments.animationSpeed !== undefined) {
      this.currentProfile.animationSpeed += adjustments.animationSpeed * rate;
    }
    if (adjustments.responseVerbosity !== undefined) {
      this.currentProfile.responseVerbosity = adjustments.responseVerbosity;
    }
    if (adjustments.emotionalRange !== undefined) {
      this.currentProfile.emotionalRange += adjustments.emotionalRange * rate;
    }
    if (adjustments.humorLevel !== undefined) {
      this.currentProfile.humorLevel += adjustments.humorLevel * rate;
    }
    if (adjustments.formalityLevel !== undefined) {
      this.currentProfile.formalityLevel += adjustments.formalityLevel * rate;
    }
    if (adjustments.empathyLevel !== undefined) {
      this.currentProfile.empathyLevel += adjustments.empathyLevel * rate;
    }
    if (adjustments.proactivityLevel !== undefined) {
      this.currentProfile.proactivityLevel += adjustments.proactivityLevel * rate;
    }
    
    this.clampProfile();
    this.notifyCallbacks();
  }

  private clampProfile(): void {
    const min = 1 - this.config.maxProfileDeviation;
    const max = 1 + this.config.maxProfileDeviation;
    
    this.currentProfile.expressionIntensity = this.clamp(
      this.currentProfile.expressionIntensity, 0, 1
    );
    this.currentProfile.animationSpeed = this.clamp(
      this.currentProfile.animationSpeed, 0.5, 2.0
    );
    this.currentProfile.emotionalRange = this.clamp(
      this.currentProfile.emotionalRange, 0, 1
    );
    this.currentProfile.humorLevel = this.clamp(
      this.currentProfile.humorLevel, 0, 1
    );
    this.currentProfile.formalityLevel = this.clamp(
      this.currentProfile.formalityLevel, 0, 1
    );
    this.currentProfile.empathyLevel = this.clamp(
      this.currentProfile.empathyLevel, 0, 1
    );
    this.currentProfile.proactivityLevel = this.clamp(
      this.currentProfile.proactivityLevel, 0, 1
    );
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private decayTowards(current: number, target: number, rate: number): number {
    const diff = target - current;
    return current + diff * rate;
  }

  private notifyCallbacks(): void {
    const profile = this.getProfile();
    for (const callback of this.callbacks) {
      try {
        callback(profile);
      } catch (e) {
        console.error('[AdaptiveResponse] Callback error:', e);
      }
    }
  }
}

// 单例导出
export const adaptiveResponseSystem = new AdaptiveResponseSystem();
