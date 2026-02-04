/**
 * ContextualResponseSystem - 上下文感知响应系统
 * 
 * 根据对话上下文智能调整 Avatar 响应行为：
 * - 对话主题追踪 (通过真实 LLM)
 * - 对话阶段检测
 * - 用户意图历史记录
 * - 情感脉络追踪
 * - 个性化响应建议
 * 
 * v2.0: 接入 OpenClaw LLM 实现真实 AI 分析
 */

import { llmService, ContextAnalysisResult, IntentAnalysisResult } from './LLMService';

export type ConversationPhase = 
  | 'greeting'       // 问候阶段
  | 'warming'        // 热身阶段
  | 'main'           // 主要讨论
  | 'deepening'      // 深入讨论
  | 'wrapping'       // 收尾
  | 'farewell';      // 告别

export type TopicCategory =
  | 'casual'         // 日常闲聊
  | 'question'       // 问答
  | 'story'          // 故事叙述
  | 'emotion'        // 情感倾诉
  | 'task'           // 任务请求
  | 'creative'       // 创意讨论
  | 'technical';     // 技术讨论

export type UserIntent =
  | 'seek_info'      // 寻求信息
  | 'seek_help'      // 寻求帮助
  | 'share_feeling'  // 分享感受
  | 'make_request'   // 提出请求
  | 'express_opinion'// 表达观点
  | 'social_chat'    // 社交闲聊
  | 'confirm'        // 确认
  | 'reject'         // 拒绝
  | 'continue'       // 继续
  | 'change_topic';  // 换话题

export interface ConversationTurn {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  intent?: UserIntent;
  emotion?: string;
  topic?: TopicCategory;
  llmAnalysis?: IntentAnalysisResult; // LLM 分析结果
}

export interface ContextState {
  phase: ConversationPhase;
  turnCount: number;
  currentTopic: TopicCategory;
  topicDuration: number;      // 当前话题持续轮次
  emotionTrajectory: string[];// 情感变化轨迹
  userIntents: UserIntent[];  // 用户意图历史
  isEngaged: boolean;         // 用户是否投入
  responseStyle: ResponseStyle;
  lastLLMAnalysis?: ContextAnalysisResult; // 最新 LLM 分析
}

export interface ResponseStyle {
  formality: number;         // 0-1 正式程度
  enthusiasm: number;        // 0-1 热情程度
  empathy: number;           // 0-1 共情程度
  verbosity: number;         // 0-1 详细程度
  humor: number;             // 0-1 幽默程度
}

export interface ResponseSuggestion {
  emotion: string;
  motionHint: string;
  styleAdjustments: Partial<ResponseStyle>;
  openingPhrases?: string[];
  avoidPhrases?: string[];
  llmReasoning?: string;     // LLM 分析理由
}

export interface ContextConfig {
  maxTurns: number;          // 保存的最大轮次
  phaseThresholds: {
    warmingTurns: number;
    mainTurns: number;
    deepeningTurns: number;
    wrappingTurns: number;
  };
  topicChangeThreshold: number;  // 话题改变检测阈值
  engagementDecayRate: number;   // 参与度衰减率
  useLLM: boolean;               // 是否使用 LLM (true=真实AI, false=本地fallback)
  llmAnalysisInterval: number;   // LLM 分析间隔 (每 N 轮调用一次)
}

// 本地关键词映射 (仅作为 LLM 不可用时的 fallback)
const TOPIC_KEYWORDS_FALLBACK: Record<TopicCategory, string[]> = {
  casual: ['天气', '吃饭', '今天', '周末', '睡觉', '无聊', '好玩', '电影', '音乐', '游戏'],
  question: ['什么', '怎么', '为什么', '哪里', '谁', '多少', '如何', '能不能', '可以吗', '是否'],
  story: ['曾经', '以前', '那次', '记得', '发生', '故事', '经历', '那天', '有一次'],
  emotion: ['开心', '难过', '伤心', '生气', '害怕', '担心', '高兴', '郁闷', '烦躁', '感动'],
  task: ['帮我', '请', '需要', '任务', '完成', '做', '处理', '执行', '提醒'],
  creative: ['想法', '创意', '设计', '构思', '灵感', '创造', '想象', '如果'],
  technical: ['代码', '程序', '算法', '技术', '系统', '开发', '调试', '错误', 'bug']
};

const INTENT_KEYWORDS_FALLBACK: Record<UserIntent, string[]> = {
  seek_info: ['是什么', '怎么样', '告诉我', '介绍', '解释'],
  seek_help: ['帮帮我', '帮忙', '怎么办', '救命', '求助'],
  share_feeling: ['我觉得', '我感觉', '心情', '感受'],
  make_request: ['请', '麻烦', '可以', '能不能', '帮我'],
  express_opinion: ['我认为', '我觉得', '依我看', '在我看来'],
  social_chat: ['嗨', '你好', '哈哈', '嘻嘻', '哦', '嗯'],
  confirm: ['好的', '可以', '同意', '没问题', '行', '嗯嗯', '对'],
  reject: ['不要', '不行', '不可以', '拒绝', '算了'],
  continue: ['然后呢', '接着', '继续', '还有吗', '更多'],
  change_topic: ['对了', '话说', '另外', '换个话题', '说起来']
};

const FAREWELL_PATTERNS = ['再见', '拜拜', '回头见', '晚安', '下次聊', '先走了', '先这样'];
const GREETING_PATTERNS = ['你好', '嗨', '早上好', '下午好', '晚上好', 'hi', 'hello'];

type ContextCallback = (state: ContextState) => void;

export class ContextualResponseSystem {
  private config: ContextConfig;
  private turns: ConversationTurn[] = [];
  private state: ContextState;
  private callbacks: Set<ContextCallback> = new Set();
  private turnsSinceLastLLM = 0;
  private isAnalyzing = false;

  constructor(config?: Partial<ContextConfig>) {
    this.config = {
      maxTurns: 50,
      phaseThresholds: {
        warmingTurns: 2,
        mainTurns: 5,
        deepeningTurns: 15,
        wrappingTurns: 3
      },
      topicChangeThreshold: 0.6,
      engagementDecayRate: 0.1,
      useLLM: true,           // 默认使用真实 LLM
      llmAnalysisInterval: 2, // 每 2 轮分析一次
      ...config
    };

    this.state = this.createInitialState();
  }

  private createInitialState(): ContextState {
    return {
      phase: 'greeting',
      turnCount: 0,
      currentTopic: 'casual',
      topicDuration: 0,
      emotionTrajectory: [],
      userIntents: [],
      isEngaged: true,
      responseStyle: {
        formality: 0.3,
        enthusiasm: 0.7,
        empathy: 0.5,
        verbosity: 0.5,
        humor: 0.3
      }
    };
  }

  /**
   * 处理新的对话轮次 (同步，本地分析，向后兼容)
   */
  processTurn(text: string, role: 'user' | 'assistant', emotion?: string): void {
    this.processTurnInternal(text, role, emotion, false);
  }

  /**
   * 处理新的对话轮次 (异步，会调用 LLM)
   */
  async processTurnAsync(text: string, role: 'user' | 'assistant', emotion?: string): Promise<void> {
    await this.processTurnInternal(text, role, emotion, true);
  }

  /**
   * 内部处理对话轮次
   */
  private async processTurnInternal(text: string, role: 'user' | 'assistant', emotion: string | undefined, useLLM: boolean): Promise<void> {
    const turn: ConversationTurn = {
      role,
      text,
      timestamp: Date.now(),
      emotion
    };

    // 本地快速分析 (用于 fallback 或初始值)
    const localIntent = role === 'user' ? this.detectIntentLocal(text) : undefined;
    const localTopic = this.detectTopicLocal(text);
    turn.intent = localIntent;
    turn.topic = localTopic;

    this.turns.push(turn);
    if (this.turns.length > this.config.maxTurns) {
      this.turns.shift();
    }

    if (role === 'user') {
      this.state.turnCount++;
      this.turnsSinceLastLLM++;
      
      if (localIntent) {
        this.state.userIntents.push(localIntent);
        if (this.state.userIntents.length > 10) {
          this.state.userIntents.shift();
        }
      }
    }

    if (emotion) {
      this.state.emotionTrajectory.push(emotion);
      if (this.state.emotionTrajectory.length > 10) {
        this.state.emotionTrajectory.shift();
      }
    }

    // 更新话题 (本地)
    if (localTopic !== this.state.currentTopic) {
      this.state.currentTopic = localTopic;
      this.state.topicDuration = 1;
    } else {
      this.state.topicDuration++;
    }

    // 更新阶段 (本地)
    this.updatePhaseLocal(text, role);

    // 更新参与度 (本地)
    this.updateEngagementLocal(text, role);

    // 通知初步状态
    this.notifyCallbacks();

    // 异步调用 LLM 分析 (仅在明确请求 LLM 且满足条件时)
    if (useLLM &&
        this.config.useLLM && 
        role === 'user' && 
        this.turnsSinceLastLLM >= this.config.llmAnalysisInterval &&
        llmService.isConnected() &&
        !this.isAnalyzing) {
      await this.performLLMAnalysis(text, turn);
    }
  }

  /**
   * 执行 LLM 分析 (异步)
   */
  private async performLLMAnalysis(text: string, turn: ConversationTurn): Promise<void> {
    this.isAnalyzing = true;
    this.turnsSinceLastLLM = 0;

    try {
      // 并行调用意图和上下文分析
      const [intentResult, contextResult] = await Promise.all([
        llmService.analyzeIntent(text),
        llmService.analyzeContext(
          this.turns.map(t => ({ role: t.role, text: t.text })),
          text
        )
      ]);

      // 更新意图
      if (intentResult) {
        turn.llmAnalysis = intentResult;
        turn.intent = intentResult.intent as UserIntent;
        
        // 更新意图历史
        const lastIndex = this.state.userIntents.length - 1;
        if (lastIndex >= 0) {
          this.state.userIntents[lastIndex] = intentResult.intent as UserIntent;
        }
        
        console.log('[ContextSystem] LLM 意图分析:', intentResult.intent, 
          `(置信度: ${(intentResult.confidence * 100).toFixed(0)}%)`);
      }

      // 更新上下文
      if (contextResult) {
        this.state.lastLLMAnalysis = contextResult;
        this.state.currentTopic = contextResult.topic as TopicCategory;
        this.state.phase = contextResult.phase as ConversationPhase;
        this.state.isEngaged = contextResult.userEngagement > 0.5;
        
        // 更新响应风格
        if (contextResult.suggestedStyle) {
          this.state.responseStyle = {
            ...this.state.responseStyle,
            ...contextResult.suggestedStyle
          };
        }

        console.log('[ContextSystem] LLM 上下文分析:', {
          topic: contextResult.topic,
          phase: contextResult.phase,
          engagement: contextResult.userEngagement.toFixed(2),
          suggestedEmotion: contextResult.suggestedEmotion
        });
      }

      // 通知更新后的状态
      this.notifyCallbacks();
    } catch (e) {
      console.error('[ContextSystem] LLM 分析错误:', e);
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * 获取响应建议
   */
  getResponseSuggestion(): ResponseSuggestion {
    const suggestion: ResponseSuggestion = {
      emotion: this.suggestEmotion(),
      motionHint: this.suggestMotion(),
      styleAdjustments: {}
    };

    // 如果有 LLM 分析结果，优先使用
    if (this.state.lastLLMAnalysis) {
      const llmAnalysis = this.state.lastLLMAnalysis;
      
      if (llmAnalysis.suggestedEmotion) {
        suggestion.emotion = llmAnalysis.suggestedEmotion;
      }
      
      if (llmAnalysis.suggestedStyle) {
        suggestion.styleAdjustments = llmAnalysis.suggestedStyle;
      }
      
      suggestion.llmReasoning = llmAnalysis.reasoning;
    }

    // 根据阶段调整 (阶段优先级高于默认情绪)
    switch (this.state.phase) {
      case 'greeting':
        suggestion.emotion = 'happy';
        suggestion.motionHint = 'greeting';
        suggestion.openingPhrases = ['你好呀！', '嗨~', '见到你真开心！'];
        break;
      case 'farewell':
        suggestion.emotion = 'calm';
        suggestion.motionHint = 'wave';
        suggestion.openingPhrases = ['再见~', '下次再聊！', '期待下次见面！'];
        break;
      case 'deepening':
        suggestion.styleAdjustments.verbosity = Math.max(
          suggestion.styleAdjustments.verbosity || 0, 
          0.7
        );
        suggestion.styleAdjustments.empathy = Math.max(
          suggestion.styleAdjustments.empathy || 0, 
          0.8
        );
        break;
    }

    // 根据用户意图调整 (意图优先级高于阶段)
    const recentIntent = this.state.userIntents[this.state.userIntents.length - 1];
    if (recentIntent === 'share_feeling') {
      suggestion.emotion = this.mirrorEmotion() || suggestion.emotion;
      suggestion.styleAdjustments.empathy = 0.9;
      suggestion.motionHint = 'nod';
    } else if (recentIntent === 'seek_help') {
      suggestion.emotion = 'thinking';
      suggestion.styleAdjustments.enthusiasm = 0.8;
      suggestion.motionHint = 'thinking';
    }

    // 根据话题调整 (话题 emotion 只在无强制值时生效)
    if (this.state.currentTopic === 'emotion') {
      suggestion.styleAdjustments.empathy = Math.max(
        suggestion.styleAdjustments.empathy || 0, 
        0.8
      );
    } else if (this.state.currentTopic === 'creative') {
      suggestion.styleAdjustments.enthusiasm = 0.9;
      // 创意话题应该表现出兴奋
      if (!suggestion.emotion || suggestion.emotion === 'neutral') {
        suggestion.emotion = 'excited';
      }
    }

    return suggestion;
  }

  /**
   * 强制触发 LLM 分析 (不等待间隔)
   */
  async forceLLMAnalysis(): Promise<ContextAnalysisResult | null> {
    if (!this.config.useLLM || !llmService.isConnected()) {
      return null;
    }

    const lastUserTurn = this.turns.filter(t => t.role === 'user').pop();
    if (!lastUserTurn) return null;

    const result = await llmService.analyzeContext(
      this.turns.map(t => ({ role: t.role, text: t.text })),
      lastUserTurn.text
    );

    if (result) {
      this.state.lastLLMAnalysis = result;
      this.notifyCallbacks();
    }

    return result;
  }

  /**
   * 获取当前上下文状态
   */
  getState(): ContextState {
    return { ...this.state };
  }

  /**
   * 获取对话历史
   */
  getTurns(): ConversationTurn[] {
    return [...this.turns];
  }

  /**
   * 获取最近 N 轮对话
   */
  getRecentTurns(n: number): ConversationTurn[] {
    return this.turns.slice(-n);
  }

  /**
   * 检测是否应该主动发起话题
   */
  shouldInitiateTopic(): boolean {
    const recentUserTurns = this.turns
      .filter(t => t.role === 'user')
      .slice(-3);
    
    if (recentUserTurns.length < 3) return false;
    
    const avgLength = recentUserTurns.reduce((sum, t) => sum + t.text.length, 0) / 3;
    return avgLength < 10 && this.state.isEngaged;
  }

  /**
   * 订阅状态变化
   */
  onStateChange(callback: ContextCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 重置对话
   */
  reset(): void {
    this.turns = [];
    this.state = this.createInitialState();
    this.turnsSinceLastLLM = 0;
    this.notifyCallbacks();
  }

  /**
   * 设置是否使用 LLM
   */
  setUseLLM(useLLM: boolean): void {
    this.config.useLLM = useLLM;
  }

  /**
   * 检查 LLM 是否可用
   */
  isLLMAvailable(): boolean {
    return this.config.useLLM && llmService.isConnected();
  }

  // === 本地 Fallback 方法 ===

  private detectIntentLocal(text: string): UserIntent {
    const lower = text.toLowerCase();
    
    let maxScore = 0;
    let detectedIntent: UserIntent = 'social_chat';
    
    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS_FALLBACK)) {
      let score = 0;
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          score++;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        detectedIntent = intent as UserIntent;
      }
    }
    
    return detectedIntent;
  }

  private detectTopicLocal(text: string): TopicCategory {
    const lower = text.toLowerCase();
    
    let maxScore = 0;
    let detectedTopic: TopicCategory = 'casual';
    
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS_FALLBACK)) {
      let score = 0;
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          score++;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        detectedTopic = topic as TopicCategory;
      }
    }
    
    return detectedTopic;
  }

  private updatePhaseLocal(text: string, role: 'user' | 'assistant'): void {
    const lower = text.toLowerCase();
    const tc = this.state.turnCount;
    const thresholds = this.config.phaseThresholds;

    if (tc <= 2 && GREETING_PATTERNS.some(p => lower.includes(p))) {
      this.state.phase = 'greeting';
      return;
    }

    if (FAREWELL_PATTERNS.some(p => lower.includes(p))) {
      this.state.phase = 'farewell';
      return;
    }

    if (tc < thresholds.warmingTurns) {
      this.state.phase = 'warming';
    } else if (tc < thresholds.mainTurns) {
      this.state.phase = 'main';
    } else if (tc < thresholds.deepeningTurns) {
      this.state.phase = 'deepening';
    } else {
      const recentIntents = this.state.userIntents.slice(-3);
      const hasConfirm = recentIntents.includes('confirm');
      const hasReject = recentIntents.includes('reject');
      
      if (hasConfirm || hasReject) {
        this.state.phase = 'wrapping';
      } else {
        this.state.phase = 'deepening';
      }
    }
  }

  private updateEngagementLocal(text: string, role: 'user' | 'assistant'): void {
    if (role !== 'user') return;

    const length = text.length;
    const hasQuestion = text.includes('?') || text.includes('？');
    const hasExclaim = text.includes('!') || text.includes('！');
    
    let engagementDelta = 0;
    
    if (length > 50) engagementDelta += 0.1;
    else if (length < 5) engagementDelta -= 0.2;
    
    if (hasQuestion) engagementDelta += 0.1;
    if (hasExclaim) engagementDelta += 0.05;
    
    engagementDelta -= this.config.engagementDecayRate;
    
    this.state.isEngaged = this.state.isEngaged && 
      (this.state.turnCount < 3 || engagementDelta > -0.15);
  }

  private suggestEmotion(): string {
    // 优先使用 LLM 建议
    if (this.state.lastLLMAnalysis?.suggestedEmotion) {
      return this.state.lastLLMAnalysis.suggestedEmotion;
    }

    const recent = this.state.emotionTrajectory.slice(-3);
    if (recent.length === 0) return 'neutral';
    
    const emotionCounts: Record<string, number> = {};
    for (const emotion of recent) {
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    }
    
    let maxEmotion = 'neutral';
    let maxCount = 0;
    for (const [emotion, count] of Object.entries(emotionCounts)) {
      if (count > maxCount) {
        maxCount = count;
        maxEmotion = emotion;
      }
    }
    
    return maxEmotion;
  }

  private mirrorEmotion(): string {
    const lastUserTurn = this.turns
      .filter(t => t.role === 'user')
      .pop();
    
    if (!lastUserTurn?.emotion) return 'neutral';
    
    const emotion = lastUserTurn.emotion;
    if (emotion === 'sad') return 'calm';
    if (emotion === 'angry') return 'calm';
    return emotion;
  }

  private suggestMotion(): string {
    const intent = this.state.userIntents[this.state.userIntents.length - 1];
    
    switch (intent) {
      case 'confirm': return 'nod';
      case 'reject': return 'shake';
      case 'seek_help': return 'thinking';
      case 'share_feeling': return 'listening';
      default: return 'idle';
    }
  }

  private notifyCallbacks(): void {
    for (const callback of this.callbacks) {
      try {
        callback(this.getState());
      } catch (e) {
        console.error('[ContextualResponse] Callback error:', e);
      }
    }
  }

  /**
   * 获取对话统计
   */
  getStatistics(): {
    totalTurns: number;
    userTurns: number;
    avgUserMsgLength: number;
    topicChanges: number;
    dominantTopic: TopicCategory;
    dominantIntent: UserIntent;
    llmAnalysisCount: number;
  } {
    const userTurns = this.turns.filter(t => t.role === 'user');
    
    let topicChanges = 0;
    let lastTopic: TopicCategory | null = null;
    const topicCounts: Partial<Record<TopicCategory, number>> = {};
    for (const turn of this.turns) {
      if (turn.topic) {
        topicCounts[turn.topic] = (topicCounts[turn.topic] || 0) + 1;
        if (lastTopic && turn.topic !== lastTopic) {
          topicChanges++;
        }
        lastTopic = turn.topic;
      }
    }
    
    let dominantTopic: TopicCategory = 'casual';
    let maxTopicCount = 0;
    for (const [topic, count] of Object.entries(topicCounts)) {
      if (count > maxTopicCount) {
        maxTopicCount = count;
        dominantTopic = topic as TopicCategory;
      }
    }
    
    const intentCounts: Partial<Record<UserIntent, number>> = {};
    for (const intent of this.state.userIntents) {
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    }
    
    let dominantIntent: UserIntent = 'social_chat';
    let maxIntentCount = 0;
    for (const [intent, count] of Object.entries(intentCounts)) {
      if (count > maxIntentCount) {
        maxIntentCount = count;
        dominantIntent = intent as UserIntent;
      }
    }

    // 统计 LLM 分析次数
    const llmAnalysisCount = this.turns.filter(t => t.llmAnalysis).length;
    
    return {
      totalTurns: this.turns.length,
      userTurns: userTurns.length,
      avgUserMsgLength: userTurns.length > 0 
        ? userTurns.reduce((sum, t) => sum + t.text.length, 0) / userTurns.length 
        : 0,
      topicChanges,
      dominantTopic,
      dominantIntent,
      llmAnalysisCount
    };
  }
}
