/**
 * SceneDirectorSystem - 智能场景导演系统
 * 
 * SOTA Round 40 - 基于市场分析的高价值功能
 * 
 * 市场背景:
 * - HeyGen Video Agent: 自动化视频生成，场景智能切换
 * - Synthesia: 专业模板系统，场景预设
 * - D-ID: 实时对话，沉浸式体验
 * 
 * 核心价值:
 * 1. 统一协调所有视觉系统 (背景、粒子、表情、动画)
 * 2. 提供场景预设模式 (温馨聊天、工作汇报、故事讲述等)
 * 3. 根据对话内容自动调整整体氛围
 * 4. 电影级转场效果
 * 
 * 解决问题:
 * - 目前各系统独立运行，缺乏整体协调
 * - 用户需要手动调整多个设置
 * - 场景切换生硬，缺少过渡效果
 */

import type { Expression } from './AvatarController';
import type { Atmosphere } from './EmotionContextEngine';

// ========== 类型定义 ==========

/** 场景模式 */
export type SceneMode = 
  | 'casual_chat'       // 日常闲聊 - 轻松自然
  | 'work_meeting'      // 工作会议 - 专业正式
  | 'storytelling'      // 故事讲述 - 戏剧性强
  | 'emotional_support' // 情感陪伴 - 温暖共情
  | 'celebration'       // 庆祝时刻 - 热烈欢快
  | 'meditation'        // 冥想放松 - 平静祥和
  | 'gaming'            // 游戏互动 - 活力四射
  | 'learning'          // 学习辅导 - 专注清晰
  | 'romantic'          // 浪漫氛围 - 温馨甜蜜
  | 'horror'            // 惊悚氛围 - 紧张刺激
  | 'custom';           // 自定义场景

/** 时间氛围 */
export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' | 'midnight';

/** 天气效果 */
export type WeatherEffect = 'none' | 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'stormy' | 'foggy';

/** 场景元素控制 */
export interface SceneElements {
  // 背景控制
  background: {
    enabled: boolean;
    intensity: number;    // 0-1, 背景效果强度
    colorShift: number;   // -1 到 1, 色调偏移 (冷-暖)
  };
  // 粒子控制
  particles: {
    enabled: boolean;
    intensity: number;    // 0-2, 粒子密度倍数
    speed: number;        // 0-2, 粒子速度倍数
  };
  // 表情控制
  expression: {
    intensity: number;    // 0-2, 表情强度倍数
    baseEmotion: Expression;  // 基础情绪倾向
    emotionRange: number; // 0-1, 允许的情绪变化范围
  };
  // 动画控制
  animation: {
    speed: number;        // 0-2, 动画速度倍数
    breathing: number;    // 0-2, 呼吸幅度
    idleMotion: number;   // 0-2, 待机动作幅度
  };
  // 光效控制
  lighting: {
    brightness: number;   // 0-2
    contrast: number;     // 0-2
    warmth: number;       // -1 到 1 (冷-暖)
    vignette: number;     // 0-1, 暗角强度
  };
  // 音效提示 (供 TTS 系统参考)
  audio: {
    voiceTone: 'normal' | 'soft' | 'energetic' | 'serious' | 'playful';
    speechSpeed: number;  // 0.5-2
    volume: number;       // 0-1
  };
}

/** 场景预设配置 */
export interface ScenePreset {
  mode: SceneMode;
  name: string;
  description: string;
  elements: SceneElements;
  triggers: {
    keywords: string[];           // 触发关键词
    emotions: Expression[];       // 触发情绪
    atmospheres: Atmosphere[];    // 触发氛围
  };
  transitions: {
    inDuration: number;           // 进入过渡时间 (ms)
    outDuration: number;          // 退出过渡时间 (ms)
    style: 'fade' | 'slide' | 'zoom' | 'dissolve' | 'ripple';
  };
}

/** 场景状态 */
export interface SceneState {
  currentMode: SceneMode;
  previousMode: SceneMode | null;
  elements: SceneElements;
  isTransitioning: boolean;
  transitionProgress: number;     // 0-1
  autoModeEnabled: boolean;
  timeOfDay: TimeOfDay;
  weather: WeatherEffect;
  customOverrides: Partial<SceneElements>;
}

/** 场景变化事件 */
export interface SceneChangeEvent {
  from: SceneMode;
  to: SceneMode;
  reason: 'manual' | 'auto_emotion' | 'auto_keyword' | 'auto_time' | 'api';
  timestamp: number;
}

// ========== 场景预设 ==========

const SCENE_PRESETS: Record<SceneMode, ScenePreset> = {
  casual_chat: {
    mode: 'casual_chat',
    name: '日常闲聊',
    description: '轻松自然的日常对话氛围',
    elements: {
      background: { enabled: true, intensity: 0.6, colorShift: 0.1 },
      particles: { enabled: true, intensity: 0.5, speed: 0.8 },
      expression: { intensity: 1.0, baseEmotion: 'neutral', emotionRange: 0.8 },
      animation: { speed: 1.0, breathing: 1.0, idleMotion: 1.0 },
      lighting: { brightness: 1.0, contrast: 1.0, warmth: 0.1, vignette: 0.2 },
      audio: { voiceTone: 'normal', speechSpeed: 1.0, volume: 0.8 },
    },
    triggers: {
      keywords: ['聊聊', '最近怎么样', '今天', '闲聊', '随便说说'],
      emotions: ['neutral', 'happy', 'curious'],
      atmospheres: ['casual', 'warm'],
    },
    transitions: { inDuration: 800, outDuration: 600, style: 'fade' },
  },

  work_meeting: {
    mode: 'work_meeting',
    name: '工作会议',
    description: '专业正式的工作汇报氛围',
    elements: {
      background: { enabled: true, intensity: 0.4, colorShift: -0.2 },
      particles: { enabled: false, intensity: 0, speed: 0 },
      expression: { intensity: 0.7, baseEmotion: 'thinking', emotionRange: 0.4 },
      animation: { speed: 0.8, breathing: 0.6, idleMotion: 0.4 },
      lighting: { brightness: 1.1, contrast: 1.2, warmth: -0.1, vignette: 0.3 },
      audio: { voiceTone: 'serious', speechSpeed: 0.95, volume: 0.85 },
    },
    triggers: {
      keywords: ['工作', '项目', '进度', '会议', '报告', '方案', '任务', '需求'],
      emotions: ['thinking', 'determined', 'neutral'],
      atmospheres: ['serious', 'neutral'],
    },
    transitions: { inDuration: 600, outDuration: 500, style: 'slide' },
  },

  storytelling: {
    mode: 'storytelling',
    name: '故事讲述',
    description: '戏剧性强的叙事氛围',
    elements: {
      background: { enabled: true, intensity: 0.9, colorShift: 0 },
      particles: { enabled: true, intensity: 0.8, speed: 0.6 },
      expression: { intensity: 1.4, baseEmotion: 'curious', emotionRange: 1.0 },
      animation: { speed: 1.1, breathing: 1.2, idleMotion: 1.3 },
      lighting: { brightness: 0.9, contrast: 1.3, warmth: 0.2, vignette: 0.5 },
      audio: { voiceTone: 'playful', speechSpeed: 1.05, volume: 0.9 },
    },
    triggers: {
      keywords: ['故事', '从前', '传说', '有一天', '发生了', '讲个', '说说'],
      emotions: ['curious', 'surprised', 'amused'],
      atmospheres: ['playful', 'warm'],
    },
    transitions: { inDuration: 1000, outDuration: 800, style: 'dissolve' },
  },

  emotional_support: {
    mode: 'emotional_support',
    name: '情感陪伴',
    description: '温暖共情的心灵支持氛围',
    elements: {
      background: { enabled: true, intensity: 0.5, colorShift: 0.3 },
      particles: { enabled: true, intensity: 0.3, speed: 0.4 },
      expression: { intensity: 0.9, baseEmotion: 'grateful', emotionRange: 0.6 },
      animation: { speed: 0.85, breathing: 1.3, idleMotion: 0.8 },
      lighting: { brightness: 0.95, contrast: 0.9, warmth: 0.4, vignette: 0.4 },
      audio: { voiceTone: 'soft', speechSpeed: 0.9, volume: 0.75 },
    },
    triggers: {
      keywords: ['难过', '伤心', '累了', '压力', '烦', '不开心', '安慰', '倾诉'],
      emotions: ['sad', 'anxious', 'lonely', 'disappointed'],
      atmospheres: ['melancholy', 'warm'],
    },
    transitions: { inDuration: 1200, outDuration: 1000, style: 'fade' },
  },

  celebration: {
    mode: 'celebration',
    name: '庆祝时刻',
    description: '热烈欢快的庆祝氛围',
    elements: {
      background: { enabled: true, intensity: 1.0, colorShift: 0.5 },
      particles: { enabled: true, intensity: 2.0, speed: 1.5 },
      expression: { intensity: 1.5, baseEmotion: 'excited', emotionRange: 0.5 },
      animation: { speed: 1.3, breathing: 1.4, idleMotion: 1.5 },
      lighting: { brightness: 1.2, contrast: 1.1, warmth: 0.3, vignette: 0.1 },
      audio: { voiceTone: 'energetic', speechSpeed: 1.1, volume: 0.95 },
    },
    triggers: {
      keywords: ['恭喜', '太棒了', '成功', '庆祝', '生日', '赢了', '第一'],
      emotions: ['excited', 'happy', 'proud'],
      atmospheres: ['playful', 'warm'],
    },
    transitions: { inDuration: 500, outDuration: 700, style: 'ripple' },
  },

  meditation: {
    mode: 'meditation',
    name: '冥想放松',
    description: '平静祥和的放松氛围',
    elements: {
      background: { enabled: true, intensity: 0.4, colorShift: -0.1 },
      particles: { enabled: true, intensity: 0.2, speed: 0.3 },
      expression: { intensity: 0.5, baseEmotion: 'relieved', emotionRange: 0.3 },
      animation: { speed: 0.6, breathing: 1.8, idleMotion: 0.3 },
      lighting: { brightness: 0.85, contrast: 0.8, warmth: 0, vignette: 0.6 },
      audio: { voiceTone: 'soft', speechSpeed: 0.8, volume: 0.6 },
    },
    triggers: {
      keywords: ['放松', '冥想', '深呼吸', '平静', '安静', '休息', '睡觉'],
      emotions: ['relieved', 'neutral'],
      atmospheres: ['neutral', 'warm'],
    },
    transitions: { inDuration: 1500, outDuration: 1200, style: 'fade' },
  },

  gaming: {
    mode: 'gaming',
    name: '游戏互动',
    description: '活力四射的游戏氛围',
    elements: {
      background: { enabled: true, intensity: 0.8, colorShift: -0.3 },
      particles: { enabled: true, intensity: 1.2, speed: 1.3 },
      expression: { intensity: 1.3, baseEmotion: 'playful', emotionRange: 1.0 },
      animation: { speed: 1.2, breathing: 1.1, idleMotion: 1.4 },
      lighting: { brightness: 1.1, contrast: 1.2, warmth: -0.2, vignette: 0.2 },
      audio: { voiceTone: 'energetic', speechSpeed: 1.1, volume: 0.9 },
    },
    triggers: {
      keywords: ['游戏', '玩', '打', '赢', '输', '比赛', 'GG', '加油'],
      emotions: ['playful', 'excited', 'determined'],
      atmospheres: ['playful', 'tense'],
    },
    transitions: { inDuration: 400, outDuration: 400, style: 'zoom' },
  },

  learning: {
    mode: 'learning',
    name: '学习辅导',
    description: '专注清晰的学习氛围',
    elements: {
      background: { enabled: true, intensity: 0.5, colorShift: 0 },
      particles: { enabled: false, intensity: 0, speed: 0 },
      expression: { intensity: 0.8, baseEmotion: 'curious', emotionRange: 0.5 },
      animation: { speed: 0.9, breathing: 0.8, idleMotion: 0.5 },
      lighting: { brightness: 1.15, contrast: 1.1, warmth: 0, vignette: 0.25 },
      audio: { voiceTone: 'normal', speechSpeed: 0.95, volume: 0.8 },
    },
    triggers: {
      keywords: ['学习', '教', '怎么', '为什么', '解释', '理解', '知识', '课程'],
      emotions: ['curious', 'thinking', 'confused'],
      atmospheres: ['serious', 'neutral'],
    },
    transitions: { inDuration: 700, outDuration: 600, style: 'slide' },
  },

  romantic: {
    mode: 'romantic',
    name: '浪漫氛围',
    description: '温馨甜蜜的浪漫氛围',
    elements: {
      background: { enabled: true, intensity: 0.7, colorShift: 0.4 },
      particles: { enabled: true, intensity: 0.8, speed: 0.5 },
      expression: { intensity: 1.1, baseEmotion: 'loving', emotionRange: 0.5 },
      animation: { speed: 0.9, breathing: 1.2, idleMotion: 0.9 },
      lighting: { brightness: 0.95, contrast: 0.95, warmth: 0.5, vignette: 0.45 },
      audio: { voiceTone: 'soft', speechSpeed: 0.9, volume: 0.75 },
    },
    triggers: {
      keywords: ['喜欢', '爱', '想你', '在一起', '心动', '温柔', '亲爱的'],
      emotions: ['loving', 'happy', 'grateful'],
      atmospheres: ['warm'],
    },
    transitions: { inDuration: 1000, outDuration: 900, style: 'dissolve' },
  },

  horror: {
    mode: 'horror',
    name: '惊悚氛围',
    description: '紧张刺激的惊悚氛围',
    elements: {
      background: { enabled: true, intensity: 0.9, colorShift: -0.5 },
      particles: { enabled: true, intensity: 0.6, speed: 0.4 },
      expression: { intensity: 1.2, baseEmotion: 'fear', emotionRange: 0.7 },
      animation: { speed: 0.7, breathing: 0.5, idleMotion: 0.3 },
      lighting: { brightness: 0.7, contrast: 1.5, warmth: -0.4, vignette: 0.7 },
      audio: { voiceTone: 'soft', speechSpeed: 0.85, volume: 0.7 },
    },
    triggers: {
      keywords: ['恐怖', '害怕', '鬼', '吓人', '可怕', '阴森', '诡异'],
      emotions: ['fear', 'anxious', 'surprised'],
      atmospheres: ['tense'],
    },
    transitions: { inDuration: 800, outDuration: 1000, style: 'fade' },
  },

  custom: {
    mode: 'custom',
    name: '自定义场景',
    description: '用户自定义的场景配置',
    elements: {
      background: { enabled: true, intensity: 0.6, colorShift: 0 },
      particles: { enabled: true, intensity: 0.5, speed: 1.0 },
      expression: { intensity: 1.0, baseEmotion: 'neutral', emotionRange: 1.0 },
      animation: { speed: 1.0, breathing: 1.0, idleMotion: 1.0 },
      lighting: { brightness: 1.0, contrast: 1.0, warmth: 0, vignette: 0.2 },
      audio: { voiceTone: 'normal', speechSpeed: 1.0, volume: 0.8 },
    },
    triggers: { keywords: [], emotions: [], atmospheres: [] },
    transitions: { inDuration: 600, outDuration: 600, style: 'fade' },
  },
};

// ========== 时间感知配置 ==========

const TIME_ADJUSTMENTS: Record<TimeOfDay, Partial<SceneElements>> = {
  dawn: {
    lighting: { brightness: 0.85, contrast: 0.9, warmth: 0.3, vignette: 0.3 },
    background: { enabled: true, intensity: 0.5, colorShift: 0.2 },
  },
  morning: {
    lighting: { brightness: 1.1, contrast: 1.0, warmth: 0.1, vignette: 0.15 },
    background: { enabled: true, intensity: 0.6, colorShift: 0.1 },
  },
  afternoon: {
    lighting: { brightness: 1.15, contrast: 1.05, warmth: 0.15, vignette: 0.2 },
    background: { enabled: true, intensity: 0.65, colorShift: 0.15 },
  },
  evening: {
    lighting: { brightness: 0.9, contrast: 1.1, warmth: 0.35, vignette: 0.35 },
    background: { enabled: true, intensity: 0.7, colorShift: 0.3 },
  },
  night: {
    lighting: { brightness: 0.75, contrast: 1.15, warmth: -0.1, vignette: 0.45 },
    background: { enabled: true, intensity: 0.55, colorShift: -0.15 },
  },
  midnight: {
    lighting: { brightness: 0.6, contrast: 1.2, warmth: -0.2, vignette: 0.55 },
    background: { enabled: true, intensity: 0.45, colorShift: -0.25 },
  },
};

// ========== 天气效果配置 ==========

const WEATHER_ADJUSTMENTS: Record<WeatherEffect, Partial<SceneElements>> = {
  none: {},
  sunny: {
    lighting: { brightness: 1.15, contrast: 1.05, warmth: 0.2, vignette: 0.1 },
    particles: { enabled: true, intensity: 0.3, speed: 0.5 },
  },
  cloudy: {
    lighting: { brightness: 0.9, contrast: 0.95, warmth: -0.05, vignette: 0.25 },
    background: { enabled: true, intensity: 0.5, colorShift: -0.1 },
  },
  rainy: {
    lighting: { brightness: 0.8, contrast: 1.0, warmth: -0.15, vignette: 0.4 },
    particles: { enabled: true, intensity: 1.2, speed: 1.5 },
    background: { enabled: true, intensity: 0.6, colorShift: -0.2 },
  },
  snowy: {
    lighting: { brightness: 1.0, contrast: 0.9, warmth: -0.25, vignette: 0.3 },
    particles: { enabled: true, intensity: 1.5, speed: 0.6 },
    background: { enabled: true, intensity: 0.5, colorShift: -0.3 },
  },
  stormy: {
    lighting: { brightness: 0.65, contrast: 1.3, warmth: -0.3, vignette: 0.5 },
    particles: { enabled: true, intensity: 1.8, speed: 2.0 },
    background: { enabled: true, intensity: 0.8, colorShift: -0.4 },
  },
  foggy: {
    lighting: { brightness: 0.85, contrast: 0.75, warmth: 0, vignette: 0.6 },
    particles: { enabled: true, intensity: 0.8, speed: 0.3 },
    background: { enabled: true, intensity: 0.4, colorShift: 0 },
  },
};

// ========== 场景导演系统类 ==========

type SceneChangeCallback = (event: SceneChangeEvent) => void;
type StateChangeCallback = (state: SceneState) => void;

export class SceneDirectorSystem {
  private state: SceneState;
  private sceneChangeCallbacks: Set<SceneChangeCallback> = new Set();
  private stateChangeCallbacks: Set<StateChangeCallback> = new Set();
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;
  private autoDetectTimer: ReturnType<typeof setInterval> | null = null;
  private recentKeywords: string[] = [];
  private recentEmotions: Expression[] = [];

  constructor() {
    this.state = {
      currentMode: 'casual_chat',
      previousMode: null,
      elements: { ...SCENE_PRESETS.casual_chat.elements },
      isTransitioning: false,
      transitionProgress: 0,
      autoModeEnabled: true,
      timeOfDay: this.detectTimeOfDay(),
      weather: 'none',
      customOverrides: {},
    };
  }

  // ========== 公共 API ==========

  /**
   * 获取当前场景状态
   */
  getState(): Readonly<SceneState> {
    return { ...this.state };
  }

  /**
   * 获取所有可用场景预设
   */
  getAvailableScenes(): ScenePreset[] {
    return Object.values(SCENE_PRESETS);
  }

  /**
   * 获取场景预设
   */
  getPreset(mode: SceneMode): ScenePreset {
    return SCENE_PRESETS[mode];
  }

  /**
   * 手动切换场景
   */
  setScene(mode: SceneMode, options?: { immediate?: boolean }): void {
    if (mode === this.state.currentMode && !this.state.isTransitioning) {
      return;
    }

    const preset = SCENE_PRESETS[mode];
    const immediate = options?.immediate ?? false;

    this.triggerSceneChange(mode, 'manual', immediate ? 0 : preset.transitions.inDuration);
  }

  /**
   * 启用/禁用自动场景检测
   */
  setAutoMode(enabled: boolean): void {
    this.state.autoModeEnabled = enabled;
    this.notifyStateChange();
  }

  /**
   * 设置时间氛围
   */
  setTimeOfDay(time: TimeOfDay): void {
    this.state.timeOfDay = time;
    this.applyEnvironmentAdjustments();
    this.notifyStateChange();
  }

  /**
   * 设置天气效果
   */
  setWeather(weather: WeatherEffect): void {
    this.state.weather = weather;
    this.applyEnvironmentAdjustments();
    this.notifyStateChange();
  }

  /**
   * 自动检测时间
   */
  detectTimeOfDay(): TimeOfDay {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 7) return 'dawn';
    if (hour >= 7 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 20) return 'evening';
    if (hour >= 20 && hour < 24) return 'night';
    return 'midnight';
  }

  /**
   * 自定义场景元素
   */
  setCustomOverrides(overrides: Partial<SceneElements>): void {
    this.state.customOverrides = overrides;
    this.applyEnvironmentAdjustments();
    this.notifyStateChange();
  }

  /**
   * 清除自定义覆盖
   */
  clearCustomOverrides(): void {
    this.state.customOverrides = {};
    this.applyEnvironmentAdjustments();
    this.notifyStateChange();
  }

  /**
   * 分析文本并可能触发场景切换
   */
  analyzeText(text: string, emotion?: Expression, atmosphere?: Atmosphere): void {
    if (!this.state.autoModeEnabled) return;

    // 记录最近的关键词和情绪
    this.recentKeywords.push(text.toLowerCase());
    if (this.recentKeywords.length > 10) {
      this.recentKeywords.shift();
    }

    if (emotion) {
      this.recentEmotions.push(emotion);
      if (this.recentEmotions.length > 5) {
        this.recentEmotions.shift();
      }
    }

    // 检测是否需要切换场景
    const suggestedScene = this.detectBestScene(text, emotion, atmosphere);
    if (suggestedScene && suggestedScene !== this.state.currentMode) {
      const confidence = this.calculateConfidence(suggestedScene, text, emotion, atmosphere);
      
      // 置信度阈值：需要足够高的置信度才会自动切换
      if (confidence > 0.6) {
        this.triggerSceneChange(
          suggestedScene,
          emotion ? 'auto_emotion' : 'auto_keyword',
          SCENE_PRESETS[suggestedScene].transitions.inDuration
        );
      }
    }
  }

  /**
   * 订阅场景变化
   */
  onSceneChange(callback: SceneChangeCallback): () => void {
    this.sceneChangeCallbacks.add(callback);
    return () => this.sceneChangeCallbacks.delete(callback);
  }

  /**
   * 订阅状态变化
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateChangeCallbacks.add(callback);
    return () => this.stateChangeCallbacks.delete(callback);
  }

  /**
   * 获取当前元素配置（已应用所有调整）
   */
  getCurrentElements(): SceneElements {
    return { ...this.state.elements };
  }

  /**
   * 获取场景建议
   */
  getSuggestion(text: string, emotion?: Expression): { scene: SceneMode; confidence: number; reason: string } | null {
    const suggested = this.detectBestScene(text, emotion);
    if (!suggested || suggested === this.state.currentMode) {
      return null;
    }

    const confidence = this.calculateConfidence(suggested, text, emotion);
    const preset = SCENE_PRESETS[suggested];

    return {
      scene: suggested,
      confidence,
      reason: `检测到与"${preset.name}"场景相关的内容`,
    };
  }

  /**
   * 启动自动时间检测
   */
  startAutoTimeDetection(intervalMs: number = 60000): void {
    this.stopAutoTimeDetection();
    this.autoDetectTimer = setInterval(() => {
      const newTime = this.detectTimeOfDay();
      if (newTime !== this.state.timeOfDay) {
        this.setTimeOfDay(newTime);
      }
    }, intervalMs);
  }

  /**
   * 停止自动时间检测
   */
  stopAutoTimeDetection(): void {
    if (this.autoDetectTimer) {
      clearInterval(this.autoDetectTimer);
      this.autoDetectTimer = null;
    }
  }

  /**
   * 销毁系统
   */
  destroy(): void {
    this.stopAutoTimeDetection();
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
    this.sceneChangeCallbacks.clear();
    this.stateChangeCallbacks.clear();
  }

  // ========== 私有方法 ==========

  private detectBestScene(text: string, emotion?: Expression, atmosphere?: Atmosphere): SceneMode | null {
    const lowerText = text.toLowerCase();
    let bestMatch: SceneMode | null = null;
    let bestScore = 0;

    for (const preset of Object.values(SCENE_PRESETS)) {
      if (preset.mode === 'custom') continue;

      let score = 0;

      // 关键词匹配
      for (const keyword of preset.triggers.keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          score += 2;
        }
      }

      // 情绪匹配
      if (emotion && preset.triggers.emotions.includes(emotion)) {
        score += 1.5;
      }

      // 氛围匹配
      if (atmosphere && preset.triggers.atmospheres.includes(atmosphere)) {
        score += 1;
      }

      // 最近情绪趋势匹配
      const emotionTrend = this.recentEmotions.filter(e => 
        preset.triggers.emotions.includes(e)
      ).length;
      score += emotionTrend * 0.3;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = preset.mode;
      }
    }

    return bestScore >= 1.5 ? bestMatch : null;
  }

  private calculateConfidence(
    scene: SceneMode,
    text: string,
    emotion?: Expression,
    atmosphere?: Atmosphere
  ): number {
    const preset = SCENE_PRESETS[scene];
    let confidence = 0;
    let factors = 0;

    // 关键词匹配权重
    const keywordMatches = preset.triggers.keywords.filter(k => 
      text.toLowerCase().includes(k.toLowerCase())
    ).length;
    if (preset.triggers.keywords.length > 0) {
      confidence += (keywordMatches / preset.triggers.keywords.length) * 0.4;
      factors += 0.4;
    }

    // 情绪匹配权重
    if (emotion) {
      if (preset.triggers.emotions.includes(emotion)) {
        confidence += 0.3;
      }
      factors += 0.3;
    }

    // 氛围匹配权重
    if (atmosphere) {
      if (preset.triggers.atmospheres.includes(atmosphere)) {
        confidence += 0.2;
      }
      factors += 0.2;
    }

    // 趋势匹配
    const trendMatch = this.recentEmotions.filter(e => 
      preset.triggers.emotions.includes(e)
    ).length / Math.max(this.recentEmotions.length, 1);
    confidence += trendMatch * 0.1;
    factors += 0.1;

    return factors > 0 ? confidence / factors : 0;
  }

  private triggerSceneChange(
    newMode: SceneMode,
    reason: SceneChangeEvent['reason'],
    duration: number
  ): void {
    // 清除之前的过渡
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
    }

    const event: SceneChangeEvent = {
      from: this.state.currentMode,
      to: newMode,
      reason,
      timestamp: Date.now(),
    };

    this.state.previousMode = this.state.currentMode;
    this.state.currentMode = newMode;
    this.state.isTransitioning = true;
    this.state.transitionProgress = 0;

    // 通知场景变化
    this.sceneChangeCallbacks.forEach(cb => cb(event));

    // 开始过渡动画
    if (duration > 0) {
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        this.state.transitionProgress = Math.min(elapsed / duration, 1);
        
        // 插值计算元素值
        this.interpolateElements(this.state.transitionProgress);
        this.notifyStateChange();

        if (this.state.transitionProgress < 1) {
          this.transitionTimer = setTimeout(animate, 16);
        } else {
          this.state.isTransitioning = false;
          this.applyEnvironmentAdjustments();
          this.notifyStateChange();
        }
      };
      animate();
    } else {
      this.state.isTransitioning = false;
      this.state.transitionProgress = 1;
      this.applyEnvironmentAdjustments();
      this.notifyStateChange();
    }
  }

  private interpolateElements(progress: number): void {
    const fromPreset = this.state.previousMode 
      ? SCENE_PRESETS[this.state.previousMode] 
      : SCENE_PRESETS[this.state.currentMode];
    const toPreset = SCENE_PRESETS[this.state.currentMode];

    // 使用 easeInOut 缓动
    const eased = this.easeInOutCubic(progress);

    this.state.elements = this.lerpElements(fromPreset.elements, toPreset.elements, eased);
  }

  private lerpElements(from: SceneElements, to: SceneElements, t: number): SceneElements {
    return {
      background: {
        enabled: t < 0.5 ? from.background.enabled : to.background.enabled,
        intensity: this.lerp(from.background.intensity, to.background.intensity, t),
        colorShift: this.lerp(from.background.colorShift, to.background.colorShift, t),
      },
      particles: {
        enabled: t < 0.5 ? from.particles.enabled : to.particles.enabled,
        intensity: this.lerp(from.particles.intensity, to.particles.intensity, t),
        speed: this.lerp(from.particles.speed, to.particles.speed, t),
      },
      expression: {
        intensity: this.lerp(from.expression.intensity, to.expression.intensity, t),
        baseEmotion: t < 0.5 ? from.expression.baseEmotion : to.expression.baseEmotion,
        emotionRange: this.lerp(from.expression.emotionRange, to.expression.emotionRange, t),
      },
      animation: {
        speed: this.lerp(from.animation.speed, to.animation.speed, t),
        breathing: this.lerp(from.animation.breathing, to.animation.breathing, t),
        idleMotion: this.lerp(from.animation.idleMotion, to.animation.idleMotion, t),
      },
      lighting: {
        brightness: this.lerp(from.lighting.brightness, to.lighting.brightness, t),
        contrast: this.lerp(from.lighting.contrast, to.lighting.contrast, t),
        warmth: this.lerp(from.lighting.warmth, to.lighting.warmth, t),
        vignette: this.lerp(from.lighting.vignette, to.lighting.vignette, t),
      },
      audio: t < 0.5 ? { ...from.audio } : { ...to.audio },
    };
  }

  private applyEnvironmentAdjustments(): void {
    const baseElements = { ...SCENE_PRESETS[this.state.currentMode].elements };
    
    // 应用时间调整
    const timeAdj = TIME_ADJUSTMENTS[this.state.timeOfDay];
    this.mergePartialElements(baseElements, timeAdj);

    // 应用天气调整
    const weatherAdj = WEATHER_ADJUSTMENTS[this.state.weather];
    this.mergePartialElements(baseElements, weatherAdj);

    // 应用自定义覆盖
    this.mergePartialElements(baseElements, this.state.customOverrides);

    this.state.elements = baseElements;
  }

  private mergePartialElements(target: SceneElements, partial: Partial<SceneElements>): void {
    if (partial.background) {
      Object.assign(target.background, partial.background);
    }
    if (partial.particles) {
      Object.assign(target.particles, partial.particles);
    }
    if (partial.expression) {
      Object.assign(target.expression, partial.expression);
    }
    if (partial.animation) {
      Object.assign(target.animation, partial.animation);
    }
    if (partial.lighting) {
      Object.assign(target.lighting, partial.lighting);
    }
    if (partial.audio) {
      Object.assign(target.audio, partial.audio);
    }
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private notifyStateChange(): void {
    const stateCopy = { ...this.state };
    this.stateChangeCallbacks.forEach(cb => cb(stateCopy));
  }
}

// ========== 单例和便捷函数 ==========

let sceneDirectorInstance: SceneDirectorSystem | null = null;

export function getSceneDirector(): SceneDirectorSystem {
  if (!sceneDirectorInstance) {
    sceneDirectorInstance = new SceneDirectorSystem();
  }
  return sceneDirectorInstance;
}

export const sceneDirector = getSceneDirector();

// 便捷函数
export function setScene(mode: SceneMode, immediate?: boolean): void {
  sceneDirector.setScene(mode, { immediate });
}

export function analyzeForScene(text: string, emotion?: Expression, atmosphere?: Atmosphere): void {
  sceneDirector.analyzeText(text, emotion, atmosphere);
}

export function getCurrentScene(): SceneMode {
  return sceneDirector.getState().currentMode;
}

export function getSceneElements(): SceneElements {
  return sceneDirector.getCurrentElements();
}
