/**
 * ExpressionPaletteSystem - 表情调色板系统
 * 
 * 允许多个表情以不同权重同时激活，创造自然的复合表情
 * 类似画家调色板，可以混合多种"颜色"（表情）
 */

export interface ExpressionWeight {
  expression: string;
  weight: number;  // 0-1
  priority?: number;  // 优先级，用于冲突解决
}

export interface PalettePreset {
  name: string;
  description: string;
  expressions: ExpressionWeight[];
  transitionTime?: number;  // ms
}

export interface BlendResult {
  finalWeights: Map<string, number>;
  conflicts: string[];  // 冲突的表情
  totalWeight: number;
}

export interface PaletteConfig {
  maxConcurrentExpressions: number;  // 最大同时激活的表情数
  autoNormalize: boolean;  // 自动归一化权重
  conflictResolution: 'priority' | 'blend' | 'latest';
  smoothTransition: boolean;
  transitionSpeed: number;  // 0-1, 每帧变化量
}

type PaletteCallback = (result: BlendResult) => void;

// 预设的复合表情
const DEFAULT_PRESETS: PalettePreset[] = [
  {
    name: 'bittersweet',
    description: '苦涩的笑 - 开心中带着悲伤',
    expressions: [
      { expression: 'happy', weight: 0.4 },
      { expression: 'sad', weight: 0.3 }
    ],
    transitionTime: 500
  },
  {
    name: 'nervous_smile',
    description: '紧张的笑 - 尴尬但试图友好',
    expressions: [
      { expression: 'happy', weight: 0.5 },
      { expression: 'surprised', weight: 0.2 },
      { expression: 'shy', weight: 0.3 }
    ],
    transitionTime: 400
  },
  {
    name: 'tearful_joy',
    description: '喜极而泣',
    expressions: [
      { expression: 'happy', weight: 0.7 },
      { expression: 'sad', weight: 0.2 },
      { expression: 'surprised', weight: 0.1 }
    ],
    transitionTime: 600
  },
  {
    name: 'angry_disappointed',
    description: '愤怒又失望',
    expressions: [
      { expression: 'angry', weight: 0.5 },
      { expression: 'sad', weight: 0.4 }
    ],
    transitionTime: 500
  },
  {
    name: 'curious_excited',
    description: '好奇又兴奋',
    expressions: [
      { expression: 'surprised', weight: 0.4 },
      { expression: 'happy', weight: 0.4 },
      { expression: 'thinking', weight: 0.2 }
    ],
    transitionTime: 400
  },
  {
    name: 'shy_happy',
    description: '害羞但开心',
    expressions: [
      { expression: 'shy', weight: 0.5 },
      { expression: 'happy', weight: 0.4 }
    ],
    transitionTime: 500
  },
  {
    name: 'suspicious',
    description: '怀疑、狐疑',
    expressions: [
      { expression: 'thinking', weight: 0.4 },
      { expression: 'angry', weight: 0.2 },
      { expression: 'neutral', weight: 0.3 }
    ],
    transitionTime: 600
  },
  {
    name: 'smug',
    description: '得意洋洋',
    expressions: [
      { expression: 'happy', weight: 0.6 },
      { expression: 'confident', weight: 0.3 }
    ],
    transitionTime: 400
  }
];

// 表情冲突矩阵 - 某些表情同时出现会很奇怪
const EXPRESSION_CONFLICTS: Record<string, string[]> = {
  happy: ['sad', 'angry', 'fear'],
  sad: ['happy', 'confident'],
  angry: ['happy', 'shy', 'fear'],
  surprised: [],  // 惊讶可以和任何表情组合
  fear: ['happy', 'angry', 'confident'],
  thinking: [],
  shy: ['angry', 'confident'],
  confident: ['sad', 'fear', 'shy']
};

export class ExpressionPaletteSystem {
  private config: PaletteConfig;
  private currentExpressions: Map<string, ExpressionWeight>;
  private targetExpressions: Map<string, ExpressionWeight>;
  private presets: Map<string, PalettePreset>;
  private callbacks: Set<PaletteCallback>;
  private animationFrame: number | null = null;
  private isTransitioning: boolean = false;

  constructor(config?: Partial<PaletteConfig>) {
    this.config = {
      maxConcurrentExpressions: 4,
      autoNormalize: true,
      conflictResolution: 'blend',
      smoothTransition: true,
      transitionSpeed: 0.1,
      ...config
    };
    
    this.currentExpressions = new Map();
    this.targetExpressions = new Map();
    this.presets = new Map();
    this.callbacks = new Set();
    
    // 加载默认预设
    for (const preset of DEFAULT_PRESETS) {
      this.presets.set(preset.name, preset);
    }
  }

  /**
   * 设置单个表情权重
   */
  setExpression(expression: string, weight: number, priority: number = 0): void {
    if (weight <= 0) {
      this.targetExpressions.delete(expression);
    } else {
      this.targetExpressions.set(expression, { 
        expression, 
        weight: Math.min(1, Math.max(0, weight)),
        priority 
      });
    }
    
    this.enforceMaxExpressions();
    
    if (this.config.smoothTransition) {
      this.startTransition();
    } else {
      this.applyImmediately();
    }
  }

  /**
   * 设置多个表情
   */
  setExpressions(expressions: ExpressionWeight[]): void {
    this.targetExpressions.clear();
    for (const exp of expressions) {
      if (exp.weight > 0) {
        this.targetExpressions.set(exp.expression, {
          ...exp,
          weight: Math.min(1, Math.max(0, exp.weight))
        });
      }
    }
    
    this.enforceMaxExpressions();
    
    if (this.config.smoothTransition) {
      this.startTransition();
    } else {
      this.applyImmediately();
    }
  }

  /**
   * 应用预设
   */
  applyPreset(presetName: string): boolean {
    const preset = this.presets.get(presetName);
    if (!preset) return false;
    
    this.setExpressions(preset.expressions);
    return true;
  }

  /**
   * 获取所有预设
   */
  getPresets(): PalettePreset[] {
    return Array.from(this.presets.values());
  }

  /**
   * 添加自定义预设
   */
  addPreset(preset: PalettePreset): void {
    this.presets.set(preset.name, preset);
  }

  /**
   * 删除预设
   */
  removePreset(name: string): boolean {
    return this.presets.delete(name);
  }

  /**
   * 获取当前混合结果
   */
  getBlendResult(): BlendResult {
    const finalWeights = new Map<string, number>();
    const conflicts: string[] = [];
    let totalWeight = 0;
    
    // 收集所有表情
    for (const [expr, data] of this.currentExpressions) {
      finalWeights.set(expr, data.weight);
      totalWeight += data.weight;
    }
    
    // 检测冲突
    const expressions = Array.from(finalWeights.keys());
    for (const expr of expressions) {
      const conflictingWith = EXPRESSION_CONFLICTS[expr] || [];
      for (const conflict of conflictingWith) {
        if (finalWeights.has(conflict)) {
          const conflictKey = [expr, conflict].sort().join('+');
          if (!conflicts.includes(conflictKey)) {
            conflicts.push(conflictKey);
          }
        }
      }
    }
    
    // 处理冲突
    if (conflicts.length > 0 && this.config.conflictResolution === 'priority') {
      this.resolveConflictsByPriority(finalWeights);
    }
    
    // 归一化
    if (this.config.autoNormalize && totalWeight > 1) {
      for (const [expr, weight] of finalWeights) {
        finalWeights.set(expr, weight / totalWeight);
      }
      totalWeight = 1;
    }
    
    return { finalWeights, conflicts, totalWeight };
  }

  /**
   * 清除所有表情
   */
  clear(): void {
    this.targetExpressions.clear();
    if (this.config.smoothTransition) {
      this.startTransition();
    } else {
      this.currentExpressions.clear();
      this.notifyCallbacks();
    }
  }

  /**
   * 订阅变化
   */
  onChange(callback: PaletteCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PaletteConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): PaletteConfig {
    return { ...this.config };
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.callbacks.clear();
    this.currentExpressions.clear();
    this.targetExpressions.clear();
  }

  // 私有方法

  private enforceMaxExpressions(): void {
    if (this.targetExpressions.size <= this.config.maxConcurrentExpressions) {
      return;
    }
    
    // 按优先级和权重排序，移除多余的
    const sorted = Array.from(this.targetExpressions.entries())
      .sort((a, b) => {
        const priorityDiff = (b[1].priority || 0) - (a[1].priority || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return b[1].weight - a[1].weight;
      });
    
    this.targetExpressions.clear();
    for (let i = 0; i < this.config.maxConcurrentExpressions; i++) {
      const [expr, data] = sorted[i];
      this.targetExpressions.set(expr, data);
    }
  }

  private resolveConflictsByPriority(weights: Map<string, number>): void {
    const expressions = Array.from(weights.keys());
    
    for (const expr of expressions) {
      const conflictingWith = EXPRESSION_CONFLICTS[expr] || [];
      for (const conflict of conflictingWith) {
        if (!weights.has(conflict)) continue;
        
        const exprData = this.currentExpressions.get(expr);
        const conflictData = this.currentExpressions.get(conflict);
        
        const exprPriority = exprData?.priority || 0;
        const conflictPriority = conflictData?.priority || 0;
        
        // 移除低优先级的
        if (exprPriority > conflictPriority) {
          weights.delete(conflict);
        } else if (conflictPriority > exprPriority) {
          weights.delete(expr);
        }
        // 优先级相同时保留两个（blend 模式）
      }
    }
  }

  private startTransition(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.animateTransition();
  }

  private animateTransition(): void {
    const speed = this.config.transitionSpeed;
    let hasChanges = false;
    
    // 更新现有表情
    for (const [expr, current] of this.currentExpressions) {
      const target = this.targetExpressions.get(expr);
      const targetWeight = target?.weight || 0;
      
      if (Math.abs(current.weight - targetWeight) > 0.001) {
        hasChanges = true;
        const diff = targetWeight - current.weight;
        current.weight += diff * speed;
        
        if (current.weight < 0.01) {
          this.currentExpressions.delete(expr);
        }
      }
    }
    
    // 添加新表情
    for (const [expr, target] of this.targetExpressions) {
      if (!this.currentExpressions.has(expr)) {
        hasChanges = true;
        this.currentExpressions.set(expr, { 
          expression: expr, 
          weight: target.weight * speed,
          priority: target.priority
        });
      }
    }
    
    this.notifyCallbacks();
    
    if (hasChanges) {
      this.animationFrame = requestAnimationFrame(() => this.animateTransition());
    } else {
      this.isTransitioning = false;
      this.animationFrame = null;
    }
  }

  private applyImmediately(): void {
    this.currentExpressions.clear();
    for (const [expr, data] of this.targetExpressions) {
      this.currentExpressions.set(expr, { ...data });
    }
    this.notifyCallbacks();
  }

  private notifyCallbacks(): void {
    const result = this.getBlendResult();
    for (const callback of this.callbacks) {
      try {
        callback(result);
      } catch (e) {
        console.error('[ExpressionPalette] Callback error:', e);
      }
    }
  }
}

// 单例导出
export const expressionPaletteSystem = new ExpressionPaletteSystem();
