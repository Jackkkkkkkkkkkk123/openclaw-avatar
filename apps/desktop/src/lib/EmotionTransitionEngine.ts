/**
 * EmotionTransitionEngine - 情绪过渡引擎
 * 
 * 实现情绪之间的自然平滑过渡，支持：
 * - 多情绪混合过渡
 * - 自定义过渡曲线
 * - 情绪惯性（不会瞬间改变）
 * - 情绪记忆（短期情绪趋势）
 * - 情绪冲突解决
 */

export type EmotionType = 
  | 'neutral' | 'happy' | 'sad' | 'angry'
  | 'surprised' | 'fear' | 'disgust' | 'contempt'
  | 'excited' | 'calm' | 'confused' | 'thinking';

export interface EmotionState {
  type: EmotionType;
  intensity: number;      // 0-1
  timestamp: number;
}

export interface BlendedEmotion {
  primary: EmotionType;
  secondary?: EmotionType;
  primaryWeight: number;
  secondaryWeight: number;
  blendProgress: number;  // 0-1 过渡进度
}

export interface TransitionConfig {
  // 过渡速度
  transitionSpeed: number;        // ms，情绪过渡时间
  minTransitionTime: number;      // ms，最小过渡时间
  maxTransitionTime: number;      // ms，最大过渡时间
  
  // 惯性
  inertia: number;                // 0-1，情绪惯性
  momentumDecay: number;          // 0-1，动量衰减
  
  // 过渡曲线
  easingFunction: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'spring' | 'bounce';
  
  // 混合
  blendThreshold: number;         // 混合阈值，低于此值视为单一情绪
  maxBlendEmotions: number;       // 最大混合情绪数
  
  // 记忆
  memoryDuration: number;         // ms，情绪记忆持续时间
  trendInfluence: number;         // 0-1，趋势对当前情绪的影响
}

// 情绪兼容性矩阵（某些情绪可以共存，某些互斥）
const EMOTION_COMPATIBILITY: Record<EmotionType, Partial<Record<EmotionType, number>>> = {
  neutral: { happy: 0.5, sad: 0.5, calm: 0.8 },
  happy: { excited: 0.9, surprised: 0.7, calm: 0.3, sad: 0.2 },
  sad: { fear: 0.5, calm: 0.4, happy: 0.2, angry: 0.3 },
  angry: { fear: 0.4, disgust: 0.7, sad: 0.3, happy: 0.1 },
  surprised: { happy: 0.7, fear: 0.6, excited: 0.8, confused: 0.7 },
  fear: { surprised: 0.6, sad: 0.5, angry: 0.4 },
  disgust: { angry: 0.7, contempt: 0.8, sad: 0.4 },
  contempt: { disgust: 0.8, angry: 0.5 },
  excited: { happy: 0.9, surprised: 0.8 },
  calm: { neutral: 0.8, happy: 0.3, thinking: 0.7 },
  confused: { surprised: 0.7, thinking: 0.6, fear: 0.3 },
  thinking: { calm: 0.7, confused: 0.6, neutral: 0.5 }
};

// 情绪过渡距离（某些情绪过渡需要更长时间）
const EMOTION_DISTANCE: Record<EmotionType, Partial<Record<EmotionType, number>>> = {
  neutral: { happy: 0.3, sad: 0.3, angry: 0.5, surprised: 0.4, fear: 0.5 },
  happy: { sad: 0.8, angry: 0.7, fear: 0.6, neutral: 0.3 },
  sad: { happy: 0.8, angry: 0.5, excited: 0.9, neutral: 0.3 },
  angry: { happy: 0.7, calm: 0.8, neutral: 0.5 },
  surprised: { calm: 0.6, neutral: 0.4 },
  fear: { calm: 0.7, happy: 0.6 },
  disgust: { happy: 0.8, neutral: 0.5 },
  contempt: { happy: 0.7, neutral: 0.4 },
  excited: { calm: 0.7, sad: 0.9 },
  calm: { excited: 0.7, angry: 0.8 },
  confused: { calm: 0.5, neutral: 0.3 },
  thinking: { excited: 0.6, neutral: 0.3 }
};

type TransitionCallback = (blended: BlendedEmotion, state: EmotionState) => void;

export class EmotionTransitionEngine {
  private config: TransitionConfig;
  private currentState: EmotionState;
  private targetState: EmotionState | null = null;
  private transitionStartTime: number = 0;
  private transitionDuration: number = 0;
  private startState: EmotionState | null = null;
  private emotionHistory: EmotionState[] = [];
  private momentum: { type: EmotionType; velocity: number } | null = null;
  private callbacks: Set<TransitionCallback> = new Set();
  private animationId: number | null = null;
  private isDestroyed: boolean = false;

  constructor(config?: Partial<TransitionConfig>) {
    this.config = {
      transitionSpeed: 500,
      minTransitionTime: 200,
      maxTransitionTime: 2000,
      inertia: 0.3,
      momentumDecay: 0.95,
      easingFunction: 'easeInOut',
      blendThreshold: 0.1,
      maxBlendEmotions: 2,
      memoryDuration: 10000,
      trendInfluence: 0.2,
      ...config
    };

    this.currentState = {
      type: 'neutral',
      intensity: 1,
      timestamp: performance.now()
    };
  }

  /**
   * 设置目标情绪
   */
  setEmotion(type: EmotionType, intensity: number = 1): void {
    const now = performance.now();
    
    // 记录历史
    this.emotionHistory.push({ ...this.currentState });
    this.cleanupHistory(now);
    
    // 计算过渡时间
    const distance = this.getEmotionDistance(this.currentState.type, type);
    let duration = this.config.transitionSpeed * distance;
    
    // 应用惯性
    if (this.momentum && this.momentum.type === type) {
      duration *= (1 - this.config.inertia * this.momentum.velocity);
    }
    
    // 限制范围
    duration = Math.max(
      this.config.minTransitionTime,
      Math.min(this.config.maxTransitionTime, duration)
    );
    
    this.startState = { ...this.currentState };
    this.targetState = {
      type,
      intensity: Math.max(0, Math.min(1, intensity)),
      timestamp: now
    };
    this.transitionStartTime = now;
    this.transitionDuration = duration;
    
    // 更新动量
    this.updateMomentum(type);
  }

  /**
   * 立即设置情绪（无过渡）
   */
  setEmotionImmediate(type: EmotionType, intensity: number = 1): void {
    this.currentState = {
      type,
      intensity: Math.max(0, Math.min(1, intensity)),
      timestamp: performance.now()
    };
    this.targetState = null;
    this.startState = null;
    this.notifyCallbacks();
  }

  /**
   * 混合情绪
   */
  blendEmotions(emotions: Array<{ type: EmotionType; weight: number }>): void {
    if (emotions.length === 0) return;
    
    // 按权重排序
    const sorted = [...emotions].sort((a, b) => b.weight - a.weight);
    const primary = sorted[0];
    const secondary = sorted[1];
    
    // 检查兼容性
    if (secondary && this.getCompatibility(primary.type, secondary.type) < 0.3) {
      // 不兼容，只使用主要情绪
      this.setEmotion(primary.type, primary.weight);
    } else {
      // 兼容，使用混合
      this.setEmotion(primary.type, primary.weight);
    }
  }

  /**
   * 获取当前混合状态
   */
  getBlendedState(): BlendedEmotion {
    if (!this.targetState || !this.startState) {
      return {
        primary: this.currentState.type,
        primaryWeight: this.currentState.intensity,
        secondaryWeight: 0,
        blendProgress: 1
      };
    }

    const now = performance.now();
    const elapsed = now - this.transitionStartTime;
    const progress = Math.min(1, elapsed / this.transitionDuration);
    const easedProgress = this.applyEasing(progress);

    if (progress >= 1) {
      return {
        primary: this.targetState.type,
        primaryWeight: this.targetState.intensity,
        secondaryWeight: 0,
        blendProgress: 1
      };
    }

    return {
      primary: this.targetState.type,
      secondary: this.startState.type,
      primaryWeight: this.targetState.intensity * easedProgress,
      secondaryWeight: this.startState.intensity * (1 - easedProgress),
      blendProgress: easedProgress
    };
  }

  /**
   * 获取当前情绪状态
   */
  getCurrentState(): EmotionState {
    return { ...this.currentState };
  }

  /**
   * 获取目标情绪状态
   */
  getTargetState(): EmotionState | null {
    return this.targetState ? { ...this.targetState } : null;
  }

  /**
   * 是否正在过渡中
   */
  isTransitioning(): boolean {
    return this.targetState !== null;
  }

  /**
   * 获取过渡进度
   */
  getTransitionProgress(): number {
    if (!this.targetState) return 1;
    
    const elapsed = performance.now() - this.transitionStartTime;
    return Math.min(1, elapsed / this.transitionDuration);
  }

  /**
   * 获取情绪趋势（基于历史）
   */
  getEmotionTrend(): EmotionType | null {
    if (this.emotionHistory.length < 3) return null;
    
    // 统计最近的情绪频率
    const counts: Partial<Record<EmotionType, number>> = {};
    for (const state of this.emotionHistory.slice(-10)) {
      counts[state.type] = (counts[state.type] || 0) + 1;
    }
    
    let maxCount = 0;
    let trend: EmotionType | null = null;
    for (const [type, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        trend = type as EmotionType;
      }
    }
    
    return trend;
  }

  /**
   * 启动更新循环
   */
  start(): void {
    if (this.animationId !== null || this.isDestroyed) return;
    this.tick();
  }

  /**
   * 停止更新循环
   */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * 订阅状态变化
   */
  onTransition(callback: TransitionCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private tick = (): void => {
    if (this.isDestroyed) return;

    this.update();
    this.animationId = requestAnimationFrame(this.tick);
  };

  private update(): void {
    if (!this.targetState || !this.startState) return;

    const now = performance.now();
    const elapsed = now - this.transitionStartTime;
    const progress = Math.min(1, elapsed / this.transitionDuration);
    const easedProgress = this.applyEasing(progress);

    // 更新当前状态
    this.currentState = {
      type: progress >= 0.5 ? this.targetState.type : this.startState.type,
      intensity: this.startState.intensity + 
        (this.targetState.intensity - this.startState.intensity) * easedProgress,
      timestamp: now
    };

    this.notifyCallbacks();

    // 过渡完成
    if (progress >= 1) {
      this.currentState = { ...this.targetState };
      this.targetState = null;
      this.startState = null;
    }
  }

  private applyEasing(t: number): number {
    switch (this.config.easingFunction) {
      case 'linear': return t;
      case 'easeIn': return t * t;
      case 'easeOut': return t * (2 - t);
      case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case 'spring': {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 :
          Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
      }
      case 'bounce': {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) return n1 * t * t;
        if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
        if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
      }
      default: return t;
    }
  }

  private getEmotionDistance(from: EmotionType, to: EmotionType): number {
    if (from === to) return 0.1;
    return EMOTION_DISTANCE[from]?.[to] ?? EMOTION_DISTANCE[to]?.[from] ?? 0.5;
  }

  private getCompatibility(a: EmotionType, b: EmotionType): number {
    if (a === b) return 1;
    return EMOTION_COMPATIBILITY[a]?.[b] ?? EMOTION_COMPATIBILITY[b]?.[a] ?? 0.5;
  }

  private updateMomentum(type: EmotionType): void {
    if (this.momentum && this.momentum.type === type) {
      this.momentum.velocity = Math.min(1, this.momentum.velocity + 0.2);
    } else {
      this.momentum = { type, velocity: 0.1 };
    }
    
    // 衰减
    if (this.momentum) {
      this.momentum.velocity *= this.config.momentumDecay;
    }
  }

  private cleanupHistory(now: number): void {
    const cutoff = now - this.config.memoryDuration;
    this.emotionHistory = this.emotionHistory.filter(s => s.timestamp > cutoff);
  }

  private notifyCallbacks(): void {
    const blended = this.getBlendedState();
    const state = { ...this.currentState };
    
    for (const callback of this.callbacks) {
      try {
        callback(blended, state);
      } catch (e) {
        console.error('[EmotionTransition] Callback error:', e);
      }
    }
  }

  /**
   * 获取配置
   */
  getConfig(): TransitionConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<TransitionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取可用情绪列表
   */
  static getAvailableEmotions(): EmotionType[] {
    return ['neutral', 'happy', 'sad', 'angry', 'surprised', 'fear', 
            'disgust', 'contempt', 'excited', 'calm', 'confused', 'thinking'];
  }

  /**
   * 获取情绪兼容性
   */
  static getEmotionCompatibility(a: EmotionType, b: EmotionType): number {
    if (a === b) return 1;
    return EMOTION_COMPATIBILITY[a]?.[b] ?? EMOTION_COMPATIBILITY[b]?.[a] ?? 0.5;
  }

  /**
   * 重置
   */
  reset(): void {
    this.currentState = { type: 'neutral', intensity: 1, timestamp: performance.now() };
    this.targetState = null;
    this.startState = null;
    this.emotionHistory = [];
    this.momentum = null;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.isDestroyed = true;
    this.stop();
    this.callbacks.clear();
    this.emotionHistory = [];
  }
}
