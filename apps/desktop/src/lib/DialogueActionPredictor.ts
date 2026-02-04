/**
 * DialogueActionPredictor - 对话动作预测系统
 * 根据对话内容和上下文预测合适的动作
 */

export interface DialogueTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ActionPrediction {
  action: PredictedAction;
  confidence: number;  // 0-1
  timing: ActionTiming;
  reason: string;
}

export type PredictedAction =
  | 'nod'           // 点头
  | 'shake_head'    // 摇头
  | 'tilt_head'     // 歪头
  | 'wave'          // 挥手
  | 'bow'           // 鞠躬
  | 'clap'          // 鼓掌
  | 'think'         // 思考
  | 'point'         // 指向
  | 'shrug'         // 耸肩
  | 'celebrate'     // 庆祝
  | 'comfort'       // 安慰
  | 'listen'        // 聆听
  | 'explain'       // 解释
  | 'greet'         // 问候
  | 'farewell'      // 告别
  | 'none';         // 无动作

export interface ActionTiming {
  delay: number;      // 延迟 (ms)
  duration: number;   // 持续时间 (ms)
  interruptible: boolean;
}

export interface DialoguePattern {
  pattern: RegExp;
  action: PredictedAction;
  confidence: number;
  timing: Partial<ActionTiming>;
  description: string;
}

export interface PredictorConfig {
  historyWindow: number;      // 考虑的对话轮数
  minConfidence: number;      // 最小置信度阈值
  defaultTiming: ActionTiming;
}

type PredictionCallback = (prediction: ActionPrediction) => void;

export class DialogueActionPredictor {
  private static instance: DialogueActionPredictor | null = null;
  
  private patterns: DialoguePattern[] = [];
  private history: DialogueTurn[] = [];
  private callbacks: Set<PredictionCallback> = new Set();
  private lastPrediction: ActionPrediction | null = null;
  
  private config: PredictorConfig = {
    historyWindow: 5,
    minConfidence: 0.3,
    defaultTiming: {
      delay: 100,
      duration: 500,
      interruptible: true,
    },
  };

  private constructor() {
    this.initializePatterns();
  }

  static getInstance(): DialogueActionPredictor {
    if (!DialogueActionPredictor.instance) {
      DialogueActionPredictor.instance = new DialogueActionPredictor();
    }
    return DialogueActionPredictor.instance;
  }

  /**
   * 初始化对话模式
   */
  private initializePatterns(): void {
    // 问候
    this.patterns.push({
      pattern: /^(你好|嗨|hi|hello|早上好|晚上好|下午好|hey|哈喽)/i,
      action: 'greet',
      confidence: 0.9,
      timing: { delay: 0, duration: 600 },
      description: '问候语触发挥手/鞠躬',
    });

    // 告别
    this.patterns.push({
      pattern: /(再见|拜拜|bye|goodbye|晚安|明天见|下次见|see you)/i,
      action: 'farewell',
      confidence: 0.9,
      timing: { delay: 0, duration: 800 },
      description: '告别语触发挥手',
    });

    // 感谢
    this.patterns.push({
      pattern: /(谢谢|感谢|thanks|thank you|多谢|thx)/i,
      action: 'bow',
      confidence: 0.8,
      timing: { delay: 200, duration: 500 },
      description: '感谢语触发鞠躬',
    });

    // 不知道/耸肩 (放在否定前面，优先匹配更具体的)
    this.patterns.push({
      pattern: /(不知道|不清楚|不确定|可能吧|也许|i don't know|not sure|idk)/i,
      action: 'shrug',
      confidence: 0.8,
      timing: { delay: 100, duration: 500 },
      description: '不确定语触发耸肩',
    });

    // 肯定/同意
    this.patterns.push({
      pattern: /^(好的|可以|没问题|当然|是的|对的|嗯嗯|ok|okay|sure|yes)$/i,
      action: 'nod',
      confidence: 0.7,
      timing: { delay: 100, duration: 400 },
      description: '肯定语触发点头',
    });

    // 否定 (使用更精确的模式)
    this.patterns.push({
      pattern: /^(不|不行|不是|不对|no|nope|不可以|别|没有)$/i,
      action: 'shake_head',
      confidence: 0.75,
      timing: { delay: 100, duration: 400 },
      description: '否定语触发摇头',
    });

    // 疑问/不确定
    this.patterns.push({
      pattern: /(什么|怎么|为什么|哪里|谁|吗\?|呢\?|\?$|嗯\?|真的吗)/i,
      action: 'tilt_head',
      confidence: 0.6,
      timing: { delay: 50, duration: 600 },
      description: '疑问触发歪头',
    });

    // 思考
    this.patterns.push({
      pattern: /(让我想想|想一下|嗯.{0,3}|思考|考虑|分析|let me think|thinking)/i,
      action: 'think',
      confidence: 0.8,
      timing: { delay: 0, duration: 1000 },
      description: '思考语触发思考动作',
    });

    // 解释/说明
    this.patterns.push({
      pattern: /(首先|其次|然后|接下来|因为|所以|这是因为|简单来说|具体来说)/i,
      action: 'explain',
      confidence: 0.6,
      timing: { delay: 200, duration: 800 },
      description: '解释性语言触发解释动作',
    });

    // 庆祝/赞美
    this.patterns.push({
      pattern: /(太棒了|恭喜|厉害|amazing|awesome|great|wonderful|好厉害|太好了|成功)/i,
      action: 'celebrate',
      confidence: 0.85,
      timing: { delay: 0, duration: 800 },
      description: '庆祝语触发庆祝动作',
    });

    // 安慰
    this.patterns.push({
      pattern: /(没关系|别担心|别难过|加油|会好的|别伤心|不要紧|it's ok|don't worry)/i,
      action: 'comfort',
      confidence: 0.75,
      timing: { delay: 100, duration: 600 },
      description: '安慰语触发安慰动作',
    });

    // (shrug 已在前面定义)

    // 指向/展示
    this.patterns.push({
      pattern: /(看这里|这个|那个|就是这样|就像这样|比如说|例如)/i,
      action: 'point',
      confidence: 0.65,
      timing: { delay: 50, duration: 600 },
      description: '指示语触发指向动作',
    });

    // 聆听
    this.patterns.push({
      pattern: /(我在听|说吧|继续|然后呢|go on|tell me more|请说)/i,
      action: 'listen',
      confidence: 0.6,
      timing: { delay: 0, duration: 1200 },
      description: '聆听语触发聆听姿势',
    });

    // 鼓掌
    this.patterns.push({
      pattern: /(鼓掌|👏|掌声|applause|clap)/i,
      action: 'clap',
      confidence: 0.95,
      timing: { delay: 0, duration: 1000 },
      description: '鼓掌语触发鼓掌',
    });

    // 挥手
    this.patterns.push({
      pattern: /(挥手|👋|wave|嘿嘿)/i,
      action: 'wave',
      confidence: 0.9,
      timing: { delay: 0, duration: 600 },
      description: '挥手语触发挥手',
    });
  }

  /**
   * 添加对话轮次
   */
  addTurn(role: 'user' | 'assistant', content: string): ActionPrediction | null {
    const turn: DialogueTurn = {
      role,
      content,
      timestamp: Date.now(),
    };

    this.history.push(turn);

    // 限制历史大小
    if (this.history.length > this.config.historyWindow * 2) {
      this.history.shift();
    }

    // 预测动作
    const prediction = this.predict(content, role);
    
    if (prediction && prediction.confidence >= this.config.minConfidence) {
      this.lastPrediction = prediction;
      this.notifyPrediction(prediction);
      return prediction;
    }

    return null;
  }

  /**
   * 预测动作
   */
  predict(content: string, role: 'user' | 'assistant'): ActionPrediction | null {
    let bestMatch: ActionPrediction | null = null;
    let bestConfidence = 0;

    for (const pattern of this.patterns) {
      if (pattern.pattern.test(content)) {
        // 根据角色调整置信度
        let adjustedConfidence = pattern.confidence;
        
        // assistant 的回复动作置信度稍低（更自然）
        if (role === 'assistant') {
          adjustedConfidence *= 0.9;
        }

        // 考虑对话上下文
        adjustedConfidence *= this.getContextBonus(pattern.action);

        if (adjustedConfidence > bestConfidence) {
          bestConfidence = adjustedConfidence;
          bestMatch = {
            action: pattern.action,
            confidence: adjustedConfidence,
            timing: {
              ...this.config.defaultTiming,
              ...pattern.timing,
            },
            reason: pattern.description,
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * 根据上下文计算加成
   */
  private getContextBonus(action: PredictedAction): number {
    if (this.history.length < 2) return 1.0;

    const recentTurns = this.history.slice(-3);
    let bonus = 1.0;

    // 避免连续相同动作
    if (this.lastPrediction?.action === action) {
      bonus *= 0.5;
    }

    // 对话开始时增加问候动作权重
    if (this.history.length <= 2 && (action === 'greet' || action === 'wave')) {
      bonus *= 1.3;
    }

    // 长对话后增加聆听动作权重
    if (this.history.length > 6 && action === 'listen') {
      bonus *= 1.2;
    }

    return bonus;
  }

  /**
   * 获取对话历史
   */
  getHistory(): DialogueTurn[] {
    return [...this.history];
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.history = [];
    this.lastPrediction = null;
  }

  /**
   * 获取最后的预测
   */
  getLastPrediction(): ActionPrediction | null {
    return this.lastPrediction ? { ...this.lastPrediction } : null;
  }

  /**
   * 添加自定义模式
   */
  addPattern(pattern: DialoguePattern): void {
    this.patterns.push(pattern);
  }

  /**
   * 移除模式
   */
  removePattern(action: PredictedAction): boolean {
    const index = this.patterns.findIndex(p => p.action === action);
    if (index >= 0) {
      this.patterns.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 获取所有模式
   */
  getPatterns(): DialoguePattern[] {
    return this.patterns.map(p => ({ ...p }));
  }

  /**
   * 获取模式数量
   */
  getPatternCount(): number {
    return this.patterns.length;
  }

  /**
   * 订阅预测事件
   */
  onPrediction(callback: PredictionCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 通知预测
   */
  private notifyPrediction(prediction: ActionPrediction): void {
    this.callbacks.forEach(cb => {
      try {
        cb(prediction);
      } catch (e) {
        console.error('[DialogueActionPredictor] Callback error:', e);
      }
    });
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<PredictorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): PredictorConfig {
    return { ...this.config };
  }

  /**
   * 批量预测
   */
  predictBatch(contents: string[]): ActionPrediction[] {
    return contents
      .map(content => this.predict(content, 'assistant'))
      .filter((p): p is ActionPrediction => p !== null);
  }

  /**
   * 获取动作的默认时机
   */
  getActionTiming(action: PredictedAction): ActionTiming {
    const pattern = this.patterns.find(p => p.action === action);
    return {
      ...this.config.defaultTiming,
      ...(pattern?.timing || {}),
    };
  }

  /**
   * 重置
   */
  reset(): void {
    this.history = [];
    this.lastPrediction = null;
    this.patterns = [];
    this.initializePatterns();
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.patterns = [];
    this.history = [];
    this.callbacks.clear();
    this.lastPrediction = null;
    DialogueActionPredictor.instance = null;
  }
}

export const dialogueActionPredictor = DialogueActionPredictor.getInstance();
