/**
 * Expression Sequencer - 表情序列动画系统
 * 
 * SOTA 优化 Round 5
 * 
 * 功能：
 * - 表情序列：定义多个表情的播放顺序
 * - 复合表情：组合多个基础表情创建新表情
 * - 情绪惯性：避免表情频繁切换，保持自然过渡
 * - 情绪记忆：记住最近的情绪状态
 * - 表情反弹：从强烈情绪返回时会有过渡表情
 */

import { avatarController, type Expression } from './AvatarController';

// ========== 表情序列定义 ==========

interface ExpressionStep {
  expression: Expression;
  duration: number;      // 持续时间 (ms)
  delay?: number;        // 开始前延迟 (ms)
  blend?: {              // 混合配置
    target?: Expression;
    ratio?: number;      // 0-1
  };
}

interface ExpressionSequence {
  name: string;
  steps: ExpressionStep[];
  loop?: boolean;
  onComplete?: () => void;
}

// 预定义的表情序列
const PRESET_SEQUENCES: Record<string, ExpressionSequence> = {
  // 惊喜（惊讶 → 开心）
  delighted: {
    name: 'delighted',
    steps: [
      { expression: 'surprised', duration: 500 },
      { expression: 'excited', duration: 800 },
      { expression: 'happy', duration: 2000 },
    ],
  },
  
  // 害羞反应（惊讶 → 害羞 → 微笑）
  shyReaction: {
    name: 'shyReaction',
    steps: [
      { expression: 'surprised', duration: 300 },
      { expression: 'embarrassed', duration: 1500 },
      { expression: 'happy', duration: 1000, blend: { target: 'embarrassed', ratio: 0.3 } },
    ],
  },
  
  // 困惑思考（困惑 → 思考 → 恍然大悟）
  figureOut: {
    name: 'figureOut',
    steps: [
      { expression: 'confused', duration: 800 },
      { expression: 'thinking', duration: 1500 },
      { expression: 'surprised', duration: 400 },
      { expression: 'happy', duration: 1000 },
    ],
  },
  
  // 同情（悲伤 + 关心）
  sympathy: {
    name: 'sympathy',
    steps: [
      { expression: 'sad', duration: 500, blend: { target: 'loving', ratio: 0.4 } },
      { expression: 'loving', duration: 2000, blend: { target: 'sad', ratio: 0.3 } },
    ],
  },
  
  // 俏皮眨眼
  playfulWink: {
    name: 'playfulWink',
    steps: [
      { expression: 'playful', duration: 300 },
      { expression: 'happy', duration: 200 },  // 配合眨眼
      { expression: 'playful', duration: 1000 },
    ],
  },
  
  // 紧张等待
  nervousWait: {
    name: 'nervousWait',
    steps: [
      { expression: 'anxious', duration: 1000 },
      { expression: 'hopeful', duration: 800 },
      { expression: 'anxious', duration: 600 },
      { expression: 'relieved', duration: 1500 },
    ],
  },
  
  // 被夸奖反应
  flattered: {
    name: 'flattered',
    steps: [
      { expression: 'surprised', duration: 300 },
      { expression: 'embarrassed', duration: 600 },
      { expression: 'happy', duration: 1200, blend: { target: 'proud', ratio: 0.4 } },
    ],
  },
  
  // 失望恢复
  disappointmentRecovery: {
    name: 'disappointmentRecovery',
    steps: [
      { expression: 'disappointed', duration: 1000 },
      { expression: 'sad', duration: 800 },
      { expression: 'thinking', duration: 600 },
      { expression: 'determined', duration: 1500 },
    ],
  },
  
  // 好奇探索
  curiousExplore: {
    name: 'curiousExplore',
    steps: [
      { expression: 'curious', duration: 800 },
      { expression: 'thinking', duration: 500 },
      { expression: 'excited', duration: 600 },
      { expression: 'curious', duration: 1000 },
    ],
  },
  
  // 温柔安慰
  gentleComfort: {
    name: 'gentleComfort',
    steps: [
      { expression: 'loving', duration: 1000 },
      { expression: 'grateful', duration: 800, blend: { target: 'loving', ratio: 0.5 } },
      { expression: 'hopeful', duration: 1200 },
    ],
  },
  
  // ========== SOTA Round 24 新增序列 ==========
  
  // 惊慌失措（惊讶 → 害怕 → 焦虑 → 释然）
  panicRecovery: {
    name: 'panicRecovery',
    steps: [
      { expression: 'surprised', duration: 300 },
      { expression: 'fear', duration: 600 },
      { expression: 'anxious', duration: 800 },
      { expression: 'relieved', duration: 1500 },
    ],
  },
  
  // 深度思考（好奇 → 思考 → 专注 → 恍然大悟）
  deepThinking: {
    name: 'deepThinking',
    steps: [
      { expression: 'curious', duration: 500 },
      { expression: 'thinking', duration: 1200 },
      { expression: 'determined', duration: 800 },
      { expression: 'excited', duration: 600 },
      { expression: 'happy', duration: 1000 },
    ],
  },
  
  // 感动落泪（惊讶 → 感激 → 感动 → 开心）
  touchedToTears: {
    name: 'touchedToTears',
    steps: [
      { expression: 'surprised', duration: 400 },
      { expression: 'grateful', duration: 800 },
      { expression: 'loving', duration: 1000, blend: { target: 'sad', ratio: 0.3 } },
      { expression: 'happy', duration: 1200, blend: { target: 'grateful', ratio: 0.4 } },
    ],
  },
  
  // 撒娇卖萌（俏皮 → 害羞 → 期待 → 开心）
  actCute: {
    name: 'actCute',
    steps: [
      { expression: 'playful', duration: 600 },
      { expression: 'embarrassed', duration: 500 },
      { expression: 'hopeful', duration: 800 },
      { expression: 'happy', duration: 1000, blend: { target: 'playful', ratio: 0.3 } },
    ],
  },
  
  // 生气冷静（生气 → 失望 → 思考 → 释然）
  angerCoolDown: {
    name: 'angerCoolDown',
    steps: [
      { expression: 'angry', duration: 800 },
      { expression: 'disappointed', duration: 600 },
      { expression: 'thinking', duration: 700 },
      { expression: 'relieved', duration: 1000 },
      { expression: 'neutral', duration: 800 },
    ],
  },
  
  // 惊喜连连（惊讶 → 兴奋 → 惊讶 → 更兴奋 → 开心）
  doubleDelight: {
    name: 'doubleDelight',
    steps: [
      { expression: 'surprised', duration: 400 },
      { expression: 'excited', duration: 600 },
      { expression: 'surprised', duration: 300 },
      { expression: 'excited', duration: 800, blend: { target: 'happy', ratio: 0.5 } },
      { expression: 'happy', duration: 1500 },
    ],
  },
  
  // 孤独到希望（孤独 → 悲伤 → 思考 → 期待 → 开心）
  lonelyToHope: {
    name: 'lonelyToHope',
    steps: [
      { expression: 'lonely', duration: 800 },
      { expression: 'sad', duration: 600 },
      { expression: 'thinking', duration: 500 },
      { expression: 'hopeful', duration: 700 },
      { expression: 'happy', duration: 1200 },
    ],
  },
  
  // 倔强坚定（失望 → 生气 → 坚定 → 骄傲）
  stubbornDetermined: {
    name: 'stubbornDetermined',
    steps: [
      { expression: 'disappointed', duration: 500 },
      { expression: 'angry', duration: 400, blend: { target: 'determined', ratio: 0.3 } },
      { expression: 'determined', duration: 1000 },
      { expression: 'proud', duration: 1200 },
    ],
  },
};

// ========== 情绪惯性系统 ==========

interface EmotionState {
  current: Expression;
  previous: Expression;
  timestamp: number;
  intensity: number;  // 0-1，情绪强度
  momentum: number;   // 情绪惯性，决定切换的难度
}

// 情绪强度映射
const EMOTION_INTENSITY: Record<Expression, number> = {
  neutral: 0,
  happy: 0.6,
  sad: 0.7,
  surprised: 0.8,
  angry: 0.9,
  fear: 0.85,
  disgusted: 0.75,
  excited: 0.85,
  proud: 0.5,
  loving: 0.6,
  grateful: 0.5,
  hopeful: 0.4,
  amused: 0.5,
  relieved: 0.4,
  anxious: 0.7,
  embarrassed: 0.6,
  confused: 0.5,
  bored: 0.3,
  disappointed: 0.65,
  lonely: 0.6,
  thinking: 0.3,
  curious: 0.4,
  determined: 0.6,
  playful: 0.5,
};

// 情绪兼容性（相似情绪可以平滑过渡）
const EMOTION_COMPATIBILITY: Record<Expression, Expression[]> = {
  neutral: ['thinking', 'curious', 'bored'],
  happy: ['excited', 'amused', 'playful', 'proud', 'grateful', 'loving'],
  sad: ['disappointed', 'lonely', 'relieved'],
  surprised: ['curious', 'confused', 'excited', 'fear'],
  angry: ['disgusted', 'disappointed', 'determined'],
  fear: ['anxious', 'surprised', 'nervous' as any],
  disgusted: ['angry', 'disappointed'],
  excited: ['happy', 'surprised', 'curious', 'playful'],
  proud: ['happy', 'determined', 'grateful'],
  loving: ['happy', 'grateful', 'hopeful'],
  grateful: ['happy', 'loving', 'relieved'],
  hopeful: ['curious', 'excited', 'determined'],
  amused: ['happy', 'playful', 'curious'],
  relieved: ['happy', 'grateful', 'hopeful'],
  anxious: ['fear', 'confused', 'hopeful'],
  embarrassed: ['surprised', 'happy', 'playful'],
  confused: ['curious', 'thinking', 'surprised'],
  bored: ['neutral', 'curious', 'disappointed'],
  disappointed: ['sad', 'angry', 'determined'],
  lonely: ['sad', 'hopeful', 'loving'],
  thinking: ['curious', 'confused', 'neutral'],
  curious: ['thinking', 'excited', 'surprised'],
  determined: ['proud', 'angry', 'hopeful'],
  playful: ['happy', 'amused', 'excited'],
};

// ========== 表情反弹映射 ==========
// 从强烈情绪返回 neutral 时经过的过渡表情
const EMOTION_REBOUND: Partial<Record<Expression, Expression>> = {
  angry: 'disappointed',
  fear: 'relieved',
  excited: 'happy',
  sad: 'thinking',
  surprised: 'curious',
  disgusted: 'neutral',
  anxious: 'relieved',
  embarrassed: 'happy',
};

// ========== Expression Sequencer 类 ==========

type SequenceCallback = (step: ExpressionStep, index: number) => void;

export class ExpressionSequencer {
  private emotionState: EmotionState = {
    current: 'neutral',
    previous: 'neutral',
    timestamp: Date.now(),
    intensity: 0,
    momentum: 0,
  };
  
  // 序列播放状态
  private currentSequence: ExpressionSequence | null = null;
  private sequenceIndex = 0;
  private sequenceTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isPlaying = false;
  
  // 情绪历史记录
  private emotionHistory: Array<{ emotion: Expression; timestamp: number }> = [];
  private readonly historyMaxLength = 10;
  
  // 回调
  private onStepCallbacks: Set<SequenceCallback> = new Set();
  
  // 配置
  private config = {
    enableInertia: true,         // 启用情绪惯性
    enableRebound: true,         // 启用表情反弹
    inertiaDecayRate: 0.1,       // 惯性衰减速率 (每秒)
    minSwitchInterval: 500,      // 最小切换间隔 (ms)
    reboundDuration: 600,        // 反弹表情持续时间 (ms)
  };
  
  constructor() {
    console.log('[ExpressionSequencer] 表情序列系统初始化');
  }

  // ========== 序列播放 ==========

  /**
   * 播放预定义序列
   */
  playPreset(name: keyof typeof PRESET_SEQUENCES): boolean {
    const sequence = PRESET_SEQUENCES[name];
    if (!sequence) {
      console.warn(`[ExpressionSequencer] 未找到预设序列: ${name}`);
      return false;
    }
    return this.play(sequence);
  }

  /**
   * 播放自定义序列
   */
  play(sequence: ExpressionSequence): boolean {
    // 停止当前序列
    this.stop();
    
    if (sequence.steps.length === 0) {
      console.warn('[ExpressionSequencer] 序列为空');
      return false;
    }
    
    console.log(`[ExpressionSequencer] 开始播放序列: ${sequence.name}`);
    
    this.currentSequence = sequence;
    this.sequenceIndex = 0;
    this.isPlaying = true;
    
    this.playNextStep();
    return true;
  }

  /**
   * 播放下一步
   */
  private playNextStep() {
    if (!this.currentSequence || !this.isPlaying) return;
    
    const step = this.currentSequence.steps[this.sequenceIndex];
    if (!step) {
      this.onSequenceComplete();
      return;
    }
    
    const executeStep = () => {
      // 应用表情
      if (step.blend) {
        avatarController.blendExpressions(
          step.expression,
          step.blend.target || 'neutral',
          step.blend.ratio || 0.5
        );
      } else {
        avatarController.setExpression(step.expression, {
          duration: 0,  // 由序列控制持续时间
        });
      }
      
      // 更新内部状态
      this.updateEmotionState(step.expression);
      
      // 触发回调
      this.onStepCallbacks.forEach(cb => cb(step, this.sequenceIndex));
      
      // 计划下一步
      this.sequenceTimeoutId = setTimeout(() => {
        this.sequenceIndex++;
        this.playNextStep();
      }, step.duration);
    };
    
    // 处理延迟
    if (step.delay && step.delay > 0) {
      this.sequenceTimeoutId = setTimeout(executeStep, step.delay);
    } else {
      executeStep();
    }
  }

  /**
   * 序列完成处理
   */
  private onSequenceComplete() {
    const sequence = this.currentSequence;
    
    if (sequence?.loop) {
      // 循环播放
      this.sequenceIndex = 0;
      this.playNextStep();
    } else {
      // 完成
      console.log(`[ExpressionSequencer] 序列完成: ${sequence?.name}`);
      this.isPlaying = false;
      this.currentSequence = null;
      
      // 回调
      sequence?.onComplete?.();
      
      // 自然回到 neutral
      this.transitionToNeutral();
    }
  }

  /**
   * 停止当前序列
   */
  stop() {
    if (this.sequenceTimeoutId) {
      clearTimeout(this.sequenceTimeoutId);
      this.sequenceTimeoutId = null;
    }
    this.isPlaying = false;
    this.currentSequence = null;
    this.sequenceIndex = 0;
  }

  /**
   * 暂停/恢复
   */
  pause() {
    if (this.sequenceTimeoutId) {
      clearTimeout(this.sequenceTimeoutId);
      this.sequenceTimeoutId = null;
    }
    this.isPlaying = false;
  }

  resume() {
    if (this.currentSequence && !this.isPlaying) {
      this.isPlaying = true;
      this.playNextStep();
    }
  }

  // ========== 智能表情切换 ==========

  /**
   * 智能设置表情（带惯性和反弹）
   */
  setEmotionSmart(emotion: Expression): boolean {
    const now = Date.now();
    const timeSinceLastSwitch = now - this.emotionState.timestamp;
    
    // 检查最小切换间隔
    if (this.config.enableInertia && timeSinceLastSwitch < this.config.minSwitchInterval) {
      console.log('[ExpressionSequencer] 切换过快，跳过');
      return false;
    }
    
    // 相同表情，跳过
    if (emotion === this.emotionState.current) {
      return false;
    }
    
    // 计算惯性衰减
    const currentMomentum = this.calculateCurrentMomentum();
    
    // 检查是否需要强制切换（新情绪强度高于当前惯性）
    const newIntensity = EMOTION_INTENSITY[emotion];
    
    if (this.config.enableInertia && currentMomentum > newIntensity) {
      // 惯性太大，不切换（除非是兼容情绪）
      const compatible = EMOTION_COMPATIBILITY[this.emotionState.current] || [];
      if (!compatible.includes(emotion)) {
        console.log(`[ExpressionSequencer] 惯性阻止切换: ${this.emotionState.current} → ${emotion}`);
        return false;
      }
    }
    
    // 检查是否需要反弹
    if (this.config.enableRebound && 
        emotion === 'neutral' && 
        EMOTION_INTENSITY[this.emotionState.current] > 0.6) {
      this.transitionToNeutral();
      return true;
    }
    
    // 执行切换
    this.updateEmotionState(emotion);
    avatarController.setExpression(emotion);
    
    return true;
  }

  /**
   * 计算当前惯性
   */
  private calculateCurrentMomentum(): number {
    const now = Date.now();
    const elapsed = (now - this.emotionState.timestamp) / 1000;
    const decay = Math.max(0, this.emotionState.momentum - elapsed * this.config.inertiaDecayRate);
    return decay;
  }

  /**
   * 更新情绪状态
   */
  private updateEmotionState(emotion: Expression) {
    const now = Date.now();
    
    // 添加到历史
    this.emotionHistory.push({ emotion, timestamp: now });
    if (this.emotionHistory.length > this.historyMaxLength) {
      this.emotionHistory.shift();
    }
    
    // 更新状态
    this.emotionState.previous = this.emotionState.current;
    this.emotionState.current = emotion;
    this.emotionState.timestamp = now;
    this.emotionState.intensity = EMOTION_INTENSITY[emotion];
    this.emotionState.momentum = EMOTION_INTENSITY[emotion];
  }

  /**
   * 带反弹地返回 neutral
   */
  private transitionToNeutral() {
    const currentEmotion = this.emotionState.current;
    const reboundEmotion = EMOTION_REBOUND[currentEmotion];
    
    if (this.config.enableRebound && reboundEmotion) {
      // 播放反弹序列
      const sequence: ExpressionSequence = {
        name: 'rebound',
        steps: [
          { expression: reboundEmotion, duration: this.config.reboundDuration },
          { expression: 'neutral', duration: 0 },
        ],
      };
      this.play(sequence);
    } else {
      // 直接回到 neutral
      this.updateEmotionState('neutral');
      avatarController.setExpression('neutral');
    }
  }

  // ========== 情绪分析 ==========

  /**
   * 根据文本智能选择表情序列
   * SOTA Round 24: 扩展到 16 种触发模式
   */
  analyzeAndPlaySequence(text: string): boolean {
    const lowerText = text.toLowerCase();
    
    // ========== 积极情绪序列 ==========
    
    // 惊喜反应
    if (this.containsAny(lowerText, ['哇', '天啊', '太棒了', 'wow', 'amazing', '太好了', '太赞了', '绝了', '牛', 'awesome'])) {
      return this.playPreset('delighted');
    }
    
    // 双重惊喜（更强烈的惊喜）
    if (this.containsAny(lowerText, ['天哪天哪', '我的天', 'oh my god', 'omg', '不敢相信', '太不可思议', '震惊'])) {
      return this.playPreset('doubleDelight');
    }
    
    // 被夸奖
    if (this.containsAny(lowerText, ['谢谢夸奖', '过奖', '哪里哪里', 'flattered', '被夸', '你真会说话', '嘿嘿谢谢'])) {
      return this.playPreset('flattered');
    }
    
    // 感动
    if (this.containsAny(lowerText, ['好感动', '感动哭', '太暖了', 'touched', '泪目', '破防了', '暖心'])) {
      return this.playPreset('touchedToTears');
    }
    
    // ========== 害羞/可爱序列 ==========
    
    // 害羞
    if (this.containsAny(lowerText, ['害羞', '不好意思', 'blush', '///', '脸红', '羞羞', '人家'])) {
      return this.playPreset('shyReaction');
    }
    
    // 撒娇卖萌
    if (this.containsAny(lowerText, ['求求', '拜托', '嘤嘤', '人家想', 'please', '卖萌', '撒娇', 'pwease'])) {
      return this.playPreset('actCute');
    }
    
    // 调皮眨眼
    if (this.containsAny(lowerText, ['嘿嘿', '嘻嘻', '调皮', 'hehe', '眨眼', '坏笑', '略略略'])) {
      return this.playPreset('playfulWink');
    }
    
    // ========== 思考/理解序列 ==========
    
    // 恍然大悟
    if (this.containsAny(lowerText, ['原来如此', '明白了', '懂了', 'i see', 'got it', '恍然大悟', '原来是这样'])) {
      return this.playPreset('figureOut');
    }
    
    // 深度思考
    if (this.containsAny(lowerText, ['让我想想', '思考一下', 'let me think', '仔细想', '认真考虑', 'hmm', '嗯...'])) {
      return this.playPreset('deepThinking');
    }
    
    // 好奇探索
    if (this.containsAny(lowerText, ['为什么', '怎么', '什么是', 'why', 'what', 'how', '好奇', '想知道', '告诉我'])) {
      return this.playPreset('curiousExplore');
    }
    
    // ========== 关心/安慰序列 ==========
    
    // 同情安慰
    if (this.containsAny(lowerText, ['辛苦了', '不容易', '心疼', '抱抱', 'poor', '受苦了', '太难了'])) {
      return this.playPreset('sympathy');
    }
    
    // 温柔安慰
    if (this.containsAny(lowerText, ['没事的', '会好的', '在这里', '陪你', 'it\'s okay', '别担心', '有我在'])) {
      return this.playPreset('gentleComfort');
    }
    
    // ========== 负面情绪恢复序列 ==========
    
    // 失望恢复
    if (this.containsAny(lowerText, ['没关系', '下次', '加油', '振作', '别灰心', '继续努力', '失败是成功'])) {
      return this.playPreset('disappointmentRecovery');
    }
    
    // 惊慌恢复
    if (this.containsAny(lowerText, ['吓死了', '好险', '差点', 'scared', '心脏', '虚惊一场', '还好'])) {
      return this.playPreset('panicRecovery');
    }
    
    // 从孤独到希望
    if (this.containsAny(lowerText, ['一个人', '孤单', 'alone', 'lonely', '没人', '但是有你', '还有你'])) {
      return this.playPreset('lonelyToHope');
    }
    
    // 生气冷静
    if (this.containsAny(lowerText, ['气死了', '好生气', '算了算了', '冷静', 'angry', '不气了', '消消气'])) {
      return this.playPreset('angerCoolDown');
    }
    
    // 倔强坚定
    if (this.containsAny(lowerText, ['我能行', '一定要', '必须', '绝不放弃', 'never give up', '坚持', '我偏要'])) {
      return this.playPreset('stubbornDetermined');
    }
    
    return false;
  }

  /**
   * 辅助：检查是否包含任一关键词
   */
  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  }

  // ========== 状态查询 ==========

  /**
   * 获取当前情绪状态
   */
  getEmotionState(): EmotionState {
    return { ...this.emotionState };
  }

  /**
   * 获取情绪历史
   */
  getEmotionHistory(): Array<{ emotion: Expression; timestamp: number }> {
    return [...this.emotionHistory];
  }

  /**
   * 是否正在播放序列
   */
  isSequencePlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * 获取当前序列名
   */
  getCurrentSequenceName(): string | null {
    return this.currentSequence?.name || null;
  }

  /**
   * 获取可用的预设序列
   */
  getPresetNames(): string[] {
    return Object.keys(PRESET_SEQUENCES);
  }

  // ========== 配置 ==========

  /**
   * 更新配置
   */
  setConfig(config: Partial<typeof this.config>) {
    this.config = { ...this.config, ...config };
    console.log('[ExpressionSequencer] 配置更新:', this.config);
  }

  /**
   * 获取配置
   */
  getConfig() {
    return { ...this.config };
  }

  // ========== 回调 ==========

  /**
   * 监听步骤变化
   */
  onStep(callback: SequenceCallback): () => void {
    this.onStepCallbacks.add(callback);
    return () => this.onStepCallbacks.delete(callback);
  }

  // ========== 销毁 ==========

  destroy() {
    this.stop();
    this.onStepCallbacks.clear();
    this.emotionHistory = [];
  }
}

// 单例导出
export const expressionSequencer = new ExpressionSequencer();

// 便捷函数导出
export function playSequence(name: keyof typeof PRESET_SEQUENCES): boolean {
  return expressionSequencer.playPreset(name);
}

export function setEmotionSmart(emotion: Expression): boolean {
  return expressionSequencer.setEmotionSmart(emotion);
}

export function analyzeTextForSequence(text: string): boolean {
  return expressionSequencer.analyzeAndPlaySequence(text);
}
