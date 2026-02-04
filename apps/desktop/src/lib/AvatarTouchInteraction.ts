/**
 * AvatarTouchInteraction - Avatar 触摸互动系统
 * 
 * 功能：
 * - 多部位触摸检测 (head, face, body, hands)
 * - 丰富的互动反应 (表情、动作、声音、粒子)
 * - 连击检测 (单击、双击、长按)
 * - 触摸强度检测 (轻触、按压)
 * - 互动记忆 (学习用户偏好)
 * - 情感连接系统 (亲密度)
 * 
 * @author OpenClaw Avatar SOTA Optimizer
 * @version 1.0.0
 */

// ============== Types ==============

/** 触摸区域 */
export type TouchArea = 
  | 'head'      // 头部 - 摸头杀
  | 'face'      // 脸部 - 捏脸
  | 'cheek'     // 脸颊 - 戳脸
  | 'hair'      // 头发 - 撩头发
  | 'shoulder'  // 肩膀 - 拍肩
  | 'hand'      // 手 - 牵手
  | 'body'      // 身体
  | 'unknown';

/** 触摸类型 */
export type TouchType = 
  | 'tap'       // 点击
  | 'double_tap'// 双击
  | 'long_press'// 长按
  | 'drag'      // 拖动
  | 'poke'      // 戳
  | 'pat'       // 拍
  | 'rub';      // 揉

/** 反应类型 */
export type ReactionType = 
  | 'expression'  // 表情变化
  | 'motion'      // 动作播放
  | 'sound'       // 音效/语音
  | 'particle'    // 粒子效果
  | 'dialogue';   // 对话

/** 情感状态 */
export type EmotionalState = 
  | 'neutral'
  | 'happy'
  | 'shy'
  | 'annoyed'
  | 'loving'
  | 'playful'
  | 'embarrassed';

/** 触摸事件 */
export interface TouchEvent {
  area: TouchArea;
  type: TouchType;
  position: { x: number; y: number };
  pressure: number;        // 0-1 压力
  duration: number;        // 持续时间 ms
  timestamp: number;
}

/** 互动反应配置 */
export interface InteractionReaction {
  expression?: string;     // 表情名称
  motion?: string;         // 动作名称
  sound?: string;          // 音效文件
  dialogue?: string;       // 对话文本
  particle?: string;       // 粒子效果
  emotionalChange?: number;// 情感值变化 (-10 到 +10)
  cooldown?: number;       // 冷却时间 ms
}

/** 互动规则 */
export interface InteractionRule {
  area: TouchArea;
  type: TouchType;
  reactions: InteractionReaction[];  // 可能的反应列表
  weight?: number;         // 权重
  minAffection?: number;   // 最低亲密度要求
  maxAffection?: number;   // 最高亲密度限制
}

/** 互动统计 */
export interface InteractionStats {
  totalTouches: number;
  touchesByArea: Record<TouchArea, number>;
  touchesByType: Record<TouchType, number>;
  favoriteArea: TouchArea | null;
  averageDuration: number;
  lastTouch: number;
}

/** 配置 */
export interface AvatarTouchConfig {
  enabled: boolean;
  hapticFeedback: boolean;  // 触觉反馈
  soundEnabled: boolean;    // 声音反馈
  particleEnabled: boolean; // 粒子效果
  affectionDecay: number;   // 亲密度衰减率 (每小时)
  doubleTapThreshold: number; // 双击判定时间 ms
  longPressThreshold: number; // 长按判定时间 ms
  cooldownMultiplier: number; // 冷却时间倍率
}

// ============== Constants ==============

/** 默认配置 */
const DEFAULT_CONFIG: AvatarTouchConfig = {
  enabled: true,
  hapticFeedback: true,
  soundEnabled: true,
  particleEnabled: true,
  affectionDecay: 1,
  doubleTapThreshold: 300,
  longPressThreshold: 500,
  cooldownMultiplier: 1,
};

/** 默认互动规则 */
const DEFAULT_INTERACTION_RULES: InteractionRule[] = [
  // 摸头
  {
    area: 'head',
    type: 'pat',
    reactions: [
      { expression: 'happy', motion: 'nod', dialogue: '嘿嘿~ 摸头杀~', emotionalChange: 2, particle: 'sparkle' },
      { expression: 'shy', motion: 'embarrassed', dialogue: '呜...不要摸啦...', emotionalChange: 1 },
      { expression: 'loving', dialogue: '好舒服...再摸摸~', emotionalChange: 3, particle: 'heart' },
    ],
    weight: 1.0,
  },
  {
    area: 'head',
    type: 'tap',
    reactions: [
      { expression: 'surprised', motion: 'blink', dialogue: '诶?', emotionalChange: 0 },
      { expression: 'curious', dialogue: '怎么啦?', emotionalChange: 0 },
    ],
  },
  {
    area: 'head',
    type: 'long_press',
    reactions: [
      { expression: 'loving', motion: 'relax', dialogue: '好温暖...', emotionalChange: 5, particle: 'heart' },
      { expression: 'happy', dialogue: '一直摸也没关系哦~', emotionalChange: 3 },
    ],
    minAffection: 30,
  },
  
  // 脸颊
  {
    area: 'cheek',
    type: 'poke',
    reactions: [
      { expression: 'annoyed', motion: 'pout', dialogue: '戳什么戳!', emotionalChange: -1 },
      { expression: 'playful', dialogue: '痒痒~', emotionalChange: 1 },
      { expression: 'embarrassed', dialogue: '脸会变形的啦...', emotionalChange: 0 },
    ],
  },
  {
    area: 'cheek',
    type: 'rub',
    reactions: [
      { expression: 'embarrassed', dialogue: '不、不要这样...', emotionalChange: 2 },
      { expression: 'loving', particle: 'heart', dialogue: '好喜欢...', emotionalChange: 4 },
    ],
    minAffection: 50,
  },
  
  // 头发
  {
    area: 'hair',
    type: 'drag',
    reactions: [
      { expression: 'happy', motion: 'hair_flip', dialogue: '在整理头发吗?', emotionalChange: 1 },
      { expression: 'shy', dialogue: '轻、轻点...', emotionalChange: 0 },
    ],
  },
  
  // 肩膀
  {
    area: 'shoulder',
    type: 'tap',
    reactions: [
      { expression: 'curious', motion: 'turn', dialogue: '嗯?', emotionalChange: 0 },
      { expression: 'happy', dialogue: '有什么事吗?', emotionalChange: 1 },
    ],
  },
  {
    area: 'shoulder',
    type: 'pat',
    reactions: [
      { expression: 'grateful', dialogue: '谢谢鼓励!', emotionalChange: 2, particle: 'sparkle' },
      { expression: 'determined', dialogue: '我会加油的!', emotionalChange: 2 },
    ],
  },
  
  // 手
  {
    area: 'hand',
    type: 'tap',
    reactions: [
      { expression: 'curious', dialogue: '想牵手吗?', emotionalChange: 1 },
      { expression: 'shy', dialogue: '...', emotionalChange: 0 },
    ],
  },
  {
    area: 'hand',
    type: 'long_press',
    reactions: [
      { expression: 'loving', motion: 'hold_hand', dialogue: '...手好温暖', emotionalChange: 5, particle: 'heart' },
      { expression: 'embarrassed', dialogue: '这样有点害羞...', emotionalChange: 3 },
    ],
    minAffection: 40,
  },
  
  // 身体 (其他区域)
  {
    area: 'body',
    type: 'tap',
    reactions: [
      { expression: 'surprised', dialogue: '!?', emotionalChange: -1 },
      { expression: 'annoyed', dialogue: '不要乱碰!', emotionalChange: -2 },
    ],
    maxAffection: 50,
  },
  {
    area: 'body',
    type: 'tap',
    reactions: [
      { expression: 'playful', dialogue: '怎么~ 想抱抱吗?', emotionalChange: 2 },
    ],
    minAffection: 70,
  },
];

/** 触摸区域对话 - 过度触摸时的反应 */
const EXCESSIVE_TOUCH_DIALOGUES: Record<TouchArea, string[]> = {
  head: ['摸太多啦!', '头发都乱了...', '适可而止哦~'],
  face: ['脸都红了...', '不要再捏了!', '会留下印子的!'],
  cheek: ['脸颊要肿了!', '好痛...', '你是不是故意的!'],
  hair: ['头发会打结的!', '别扯!', '要秃了...'],
  shoulder: ['肩膀好酸...', '够了够了', '不用一直拍啦'],
  hand: ['手都麻了...', '松开一下...', '握太紧了'],
  body: ['...', '冷静一下!', '保持距离!'],
  unknown: ['?', '...', '嗯?'],
};

// ============== Main Class ==============

export class AvatarTouchInteraction {
  private config: AvatarTouchConfig;
  private rules: InteractionRule[];
  private affection: number = 0;  // 亲密度 0-100
  private emotionalState: EmotionalState = 'neutral';
  private stats: InteractionStats;
  private touchHistory: TouchEvent[] = [];
  private cooldowns: Map<string, number> = new Map();
  private lastTapTime: number = 0;
  private lastTapArea: TouchArea | null = null;
  private pressStartTime: number = 0;
  private pressArea: TouchArea | null = null;
  private isPressed: boolean = false;
  private callbacks: {
    onReaction: ((reaction: InteractionReaction, event: TouchEvent) => void)[];
    onAffectionChange: ((affection: number, delta: number) => void)[];
    onEmotionalStateChange: ((state: EmotionalState) => void)[];
    onExcessiveTouch: ((area: TouchArea, message: string) => void)[];
  } = {
    onReaction: [],
    onAffectionChange: [],
    onEmotionalStateChange: [],
    onExcessiveTouch: [],
  };
  private running: boolean = false;
  private frameId: number | null = null;
  private lastDecayTime: number = Date.now();

  constructor(config: Partial<AvatarTouchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rules = [...DEFAULT_INTERACTION_RULES];
    this.stats = this.initStats();
  }

  // ============== Lifecycle ==============

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastDecayTime = Date.now();
    this.update();
  }

  stop(): void {
    this.running = false;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  destroy(): void {
    this.stop();
    this.callbacks = {
      onReaction: [],
      onAffectionChange: [],
      onEmotionalStateChange: [],
      onExcessiveTouch: [],
    };
    this.touchHistory = [];
    this.cooldowns.clear();
  }

  private update = (): void => {
    if (!this.running) return;

    // 亲密度衰减
    const now = Date.now();
    const hoursPassed = (now - this.lastDecayTime) / (1000 * 60 * 60);
    if (hoursPassed > 0.1) {  // 每6分钟检查一次
      const decay = hoursPassed * this.config.affectionDecay;
      this.changeAffection(-decay);
      this.lastDecayTime = now;
    }

    // 清理过期的触摸历史 (保留最近5分钟)
    const cutoff = now - 5 * 60 * 1000;
    this.touchHistory = this.touchHistory.filter(t => t.timestamp > cutoff);

    this.frameId = requestAnimationFrame(this.update);
  };

  // ============== Touch Handling ==============

  /**
   * 处理触摸开始
   */
  handleTouchStart(area: TouchArea, position: { x: number; y: number }, pressure: number = 0.5): void {
    if (!this.config.enabled) return;

    this.pressStartTime = Date.now();
    this.pressArea = area;
    this.isPressed = true;
  }

  /**
   * 处理触摸结束
   */
  handleTouchEnd(area: TouchArea, position: { x: number; y: number }, pressure: number = 0.5): void {
    if (!this.config.enabled) return;

    const now = Date.now();
    const duration = now - this.pressStartTime;
    this.isPressed = false;

    // 确定触摸类型
    let touchType: TouchType;
    
    if (duration >= this.config.longPressThreshold) {
      touchType = 'long_press';
    } else if (
      this.lastTapArea === area && 
      now - this.lastTapTime < this.config.doubleTapThreshold
    ) {
      touchType = 'double_tap';
      this.lastTapTime = 0;  // 重置，避免三连击
      this.lastTapArea = null;
    } else {
      touchType = 'tap';
      this.lastTapTime = now;
      this.lastTapArea = area;
    }

    // 创建触摸事件
    const event: TouchEvent = {
      area,
      type: touchType,
      position,
      pressure,
      duration,
      timestamp: now,
    };

    this.processTouchEvent(event);
  }

  /**
   * 处理触摸移动 (用于 drag 和 rub)
   */
  handleTouchMove(area: TouchArea, position: { x: number; y: number }, delta: { x: number; y: number }): void {
    if (!this.config.enabled || !this.isPressed) return;

    const now = Date.now();
    const distance = Math.sqrt(delta.x * delta.x + delta.y * delta.y);

    // 根据移动速度和距离判断类型
    let touchType: TouchType;
    if (distance > 10) {
      touchType = 'drag';
    } else if (distance > 3) {
      touchType = 'rub';
    } else {
      return;  // 移动太小，忽略
    }

    const event: TouchEvent = {
      area,
      type: touchType,
      position,
      pressure: 0.5,
      duration: now - this.pressStartTime,
      timestamp: now,
    };

    this.processTouchEvent(event);
  }

  /**
   * 模拟戳一下
   */
  poke(area: TouchArea): void {
    if (!this.config.enabled) return;

    const event: TouchEvent = {
      area,
      type: 'poke',
      position: { x: 0, y: 0 },
      pressure: 0.7,
      duration: 100,
      timestamp: Date.now(),
    };

    this.processTouchEvent(event);
  }

  /**
   * 模拟拍一下
   */
  pat(area: TouchArea): void {
    if (!this.config.enabled) return;

    const event: TouchEvent = {
      area,
      type: 'pat',
      position: { x: 0, y: 0 },
      pressure: 0.5,
      duration: 200,
      timestamp: Date.now(),
    };

    this.processTouchEvent(event);
  }

  // ============== Event Processing ==============

  private processTouchEvent(event: TouchEvent): void {
    // 记录历史
    this.touchHistory.push(event);
    this.updateStats(event);

    // 检查是否过度触摸
    if (this.checkExcessiveTouch(event.area)) {
      this.handleExcessiveTouch(event.area);
      return;
    }

    // 查找匹配的规则
    const rule = this.findMatchingRule(event);
    if (!rule) {
      console.log('[AvatarTouch] 无匹配规则:', event.area, event.type);
      return;
    }

    // 检查冷却
    const cooldownKey = `${event.area}-${event.type}`;
    const lastReaction = this.cooldowns.get(cooldownKey) || 0;
    const reaction = this.selectReaction(rule);
    const cooldown = (reaction.cooldown || 1000) * this.config.cooldownMultiplier;
    
    if (Date.now() - lastReaction < cooldown) {
      console.log('[AvatarTouch] 冷却中:', cooldownKey);
      return;
    }

    // 执行反应
    this.executeReaction(reaction, event);
    this.cooldowns.set(cooldownKey, Date.now());
  }

  private findMatchingRule(event: TouchEvent): InteractionRule | null {
    const candidates = this.rules.filter(rule => {
      // 区域匹配
      if (rule.area !== event.area) return false;
      
      // 类型匹配
      if (rule.type !== event.type) return false;
      
      // 亲密度检查
      if (rule.minAffection !== undefined && this.affection < rule.minAffection) return false;
      if (rule.maxAffection !== undefined && this.affection > rule.maxAffection) return false;
      
      return true;
    });

    if (candidates.length === 0) return null;
    
    // 按权重随机选择
    const totalWeight = candidates.reduce((sum, r) => sum + (r.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (const rule of candidates) {
      random -= rule.weight || 1;
      if (random <= 0) return rule;
    }
    
    return candidates[0];
  }

  private selectReaction(rule: InteractionRule): InteractionReaction {
    if (rule.reactions.length === 1) return rule.reactions[0];
    
    // 根据情感状态和亲密度选择反应
    const weights = rule.reactions.map((r, i) => {
      let weight = 1;
      
      // 亲密度高时更倾向于正面反应
      if (r.emotionalChange && r.emotionalChange > 0 && this.affection > 50) {
        weight += 0.5;
      }
      
      // 根据当前情感状态调整
      if (this.emotionalState === 'happy' && r.expression === 'loving') {
        weight += 0.3;
      }
      
      return weight;
    });
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < rule.reactions.length; i++) {
      random -= weights[i];
      if (random <= 0) return rule.reactions[i];
    }
    
    return rule.reactions[0];
  }

  private executeReaction(reaction: InteractionReaction, event: TouchEvent): void {
    console.log('[AvatarTouch] 执行反应:', reaction, '事件:', event);

    // 更新亲密度
    if (reaction.emotionalChange) {
      this.changeAffection(reaction.emotionalChange);
    }

    // 更新情感状态
    this.updateEmotionalState(reaction);

    // 触发回调
    for (const callback of this.callbacks.onReaction) {
      try {
        callback(reaction, event);
      } catch (e) {
        console.error('[AvatarTouch] 回调错误:', e);
      }
    }

    // 触觉反馈
    if (this.config.hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }

  // ============== Affection System ==============

  private changeAffection(delta: number): void {
    const oldAffection = this.affection;
    this.affection = Math.max(0, Math.min(100, this.affection + delta));
    
    if (Math.abs(this.affection - oldAffection) > 0.01) {
      for (const callback of this.callbacks.onAffectionChange) {
        try {
          callback(this.affection, delta);
        } catch (e) {
          console.error('[AvatarTouch] 亲密度回调错误:', e);
        }
      }
    }
  }

  getAffection(): number {
    return this.affection;
  }

  setAffection(value: number): void {
    const delta = value - this.affection;
    this.affection = Math.max(0, Math.min(100, value));
    
    for (const callback of this.callbacks.onAffectionChange) {
      try {
        callback(this.affection, delta);
      } catch (e) {
        console.error('[AvatarTouch] 亲密度回调错误:', e);
      }
    }
  }

  // ============== Emotional State ==============

  private updateEmotionalState(reaction: InteractionReaction): void {
    let newState: EmotionalState = this.emotionalState;

    if (reaction.expression) {
      switch (reaction.expression) {
        case 'happy':
        case 'delighted':
          newState = 'happy';
          break;
        case 'shy':
        case 'embarrassed':
          newState = 'embarrassed';
          break;
        case 'annoyed':
        case 'angry':
          newState = 'annoyed';
          break;
        case 'loving':
        case 'affectionate':
          newState = 'loving';
          break;
        case 'playful':
          newState = 'playful';
          break;
      }
    }

    if (newState !== this.emotionalState) {
      this.emotionalState = newState;
      for (const callback of this.callbacks.onEmotionalStateChange) {
        try {
          callback(newState);
        } catch (e) {
          console.error('[AvatarTouch] 情感状态回调错误:', e);
        }
      }
    }
  }

  getEmotionalState(): EmotionalState {
    return this.emotionalState;
  }

  // ============== Excessive Touch ==============

  private checkExcessiveTouch(area: TouchArea): boolean {
    const recentTouches = this.touchHistory.filter(
      t => t.area === area && Date.now() - t.timestamp < 10000  // 10秒内
    );
    return recentTouches.length > 8;  // 10秒内超过8次
  }

  private handleExcessiveTouch(area: TouchArea): void {
    const dialogues = EXCESSIVE_TOUCH_DIALOGUES[area];
    const message = dialogues[Math.floor(Math.random() * dialogues.length)];
    
    // 降低亲密度
    this.changeAffection(-3);
    
    // 变得烦躁
    this.emotionalState = 'annoyed';
    for (const callback of this.callbacks.onEmotionalStateChange) {
      try {
        callback('annoyed');
      } catch (e) {
        console.error('[AvatarTouch] 回调错误:', e);
      }
    }

    // 触发过度触摸回调
    for (const callback of this.callbacks.onExcessiveTouch) {
      try {
        callback(area, message);
      } catch (e) {
        console.error('[AvatarTouch] 回调错误:', e);
      }
    }
  }

  // ============== Statistics ==============

  private initStats(): InteractionStats {
    return {
      totalTouches: 0,
      touchesByArea: {
        head: 0, face: 0, cheek: 0, hair: 0,
        shoulder: 0, hand: 0, body: 0, unknown: 0,
      },
      touchesByType: {
        tap: 0, double_tap: 0, long_press: 0,
        drag: 0, poke: 0, pat: 0, rub: 0,
      },
      favoriteArea: null,
      averageDuration: 0,
      lastTouch: 0,
    };
  }

  private updateStats(event: TouchEvent): void {
    this.stats.totalTouches++;
    this.stats.touchesByArea[event.area]++;
    this.stats.touchesByType[event.type]++;
    this.stats.lastTouch = event.timestamp;

    // 更新平均时长
    const n = this.stats.totalTouches;
    this.stats.averageDuration = 
      (this.stats.averageDuration * (n - 1) + event.duration) / n;

    // 更新最喜欢的区域
    let maxCount = 0;
    let favoriteArea: TouchArea | null = null;
    for (const [area, count] of Object.entries(this.stats.touchesByArea)) {
      if (count > maxCount) {
        maxCount = count;
        favoriteArea = area as TouchArea;
      }
    }
    this.stats.favoriteArea = favoriteArea;
  }

  getStats(): InteractionStats {
    return { ...this.stats };
  }

  // ============== Callbacks ==============

  onReaction(callback: (reaction: InteractionReaction, event: TouchEvent) => void): () => void {
    this.callbacks.onReaction.push(callback);
    return () => {
      const idx = this.callbacks.onReaction.indexOf(callback);
      if (idx >= 0) this.callbacks.onReaction.splice(idx, 1);
    };
  }

  onAffectionChange(callback: (affection: number, delta: number) => void): () => void {
    this.callbacks.onAffectionChange.push(callback);
    return () => {
      const idx = this.callbacks.onAffectionChange.indexOf(callback);
      if (idx >= 0) this.callbacks.onAffectionChange.splice(idx, 1);
    };
  }

  onEmotionalStateChange(callback: (state: EmotionalState) => void): () => void {
    this.callbacks.onEmotionalStateChange.push(callback);
    return () => {
      const idx = this.callbacks.onEmotionalStateChange.indexOf(callback);
      if (idx >= 0) this.callbacks.onEmotionalStateChange.splice(idx, 1);
    };
  }

  onExcessiveTouch(callback: (area: TouchArea, message: string) => void): () => void {
    this.callbacks.onExcessiveTouch.push(callback);
    return () => {
      const idx = this.callbacks.onExcessiveTouch.indexOf(callback);
      if (idx >= 0) this.callbacks.onExcessiveTouch.splice(idx, 1);
    };
  }

  // ============== Configuration ==============

  updateConfig(config: Partial<AvatarTouchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): AvatarTouchConfig {
    return { ...this.config };
  }

  addRule(rule: InteractionRule): void {
    this.rules.push(rule);
  }

  removeRule(area: TouchArea, type: TouchType): void {
    this.rules = this.rules.filter(r => !(r.area === area && r.type === type));
  }

  // ============== Serialization ==============

  exportData(): { affection: number; stats: InteractionStats } {
    return {
      affection: this.affection,
      stats: this.getStats(),
    };
  }

  importData(data: { affection?: number; stats?: Partial<InteractionStats> }): void {
    if (data.affection !== undefined) {
      this.affection = data.affection;
    }
    if (data.stats) {
      this.stats = { ...this.stats, ...data.stats };
    }
  }
}

// ============== Singleton & Helpers ==============

let instance: AvatarTouchInteraction | null = null;

export function getAvatarTouchInteraction(): AvatarTouchInteraction {
  if (!instance) {
    instance = new AvatarTouchInteraction();
  }
  return instance;
}

export function createAvatarTouchInteraction(config?: Partial<AvatarTouchConfig>): AvatarTouchInteraction {
  return new AvatarTouchInteraction(config);
}

/**
 * 从 Live2D hit area 名称映射到 TouchArea
 */
export function mapHitAreaToTouchArea(hitArea: string): TouchArea {
  const lowerArea = hitArea.toLowerCase();
  
  if (lowerArea.includes('head') || lowerArea.includes('hair')) {
    if (lowerArea.includes('hair')) return 'hair';
    return 'head';
  }
  if (lowerArea.includes('face') || lowerArea.includes('cheek')) {
    if (lowerArea.includes('cheek')) return 'cheek';
    return 'face';
  }
  if (lowerArea.includes('shoulder')) return 'shoulder';
  if (lowerArea.includes('hand') || lowerArea.includes('arm')) return 'hand';
  if (lowerArea.includes('body') || lowerArea.includes('chest') || lowerArea.includes('torso')) {
    return 'body';
  }
  
  return 'unknown';
}
