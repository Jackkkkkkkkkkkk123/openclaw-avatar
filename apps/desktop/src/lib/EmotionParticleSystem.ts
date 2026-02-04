/**
 * EmotionParticleSystem - 情绪驱动的粒子特效系统
 * 
 * 根据角色情绪生成相应的视觉粒子效果
 * 
 * @author SOTA Optimizer
 * @version 1.0
 */

import type { Expression } from './AvatarController';

// 粒子类型
export type ParticleType = 
  | 'sparkle'      // 闪亮星星 (happy/excited)
  | 'heart'        // 爱心 (loving)
  | 'raindrop'     // 雨滴 (sad)
  | 'flame'        // 火焰 (angry)
  | 'star'         // 星星爆炸 (surprised)
  | 'bubble'       // 气泡 (thinking)
  | 'confetti'     // 彩纸 (celebration)
  | 'snow'         // 雪花 (calm)
  | 'leaf'         // 落叶 (melancholy)
  | 'lightning'    // 闪电 (fear)
  | 'music'        // 音符 (playful)
  | 'tear';        // 眼泪 (crying)

// 单个粒子
export interface Particle {
  id: number;
  type: ParticleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

// 粒子配置
export interface ParticleConfig {
  type: ParticleType;
  count: number;
  speed: number;
  size: number;
  sizeVariation: number;
  colors: string[];
  gravity: number;
  lifetime: number;
  spread: number;
  emissionRate: number;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'random';
}

// 情绪到粒子配置映射
export const EMOTION_PARTICLE_MAP: Record<Expression, ParticleConfig | null> = {
  neutral: null, // 中性无粒子
  happy: {
    type: 'sparkle',
    count: 15,
    speed: 2,
    size: 20,
    sizeVariation: 0.5,
    colors: ['#FFD700', '#FFA500', '#FFEC8B', '#FFFACD'],
    gravity: -0.2,
    lifetime: 1500,
    spread: 60,
    emissionRate: 3,
    position: 'random',
  },
  sad: {
    type: 'raindrop',
    count: 20,
    speed: 3,
    size: 15,
    sizeVariation: 0.3,
    colors: ['#87CEEB', '#4682B4', '#6495ED'],
    gravity: 0.5,
    lifetime: 2000,
    spread: 80,
    emissionRate: 4,
    position: 'top',
  },
  surprised: {
    type: 'star',
    count: 25,
    speed: 4,
    size: 25,
    sizeVariation: 0.6,
    colors: ['#FF69B4', '#00CED1', '#FFD700', '#FF6347'],
    gravity: 0,
    lifetime: 1200,
    spread: 90,
    emissionRate: 8,
    position: 'center',
  },
  angry: {
    type: 'flame',
    count: 18,
    speed: 2.5,
    size: 22,
    sizeVariation: 0.4,
    colors: ['#FF4500', '#FF6347', '#FF8C00', '#DC143C'],
    gravity: -0.3,
    lifetime: 1000,
    spread: 40,
    emissionRate: 5,
    position: 'bottom',
  },
  fear: {
    type: 'lightning',
    count: 8,
    speed: 6,
    size: 30,
    sizeVariation: 0.3,
    colors: ['#FFFFFF', '#E0FFFF', '#87CEEB'],
    gravity: 0.8,
    lifetime: 300,
    spread: 100,
    emissionRate: 2,
    position: 'top',
  },
  disgusted: {
    type: 'bubble',
    count: 12,
    speed: 1.5,
    size: 18,
    sizeVariation: 0.4,
    colors: ['#9ACD32', '#6B8E23', '#808000'],
    gravity: -0.15,
    lifetime: 2000,
    spread: 50,
    emissionRate: 2,
    position: 'bottom',
  },
  excited: {
    type: 'confetti',
    count: 30,
    speed: 5,
    size: 16,
    sizeVariation: 0.5,
    colors: ['#FF1493', '#00FF00', '#FFD700', '#00BFFF', '#FF6347'],
    gravity: 0.3,
    lifetime: 2500,
    spread: 100,
    emissionRate: 10,
    position: 'top',
  },
  proud: {
    type: 'sparkle',
    count: 20,
    speed: 2,
    size: 22,
    sizeVariation: 0.4,
    colors: ['#FFD700', '#FFA500', '#DAA520'],
    gravity: -0.1,
    lifetime: 1800,
    spread: 70,
    emissionRate: 4,
    position: 'center',
  },
  loving: {
    type: 'heart',
    count: 15,
    speed: 1.5,
    size: 24,
    sizeVariation: 0.4,
    colors: ['#FF69B4', '#FF1493', '#FF6B6B', '#FFB6C1'],
    gravity: -0.25,
    lifetime: 2000,
    spread: 50,
    emissionRate: 3,
    position: 'center',
  },
  grateful: {
    type: 'sparkle',
    count: 12,
    speed: 1.5,
    size: 18,
    sizeVariation: 0.3,
    colors: ['#FFB6C1', '#FFC0CB', '#FFE4E1'],
    gravity: -0.1,
    lifetime: 1500,
    spread: 40,
    emissionRate: 2,
    position: 'random',
  },
  hopeful: {
    type: 'star',
    count: 10,
    speed: 1,
    size: 20,
    sizeVariation: 0.3,
    colors: ['#E6E6FA', '#D8BFD8', '#DDA0DD'],
    gravity: -0.2,
    lifetime: 2000,
    spread: 60,
    emissionRate: 2,
    position: 'top',
  },
  amused: {
    type: 'music',
    count: 12,
    speed: 2,
    size: 20,
    sizeVariation: 0.4,
    colors: ['#FF69B4', '#FFD700', '#00CED1'],
    gravity: -0.15,
    lifetime: 1500,
    spread: 50,
    emissionRate: 3,
    position: 'random',
  },
  relieved: {
    type: 'leaf',
    count: 10,
    speed: 1,
    size: 18,
    sizeVariation: 0.3,
    colors: ['#90EE90', '#98FB98', '#8FBC8F'],
    gravity: 0.2,
    lifetime: 2500,
    spread: 70,
    emissionRate: 2,
    position: 'top',
  },
  anxious: {
    type: 'bubble',
    count: 15,
    speed: 2,
    size: 14,
    sizeVariation: 0.5,
    colors: ['#B0C4DE', '#A9A9A9', '#778899'],
    gravity: -0.1,
    lifetime: 1200,
    spread: 60,
    emissionRate: 4,
    position: 'random',
  },
  embarrassed: {
    type: 'heart',
    count: 8,
    speed: 1,
    size: 16,
    sizeVariation: 0.3,
    colors: ['#FFB6C1', '#FFC0CB'],
    gravity: -0.1,
    lifetime: 1500,
    spread: 30,
    emissionRate: 2,
    position: 'center',
  },
  confused: {
    type: 'bubble',
    count: 10,
    speed: 1,
    size: 16,
    sizeVariation: 0.4,
    colors: ['#DDA0DD', '#DA70D6', '#BA55D3'],
    gravity: -0.1,
    lifetime: 1800,
    spread: 45,
    emissionRate: 2,
    position: 'top',
  },
  bored: null, // 无聊无粒子
  disappointed: {
    type: 'leaf',
    count: 8,
    speed: 0.8,
    size: 16,
    sizeVariation: 0.3,
    colors: ['#D2B48C', '#BC8F8F', '#A0522D'],
    gravity: 0.3,
    lifetime: 3000,
    spread: 60,
    emissionRate: 1,
    position: 'top',
  },
  lonely: {
    type: 'snow',
    count: 15,
    speed: 0.8,
    size: 12,
    sizeVariation: 0.4,
    colors: ['#E0FFFF', '#B0E0E6', '#ADD8E6'],
    gravity: 0.2,
    lifetime: 4000,
    spread: 100,
    emissionRate: 2,
    position: 'top',
  },
  thinking: {
    type: 'bubble',
    count: 8,
    speed: 0.5,
    size: 20,
    sizeVariation: 0.3,
    colors: ['#87CEEB', '#ADD8E6', '#B0E0E6'],
    gravity: -0.2,
    lifetime: 2500,
    spread: 30,
    emissionRate: 1,
    position: 'center',
  },
  curious: {
    type: 'sparkle',
    count: 10,
    speed: 1.5,
    size: 16,
    sizeVariation: 0.4,
    colors: ['#00CED1', '#20B2AA', '#48D1CC'],
    gravity: -0.1,
    lifetime: 1500,
    spread: 50,
    emissionRate: 2,
    position: 'random',
  },
  determined: {
    type: 'flame',
    count: 12,
    speed: 2,
    size: 18,
    sizeVariation: 0.3,
    colors: ['#FF8C00', '#FFA500', '#FFD700'],
    gravity: -0.2,
    lifetime: 1200,
    spread: 35,
    emissionRate: 3,
    position: 'bottom',
  },
  playful: {
    type: 'music',
    count: 15,
    speed: 2.5,
    size: 18,
    sizeVariation: 0.5,
    colors: ['#FF69B4', '#00FF7F', '#FFD700', '#FF6347', '#8A2BE2'],
    gravity: -0.1,
    lifetime: 1800,
    spread: 70,
    emissionRate: 4,
    position: 'random',
  },
};

// 粒子系统回调
type ParticleCallback = (particles: Particle[]) => void;

/**
 * 情绪粒子系统
 */
export class EmotionParticleSystem {
  private particles: Particle[] = [];
  private nextId = 0;
  private animationFrame: number | null = null;
  private lastEmissionTime = 0;
  private currentConfig: ParticleConfig | null = null;
  private currentEmotion: Expression = 'neutral';
  private callbacks: Set<ParticleCallback> = new Set();
  private enabled = true;
  private intensity = 1.0; // 粒子强度 (0-2)
  private speedMultiplier = 1.0; // SOTA Round 40: 速度倍数 (0-2)
  private containerWidth = 800;
  private containerHeight = 600;
  private isRunning = false;

  constructor() {
    // 自动启动
  }

  /**
   * 设置容器尺寸
   */
  setContainerSize(width: number, height: number): void {
    this.containerWidth = width;
    this.containerHeight = height;
  }

  /**
   * 设置情绪
   */
  setEmotion(emotion: Expression): void {
    if (emotion === this.currentEmotion) return;
    
    this.currentEmotion = emotion;
    this.currentConfig = EMOTION_PARTICLE_MAP[emotion];
    
    // 如果情绪变化剧烈，发射一波爆发粒子
    if (this.currentConfig && this.shouldBurst(emotion)) {
      this.emitBurst();
    }
  }

  /**
   * 判断是否应该爆发
   */
  private shouldBurst(emotion: Expression): boolean {
    const burstEmotions: Expression[] = ['surprised', 'excited', 'angry', 'happy', 'loving'];
    return burstEmotions.includes(emotion);
  }

  /**
   * 发射爆发粒子
   */
  private emitBurst(): void {
    if (!this.currentConfig || !this.enabled) return;
    
    const burstCount = Math.floor(this.currentConfig.count * 1.5 * this.intensity);
    for (let i = 0; i < burstCount; i++) {
      this.createParticle(true);
    }
  }

  /**
   * 设置强度
   */
  setIntensity(intensity: number): void {
    this.intensity = Math.max(0, Math.min(2, intensity));
  }

  /**
   * SOTA Round 40: 设置速度倍数
   */
  setSpeed(speed: number): void {
    this.speedMultiplier = Math.max(0, Math.min(2, speed));
  }

  /**
   * 获取当前速度倍数
   */
  getSpeed(): number {
    return this.speedMultiplier;
  }

  /**
   * 启用/禁用
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.particles = [];
      this.notifyCallbacks();
    }
  }

  /**
   * 启动粒子系统
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastEmissionTime = performance.now();
    this.tick();
  }

  /**
   * 停止粒子系统
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * 订阅粒子更新
   */
  subscribe(callback: ParticleCallback): () => void {
    this.callbacks.add(callback);
    // 立即通知当前状态
    callback(this.particles);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 主循环
   */
  private tick = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const deltaTime = 16; // ~60fps

    // 发射新粒子
    if (this.currentConfig && this.enabled) {
      const emissionInterval = 1000 / this.currentConfig.emissionRate;
      if (now - this.lastEmissionTime >= emissionInterval) {
        this.createParticle();
        this.lastEmissionTime = now;
      }
    }

    // 更新粒子
    this.updateParticles(deltaTime);

    // 通知订阅者
    this.notifyCallbacks();

    // 继续循环
    this.animationFrame = requestAnimationFrame(this.tick);
  };

  /**
   * 创建粒子
   */
  private createParticle(isBurst = false): void {
    if (!this.currentConfig) return;

    const config = this.currentConfig;
    
    // 计算初始位置
    const pos = this.getEmissionPosition(config.position);
    
    // 随机角度
    const angle = (Math.random() - 0.5) * (config.spread * Math.PI / 180);
    const speed = config.speed * (0.5 + Math.random()) * this.intensity;
    
    // 爆发模式下速度更快
    const burstMultiplier = isBurst ? 1.5 : 1;
    
    // 随机颜色
    const color = config.colors[Math.floor(Math.random() * config.colors.length)];
    
    // 随机大小
    const sizeVariation = 1 + (Math.random() - 0.5) * config.sizeVariation * 2;
    const size = config.size * sizeVariation * this.intensity;

    const particle: Particle = {
      id: this.nextId++,
      type: config.type,
      x: pos.x,
      y: pos.y,
      vx: Math.sin(angle) * speed * burstMultiplier,
      vy: -Math.cos(angle) * speed * burstMultiplier + (config.gravity > 0 ? 0 : -2),
      size,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
      color,
      life: 0,
      maxLife: config.lifetime * (0.8 + Math.random() * 0.4),
      scale: 1,
    };

    this.particles.push(particle);
  }

  /**
   * 获取发射位置
   */
  private getEmissionPosition(position: ParticleConfig['position']): { x: number; y: number } {
    const margin = 50;
    
    switch (position) {
      case 'top':
        return {
          x: margin + Math.random() * (this.containerWidth - margin * 2),
          y: -20,
        };
      case 'bottom':
        return {
          x: margin + Math.random() * (this.containerWidth - margin * 2),
          y: this.containerHeight + 20,
        };
      case 'left':
        return {
          x: -20,
          y: margin + Math.random() * (this.containerHeight - margin * 2),
        };
      case 'right':
        return {
          x: this.containerWidth + 20,
          y: margin + Math.random() * (this.containerHeight - margin * 2),
        };
      case 'center':
        return {
          x: this.containerWidth / 2 + (Math.random() - 0.5) * 100,
          y: this.containerHeight / 2 + (Math.random() - 0.5) * 100,
        };
      case 'random':
      default:
        return {
          x: Math.random() * this.containerWidth,
          y: Math.random() * this.containerHeight,
        };
    }
  }

  /**
   * 更新粒子
   */
  private updateParticles(deltaTime: number): void {
    const dt = deltaTime / 16;
    const speed = this.speedMultiplier; // SOTA Round 40: 应用速度倍数

    this.particles = this.particles.filter(p => {
      // 更新生命
      p.life += deltaTime;
      if (p.life >= p.maxLife) return false;

      // 更新位置 (应用速度倍数)
      p.x += p.vx * dt * speed;
      p.y += p.vy * dt * speed;

      // 应用重力 (应用速度倍数)
      if (this.currentConfig) {
        p.vy += this.currentConfig.gravity * dt * speed;
      }

      // 更新旋转
      p.rotation += p.rotationSpeed * dt;

      // 更新透明度 (淡出)
      const lifeRatio = p.life / p.maxLife;
      if (lifeRatio > 0.7) {
        p.opacity = 1 - (lifeRatio - 0.7) / 0.3;
      }

      // 更新缩放 (某些类型需要)
      if (p.type === 'star' || p.type === 'flame') {
        p.scale = 1 + Math.sin(p.life / 100) * 0.2;
      }

      // 边界检查
      if (p.x < -50 || p.x > this.containerWidth + 50 ||
          p.y < -50 || p.y > this.containerHeight + 50) {
        return false;
      }

      return true;
    });
  }

  /**
   * 通知回调
   */
  private notifyCallbacks(): void {
    const snapshot = [...this.particles];
    this.callbacks.forEach(cb => cb(snapshot));
  }

  /**
   * 获取当前粒子
   */
  getParticles(): Particle[] {
    return [...this.particles];
  }

  /**
   * 获取粒子数量
   */
  getParticleCount(): number {
    return this.particles.length;
  }

  /**
   * 清除所有粒子
   */
  clear(): void {
    this.particles = [];
    this.notifyCallbacks();
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stop();
    this.clear();
    this.callbacks.clear();
  }
}

// 单例
let particleSystemInstance: EmotionParticleSystem | null = null;

export function getEmotionParticleSystem(): EmotionParticleSystem {
  if (!particleSystemInstance) {
    particleSystemInstance = new EmotionParticleSystem();
  }
  return particleSystemInstance;
}

export const emotionParticleSystem = getEmotionParticleSystem();
