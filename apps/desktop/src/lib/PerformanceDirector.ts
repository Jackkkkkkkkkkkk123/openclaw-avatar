/**
 * PerformanceDirector - AI 表演编排系统
 * 
 * 功能：
 * - 脚本编排：定义表演序列（表情、动作、语音、场景）
 * - 时间轴控制：精确控制每个动作的时机
 * - 预览和录制：预览表演并录制为视频
 * - 模板系统：保存和加载表演模板
 * 
 * 市场对标：HeyGen Video Agent, Synthesia Templates
 * 
 * @version 1.0.0
 * @author SOTA Round 46
 */

import type { Expression } from './AvatarController';
import type { SceneMode, TimeOfDay, Weather } from './SceneDirectorSystem';

// ============ 类型定义 ============

/** 表演事件类型 */
export type PerformanceEventType = 
  | 'expression'      // 表情变化
  | 'motion'          // 动作播放
  | 'speak'           // 语音播放
  | 'scene'           // 场景切换
  | 'particle'        // 粒子效果
  | 'lighting'        // 光照变化
  | 'camera'          // 摄像机移动
  | 'wait'            // 等待
  | 'parallel'        // 并行执行
  | 'loop'            // 循环
  | 'conditional'     // 条件分支
  | 'trigger'         // 触发外部事件
  | 'custom';         // 自定义事件

/** 表演事件 */
export interface PerformanceEvent {
  id: string;
  type: PerformanceEventType;
  startTime: number;        // 开始时间 (ms)
  duration: number;         // 持续时间 (ms)
  data: PerformanceEventData;
  easing?: EasingType;      // 缓动类型
  layer?: number;           // 图层（用于并行事件）
  enabled?: boolean;        // 是否启用
  label?: string;           // 显示标签
}

/** 事件数据 */
export type PerformanceEventData = 
  | ExpressionEventData
  | MotionEventData
  | SpeakEventData
  | SceneEventData
  | ParticleEventData
  | LightingEventData
  | CameraEventData
  | WaitEventData
  | ParallelEventData
  | LoopEventData
  | ConditionalEventData
  | TriggerEventData
  | CustomEventData;

export interface ExpressionEventData {
  type: 'expression';
  expression: Expression;
  intensity?: number;       // 0-1
  transition?: number;      // 过渡时间 (ms)
}

export interface MotionEventData {
  type: 'motion';
  motionGroup: string;
  motionIndex?: number;
  priority?: number;
  loop?: boolean;
}

export interface SpeakEventData {
  type: 'speak';
  text: string;
  emotion?: Expression;
  voiceId?: string;
  speed?: number;           // 0.5-2.0
  pitch?: number;           // 0.5-2.0
}

export interface SceneEventData {
  type: 'scene';
  mode?: SceneMode;
  timeOfDay?: TimeOfDay;
  weather?: Weather;
  transition?: 'fade' | 'slide' | 'zoom' | 'dissolve';
  transitionDuration?: number;
}

export interface ParticleEventData {
  type: 'particle';
  particleType: string;     // sparkle, heart, confetti, etc.
  intensity?: number;
  burst?: boolean;
  count?: number;
}

export interface LightingEventData {
  type: 'lighting';
  brightness?: number;      // 0-2
  warmth?: number;          // -1 to 1 (cold to warm)
  color?: string;           // hex color
  ambientIntensity?: number;
}

export interface CameraEventData {
  type: 'camera';
  action: 'zoom' | 'pan' | 'shake' | 'reset';
  zoom?: number;            // 0.5-2.0
  panX?: number;            // -1 to 1
  panY?: number;            // -1 to 1
  shakeIntensity?: number;  // 0-1
}

export interface WaitEventData {
  type: 'wait';
  waitType: 'fixed' | 'random' | 'until_speak_end' | 'until_motion_end';
  duration?: number;        // for fixed
  minDuration?: number;     // for random
  maxDuration?: number;     // for random
}

export interface ParallelEventData {
  type: 'parallel';
  events: PerformanceEvent[];
}

export interface LoopEventData {
  type: 'loop';
  events: PerformanceEvent[];
  count: number;            // -1 for infinite
  interval?: number;        // delay between loops (ms)
}

export interface ConditionalEventData {
  type: 'conditional';
  condition: PerformanceCondition;
  trueBranch: PerformanceEvent[];
  falseBranch?: PerformanceEvent[];
}

export interface TriggerEventData {
  type: 'trigger';
  eventName: string;
  payload?: Record<string, unknown>;
}

export interface CustomEventData {
  type: 'custom';
  handler: string;          // handler function name
  args?: unknown[];
}

/** 条件定义 */
export interface PerformanceCondition {
  type: 'expression_is' | 'time_elapsed' | 'random' | 'custom';
  value: unknown;
}

/** 缓动类型 */
export type EasingType = 
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'bounce'
  | 'elastic';

/** 表演脚本 */
export interface PerformanceScript {
  id: string;
  name: string;
  description?: string;
  author?: string;
  version?: string;
  createdAt: number;
  updatedAt: number;
  duration: number;         // 总时长 (ms)
  events: PerformanceEvent[];
  variables?: Record<string, unknown>;
  thumbnail?: string;       // base64 image
  tags?: string[];
  category?: string;
}

/** 表演状态 */
export type PerformanceState = 
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'recording'
  | 'error';

/** 播放选项 */
export interface PlaybackOptions {
  speed?: number;           // 播放速度 (0.25-4.0)
  startTime?: number;       // 起始时间 (ms)
  endTime?: number;         // 结束时间 (ms)
  loop?: boolean;           // 是否循环
  autoRecord?: boolean;     // 自动录制
  previewMode?: boolean;    // 预览模式（不执行语音）
}

/** 播放状态 */
export interface PlaybackState {
  state: PerformanceState;
  currentTime: number;
  duration: number;
  speed: number;
  currentEventIndex: number;
  activeEvents: string[];   // 当前活跃的事件 ID
  progress: number;         // 0-1
  loop: boolean;
  loopCount: number;
}

/** 事件执行器 */
export type EventExecutor = (
  event: PerformanceEvent,
  context: ExecutionContext
) => Promise<void>;

/** 执行上下文 */
export interface ExecutionContext {
  currentTime: number;
  variables: Record<string, unknown>;
  abortSignal: AbortSignal;
  onProgress?: (progress: number) => void;
}

// ============ 预设模板 ============

/** 预设表演模板 */
export const PRESET_SCRIPTS: Record<string, Partial<PerformanceScript>> = {
  greeting: {
    name: '打招呼',
    description: '友好的问候动作',
    category: 'basic',
    tags: ['greeting', 'friendly'],
    duration: 5000,
    events: [
      {
        id: 'greet-1',
        type: 'expression',
        startTime: 0,
        duration: 500,
        data: { type: 'expression', expression: 'happy', intensity: 0.8 }
      },
      {
        id: 'greet-2',
        type: 'motion',
        startTime: 200,
        duration: 2000,
        data: { type: 'motion', motionGroup: 'wave' }
      },
      {
        id: 'greet-3',
        type: 'speak',
        startTime: 500,
        duration: 2000,
        data: { type: 'speak', text: '你好呀！很高兴见到你~', emotion: 'happy' }
      },
      {
        id: 'greet-4',
        type: 'particle',
        startTime: 1000,
        duration: 2000,
        data: { type: 'particle', particleType: 'sparkle', burst: true, count: 20 }
      }
    ]
  },
  
  thinking: {
    name: '思考中',
    description: '表现出思考状态',
    category: 'basic',
    tags: ['thinking', 'waiting'],
    duration: 4000,
    events: [
      {
        id: 'think-1',
        type: 'expression',
        startTime: 0,
        duration: 500,
        data: { type: 'expression', expression: 'thinking', intensity: 0.9 }
      },
      {
        id: 'think-2',
        type: 'motion',
        startTime: 300,
        duration: 3000,
        data: { type: 'motion', motionGroup: 'idle', loop: true }
      },
      {
        id: 'think-3',
        type: 'speak',
        startTime: 500,
        duration: 1500,
        data: { type: 'speak', text: '让我想想...', emotion: 'thinking' }
      }
    ]
  },
  
  excited_announcement: {
    name: '兴奋宣布',
    description: '充满活力的公告',
    category: 'presentation',
    tags: ['excited', 'announcement', 'presentation'],
    duration: 8000,
    events: [
      {
        id: 'announce-1',
        type: 'scene',
        startTime: 0,
        duration: 500,
        data: { type: 'scene', mode: 'celebration', transition: 'zoom', transitionDuration: 500 }
      },
      {
        id: 'announce-2',
        type: 'expression',
        startTime: 500,
        duration: 500,
        data: { type: 'expression', expression: 'excited', intensity: 1.0 }
      },
      {
        id: 'announce-3',
        type: 'speak',
        startTime: 1000,
        duration: 3000,
        data: { type: 'speak', text: '大家好！我有一个超棒的消息要告诉你们！', emotion: 'excited' }
      },
      {
        id: 'announce-4',
        type: 'particle',
        startTime: 1500,
        duration: 4000,
        data: { type: 'particle', particleType: 'confetti', intensity: 1.5, burst: true, count: 50 }
      },
      {
        id: 'announce-5',
        type: 'motion',
        startTime: 2000,
        duration: 2000,
        data: { type: 'motion', motionGroup: 'celebrate' }
      }
    ]
  },
  
  storytelling_intro: {
    name: '故事开场',
    description: '故事讲述的开场白',
    category: 'storytelling',
    tags: ['story', 'intro', 'narrative'],
    duration: 10000,
    events: [
      {
        id: 'story-1',
        type: 'scene',
        startTime: 0,
        duration: 1000,
        data: { type: 'scene', mode: 'storytelling', timeOfDay: 'evening', transition: 'fade' }
      },
      {
        id: 'story-2',
        type: 'lighting',
        startTime: 500,
        duration: 500,
        data: { type: 'lighting', brightness: 0.7, warmth: 0.3 }
      },
      {
        id: 'story-3',
        type: 'expression',
        startTime: 1000,
        duration: 500,
        data: { type: 'expression', expression: 'curious', intensity: 0.7 }
      },
      {
        id: 'story-4',
        type: 'speak',
        startTime: 1500,
        duration: 4000,
        data: { type: 'speak', text: '很久很久以前，在一个遥远的地方...', emotion: 'thinking' }
      },
      {
        id: 'story-5',
        type: 'particle',
        startTime: 3000,
        duration: 5000,
        data: { type: 'particle', particleType: 'star', intensity: 0.5 }
      }
    ]
  },
  
  emotional_comfort: {
    name: '情感安慰',
    description: '温柔的安慰动作',
    category: 'emotional',
    tags: ['comfort', 'emotional', 'support'],
    duration: 8000,
    events: [
      {
        id: 'comfort-1',
        type: 'scene',
        startTime: 0,
        duration: 500,
        data: { type: 'scene', mode: 'emotional_support', transition: 'fade' }
      },
      {
        id: 'comfort-2',
        type: 'expression',
        startTime: 300,
        duration: 500,
        data: { type: 'expression', expression: 'loving', intensity: 0.9 }
      },
      {
        id: 'comfort-3',
        type: 'speak',
        startTime: 800,
        duration: 3000,
        data: { type: 'speak', text: '没关系的，我在这里陪着你~', emotion: 'loving', speed: 0.9 }
      },
      {
        id: 'comfort-4',
        type: 'particle',
        startTime: 1500,
        duration: 4000,
        data: { type: 'particle', particleType: 'heart', intensity: 0.8 }
      },
      {
        id: 'comfort-5',
        type: 'lighting',
        startTime: 0,
        duration: 1000,
        data: { type: 'lighting', brightness: 0.8, warmth: 0.5 }
      }
    ]
  },
  
  surprised_reaction: {
    name: '惊喜反应',
    description: '表现惊喜的反应',
    category: 'reaction',
    tags: ['surprise', 'reaction'],
    duration: 4000,
    events: [
      {
        id: 'surprise-1',
        type: 'expression',
        startTime: 0,
        duration: 200,
        data: { type: 'expression', expression: 'surprised', intensity: 1.0 }
      },
      {
        id: 'surprise-2',
        type: 'camera',
        startTime: 0,
        duration: 300,
        data: { type: 'camera', action: 'shake', shakeIntensity: 0.3 }
      },
      {
        id: 'surprise-3',
        type: 'speak',
        startTime: 300,
        duration: 1500,
        data: { type: 'speak', text: '哇！真的吗？！', emotion: 'surprised' }
      },
      {
        id: 'surprise-4',
        type: 'expression',
        startTime: 2000,
        duration: 500,
        data: { type: 'expression', expression: 'excited', intensity: 0.8 }
      },
      {
        id: 'surprise-5',
        type: 'particle',
        startTime: 500,
        duration: 2000,
        data: { type: 'particle', particleType: 'star', burst: true, count: 30 }
      }
    ]
  },
  
  shy_response: {
    name: '害羞回应',
    description: '害羞的可爱反应',
    category: 'reaction',
    tags: ['shy', 'cute', 'reaction'],
    duration: 5000,
    events: [
      {
        id: 'shy-1',
        type: 'expression',
        startTime: 0,
        duration: 300,
        data: { type: 'expression', expression: 'embarrassed', intensity: 0.8 }
      },
      {
        id: 'shy-2',
        type: 'speak',
        startTime: 500,
        duration: 2000,
        data: { type: 'speak', text: '诶...这样说我会害羞的啦...', emotion: 'embarrassed', speed: 0.95 }
      },
      {
        id: 'shy-3',
        type: 'particle',
        startTime: 1000,
        duration: 2000,
        data: { type: 'particle', particleType: 'heart', intensity: 0.5, count: 5 }
      },
      {
        id: 'shy-4',
        type: 'expression',
        startTime: 3000,
        duration: 500,
        data: { type: 'expression', expression: 'happy', intensity: 0.6 }
      }
    ]
  },
  
  presentation_intro: {
    name: '演示开场',
    description: '正式的演示开场白',
    category: 'presentation',
    tags: ['presentation', 'professional', 'intro'],
    duration: 10000,
    events: [
      {
        id: 'pres-1',
        type: 'scene',
        startTime: 0,
        duration: 500,
        data: { type: 'scene', mode: 'work_meeting', transition: 'fade' }
      },
      {
        id: 'pres-2',
        type: 'expression',
        startTime: 500,
        duration: 500,
        data: { type: 'expression', expression: 'determined', intensity: 0.8 }
      },
      {
        id: 'pres-3',
        type: 'speak',
        startTime: 1000,
        duration: 4000,
        data: { type: 'speak', text: '大家好，感谢各位的参与。今天我想和大家分享一个重要的话题。', emotion: 'neutral' }
      },
      {
        id: 'pres-4',
        type: 'motion',
        startTime: 2000,
        duration: 2000,
        data: { type: 'motion', motionGroup: 'gesture' }
      }
    ]
  }
};

// ============ PerformanceDirector 类 ============

/**
 * PerformanceDirector - 表演编排系统
 */
export class PerformanceDirector {
  private scripts: Map<string, PerformanceScript> = new Map();
  private currentScript: PerformanceScript | null = null;
  private playbackState: PlaybackState = {
    state: 'idle',
    currentTime: 0,
    duration: 0,
    speed: 1,
    currentEventIndex: 0,
    activeEvents: [],
    progress: 0,
    loop: false,
    loopCount: 0
  };
  
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private abortController: AbortController | null = null;
  
  private stateCallbacks: Set<(state: PlaybackState) => void> = new Set();
  private eventCallbacks: Map<string, Set<(data: unknown) => void>> = new Map();
  private executors: Map<PerformanceEventType, EventExecutor> = new Map();
  
  constructor() {
    this.loadPresets();
    this.registerDefaultExecutors();
  }
  
  // ============ 脚本管理 ============
  
  /**
   * 加载预设模板
   */
  private loadPresets(): void {
    Object.entries(PRESET_SCRIPTS).forEach(([key, preset]) => {
      const script: PerformanceScript = {
        id: key,
        name: preset.name || key,
        description: preset.description,
        category: preset.category,
        tags: preset.tags,
        duration: preset.duration || 5000,
        events: preset.events || [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.scripts.set(key, script);
    });
  }
  
  /**
   * 创建新脚本
   */
  createScript(name: string, description?: string): PerformanceScript {
    const id = `script_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const script: PerformanceScript = {
      id,
      name,
      description,
      duration: 0,
      events: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.scripts.set(id, script);
    return script;
  }
  
  /**
   * 获取脚本
   */
  getScript(id: string): PerformanceScript | undefined {
    return this.scripts.get(id);
  }
  
  /**
   * 获取所有脚本
   */
  getAllScripts(): PerformanceScript[] {
    return Array.from(this.scripts.values());
  }
  
  /**
   * 按类别获取脚本
   */
  getScriptsByCategory(category: string): PerformanceScript[] {
    return this.getAllScripts().filter(s => s.category === category);
  }
  
  /**
   * 更新脚本
   */
  updateScript(id: string, updates: Partial<PerformanceScript>): void {
    const script = this.scripts.get(id);
    if (script) {
      Object.assign(script, updates, { updatedAt: Date.now() });
      this.recalculateDuration(script);
    }
  }
  
  /**
   * 删除脚本
   */
  deleteScript(id: string): boolean {
    // 不允许删除预设
    if (PRESET_SCRIPTS[id]) return false;
    return this.scripts.delete(id);
  }
  
  /**
   * 复制脚本
   */
  duplicateScript(id: string, newName?: string): PerformanceScript | undefined {
    const original = this.scripts.get(id);
    if (!original) return undefined;
    
    const newScript = this.createScript(
      newName || `${original.name} (副本)`,
      original.description
    );
    newScript.events = JSON.parse(JSON.stringify(original.events));
    newScript.category = original.category;
    newScript.tags = [...(original.tags || [])];
    newScript.variables = original.variables ? { ...original.variables } : undefined;
    this.recalculateDuration(newScript);
    
    return newScript;
  }
  
  // ============ 事件管理 ============
  
  /**
   * 添加事件到脚本
   */
  addEvent(scriptId: string, event: Omit<PerformanceEvent, 'id'>): PerformanceEvent | undefined {
    const script = this.scripts.get(scriptId);
    if (!script) return undefined;
    
    const newEvent: PerformanceEvent = {
      ...event,
      id: `event_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      enabled: event.enabled ?? true
    };
    
    script.events.push(newEvent);
    this.recalculateDuration(script);
    script.updatedAt = Date.now();
    
    return newEvent;
  }
  
  /**
   * 更新事件
   */
  updateEvent(scriptId: string, eventId: string, updates: Partial<PerformanceEvent>): void {
    const script = this.scripts.get(scriptId);
    if (!script) return;
    
    const event = script.events.find(e => e.id === eventId);
    if (event) {
      Object.assign(event, updates);
      this.recalculateDuration(script);
      script.updatedAt = Date.now();
    }
  }
  
  /**
   * 删除事件
   */
  removeEvent(scriptId: string, eventId: string): boolean {
    const script = this.scripts.get(scriptId);
    if (!script) return false;
    
    const index = script.events.findIndex(e => e.id === eventId);
    if (index !== -1) {
      script.events.splice(index, 1);
      this.recalculateDuration(script);
      script.updatedAt = Date.now();
      return true;
    }
    return false;
  }
  
  /**
   * 重新排序事件
   */
  reorderEvents(scriptId: string, fromIndex: number, toIndex: number): void {
    const script = this.scripts.get(scriptId);
    if (!script) return;
    
    const [event] = script.events.splice(fromIndex, 1);
    script.events.splice(toIndex, 0, event);
    script.updatedAt = Date.now();
  }
  
  /**
   * 重新计算脚本时长
   */
  private recalculateDuration(script: PerformanceScript): void {
    let maxEnd = 0;
    for (const event of script.events) {
      if (event.enabled !== false) {
        const end = event.startTime + event.duration;
        if (end > maxEnd) maxEnd = end;
      }
    }
    script.duration = maxEnd;
  }
  
  // ============ 播放控制 ============
  
  /**
   * 加载脚本到播放器
   */
  load(scriptId: string): boolean {
    const script = this.scripts.get(scriptId);
    if (!script) return false;
    
    this.stop();
    this.currentScript = script;
    this.playbackState = {
      state: 'idle',
      currentTime: 0,
      duration: script.duration,
      speed: 1,
      currentEventIndex: 0,
      activeEvents: [],
      progress: 0,
      loop: false,
      loopCount: 0
    };
    this.notifyStateChange();
    return true;
  }
  
  /**
   * 播放
   */
  async play(options?: PlaybackOptions): Promise<void> {
    if (!this.currentScript) return;
    
    if (this.playbackState.state === 'paused') {
      // 从暂停恢复
      this.playbackState.state = 'playing';
      this.notifyStateChange();
      this.startPlaybackLoop();
      return;
    }
    
    // 应用选项
    if (options?.speed) {
      this.playbackState.speed = Math.max(0.25, Math.min(4, options.speed));
    }
    if (options?.startTime !== undefined) {
      this.playbackState.currentTime = options.startTime;
    }
    if (options?.loop !== undefined) {
      this.playbackState.loop = options.loop;
    }
    
    // 设置 abort controller
    this.abortController = new AbortController();
    
    // 开始播放
    this.playbackState.state = 'playing';
    this.notifyStateChange();
    this.startPlaybackLoop();
  }
  
  /**
   * 暂停
   */
  pause(): void {
    if (this.playbackState.state !== 'playing') return;
    
    this.playbackState.state = 'paused';
    this.stopPlaybackLoop();
    this.notifyStateChange();
  }
  
  /**
   * 停止
   */
  stop(): void {
    this.stopPlaybackLoop();
    this.abortController?.abort();
    this.abortController = null;
    
    this.playbackState = {
      ...this.playbackState,
      state: 'stopped',
      currentTime: 0,
      currentEventIndex: 0,
      activeEvents: [],
      progress: 0,
      loopCount: 0
    };
    this.notifyStateChange();
  }
  
  /**
   * 跳转到指定时间
   */
  seek(time: number): void {
    if (!this.currentScript) return;
    
    this.playbackState.currentTime = Math.max(0, Math.min(time, this.currentScript.duration));
    this.playbackState.progress = this.playbackState.currentTime / this.currentScript.duration;
    
    // 重置事件索引
    this.playbackState.currentEventIndex = 0;
    this.playbackState.activeEvents = [];
    
    this.notifyStateChange();
  }
  
  /**
   * 设置播放速度
   */
  setSpeed(speed: number): void {
    this.playbackState.speed = Math.max(0.25, Math.min(4, speed));
    this.notifyStateChange();
  }
  
  /**
   * 获取播放状态
   */
  getState(): PlaybackState {
    return { ...this.playbackState };
  }
  
  /**
   * 获取当前脚本
   */
  getCurrentScript(): PerformanceScript | null {
    return this.currentScript;
  }
  
  // ============ 播放循环 ============
  
  private startPlaybackLoop(): void {
    this.lastFrameTime = performance.now();
    this.tick();
  }
  
  private stopPlaybackLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  private tick = (): void => {
    if (this.playbackState.state !== 'playing') return;
    
    const now = performance.now();
    const deltaTime = (now - this.lastFrameTime) * this.playbackState.speed;
    this.lastFrameTime = now;
    
    // 更新当前时间
    this.playbackState.currentTime += deltaTime;
    
    // 检查结束
    if (this.currentScript && this.playbackState.currentTime >= this.currentScript.duration) {
      if (this.playbackState.loop) {
        // 循环播放
        this.playbackState.currentTime = 0;
        this.playbackState.loopCount++;
        this.playbackState.currentEventIndex = 0;
        this.playbackState.activeEvents = [];
      } else {
        // 播放结束
        this.playbackState.currentTime = this.currentScript.duration;
        this.playbackState.state = 'stopped';
        this.notifyStateChange();
        return;
      }
    }
    
    // 更新进度
    if (this.currentScript) {
      this.playbackState.progress = this.playbackState.currentTime / this.currentScript.duration;
    }
    
    // 执行事件
    this.processEvents();
    
    // 通知状态变化
    this.notifyStateChange();
    
    // 继续循环
    this.animationFrameId = requestAnimationFrame(this.tick);
  };
  
  private async processEvents(): Promise<void> {
    if (!this.currentScript) return;
    
    const currentTime = this.playbackState.currentTime;
    
    for (const event of this.currentScript.events) {
      if (event.enabled === false) continue;
      
      const eventStart = event.startTime;
      const eventEnd = event.startTime + event.duration;
      
      // 检查事件是否应该开始
      if (currentTime >= eventStart && !this.playbackState.activeEvents.includes(event.id)) {
        this.playbackState.activeEvents.push(event.id);
        this.executeEvent(event);
      }
      
      // 检查事件是否应该结束
      if (currentTime >= eventEnd && this.playbackState.activeEvents.includes(event.id)) {
        const index = this.playbackState.activeEvents.indexOf(event.id);
        if (index !== -1) {
          this.playbackState.activeEvents.splice(index, 1);
        }
      }
    }
  }
  
  private async executeEvent(event: PerformanceEvent): Promise<void> {
    const executor = this.executors.get(event.type);
    if (!executor) {
      console.warn(`No executor for event type: ${event.type}`);
      return;
    }
    
    try {
      const context: ExecutionContext = {
        currentTime: this.playbackState.currentTime,
        variables: this.currentScript?.variables || {},
        abortSignal: this.abortController?.signal || new AbortController().signal
      };
      
      await executor(event, context);
      
      // 触发事件回调
      this.emitEvent(event.type, event);
      
    } catch (error) {
      console.error(`Error executing event ${event.id}:`, error);
    }
  }
  
  // ============ 事件执行器 ============
  
  private registerDefaultExecutors(): void {
    // 表情
    this.executors.set('expression', async (event) => {
      const data = event.data as ExpressionEventData;
      this.emitEvent('execute:expression', {
        expression: data.expression,
        intensity: data.intensity,
        transition: data.transition
      });
    });
    
    // 动作
    this.executors.set('motion', async (event) => {
      const data = event.data as MotionEventData;
      this.emitEvent('execute:motion', {
        motionGroup: data.motionGroup,
        motionIndex: data.motionIndex,
        priority: data.priority,
        loop: data.loop
      });
    });
    
    // 语音
    this.executors.set('speak', async (event) => {
      const data = event.data as SpeakEventData;
      this.emitEvent('execute:speak', {
        text: data.text,
        emotion: data.emotion,
        voiceId: data.voiceId,
        speed: data.speed,
        pitch: data.pitch
      });
    });
    
    // 场景
    this.executors.set('scene', async (event) => {
      const data = event.data as SceneEventData;
      this.emitEvent('execute:scene', {
        mode: data.mode,
        timeOfDay: data.timeOfDay,
        weather: data.weather,
        transition: data.transition,
        transitionDuration: data.transitionDuration
      });
    });
    
    // 粒子
    this.executors.set('particle', async (event) => {
      const data = event.data as ParticleEventData;
      this.emitEvent('execute:particle', {
        particleType: data.particleType,
        intensity: data.intensity,
        burst: data.burst,
        count: data.count
      });
    });
    
    // 光照
    this.executors.set('lighting', async (event) => {
      const data = event.data as LightingEventData;
      this.emitEvent('execute:lighting', {
        brightness: data.brightness,
        warmth: data.warmth,
        color: data.color,
        ambientIntensity: data.ambientIntensity
      });
    });
    
    // 摄像机
    this.executors.set('camera', async (event) => {
      const data = event.data as CameraEventData;
      this.emitEvent('execute:camera', data);
    });
    
    // 等待
    this.executors.set('wait', async (event) => {
      const data = event.data as WaitEventData;
      if (data.waitType === 'fixed' && data.duration) {
        await new Promise(resolve => setTimeout(resolve, data.duration));
      }
    });
    
    // 触发器
    this.executors.set('trigger', async (event) => {
      const data = event.data as TriggerEventData;
      this.emitEvent('execute:trigger', {
        eventName: data.eventName,
        payload: data.payload
      });
    });
  }
  
  /**
   * 注册自定义执行器
   */
  registerExecutor(type: PerformanceEventType, executor: EventExecutor): void {
    this.executors.set(type, executor);
  }
  
  // ============ 状态订阅 ============
  
  /**
   * 订阅状态变化
   */
  onStateChange(callback: (state: PlaybackState) => void): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }
  
  private notifyStateChange(): void {
    const state = this.getState();
    this.stateCallbacks.forEach(cb => cb(state));
  }
  
  /**
   * 订阅事件
   */
  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, new Set());
    }
    this.eventCallbacks.get(event)!.add(callback);
    return () => this.eventCallbacks.get(event)?.delete(callback);
  }
  
  private emitEvent(event: string, data: unknown): void {
    this.eventCallbacks.get(event)?.forEach(cb => cb(data));
  }
  
  // ============ 导入导出 ============
  
  /**
   * 导出脚本为 JSON
   */
  exportScript(id: string): string | undefined {
    const script = this.scripts.get(id);
    if (!script) return undefined;
    return JSON.stringify(script, null, 2);
  }
  
  /**
   * 导入脚本
   */
  importScript(json: string): PerformanceScript | undefined {
    try {
      const script = JSON.parse(json) as PerformanceScript;
      
      // 生成新 ID 避免冲突
      script.id = `imported_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      script.createdAt = Date.now();
      script.updatedAt = Date.now();
      
      // 重新生成事件 ID
      script.events = script.events.map(event => ({
        ...event,
        id: `event_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      }));
      
      this.scripts.set(script.id, script);
      return script;
    } catch (error) {
      console.error('Failed to import script:', error);
      return undefined;
    }
  }
  
  /**
   * 保存到 localStorage
   */
  saveToStorage(): void {
    const userScripts = this.getAllScripts().filter(s => !PRESET_SCRIPTS[s.id]);
    localStorage.setItem('avatar_performance_scripts', JSON.stringify(userScripts));
  }
  
  /**
   * 从 localStorage 加载
   */
  loadFromStorage(): void {
    try {
      const saved = localStorage.getItem('avatar_performance_scripts');
      if (saved) {
        const scripts = JSON.parse(saved) as PerformanceScript[];
        scripts.forEach(script => this.scripts.set(script.id, script));
      }
    } catch (error) {
      console.error('Failed to load scripts from storage:', error);
    }
  }
  
  // ============ 清理 ============
  
  /**
   * 销毁
   */
  destroy(): void {
    this.stop();
    this.stateCallbacks.clear();
    this.eventCallbacks.clear();
    this.scripts.clear();
    this.currentScript = null;
  }
}

// ============ 单例 ============

let performanceDirectorInstance: PerformanceDirector | null = null;

export function getPerformanceDirector(): PerformanceDirector {
  if (!performanceDirectorInstance) {
    performanceDirectorInstance = new PerformanceDirector();
    performanceDirectorInstance.loadFromStorage();
  }
  return performanceDirectorInstance;
}

export const performanceDirector = {
  get instance() { return getPerformanceDirector(); }
};
