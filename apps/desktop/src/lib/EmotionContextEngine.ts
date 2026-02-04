/**
 * Emotion Context Engine - 情绪上下文引擎
 * 
 * SOTA Round 6: 情绪上下文系统
 * SOTA Round 25: 意图识别 + 情绪氛围 + 增强话题
 * 
 * 功能:
 * - 对话情感基调追踪
 * - 情绪惯性（避免突兀切换）
 * - 对话主题识别
 * - 情绪历史分析
 * - 语境增强的情绪检测
 * - 对话意图识别 (greeting, question, request, statement, farewell)
 * - 情绪氛围检测 (整体对话氛围)
 * - 共情响应系统
 * 
 * 解决问题:
 * - 悲伤对话中说"好的"不应该立刻变中性
 * - 开心聊天中突然说"累了"应该渐变
 * - 同一话题内情绪应该保持连贯
 * - 根据用户意图调整响应情绪
 */

import type { Expression } from './AvatarController';

// ========== 类型定义 ==========

/** 对话意图类型 */
export type Intent = 
  | 'greeting'      // 问候
  | 'farewell'      // 告别
  | 'question'      // 提问
  | 'request'       // 请求
  | 'statement'     // 陈述
  | 'expression'    // 情感表达
  | 'appreciation'  // 感谢/赞美
  | 'complaint'     // 抱怨/投诉
  | 'agreement'     // 同意/确认
  | 'disagreement'  // 反对/否定
  | 'unknown';      // 未知

/** 情绪氛围 */
export type Atmosphere = 
  | 'warm'          // 温馨
  | 'tense'         // 紧张
  | 'casual'        // 轻松
  | 'serious'       // 严肃
  | 'playful'       // 活泼
  | 'melancholy'    // 忧郁
  | 'neutral';      // 中性

export interface EmotionEntry {
  emotion: Expression;
  intensity: number;       // 0-1
  timestamp: number;
  text: string;
  topic?: string;
  intent?: Intent;         // Round 25: 意图标记
}

export interface ConversationTone {
  baseEmotion: Expression;     // 对话基调情绪
  stability: number;           // 基调稳定性 0-1
  topicStack: string[];        // 话题栈
  lastSignificantEmotion: Expression;  // 上一个显著情绪
  atmosphere: Atmosphere;      // Round 25: 对话氛围
  engagementLevel: number;     // Round 25: 参与度 0-1
  lastIntent?: Intent;         // Round 25: 上一个意图
}

export interface EmotionInfluence {
  emotion: Expression;
  weight: number;         // 影响权重
  source: 'detected' | 'context' | 'inertia' | 'topic';
}

// ========== Round 25: 意图识别关键词 ==========

const INTENT_KEYWORDS: Record<Intent, string[]> = {
  greeting: [
    // 中文
    '你好', '嗨', '早上好', '晚上好', '下午好', '早安', '晚安',
    '在吗', '在不在', '有人吗', '初音', 'ミク', '未来',
    // English
    'hi', 'hello', 'hey', 'good morning', 'good evening', 'good night',
    'greetings', 'howdy', 'yo', 'sup', 'what\'s up',
  ],
  farewell: [
    // 中文
    '再见', '拜拜', '下次见', '回头见', '走了', '先这样', '改天聊',
    '去忙了', '睡了', '休息了', '晚安', '明天见',
    // English
    'bye', 'goodbye', 'see you', 'later', 'gotta go', 'brb',
    'take care', 'cya', 'night', 'g2g',
  ],
  question: [
    // 中文
    '什么', '为什么', '怎么', '如何', '哪个', '哪里', '谁', '几',
    '是不是', '能不能', '可以吗', '对吗', '吗？', '呢？',
    // English
    'what', 'why', 'how', 'which', 'where', 'who', 'when',
    'can you', 'could you', 'is it', 'are you', 'do you', '?',
  ],
  request: [
    // 中文
    '请', '帮我', '帮忙', '麻烦', '能不能', '可以帮', '给我',
    '我想要', '我需要', '帮个忙', '拜托', '求',
    // English
    'please', 'help me', 'can you', 'could you', 'would you',
    'i need', 'i want', 'give me', 'show me', 'tell me',
  ],
  statement: [
    // 中文
    '我觉得', '我认为', '我想', '其实', '事实上', '说实话',
    '总之', '所以', '因此', '结果', '后来',
    // English
    'i think', 'i believe', 'actually', 'in fact', 'honestly',
    'basically', 'so', 'therefore', 'well',
  ],
  expression: [
    // 中文
    '好开心', '好难过', '好累', '好烦', '太棒了', '太糟了',
    '感觉', '心情', '情绪', '郁闷', '兴奋', '紧张',
    // English
    'i feel', 'i\'m so', 'feeling', 'mood', 'excited', 'nervous',
    'happy', 'sad', 'tired', 'annoyed', 'frustrated',
  ],
  appreciation: [
    // 中文
    '谢谢', '感谢', '太好了', '真棒', '厉害', '不错',
    '做得好', '辛苦了', '多谢', '感激', '太感谢',
    // English
    'thank', 'thanks', 'appreciate', 'great job', 'well done',
    'awesome', 'amazing', 'wonderful', 'good work',
  ],
  complaint: [
    // 中文
    '不行', '不好', '太差', '垃圾', '烦死', '讨厌', '受不了',
    '无语', '崩溃', '抓狂', '气死', '难用', 'bug',
    // English
    'terrible', 'awful', 'bad', 'hate', 'annoying', 'frustrating',
    'sucks', 'worst', 'broken', 'doesn\'t work',
  ],
  agreement: [
    // 中文
    '好的', '没问题', '可以', '行', '对', '是的', '同意',
    '嗯', '好', 'ok', '明白', '了解', '收到', '懂了',
    // English
    'yes', 'yeah', 'ok', 'okay', 'sure', 'alright', 'agreed',
    'right', 'exactly', 'correct', 'indeed', 'got it',
  ],
  disagreement: [
    // 中文
    '不是', '不对', '不行', '不可以', '反对', '不同意',
    '但是', '不过', '然而', '其实不是', '我不觉得',
    // English
    'no', 'nope', 'wrong', 'disagree', 'but', 'however',
    'actually no', 'i don\'t think', 'not really',
  ],
  unknown: [],
};

// 意图对应的情绪影响
const INTENT_EMOTION_INFLUENCE: Record<Intent, Partial<Record<Expression, number>>> = {
  greeting: { happy: 0.15, playful: 0.1 },
  farewell: { grateful: 0.1, loving: 0.1 },
  question: { curious: 0.2, thinking: 0.1 },
  request: { hopeful: 0.1, thinking: 0.05 },
  statement: { thinking: 0.1 },
  expression: {}, // 情感表达由检测结果决定
  appreciation: { grateful: 0.2, happy: 0.15 },
  complaint: { anxious: 0.1, disappointed: 0.1 },
  agreement: { happy: 0.05, relieved: 0.05 },
  disagreement: { thinking: 0.1, determined: 0.1 },
  unknown: {},
};

// 氛围映射：情绪组合 → 氛围
const ATMOSPHERE_DETECTION: Record<Atmosphere, Expression[]> = {
  warm: ['loving', 'grateful', 'happy', 'hopeful'],
  tense: ['anxious', 'fear', 'angry', 'determined'],
  casual: ['happy', 'playful', 'amused', 'curious'],
  serious: ['thinking', 'determined', 'neutral', 'confused'],
  playful: ['playful', 'amused', 'excited', 'happy'],
  melancholy: ['sad', 'lonely', 'disappointed', 'bored'],
  neutral: ['neutral', 'thinking'],
};

// ========== 话题关键词 ==========

// 话题关键词
const TOPIC_KEYWORDS: Record<string, string[]> = {
  work: [
    '工作', '项目', '代码', '开发', '部署', '上线', '会议', '进度',
    'work', 'project', 'code', 'deploy', 'meeting', 'deadline',
    'bug', '修复', '测试', '需求', '文档', '优化', '重构',
  ],
  life: [
    '生活', '吃饭', '睡觉', '休息', '周末', '假期', '旅游',
    'life', 'food', 'sleep', 'rest', 'weekend', 'vacation',
    '电影', '音乐', '游戏', '朋友', '家人', '宠物',
  ],
  emotion: [
    '心情', '感觉', '觉得', '难过', '开心', '担心', '害怕',
    'feel', 'feeling', 'mood', 'sad', 'happy', 'worried',
    '烦', '累', '困', '压力', '焦虑', '孤独', '期待',
  ],
  tech: [
    'AI', '人工智能', '机器学习', '深度学习', '神经网络',
    'API', '数据库', '服务器', '云', '容器', 'Docker',
    'TypeScript', 'JavaScript', 'Python', 'Rust', 'React',
  ],
  creative: [
    '创意', '设计', '艺术', '音乐', '绘画', '写作',
    'design', 'art', 'music', 'creative', 'writing',
    '初音', 'Vtuber', '数字人', '虚拟', '动画',
  ],
};

// 话题对应的默认情绪倾向
const TOPIC_EMOTION_BIAS: Record<string, Partial<Record<Expression, number>>> = {
  work: { thinking: 0.2, determined: 0.1, anxious: 0.1 },
  life: { happy: 0.1, relieved: 0.1, grateful: 0.05 },
  emotion: { empathy: 0.2 }, // 情感话题更敏感
  tech: { curious: 0.15, excited: 0.1, thinking: 0.1 },
  creative: { excited: 0.1, playful: 0.1, happy: 0.1 },
};

// 情绪惯性配置
const EMOTION_INERTIA: Partial<Record<Expression, number>> = {
  // 强烈情绪有更高惯性
  sad: 0.7,
  angry: 0.6,
  fear: 0.5,
  disappointed: 0.6,
  lonely: 0.65,
  
  // 积极情绪中等惯性
  happy: 0.4,
  excited: 0.35,
  loving: 0.5,
  proud: 0.4,
  
  // 中性情绪低惯性
  neutral: 0.2,
  thinking: 0.25,
  curious: 0.3,
};

// ========== 主类 ==========

export class EmotionContextEngine {
  private emotionHistory: EmotionEntry[] = [];
  private conversationTone: ConversationTone;
  private maxHistorySize = 20;
  
  // 回调
  private onToneChangeCallbacks: ((tone: ConversationTone) => void)[] = [];
  private onAtmosphereChangeCallbacks: ((atmosphere: Atmosphere) => void)[] = [];
  
  constructor() {
    this.conversationTone = {
      baseEmotion: 'neutral',
      stability: 0.5,
      topicStack: [],
      lastSignificantEmotion: 'neutral',
      atmosphere: 'neutral',
      engagementLevel: 0.5,
      lastIntent: undefined,
    };
  }
  
  /**
   * 处理新的文本，返回上下文增强后的情绪
   * Round 25: 增加意图识别和氛围检测
   */
  processText(
    text: string,
    detectedEmotion: Expression,
    detectedIntensity: number
  ): { 
    emotion: Expression; 
    intensity: number; 
    influences: EmotionInfluence[];
    intent: Intent;
    atmosphere: Atmosphere;
  } {
    const influences: EmotionInfluence[] = [];
    
    // Round 25: 意图识别
    const intent = this.detectIntent(text);
    this.conversationTone.lastIntent = intent;
    
    // 1. 基础检测结果
    influences.push({
      emotion: detectedEmotion,
      weight: 0.4 + detectedIntensity * 0.2, // 强度越高权重越大
      source: 'detected',
    });
    
    // Round 25: 意图影响情绪
    const intentInfluence = INTENT_EMOTION_INFLUENCE[intent];
    if (intentInfluence) {
      Object.entries(intentInfluence).forEach(([emotion, weight]) => {
        if (weight) {
          influences.push({
            emotion: emotion as Expression,
            weight,
            source: 'context',
          });
        }
      });
    }
    
    // 2. 检测话题
    const topic = this.detectTopic(text);
    if (topic) {
      this.updateTopicStack(topic);
      const topicBias = TOPIC_EMOTION_BIAS[topic];
      if (topicBias) {
        Object.entries(topicBias).forEach(([emotion, bias]) => {
          if (bias) {
            influences.push({
              emotion: emotion as Expression,
              weight: bias,
              source: 'topic',
            });
          }
        });
      }
    }
    
    // 3. 情绪惯性
    const lastEntry = this.getLastEntry();
    if (lastEntry) {
      const inertia = EMOTION_INERTIA[lastEntry.emotion] || 0.3;
      const timeDiff = Date.now() - lastEntry.timestamp;
      const decayFactor = Math.exp(-timeDiff / 30000); // 30秒衰减
      
      if (decayFactor > 0.1) {
        influences.push({
          emotion: lastEntry.emotion,
          weight: inertia * decayFactor * lastEntry.intensity,
          source: 'inertia',
        });
      }
    }
    
    // 4. 对话基调影响
    if (this.conversationTone.stability > 0.3) {
      influences.push({
        emotion: this.conversationTone.baseEmotion,
        weight: this.conversationTone.stability * 0.15,
        source: 'context',
      });
    }
    
    // 5. 计算最终结果
    const result = this.resolveInfluences(influences);
    
    // 6. 更新历史
    this.addEntry({
      emotion: result.emotion,
      intensity: result.intensity,
      timestamp: Date.now(),
      text: text.slice(0, 100), // 只保留前100字符
      topic,
      intent,
    });
    
    // 7. 更新对话基调
    this.updateConversationTone(result.emotion, result.intensity);
    
    // Round 25: 更新氛围和参与度
    this.updateAtmosphere(result.emotion);
    this.updateEngagementLevel(intent, result.intensity);
    
    return { 
      ...result, 
      influences,
      intent,
      atmosphere: this.conversationTone.atmosphere,
    };
  }
  
  /**
   * Round 25: 检测对话意图
   */
  detectIntent(text: string): Intent {
    const lowerText = text.toLowerCase();
    
    // 按优先级检测意图
    const intentPriority: Intent[] = [
      'greeting', 'farewell', 'appreciation', 'complaint',
      'question', 'request', 'expression', 
      'agreement', 'disagreement', 'statement'
    ];
    
    for (const intent of intentPriority) {
      const keywords = INTENT_KEYWORDS[intent];
      for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          return intent;
        }
      }
    }
    
    // 特殊检测：问号结尾
    if (text.trim().endsWith('?') || text.trim().endsWith('？')) {
      return 'question';
    }
    
    return 'unknown';
  }
  
  /**
   * Round 25: 更新对话氛围
   */
  private updateAtmosphere(emotion: Expression) {
    let newAtmosphere: Atmosphere = 'neutral';
    
    // 根据情绪确定氛围
    for (const [atmosphere, emotions] of Object.entries(ATMOSPHERE_DETECTION)) {
      if ((emotions as Expression[]).includes(emotion)) {
        newAtmosphere = atmosphere as Atmosphere;
        break;
      }
    }
    
    // 氛围变化时触发回调
    if (newAtmosphere !== this.conversationTone.atmosphere) {
      const oldAtmosphere = this.conversationTone.atmosphere;
      this.conversationTone.atmosphere = newAtmosphere;
      
      // 触发氛围变化回调
      this.onAtmosphereChangeCallbacks.forEach(cb => cb(newAtmosphere));
      
      console.log(`[EmotionContext] 氛围变化: ${oldAtmosphere} → ${newAtmosphere}`);
    }
  }
  
  /**
   * Round 25: 更新参与度
   */
  private updateEngagementLevel(intent: Intent, intensity: number) {
    // 积极意图增加参与度
    const engagementBoost: Partial<Record<Intent, number>> = {
      greeting: 0.2,
      question: 0.15,
      request: 0.1,
      expression: 0.2,
      appreciation: 0.15,
      complaint: 0.1, // 抱怨也是参与
      farewell: -0.1,
      agreement: 0.05,
      disagreement: 0.1,
    };
    
    const boost = engagementBoost[intent] || 0;
    this.conversationTone.engagementLevel = Math.min(1, Math.max(0,
      this.conversationTone.engagementLevel * 0.9 + boost + intensity * 0.1
    ));
  }
  
  /**
   * 检测文本中的话题
   */
  private detectTopic(text: string): string | undefined {
    const lowerText = text.toLowerCase();
    
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          return topic;
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * 更新话题栈
   */
  private updateTopicStack(topic: string) {
    // 如果是相同话题，增加稳定性
    if (this.conversationTone.topicStack[0] === topic) {
      this.conversationTone.stability = Math.min(1, this.conversationTone.stability + 0.1);
      return;
    }
    
    // 新话题
    this.conversationTone.topicStack.unshift(topic);
    if (this.conversationTone.topicStack.length > 5) {
      this.conversationTone.topicStack.pop();
    }
    
    // 降低稳定性
    this.conversationTone.stability *= 0.8;
  }
  
  /**
   * 解析多个情绪影响，得出最终情绪
   */
  private resolveInfluences(influences: EmotionInfluence[]): {
    emotion: Expression;
    intensity: number;
  } {
    // 按情绪聚合权重
    const emotionWeights = new Map<Expression, number>();
    let totalWeight = 0;
    
    for (const influence of influences) {
      const current = emotionWeights.get(influence.emotion) || 0;
      emotionWeights.set(influence.emotion, current + influence.weight);
      totalWeight += influence.weight;
    }
    
    // 找出最高权重的情绪
    let maxEmotion: Expression = 'neutral';
    let maxWeight = 0;
    
    for (const [emotion, weight] of emotionWeights) {
      if (weight > maxWeight) {
        maxWeight = weight;
        maxEmotion = emotion;
      }
    }
    
    // 计算强度（相对权重）
    const intensity = totalWeight > 0 ? Math.min(1, maxWeight / totalWeight) : 0.5;
    
    return { emotion: maxEmotion, intensity };
  }
  
  /**
   * 更新对话基调
   */
  private updateConversationTone(emotion: Expression, intensity: number) {
    // 只有显著情绪才更新基调
    if (intensity < 0.4) return;
    
    const isSignificantChange = emotion !== this.conversationTone.baseEmotion;
    
    if (isSignificantChange) {
      // 渐变更新基调
      this.conversationTone.stability *= 0.7;
      
      // 如果稳定性降到很低，切换基调
      if (this.conversationTone.stability < 0.3 || intensity > 0.7) {
        this.conversationTone.lastSignificantEmotion = this.conversationTone.baseEmotion;
        this.conversationTone.baseEmotion = emotion;
        this.conversationTone.stability = 0.4 + intensity * 0.3;
        
        // 触发回调
        this.onToneChangeCallbacks.forEach(cb => cb(this.conversationTone));
      }
    } else {
      // 同一情绪，增加稳定性
      this.conversationTone.stability = Math.min(1, this.conversationTone.stability + 0.1);
    }
  }
  
  /**
   * 添加历史记录
   */
  private addEntry(entry: EmotionEntry) {
    this.emotionHistory.unshift(entry);
    if (this.emotionHistory.length > this.maxHistorySize) {
      this.emotionHistory.pop();
    }
  }
  
  /**
   * 获取最近的情绪记录
   */
  private getLastEntry(): EmotionEntry | undefined {
    return this.emotionHistory[0];
  }
  
  /**
   * 获取对话基调
   */
  getConversationTone(): ConversationTone {
    return { ...this.conversationTone };
  }
  
  /**
   * 获取情绪历史
   */
  getEmotionHistory(): EmotionEntry[] {
    return [...this.emotionHistory];
  }
  
  /**
   * 分析情绪趋势
   */
  analyzeEmotionTrend(): {
    dominant: Expression;
    trend: 'improving' | 'declining' | 'stable';
    volatility: number;
  } {
    if (this.emotionHistory.length < 3) {
      return { dominant: 'neutral', trend: 'stable', volatility: 0 };
    }
    
    // 计算主导情绪
    const emotionCounts = new Map<Expression, number>();
    for (const entry of this.emotionHistory.slice(0, 10)) {
      const count = emotionCounts.get(entry.emotion) || 0;
      emotionCounts.set(entry.emotion, count + entry.intensity);
    }
    
    let dominant: Expression = 'neutral';
    let maxCount = 0;
    for (const [emotion, count] of emotionCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominant = emotion;
      }
    }
    
    // 计算趋势（基于情绪效价）
    const valenceMap: Partial<Record<Expression, number>> = {
      happy: 1, excited: 1, loving: 1, grateful: 0.8, proud: 0.8,
      neutral: 0, thinking: 0, curious: 0.3,
      sad: -1, angry: -0.8, fear: -0.7, disappointed: -0.6, lonely: -0.8,
    };
    
    const recentValence = this.emotionHistory.slice(0, 3).reduce((sum, e) => 
      sum + (valenceMap[e.emotion] || 0), 0) / 3;
    const olderValence = this.emotionHistory.slice(3, 6).reduce((sum, e) => 
      sum + (valenceMap[e.emotion] || 0), 0) / Math.min(3, this.emotionHistory.length - 3);
    
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    const diff = recentValence - olderValence;
    if (diff > 0.3) trend = 'improving';
    else if (diff < -0.3) trend = 'declining';
    
    // 计算波动性
    let volatility = 0;
    for (let i = 1; i < Math.min(10, this.emotionHistory.length); i++) {
      if (this.emotionHistory[i].emotion !== this.emotionHistory[i-1].emotion) {
        volatility += 1;
      }
    }
    volatility = volatility / Math.min(10, this.emotionHistory.length);
    
    return { dominant, trend, volatility };
  }
  
  /**
   * 监听基调变化
   */
  onToneChange(callback: (tone: ConversationTone) => void) {
    this.onToneChangeCallbacks.push(callback);
    return () => {
      const idx = this.onToneChangeCallbacks.indexOf(callback);
      if (idx >= 0) this.onToneChangeCallbacks.splice(idx, 1);
    };
  }
  
  /**
   * Round 25: 监听氛围变化
   */
  onAtmosphereChange(callback: (atmosphere: Atmosphere) => void) {
    this.onAtmosphereChangeCallbacks.push(callback);
    return () => {
      const idx = this.onAtmosphereChangeCallbacks.indexOf(callback);
      if (idx >= 0) this.onAtmosphereChangeCallbacks.splice(idx, 1);
    };
  }
  
  /**
   * Round 25: 获取当前氛围
   */
  getAtmosphere(): Atmosphere {
    return this.conversationTone.atmosphere;
  }
  
  /**
   * Round 25: 获取参与度
   */
  getEngagementLevel(): number {
    return this.conversationTone.engagementLevel;
  }
  
  /**
   * Round 25: 获取上一个意图
   */
  getLastIntent(): Intent | undefined {
    return this.conversationTone.lastIntent;
  }
  
  /**
   * Round 25: 生成共情响应建议
   * 根据当前对话状态生成建议的响应情绪
   */
  getSuggestedResponseEmotion(): {
    emotion: Expression;
    reason: string;
  } {
    const tone = this.conversationTone;
    const trend = this.analyzeEmotionTrend();
    
    // 问候时应该开心
    if (tone.lastIntent === 'greeting') {
      return { emotion: 'happy', reason: '回应问候' };
    }
    
    // 告别时应该温馨
    if (tone.lastIntent === 'farewell') {
      return { emotion: 'loving', reason: '温馨告别' };
    }
    
    // 用户表达负面情绪时应该共情
    if (tone.atmosphere === 'melancholy') {
      return { emotion: 'loving', reason: '共情安慰' };
    }
    
    // 用户抱怨时表示理解
    if (tone.lastIntent === 'complaint') {
      return { emotion: 'thinking', reason: '理解倾听' };
    }
    
    // 用户感谢时表示开心
    if (tone.lastIntent === 'appreciation') {
      return { emotion: 'grateful', reason: '感谢回应' };
    }
    
    // 问题时表示好奇/思考
    if (tone.lastIntent === 'question') {
      return { emotion: 'thinking', reason: '认真思考' };
    }
    
    // 趋势下降时提供支持
    if (trend.trend === 'declining') {
      return { emotion: 'hopeful', reason: '提供鼓励' };
    }
    
    // 活泼氛围保持活泼
    if (tone.atmosphere === 'playful') {
      return { emotion: 'playful', reason: '保持活泼' };
    }
    
    // 默认匹配基调
    return { emotion: tone.baseEmotion, reason: '匹配基调' };
  }
  
  /**
   * 重置上下文
   */
  reset() {
    this.emotionHistory = [];
    this.conversationTone = {
      baseEmotion: 'neutral',
      stability: 0.5,
      topicStack: [],
      lastSignificantEmotion: 'neutral',
      atmosphere: 'neutral',
      engagementLevel: 0.5,
      lastIntent: undefined,
    };
  }
  
  /**
   * 获取状态摘要（用于调试）
   * Round 25: 增加氛围和意图信息
   */
  getDebugSummary(): string {
    const trend = this.analyzeEmotionTrend();
    const tone = this.conversationTone;
    return [
      `基调: ${tone.baseEmotion} (稳定性: ${(tone.stability * 100).toFixed(0)}%)`,
      `氛围: ${tone.atmosphere} | 意图: ${tone.lastIntent || '无'}`,
      `话题: ${tone.topicStack[0] || '无'} | 参与: ${(tone.engagementLevel * 100).toFixed(0)}%`,
      `趋势: ${trend.trend} | 波动: ${(trend.volatility * 100).toFixed(0)}%`,
      `历史: ${this.emotionHistory.length} 条`,
    ].join(' | ');
  }
  
  /**
   * Round 25: 获取完整的上下文状态
   */
  getFullContext(): {
    tone: ConversationTone;
    trend: ReturnType<typeof this.analyzeEmotionTrend>;
    recentEmotions: Expression[];
    suggestedResponse: ReturnType<typeof this.getSuggestedResponseEmotion>;
  } {
    const recentEmotions = this.emotionHistory
      .slice(0, 5)
      .map(e => e.emotion);
    
    return {
      tone: this.getConversationTone(),
      trend: this.analyzeEmotionTrend(),
      recentEmotions,
      suggestedResponse: this.getSuggestedResponseEmotion(),
    };
  }
}

// 单例导出
export const emotionContextEngine = new EmotionContextEngine();
