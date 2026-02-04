/**
 * EmotionMotionMapper - 情绪驱动的动作选择系统
 * 根据情绪自动选择合适的动作和表情序列
 */

import type { Emotion } from './EmotionDetector';

export interface MotionProfile {
  name: string;
  motions: string[];          // 可选动作列表
  expressions: string[];       // 可选表情列表
  idleVariations: string[];    // 待机变化
  transitionStyle: TransitionStyle;
  intensity: number;           // 动作强度 0-1
  frequency: number;           // 动作触发频率 0-1
}

export type TransitionStyle = 
  | 'smooth'      // 平滑过渡
  | 'quick'       // 快速切换
  | 'bounce'      // 弹性过渡
  | 'dramatic';   // 戏剧性过渡

export interface MotionSelection {
  motion: string | null;
  expression: string | null;
  transitionDuration: number;
  blendWeight: number;
}

export interface MotionHistory {
  motion: string;
  emotion: Emotion;
  timestamp: number;
}

export interface MapperConfig {
  historySize: number;
  repeatAvoidance: number;     // 避免重复的强度 0-1
  variationBias: number;       // 变化偏好 0-1
  intensityMultiplier: number; // 情绪强度乘数
}

type SelectionCallback = (selection: MotionSelection) => void;

export class EmotionMotionMapper {
  private static instance: EmotionMotionMapper | null = null;
  
  private profiles: Map<Emotion, MotionProfile> = new Map();
  private history: MotionHistory[] = [];
  private callbacks: Set<SelectionCallback> = new Set();
  private currentEmotion: Emotion = 'neutral';
  private currentIntensity = 0.5;
  
  private config: MapperConfig = {
    historySize: 20,
    repeatAvoidance: 0.7,
    variationBias: 0.3,
    intensityMultiplier: 1.0,
  };

  private constructor() {
    this.initializeDefaultProfiles();
  }

  static getInstance(): EmotionMotionMapper {
    if (!EmotionMotionMapper.instance) {
      EmotionMotionMapper.instance = new EmotionMotionMapper();
    }
    return EmotionMotionMapper.instance;
  }

  /**
   * 初始化默认情绪配置
   */
  private initializeDefaultProfiles(): void {
    // 中性/平静
    this.profiles.set('neutral', {
      name: 'neutral',
      motions: ['idle', 'idle_01', 'idle_02', 'blink'],
      expressions: ['neutral', 'calm'],
      idleVariations: ['idle_variation_1', 'idle_variation_2'],
      transitionStyle: 'smooth',
      intensity: 0.3,
      frequency: 0.2,
    });

    // 开心
    this.profiles.set('happy', {
      name: 'happy',
      motions: ['happy_idle', 'nod', 'bounce', 'clap'],
      expressions: ['happy', 'smile', 'joy', 'kaixin'],
      idleVariations: ['happy_sway', 'happy_bounce'],
      transitionStyle: 'bounce',
      intensity: 0.8,
      frequency: 0.5,
    });

    // 悲伤
    this.profiles.set('sad', {
      name: 'sad',
      motions: ['sad_idle', 'sigh', 'look_down'],
      expressions: ['sad', 'melancholy', 'shangxin'],
      idleVariations: ['sad_sway'],
      transitionStyle: 'smooth',
      intensity: 0.4,
      frequency: 0.1,
    });

    // 惊讶
    this.profiles.set('surprised', {
      name: 'surprised',
      motions: ['surprised', 'jump_back', 'gasp'],
      expressions: ['surprised', 'shocked', 'amazed'],
      idleVariations: ['alert_idle'],
      transitionStyle: 'quick',
      intensity: 0.9,
      frequency: 0.7,
    });

    // 愤怒
    this.profiles.set('angry', {
      name: 'angry',
      motions: ['angry_idle', 'stomp', 'shake_head'],
      expressions: ['angry', 'frustrated', 'annoyed'],
      idleVariations: ['tense_idle'],
      transitionStyle: 'dramatic',
      intensity: 0.85,
      frequency: 0.4,
    });

    // 恐惧
    this.profiles.set('fear', {
      name: 'fear',
      motions: ['scared', 'tremble', 'hide'],
      expressions: ['fear', 'worried', 'anxious'],
      idleVariations: ['nervous_idle'],
      transitionStyle: 'quick',
      intensity: 0.7,
      frequency: 0.6,
    });

    // 思考
    this.profiles.set('thinking', {
      name: 'thinking',
      motions: ['think', 'chin_touch', 'look_up'],
      expressions: ['thinking', 'pondering', 'curious'],
      idleVariations: ['contemplative_idle'],
      transitionStyle: 'smooth',
      intensity: 0.5,
      frequency: 0.3,
    });

    // 害羞
    this.profiles.set('shy', {
      name: 'shy',
      motions: ['shy', 'look_away', 'fidget'],
      expressions: ['shy', 'embarrassed', 'haixiu'],
      idleVariations: ['shy_sway'],
      transitionStyle: 'smooth',
      intensity: 0.4,
      frequency: 0.2,
    });
  }

  /**
   * 设置当前情绪
   */
  setEmotion(emotion: Emotion, intensity = 0.5): MotionSelection {
    this.currentEmotion = emotion;
    this.currentIntensity = Math.max(0, Math.min(1, intensity));
    
    const selection = this.selectMotion();
    this.notifySelection(selection);
    
    return selection;
  }

  /**
   * 获取当前情绪
   */
  getCurrentEmotion(): { emotion: Emotion; intensity: number } {
    return {
      emotion: this.currentEmotion,
      intensity: this.currentIntensity,
    };
  }

  /**
   * 根据当前情绪选择动作
   */
  selectMotion(): MotionSelection {
    const profile = this.profiles.get(this.currentEmotion);
    
    if (!profile) {
      return {
        motion: null,
        expression: null,
        transitionDuration: 200,
        blendWeight: 0.5,
      };
    }

    const effectiveIntensity = this.currentIntensity * this.config.intensityMultiplier;
    
    // 根据频率决定是否触发动作
    const shouldTriggerMotion = Math.random() < profile.frequency * effectiveIntensity;
    
    // 选择动作
    const motion = shouldTriggerMotion 
      ? this.selectWithAvoidance(profile.motions)
      : this.selectWithAvoidance(profile.idleVariations) || profile.motions[0];
    
    // 选择表情
    const expression = this.selectWithAvoidance(profile.expressions);
    
    // 记录历史
    if (motion) {
      this.recordHistory(motion);
    }

    // 计算过渡时间
    const transitionDuration = this.calculateTransitionDuration(profile.transitionStyle);
    
    // 计算混合权重
    const blendWeight = profile.intensity * effectiveIntensity;

    return {
      motion,
      expression,
      transitionDuration,
      blendWeight,
    };
  }

  /**
   * 避免重复选择
   */
  private selectWithAvoidance(options: string[]): string | null {
    if (!options || options.length === 0) return null;
    if (options.length === 1) return options[0];

    // 获取最近使用的动作
    const recentMotions = new Set(
      this.history.slice(-5).map(h => h.motion)
    );

    // 过滤掉最近使用的
    let available = options.filter(o => !recentMotions.has(o));
    
    // 如果全部都用过了，根据避免强度决定
    if (available.length === 0 || Math.random() > this.config.repeatAvoidance) {
      available = options;
    }

    // 随机选择
    const index = Math.floor(Math.random() * available.length);
    return available[index];
  }

  /**
   * 计算过渡时间
   */
  private calculateTransitionDuration(style: TransitionStyle): number {
    const baseDurations: Record<TransitionStyle, number> = {
      smooth: 300,
      quick: 100,
      bounce: 200,
      dramatic: 400,
    };

    const base = baseDurations[style] || 200;
    // 加入一些随机性
    const variation = base * 0.2 * (Math.random() - 0.5);
    
    return Math.round(base + variation);
  }

  /**
   * 记录动作历史
   */
  private recordHistory(motion: string): void {
    this.history.push({
      motion,
      emotion: this.currentEmotion,
      timestamp: Date.now(),
    });

    // 限制历史大小
    if (this.history.length > this.config.historySize) {
      this.history.shift();
    }
  }

  /**
   * 获取动作历史
   */
  getHistory(): MotionHistory[] {
    return [...this.history];
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * 获取情绪配置
   */
  getProfile(emotion: Emotion): MotionProfile | undefined {
    const profile = this.profiles.get(emotion);
    return profile ? { ...profile } : undefined;
  }

  /**
   * 设置/更新情绪配置
   */
  setProfile(emotion: Emotion, profile: Partial<MotionProfile>): void {
    const existing = this.profiles.get(emotion);
    
    if (existing) {
      this.profiles.set(emotion, { ...existing, ...profile });
    } else {
      this.profiles.set(emotion, {
        name: emotion,
        motions: [],
        expressions: [],
        idleVariations: [],
        transitionStyle: 'smooth',
        intensity: 0.5,
        frequency: 0.3,
        ...profile,
      });
    }
  }

  /**
   * 获取所有情绪配置
   */
  getAllProfiles(): Map<Emotion, MotionProfile> {
    return new Map(this.profiles);
  }

  /**
   * 推荐下一个动作 (基于当前状态)
   */
  recommendNext(): MotionSelection {
    // 基于变化偏好可能切换情绪
    if (Math.random() < this.config.variationBias) {
      // 小概率变化情绪强度
      const intensityDelta = (Math.random() - 0.5) * 0.2;
      this.currentIntensity = Math.max(0.1, Math.min(1, this.currentIntensity + intensityDelta));
    }

    return this.selectMotion();
  }

  /**
   * 获取情绪兼容的动作列表
   */
  getCompatibleMotions(emotion: Emotion): string[] {
    const profile = this.profiles.get(emotion);
    if (!profile) return [];
    
    return [...profile.motions, ...profile.idleVariations];
  }

  /**
   * 检查动作是否与情绪兼容
   */
  isMotionCompatible(motion: string, emotion: Emotion): boolean {
    const compatible = this.getCompatibleMotions(emotion);
    return compatible.includes(motion);
  }

  /**
   * 订阅选择事件
   */
  onSelection(callback: SelectionCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 通知选择
   */
  private notifySelection(selection: MotionSelection): void {
    this.callbacks.forEach(cb => {
      try {
        cb(selection);
      } catch (e) {
        console.error('[EmotionMotionMapper] Callback error:', e);
      }
    });
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<MapperConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): MapperConfig {
    return { ...this.config };
  }

  /**
   * 重置到默认状态
   */
  reset(): void {
    this.history = [];
    this.currentEmotion = 'neutral';
    this.currentIntensity = 0.5;
    this.initializeDefaultProfiles();
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.profiles.clear();
    this.history = [];
    this.callbacks.clear();
    EmotionMotionMapper.instance = null;
  }
}

export const emotionMotionMapper = EmotionMotionMapper.getInstance();
