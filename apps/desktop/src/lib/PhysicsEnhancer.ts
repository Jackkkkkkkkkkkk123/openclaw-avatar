/**
 * Physics Enhancer - 物理模拟增强系统
 * 
 * Phase 11: 增强头发、衣服、装饰物的物理效果
 * 
 * 功能:
 * - 惯性模拟 (头部移动时头发跟随延迟)
 * - 风力模拟
 * - 呼吸对身体的影响
 * - 说话时的振动
 * - 情绪对物理的影响
 */

export interface PhysicsConfig {
  enabled: boolean;
  
  // 惯性系统
  inertia: {
    enabled: boolean;
    hairDamping: number;       // 头发阻尼 0-1
    clothDamping: number;      // 衣服阻尼 0-1
    accessoryDamping: number;  // 饰品阻尼 0-1
    responsiveness: number;    // 响应速度 0-1
  };
  
  // 风力系统
  wind: {
    enabled: boolean;
    baseStrength: number;      // 基础风力
    gustFrequency: number;     // 阵风频率 (Hz)
    gustStrength: number;      // 阵风强度
    direction: number;         // 风向角度 (度)
  };
  
  // 呼吸影响
  breath: {
    enabled: boolean;
    hairInfluence: number;     // 对头发的影响 0-1
    clothInfluence: number;    // 对衣服的影响 0-1
  };
  
  // 说话振动
  speech: {
    enabled: boolean;
    vibrationStrength: number; // 振动强度 0-1
    frequency: number;         // 振动频率
  };
}

const DEFAULT_CONFIG: PhysicsConfig = {
  enabled: true,
  inertia: {
    enabled: true,
    hairDamping: 0.85,
    clothDamping: 0.9,
    accessoryDamping: 0.8,
    responsiveness: 0.3,
  },
  wind: {
    enabled: false,  // 默认关闭，按需开启
    baseStrength: 0.02,
    gustFrequency: 0.3,
    gustStrength: 0.05,
    direction: 90,  // 从右边吹来
  },
  breath: {
    enabled: true,
    hairInfluence: 0.3,
    clothInfluence: 0.5,
  },
  speech: {
    enabled: true,
    vibrationStrength: 0.15,
    frequency: 8,
  },
};

// 物理参数输出
export interface PhysicsParams {
  // 头发参数
  hairAngleX: number;      // 头发 X 轴旋转
  hairAngleZ: number;      // 头发 Z 轴旋转
  hairSwing: number;       // 头发摆动
  
  // 衣服参数
  clothSwing: number;      // 衣服摆动
  skirtAngle: number;      // 裙摆角度
  
  // 饰品参数
  accessorySwing: number;  // 饰品摆动
  ribbonAngle: number;     // 丝带角度
  
  // 身体参数
  bodyBreath: number;      // 呼吸起伏
  shoulderMove: number;    // 肩膀微动
}

type PhysicsCallback = (params: PhysicsParams) => void;

export class PhysicsEnhancer {
  private config: PhysicsConfig;
  private callbacks: Set<PhysicsCallback> = new Set();
  
  // 当前状态
  private currentParams: PhysicsParams;
  private targetParams: PhysicsParams;
  
  // 输入状态
  private headVelocity = { x: 0, y: 0 };
  private lastHeadPosition = { x: 0, y: 0 };
  private breathPhase = 0;
  private isSpeaking = false;
  private speakingIntensity = 0;
  private emotionMultiplier = 1;
  
  // 动画
  private animationFrame: number | null = null;
  private isRunning = false;
  private startTime = 0;
  private lastTime = 0;

  constructor(config: Partial<PhysicsConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, config);
    this.currentParams = this.getDefaultParams();
    this.targetParams = this.getDefaultParams();
  }

  /**
   * 订阅物理参数更新
   */
  onParams(callback: PhysicsCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 启动物理模拟
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.startTime = Date.now();
    this.lastTime = this.startTime;
    this.animate();
    
    console.log('[PhysicsEnhancer] 物理模拟已启动');
  }

  /**
   * 停止物理模拟
   */
  stop() {
    this.isRunning = false;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    console.log('[PhysicsEnhancer] 物理模拟已停止');
  }

  /**
   * 更新头部位置 (用于惯性计算)
   */
  updateHeadPosition(x: number, y: number) {
    const dx = x - this.lastHeadPosition.x;
    const dy = y - this.lastHeadPosition.y;
    
    // 平滑速度计算
    this.headVelocity.x = this.headVelocity.x * 0.7 + dx * 0.3;
    this.headVelocity.y = this.headVelocity.y * 0.7 + dy * 0.3;
    
    this.lastHeadPosition = { x, y };
  }

  /**
   * 设置呼吸相位 (0-1)
   */
  setBreathPhase(phase: number) {
    this.breathPhase = phase;
  }

  /**
   * 设置说话状态
   */
  setSpeaking(speaking: boolean, intensity = 0.5) {
    this.isSpeaking = speaking;
    this.speakingIntensity = intensity;
  }

  /**
   * 设置情绪 (影响物理表现)
   */
  setEmotion(emotion: string) {
    const emotionMultipliers: Record<string, number> = {
      neutral: 1.0,
      happy: 1.2,      // 开心时物理更活跃
      excited: 1.5,    // 兴奋时更夸张
      sad: 0.7,        // 悲伤时更沉重
      calm: 0.8,
      angry: 1.3,
      surprised: 1.4,
    };
    
    this.emotionMultiplier = emotionMultipliers[emotion] ?? 1.0;
  }

  /**
   * 启用/禁用风力
   */
  setWindEnabled(enabled: boolean) {
    this.config.wind.enabled = enabled;
  }

  /**
   * 设置风向
   */
  setWindDirection(degrees: number) {
    this.config.wind.direction = degrees;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PhysicsConfig>) {
    this.config = this.mergeConfig(this.config, config);
  }

  /**
   * 获取当前参数
   */
  getCurrentParams(): PhysicsParams {
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

  private getDefaultParams(): PhysicsParams {
    return {
      hairAngleX: 0,
      hairAngleZ: 0,
      hairSwing: 0,
      clothSwing: 0,
      skirtAngle: 0,
      accessorySwing: 0,
      ribbonAngle: 0,
      bodyBreath: 0,
      shoulderMove: 0,
    };
  }

  private mergeConfig(base: PhysicsConfig, override: Partial<PhysicsConfig>): PhysicsConfig {
    return {
      ...base,
      ...override,
      inertia: { ...base.inertia, ...override.inertia },
      wind: { ...base.wind, ...override.wind },
      breath: { ...base.breath, ...override.breath },
      speech: { ...base.speech, ...override.speech },
    };
  }

  private animate() {
    if (!this.isRunning) return;
    
    const now = Date.now();
    const deltaTime = (now - this.lastTime) / 1000;
    this.lastTime = now;
    
    // 重置目标参数
    this.targetParams = this.getDefaultParams();
    
    if (this.config.enabled) {
      // 应用惯性
      this.applyInertia();
      
      // 应用风力
      this.applyWind(now);
      
      // 应用呼吸影响
      this.applyBreathInfluence();
      
      // 应用说话振动
      this.applySpeechVibration(now);
      
      // 应用情绪倍数
      this.applyEmotionMultiplier();
    }
    
    // 平滑过渡
    this.smoothTransition(deltaTime);
    
    // 通知回调
    this.notifyCallbacks();
    
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  /**
   * 应用惯性效果
   */
  private applyInertia() {
    if (!this.config.inertia.enabled) return;
    
    const inertia = this.config.inertia;
    
    // 头发跟随头部移动，但有延迟
    this.targetParams.hairAngleX = -this.headVelocity.y * 20 * (1 - inertia.hairDamping);
    this.targetParams.hairAngleZ = -this.headVelocity.x * 15 * (1 - inertia.hairDamping);
    
    // 头发摆动
    this.targetParams.hairSwing = Math.abs(this.headVelocity.x) * 10 * (1 - inertia.hairDamping);
    
    // 衣服跟随
    this.targetParams.clothSwing = Math.abs(this.headVelocity.x) * 5 * (1 - inertia.clothDamping);
    
    // 饰品摆动
    this.targetParams.accessorySwing = (this.headVelocity.x + this.headVelocity.y * 0.5) * 8 * (1 - inertia.accessoryDamping);
  }

  /**
   * 应用风力效果
   */
  private applyWind(now: number) {
    if (!this.config.wind.enabled) return;
    
    const wind = this.config.wind;
    const elapsed = (now - this.startTime) / 1000;
    
    // 基础风力 + 阵风
    const gustNoise = Math.sin(elapsed * wind.gustFrequency * Math.PI * 2);
    const gustValue = gustNoise > 0.5 ? (gustNoise - 0.5) * 2 * wind.gustStrength : 0;
    const totalStrength = wind.baseStrength + gustValue;
    
    // 风向分解
    const windRad = (wind.direction * Math.PI) / 180;
    const windX = Math.cos(windRad) * totalStrength;
    const windZ = Math.sin(windRad) * totalStrength;
    
    // 应用到头发
    this.targetParams.hairAngleX += windZ * 10;
    this.targetParams.hairAngleZ += windX * 15;
    this.targetParams.hairSwing += totalStrength * 5;
    
    // 应用到衣服
    this.targetParams.clothSwing += totalStrength * 8;
    this.targetParams.skirtAngle += windX * 10;
    
    // 应用到饰品
    this.targetParams.ribbonAngle += windX * 20;
  }

  /**
   * 应用呼吸影响
   */
  private applyBreathInfluence() {
    if (!this.config.breath.enabled) return;
    
    const breath = this.config.breath;
    const breathValue = Math.sin(this.breathPhase * Math.PI * 2);
    
    // 呼吸对头发的影响 (微微起伏)
    this.targetParams.hairAngleX += breathValue * breath.hairInfluence * 2;
    
    // 呼吸对衣服的影响
    this.targetParams.clothSwing += breathValue * breath.clothInfluence * 3;
    
    // 身体起伏
    this.targetParams.bodyBreath = breathValue * 0.5;
    
    // 肩膀微动
    this.targetParams.shoulderMove = breathValue * 0.2;
  }

  /**
   * 应用说话振动
   */
  private applySpeechVibration(now: number) {
    if (!this.config.speech.enabled || !this.isSpeaking) return;
    
    const speech = this.config.speech;
    const elapsed = (now - this.startTime) / 1000;
    
    // 高频振动
    const vibration = Math.sin(elapsed * speech.frequency * Math.PI * 2) * speech.vibrationStrength * this.speakingIntensity;
    
    // 应用到头发
    this.targetParams.hairSwing += Math.abs(vibration) * 2;
    
    // 应用到饰品
    this.targetParams.accessorySwing += vibration * 3;
    this.targetParams.ribbonAngle += vibration * 5;
  }

  /**
   * 应用情绪倍数
   */
  private applyEmotionMultiplier() {
    const m = this.emotionMultiplier;
    
    this.targetParams.hairAngleX *= m;
    this.targetParams.hairAngleZ *= m;
    this.targetParams.hairSwing *= m;
    this.targetParams.clothSwing *= m;
    this.targetParams.skirtAngle *= m;
    this.targetParams.accessorySwing *= m;
    this.targetParams.ribbonAngle *= m;
  }

  /**
   * 平滑过渡
   */
  private smoothTransition(deltaTime: number) {
    const smoothing = 1 - Math.pow(0.001, deltaTime);
    
    Object.keys(this.currentParams).forEach(key => {
      const k = key as keyof PhysicsParams;
      this.currentParams[k] = this.lerp(this.currentParams[k], this.targetParams[k], smoothing);
    });
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private notifyCallbacks() {
    for (const callback of this.callbacks) {
      try {
        callback(this.currentParams);
      } catch (e) {
        console.error('[PhysicsEnhancer] 回调错误:', e);
      }
    }
  }
}

// 单例导出
export const physicsEnhancer = new PhysicsEnhancer();
