/**
 * ExpressionIntensityModulator - 表情强度调节器
 * 
 * 根据上下文动态调整表情强度，让表情变化更自然、更有层次感
 * - 对话重要性感知：重要对话增强表情
 * - 疲劳模拟：长时间对话后表情自动减弱
 * - 时间感知：深夜模式表情更柔和
 * - 个性化学习：学习用户对表情强度的偏好
 */

export interface IntensityContext {
  conversationLength: number;       // 对话轮数
  lastInteractionTime: number;      // 上次交互时间
  emotionalWeight: number;          // 情感权重 0-1
  urgency: number;                  // 紧急程度 0-1
  intimacyLevel: number;            // 亲密程度 0-1
}

export interface IntensityProfile {
  baseIntensity: number;            // 基础强度 0-1
  minIntensity: number;             // 最小强度
  maxIntensity: number;             // 最大强度
  fatigueRate: number;              // 疲劳衰减率
  recoveryRate: number;             // 恢复速率
  timeOfDayInfluence: boolean;      // 是否启用时间影响
  personalizedLearning: boolean;    // 是否启用个性化学习
}

export interface ModulationResult {
  originalIntensity: number;
  modulatedIntensity: number;
  factors: IntensityFactors;
  recommendation: string;
}

export interface IntensityFactors {
  fatigue: number;                  // 疲劳因子 0-1 (1=完全疲劳)
  timeOfDay: number;                // 时间因子 0-1 (1=高能量时段)
  conversational: number;           // 对话因子 0-1
  emotional: number;                // 情感因子 0-1
  personalized: number;             // 个性化因子 0-1
  combined: number;                 // 综合因子
}

export interface IntensityHistoryEntry {
  timestamp: number;
  inputIntensity: number;
  outputIntensity: number;
  userResponse: 'positive' | 'negative' | 'neutral' | null;
}

export interface TimeZoneConfig {
  highEnergyStart: number;          // 高能量时段开始 (小时)
  highEnergyEnd: number;            // 高能量时段结束
  lowEnergyStart: number;           // 低能量时段开始
  lowEnergyEnd: number;             // 低能量时段结束
  timezone: string;                 // 时区
}

type ModulationCallback = (result: ModulationResult) => void;

// 默认配置
const DEFAULT_PROFILE: IntensityProfile = {
  baseIntensity: 0.7,
  minIntensity: 0.2,
  maxIntensity: 1.0,
  fatigueRate: 0.02,
  recoveryRate: 0.1,
  timeOfDayInfluence: true,
  personalizedLearning: true
};

const DEFAULT_TIME_CONFIG: TimeZoneConfig = {
  highEnergyStart: 9,     // 9:00
  highEnergyEnd: 18,      // 18:00
  lowEnergyStart: 23,     // 23:00
  lowEnergyEnd: 6,        // 6:00
  timezone: 'Asia/Shanghai'
};

export class ExpressionIntensityModulator {
  private static instance: ExpressionIntensityModulator | null = null;
  
  private profile: IntensityProfile;
  private timeConfig: TimeZoneConfig;
  private callbacks: Set<ModulationCallback> = new Set();
  
  // 状态追踪
  private fatigueLevel = 0;
  private lastModulationTime = Date.now();
  private conversationTurnCount = 0;
  private sessionStartTime = Date.now();
  
  // 学习数据
  private intensityHistory: IntensityHistoryEntry[] = [];
  private preferredIntensity: number | null = null;
  private learningBuffer: Map<string, number[]> = new Map();  // 按情绪类型存储
  
  // 上下文
  private currentContext: IntensityContext = {
    conversationLength: 0,
    lastInteractionTime: Date.now(),
    emotionalWeight: 0.5,
    urgency: 0,
    intimacyLevel: 0.5
  };

  private constructor(profile?: Partial<IntensityProfile>) {
    this.profile = { ...DEFAULT_PROFILE, ...profile };
    this.timeConfig = { ...DEFAULT_TIME_CONFIG };
  }

  static getInstance(): ExpressionIntensityModulator {
    if (!ExpressionIntensityModulator.instance) {
      ExpressionIntensityModulator.instance = new ExpressionIntensityModulator();
    }
    return ExpressionIntensityModulator.instance;
  }

  static resetInstance(): void {
    ExpressionIntensityModulator.instance = null;
  }

  /**
   * 调节表情强度
   */
  modulate(baseIntensity: number, emotion?: string): ModulationResult {
    const now = Date.now();
    
    // 更新疲劳状态
    this.updateFatigue(now);
    
    // 计算各个因子
    const factors = this.calculateFactors(emotion);
    
    // 应用调节
    let modulated = baseIntensity * factors.combined;
    
    // 应用边界
    modulated = this.clamp(modulated, this.profile.minIntensity, this.profile.maxIntensity);
    
    // 记录历史
    this.recordHistory(baseIntensity, modulated);
    
    // 生成建议
    const recommendation = this.generateRecommendation(factors, modulated);
    
    const result: ModulationResult = {
      originalIntensity: baseIntensity,
      modulatedIntensity: modulated,
      factors,
      recommendation
    };
    
    // 更新状态
    this.lastModulationTime = now;
    this.conversationTurnCount++;
    
    // 通知回调
    this.notifyCallbacks(result);
    
    return result;
  }

  /**
   * 批量调节 - 用于表情混合
   */
  modulateBatch(intensities: Map<string, number>): Map<string, number> {
    const result = new Map<string, number>();
    
    for (const [emotion, intensity] of intensities) {
      const modulated = this.modulate(intensity, emotion);
      result.set(emotion, modulated.modulatedIntensity);
    }
    
    return result;
  }

  /**
   * 更新对话上下文
   */
  updateContext(context: Partial<IntensityContext>): void {
    this.currentContext = {
      ...this.currentContext,
      ...context,
      lastInteractionTime: Date.now()
    };
    
    if (context.conversationLength !== undefined) {
      this.conversationTurnCount = context.conversationLength;
    }
  }

  /**
   * 记录用户反馈（用于学习）
   */
  recordUserResponse(response: 'positive' | 'negative' | 'neutral'): void {
    if (!this.profile.personalizedLearning) return;
    
    // 更新最近的历史记录
    const recent = this.intensityHistory[this.intensityHistory.length - 1];
    if (recent && recent.userResponse === null) {
      recent.userResponse = response;
      
      // 学习用户偏好
      this.learnFromResponse(recent, response);
    }
  }

  /**
   * 重置会话状态（新对话开始时调用）
   */
  resetSession(): void {
    this.fatigueLevel = 0;
    this.conversationTurnCount = 0;
    this.sessionStartTime = Date.now();
    this.currentContext = {
      conversationLength: 0,
      lastInteractionTime: Date.now(),
      emotionalWeight: 0.5,
      urgency: 0,
      intimacyLevel: 0.5
    };
  }

  /**
   * 获取当前疲劳等级
   */
  getFatigueLevel(): number {
    return this.fatigueLevel;
  }

  /**
   * 获取会话统计
   */
  getSessionStats(): {
    duration: number;
    turns: number;
    averageIntensity: number;
    fatigueLevel: number;
  } {
    const duration = Date.now() - this.sessionStartTime;
    
    let avgIntensity = 0.7;
    if (this.intensityHistory.length > 0) {
      const recent = this.intensityHistory.slice(-20);
      avgIntensity = recent.reduce((sum, h) => sum + h.outputIntensity, 0) / recent.length;
    }
    
    return {
      duration,
      turns: this.conversationTurnCount,
      averageIntensity: avgIntensity,
      fatigueLevel: this.fatigueLevel
    };
  }

  /**
   * 获取学习到的偏好强度
   */
  getPreferredIntensity(): number | null {
    return this.preferredIntensity;
  }

  /**
   * 获取指定情绪的学习数据
   */
  getEmotionLearning(emotion: string): { average: number; samples: number } | null {
    const data = this.learningBuffer.get(emotion);
    if (!data || data.length === 0) return null;
    
    return {
      average: data.reduce((a, b) => a + b, 0) / data.length,
      samples: data.length
    };
  }

  /**
   * 订阅调节事件
   */
  onModulation(callback: ModulationCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 更新配置
   */
  updateProfile(profile: Partial<IntensityProfile>): void {
    this.profile = { ...this.profile, ...profile };
  }

  /**
   * 获取配置
   */
  getProfile(): IntensityProfile {
    return { ...this.profile };
  }

  /**
   * 更新时间配置
   */
  updateTimeConfig(config: Partial<TimeZoneConfig>): void {
    this.timeConfig = { ...this.timeConfig, ...config };
  }

  /**
   * 获取时间配置
   */
  getTimeConfig(): TimeZoneConfig {
    return { ...this.timeConfig };
  }

  /**
   * 获取当前时间段类型
   */
  getCurrentTimeZone(): 'high' | 'low' | 'normal' {
    const hour = new Date().getHours();
    
    if (hour >= this.timeConfig.highEnergyStart && hour < this.timeConfig.highEnergyEnd) {
      return 'high';
    }
    
    if (hour >= this.timeConfig.lowEnergyStart || hour < this.timeConfig.lowEnergyEnd) {
      return 'low';
    }
    
    return 'normal';
  }

  /**
   * 清除学习数据
   */
  clearLearningData(): void {
    this.intensityHistory = [];
    this.learningBuffer.clear();
    this.preferredIntensity = null;
  }

  /**
   * 导出学习数据
   */
  exportLearningData(): {
    history: IntensityHistoryEntry[];
    preferences: Map<string, number[]>;
    preferredIntensity: number | null;
  } {
    return {
      history: [...this.intensityHistory],
      preferences: new Map(this.learningBuffer),
      preferredIntensity: this.preferredIntensity
    };
  }

  /**
   * 导入学习数据
   */
  importLearningData(data: {
    history?: IntensityHistoryEntry[];
    preferences?: Map<string, number[]>;
    preferredIntensity?: number | null;
  }): void {
    if (data.history) {
      this.intensityHistory = [...data.history];
    }
    if (data.preferences) {
      this.learningBuffer = new Map(data.preferences);
    }
    if (data.preferredIntensity !== undefined) {
      this.preferredIntensity = data.preferredIntensity;
    }
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.callbacks.clear();
    this.intensityHistory = [];
    this.learningBuffer.clear();
    ExpressionIntensityModulator.instance = null;
  }

  // 私有方法

  private updateFatigue(now: number): void {
    const timeSinceSession = now - this.sessionStartTime;
    const timeSinceLast = now - this.lastModulationTime;
    
    // 基于对话轮数和时长计算疲劳
    const turnFatigue = Math.min(this.conversationTurnCount * this.profile.fatigueRate, 0.4);
    const timeFatigue = Math.min(timeSinceSession / (30 * 60 * 1000), 0.3);  // 30分钟达到最大
    
    // 如果有间隔，恢复一些疲劳
    const recovery = Math.min(timeSinceLast / (5 * 60 * 1000), 1) * this.profile.recoveryRate;
    
    this.fatigueLevel = Math.max(0, Math.min(0.5, turnFatigue + timeFatigue - recovery));
  }

  private calculateFactors(emotion?: string): IntensityFactors {
    // 疲劳因子（疲劳越高，强度越低）
    const fatigue = this.fatigueLevel;
    
    // 时间因子
    let timeOfDay = 1.0;
    if (this.profile.timeOfDayInfluence) {
      const zone = this.getCurrentTimeZone();
      if (zone === 'high') timeOfDay = 1.1;
      else if (zone === 'low') timeOfDay = 0.7;
      else timeOfDay = 0.9;
    }
    
    // 对话因子（基于上下文的紧急程度和情感权重）
    const conversational = 0.7 + 
      this.currentContext.urgency * 0.2 + 
      this.currentContext.emotionalWeight * 0.1;
    
    // 情感因子
    const emotional = this.calculateEmotionalFactor(emotion);
    
    // 个性化因子
    let personalized = 1.0;
    if (this.profile.personalizedLearning && this.preferredIntensity !== null) {
      // 向用户偏好靠拢
      personalized = 0.8 + (this.preferredIntensity * 0.4);
    }
    
    // 综合因子
    const combined = (1 - fatigue * 0.3) *   // 疲劳最多降低 30%
                     timeOfDay * 
                     conversational * 
                     emotional * 
                     personalized;
    
    return {
      fatigue,
      timeOfDay,
      conversational,
      emotional,
      personalized,
      combined: this.clamp(combined, 0.3, 1.5)
    };
  }

  private calculateEmotionalFactor(emotion?: string): number {
    if (!emotion) return 1.0;
    
    // 不同情绪有不同的基础强度偏好
    const emotionWeights: Record<string, number> = {
      // 高强度情绪
      excited: 1.2,
      surprised: 1.15,
      angry: 1.1,
      fear: 1.1,
      
      // 中等强度
      happy: 1.0,
      sad: 0.95,
      loving: 1.0,
      
      // 低强度情绪
      neutral: 0.8,
      thinking: 0.85,
      bored: 0.7,
      tired: 0.6,
      
      // 其他
      shy: 0.9,
      confused: 0.95,
      relieved: 0.9
    };
    
    // 检查是否有学习数据
    const learned = this.getEmotionLearning(emotion);
    if (learned && learned.samples >= 3) {
      return emotionWeights[emotion] || 1.0 * (0.7 + learned.average * 0.6);
    }
    
    return emotionWeights[emotion] || 1.0;
  }

  private recordHistory(input: number, output: number): void {
    this.intensityHistory.push({
      timestamp: Date.now(),
      inputIntensity: input,
      outputIntensity: output,
      userResponse: null
    });
    
    // 只保留最近 100 条
    if (this.intensityHistory.length > 100) {
      this.intensityHistory = this.intensityHistory.slice(-100);
    }
  }

  private learnFromResponse(
    entry: IntensityHistoryEntry, 
    response: 'positive' | 'negative' | 'neutral'
  ): void {
    // 正面反馈：当前强度可能合适或偏低
    // 负面反馈：当前强度可能过高
    // 中性：当前强度可能合适
    
    if (response === 'positive') {
      // 记住这个强度作为好的参考
      this.updatePreferredIntensity(entry.outputIntensity, 1.0);
    } else if (response === 'negative') {
      // 降低偏好强度
      this.updatePreferredIntensity(entry.outputIntensity * 0.8, 0.5);
    }
    // 中性不更新
  }

  private updatePreferredIntensity(intensity: number, weight: number): void {
    if (this.preferredIntensity === null) {
      this.preferredIntensity = intensity;
    } else {
      // 加权平均
      this.preferredIntensity = 
        this.preferredIntensity * (1 - weight * 0.2) + 
        intensity * weight * 0.2;
    }
  }

  private generateRecommendation(factors: IntensityFactors, modulated: number): string {
    const recommendations: string[] = [];
    
    if (factors.fatigue > 0.3) {
      recommendations.push('对话较长，表情已自动柔和');
    }
    
    if (factors.timeOfDay < 0.8) {
      recommendations.push('深夜模式，表情更加温和');
    }
    
    if (modulated < 0.4) {
      recommendations.push('当前表情强度较低，建议稍后休息');
    } else if (modulated > 0.9) {
      recommendations.push('表情强度较高，充满活力');
    }
    
    return recommendations.length > 0 ? recommendations.join('；') : '表情强度适中';
  }

  private notifyCallbacks(result: ModulationResult): void {
    for (const callback of this.callbacks) {
      try {
        callback(result);
      } catch (e) {
        console.error('[IntensityModulator] Callback error:', e);
      }
    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

// 便捷函数
export function modulateIntensity(baseIntensity: number, emotion?: string): ModulationResult {
  return ExpressionIntensityModulator.getInstance().modulate(baseIntensity, emotion);
}

export function getIntensityModulator(): ExpressionIntensityModulator {
  return ExpressionIntensityModulator.getInstance();
}
