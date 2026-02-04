/**
 * EyeBrowAnimator - 眉毛精细动画控制系统
 * 
 * 支持：
 * - 左右眉毛独立控制
 * - 眉毛形状变形（上扬、皱眉、挑眉等）
 * - 情绪驱动的眉毛动画
 * - 自然微动和呼吸联动
 * - 语音韵律联动（语调影响眉毛）
 */

export interface BrowState {
  // 左眉
  leftRaise: number;      // 上扬程度 0-1
  leftLower: number;      // 下压程度 0-1
  leftInner: number;      // 内侧（皱眉）0-1
  leftOuter: number;      // 外侧（挑眉）0-1
  
  // 右眉
  rightRaise: number;
  rightLower: number;
  rightInner: number;
  rightOuter: number;
}

export interface BrowPreset {
  name: string;
  state: Partial<BrowState>;
  duration?: number;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce';
}

export interface BrowAnimatorConfig {
  // 微动配置
  microMovement: {
    enabled: boolean;
    amplitude: number;      // 幅度 0-1
    frequency: number;      // 频率（ms）
    asymmetry: number;      // 不对称度 0-1
  };
  // 呼吸联动
  breathSync: {
    enabled: boolean;
    influence: number;      // 影响程度 0-1
  };
  // 语音联动
  voiceSync: {
    enabled: boolean;
    pitchInfluence: number; // 音调影响 0-1
    intensityInfluence: number; // 强度影响 0-1
  };
  // 平滑参数
  smoothing: number;        // 平滑系数 0-1
  transitionSpeed: number;  // 过渡速度 ms
}

export type BrowEmotion = 
  | 'neutral' | 'happy' | 'sad' | 'angry' 
  | 'surprised' | 'fear' | 'disgust' | 'contempt'
  | 'confused' | 'skeptical' | 'interested' | 'worried';

// 预设眉毛状态
const EMOTION_BROW_PRESETS: Record<BrowEmotion, Partial<BrowState>> = {
  neutral: {
    leftRaise: 0, leftLower: 0, leftInner: 0, leftOuter: 0,
    rightRaise: 0, rightLower: 0, rightInner: 0, rightOuter: 0
  },
  happy: {
    leftRaise: 0.3, leftOuter: 0.2,
    rightRaise: 0.3, rightOuter: 0.2
  },
  sad: {
    leftInner: 0.5, leftOuter: -0.2,
    rightInner: 0.5, rightOuter: -0.2
  },
  angry: {
    leftLower: 0.6, leftInner: 0.8,
    rightLower: 0.6, rightInner: 0.8
  },
  surprised: {
    leftRaise: 0.8, rightRaise: 0.8
  },
  fear: {
    leftRaise: 0.6, leftInner: 0.4,
    rightRaise: 0.6, rightInner: 0.4
  },
  disgust: {
    leftLower: 0.3, leftInner: 0.4,
    rightLower: 0.3, rightInner: 0.4
  },
  contempt: {
    leftRaise: 0.2, rightLower: 0.3
  },
  confused: {
    leftRaise: 0.4, rightInner: 0.3
  },
  skeptical: {
    leftRaise: 0.5, rightLower: 0.1
  },
  interested: {
    leftRaise: 0.4, leftOuter: 0.3,
    rightRaise: 0.4, rightOuter: 0.3
  },
  worried: {
    leftInner: 0.6, leftRaise: 0.3,
    rightInner: 0.6, rightRaise: 0.3
  }
};

export class EyeBrowAnimator {
  private currentState: BrowState;
  private targetState: BrowState;
  private config: BrowAnimatorConfig;
  private callbacks: Set<(state: BrowState) => void> = new Set();
  private animationId: number | null = null;
  private lastUpdate: number = 0;
  private microPhase: number = 0;
  private breathPhase: number = 0;
  private isDestroyed: boolean = false;
  private customPresets: Map<string, BrowPreset> = new Map();
  private transitionQueue: Array<{
    target: Partial<BrowState>;
    duration: number;
    easing: string;
    startTime: number;
    startState: BrowState;
  }> = [];

  constructor(config?: Partial<BrowAnimatorConfig>) {
    this.config = {
      microMovement: {
        enabled: true,
        amplitude: 0.05,
        frequency: 3000,
        asymmetry: 0.3
      },
      breathSync: {
        enabled: true,
        influence: 0.02
      },
      voiceSync: {
        enabled: true,
        pitchInfluence: 0.3,
        intensityInfluence: 0.2
      },
      smoothing: 0.15,
      transitionSpeed: 300,
      ...config
    };

    this.currentState = this.createDefaultState();
    this.targetState = this.createDefaultState();
  }

  private createDefaultState(): BrowState {
    return {
      leftRaise: 0, leftLower: 0, leftInner: 0, leftOuter: 0,
      rightRaise: 0, rightLower: 0, rightInner: 0, rightOuter: 0
    };
  }

  /**
   * 设置目标眉毛状态
   */
  setState(state: Partial<BrowState>): void {
    this.targetState = { ...this.targetState, ...state };
  }

  /**
   * 设置情绪对应的眉毛状态
   */
  setEmotion(emotion: BrowEmotion, intensity: number = 1): void {
    const preset = EMOTION_BROW_PRESETS[emotion];
    if (!preset) return;

    const scaledState: Partial<BrowState> = {};
    for (const [key, value] of Object.entries(preset)) {
      if (typeof value === 'number') {
        scaledState[key as keyof BrowState] = value * Math.max(0, Math.min(1, intensity));
      }
    }

    this.setState(scaledState);
  }

  /**
   * 播放预设动画
   */
  playPreset(preset: BrowPreset): void {
    const duration = preset.duration ?? this.config.transitionSpeed;
    const easing = preset.easing ?? 'easeInOut';

    this.transitionQueue.push({
      target: preset.state,
      duration,
      easing,
      startTime: performance.now(),
      startState: { ...this.currentState }
    });
  }

  /**
   * 添加自定义预设
   */
  addPreset(name: string, preset: BrowPreset): void {
    this.customPresets.set(name, preset);
  }

  /**
   * 获取预设
   */
  getPreset(name: string): BrowPreset | undefined {
    return this.customPresets.get(name);
  }

  /**
   * 播放自定义预设
   */
  playCustomPreset(name: string): boolean {
    const preset = this.customPresets.get(name);
    if (!preset) return false;
    this.playPreset(preset);
    return true;
  }

  /**
   * 语音韵律更新
   */
  updateFromVoice(pitch: number, intensity: number): void {
    if (!this.config.voiceSync.enabled) return;

    // 高音调 → 眉毛上扬
    const pitchEffect = (pitch - 0.5) * 2 * this.config.voiceSync.pitchInfluence;
    // 高强度 → 眉毛微微皱起
    const intensityEffect = intensity * this.config.voiceSync.intensityInfluence;

    this.setState({
      leftRaise: Math.max(0, pitchEffect),
      rightRaise: Math.max(0, pitchEffect),
      leftInner: intensityEffect * 0.5,
      rightInner: intensityEffect * 0.5
    });
  }

  /**
   * 呼吸同步更新
   */
  updateBreathPhase(phase: number): void {
    this.breathPhase = phase;
  }

  /**
   * 启动动画循环
   */
  start(): void {
    if (this.animationId !== null || this.isDestroyed) return;
    this.lastUpdate = performance.now();
    this.tick();
  }

  /**
   * 停止动画循环
   */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * 重置到默认状态
   */
  reset(): void {
    this.currentState = this.createDefaultState();
    this.targetState = this.createDefaultState();
    this.transitionQueue = [];
    this.notifyCallbacks();
  }

  private tick = (): void => {
    if (this.isDestroyed) return;

    const now = performance.now();
    const deltaTime = now - this.lastUpdate;
    this.lastUpdate = now;

    // 处理过渡队列
    this.processTransitions(now);

    // 微动
    if (this.config.microMovement.enabled) {
      this.applyMicroMovement(now);
    }

    // 呼吸联动
    if (this.config.breathSync.enabled) {
      this.applyBreathSync();
    }

    // 平滑过渡到目标状态
    this.smoothToTarget(deltaTime);

    // 通知回调
    this.notifyCallbacks();

    this.animationId = requestAnimationFrame(this.tick);
  };

  private processTransitions(now: number): void {
    if (this.transitionQueue.length === 0) return;

    const transition = this.transitionQueue[0];
    const elapsed = now - transition.startTime;
    const progress = Math.min(1, elapsed / transition.duration);

    // 应用 easing
    const easedProgress = this.applyEasing(progress, transition.easing);

    // 插值
    for (const [key, targetValue] of Object.entries(transition.target)) {
      if (typeof targetValue === 'number') {
        const startValue = transition.startState[key as keyof BrowState];
        this.targetState[key as keyof BrowState] = 
          startValue + (targetValue - startValue) * easedProgress;
      }
    }

    // 完成后移除
    if (progress >= 1) {
      this.transitionQueue.shift();
    }
  }

  private applyEasing(t: number, easing: string): number {
    switch (easing) {
      case 'linear': return t;
      case 'easeIn': return t * t;
      case 'easeOut': return t * (2 - t);
      case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
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

  private applyMicroMovement(now: number): void {
    this.microPhase += (now - this.lastUpdate) / this.config.microMovement.frequency;

    const amplitude = this.config.microMovement.amplitude;
    const asymmetry = this.config.microMovement.asymmetry;

    // 使用不同相位让左右眉毛不完全同步
    const leftPhase = this.microPhase;
    const rightPhase = this.microPhase + asymmetry * Math.PI;

    // Perlin 风格的平滑随机
    const leftNoise = Math.sin(leftPhase) * 0.5 + Math.sin(leftPhase * 2.3) * 0.3 + Math.sin(leftPhase * 4.7) * 0.2;
    const rightNoise = Math.sin(rightPhase) * 0.5 + Math.sin(rightPhase * 2.3) * 0.3 + Math.sin(rightPhase * 4.7) * 0.2;

    this.targetState.leftRaise += leftNoise * amplitude;
    this.targetState.rightRaise += rightNoise * amplitude;
  }

  private applyBreathSync(): void {
    const influence = this.config.breathSync.influence;
    const breathEffect = Math.sin(this.breathPhase) * influence;

    this.targetState.leftRaise += breathEffect;
    this.targetState.rightRaise += breathEffect;
  }

  private smoothToTarget(deltaTime: number): void {
    const factor = 1 - Math.pow(1 - this.config.smoothing, deltaTime / 16.67);

    for (const key of Object.keys(this.currentState) as (keyof BrowState)[]) {
      const current = this.currentState[key];
      const target = this.targetState[key];
      this.currentState[key] = current + (target - current) * factor;
    }
  }

  /**
   * 订阅状态变化
   */
  onStateChange(callback: (state: BrowState) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyCallbacks(): void {
    const state = { ...this.currentState };
    for (const callback of this.callbacks) {
      try {
        callback(state);
      } catch (e) {
        console.error('[EyeBrowAnimator] Callback error:', e);
      }
    }
  }

  /**
   * 获取当前状态
   */
  getState(): BrowState {
    return { ...this.currentState };
  }

  /**
   * 获取配置
   */
  getConfig(): BrowAnimatorConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<BrowAnimatorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取可用的情绪列表
   */
  static getAvailableEmotions(): BrowEmotion[] {
    return Object.keys(EMOTION_BROW_PRESETS) as BrowEmotion[];
  }

  /**
   * 获取情绪预设
   */
  static getEmotionPreset(emotion: BrowEmotion): Partial<BrowState> | undefined {
    return EMOTION_BROW_PRESETS[emotion];
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.isDestroyed = true;
    this.stop();
    this.callbacks.clear();
    this.transitionQueue = [];
    this.customPresets.clear();
  }
}
