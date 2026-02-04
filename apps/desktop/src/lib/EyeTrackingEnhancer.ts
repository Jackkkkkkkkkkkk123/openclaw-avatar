/**
 * EyeTrackingEnhancer - 眼动追踪增强系统
 * 
 * 功能：
 * - 眼睛微动 (Microsaccades) - 注视时的微小抖动
 * - 眨眼同步 - 自然的双眼眨眼微差
 * - 瞳孔扩张/收缩 - 基于情绪和光线
 * - 眼球湿润感 - 高光位置变化
 * - 注视深度 - 聚焦/失焦效果
 * - 视线追踪平滑
 * 
 * @module EyeTrackingEnhancer
 */

export interface Vector2 {
  x: number;
  y: number;
}

export interface EyeState {
  // 眼球位置 (-1 ~ 1)
  pupilPosition: Vector2;
  // 眼睛开合度 (0 = 闭眼, 1 = 睁眼)
  openness: number;
  // 瞳孔大小 (0.5 ~ 1.5)
  pupilSize: number;
  // 高光位置偏移
  highlightOffset: Vector2;
  // 聚焦程度 (0 = 失焦, 1 = 聚焦)
  focusLevel: number;
}

export interface EyePairState {
  left: EyeState;
  right: EyeState;
  // 同步性 (0 = 完全独立, 1 = 完全同步)
  synchronization: number;
}

export interface MicrosaccadeConfig {
  enabled: boolean;
  amplitude: number;      // 微动幅度
  frequency: number;      // 频率 (次/秒)
  randomness: number;     // 随机性
}

export interface BlinkConfig {
  enabled: boolean;
  duration: number;       // 眨眼时长 (ms)
  asymmetry: number;      // 双眼不对称程度 (0-1)
  closeDuration: number;  // 闭眼保持时长 (ms)
}

export interface PupilConfig {
  enabled: boolean;
  minSize: number;        // 最小瞳孔大小
  maxSize: number;        // 最大瞳孔大小
  lightSensitivity: number; // 光敏感度
  emotionSensitivity: number; // 情绪敏感度
  transitionSpeed: number; // 变化速度
}

export interface EyeTrackingConfig {
  enabled: boolean;
  smoothing: number;      // 平滑系数 (0-1)
  microsaccade: MicrosaccadeConfig;
  blink: BlinkConfig;
  pupil: PupilConfig;
  highlightEnabled: boolean;
  focusEnabled: boolean;
}

export type EyeUpdateCallback = (state: EyePairState) => void;

// 情绪对瞳孔的影响
const EMOTION_PUPIL_EFFECTS: Record<string, number> = {
  neutral: 0,
  happy: 0.1,        // 轻微扩大
  sad: -0.05,        // 轻微收缩
  surprised: 0.3,    // 明显扩大
  angry: -0.1,       // 收缩
  fear: 0.25,        // 扩大
  thinking: 0,
  shy: 0.05,
  excited: 0.2,
  love: 0.15,        // "瞳孔放大"
};

/**
 * 眼动追踪增强系统
 */
export class EyeTrackingEnhancer {
  private config: EyeTrackingConfig;
  private state: EyePairState;
  private targetPosition: Vector2 = { x: 0, y: 0 };
  private currentEmotion: string = 'neutral';
  private lightLevel: number = 0.5; // 0 = 暗, 1 = 亮
  private callbacks: Set<EyeUpdateCallback> = new Set();
  private animationId: number | null = null;
  private lastTime: number = 0;
  private isRunning: boolean = false;
  
  // 微动状态
  private microsaccadeTimer: number = 0;
  private microsaccadeOffset: Vector2 = { x: 0, y: 0 };
  
  // 眨眼状态
  private isBlinking: boolean = false;
  private blinkPhase: 'closing' | 'closed' | 'opening' = 'closing';
  private blinkProgress: number = 0;
  private blinkLeftDelay: number = 0;
  
  // 瞳孔状态
  private currentPupilSize: number = 1.0;
  private targetPupilSize: number = 1.0;
  
  // 聚焦状态
  private currentFocus: number = 1.0;
  private targetFocus: number = 1.0;

  constructor(config?: Partial<EyeTrackingConfig>) {
    this.config = {
      enabled: true,
      smoothing: 0.15,
      microsaccade: {
        enabled: true,
        amplitude: 0.02,
        frequency: 2.5,
        randomness: 0.5,
      },
      blink: {
        enabled: true,
        duration: 150,
        asymmetry: 0.1,
        closeDuration: 50,
      },
      pupil: {
        enabled: true,
        minSize: 0.6,
        maxSize: 1.4,
        lightSensitivity: 0.3,
        emotionSensitivity: 0.5,
        transitionSpeed: 2.0,
      },
      highlightEnabled: true,
      focusEnabled: true,
      ...config,
    };

    this.state = this.createInitialState();
  }

  /**
   * 创建初始状态
   */
  private createInitialState(): EyePairState {
    const defaultEye: EyeState = {
      pupilPosition: { x: 0, y: 0 },
      openness: 1.0,
      pupilSize: 1.0,
      highlightOffset: { x: 0, y: 0 },
      focusLevel: 1.0,
    };

    return {
      left: { ...defaultEye },
      right: { ...defaultEye },
      synchronization: 0.95,
    };
  }

  /**
   * 设置注视目标
   */
  setLookTarget(x: number, y: number): void {
    this.targetPosition = {
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
    };
  }

  /**
   * 设置情绪
   */
  setEmotion(emotion: string): void {
    this.currentEmotion = emotion;
    this.updateTargetPupilSize();
  }

  /**
   * 设置光照等级
   */
  setLightLevel(level: number): void {
    this.lightLevel = Math.max(0, Math.min(1, level));
    this.updateTargetPupilSize();
  }

  /**
   * 设置聚焦目标
   */
  setFocusTarget(focused: boolean): void {
    this.targetFocus = focused ? 1.0 : 0.3;
  }

  /**
   * 触发眨眼
   */
  triggerBlink(): void {
    if (this.isBlinking) return;
    
    this.isBlinking = true;
    this.blinkPhase = 'closing';
    this.blinkProgress = 0;
    this.blinkLeftDelay = Math.random() * this.config.blink.asymmetry * 20; // 左眼微小延迟
  }

  /**
   * 更新目标瞳孔大小
   */
  private updateTargetPupilSize(): void {
    const { pupil } = this.config;
    
    // 基础大小 (在 min 和 max 的中点)
    const midSize = (pupil.minSize + pupil.maxSize) / 2;
    const range = (pupil.maxSize - pupil.minSize) / 2;
    
    let size = midSize;
    
    // 光线影响 (亮 → 收缩) - 映射到范围内
    size -= (this.lightLevel - 0.5) * 2 * range * pupil.lightSensitivity;
    
    // 情绪影响
    const emotionEffect = EMOTION_PUPIL_EFFECTS[this.currentEmotion] ?? 0;
    size += emotionEffect * range * pupil.emotionSensitivity;
    
    // 限制范围
    this.targetPupilSize = Math.max(pupil.minSize, Math.min(pupil.maxSize, size));
  }

  /**
   * 生成微动偏移
   */
  private generateMicrosaccade(dt: number): void {
    if (!this.config.microsaccade.enabled) return;

    this.microsaccadeTimer += dt;
    
    const { frequency, amplitude, randomness } = this.config.microsaccade;
    const interval = 1 / frequency;
    
    if (this.microsaccadeTimer >= interval) {
      this.microsaccadeTimer -= interval;
      
      // 生成新的微动偏移
      const angle = Math.random() * Math.PI * 2;
      const magnitude = amplitude * (0.5 + Math.random() * randomness);
      
      this.microsaccadeOffset = {
        x: Math.cos(angle) * magnitude,
        y: Math.sin(angle) * magnitude,
      };
    }
    
    // 微动衰减
    const decayRate = 10;
    this.microsaccadeOffset.x *= Math.exp(-decayRate * dt);
    this.microsaccadeOffset.y *= Math.exp(-decayRate * dt);
  }

  /**
   * 更新眨眼状态
   */
  private updateBlink(dt: number): void {
    if (!this.isBlinking) return;

    const { duration, closeDuration } = this.config.blink;
    const closeDurationSec = closeDuration / 1000;
    const halfDurationSec = (duration / 1000 - closeDurationSec) / 2;
    
    this.blinkProgress += dt;

    switch (this.blinkPhase) {
      case 'closing':
        if (this.blinkProgress >= halfDurationSec) {
          this.blinkPhase = 'closed';
          this.blinkProgress = 0;
        }
        break;
      case 'closed':
        if (this.blinkProgress >= closeDurationSec) {
          this.blinkPhase = 'opening';
          this.blinkProgress = 0;
        }
        break;
      case 'opening':
        if (this.blinkProgress >= halfDurationSec) {
          this.isBlinking = false;
          this.blinkPhase = 'closing';
          this.blinkProgress = 0;
          this.blinkLeftDelay = 0;
        }
        break;
    }
  }

  /**
   * 计算眼睛开合度
   */
  private calculateOpenness(isLeft: boolean): number {
    if (!this.isBlinking) return 1.0;

    const { duration, closeDuration } = this.config.blink;
    const closeDurationSec = closeDuration / 1000;
    const halfDurationSec = (duration / 1000 - closeDurationSec) / 2;
    
    // 左眼微小延迟
    let adjustedProgress = this.blinkProgress;
    if (isLeft && this.blinkPhase === 'closing') {
      adjustedProgress = Math.max(0, this.blinkProgress - this.blinkLeftDelay / 1000);
    }

    switch (this.blinkPhase) {
      case 'closing':
        return 1.0 - Math.min(1, adjustedProgress / halfDurationSec);
      case 'closed':
        return 0;
      case 'opening':
        return Math.min(1, adjustedProgress / halfDurationSec);
    }
  }

  /**
   * 物理步进
   */
  private step(dt: number): void {
    // 更新微动
    this.generateMicrosaccade(dt);
    
    // 更新眨眼
    if (this.config.blink.enabled) {
      this.updateBlink(dt);
    }
    
    // 平滑瞳孔大小变化
    if (this.config.pupil.enabled) {
      const pupilDiff = this.targetPupilSize - this.currentPupilSize;
      this.currentPupilSize += pupilDiff * this.config.pupil.transitionSpeed * dt;
    }
    
    // 平滑聚焦变化
    if (this.config.focusEnabled) {
      const focusDiff = this.targetFocus - this.currentFocus;
      this.currentFocus += focusDiff * 3.0 * dt;
    }
    
    // 更新眼球位置 (带平滑)
    const smoothing = this.config.smoothing;
    const smoothedX = this.state.left.pupilPosition.x + (this.targetPosition.x - this.state.left.pupilPosition.x) * (1 - Math.pow(smoothing, dt * 60));
    const smoothedY = this.state.left.pupilPosition.y + (this.targetPosition.y - this.state.left.pupilPosition.y) * (1 - Math.pow(smoothing, dt * 60));
    
    // 添加微动
    const finalX = smoothedX + this.microsaccadeOffset.x;
    const finalY = smoothedY + this.microsaccadeOffset.y;
    
    // 计算高光偏移 (与瞳孔位置相反方向)
    const highlightOffset: Vector2 = this.config.highlightEnabled ? {
      x: -finalX * 0.1,
      y: -finalY * 0.1 + 0.05, // 高光略偏上
    } : { x: 0, y: 0 };
    
    // 更新左眼
    this.state.left = {
      pupilPosition: { x: finalX, y: finalY },
      openness: this.calculateOpenness(true),
      pupilSize: this.currentPupilSize,
      highlightOffset: { ...highlightOffset },
      focusLevel: this.currentFocus,
    };
    
    // 更新右眼 (轻微不同步)
    const sync = this.state.synchronization;
    const rightMicrosaccade = {
      x: this.microsaccadeOffset.x * sync + (1 - sync) * (Math.random() - 0.5) * this.config.microsaccade.amplitude,
      y: this.microsaccadeOffset.y * sync + (1 - sync) * (Math.random() - 0.5) * this.config.microsaccade.amplitude,
    };
    
    this.state.right = {
      pupilPosition: { 
        x: smoothedX + rightMicrosaccade.x,
        y: smoothedY + rightMicrosaccade.y,
      },
      openness: this.calculateOpenness(false),
      pupilSize: this.currentPupilSize * (1 + (Math.random() - 0.5) * 0.02), // 轻微差异
      highlightOffset: { ...highlightOffset },
      focusLevel: this.currentFocus,
    };
  }

  /**
   * 启动眼动追踪
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.tick();
  }

  /**
   * 停止眼动追踪
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * 是否运行中
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 动画帧
   */
  private tick = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.config.enabled) {
      this.step(dt);
      this.notifyCallbacks();
    }

    this.animationId = requestAnimationFrame(this.tick);
  };

  /**
   * 订阅状态更新
   */
  onUpdate(callback: EyeUpdateCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 通知回调
   */
  private notifyCallbacks(): void {
    for (const callback of this.callbacks) {
      callback(this.state);
    }
  }

  /**
   * 获取当前状态
   */
  getState(): EyePairState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * 获取 Live2D 参数
   */
  getLive2DParams(): Record<string, number> {
    return {
      // 眼球位置
      ParamEyeBallX: this.state.left.pupilPosition.x,
      ParamEyeBallY: this.state.left.pupilPosition.y,
      
      // 眼睛开合
      ParamEyeLOpen: this.state.left.openness,
      ParamEyeROpen: this.state.right.openness,
      
      // 瞳孔大小 (如果模型支持)
      ParamPupilScale: this.currentPupilSize,
      
      // 高光位置 (如果模型支持)
      ParamHighlightX: this.state.left.highlightOffset.x,
      ParamHighlightY: this.state.left.highlightOffset.y,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<EyeTrackingConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.microsaccade) {
      this.config.microsaccade = { ...this.config.microsaccade, ...config.microsaccade };
    }
    if (config.blink) {
      this.config.blink = { ...this.config.blink, ...config.blink };
    }
    if (config.pupil) {
      this.config.pupil = { ...this.config.pupil, ...config.pupil };
    }
  }

  /**
   * 获取配置
   */
  getConfig(): EyeTrackingConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * 设置启用状态
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * 设置同步性
   */
  setSynchronization(sync: number): void {
    this.state.synchronization = Math.max(0, Math.min(1, sync));
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.state = this.createInitialState();
    this.targetPosition = { x: 0, y: 0 };
    this.currentEmotion = 'neutral';
    this.lightLevel = 0.5;
    this.microsaccadeTimer = 0;
    this.microsaccadeOffset = { x: 0, y: 0 };
    this.isBlinking = false;
    this.blinkPhase = 'closing';
    this.blinkProgress = 0;
    this.currentPupilSize = 1.0;
    this.targetPupilSize = 1.0;
    this.currentFocus = 1.0;
    this.targetFocus = 1.0;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stop();
    this.callbacks.clear();
  }
}

// 默认实例
export const eyeTrackingEnhancer = new EyeTrackingEnhancer();
