/**
 * MotionBlendingSystem - 动作混合系统
 * 实现平滑的动作过渡和多动作叠加
 */

export interface MotionLayer {
  id: string;
  name: string;
  weight: number;        // 0-1 权重
  priority: number;      // 优先级
  fadeIn: number;        // 淡入时间 (ms)
  fadeOut: number;       // 淡出时间 (ms)
  blendMode: BlendMode;
  state: LayerState;
  startTime: number;
  duration?: number;     // 可选的持续时间
}

export type BlendMode = 
  | 'override'    // 完全覆盖
  | 'additive'    // 叠加
  | 'multiply';   // 乘法混合

export type LayerState = 
  | 'fadingIn' 
  | 'playing' 
  | 'fadingOut' 
  | 'stopped';

export interface BlendConfig {
  defaultFadeIn: number;
  defaultFadeOut: number;
  maxLayers: number;
  autoCleanup: boolean;
}

export interface BlendResult {
  finalWeight: number;
  activeLayers: string[];
  blendedParams: Record<string, number>;
}

type LayerChangeCallback = (layers: MotionLayer[]) => void;

export class MotionBlendingSystem {
  private static instance: MotionBlendingSystem | null = null;
  
  private layers: Map<string, MotionLayer> = new Map();
  private callbacks: Set<LayerChangeCallback> = new Set();
  private animationFrame: number | null = null;
  private lastUpdateTime = 0;
  
  private config: BlendConfig = {
    defaultFadeIn: 200,
    defaultFadeOut: 200,
    maxLayers: 8,
    autoCleanup: true,
  };

  // 参数混合结果
  private blendedParams: Record<string, number> = {};

  private constructor() {
    this.startUpdateLoop();
  }

  static getInstance(): MotionBlendingSystem {
    if (!MotionBlendingSystem.instance) {
      MotionBlendingSystem.instance = new MotionBlendingSystem();
    }
    return MotionBlendingSystem.instance;
  }

  /**
   * 添加动作层
   */
  addLayer(options: {
    id?: string;
    name: string;
    weight?: number;
    priority?: number;
    fadeIn?: number;
    fadeOut?: number;
    blendMode?: BlendMode;
    duration?: number;
  }): MotionLayer {
    const id = options.id || `layer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    // 检查层数限制
    if (this.layers.size >= this.config.maxLayers) {
      // 移除最低优先级的层
      this.removeLowestPriorityLayer();
    }
    
    const layer: MotionLayer = {
      id,
      name: options.name,
      weight: options.weight ?? 1.0,
      priority: options.priority ?? 0,
      fadeIn: options.fadeIn ?? this.config.defaultFadeIn,
      fadeOut: options.fadeOut ?? this.config.defaultFadeOut,
      blendMode: options.blendMode ?? 'override',
      state: 'fadingIn',
      startTime: Date.now(),
      duration: options.duration,
    };
    
    this.layers.set(id, layer);
    this.notifyChange();
    
    return layer;
  }

  /**
   * 移除动作层 (带淡出)
   */
  removeLayer(id: string, immediate = false): boolean {
    const layer = this.layers.get(id);
    if (!layer) return false;
    
    if (immediate || layer.fadeOut === 0) {
      this.layers.delete(id);
      this.notifyChange();
    } else {
      layer.state = 'fadingOut';
      layer.startTime = Date.now(); // 重置开始时间用于淡出计算
    }
    
    return true;
  }

  /**
   * 更新层权重
   */
  setLayerWeight(id: string, weight: number): boolean {
    const layer = this.layers.get(id);
    if (!layer) return false;
    
    layer.weight = Math.max(0, Math.min(1, weight));
    this.notifyChange();
    return true;
  }

  /**
   * 获取层信息
   */
  getLayer(id: string): MotionLayer | undefined {
    const layer = this.layers.get(id);
    return layer ? { ...layer } : undefined;
  }

  /**
   * 获取所有活跃层
   */
  getActiveLayers(): MotionLayer[] {
    return Array.from(this.layers.values())
      .filter(l => l.state !== 'stopped')
      .map(l => ({ ...l }))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * 计算混合结果
   */
  calculateBlend(): BlendResult {
    const activeLayers = this.getActiveLayers();
    const now = Date.now();
    
    let totalWeight = 0;
    const blendedParams: Record<string, number> = {};
    const activeIds: string[] = [];

    for (const layer of activeLayers) {
      const effectiveWeight = this.calculateEffectiveWeight(layer, now);
      
      if (effectiveWeight > 0) {
        activeIds.push(layer.id);
        
        switch (layer.blendMode) {
          case 'override':
            totalWeight = Math.max(totalWeight, effectiveWeight);
            break;
          case 'additive':
            totalWeight += effectiveWeight;
            break;
          case 'multiply':
            totalWeight = totalWeight === 0 ? effectiveWeight : totalWeight * effectiveWeight;
            break;
        }
      }
    }

    return {
      finalWeight: Math.min(1, totalWeight),
      activeLayers: activeIds,
      blendedParams,
    };
  }

  /**
   * 计算层的有效权重 (考虑淡入淡出)
   */
  private calculateEffectiveWeight(layer: MotionLayer, now: number): number {
    const elapsed = now - layer.startTime;
    let fadeMultiplier = 1;

    switch (layer.state) {
      case 'fadingIn':
        if (layer.fadeIn > 0) {
          fadeMultiplier = Math.min(1, elapsed / layer.fadeIn);
          if (fadeMultiplier >= 1) {
            layer.state = 'playing';
          }
        } else {
          layer.state = 'playing';
        }
        break;
        
      case 'playing':
        // 检查是否需要开始淡出 (有持续时间的情况)
        if (layer.duration && elapsed >= layer.duration) {
          layer.state = 'fadingOut';
          layer.startTime = now;
        }
        break;
        
      case 'fadingOut':
        if (layer.fadeOut > 0) {
          fadeMultiplier = 1 - Math.min(1, elapsed / layer.fadeOut);
          if (fadeMultiplier <= 0) {
            layer.state = 'stopped';
            if (this.config.autoCleanup) {
              this.layers.delete(layer.id);
            }
          }
        } else {
          layer.state = 'stopped';
          if (this.config.autoCleanup) {
            this.layers.delete(layer.id);
          }
        }
        break;
        
      case 'stopped':
        return 0;
    }

    return layer.weight * fadeMultiplier;
  }

  /**
   * 移除最低优先级的层
   */
  private removeLowestPriorityLayer(): void {
    let lowest: MotionLayer | null = null;
    
    for (const layer of this.layers.values()) {
      if (!lowest || layer.priority < lowest.priority) {
        lowest = layer;
      }
    }
    
    if (lowest) {
      this.layers.delete(lowest.id);
    }
  }

  /**
   * 启动更新循环
   */
  private startUpdateLoop(): void {
    const update = () => {
      const now = Date.now();
      
      // 限制更新频率
      if (now - this.lastUpdateTime >= 16) { // ~60fps
        this.calculateBlend(); // 触发状态更新
        this.lastUpdateTime = now;
      }
      
      this.animationFrame = requestAnimationFrame(update);
    };
    
    this.animationFrame = requestAnimationFrame(update);
  }

  /**
   * 订阅层变化
   */
  onLayerChange(callback: LayerChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 通知变化
   */
  private notifyChange(): void {
    const layers = this.getActiveLayers();
    this.callbacks.forEach(cb => {
      try {
        cb(layers);
      } catch (e) {
        console.error('[MotionBlendingSystem] Callback error:', e);
      }
    });
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<BlendConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): BlendConfig {
    return { ...this.config };
  }

  /**
   * 清除所有层
   */
  clearAllLayers(immediate = false): void {
    if (immediate) {
      this.layers.clear();
      this.notifyChange();
    } else {
      for (const layer of this.layers.values()) {
        layer.state = 'fadingOut';
        layer.startTime = Date.now();
      }
    }
  }

  /**
   * 获取层数量
   */
  getLayerCount(): number {
    return this.layers.size;
  }

  /**
   * 检查层是否存在
   */
  hasLayer(id: string): boolean {
    return this.layers.has(id);
  }

  /**
   * 创建过渡 (从一个动作平滑过渡到另一个)
   */
  createTransition(
    fromLayerId: string | null, 
    toLayerName: string,
    options?: {
      crossfade?: number;
      priority?: number;
      blendMode?: BlendMode;
    }
  ): MotionLayer {
    const crossfade = options?.crossfade ?? 300;
    
    // 淡出旧层
    if (fromLayerId) {
      const oldLayer = this.layers.get(fromLayerId);
      if (oldLayer) {
        oldLayer.fadeOut = crossfade;
        oldLayer.state = 'fadingOut';
        oldLayer.startTime = Date.now();
      }
    }
    
    // 创建新层
    return this.addLayer({
      name: toLayerName,
      fadeIn: crossfade,
      priority: options?.priority ?? 0,
      blendMode: options?.blendMode ?? 'override',
    });
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.layers.clear();
    this.callbacks.clear();
    MotionBlendingSystem.instance = null;
  }
}

export const motionBlendingSystem = MotionBlendingSystem.getInstance();
