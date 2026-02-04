/**
 * AdvancedExpressionBlender - 高级表情混合系统
 * 
 * 功能：
 * - 多表情层叠混合
 * - 权重自动归一化
 * - 表情冲突检测
 * - 平滑过渡动画
 * - 表情组预设
 * - 微表情叠加
 * 
 * @module AdvancedExpressionBlender
 */

export interface ExpressionLayer {
  id: string;
  expression: string;
  weight: number;           // 0-1
  priority: number;         // 优先级
  blendMode: 'replace' | 'additive' | 'multiply';
  fadeInDuration: number;   // 淡入时长 (ms)
  fadeOutDuration: number;  // 淡出时长 (ms)
  startTime: number;
  duration: number | null;  // null = 无限
}

export interface ExpressionParams {
  // 眉毛
  browLeftY: number;        // 左眉高度 (-1 ~ 1)
  browRightY: number;       // 右眉高度
  browLeftAngle: number;    // 左眉角度
  browRightAngle: number;   // 右眉角度
  // 眼睛
  eyeLeftOpen: number;      // 左眼开合 (0 ~ 1)
  eyeRightOpen: number;     // 右眼开合
  eyeLeftSquint: number;    // 左眼眯眼
  eyeRightSquint: number;   // 右眼眯眼
  // 嘴巴
  mouthOpenY: number;       // 嘴巴张开
  mouthForm: number;        // 嘴型 (-1 = O, 0 = neutral, 1 = E)
  mouthSmile: number;       // 微笑 (-1 ~ 1)
  // 脸颊
  cheekPuff: number;        // 鼓腮
  cheekBlush: number;       // 脸红 (0 ~ 1)
  // 其他
  noseWrinkle: number;      // 皱鼻
  tongueOut: number;        // 吐舌
}

export interface BlendedResult {
  params: ExpressionParams;
  activeLayers: string[];
  conflicts: string[];
}

export type BlenderCallback = (result: BlendedResult) => void;

// 默认表情参数
const DEFAULT_PARAMS: ExpressionParams = {
  browLeftY: 0,
  browRightY: 0,
  browLeftAngle: 0,
  browRightAngle: 0,
  eyeLeftOpen: 1,
  eyeRightOpen: 1,
  eyeLeftSquint: 0,
  eyeRightSquint: 0,
  mouthOpenY: 0,
  mouthForm: 0,
  mouthSmile: 0,
  cheekPuff: 0,
  cheekBlush: 0,
  noseWrinkle: 0,
  tongueOut: 0,
};

// 预设表情定义
export const EXPRESSION_PRESETS: Record<string, Partial<ExpressionParams>> = {
  neutral: {},
  
  happy: {
    eyeLeftSquint: 0.3,
    eyeRightSquint: 0.3,
    mouthSmile: 0.8,
    cheekBlush: 0.2,
  },
  
  sad: {
    browLeftY: -0.3,
    browRightY: -0.3,
    browLeftAngle: 0.3,
    browRightAngle: -0.3,
    eyeLeftOpen: 0.7,
    eyeRightOpen: 0.7,
    mouthSmile: -0.5,
  },
  
  surprised: {
    browLeftY: 0.7,
    browRightY: 0.7,
    eyeLeftOpen: 1.2,
    eyeRightOpen: 1.2,
    mouthOpenY: 0.6,
    mouthForm: -0.5,
  },
  
  angry: {
    browLeftY: -0.5,
    browRightY: -0.5,
    browLeftAngle: -0.5,
    browRightAngle: 0.5,
    eyeLeftSquint: 0.4,
    eyeRightSquint: 0.4,
    mouthSmile: -0.3,
    noseWrinkle: 0.5,
  },
  
  fear: {
    browLeftY: 0.5,
    browRightY: 0.5,
    browLeftAngle: 0.3,
    browRightAngle: -0.3,
    eyeLeftOpen: 1.3,
    eyeRightOpen: 1.3,
    mouthOpenY: 0.3,
  },
  
  disgust: {
    browLeftY: -0.2,
    browRightY: 0.1,
    eyeLeftSquint: 0.5,
    eyeRightSquint: 0.3,
    mouthSmile: -0.4,
    mouthForm: 0.3,
    noseWrinkle: 0.7,
  },
  
  thinking: {
    browLeftY: 0.2,
    browRightY: -0.1,
    eyeLeftOpen: 0.9,
    eyeRightOpen: 0.8,
    mouthForm: 0.2,
  },
  
  shy: {
    eyeLeftOpen: 0.7,
    eyeRightOpen: 0.7,
    eyeLeftSquint: 0.2,
    eyeRightSquint: 0.2,
    mouthSmile: 0.3,
    cheekBlush: 0.7,
  },
  
  excited: {
    browLeftY: 0.4,
    browRightY: 0.4,
    eyeLeftOpen: 1.1,
    eyeRightOpen: 1.1,
    mouthOpenY: 0.4,
    mouthSmile: 0.9,
    cheekBlush: 0.3,
  },
  
  sleepy: {
    browLeftY: -0.1,
    browRightY: -0.1,
    eyeLeftOpen: 0.3,
    eyeRightOpen: 0.3,
    mouthOpenY: 0.1,
  },
  
  confident: {
    browLeftY: 0.1,
    browRightY: 0.1,
    eyeLeftSquint: 0.2,
    eyeRightSquint: 0.2,
    mouthSmile: 0.4,
  },
  
  embarrassed: {
    browLeftY: 0.2,
    browRightY: 0.2,
    eyeLeftOpen: 0.6,
    eyeRightOpen: 0.6,
    mouthSmile: 0.2,
    cheekBlush: 0.9,
  },
  
  wink_left: {
    eyeLeftOpen: 0,
    mouthSmile: 0.3,
  },
  
  wink_right: {
    eyeRightOpen: 0,
    mouthSmile: 0.3,
  },
  
  pout: {
    browLeftY: -0.2,
    browRightY: -0.2,
    mouthForm: -0.6,
    cheekPuff: 0.3,
  },
  
  smirk: {
    browLeftY: 0.1,
    eyeLeftSquint: 0.3,
    mouthSmile: 0.4,
  },
  
  laugh: {
    eyeLeftSquint: 0.6,
    eyeRightSquint: 0.6,
    mouthOpenY: 0.7,
    mouthSmile: 1.0,
    cheekBlush: 0.3,
  },
  
  cry: {
    browLeftY: -0.4,
    browRightY: -0.4,
    browLeftAngle: 0.4,
    browRightAngle: -0.4,
    eyeLeftOpen: 0.5,
    eyeRightOpen: 0.5,
    mouthSmile: -0.7,
    mouthOpenY: 0.2,
  },
  
  tease: {
    browLeftY: 0.2,
    eyeLeftSquint: 0.3,
    eyeRightSquint: 0.1,
    mouthSmile: 0.5,
    tongueOut: 0.3,
  },
};

// 表情冲突组
const CONFLICT_GROUPS: Record<string, string[]> = {
  mouth_shape: ['happy', 'sad', 'surprised', 'pout', 'laugh', 'cry'],
  eye_state: ['surprised', 'sleepy', 'wink_left', 'wink_right'],
  brow_position: ['happy', 'sad', 'angry', 'surprised', 'fear'],
};

/**
 * 高级表情混合系统
 */
export class AdvancedExpressionBlender {
  private layers: Map<string, ExpressionLayer> = new Map();
  private baseExpression: string = 'neutral';
  private callbacks: Set<BlenderCallback> = new Set();
  private animationId: number | null = null;
  private lastTime: number = 0;
  private isRunning: boolean = false;
  private maxLayers: number = 8;

  constructor() {
    // 初始化
  }

  /**
   * 添加表情层
   */
  addLayer(
    id: string,
    expression: string,
    options?: Partial<{
      weight: number;
      priority: number;
      blendMode: 'replace' | 'additive' | 'multiply';
      fadeInDuration: number;
      fadeOutDuration: number;
      duration: number | null;
    }>
  ): ExpressionLayer {
    const layer: ExpressionLayer = {
      id,
      expression,
      weight: options?.weight ?? 1.0,
      priority: options?.priority ?? 0,
      blendMode: options?.blendMode ?? 'additive',
      fadeInDuration: options?.fadeInDuration ?? 200,
      fadeOutDuration: options?.fadeOutDuration ?? 200,
      startTime: performance.now(),
      duration: options?.duration ?? null,
    };

    // 层数限制
    if (this.layers.size >= this.maxLayers) {
      // 移除优先级最低的层
      const sortedLayers = Array.from(this.layers.values())
        .sort((a, b) => a.priority - b.priority);
      if (sortedLayers.length > 0) {
        this.layers.delete(sortedLayers[0].id);
      }
    }

    this.layers.set(id, layer);
    return layer;
  }

  /**
   * 移除表情层
   */
  removeLayer(id: string): boolean {
    return this.layers.delete(id);
  }

  /**
   * 获取表情层
   */
  getLayer(id: string): ExpressionLayer | undefined {
    return this.layers.get(id);
  }

  /**
   * 获取所有层
   */
  getAllLayers(): ExpressionLayer[] {
    return Array.from(this.layers.values());
  }

  /**
   * 更新层权重
   */
  setLayerWeight(id: string, weight: number): void {
    const layer = this.layers.get(id);
    if (layer) {
      layer.weight = Math.max(0, Math.min(1, weight));
    }
  }

  /**
   * 设置基础表情
   */
  setBaseExpression(expression: string): void {
    this.baseExpression = expression;
  }

  /**
   * 获取预设表情参数
   */
  getPresetParams(expression: string): Partial<ExpressionParams> {
    return EXPRESSION_PRESETS[expression] ?? {};
  }

  /**
   * 检测表情冲突
   */
  detectConflicts(expressions: string[]): string[] {
    const conflicts: string[] = [];

    for (const [group, members] of Object.entries(CONFLICT_GROUPS)) {
      const activeInGroup = expressions.filter(e => members.includes(e));
      if (activeInGroup.length > 1) {
        conflicts.push(`${group}: ${activeInGroup.join(', ')}`);
      }
    }

    return conflicts;
  }

  /**
   * 计算混合结果
   */
  blend(): BlendedResult {
    const now = performance.now();
    const result: ExpressionParams = { ...DEFAULT_PARAMS };
    const activeLayers: string[] = [];
    const activeExpressions: string[] = [this.baseExpression];

    // 应用基础表情
    const baseParams = this.getPresetParams(this.baseExpression);
    Object.assign(result, baseParams);

    // 按优先级排序层
    const sortedLayers = Array.from(this.layers.values())
      .filter(layer => {
        // 检查是否过期
        if (layer.duration !== null) {
          const elapsed = now - layer.startTime;
          if (elapsed > layer.duration + layer.fadeOutDuration) {
            this.layers.delete(layer.id);
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => a.priority - b.priority);

    // 应用每个层
    for (const layer of sortedLayers) {
      const elapsed = now - layer.startTime;
      let effectiveWeight = layer.weight;

      // 淡入
      if (elapsed < layer.fadeInDuration) {
        effectiveWeight *= elapsed / layer.fadeInDuration;
      }

      // 淡出
      if (layer.duration !== null) {
        const timeUntilEnd = layer.duration - elapsed;
        if (timeUntilEnd < layer.fadeOutDuration && timeUntilEnd > 0) {
          effectiveWeight *= timeUntilEnd / layer.fadeOutDuration;
        } else if (timeUntilEnd <= 0) {
          effectiveWeight *= Math.max(0, 1 + timeUntilEnd / layer.fadeOutDuration);
        }
      }

      if (effectiveWeight <= 0) continue;

      const layerParams = this.getPresetParams(layer.expression);
      activeLayers.push(layer.id);
      activeExpressions.push(layer.expression);

      // 根据混合模式应用参数
      for (const [key, value] of Object.entries(layerParams)) {
        const paramKey = key as keyof ExpressionParams;
        const currentValue = result[paramKey];
        const layerValue = value as number;

        switch (layer.blendMode) {
          case 'replace':
            result[paramKey] = this.lerp(currentValue, layerValue, effectiveWeight);
            break;
          case 'additive':
            result[paramKey] = currentValue + layerValue * effectiveWeight;
            break;
          case 'multiply':
            result[paramKey] = currentValue * (1 + (layerValue - 1) * effectiveWeight);
            break;
        }
      }
    }

    // 限制参数范围
    this.clampParams(result);

    // 检测冲突
    const conflicts = this.detectConflicts(activeExpressions);

    return { params: result, activeLayers, conflicts };
  }

  /**
   * 线性插值
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * 限制参数范围
   */
  private clampParams(params: ExpressionParams): void {
    params.browLeftY = Math.max(-1, Math.min(1, params.browLeftY));
    params.browRightY = Math.max(-1, Math.min(1, params.browRightY));
    params.browLeftAngle = Math.max(-1, Math.min(1, params.browLeftAngle));
    params.browRightAngle = Math.max(-1, Math.min(1, params.browRightAngle));
    params.eyeLeftOpen = Math.max(0, Math.min(1.5, params.eyeLeftOpen));
    params.eyeRightOpen = Math.max(0, Math.min(1.5, params.eyeRightOpen));
    params.eyeLeftSquint = Math.max(0, Math.min(1, params.eyeLeftSquint));
    params.eyeRightSquint = Math.max(0, Math.min(1, params.eyeRightSquint));
    params.mouthOpenY = Math.max(0, Math.min(1, params.mouthOpenY));
    params.mouthForm = Math.max(-1, Math.min(1, params.mouthForm));
    params.mouthSmile = Math.max(-1, Math.min(1, params.mouthSmile));
    params.cheekPuff = Math.max(0, Math.min(1, params.cheekPuff));
    params.cheekBlush = Math.max(0, Math.min(1, params.cheekBlush));
    params.noseWrinkle = Math.max(0, Math.min(1, params.noseWrinkle));
    params.tongueOut = Math.max(0, Math.min(1, params.tongueOut));
  }

  /**
   * 转换为 Live2D 参数
   */
  toLive2DParams(result: BlendedResult): Record<string, number> {
    const { params } = result;
    return {
      ParamBrowLY: params.browLeftY,
      ParamBrowRY: params.browRightY,
      ParamBrowLAngle: params.browLeftAngle,
      ParamBrowRAngle: params.browRightAngle,
      ParamEyeLOpen: params.eyeLeftOpen,
      ParamEyeROpen: params.eyeRightOpen,
      ParamEyeLSmile: params.eyeLeftSquint,
      ParamEyeRSmile: params.eyeRightSquint,
      ParamMouthOpenY: params.mouthOpenY,
      ParamMouthForm: params.mouthForm,
      ParamMouthSmile: params.mouthSmile,
      ParamCheekPuff: params.cheekPuff,
      ParamCheekBlush: params.cheekBlush,
      ParamNoseWrinkle: params.noseWrinkle,
      ParamTongueOut: params.tongueOut,
    };
  }

  /**
   * 启动自动更新
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.tick();
  }

  /**
   * 停止自动更新
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * 是否运行中
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 动画帧
   */
  private tick = (): void => {
    if (!this.isRunning) return;

    const result = this.blend();
    this.notifyCallbacks(result);

    this.animationId = requestAnimationFrame(this.tick);
  };

  /**
   * 订阅更新
   */
  onUpdate(callback: BlenderCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 通知回调
   */
  private notifyCallbacks(result: BlendedResult): void {
    for (const callback of this.callbacks) {
      callback(result);
    }
  }

  /**
   * 快速设置表情
   */
  setExpression(expression: string, duration?: number): void {
    // 清除现有层
    this.layers.clear();
    
    // 设置基础表情
    this.setBaseExpression(expression);
    
    // 如果有持续时间，添加一个临时层
    if (duration !== undefined) {
      this.addLayer('temp_expression', expression, {
        duration,
        fadeInDuration: 150,
        fadeOutDuration: 150,
      });
    }
  }

  /**
   * 添加微表情叠加
   */
  addMicroExpression(type: 'blink' | 'twitch' | 'glance' | 'smirk'): void {
    const microExpressions: Record<string, Partial<ExpressionLayer> & { expression: string }> = {
      blink: {
        expression: 'sleepy',
        weight: 0.8,
        duration: 150,
        fadeInDuration: 50,
        fadeOutDuration: 50,
      },
      twitch: {
        expression: 'wink_left',
        weight: 0.3,
        duration: 100,
        fadeInDuration: 30,
        fadeOutDuration: 30,
      },
      glance: {
        expression: 'thinking',
        weight: 0.2,
        duration: 300,
        fadeInDuration: 100,
        fadeOutDuration: 100,
      },
      smirk: {
        expression: 'smirk',
        weight: 0.5,
        duration: 500,
        fadeInDuration: 150,
        fadeOutDuration: 200,
      },
    };

    const micro = microExpressions[type];
    if (micro) {
      this.addLayer(`micro_${type}_${Date.now()}`, micro.expression, {
        weight: micro.weight,
        duration: micro.duration,
        fadeInDuration: micro.fadeInDuration,
        fadeOutDuration: micro.fadeOutDuration,
        priority: -1, // 低优先级
      });
    }
  }

  /**
   * 重置
   */
  reset(): void {
    this.layers.clear();
    this.baseExpression = 'neutral';
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stop();
    this.callbacks.clear();
    this.layers.clear();
  }
}

// 默认实例
export const advancedExpressionBlender = new AdvancedExpressionBlender();
