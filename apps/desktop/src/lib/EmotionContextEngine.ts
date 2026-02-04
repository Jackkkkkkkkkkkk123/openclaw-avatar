/**
 * Emotion Context Engine - 情绪上下文引擎
 * 
 * SOTA Round 6: 情绪上下文系统
 * 
 * 功能:
 * - 对话情感基调追踪
 * - 情绪惯性（避免突兀切换）
 * - 对话主题识别
 * - 情绪历史分析
 * - 语境增强的情绪检测
 * 
 * 解决问题:
 * - 悲伤对话中说"好的"不应该立刻变中性
 * - 开心聊天中突然说"累了"应该渐变
 * - 同一话题内情绪应该保持连贯
 */

import type { Expression } from './AvatarController';

// ========== 类型定义 ==========

export interface EmotionEntry {
  emotion: Expression;
  intensity: number;       // 0-1
  timestamp: number;
  text: string;
  topic?: string;
}

export interface ConversationTone {
  baseEmotion: Expression;     // 对话基调情绪
  stability: number;           // 基调稳定性 0-1
  topicStack: string[];        // 话题栈
  lastSignificantEmotion: Expression;  // 上一个显著情绪
}

export interface EmotionInfluence {
  emotion: Expression;
  weight: number;         // 影响权重
  source: 'detected' | 'context' | 'inertia' | 'topic';
}

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
  
  constructor() {
    this.conversationTone = {
      baseEmotion: 'neutral',
      stability: 0.5,
      topicStack: [],
      lastSignificantEmotion: 'neutral',
    };
  }
  
  /**
   * 处理新的文本，返回上下文增强后的情绪
   */
  processText(
    text: string,
    detectedEmotion: Expression,
    detectedIntensity: number
  ): { 
    emotion: Expression; 
    intensity: number; 
    influences: EmotionInfluence[] 
  } {
    const influences: EmotionInfluence[] = [];
    
    // 1. 基础检测结果
    influences.push({
      emotion: detectedEmotion,
      weight: 0.4 + detectedIntensity * 0.2, // 强度越高权重越大
      source: 'detected',
    });
    
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
    });
    
    // 7. 更新对话基调
    this.updateConversationTone(result.emotion, result.intensity);
    
    return { ...result, influences };
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
   * 重置上下文
   */
  reset() {
    this.emotionHistory = [];
    this.conversationTone = {
      baseEmotion: 'neutral',
      stability: 0.5,
      topicStack: [],
      lastSignificantEmotion: 'neutral',
    };
  }
  
  /**
   * 获取状态摘要（用于调试）
   */
  getDebugSummary(): string {
    const trend = this.analyzeEmotionTrend();
    return [
      `基调: ${this.conversationTone.baseEmotion} (稳定性: ${(this.conversationTone.stability * 100).toFixed(0)}%)`,
      `话题: ${this.conversationTone.topicStack[0] || '无'}`,
      `趋势: ${trend.trend} | 波动: ${(trend.volatility * 100).toFixed(0)}%`,
      `历史: ${this.emotionHistory.length} 条`,
    ].join(' | ');
  }
}

// 单例导出
export const emotionContextEngine = new EmotionContextEngine();
