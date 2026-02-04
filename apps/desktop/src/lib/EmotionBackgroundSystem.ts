/**
 * EmotionBackgroundSystem - 情绪驱动背景系统
 * 
 * 根据角色情绪动态改变背景渐变、光效和氛围
 * 让整个场景与角色情绪同步，增强沉浸感
 * 
 * SOTA Round 37 - 用户可感知的视觉提升
 */

import type { Expression } from './AvatarController';

/**
 * 背景渐变配置
 */
export interface GradientConfig {
  colors: string[];           // 渐变颜色数组
  angle: number;              // 渐变角度 (度)
  animation?: {
    enabled: boolean;
    type: 'shift' | 'pulse' | 'wave';
    speed: number;            // 动画速度 (0-1)
  };
}

/**
 * 光效配置
 */
export interface GlowConfig {
  enabled: boolean;
  color: string;
  intensity: number;          // 0-1
  size: number;               // 光晕大小 (px)
  x: number;                  // 位置 X (0-100%)
  y: number;                  // 位置 Y (0-100%)
  pulse?: boolean;            // 是否脉冲
}

/**
 * 波浪效果配置
 */
export interface WaveConfig {
  enabled: boolean;
  color: string;
  opacity: number;            // 0-1
  amplitude: number;          // 振幅 (px)
  frequency: number;          // 频率
  speed: number;              // 速度
  count: number;              // 波浪数量
}

/**
 * 完整背景配置
 */
export interface BackgroundConfig {
  gradient: GradientConfig;
  glows: GlowConfig[];
  wave: WaveConfig;
  overlay?: {
    color: string;
    opacity: number;
  };
  transition: {
    duration: number;         // 过渡时间 (ms)
    easing: string;           // CSS easing
  };
}

/**
 * 情绪背景预设
 */
const EMOTION_BACKGROUNDS: Record<Expression, BackgroundConfig> = {
  // 😐 中性 - 柔和的蓝绿渐变，静谧
  neutral: {
    gradient: {
      colors: ['#0a0f1a', '#1a2a3a', '#0d1520'],
      angle: 180,
      animation: { enabled: false, type: 'shift', speed: 0 },
    },
    glows: [
      { enabled: true, color: '#39c5bb', intensity: 0.15, size: 400, x: 50, y: 30, pulse: false },
    ],
    wave: { enabled: false, color: '#39c5bb', opacity: 0.1, amplitude: 20, frequency: 0.02, speed: 0.5, count: 3 },
    transition: { duration: 800, easing: 'ease-in-out' },
  },
  
  // 😊 开心 - 温暖的橙粉渐变，阳光明媚
  happy: {
    gradient: {
      colors: ['#1a0a1e', '#2d1a35', '#1e0a15'],
      angle: 135,
      animation: { enabled: true, type: 'pulse', speed: 0.3 },
    },
    glows: [
      { enabled: true, color: '#ffb6c1', intensity: 0.3, size: 500, x: 30, y: 20, pulse: true },
      { enabled: true, color: '#ffd700', intensity: 0.2, size: 300, x: 70, y: 60, pulse: true },
    ],
    wave: { enabled: true, color: '#ff69b4', opacity: 0.08, amplitude: 15, frequency: 0.03, speed: 1, count: 4 },
    transition: { duration: 600, easing: 'ease-out' },
  },
  
  // 😢 难过 - 深蓝紫渐变，阴郁
  sad: {
    gradient: {
      colors: ['#0a0a15', '#151525', '#0a0a1a'],
      angle: 180,
      animation: { enabled: true, type: 'shift', speed: 0.1 },
    },
    glows: [
      { enabled: true, color: '#4169e1', intensity: 0.2, size: 600, x: 50, y: 70, pulse: false },
    ],
    wave: { enabled: true, color: '#6495ed', opacity: 0.05, amplitude: 30, frequency: 0.01, speed: 0.3, count: 2 },
    overlay: { color: '#000033', opacity: 0.2 },
    transition: { duration: 1200, easing: 'ease-in-out' },
  },
  
  // 😮 惊讶 - 电光蓝紫，冲击感
  surprised: {
    gradient: {
      colors: ['#0a051a', '#1a0a2e', '#05051a'],
      angle: 45,
      animation: { enabled: true, type: 'wave', speed: 0.8 },
    },
    glows: [
      { enabled: true, color: '#00ffff', intensity: 0.4, size: 400, x: 50, y: 30, pulse: true },
      { enabled: true, color: '#ff00ff', intensity: 0.25, size: 300, x: 30, y: 50, pulse: true },
    ],
    wave: { enabled: false, color: '#00ffff', opacity: 0.1, amplitude: 10, frequency: 0.05, speed: 2, count: 5 },
    transition: { duration: 300, easing: 'ease-out' },
  },
  
  // 😠 生气 - 深红黑渐变，压迫感
  angry: {
    gradient: {
      colors: ['#1a0505', '#2a0a0a', '#150505'],
      angle: 180,
      animation: { enabled: true, type: 'pulse', speed: 0.5 },
    },
    glows: [
      { enabled: true, color: '#ff4500', intensity: 0.35, size: 500, x: 50, y: 40, pulse: true },
      { enabled: true, color: '#8b0000', intensity: 0.2, size: 600, x: 50, y: 80, pulse: false },
    ],
    wave: { enabled: false, color: '#ff0000', opacity: 0.1, amplitude: 5, frequency: 0.1, speed: 3, count: 6 },
    overlay: { color: '#330000', opacity: 0.15 },
    transition: { duration: 400, easing: 'ease-in' },
  },
  
  // 😨 恐惧 - 暗紫绿渐变，不安
  fear: {
    gradient: {
      colors: ['#050510', '#0a0a1a', '#050508'],
      angle: 200,
      animation: { enabled: true, type: 'shift', speed: 0.2 },
    },
    glows: [
      { enabled: true, color: '#9400d3', intensity: 0.2, size: 500, x: 40, y: 60, pulse: true },
      { enabled: true, color: '#006400', intensity: 0.1, size: 400, x: 70, y: 30, pulse: false },
    ],
    wave: { enabled: true, color: '#4b0082', opacity: 0.06, amplitude: 25, frequency: 0.015, speed: 0.4, count: 3 },
    overlay: { color: '#000020', opacity: 0.25 },
    transition: { duration: 500, easing: 'ease-in-out' },
  },
  
  // 🤢 厌恶 - 暗绿黄渐变
  disgusted: {
    gradient: {
      colors: ['#0a0f05', '#151a0a', '#0a0f08'],
      angle: 160,
      animation: { enabled: false, type: 'shift', speed: 0 },
    },
    glows: [
      { enabled: true, color: '#9acd32', intensity: 0.2, size: 400, x: 50, y: 50, pulse: false },
    ],
    wave: { enabled: false, color: '#556b2f', opacity: 0.08, amplitude: 20, frequency: 0.02, speed: 0.3, count: 2 },
    transition: { duration: 600, easing: 'ease-in-out' },
  },
  
  // 🤩 兴奋 - 炫彩渐变，能量爆发
  excited: {
    gradient: {
      colors: ['#1a0520', '#25102a', '#1a0825'],
      angle: 120,
      animation: { enabled: true, type: 'wave', speed: 1 },
    },
    glows: [
      { enabled: true, color: '#ff1493', intensity: 0.4, size: 400, x: 30, y: 30, pulse: true },
      { enabled: true, color: '#ffd700', intensity: 0.35, size: 350, x: 70, y: 40, pulse: true },
      { enabled: true, color: '#00ff7f', intensity: 0.25, size: 300, x: 50, y: 70, pulse: true },
    ],
    wave: { enabled: true, color: '#ff69b4', opacity: 0.12, amplitude: 20, frequency: 0.04, speed: 1.5, count: 5 },
    transition: { duration: 400, easing: 'ease-out' },
  },
  
  // 😌 自豪 - 金色高贵渐变
  proud: {
    gradient: {
      colors: ['#1a1005', '#2a1a0a', '#1a1208'],
      angle: 150,
      animation: { enabled: true, type: 'pulse', speed: 0.2 },
    },
    glows: [
      { enabled: true, color: '#ffd700', intensity: 0.35, size: 500, x: 50, y: 30, pulse: true },
      { enabled: true, color: '#daa520', intensity: 0.2, size: 400, x: 50, y: 60, pulse: false },
    ],
    wave: { enabled: false, color: '#ffd700', opacity: 0.1, amplitude: 15, frequency: 0.02, speed: 0.5, count: 3 },
    transition: { duration: 700, easing: 'ease-in-out' },
  },
  
  // 🥰 恋爱 - 粉红心动渐变
  loving: {
    gradient: {
      colors: ['#1a0515', '#250a1a', '#1a0818'],
      angle: 135,
      animation: { enabled: true, type: 'pulse', speed: 0.4 },
    },
    glows: [
      { enabled: true, color: '#ff69b4', intensity: 0.4, size: 500, x: 50, y: 35, pulse: true },
      { enabled: true, color: '#ff1493', intensity: 0.25, size: 350, x: 30, y: 60, pulse: true },
      { enabled: true, color: '#ffb6c1', intensity: 0.2, size: 300, x: 70, y: 55, pulse: true },
    ],
    wave: { enabled: true, color: '#ff69b4', opacity: 0.1, amplitude: 18, frequency: 0.025, speed: 0.8, count: 4 },
    transition: { duration: 600, easing: 'ease-out' },
  },
  
  // 🙏 感激 - 暖黄橙渐变
  grateful: {
    gradient: {
      colors: ['#1a0f05', '#251508', '#1a1005'],
      angle: 145,
      animation: { enabled: true, type: 'pulse', speed: 0.15 },
    },
    glows: [
      { enabled: true, color: '#ffa500', intensity: 0.3, size: 500, x: 50, y: 40, pulse: true },
      { enabled: true, color: '#ffcc00', intensity: 0.2, size: 400, x: 45, y: 55, pulse: false },
    ],
    wave: { enabled: false, color: '#ffa500', opacity: 0.08, amplitude: 15, frequency: 0.02, speed: 0.4, count: 3 },
    transition: { duration: 800, easing: 'ease-in-out' },
  },
  
  // ✨ 希望 - 天蓝白渐变，清新
  hopeful: {
    gradient: {
      colors: ['#05101a', '#0a1a2a', '#081520'],
      angle: 160,
      animation: { enabled: true, type: 'shift', speed: 0.2 },
    },
    glows: [
      { enabled: true, color: '#87ceeb', intensity: 0.35, size: 500, x: 50, y: 25, pulse: true },
      { enabled: true, color: '#ffffff', intensity: 0.15, size: 300, x: 55, y: 35, pulse: false },
    ],
    wave: { enabled: true, color: '#add8e6', opacity: 0.08, amplitude: 20, frequency: 0.02, speed: 0.6, count: 3 },
    transition: { duration: 700, easing: 'ease-out' },
  },
  
  // 😄 愉悦 - 明亮柔和渐变
  amused: {
    gradient: {
      colors: ['#100a15', '#1a1020', '#120a18'],
      angle: 140,
      animation: { enabled: true, type: 'pulse', speed: 0.25 },
    },
    glows: [
      { enabled: true, color: '#da70d6', intensity: 0.3, size: 400, x: 40, y: 35, pulse: true },
      { enabled: true, color: '#ffb6c1', intensity: 0.25, size: 350, x: 60, y: 50, pulse: true },
    ],
    wave: { enabled: false, color: '#da70d6', opacity: 0.08, amplitude: 12, frequency: 0.03, speed: 0.7, count: 4 },
    transition: { duration: 500, easing: 'ease-out' },
  },
  
  // 😮‍💨 释然 - 淡蓝绿渐变，平静
  relieved: {
    gradient: {
      colors: ['#05100f', '#0a1a18', '#081515'],
      angle: 170,
      animation: { enabled: true, type: 'shift', speed: 0.1 },
    },
    glows: [
      { enabled: true, color: '#20b2aa', intensity: 0.25, size: 500, x: 50, y: 45, pulse: false },
      { enabled: true, color: '#98fb98', intensity: 0.15, size: 400, x: 45, y: 60, pulse: false },
    ],
    wave: { enabled: true, color: '#20b2aa', opacity: 0.06, amplitude: 25, frequency: 0.015, speed: 0.3, count: 2 },
    transition: { duration: 1000, easing: 'ease-in-out' },
  },
  
  // 😰 焦虑 - 暗红紫渐变，紧张
  anxious: {
    gradient: {
      colors: ['#100508', '#1a0a10', '#120508'],
      angle: 190,
      animation: { enabled: true, type: 'pulse', speed: 0.6 },
    },
    glows: [
      { enabled: true, color: '#dc143c', intensity: 0.25, size: 450, x: 50, y: 50, pulse: true },
      { enabled: true, color: '#8b008b', intensity: 0.15, size: 350, x: 35, y: 40, pulse: true },
    ],
    wave: { enabled: false, color: '#dc143c', opacity: 0.08, amplitude: 8, frequency: 0.06, speed: 1.5, count: 5 },
    overlay: { color: '#200010', opacity: 0.15 },
    transition: { duration: 400, easing: 'ease-in' },
  },
  
  // 😳 尴尬 - 粉红渐变，害羞
  embarrassed: {
    gradient: {
      colors: ['#150810', '#1a0a15', '#120812'],
      angle: 155,
      animation: { enabled: true, type: 'pulse', speed: 0.35 },
    },
    glows: [
      { enabled: true, color: '#ff6b6b', intensity: 0.3, size: 400, x: 50, y: 40, pulse: true },
      { enabled: true, color: '#ffb6c1', intensity: 0.2, size: 350, x: 55, y: 55, pulse: false },
    ],
    wave: { enabled: false, color: '#ff6b6b', opacity: 0.08, amplitude: 10, frequency: 0.03, speed: 0.5, count: 3 },
    transition: { duration: 500, easing: 'ease-in-out' },
  },
  
  // 😕 困惑 - 灰蓝渐变，迷茫
  confused: {
    gradient: {
      colors: ['#0a0a10', '#101018', '#0a0a12'],
      angle: 175,
      animation: { enabled: true, type: 'shift', speed: 0.15 },
    },
    glows: [
      { enabled: true, color: '#778899', intensity: 0.2, size: 450, x: 50, y: 45, pulse: false },
      { enabled: true, color: '#b0c4de', intensity: 0.15, size: 350, x: 40, y: 55, pulse: true },
    ],
    wave: { enabled: false, color: '#778899', opacity: 0.06, amplitude: 20, frequency: 0.02, speed: 0.3, count: 3 },
    transition: { duration: 600, easing: 'ease-in-out' },
  },
  
  // 😑 无聊 - 暗灰渐变，沉闷
  bored: {
    gradient: {
      colors: ['#0a0a0a', '#121212', '#0a0a0a'],
      angle: 180,
      animation: { enabled: false, type: 'shift', speed: 0 },
    },
    glows: [
      { enabled: true, color: '#696969', intensity: 0.15, size: 500, x: 50, y: 50, pulse: false },
    ],
    wave: { enabled: false, color: '#696969', opacity: 0.05, amplitude: 30, frequency: 0.01, speed: 0.2, count: 2 },
    overlay: { color: '#000000', opacity: 0.1 },
    transition: { duration: 1000, easing: 'ease-in-out' },
  },
  
  // 😞 失望 - 暗蓝灰渐变
  disappointed: {
    gradient: {
      colors: ['#080a10', '#0f1218', '#080a12'],
      angle: 185,
      animation: { enabled: true, type: 'shift', speed: 0.08 },
    },
    glows: [
      { enabled: true, color: '#4682b4', intensity: 0.2, size: 500, x: 50, y: 55, pulse: false },
    ],
    wave: { enabled: true, color: '#4682b4', opacity: 0.05, amplitude: 25, frequency: 0.012, speed: 0.25, count: 2 },
    overlay: { color: '#000015', opacity: 0.15 },
    transition: { duration: 900, easing: 'ease-in-out' },
  },
  
  // 😔 孤独 - 深紫蓝渐变，寂寥
  lonely: {
    gradient: {
      colors: ['#05050a', '#0a0a15', '#05050c'],
      angle: 195,
      animation: { enabled: true, type: 'shift', speed: 0.05 },
    },
    glows: [
      { enabled: true, color: '#483d8b', intensity: 0.2, size: 550, x: 50, y: 60, pulse: false },
      { enabled: true, color: '#6a5acd', intensity: 0.1, size: 400, x: 45, y: 45, pulse: false },
    ],
    wave: { enabled: true, color: '#483d8b', opacity: 0.04, amplitude: 30, frequency: 0.01, speed: 0.2, count: 2 },
    overlay: { color: '#000010', opacity: 0.2 },
    transition: { duration: 1200, easing: 'ease-in-out' },
  },
  
  // 🤔 思考 - 蓝紫渐变，专注
  thinking: {
    gradient: {
      colors: ['#08080f', '#101020', '#0a0a15'],
      angle: 165,
      animation: { enabled: true, type: 'pulse', speed: 0.15 },
    },
    glows: [
      { enabled: true, color: '#7b68ee', intensity: 0.25, size: 450, x: 50, y: 35, pulse: true },
      { enabled: true, color: '#9370db', intensity: 0.15, size: 350, x: 55, y: 50, pulse: false },
    ],
    wave: { enabled: false, color: '#7b68ee', opacity: 0.06, amplitude: 15, frequency: 0.025, speed: 0.4, count: 3 },
    transition: { duration: 600, easing: 'ease-in-out' },
  },
  
  // 🧐 好奇 - 青绿渐变，探索
  curious: {
    gradient: {
      colors: ['#05100f', '#0a1a18', '#08151a'],
      angle: 140,
      animation: { enabled: true, type: 'shift', speed: 0.25 },
    },
    glows: [
      { enabled: true, color: '#00ced1', intensity: 0.3, size: 400, x: 45, y: 35, pulse: true },
      { enabled: true, color: '#40e0d0', intensity: 0.2, size: 350, x: 60, y: 50, pulse: true },
    ],
    wave: { enabled: true, color: '#00ced1', opacity: 0.08, amplitude: 18, frequency: 0.03, speed: 0.7, count: 4 },
    transition: { duration: 500, easing: 'ease-out' },
  },
  
  // 💪 坚定 - 深蓝钢铁渐变，力量
  determined: {
    gradient: {
      colors: ['#05080f', '#0a1015', '#080a12'],
      angle: 175,
      animation: { enabled: true, type: 'pulse', speed: 0.1 },
    },
    glows: [
      { enabled: true, color: '#4169e1', intensity: 0.3, size: 500, x: 50, y: 40, pulse: false },
      { enabled: true, color: '#1e90ff', intensity: 0.2, size: 400, x: 50, y: 55, pulse: true },
    ],
    wave: { enabled: false, color: '#4169e1', opacity: 0.08, amplitude: 10, frequency: 0.02, speed: 0.4, count: 3 },
    transition: { duration: 700, easing: 'ease-in-out' },
  },
  
  // 😜 俏皮 - 彩虹渐变，活泼
  playful: {
    gradient: {
      colors: ['#10051a', '#1a0a25', '#150820'],
      angle: 125,
      animation: { enabled: true, type: 'wave', speed: 0.8 },
    },
    glows: [
      { enabled: true, color: '#ff69b4', intensity: 0.35, size: 350, x: 30, y: 30, pulse: true },
      { enabled: true, color: '#00ff7f', intensity: 0.3, size: 300, x: 70, y: 35, pulse: true },
      { enabled: true, color: '#ffd700', intensity: 0.25, size: 280, x: 50, y: 65, pulse: true },
    ],
    wave: { enabled: true, color: '#ff69b4', opacity: 0.1, amplitude: 15, frequency: 0.04, speed: 1.2, count: 5 },
    transition: { duration: 400, easing: 'ease-out' },
  },
};

/**
 * 背景系统状态
 */
export interface BackgroundState {
  currentEmotion: Expression;
  currentConfig: BackgroundConfig;
  isTransitioning: boolean;
  animationPhase: number;
}

type StateCallback = (state: BackgroundState) => void;

/**
 * 情绪驱动背景系统
 */
export class EmotionBackgroundSystem {
  private currentEmotion: Expression = 'neutral';
  private currentConfig: BackgroundConfig;
  private isTransitioning: boolean = false;
  private animationPhase: number = 0;
  private animationFrame: number | null = null;
  private callbacks: Set<StateCallback> = new Set();
  private enabled: boolean = true;
  
  constructor() {
    this.currentConfig = EMOTION_BACKGROUNDS.neutral;
  }
  
  /**
   * 启动动画循环
   */
  start(): void {
    if (this.animationFrame !== null) return;
    
    const animate = () => {
      this.animationPhase += 0.016; // ~60fps
      this.notifyCallbacks();
      this.animationFrame = requestAnimationFrame(animate);
    };
    
    this.animationFrame = requestAnimationFrame(animate);
  }
  
  /**
   * 停止动画循环
   */
  stop(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }
  
  /**
   * 设置情绪（触发背景变化）
   */
  setEmotion(emotion: Expression): void {
    if (emotion === this.currentEmotion) return;
    
    this.currentEmotion = emotion;
    this.currentConfig = EMOTION_BACKGROUNDS[emotion] || EMOTION_BACKGROUNDS.neutral;
    this.isTransitioning = true;
    
    // 过渡结束后重置标志
    setTimeout(() => {
      this.isTransitioning = false;
      this.notifyCallbacks();
    }, this.currentConfig.transition.duration);
    
    this.notifyCallbacks();
  }
  
  /**
   * 获取当前状态
   */
  getState(): BackgroundState {
    return {
      currentEmotion: this.currentEmotion,
      currentConfig: this.currentConfig,
      isTransitioning: this.isTransitioning,
      animationPhase: this.animationPhase,
    };
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): BackgroundConfig {
    return this.currentConfig;
  }
  
  /**
   * 获取情绪预设
   */
  getPreset(emotion: Expression): BackgroundConfig {
    return EMOTION_BACKGROUNDS[emotion] || EMOTION_BACKGROUNDS.neutral;
  }
  
  /**
   * 获取所有预设
   */
  getAllPresets(): Record<Expression, BackgroundConfig> {
    return { ...EMOTION_BACKGROUNDS };
  }
  
  /**
   * 启用/禁用
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
  }
  
  /**
   * 是否启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }
  
  /**
   * 订阅状态变化
   */
  onStateChange(callback: StateCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }
  
  /**
   * 通知所有回调
   */
  private notifyCallbacks(): void {
    const state = this.getState();
    this.callbacks.forEach(cb => cb(state));
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    this.stop();
    this.callbacks.clear();
  }
  
  /**
   * 生成 CSS 渐变字符串
   */
  generateGradientCSS(phase: number = 0): string {
    const { gradient } = this.currentConfig;
    const colors = gradient.colors;
    
    if (!gradient.animation?.enabled) {
      return `linear-gradient(${gradient.angle}deg, ${colors.join(', ')})`;
    }
    
    // 动画渐变
    const animationType = gradient.animation.type;
    const speed = gradient.animation.speed;
    
    switch (animationType) {
      case 'shift': {
        // 颜色位移动画
        const shift = (Math.sin(phase * speed * Math.PI) + 1) / 2 * 10;
        const shiftedColors = colors.map((color, i) => {
          const pos = (i / (colors.length - 1)) * 100 + shift;
          return `${color} ${pos}%`;
        });
        return `linear-gradient(${gradient.angle}deg, ${shiftedColors.join(', ')})`;
      }
      
      case 'pulse': {
        // 脉冲动画（亮度变化）
        const pulse = (Math.sin(phase * speed * 2 * Math.PI) + 1) / 2;
        const factor = 0.9 + pulse * 0.2; // 0.9-1.1
        const pulsedColors = colors.map(color => this.adjustBrightness(color, factor));
        return `linear-gradient(${gradient.angle}deg, ${pulsedColors.join(', ')})`;
      }
      
      case 'wave': {
        // 波浪动画（角度变化）
        const wave = Math.sin(phase * speed * Math.PI) * 15;
        const angle = gradient.angle + wave;
        return `linear-gradient(${angle}deg, ${colors.join(', ')})`;
      }
      
      default:
        return `linear-gradient(${gradient.angle}deg, ${colors.join(', ')})`;
    }
  }
  
  /**
   * 调整颜色亮度
   */
  private adjustBrightness(hex: string, factor: number): string {
    // 解析 hex 颜色
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    // 调整亮度
    const newR = Math.min(255, Math.round(r * factor));
    const newG = Math.min(255, Math.round(g * factor));
    const newB = Math.min(255, Math.round(b * factor));
    
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }
}

// 单例
export const emotionBackgroundSystem = new EmotionBackgroundSystem();

/**
 * 便捷函数
 */
export function setBackgroundEmotion(emotion: Expression): void {
  emotionBackgroundSystem.setEmotion(emotion);
}

export function getBackgroundConfig(): BackgroundConfig {
  return emotionBackgroundSystem.getConfig();
}

export function startBackgroundAnimation(): void {
  emotionBackgroundSystem.start();
}

export function stopBackgroundAnimation(): void {
  emotionBackgroundSystem.stop();
}
