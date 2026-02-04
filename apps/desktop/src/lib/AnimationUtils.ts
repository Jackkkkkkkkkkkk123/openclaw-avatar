/**
 * AnimationUtils - 动画工具函数
 * 
 * 提供常用的动画相关工具
 * - 缓动函数
 * - 插值工具
 * - 帧率控制
 * 
 * Phase B+ - 动画系统增强
 */

/**
 * 线性插值
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 钳制值到范围
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 将值从一个范围映射到另一个范围
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  const t = (value - inMin) / (inMax - inMin);
  return lerp(outMin, outMax, clamp(t, 0, 1));
}

/**
 * 平滑步进 (Smoothstep)
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * 更平滑的步进 (Smootherstep)
 */
export function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// ============================================
// 缓动函数
// ============================================

export type EasingFunction = (t: number) => number;

/**
 * 线性
 */
export function easeLinear(t: number): number {
  return t;
}

/**
 * 缓入（二次）
 */
export function easeInQuad(t: number): number {
  return t * t;
}

/**
 * 缓出（二次）
 */
export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * 缓入缓出（二次）
 */
export function easeInOutQuad(t: number): number {
  return t < 0.5
    ? 2 * t * t
    : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * 缓入（三次）
 */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/**
 * 缓出（三次）
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * 缓入缓出（三次）
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 缓入（正弦）
 */
export function easeInSine(t: number): number {
  return 1 - Math.cos((t * Math.PI) / 2);
}

/**
 * 缓出（正弦）
 */
export function easeOutSine(t: number): number {
  return Math.sin((t * Math.PI) / 2);
}

/**
 * 缓入缓出（正弦）
 */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/**
 * 弹性缓入
 */
export function easeInElastic(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0
    ? 0
    : t === 1
    ? 1
    : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
}

/**
 * 弹性缓出
 */
export function easeOutElastic(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0
    ? 0
    : t === 1
    ? 1
    : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

/**
 * 弹跳缓出
 */
export function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75;
  } else if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  } else {
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
}

/**
 * 弹跳缓入
 */
export function easeInBounce(t: number): number {
  return 1 - easeOutBounce(1 - t);
}

// ============================================
// 缓动函数映射
// ============================================

export const easingFunctions: Record<string, EasingFunction> = {
  linear: easeLinear,
  easeIn: easeInQuad,
  easeOut: easeOutQuad,
  easeInOut: easeInOutQuad,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeInSine,
  easeOutSine,
  easeInOutSine,
  easeInElastic,
  easeOutElastic,
  easeInBounce,
  easeOutBounce,
};

/**
 * 根据名称获取缓动函数
 */
export function getEasing(name: string): EasingFunction {
  return easingFunctions[name] || easeLinear;
}

// ============================================
// 帧率工具
// ============================================

/**
 * 帧率限制器
 */
export class FrameRateLimiter {
  private lastFrameTime = -Infinity; // 使用 -Infinity 确保第一帧总是渲染
  private readonly minFrameInterval: number;

  constructor(maxFps: number = 60) {
    // 防止除零错误
    this.minFrameInterval = maxFps > 0 ? 1000 / maxFps : 0;
  }

  /**
   * 检查是否应该渲染新帧
   */
  shouldRender(currentTime: number): boolean {
    const elapsed = currentTime - this.lastFrameTime;
    if (elapsed >= this.minFrameInterval) {
      this.lastFrameTime = currentTime;
      return true;
    }
    return false;
  }

  /**
   * 重置
   */
  reset() {
    this.lastFrameTime = -Infinity;
  }
}

/**
 * 增量时间计算器
 */
export class DeltaTimeCalculator {
  private lastTime = 0;
  private deltaTime = 0;

  /**
   * 更新并获取增量时间 (秒)
   */
  update(currentTime: number): number {
    if (this.lastTime === 0) {
      this.lastTime = currentTime;
      return 0;
    }
    
    this.deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    
    // 防止过大的 delta（例如标签页休眠后恢复）
    return Math.min(this.deltaTime, 0.1);
  }

  /**
   * 获取上次计算的增量时间
   */
  getDelta(): number {
    return this.deltaTime;
  }

  /**
   * 重置
   */
  reset() {
    this.lastTime = 0;
    this.deltaTime = 0;
  }
}

// ============================================
// 动画值
// ============================================

/**
 * 平滑动画值 - 自动平滑过渡到目标值
 */
export class SmoothValue {
  private current: number;
  private target: number;
  private velocity = 0;
  
  constructor(
    initialValue: number = 0,
    private smoothTime: number = 0.1,
    private maxSpeed: number = Infinity
  ) {
    this.current = initialValue;
    this.target = initialValue;
  }

  /**
   * 设置目标值
   */
  setTarget(value: number) {
    this.target = value;
  }

  /**
   * 立即设置当前值
   */
  setCurrent(value: number) {
    this.current = value;
    this.target = value;
    this.velocity = 0;
  }

  /**
   * 更新动画
   * @param deltaTime 增量时间 (秒)
   * @returns 当前值
   */
  update(deltaTime: number): number {
    // SmoothDamp 算法
    const omega = 2 / this.smoothTime;
    const x = omega * deltaTime;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    
    let change = this.current - this.target;
    const maxChange = this.maxSpeed * this.smoothTime;
    change = clamp(change, -maxChange, maxChange);
    
    const temp = (this.velocity + omega * change) * deltaTime;
    this.velocity = (this.velocity - omega * temp) * exp;
    this.current = this.target + (change + temp) * exp;
    
    // 到达目标时停止
    if (Math.abs(this.current - this.target) < 0.0001) {
      this.current = this.target;
      this.velocity = 0;
    }
    
    return this.current;
  }

  /**
   * 获取当前值
   */
  getValue(): number {
    return this.current;
  }

  /**
   * 获取目标值
   */
  getTarget(): number {
    return this.target;
  }

  /**
   * 是否到达目标
   */
  isAtTarget(): boolean {
    return this.current === this.target;
  }
}

/**
 * 弹簧动画值
 */
export class SpringValue {
  private current: number;
  private target: number;
  private velocity = 0;

  constructor(
    initialValue: number = 0,
    private stiffness: number = 100,
    private damping: number = 10
  ) {
    this.current = initialValue;
    this.target = initialValue;
  }

  /**
   * 设置目标值
   */
  setTarget(value: number) {
    this.target = value;
  }

  /**
   * 立即设置当前值
   */
  setCurrent(value: number) {
    this.current = value;
    this.target = value;
    this.velocity = 0;
  }

  /**
   * 更新动画
   * @param deltaTime 增量时间 (秒)
   * @returns 当前值
   */
  update(deltaTime: number): number {
    // 弹簧力 = -k * x
    const springForce = -this.stiffness * (this.current - this.target);
    // 阻尼力 = -c * v
    const dampingForce = -this.damping * this.velocity;
    
    // 加速度 = 力 / 质量 (假设质量 = 1)
    const acceleration = springForce + dampingForce;
    
    // 更新速度和位置
    this.velocity += acceleration * deltaTime;
    this.current += this.velocity * deltaTime;
    
    // 到达目标时停止
    if (Math.abs(this.velocity) < 0.001 && Math.abs(this.current - this.target) < 0.001) {
      this.current = this.target;
      this.velocity = 0;
    }
    
    return this.current;
  }

  /**
   * 获取当前值
   */
  getValue(): number {
    return this.current;
  }

  /**
   * 获取目标值
   */
  getTarget(): number {
    return this.target;
  }

  /**
   * 是否静止
   */
  isAtRest(): boolean {
    return this.velocity === 0 && this.current === this.target;
  }
}
