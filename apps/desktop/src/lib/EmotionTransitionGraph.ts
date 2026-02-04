/**
 * Emotion Transition Graph - 情绪过渡图
 * 
 * Phase 12: 情绪之间的自然过渡，避免突兀切换
 * 
 * 功能:
 * - 情绪状态图
 * - 自然过渡路径
 * - 过渡动画时间
 * - 中间状态插值
 * - 情绪衰减曲线
 */

import type { Expression } from './AvatarController';

// 情绪分类
export type EmotionCategory = 
  | 'positive'    // 积极情绪
  | 'negative'    // 消极情绪
  | 'neutral'     // 中性情绪
  | 'aroused'     // 高唤醒
  | 'calm';       // 低唤醒

// 情绪在情感空间中的位置 (Valence-Arousal 模型)
interface EmotionPosition {
  valence: number;   // 效价: -1 (消极) 到 1 (积极)
  arousal: number;   // 唤醒: -1 (平静) 到 1 (激动)
  category: EmotionCategory;
}

// 情绪位置映射
const EMOTION_POSITIONS: Record<Expression, EmotionPosition> = {
  // 中性
  neutral:      { valence: 0,    arousal: 0,    category: 'neutral' },
  
  // 积极 + 高唤醒
  happy:        { valence: 0.7,  arousal: 0.4,  category: 'positive' },
  excited:      { valence: 0.8,  arousal: 0.9,  category: 'aroused' },
  amused:       { valence: 0.6,  arousal: 0.5,  category: 'positive' },
  
  // 积极 + 低唤醒
  proud:        { valence: 0.6,  arousal: 0.2,  category: 'positive' },
  loving:       { valence: 0.9,  arousal: 0.3,  category: 'positive' },
  grateful:     { valence: 0.7,  arousal: 0.1,  category: 'positive' },
  hopeful:      { valence: 0.5,  arousal: 0.3,  category: 'positive' },
  relieved:     { valence: 0.4,  arousal: -0.3, category: 'calm' },
  
  // 消极 + 高唤醒
  surprised:    { valence: 0.1,  arousal: 0.8,  category: 'aroused' },
  angry:        { valence: -0.7, arousal: 0.8,  category: 'negative' },
  fear:         { valence: -0.6, arousal: 0.7,  category: 'negative' },
  anxious:      { valence: -0.4, arousal: 0.6,  category: 'negative' },
  
  // 消极 + 低唤醒
  sad:          { valence: -0.6, arousal: -0.3, category: 'negative' },
  disappointed: { valence: -0.5, arousal: -0.2, category: 'negative' },
  lonely:       { valence: -0.4, arousal: -0.4, category: 'negative' },
  bored:        { valence: -0.2, arousal: -0.5, category: 'calm' },
  disgusted:    { valence: -0.7, arousal: 0.3,  category: 'negative' },
  
  // 复杂情绪
  thinking:     { valence: 0,    arousal: 0.2,  category: 'neutral' },
  curious:      { valence: 0.3,  arousal: 0.4,  category: 'positive' },
  confused:     { valence: -0.2, arousal: 0.3,  category: 'neutral' },
  embarrassed:  { valence: -0.3, arousal: 0.4,  category: 'negative' },
  determined:   { valence: 0.2,  arousal: 0.5,  category: 'positive' },
  playful:      { valence: 0.6,  arousal: 0.6,  category: 'positive' },
};

// 过渡配置
interface TransitionConfig {
  duration: number;        // 过渡时间 (ms)
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce';
  intermediateEmotion?: Expression;  // 中间情绪 (用于非相邻过渡)
}

// 情绪过渡规则
const TRANSITION_RULES: Partial<Record<Expression, Partial<Record<Expression, TransitionConfig>>>> = {
  // 从 neutral 的过渡
  neutral: {
    happy: { duration: 400, easing: 'easeOut' },
    sad: { duration: 600, easing: 'easeIn' },
    surprised: { duration: 200, easing: 'easeOut' },
    angry: { duration: 500, easing: 'easeIn' },
    thinking: { duration: 300, easing: 'linear' },
  },
  
  // 从 happy 的过渡
  happy: {
    neutral: { duration: 500, easing: 'easeIn' },
    excited: { duration: 300, easing: 'easeOut' },
    sad: { duration: 800, easing: 'easeInOut', intermediateEmotion: 'neutral' },
    surprised: { duration: 250, easing: 'easeOut' },
    loving: { duration: 400, easing: 'easeInOut' },
  },
  
  // 从 sad 的过渡
  sad: {
    neutral: { duration: 600, easing: 'easeOut' },
    happy: { duration: 800, easing: 'easeInOut', intermediateEmotion: 'relieved' },
    angry: { duration: 500, easing: 'easeIn' },
    hopeful: { duration: 500, easing: 'easeOut' },
  },
  
  // 从 surprised 的过渡
  surprised: {
    neutral: { duration: 400, easing: 'easeIn' },
    happy: { duration: 350, easing: 'easeOut' },
    fear: { duration: 300, easing: 'easeIn' },
    confused: { duration: 300, easing: 'linear' },
    curious: { duration: 350, easing: 'easeOut' },
  },
  
  // 从 angry 的过渡
  angry: {
    neutral: { duration: 700, easing: 'easeIn' },
    sad: { duration: 600, easing: 'easeInOut' },
    determined: { duration: 400, easing: 'linear' },
  },
  
  // 从 thinking 的过渡
  thinking: {
    neutral: { duration: 300, easing: 'linear' },
    curious: { duration: 250, easing: 'easeOut' },
    confused: { duration: 300, easing: 'linear' },
    happy: { duration: 400, easing: 'easeOut', intermediateEmotion: 'curious' },
  },
};

// 默认过渡配置
const DEFAULT_TRANSITION: TransitionConfig = {
  duration: 400,
  easing: 'easeInOut',
};

export interface TransitionState {
  from: Expression;
  to: Expression;
  progress: number;        // 0-1
  intermediate?: Expression;
  startTime: number;
  config: TransitionConfig;
}

type TransitionCallback = (state: TransitionState) => void;
type EmotionChangeCallback = (emotion: Expression) => void;

export class EmotionTransitionGraph {
  private currentEmotion: Expression = 'neutral';
  private targetEmotion: Expression = 'neutral';
  private transitionState: TransitionState | null = null;
  
  private transitionCallbacks: Set<TransitionCallback> = new Set();
  private emotionCallbacks: Set<EmotionChangeCallback> = new Set();
  
  private animationFrame: number | null = null;
  private isRunning = false;

  constructor() {
    this.start();
  }

  /**
   * 获取当前情绪
   */
  getCurrentEmotion(): Expression {
    return this.currentEmotion;
  }

  /**
   * 获取目标情绪
   */
  getTargetEmotion(): Expression {
    return this.targetEmotion;
  }

  /**
   * 是否正在过渡
   */
  isTransitioning(): boolean {
    return this.transitionState !== null;
  }

  /**
   * 设置目标情绪 (会自动计算过渡路径)
   */
  setEmotion(emotion: Expression) {
    if (emotion === this.targetEmotion) return;
    
    // 如果正在过渡，先完成当前过渡
    if (this.transitionState) {
      this.currentEmotion = this.transitionState.progress > 0.5 
        ? this.transitionState.to 
        : this.transitionState.from;
    }
    
    this.targetEmotion = emotion;
    this.startTransition(this.currentEmotion, emotion);
  }

  /**
   * 立即设置情绪 (无过渡)
   */
  setEmotionImmediate(emotion: Expression) {
    this.transitionState = null;
    this.currentEmotion = emotion;
    this.targetEmotion = emotion;
    this.notifyEmotionCallbacks(emotion);
  }

  /**
   * 订阅过渡状态更新
   */
  onTransition(callback: TransitionCallback): () => void {
    this.transitionCallbacks.add(callback);
    return () => this.transitionCallbacks.delete(callback);
  }

  /**
   * 订阅情绪变化
   */
  onEmotionChange(callback: EmotionChangeCallback): () => void {
    this.emotionCallbacks.add(callback);
    return () => this.emotionCallbacks.delete(callback);
  }

  /**
   * 获取两个情绪之间的距离 (0-1)
   */
  getEmotionDistance(from: Expression, to: Expression): number {
    const posFrom = EMOTION_POSITIONS[from];
    const posTo = EMOTION_POSITIONS[to];
    
    const dv = posTo.valence - posFrom.valence;
    const da = posTo.arousal - posFrom.arousal;
    
    // 欧几里得距离，归一化到 0-1
    return Math.sqrt(dv * dv + da * da) / Math.sqrt(8);
  }

  /**
   * 获取情绪的类别
   */
  getEmotionCategory(emotion: Expression): EmotionCategory {
    return EMOTION_POSITIONS[emotion].category;
  }

  /**
   * 获取情绪位置
   */
  getEmotionPosition(emotion: Expression): EmotionPosition {
    return { ...EMOTION_POSITIONS[emotion] };
  }

  /**
   * 计算当前插值位置 (用于混合表情)
   */
  getInterpolatedPosition(): EmotionPosition {
    if (!this.transitionState) {
      return this.getEmotionPosition(this.currentEmotion);
    }
    
    const from = EMOTION_POSITIONS[this.transitionState.from];
    const to = EMOTION_POSITIONS[this.transitionState.to];
    const t = this.transitionState.progress;
    
    return {
      valence: from.valence + (to.valence - from.valence) * t,
      arousal: from.arousal + (to.arousal - from.arousal) * t,
      category: t < 0.5 ? from.category : to.category,
    };
  }

  /**
   * 停止
   */
  stop() {
    this.isRunning = false;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * 销毁
   */
  destroy() {
    this.stop();
    this.transitionCallbacks.clear();
    this.emotionCallbacks.clear();
  }

  // ========== 私有方法 ==========

  private start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }

  private animate() {
    if (!this.isRunning) return;
    
    if (this.transitionState) {
      this.updateTransition();
    }
    
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  private startTransition(from: Expression, to: Expression) {
    const config = this.getTransitionConfig(from, to);
    
    this.transitionState = {
      from,
      to,
      progress: 0,
      intermediate: config.intermediateEmotion,
      startTime: Date.now(),
      config,
    };
    
    console.log(`[EmotionTransition] ${from} → ${to} (${config.duration}ms)`);
  }

  private getTransitionConfig(from: Expression, to: Expression): TransitionConfig {
    const fromRules = TRANSITION_RULES[from];
    if (fromRules && fromRules[to]) {
      return fromRules[to]!;
    }
    
    // 使用默认配置，根据距离调整时间
    const distance = this.getEmotionDistance(from, to);
    return {
      ...DEFAULT_TRANSITION,
      duration: Math.round(300 + distance * 400),
    };
  }

  private updateTransition() {
    if (!this.transitionState) return;
    
    const elapsed = Date.now() - this.transitionState.startTime;
    const duration = this.transitionState.config.duration;
    
    let progress = Math.min(1, elapsed / duration);
    progress = this.applyEasing(progress, this.transitionState.config.easing);
    
    this.transitionState.progress = progress;
    
    // 通知过渡回调
    this.notifyTransitionCallbacks(this.transitionState);
    
    // 过渡完成
    if (progress >= 1) {
      this.currentEmotion = this.transitionState.to;
      this.transitionState = null;
      this.notifyEmotionCallbacks(this.currentEmotion);
    }
  }

  private applyEasing(t: number, easing: TransitionConfig['easing']): number {
    switch (easing) {
      case 'linear':
        return t;
      case 'easeIn':
        return t * t;
      case 'easeOut':
        return 1 - (1 - t) * (1 - t);
      case 'easeInOut':
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      case 'bounce':
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) {
          return n1 * t * t;
        } else if (t < 2 / d1) {
          return n1 * (t -= 1.5 / d1) * t + 0.75;
        } else if (t < 2.5 / d1) {
          return n1 * (t -= 2.25 / d1) * t + 0.9375;
        } else {
          return n1 * (t -= 2.625 / d1) * t + 0.984375;
        }
      default:
        return t;
    }
  }

  private notifyTransitionCallbacks(state: TransitionState) {
    for (const callback of this.transitionCallbacks) {
      try {
        callback(state);
      } catch (e) {
        console.error('[EmotionTransition] 回调错误:', e);
      }
    }
  }

  private notifyEmotionCallbacks(emotion: Expression) {
    for (const callback of this.emotionCallbacks) {
      try {
        callback(emotion);
      } catch (e) {
        console.error('[EmotionTransition] 回调错误:', e);
      }
    }
  }
}

// 单例导出
export const emotionTransitionGraph = new EmotionTransitionGraph();
