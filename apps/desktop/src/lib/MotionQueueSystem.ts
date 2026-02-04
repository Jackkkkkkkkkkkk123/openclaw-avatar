/**
 * Motion Queue System - SOTA 动作队列系统
 * 
 * Phase 11: 动作平滑过渡和优先级管理
 * 
 * 功能:
 * - 动作队列管理
 * - 优先级系统 (idle < gesture < reaction < emotion)
 * - 动作混合/过渡
 * - 打断和恢复
 * - 动作组合 (同时播放多个不冲突的动作)
 */

export type MotionPriority = 'idle' | 'gesture' | 'reaction' | 'emotion' | 'override';

const PRIORITY_VALUES: Record<MotionPriority, number> = {
  idle: 0,
  gesture: 1,
  reaction: 2,
  emotion: 3,
  override: 4,
};

export interface MotionRequest {
  id: string;
  group: string;
  index?: number;
  priority: MotionPriority;
  duration?: number;       // 持续时间 (ms)，0 = 播放到结束
  fadeIn?: number;         // 淡入时间 (ms)
  fadeOut?: number;        // 淡出时间 (ms)
  loop?: boolean;          // 是否循环
  weight?: number;         // 混合权重 0-1
  onStart?: () => void;
  onComplete?: () => void;
  onInterrupt?: () => void;
}

interface ActiveMotion extends MotionRequest {
  startTime: number;
  currentWeight: number;
  state: 'fadeIn' | 'playing' | 'fadeOut';
}

// 身体部位分区 (用于动作混合)
export type BodyPart = 'head' | 'body' | 'arms' | 'full';

// 动作到身体部位的映射
const MOTION_BODY_PARTS: Record<string, BodyPart> = {
  // 全身动作
  idle: 'full',
  walk: 'full',
  jump: 'full',
  // 手臂动作
  wave: 'arms',
  point: 'arms',
  zuoshou: 'arms',
  youshou: 'arms',
  zuoshou_goodbye: 'arms',
  youshou_goodbye: 'arms',
  // 头部动作
  nod: 'head',
  shake: 'head',
  flick_head: 'head',
  // 身体动作
  tap_body: 'body',
  bow: 'body',
};

type MotionPlayCallback = (group: string, index: number, weight: number) => void;
type MotionStopCallback = (group: string) => void;

export class MotionQueueSystem {
  private queue: MotionRequest[] = [];
  private activeMotions: Map<BodyPart, ActiveMotion> = new Map();
  private idleMotion: MotionRequest | null = null;
  
  // 回调
  private playCallback: MotionPlayCallback | null = null;
  private stopCallback: MotionStopCallback | null = null;
  
  // 动画循环
  private animationFrame: number | null = null;
  private isRunning = false;
  
  // 配置
  private defaultFadeIn = 200;
  private defaultFadeOut = 300;

  constructor() {
    this.start();
  }

  /**
   * 设置播放回调
   */
  onPlay(callback: MotionPlayCallback) {
    this.playCallback = callback;
  }

  /**
   * 设置停止回调
   */
  onStop(callback: MotionStopCallback) {
    this.stopCallback = callback;
  }

  /**
   * 请求播放动作
   */
  requestMotion(request: MotionRequest): boolean {
    const bodyPart = MOTION_BODY_PARTS[request.group] || 'full';
    const active = this.activeMotions.get(bodyPart);
    
    // 检查优先级
    if (active && PRIORITY_VALUES[active.priority] > PRIORITY_VALUES[request.priority]) {
      console.log(`[MotionQueue] 动作 ${request.group} 被更高优先级阻止`);
      return false;
    }
    
    // 如果有正在播放的动作，先淡出
    if (active) {
      this.fadeOutMotion(bodyPart);
    }
    
    // 添加到活动列表
    const activeMotion: ActiveMotion = {
      ...request,
      fadeIn: request.fadeIn ?? this.defaultFadeIn,
      fadeOut: request.fadeOut ?? this.defaultFadeOut,
      startTime: Date.now(),
      currentWeight: 0,
      state: 'fadeIn',
    };
    
    this.activeMotions.set(bodyPart, activeMotion);
    
    // 触发开始回调
    request.onStart?.();
    
    console.log(`[MotionQueue] 播放动作: ${request.group} (${bodyPart})`);
    return true;
  }

  /**
   * 设置 Idle 动作 (最低优先级，会在无其他动作时自动播放)
   */
  setIdleMotion(motion: Omit<MotionRequest, 'priority'> | null) {
    if (motion) {
      this.idleMotion = {
        ...motion,
        priority: 'idle',
        loop: true,
      };
    } else {
      this.idleMotion = null;
    }
  }

  /**
   * 停止指定身体部位的动作
   */
  stopMotion(bodyPart: BodyPart, immediate = false) {
    const active = this.activeMotions.get(bodyPart);
    if (!active) return;
    
    if (immediate) {
      this.removeMotion(bodyPart);
    } else {
      this.fadeOutMotion(bodyPart);
    }
  }

  /**
   * 停止所有动作
   */
  stopAll(immediate = false) {
    for (const bodyPart of this.activeMotions.keys()) {
      this.stopMotion(bodyPart, immediate);
    }
  }

  /**
   * 播放表情相关动作
   */
  playEmotionMotion(emotion: string) {
    const emotionMotions: Record<string, string> = {
      happy: 'tap_body',
      excited: 'wave',
      sad: 'idle',
      surprised: 'flick_head',
      thinking: 'idle',
    };
    
    const motion = emotionMotions[emotion];
    if (motion) {
      this.requestMotion({
        id: `emotion_${emotion}`,
        group: motion,
        priority: 'emotion',
        duration: 2000,
      });
    }
  }

  /**
   * 播放手势动作
   */
  playGesture(gesture: 'wave' | 'point' | 'goodbye_left' | 'goodbye_right') {
    const gestureMap: Record<string, string> = {
      wave: 'youshou',
      point: 'zuoshou',
      goodbye_left: 'zuoshou_goodbye',
      goodbye_right: 'youshou_goodbye',
    };
    
    this.requestMotion({
      id: `gesture_${gesture}`,
      group: gestureMap[gesture] || gesture,
      priority: 'gesture',
      duration: 1500,
    });
  }

  /**
   * 播放反应动作
   */
  playReaction(reaction: 'nod' | 'shake' | 'surprise') {
    const reactionMap: Record<string, string> = {
      nod: 'tap_body',
      shake: 'shake',
      surprise: 'flick_head',
    };
    
    this.requestMotion({
      id: `reaction_${reaction}`,
      group: reactionMap[reaction] || reaction,
      priority: 'reaction',
      duration: 800,
    });
  }

  /**
   * 获取当前活动动作
   */
  getActiveMotions(): Map<BodyPart, ActiveMotion> {
    return new Map(this.activeMotions);
  }

  /**
   * 销毁
   */
  destroy() {
    this.isRunning = false;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.activeMotions.clear();
    this.queue = [];
  }

  // ========== 私有方法 ==========

  private start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }

  private animate() {
    if (!this.isRunning) return;
    
    const now = Date.now();
    
    // 更新每个活动动作
    for (const [bodyPart, motion] of this.activeMotions) {
      this.updateMotion(bodyPart, motion, now);
    }
    
    // 检查是否需要播放 Idle
    this.checkIdleMotion();
    
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  private updateMotion(bodyPart: BodyPart, motion: ActiveMotion, now: number) {
    const elapsed = now - motion.startTime;
    
    switch (motion.state) {
      case 'fadeIn': {
        const progress = Math.min(1, elapsed / (motion.fadeIn || 1));
        motion.currentWeight = this.easeInOut(progress) * (motion.weight ?? 1);
        
        // 通知播放
        this.playCallback?.(motion.group, motion.index ?? 0, motion.currentWeight);
        
        if (progress >= 1) {
          motion.state = 'playing';
          motion.startTime = now;
        }
        break;
      }
      
      case 'playing': {
        motion.currentWeight = motion.weight ?? 1;
        
        // 检查是否需要结束
        if (motion.duration && motion.duration > 0) {
          const playElapsed = elapsed;
          if (playElapsed >= motion.duration - (motion.fadeOut || 0)) {
            this.fadeOutMotion(bodyPart);
          }
        }
        break;
      }
      
      case 'fadeOut': {
        const progress = Math.min(1, elapsed / (motion.fadeOut || 1));
        motion.currentWeight = (1 - this.easeInOut(progress)) * (motion.weight ?? 1);
        
        if (progress >= 1) {
          this.removeMotion(bodyPart);
        }
        break;
      }
    }
  }

  private fadeOutMotion(bodyPart: BodyPart) {
    const motion = this.activeMotions.get(bodyPart);
    if (!motion || motion.state === 'fadeOut') return;
    
    motion.state = 'fadeOut';
    motion.startTime = Date.now();
    motion.onInterrupt?.();
  }

  private removeMotion(bodyPart: BodyPart) {
    const motion = this.activeMotions.get(bodyPart);
    if (motion) {
      this.stopCallback?.(motion.group);
      motion.onComplete?.();
      this.activeMotions.delete(bodyPart);
    }
  }

  private checkIdleMotion() {
    // 如果全身没有动作，播放 Idle
    if (this.idleMotion && !this.activeMotions.has('full')) {
      // 检查是否所有部位都空闲
      const hasAnyMotion = this.activeMotions.size > 0;
      if (!hasAnyMotion) {
        this.requestMotion(this.idleMotion);
      }
    }
  }

  private easeInOut(t: number): number {
    return t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}

// 单例导出
export const motionQueueSystem = new MotionQueueSystem();
