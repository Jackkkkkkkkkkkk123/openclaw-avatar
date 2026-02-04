/**
 * PhysicsSimulation - 物理模拟动画系统
 * 
 * 功能：
 * - 头发物理模拟 (弹簧阻尼系统)
 * - 衣物摆动模拟
 * - 配饰动态效果 (双马尾、蝴蝶结等)
 * - 风力效果
 * - 惯性跟随
 * 
 * @module PhysicsSimulation
 */

export interface Vector2 {
  x: number;
  y: number;
}

export interface SpringConfig {
  stiffness: number;      // 弹簧刚度 (0-1)
  damping: number;        // 阻尼系数 (0-1)
  mass: number;           // 质量
  restLength: number;     // 静止长度
}

export interface PhysicsPoint {
  id: string;
  position: Vector2;
  velocity: Vector2;
  acceleration: Vector2;
  mass: number;
  isFixed: boolean;       // 是否固定点
  connections: string[];  // 连接的其他点
}

export interface PhysicsChain {
  id: string;
  name: string;
  points: PhysicsPoint[];
  springConfig: SpringConfig;
  gravity: number;
  airResistance: number;
  enabled: boolean;
}

export interface WindConfig {
  direction: Vector2;
  strength: number;
  turbulence: number;     // 湍流系数
  frequency: number;      // 变化频率
}

export interface PhysicsConfig {
  enabled: boolean;
  timeScale: number;      // 时间缩放
  substeps: number;       // 子步数 (精度)
  gravity: Vector2;
  wind: WindConfig;
  chains: Record<string, PhysicsChain>;
}

export interface PhysicsState {
  chains: Record<string, PhysicsChain>;
  wind: WindConfig;
  time: number;
  deltaTime: number;
}

export type PhysicsCallback = (state: PhysicsState) => void;

// 预设物理链配置
export const PRESET_CHAINS = {
  // 双马尾 (初音未来特征)
  twintail_left: {
    pointCount: 8,
    springConfig: {
      stiffness: 0.3,
      damping: 0.7,
      mass: 1.0,
      restLength: 0.15,
    },
    gravity: 0.5,
    airResistance: 0.1,
  },
  twintail_right: {
    pointCount: 8,
    springConfig: {
      stiffness: 0.3,
      damping: 0.7,
      mass: 1.0,
      restLength: 0.15,
    },
    gravity: 0.5,
    airResistance: 0.1,
  },
  // 刘海
  bangs: {
    pointCount: 4,
    springConfig: {
      stiffness: 0.6,
      damping: 0.8,
      mass: 0.5,
      restLength: 0.08,
    },
    gravity: 0.3,
    airResistance: 0.15,
  },
  // 蝴蝶结/发饰
  accessory: {
    pointCount: 3,
    springConfig: {
      stiffness: 0.5,
      damping: 0.6,
      mass: 0.3,
      restLength: 0.05,
    },
    gravity: 0.2,
    airResistance: 0.2,
  },
  // 裙摆
  skirt: {
    pointCount: 6,
    springConfig: {
      stiffness: 0.4,
      damping: 0.75,
      mass: 0.8,
      restLength: 0.12,
    },
    gravity: 0.6,
    airResistance: 0.08,
  },
  // 领带/飘带
  ribbon: {
    pointCount: 5,
    springConfig: {
      stiffness: 0.35,
      damping: 0.65,
      mass: 0.4,
      restLength: 0.1,
    },
    gravity: 0.4,
    airResistance: 0.12,
  },
};

/**
 * 物理模拟动画系统
 */
export class PhysicsSimulation {
  private config: PhysicsConfig;
  private state: PhysicsState;
  private callbacks: Set<PhysicsCallback> = new Set();
  private animationId: number | null = null;
  private lastTime: number = 0;
  private isRunning: boolean = false;

  constructor(config?: Partial<PhysicsConfig>) {
    this.config = {
      enabled: true,
      timeScale: 1.0,
      substeps: 4,
      gravity: { x: 0, y: 0.98 },
      wind: {
        direction: { x: 1, y: 0 },
        strength: 0,
        turbulence: 0.3,
        frequency: 0.5,
      },
      chains: {},
      ...config,
    };

    this.state = {
      chains: {},
      wind: { ...this.config.wind },
      time: 0,
      deltaTime: 0,
    };
  }

  /**
   * 创建物理链
   */
  createChain(
    id: string,
    name: string,
    anchorPosition: Vector2,
    preset: keyof typeof PRESET_CHAINS | null,
    customConfig?: Partial<{
      pointCount: number;
      springConfig: SpringConfig;
      gravity: number;
      airResistance: number;
      direction: Vector2;
    }>
  ): PhysicsChain {
    const presetConfig = preset ? PRESET_CHAINS[preset] : null;
    const finalConfig = {
      pointCount: customConfig?.pointCount ?? presetConfig?.pointCount ?? 5,
      springConfig: customConfig?.springConfig ?? presetConfig?.springConfig ?? {
        stiffness: 0.5,
        damping: 0.7,
        mass: 1.0,
        restLength: 0.1,
      },
      gravity: customConfig?.gravity ?? presetConfig?.gravity ?? 0.5,
      airResistance: customConfig?.airResistance ?? presetConfig?.airResistance ?? 0.1,
    };

    const direction = customConfig?.direction ?? { x: 0, y: 1 };
    const points: PhysicsPoint[] = [];

    for (let i = 0; i < finalConfig.pointCount; i++) {
      const t = i / (finalConfig.pointCount - 1);
      points.push({
        id: `${id}_point_${i}`,
        position: {
          x: anchorPosition.x + direction.x * finalConfig.springConfig.restLength * i,
          y: anchorPosition.y + direction.y * finalConfig.springConfig.restLength * i,
        },
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
        mass: finalConfig.springConfig.mass * (1 - t * 0.3), // 末端质量递减
        isFixed: i === 0, // 第一个点固定
        connections: i < finalConfig.pointCount - 1 ? [`${id}_point_${i + 1}`] : [],
      });
    }

    const chain: PhysicsChain = {
      id,
      name,
      points,
      springConfig: finalConfig.springConfig,
      gravity: finalConfig.gravity,
      airResistance: finalConfig.airResistance,
      enabled: true,
    };

    this.config.chains[id] = chain;
    this.state.chains[id] = JSON.parse(JSON.stringify(chain));

    return chain;
  }

  /**
   * 移除物理链
   */
  removeChain(id: string): boolean {
    if (this.config.chains[id]) {
      delete this.config.chains[id];
      delete this.state.chains[id];
      return true;
    }
    return false;
  }

  /**
   * 获取物理链
   */
  getChain(id: string): PhysicsChain | undefined {
    return this.state.chains[id];
  }

  /**
   * 获取所有物理链
   */
  getAllChains(): PhysicsChain[] {
    return Object.values(this.state.chains);
  }

  /**
   * 设置锚点位置 (如头部移动时更新)
   */
  setAnchorPosition(chainId: string, position: Vector2): void {
    const chain = this.state.chains[chainId];
    if (chain && chain.points.length > 0) {
      const fixedPoint = chain.points.find(p => p.isFixed);
      if (fixedPoint) {
        fixedPoint.position = { ...position };
      }
    }
  }

  /**
   * 设置风力
   */
  setWind(wind: Partial<WindConfig>): void {
    this.config.wind = { ...this.config.wind, ...wind };
    this.state.wind = { ...this.config.wind };
  }

  /**
   * 获取风力配置
   */
  getWind(): WindConfig {
    return { ...this.state.wind };
  }

  /**
   * 应用冲击力 (如甩头动作)
   */
  applyImpulse(chainId: string, impulse: Vector2, pointIndex?: number): void {
    const chain = this.state.chains[chainId];
    if (!chain) return;

    if (pointIndex !== undefined) {
      const point = chain.points[pointIndex];
      if (point && !point.isFixed) {
        point.velocity.x += impulse.x / point.mass;
        point.velocity.y += impulse.y / point.mass;
      }
    } else {
      // 应用到所有非固定点
      for (const point of chain.points) {
        if (!point.isFixed) {
          point.velocity.x += impulse.x / point.mass;
          point.velocity.y += impulse.y / point.mass;
        }
      }
    }
  }

  /**
   * 计算弹簧力
   */
  private calculateSpringForce(
    p1: PhysicsPoint,
    p2: PhysicsPoint,
    config: SpringConfig
  ): Vector2 {
    const dx = p2.position.x - p1.position.x;
    const dy = p2.position.y - p1.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 0.0001) return { x: 0, y: 0 };

    const displacement = distance - config.restLength;
    const forceMagnitude = config.stiffness * displacement;

    // 归一化方向
    const nx = dx / distance;
    const ny = dy / distance;

    // 相对速度
    const relVelX = p2.velocity.x - p1.velocity.x;
    const relVelY = p2.velocity.y - p1.velocity.y;
    const relVelAlongSpring = relVelX * nx + relVelY * ny;

    // 阻尼力
    const dampingForce = config.damping * relVelAlongSpring;

    const totalForce = forceMagnitude + dampingForce;

    return {
      x: totalForce * nx,
      y: totalForce * ny,
    };
  }

  /**
   * 计算风力
   */
  private calculateWindForce(point: PhysicsPoint, time: number): Vector2 {
    const wind = this.state.wind;
    if (wind.strength === 0) return { x: 0, y: 0 };

    // 添加湍流扰动
    const turbulenceX = Math.sin(time * wind.frequency * 2 * Math.PI + point.position.x * 10) * wind.turbulence;
    const turbulenceY = Math.cos(time * wind.frequency * 2 * Math.PI + point.position.y * 10) * wind.turbulence;

    return {
      x: wind.direction.x * wind.strength * (1 + turbulenceX),
      y: wind.direction.y * wind.strength * (1 + turbulenceY),
    };
  }

  /**
   * 物理步进
   */
  private step(dt: number): void {
    const substepDt = dt / this.config.substeps;

    for (let sub = 0; sub < this.config.substeps; sub++) {
      for (const chain of Object.values(this.state.chains)) {
        if (!chain.enabled) continue;

        // 更新每个点的加速度
        for (let i = 0; i < chain.points.length; i++) {
          const point = chain.points[i];
          if (point.isFixed) continue;

          // 重置加速度
          point.acceleration = { x: 0, y: 0 };

          // 重力
          point.acceleration.y += this.config.gravity.y * chain.gravity;
          point.acceleration.x += this.config.gravity.x * chain.gravity;

          // 风力
          const windForce = this.calculateWindForce(point, this.state.time);
          point.acceleration.x += windForce.x / point.mass;
          point.acceleration.y += windForce.y / point.mass;

          // 空气阻力
          point.acceleration.x -= point.velocity.x * chain.airResistance;
          point.acceleration.y -= point.velocity.y * chain.airResistance;

          // 弹簧力 (与前一个点)
          if (i > 0) {
            const prevPoint = chain.points[i - 1];
            const springForce = this.calculateSpringForce(prevPoint, point, chain.springConfig);
            point.acceleration.x -= springForce.x / point.mass;
            point.acceleration.y -= springForce.y / point.mass;
          }

          // 弹簧力 (与后一个点)
          if (i < chain.points.length - 1) {
            const nextPoint = chain.points[i + 1];
            const springForce = this.calculateSpringForce(point, nextPoint, chain.springConfig);
            point.acceleration.x += springForce.x / point.mass;
            point.acceleration.y += springForce.y / point.mass;
          }
        }

        // Verlet 积分更新位置和速度
        for (const point of chain.points) {
          if (point.isFixed) continue;

          // 更新速度
          point.velocity.x += point.acceleration.x * substepDt;
          point.velocity.y += point.acceleration.y * substepDt;

          // 速度限制
          const maxVelocity = 2.0;
          const velMag = Math.sqrt(point.velocity.x ** 2 + point.velocity.y ** 2);
          if (velMag > maxVelocity) {
            point.velocity.x = (point.velocity.x / velMag) * maxVelocity;
            point.velocity.y = (point.velocity.y / velMag) * maxVelocity;
          }

          // 更新位置
          point.position.x += point.velocity.x * substepDt;
          point.position.y += point.velocity.y * substepDt;
        }

        // 约束满足 (保持链的连接)
        for (let iter = 0; iter < 3; iter++) {
          for (let i = 0; i < chain.points.length - 1; i++) {
            const p1 = chain.points[i];
            const p2 = chain.points[i + 1];
            
            const dx = p2.position.x - p1.position.x;
            const dy = p2.position.y - p1.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 0.0001) continue;

            const maxStretch = chain.springConfig.restLength * 1.5;
            if (distance > maxStretch) {
              const correction = (distance - maxStretch) / distance;
              const cx = dx * correction * 0.5;
              const cy = dy * correction * 0.5;

              if (!p1.isFixed) {
                p1.position.x += cx;
                p1.position.y += cy;
              }
              if (!p2.isFixed) {
                p2.position.x -= cx;
                p2.position.y -= cy;
              }
            }
          }
        }
      }
    }

    this.state.time += dt;
    this.state.deltaTime = dt;
  }

  /**
   * 启动物理模拟
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.tick();
  }

  /**
   * 停止物理模拟
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

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05) * this.config.timeScale;
    this.lastTime = now;

    if (this.config.enabled) {
      this.step(dt);
      this.notifyCallbacks();
    }

    this.animationId = requestAnimationFrame(this.tick);
  };

  /**
   * 订阅状态更新
   */
  onUpdate(callback: PhysicsCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 通知回调
   */
  private notifyCallbacks(): void {
    for (const callback of this.callbacks) {
      callback(this.state);
    }
  }

  /**
   * 获取当前状态
   */
  getState(): PhysicsState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * 重置物理状态
   */
  reset(): void {
    // 重置所有链的点到初始位置
    for (const chainId in this.config.chains) {
      const configChain = this.config.chains[chainId];
      this.state.chains[chainId] = JSON.parse(JSON.stringify(configChain));
    }
    this.state.time = 0;
  }

  /**
   * 设置启用状态
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * 设置链的启用状态
   */
  setChainEnabled(chainId: string, enabled: boolean): void {
    const chain = this.state.chains[chainId];
    if (chain) {
      chain.enabled = enabled;
    }
    const configChain = this.config.chains[chainId];
    if (configChain) {
      configChain.enabled = enabled;
    }
  }

  /**
   * 获取链的位置数据 (用于渲染)
   */
  getChainPositions(chainId: string): Vector2[] {
    const chain = this.state.chains[chainId];
    if (!chain) return [];
    return chain.points.map(p => ({ ...p.position }));
  }

  /**
   * 获取用于 Live2D 参数的数据
   */
  getLive2DParams(chainId: string): Record<string, number> {
    const chain = this.state.chains[chainId];
    if (!chain || chain.points.length < 2) return {};

    const params: Record<string, number> = {};
    const basePrefix = `Param${chain.name}`;

    // 计算每个点相对于前一个点的角度
    for (let i = 1; i < chain.points.length; i++) {
      const prev = chain.points[i - 1];
      const curr = chain.points[i];
      
      const dx = curr.position.x - prev.position.x;
      const dy = curr.position.y - prev.position.y;
      const angle = Math.atan2(dx, dy) * (180 / Math.PI);
      
      // 归一化到 -30 ~ 30 度范围，映射到 -1 ~ 1
      const normalizedAngle = Math.max(-1, Math.min(1, angle / 30));
      params[`${basePrefix}Angle${i}`] = normalizedAngle;
    }

    // 末端摆动幅度
    const firstPoint = chain.points[0];
    const lastPoint = chain.points[chain.points.length - 1];
    const swingX = lastPoint.position.x - firstPoint.position.x;
    const swingY = lastPoint.position.y - firstPoint.position.y;
    
    params[`${basePrefix}SwingX`] = Math.max(-1, Math.min(1, swingX * 2));
    params[`${basePrefix}SwingY`] = Math.max(-1, Math.min(1, (swingY - chain.springConfig.restLength * (chain.points.length - 1)) * 2));

    return params;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stop();
    this.callbacks.clear();
    this.config.chains = {};
    this.state.chains = {};
  }
}

// 默认实例
export const physicsSimulation = new PhysicsSimulation();
