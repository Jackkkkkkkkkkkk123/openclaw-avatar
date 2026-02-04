/**
 * IntegratedAnimationSystem - 集成动画系统
 * 
 * 整合所有动画子系统：
 * - 物理模拟 (头发、衣物摆动)
 * - 眼动追踪增强 (微动、眨眼、瞳孔)
 * - 表情系统
 * - 口型同步
 * - 生命动画
 * 
 * @module IntegratedAnimationSystem
 */

import { PhysicsSimulation, type PhysicsState, type Vector2 as PhysicsVector2 } from './PhysicsSimulation';
import { EyeTrackingEnhancer, type EyePairState } from './EyeTrackingEnhancer';

export interface IntegratedState {
  // 眼睛状态
  eye: EyePairState;
  // 物理模拟状态
  physics: PhysicsState | null;
  // 当前表情
  currentExpression: string;
  // 当前情绪
  currentEmotion: string;
  // 口型开合度
  mouthOpenY: number;
  // 是否在说话
  isSpeaking: boolean;
  // 时间戳
  timestamp: number;
}

export interface IntegratedConfig {
  // 各子系统启用状态
  eyeTrackingEnabled: boolean;
  physicsEnabled: boolean;
  // 物理链配置
  physicsChains: {
    twintailLeft: boolean;
    twintailRight: boolean;
    bangs: boolean;
    accessory: boolean;
    skirt: boolean;
    ribbon: boolean;
  };
  // 头部位置到物理链的影响
  headMotionInfluence: number;
  // 情绪到瞳孔的影响
  emotionToPupilEnabled: boolean;
  // 说话时的随机眨眼
  speakingBlinkEnabled: boolean;
  speakingBlinkInterval: number;
}

export type IntegratedCallback = (state: IntegratedState) => void;

const DEFAULT_CONFIG: IntegratedConfig = {
  eyeTrackingEnabled: true,
  physicsEnabled: true,
  physicsChains: {
    twintailLeft: true,
    twintailRight: true,
    bangs: true,
    accessory: false,
    skirt: false,
    ribbon: false,
  },
  headMotionInfluence: 0.3,
  emotionToPupilEnabled: true,
  speakingBlinkEnabled: true,
  speakingBlinkInterval: 4000,
};

/**
 * 集成动画系统
 */
export class IntegratedAnimationSystem {
  private config: IntegratedConfig;
  private physics: PhysicsSimulation;
  private eyeTracking: EyeTrackingEnhancer;
  
  private callbacks: Set<IntegratedCallback> = new Set();
  private animationId: number | null = null;
  private lastTime: number = 0;
  private isRunning: boolean = false;
  
  // 状态
  private currentExpression: string = 'neutral';
  private currentEmotion: string = 'neutral';
  private mouthOpenY: number = 0;
  private isSpeaking: boolean = false;
  private lastHeadPosition: PhysicsVector2 = { x: 0, y: 0 };
  private lastBlinkTime: number = 0;
  
  // 暴露给外部的 Live2D 参数
  private live2DParams: Record<string, number> = {};

  constructor(config?: Partial<IntegratedConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 初始化子系统
    this.physics = new PhysicsSimulation();
    this.eyeTracking = new EyeTrackingEnhancer();
    
    // 设置物理链
    this.initPhysicsChains();
    
    // 订阅子系统更新
    this.setupSubsystemCallbacks();
  }

  /**
   * 初始化物理链
   */
  private initPhysicsChains(): void {
    const { physicsChains } = this.config;
    
    if (physicsChains.twintailLeft) {
      this.physics.createChain(
        'twintail_left',
        'TwintailL',
        { x: -0.3, y: -0.2 },
        'twintail_left',
        { direction: { x: -0.3, y: 1 } }
      );
    }
    
    if (physicsChains.twintailRight) {
      this.physics.createChain(
        'twintail_right',
        'TwintailR',
        { x: 0.3, y: -0.2 },
        'twintail_right',
        { direction: { x: 0.3, y: 1 } }
      );
    }
    
    if (physicsChains.bangs) {
      this.physics.createChain(
        'bangs',
        'Bangs',
        { x: 0, y: -0.4 },
        'bangs',
        { direction: { x: 0, y: 1 } }
      );
    }
    
    if (physicsChains.accessory) {
      this.physics.createChain(
        'accessory',
        'Accessory',
        { x: 0.2, y: -0.35 },
        'accessory'
      );
    }
    
    if (physicsChains.skirt) {
      this.physics.createChain(
        'skirt',
        'Skirt',
        { x: 0, y: 0.3 },
        'skirt'
      );
    }
    
    if (physicsChains.ribbon) {
      this.physics.createChain(
        'ribbon',
        'Ribbon',
        { x: 0, y: 0 },
        'ribbon'
      );
    }
  }

  /**
   * 设置子系统回调
   */
  private setupSubsystemCallbacks(): void {
    // 眼动追踪更新时合并参数
    this.eyeTracking.onUpdate(() => {
      const eyeParams = this.eyeTracking.getLive2DParams();
      Object.assign(this.live2DParams, eyeParams);
    });
    
    // 物理模拟更新时合并参数
    this.physics.onUpdate((state) => {
      for (const chain of Object.values(state.chains)) {
        const chainParams = this.physics.getLive2DParams(chain.id);
        Object.assign(this.live2DParams, chainParams);
      }
    });
  }

  /**
   * 启动系统
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.lastBlinkTime = this.lastTime;
    
    if (this.config.eyeTrackingEnabled) {
      this.eyeTracking.start();
    }
    
    if (this.config.physicsEnabled) {
      this.physics.start();
    }
    
    this.tick();
  }

  /**
   * 停止系统
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    this.eyeTracking.stop();
    this.physics.stop();
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

    // 处理说话时的随机眨眼
    if (this.config.speakingBlinkEnabled && this.isSpeaking) {
      if (now - this.lastBlinkTime > this.config.speakingBlinkInterval) {
        this.eyeTracking.triggerBlink();
        this.lastBlinkTime = now;
      }
    }

    // 通知回调
    this.notifyCallbacks();

    this.animationId = requestAnimationFrame(this.tick);
  };

  /**
   * 设置注视目标
   */
  setLookTarget(x: number, y: number): void {
    this.eyeTracking.setLookTarget(x, y);
  }

  /**
   * 设置头部位置 (影响物理模拟)
   */
  setHeadPosition(x: number, y: number): void {
    const dx = x - this.lastHeadPosition.x;
    const dy = y - this.lastHeadPosition.y;
    
    if (this.config.physicsEnabled && this.config.headMotionInfluence > 0) {
      const impulse = {
        x: -dx * this.config.headMotionInfluence,
        y: -dy * this.config.headMotionInfluence,
      };
      
      // 对所有物理链应用惯性冲击
      for (const chain of this.physics.getAllChains()) {
        this.physics.applyImpulse(chain.id, impulse);
      }
      
      // 更新锚点位置
      const { physicsChains } = this.config;
      if (physicsChains.twintailLeft) {
        this.physics.setAnchorPosition('twintail_left', { x: -0.3 + x * 0.1, y: -0.2 + y * 0.1 });
      }
      if (physicsChains.twintailRight) {
        this.physics.setAnchorPosition('twintail_right', { x: 0.3 + x * 0.1, y: -0.2 + y * 0.1 });
      }
      if (physicsChains.bangs) {
        this.physics.setAnchorPosition('bangs', { x: x * 0.05, y: -0.4 + y * 0.05 });
      }
    }
    
    this.lastHeadPosition = { x, y };
  }

  /**
   * 设置情绪
   */
  setEmotion(emotion: string): void {
    this.currentEmotion = emotion;
    
    if (this.config.emotionToPupilEnabled) {
      this.eyeTracking.setEmotion(emotion);
    }
  }

  /**
   * 设置表情
   */
  setExpression(expression: string): void {
    this.currentExpression = expression;
  }

  /**
   * 设置口型开合度
   */
  setMouthOpenY(value: number): void {
    this.mouthOpenY = Math.max(0, Math.min(1, value));
    this.live2DParams['ParamMouthOpenY'] = this.mouthOpenY;
  }

  /**
   * 设置说话状态
   */
  setSpeaking(speaking: boolean): void {
    this.isSpeaking = speaking;
    if (speaking) {
      this.lastBlinkTime = performance.now();
    }
  }

  /**
   * 触发眨眼
   */
  triggerBlink(): void {
    this.eyeTracking.triggerBlink();
    this.lastBlinkTime = performance.now();
  }

  /**
   * 设置风力
   */
  setWind(direction: PhysicsVector2, strength: number): void {
    this.physics.setWind({ direction, strength });
  }

  /**
   * 设置光照等级
   */
  setLightLevel(level: number): void {
    this.eyeTracking.setLightLevel(level);
  }

  /**
   * 获取集成状态
   */
  getState(): IntegratedState {
    return {
      eye: this.eyeTracking.getState(),
      physics: this.config.physicsEnabled ? this.physics.getState() : null,
      currentExpression: this.currentExpression,
      currentEmotion: this.currentEmotion,
      mouthOpenY: this.mouthOpenY,
      isSpeaking: this.isSpeaking,
      timestamp: performance.now(),
    };
  }

  /**
   * 获取 Live2D 参数
   */
  getLive2DParams(): Record<string, number> {
    // 合并所有子系统的参数
    const params = { ...this.live2DParams };
    
    // 添加眼动参数
    const eyeParams = this.eyeTracking.getLive2DParams();
    Object.assign(params, eyeParams);
    
    // 添加物理参数
    if (this.config.physicsEnabled) {
      for (const chain of this.physics.getAllChains()) {
        const chainParams = this.physics.getLive2DParams(chain.id);
        Object.assign(params, chainParams);
      }
    }
    
    // 添加口型参数
    params['ParamMouthOpenY'] = this.mouthOpenY;
    
    return params;
  }

  /**
   * 订阅状态更新
   */
  onUpdate(callback: IntegratedCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 通知回调
   */
  private notifyCallbacks(): void {
    const state = this.getState();
    for (const callback of this.callbacks) {
      callback(state);
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<IntegratedConfig>): void {
    this.config = { ...this.config, ...config };
    
    // 更新子系统启用状态
    if (config.eyeTrackingEnabled !== undefined) {
      this.eyeTracking.setEnabled(config.eyeTrackingEnabled);
    }
    if (config.physicsEnabled !== undefined) {
      this.physics.setEnabled(config.physicsEnabled);
    }
  }

  /**
   * 获取配置
   */
  getConfig(): IntegratedConfig {
    return { ...this.config };
  }

  /**
   * 重置系统
   */
  reset(): void {
    this.eyeTracking.reset();
    this.physics.reset();
    this.currentExpression = 'neutral';
    this.currentEmotion = 'neutral';
    this.mouthOpenY = 0;
    this.isSpeaking = false;
    this.lastHeadPosition = { x: 0, y: 0 };
    this.live2DParams = {};
  }

  /**
   * 获取物理模拟实例
   */
  getPhysicsSimulation(): PhysicsSimulation {
    return this.physics;
  }

  /**
   * 获取眼动追踪实例
   */
  getEyeTrackingEnhancer(): EyeTrackingEnhancer {
    return this.eyeTracking;
  }

  /**
   * 销毁系统
   */
  destroy(): void {
    this.stop();
    this.callbacks.clear();
    this.physics.destroy();
    this.eyeTracking.destroy();
  }
}

// 默认实例
export const integratedAnimationSystem = new IntegratedAnimationSystem();
