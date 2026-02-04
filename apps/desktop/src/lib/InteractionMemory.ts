/**
 * InteractionMemory - 交互记忆系统
 * 
 * 记录用户与 Avatar 的交互历史，用于：
 * 1. 情绪趋势分析
 * 2. 偏好学习
 * 3. 个性化响应
 * 4. 会话连续性
 */

export interface InteractionRecord {
  id: string;
  timestamp: number;
  type: InteractionType;
  data: InteractionData;
  emotion?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export type InteractionType = 
  | 'message_sent'       // 用户发送消息
  | 'message_received'   // 收到 AI 回复
  | 'expression_change'  // 表情变化
  | 'gesture_detected'   // 手势检测
  | 'voice_input'        // 语音输入
  | 'head_tracking'      // 头部追踪
  | 'preference_set'     // 偏好设置
  | 'session_start'      // 会话开始
  | 'session_end';       // 会话结束

export interface InteractionData {
  text?: string;
  expression?: string;
  gesture?: string;
  emotion?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface EmotionTrend {
  emotion: string;
  count: number;
  percentage: number;
  recentTrend: 'rising' | 'falling' | 'stable';
}

export interface UserPreferences {
  preferredExpressions: string[];
  interactionStyle: 'verbose' | 'concise' | 'mixed';
  emotionalTendency: string;
  activeHours: number[];  // 0-23
  averageSessionDuration: number;  // ms
}

export interface SessionSummary {
  sessionId: string;
  startTime: number;
  endTime: number | null;
  messageCount: number;
  dominantEmotion: string;
  expressionsUsed: string[];
  interactionCount: number;
}

export interface MemoryConfig {
  maxRecords: number;
  persistToStorage: boolean;
  storageKey: string;
  analysisWindow: number;  // ms, 分析时间窗口
}

type MemoryCallback = (record: InteractionRecord) => void;

export class InteractionMemory {
  private config: MemoryConfig;
  private records: InteractionRecord[];
  private currentSession: SessionSummary | null;
  private callbacks: Set<MemoryCallback>;

  constructor(config?: Partial<MemoryConfig>) {
    this.config = {
      maxRecords: 1000,
      persistToStorage: true,
      storageKey: 'openclaw-avatar-memory',
      analysisWindow: 24 * 60 * 60 * 1000,  // 24 小时
      ...config
    };
    
    this.records = [];
    this.currentSession = null;
    this.callbacks = new Set();
    
    // 从存储加载
    if (this.config.persistToStorage) {
      this.loadFromStorage();
    }
  }

  /**
   * 记录交互
   */
  record(type: InteractionType, data: InteractionData, metadata?: Record<string, unknown>): InteractionRecord {
    const record: InteractionRecord = {
      id: this.generateId(),
      timestamp: Date.now(),
      type,
      data,
      emotion: data.emotion,
      duration: data.duration,
      metadata
    };
    
    this.records.push(record);
    this.enforceMaxRecords();
    
    // 更新会话统计
    if (this.currentSession) {
      this.currentSession.interactionCount++;
      if (type === 'message_sent' || type === 'message_received') {
        this.currentSession.messageCount++;
      }
      if (data.expression) {
        if (!this.currentSession.expressionsUsed.includes(data.expression)) {
          this.currentSession.expressionsUsed.push(data.expression);
        }
      }
    }
    
    // 持久化
    if (this.config.persistToStorage) {
      this.saveToStorage();
    }
    
    // 通知订阅者
    this.notifyCallbacks(record);
    
    return record;
  }

  /**
   * 开始新会话
   */
  startSession(): SessionSummary {
    const session: SessionSummary = {
      sessionId: this.generateId(),
      startTime: Date.now(),
      endTime: null,
      messageCount: 0,
      dominantEmotion: 'neutral',
      expressionsUsed: [],
      interactionCount: 0
    };
    
    this.currentSession = session;
    
    this.record('session_start', { 
      sessionId: session.sessionId 
    });
    
    return session;
  }

  /**
   * 结束当前会话
   */
  endSession(): SessionSummary | null {
    if (!this.currentSession) return null;
    
    this.currentSession.endTime = Date.now();
    this.currentSession.dominantEmotion = this.getDominantEmotionInSession();
    
    this.record('session_end', {
      sessionId: this.currentSession.sessionId,
      duration: this.currentSession.endTime - this.currentSession.startTime
    });
    
    const session = this.currentSession;
    this.currentSession = null;
    
    return session;
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): SessionSummary | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * 获取情绪趋势
   */
  getEmotionTrends(windowMs?: number): EmotionTrend[] {
    const window = windowMs || this.config.analysisWindow;
    const cutoff = Date.now() - window;
    
    // 筛选时间窗口内的记录
    const recentRecords = this.records.filter(r => r.timestamp >= cutoff && r.emotion);
    
    // 统计情绪频率
    const emotionCounts = new Map<string, number>();
    for (const record of recentRecords) {
      if (record.emotion) {
        emotionCounts.set(record.emotion, (emotionCounts.get(record.emotion) || 0) + 1);
      }
    }
    
    const total = recentRecords.length || 1;
    const trends: EmotionTrend[] = [];
    
    // 计算前半部分和后半部分的趋势
    const midpoint = cutoff + window / 2;
    const firstHalf = recentRecords.filter(r => r.timestamp < midpoint);
    const secondHalf = recentRecords.filter(r => r.timestamp >= midpoint);
    
    for (const [emotion, count] of emotionCounts) {
      const firstHalfCount = firstHalf.filter(r => r.emotion === emotion).length;
      const secondHalfCount = secondHalf.filter(r => r.emotion === emotion).length;
      
      let recentTrend: 'rising' | 'falling' | 'stable' = 'stable';
      if (secondHalfCount > firstHalfCount * 1.2) {
        recentTrend = 'rising';
      } else if (secondHalfCount < firstHalfCount * 0.8) {
        recentTrend = 'falling';
      }
      
      trends.push({
        emotion,
        count,
        percentage: (count / total) * 100,
        recentTrend
      });
    }
    
    // 按频率排序
    return trends.sort((a, b) => b.count - a.count);
  }

  /**
   * 获取用户偏好
   */
  getUserPreferences(): UserPreferences {
    const recentRecords = this.getRecentRecords();
    
    // 分析表情偏好
    const expressionCounts = new Map<string, number>();
    for (const record of recentRecords) {
      if (record.data.expression) {
        expressionCounts.set(
          record.data.expression, 
          (expressionCounts.get(record.data.expression) || 0) + 1
        );
      }
    }
    
    const preferredExpressions = Array.from(expressionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([expr]) => expr);
    
    // 分析交互风格
    const messages = recentRecords.filter(r => r.type === 'message_sent');
    const avgLength = messages.length > 0
      ? messages.reduce((sum, r) => sum + (r.data.text?.length || 0), 0) / messages.length
      : 0;
    
    let interactionStyle: 'verbose' | 'concise' | 'mixed' = 'mixed';
    if (avgLength > 100) interactionStyle = 'verbose';
    else if (avgLength < 30) interactionStyle = 'concise';
    
    // 分析情绪倾向
    const trends = this.getEmotionTrends();
    const emotionalTendency = trends[0]?.emotion || 'neutral';
    
    // 分析活跃时间
    const hourCounts = new Array(24).fill(0);
    for (const record of recentRecords) {
      const hour = new Date(record.timestamp).getHours();
      hourCounts[hour]++;
    }
    const maxHourCount = Math.max(...hourCounts);
    const activeHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(({ count }) => count > maxHourCount * 0.5)
      .map(({ hour }) => hour);
    
    // 计算平均会话时长
    const sessions = this.getSessionRecords();
    const sessionDurations = sessions
      .filter(s => s.data.duration && typeof s.data.duration === 'number')
      .map(s => s.data.duration as number);
    const averageSessionDuration = sessionDurations.length > 0
      ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
      : 0;
    
    return {
      preferredExpressions,
      interactionStyle,
      emotionalTendency,
      activeHours,
      averageSessionDuration
    };
  }

  /**
   * 搜索记录
   */
  search(query: {
    type?: InteractionType;
    emotion?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): InteractionRecord[] {
    let results = [...this.records];
    
    if (query.type) {
      results = results.filter(r => r.type === query.type);
    }
    if (query.emotion) {
      results = results.filter(r => r.emotion === query.emotion);
    }
    if (query.startTime) {
      results = results.filter(r => r.timestamp >= query.startTime!);
    }
    if (query.endTime) {
      results = results.filter(r => r.timestamp <= query.endTime!);
    }
    
    // 按时间倒序
    results.sort((a, b) => b.timestamp - a.timestamp);
    
    if (query.limit) {
      results = results.slice(0, query.limit);
    }
    
    return results;
  }

  /**
   * 获取最近的记录
   */
  getRecentRecords(limit: number = 100): InteractionRecord[] {
    return [...this.records]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * 获取所有记录数量
   */
  getRecordCount(): number {
    return this.records.length;
  }

  /**
   * 清除所有记录
   */
  clear(): void {
    this.records = [];
    this.currentSession = null;
    if (this.config.persistToStorage) {
      this.clearStorage();
    }
  }

  /**
   * 订阅新记录
   */
  onRecord(callback: MemoryCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<MemoryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): MemoryConfig {
    return { ...this.config };
  }

  /**
   * 导出数据
   */
  export(): { records: InteractionRecord[]; config: MemoryConfig } {
    return {
      records: [...this.records],
      config: { ...this.config }
    };
  }

  /**
   * 导入数据
   */
  import(data: { records: InteractionRecord[] }): void {
    this.records = [...data.records];
    this.enforceMaxRecords();
    if (this.config.persistToStorage) {
      this.saveToStorage();
    }
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.callbacks.clear();
    this.records = [];
    this.currentSession = null;
  }

  // 私有方法

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private enforceMaxRecords(): void {
    if (this.records.length > this.config.maxRecords) {
      this.records = this.records.slice(-this.config.maxRecords);
    }
  }

  private getDominantEmotionInSession(): string {
    if (!this.currentSession) return 'neutral';
    
    const sessionStart = this.currentSession.startTime;
    const sessionRecords = this.records.filter(
      r => r.timestamp >= sessionStart && r.emotion
    );
    
    const emotionCounts = new Map<string, number>();
    for (const record of sessionRecords) {
      if (record.emotion) {
        emotionCounts.set(record.emotion, (emotionCounts.get(record.emotion) || 0) + 1);
      }
    }
    
    let dominant = 'neutral';
    let maxCount = 0;
    for (const [emotion, count] of emotionCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominant = emotion;
      }
    }
    
    return dominant;
  }

  private getSessionRecords(): InteractionRecord[] {
    return this.records.filter(r => r.type === 'session_end');
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const data = localStorage.getItem(this.config.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed.records)) {
          this.records = parsed.records;
        }
      }
    } catch (e) {
      console.error('[InteractionMemory] Failed to load from storage:', e);
    }
  }

  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const data = JSON.stringify({ records: this.records });
      localStorage.setItem(this.config.storageKey, data);
    } catch (e) {
      console.error('[InteractionMemory] Failed to save to storage:', e);
    }
  }

  private clearStorage(): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      localStorage.removeItem(this.config.storageKey);
    } catch (e) {
      console.error('[InteractionMemory] Failed to clear storage:', e);
    }
  }

  private notifyCallbacks(record: InteractionRecord): void {
    for (const callback of this.callbacks) {
      try {
        callback(record);
      } catch (e) {
        console.error('[InteractionMemory] Callback error:', e);
      }
    }
  }
}

// 单例导出
export const interactionMemory = new InteractionMemory();
