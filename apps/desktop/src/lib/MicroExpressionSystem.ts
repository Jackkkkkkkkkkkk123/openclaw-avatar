/**
 * Micro Expression System - SOTA 微表情系统
 * 
 * Phase 10: 自动产生微小的面部变化，增加真实感
 * 
 * 包括:
 * - 随机眉毛微动
 * - 眼神游移
 * - 嘴角微调
 * - 情绪波动
 * - 反应性微表情 (对话时的自然反应)
 */

export interface MicroExpressionParams {
  browL: number;           // 左眉 -1 to 1
  browR: number;           // 右眉 -1 to 1
  eyeLookX: number;        // 视线水平 -1 to 1
  eyeLookY: number;        // 视线垂直 -1 to 1
  eyeWideL: number;        // 左眼睁大 0 to 1
  eyeWideR: number;        // 右眼睁大 0 to 1
  mouthCornerL: number;    // 左嘴角 -1 to 1
  mouthCornerR: number;    // 右嘴角 -1 to 1
  cheekPuff: number;       // 鼓腮 0 to 1
  noseWrinkle: number;     // 皱鼻 0 to 1
}

interface MicroExpressionConfig {
  enabled: boolean;
  
  // 眉毛微动
  brow: {
    enabled: boolean;
    frequency: number;     // 每分钟次数
    amplitude: number;     // 幅度 0-1
    asymmetry: number;     // 不对称度 0-1
  };
  
  // 眼神游移
  eyeWander: {
    enabled: boolean;
    frequency: number;     // 每分钟次数
    rangeX: number;        // 水平范围
    rangeY: number;        // 垂直范围
    smoothness: number;    // 平滑度
  };
  
  // 嘴角微调
  mouthCorner: {
    enabled: boolean;
    frequency: number;
    amplitude: number;
    asymmetry: number;
  };
  
  // 情绪波动
  emotionFluctuation: {
    enabled: boolean;
    intensity: number;     // 波动强度 0-1
    period: number;        // 波动周期 ms
  };
}

const DEFAULT_CONFIG: MicroExpressionConfig = {
  enabled: true,
  brow: {
    enabled: true,
    frequency: 8,      // 每分钟 8 次
    amplitude: 0.15,
    asymmetry: 0.3,
  },
  eyeWander: {
    enabled: true,
    frequency: 12,
    rangeX: 0.1,
    rangeY: 0.08,
    smoothness: 0.8,
  },
  mouthCorner: {
    enabled: true,
    frequency: 6,
    amplitude: 0.08,
    asymmetry: 0.4,
  },
  emotionFluctuation: {
    enabled: true,
    intensity: 0.1,
    period: 8000,
  },
};

// 反应性微表情 - 对特定触发的短暂反应
interface ReactiveMicroExpression {
  type: 'surprise' | 'interest' | 'doubt' | 'agreement' | 'thinking' | 'realization';
  duration: number;
  params: Partial<MicroExpressionParams>;
}

const REACTIVE_EXPRESSIONS: Record<string, ReactiveMicroExpression> = {
  // 听到有趣的内容
  interest: {
    type: 'interest',
    duration: 800,
    params: {
      browL: 0.3,
      browR: 0.3,
      eyeWideL: 0.1,
      eyeWideR: 0.1,
    },
  },
  // 轻微惊讶
  surprise_light: {
    type: 'surprise',
    duration: 500,
    params: {
      browL: 0.5,
      browR: 0.5,
      eyeWideL: 0.2,
      eyeWideR: 0.2,
    },
  },
  // 思考
  thinking: {
    type: 'thinking',
    duration: 2000,
    params: {
      browL: 0.2,
      browR: -0.1,
      eyeLookY: 0.2,
      eyeLookX: 0.3,
    },
  },
  // 怀疑
  doubt: {
    type: 'doubt',
    duration: 1000,
    params: {
      browL: -0.2,
      browR: 0.3,
      mouthCornerL: -0.1,
    },
  },
  // 赞同
  agreement: {
    type: 'agreement',
    duration: 600,
    params: {
      browL: 0.1,
      browR: 0.1,
      mouthCornerL: 0.15,
      mouthCornerR: 0.15,
    },
  },
  // 恍然大悟
  realization: {
    type: 'realization',
    duration: 1000,
    params: {
      browL: 0.4,
      browR: 0.4,
      eyeWideL: 0.15,
      eyeWideR: 0.15,
      mouthCornerL: 0.1,
      mouthCornerR: 0.1,
    },
  },
};

type MicroExpressionCallback = (params: MicroExpressionParams) => void;

export class MicroExpressionSystem {
  private config: MicroExpressionConfig;
  private callbacks: Set<MicroExpressionCallback> = new Set();
  
  // 当前状态
  private currentParams: MicroExpressionParams = this.getDefaultParams();
  private targetParams: MicroExpressionParams = this.getDefaultParams();
  
  // 动画
  private animationFrame: number | null = null;
  private isRunning = false;
  private startTime = 0;
  
  // 随机状态
  private browNextChange = 0;
  private eyeNextChange = 0;
  private mouthNextChange = 0;
  
  // 噪声生成器种子
  private noiseSeedX = Math.random() * 1000;
  private noiseSeedY = Math.random() * 1000;
  
  // 反应性表情
  private reactiveQueue: { expression: ReactiveMicroExpression; startTime: number }[] = [];
  
  // 基础情绪 (影响微表情倾向)
  private baseEmotion: string = 'neutral';
  
  // 是否在说话
  private isSpeaking = false;

  constructor(config: Partial<MicroExpressionConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, config);
  }

  /**
   * 订阅参数更新
   */
  onParams(callback: MicroExpressionCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 启动系统
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.startTime = Date.now();
    this.browNextChange = this.startTime;
    this.eyeNextChange = this.startTime;
    this.mouthNextChange = this.startTime;
    
    this.animate();
    console.log('[MicroExpression] 系统已启动');
  }

  /**
   * 停止系统
   */
  stop() {
    this.isRunning = false;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    console.log('[MicroExpression] 系统已停止');
  }

  /**
   * 设置基础情绪
   */
  setEmotion(emotion: string) {
    this.baseEmotion = emotion;
  }

  /**
   * 设置说话状态
   */
  setSpeaking(speaking: boolean) {
    this.isSpeaking = speaking;
  }

  /**
   * 触发反应性微表情
   */
  triggerReaction(type: keyof typeof REACTIVE_EXPRESSIONS) {
    const expression = REACTIVE_EXPRESSIONS[type];
    if (!expression) return;
    
    this.reactiveQueue.push({
      expression,
      startTime: Date.now(),
    });
  }

  /**
   * 基于文本分析触发反应
   */
  analyzeAndReact(text: string) {
    const lower = text.toLowerCase();
    
    // 问号 - 思考
    if (text.includes('?') || text.includes('？')) {
      this.triggerReaction('thinking');
    }
    // 感叹号 - 惊讶/兴趣
    else if (text.includes('!') || text.includes('！')) {
      if (lower.includes('哇') || lower.includes('wow')) {
        this.triggerReaction('surprise_light');
      } else {
        this.triggerReaction('interest');
      }
    }
    // 明白了、原来 - 恍然大悟
    else if (lower.includes('明白') || lower.includes('原来') || lower.includes('i see')) {
      this.triggerReaction('realization');
    }
    // 嗯、好的 - 赞同
    else if (lower.includes('嗯') || lower.includes('好的') || lower.includes('ok')) {
      this.triggerReaction('agreement');
    }
    // 真的吗、是吗 - 怀疑
    else if (lower.includes('真的') || lower.includes('是吗') || lower.includes('really')) {
      this.triggerReaction('doubt');
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<MicroExpressionConfig>) {
    this.config = this.mergeConfig(this.config, config);
  }

  /**
   * 获取当前参数
   */
  getCurrentParams(): MicroExpressionParams {
    return { ...this.currentParams };
  }

  /**
   * 销毁
   */
  destroy() {
    this.stop();
    this.callbacks.clear();
  }

  // ========== 私有方法 ==========

  private getDefaultParams(): MicroExpressionParams {
    return {
      browL: 0,
      browR: 0,
      eyeLookX: 0,
      eyeLookY: 0,
      eyeWideL: 0,
      eyeWideR: 0,
      mouthCornerL: 0,
      mouthCornerR: 0,
      cheekPuff: 0,
      noseWrinkle: 0,
    };
  }

  private mergeConfig(base: MicroExpressionConfig, override: Partial<MicroExpressionConfig>): MicroExpressionConfig {
    return {
      ...base,
      ...override,
      brow: { ...base.brow, ...override.brow },
      eyeWander: { ...base.eyeWander, ...override.eyeWander },
      mouthCorner: { ...base.mouthCorner, ...override.mouthCorner },
      emotionFluctuation: { ...base.emotionFluctuation, ...override.emotionFluctuation },
    };
  }

  private animate() {
    if (!this.isRunning) return;
    
    const now = Date.now();
    
    // 重置目标参数
    this.targetParams = this.getDefaultParams();
    
    // 应用各种微表情
    if (this.config.enabled) {
      this.applyBrowMicro(now);
      this.applyEyeWander(now);
      this.applyMouthCornerMicro(now);
      this.applyEmotionFluctuation(now);
      this.applyEmotionBias();
    }
    
    // 应用反应性表情
    this.applyReactiveExpressions(now);
    
    // 平滑过渡
    this.smoothTransition();
    
    // 通知回调
    this.notifyCallbacks();
    
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  /**
   * 眉毛微动
   */
  private applyBrowMicro(now: number) {
    if (!this.config.brow.enabled) return;
    
    const interval = 60000 / this.config.brow.frequency;
    
    if (now >= this.browNextChange) {
      // 生成新的眉毛目标
      const base = (Math.random() - 0.5) * 2 * this.config.brow.amplitude;
      const asymmetry = (Math.random() - 0.5) * 2 * this.config.brow.asymmetry * this.config.brow.amplitude;
      
      this.targetParams.browL = base + asymmetry;
      this.targetParams.browR = base - asymmetry;
      
      this.browNextChange = now + interval * (0.5 + Math.random());
    }
  }

  /**
   * 眼神游移
   */
  private applyEyeWander(now: number) {
    if (!this.config.eyeWander.enabled) return;
    
    // 使用 Perlin 噪声风格的平滑随机
    const time = now / 1000;
    const x = this.simplexNoise(time * 0.5 + this.noiseSeedX) * this.config.eyeWander.rangeX;
    const y = this.simplexNoise(time * 0.3 + this.noiseSeedY) * this.config.eyeWander.rangeY;
    
    this.targetParams.eyeLookX = x;
    this.targetParams.eyeLookY = y;
  }

  /**
   * 嘴角微调
   */
  private applyMouthCornerMicro(now: number) {
    if (!this.config.mouthCorner.enabled) return;
    if (this.isSpeaking) return; // 说话时不干扰
    
    const interval = 60000 / this.config.mouthCorner.frequency;
    
    if (now >= this.mouthNextChange) {
      const base = (Math.random() - 0.5) * 2 * this.config.mouthCorner.amplitude;
      const asymmetry = (Math.random() - 0.5) * 2 * this.config.mouthCorner.asymmetry * this.config.mouthCorner.amplitude;
      
      this.targetParams.mouthCornerL = base + asymmetry;
      this.targetParams.mouthCornerR = base - asymmetry;
      
      this.mouthNextChange = now + interval * (0.5 + Math.random());
    }
  }

  /**
   * 情绪波动
   */
  private applyEmotionFluctuation(now: number) {
    if (!this.config.emotionFluctuation.enabled) return;
    
    const elapsed = now - this.startTime;
    const phase = (elapsed % this.config.emotionFluctuation.period) / this.config.emotionFluctuation.period;
    const wave = Math.sin(phase * Math.PI * 2) * this.config.emotionFluctuation.intensity;
    
    // 轻微影响所有参数
    this.targetParams.browL += wave * 0.1;
    this.targetParams.browR += wave * 0.1;
    this.targetParams.mouthCornerL += wave * 0.05;
    this.targetParams.mouthCornerR += wave * 0.05;
  }

  /**
   * 根据基础情绪添加偏向
   */
  private applyEmotionBias() {
    const biases: Record<string, Partial<MicroExpressionParams>> = {
      happy: { mouthCornerL: 0.1, mouthCornerR: 0.1, browL: 0.05, browR: 0.05 },
      sad: { mouthCornerL: -0.08, mouthCornerR: -0.08, browL: -0.1, browR: -0.1 },
      surprised: { eyeWideL: 0.1, eyeWideR: 0.1, browL: 0.2, browR: 0.2 },
      angry: { browL: -0.15, browR: -0.15, noseWrinkle: 0.1 },
      thinking: { eyeLookY: 0.1, browL: 0.1, browR: -0.05 },
      curious: { browL: 0.15, browR: 0.15, eyeWideL: 0.05, eyeWideR: 0.05 },
    };
    
    const bias = biases[this.baseEmotion];
    if (bias) {
      Object.entries(bias).forEach(([key, value]) => {
        this.targetParams[key as keyof MicroExpressionParams] += value;
      });
    }
  }

  /**
   * 应用反应性表情
   */
  private applyReactiveExpressions(now: number) {
    // 清理过期的
    this.reactiveQueue = this.reactiveQueue.filter(item => {
      const elapsed = now - item.startTime;
      return elapsed < item.expression.duration;
    });
    
    // 叠加所有活动的反应性表情
    for (const item of this.reactiveQueue) {
      const elapsed = now - item.startTime;
      const duration = item.expression.duration;
      
      // 淡入淡出
      let intensity = 1;
      const fadeTime = duration * 0.2;
      if (elapsed < fadeTime) {
        intensity = elapsed / fadeTime;
      } else if (elapsed > duration - fadeTime) {
        intensity = (duration - elapsed) / fadeTime;
      }
      
      // 应用参数
      const params = item.expression.params;
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          this.targetParams[key as keyof MicroExpressionParams] += value * intensity;
        }
      });
    }
  }

  /**
   * 平滑过渡
   */
  private smoothTransition() {
    const smoothing = this.config.eyeWander.smoothness;
    
    Object.keys(this.currentParams).forEach(key => {
      const k = key as keyof MicroExpressionParams;
      this.currentParams[k] = this.lerp(this.currentParams[k], this.targetParams[k], 1 - smoothing);
    });
  }

  /**
   * 简化的噪声函数 (类似 Perlin)
   */
  private simplexNoise(t: number): number {
    // 简化实现 - 多个正弦波叠加
    return (
      Math.sin(t * 1.0) * 0.5 +
      Math.sin(t * 2.3) * 0.25 +
      Math.sin(t * 4.1) * 0.125 +
      Math.sin(t * 8.7) * 0.0625
    );
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private notifyCallbacks() {
    for (const callback of this.callbacks) {
      try {
        callback(this.currentParams);
      } catch (e) {
        console.error('[MicroExpression] 回调错误:', e);
      }
    }
  }
}

// 单例导出
export const microExpressionSystem = new MicroExpressionSystem();
