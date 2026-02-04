/**
 * PhysicsSimulator - 物理模拟系统
 * 
 * 为 Live2D 角色的头发、配饰等提供物理模拟
 * 支持：
 * - 弹簧阻尼系统
 * - 重力模拟
 * - 风力效果
 * - 惯性跟随（头部移动时的延迟跟随）
 * - 碰撞检测（简化版）
 */

export interface PhysicsPoint {
  x: number;
  y: number;
  vx: number;  // x 方向速度
  vy: number;  // y 方向速度
}

export interface PhysicsChain {
  id: string;
  name: string;
  points: PhysicsPoint[];
  config: ChainConfig;
}

export interface ChainConfig {
  // 弹簧参数
  stiffness: number;      // 刚度 0-1
  damping: number;        // 阻尼 0-1
  
  // 物理参数
  mass: number;           // 质量
  gravity: number;        // 重力影响 0-1
  
  // 惯性参数
  inertia: number;        // 惯性 0-1
  
  // 约束
  maxAngle: number;       // 最大摆动角度 (弧度)
  maxStretch: number;     // 最大拉伸比例
}

export interface WindConfig {
  enabled: boolean;
  direction: number;      // 风向 (弧度)
  strength: number;       // 风力 0-1
  turbulence: number;     // 湍流 0-1
  frequency: number;      // 变化频率 (ms)
}

export interface PhysicsConfig {
  enabled: boolean;
  timeStep: number;       // 物理步长 (ms)
  iterations: number;     // 约束迭代次数
  gravity: { x: number; y: number };  // 全局重力
  wind: WindConfig;
}

export interface PhysicsOutput {
  chainId: string;
  rotations: number[];    // 每个点的旋转角度
  offsets: Array<{ x: number; y: number }>;  // 每个点的位置偏移
}

export class PhysicsSimulator {
  private chains: Map<string, PhysicsChain> = new Map();
  private config: PhysicsConfig;
  private callbacks: Set<(outputs: PhysicsOutput[]) => void> = new Set();
  private animationId: number | null = null;
  private lastUpdate: number = 0;
  private windPhase: number = 0;
  private headPosition: { x: number; y: number } = { x: 0, y: 0 };
  private headVelocity: { x: number; y: number } = { x: 0, y: 0 };
  private isDestroyed: boolean = false;
  private accumulator: number = 0;

  constructor(config?: Partial<PhysicsConfig>) {
    this.config = {
      enabled: true,
      timeStep: 16.67,    // 60fps
      iterations: 3,
      gravity: { x: 0, y: 9.8 },
      wind: {
        enabled: false,
        direction: 0,
        strength: 0.3,
        turbulence: 0.2,
        frequency: 2000
      },
      ...config
    };
  }

  /**
   * 添加物理链（如头发、配饰）
   */
  addChain(id: string, name: string, pointCount: number, config?: Partial<ChainConfig>): void {
    const chainConfig: ChainConfig = {
      stiffness: 0.8,
      damping: 0.5,
      mass: 1,
      gravity: 0.5,
      inertia: 0.3,
      maxAngle: Math.PI / 4,
      maxStretch: 0.2,
      ...config
    };

    const points: PhysicsPoint[] = [];
    for (let i = 0; i < pointCount; i++) {
      points.push({
        x: 0,
        y: i * 10,  // 初始垂直分布
        vx: 0,
        vy: 0
      });
    }

    this.chains.set(id, { id, name, points, config: chainConfig });
  }

  /**
   * 移除物理链
   */
  removeChain(id: string): boolean {
    return this.chains.delete(id);
  }

  /**
   * 获取物理链
   */
  getChain(id: string): PhysicsChain | undefined {
    const chain = this.chains.get(id);
    if (!chain) return undefined;
    
    // 返回深拷贝
    return {
      ...chain,
      points: chain.points.map(p => ({ ...p })),
      config: { ...chain.config }
    };
  }

  /**
   * 获取所有物理链
   */
  getAllChains(): PhysicsChain[] {
    return Array.from(this.chains.values()).map(chain => ({
      ...chain,
      points: chain.points.map(p => ({ ...p })),
      config: { ...chain.config }
    }));
  }

  /**
   * 更新头部位置（用于惯性跟随）
   */
  updateHeadPosition(x: number, y: number): void {
    const dt = 0.016;  // 假设 60fps
    this.headVelocity.x = (x - this.headPosition.x) / dt;
    this.headVelocity.y = (y - this.headPosition.y) / dt;
    this.headPosition.x = x;
    this.headPosition.y = y;
  }

  /**
   * 设置风力
   */
  setWind(direction: number, strength: number): void {
    this.config.wind.direction = direction;
    this.config.wind.strength = strength;
  }

  /**
   * 启用/禁用风
   */
  setWindEnabled(enabled: boolean): void {
    this.config.wind.enabled = enabled;
  }

  /**
   * 应用瞬时力（如突然转头）
   */
  applyImpulse(force: { x: number; y: number }): void {
    for (const chain of this.chains.values()) {
      for (let i = 1; i < chain.points.length; i++) {
        const point = chain.points[i];
        const strength = (i / chain.points.length) * chain.config.inertia;
        point.vx += force.x * strength;
        point.vy += force.y * strength;
      }
    }
  }

  /**
   * 启动模拟
   */
  start(): void {
    if (this.animationId !== null || this.isDestroyed || !this.config.enabled) return;
    this.lastUpdate = performance.now();
    this.tick();
  }

  /**
   * 停止模拟
   */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * 重置所有物理状态
   */
  reset(): void {
    for (const chain of this.chains.values()) {
      for (let i = 0; i < chain.points.length; i++) {
        chain.points[i] = {
          x: 0,
          y: i * 10,
          vx: 0,
          vy: 0
        };
      }
    }
    this.headVelocity = { x: 0, y: 0 };
    this.windPhase = 0;
    this.accumulator = 0;
  }

  private tick = (): void => {
    if (this.isDestroyed) return;

    const now = performance.now();
    let deltaTime = now - this.lastUpdate;
    this.lastUpdate = now;

    // 限制最大 deltaTime 防止跳帧
    deltaTime = Math.min(deltaTime, 100);

    // 使用固定时间步长累积器
    this.accumulator += deltaTime;

    while (this.accumulator >= this.config.timeStep) {
      this.simulate(this.config.timeStep / 1000);
      this.accumulator -= this.config.timeStep;
    }

    // 通知回调
    this.notifyCallbacks();

    this.animationId = requestAnimationFrame(this.tick);
  };

  private simulate(dt: number): void {
    // 更新风
    if (this.config.wind.enabled) {
      this.windPhase += dt * 1000 / this.config.wind.frequency * Math.PI * 2;
    }

    for (const chain of this.chains.values()) {
      this.simulateChain(chain, dt);
    }
  }

  private simulateChain(chain: PhysicsChain, dt: number): void {
    const config = chain.config;
    const points = chain.points;

    // 第一个点固定在头部
    points[0].x = this.headPosition.x;
    points[0].y = this.headPosition.y;

    // 对其他点应用物理
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      const prevPoint = points[i - 1];

      // 计算力

      // 1. 重力
      const gravityForce = {
        x: this.config.gravity.x * config.gravity * config.mass,
        y: this.config.gravity.y * config.gravity * config.mass
      };

      // 2. 弹簧力（向前一个点）
      const dx = point.x - prevPoint.x;
      const dy = point.y - prevPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const restLength = 10;  // 静止长度
      const springForce = {
        x: -config.stiffness * (distance - restLength) * (dx / distance || 0),
        y: -config.stiffness * (distance - restLength) * (dy / distance || 0)
      };

      // 3. 阻尼力
      const dampingForce = {
        x: -config.damping * point.vx,
        y: -config.damping * point.vy
      };

      // 4. 风力
      let windForce = { x: 0, y: 0 };
      if (this.config.wind.enabled) {
        const windDir = this.config.wind.direction;
        const windStrength = this.config.wind.strength;
        const turbulence = Math.sin(this.windPhase + i * 0.5) * this.config.wind.turbulence;
        
        windForce = {
          x: Math.cos(windDir) * (windStrength + turbulence) * config.mass,
          y: Math.sin(windDir) * (windStrength + turbulence) * config.mass
        };
      }

      // 5. 惯性力（头部移动的反向力）
      const inertiaForce = {
        x: -this.headVelocity.x * config.inertia * (i / points.length),
        y: -this.headVelocity.y * config.inertia * (i / points.length)
      };

      // 合力
      const totalForce = {
        x: gravityForce.x + springForce.x + dampingForce.x + windForce.x + inertiaForce.x,
        y: gravityForce.y + springForce.y + dampingForce.y + windForce.y + inertiaForce.y
      };

      // 加速度
      const ax = totalForce.x / config.mass;
      const ay = totalForce.y / config.mass;

      // 更新速度和位置（半隐式欧拉）
      point.vx += ax * dt;
      point.vy += ay * dt;
      point.x += point.vx * dt;
      point.y += point.vy * dt;
    }

    // 约束迭代
    for (let iter = 0; iter < this.config.iterations; iter++) {
      this.applyConstraints(chain);
    }
  }

  private applyConstraints(chain: PhysicsChain): void {
    const config = chain.config;
    const points = chain.points;

    // 距离约束
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      const prevPoint = points[i - 1];

      const dx = point.x - prevPoint.x;
      const dy = point.y - prevPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const restLength = 10;
      const maxLength = restLength * (1 + config.maxStretch);
      const minLength = restLength * (1 - config.maxStretch);

      if (distance > maxLength || distance < minLength) {
        const targetLength = distance > maxLength ? maxLength : minLength;
        const correction = (distance - targetLength) / distance;
        
        // 只移动当前点（前一个点可能是固定的）
        point.x -= dx * correction;
        point.y -= dy * correction;
      }
    }

    // 角度约束
    for (let i = 2; i < points.length; i++) {
      const p0 = points[i - 2];
      const p1 = points[i - 1];
      const p2 = points[i];

      const v1 = { x: p1.x - p0.x, y: p1.y - p0.y };
      const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };

      const angle = Math.atan2(
        v1.x * v2.y - v1.y * v2.x,
        v1.x * v2.x + v1.y * v2.y
      );

      if (Math.abs(angle) > config.maxAngle) {
        const targetAngle = config.maxAngle * Math.sign(angle);
        const correction = angle - targetAngle;

        // 旋转 p2 点
        const cos = Math.cos(-correction);
        const sin = Math.sin(-correction);
        const rx = v2.x * cos - v2.y * sin;
        const ry = v2.x * sin + v2.y * cos;

        p2.x = p1.x + rx;
        p2.y = p1.y + ry;
      }
    }
  }

  /**
   * 计算输出
   */
  getOutputs(): PhysicsOutput[] {
    const outputs: PhysicsOutput[] = [];

    for (const chain of this.chains.values()) {
      const rotations: number[] = [];
      const offsets: Array<{ x: number; y: number }> = [];

      for (let i = 0; i < chain.points.length; i++) {
        const point = chain.points[i];
        
        // 计算旋转角度
        let rotation = 0;
        if (i > 0) {
          const prev = chain.points[i - 1];
          rotation = Math.atan2(point.x - prev.x, point.y - prev.y);
        }
        rotations.push(rotation);

        // 计算位置偏移
        const restX = 0;
        const restY = i * 10;
        offsets.push({
          x: point.x - restX - this.headPosition.x,
          y: point.y - restY - this.headPosition.y
        });
      }

      outputs.push({
        chainId: chain.id,
        rotations,
        offsets
      });
    }

    return outputs;
  }

  /**
   * 订阅物理输出
   */
  onUpdate(callback: (outputs: PhysicsOutput[]) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyCallbacks(): void {
    const outputs = this.getOutputs();
    for (const callback of this.callbacks) {
      try {
        callback(outputs);
      } catch (e) {
        console.error('[PhysicsSimulator] Callback error:', e);
      }
    }
  }

  /**
   * 获取配置
   */
  getConfig(): PhysicsConfig {
    return {
      ...this.config,
      wind: { ...this.config.wind },
      gravity: { ...this.config.gravity }
    };
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<PhysicsConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      wind: { ...this.config.wind, ...(config.wind || {}) },
      gravity: { ...this.config.gravity, ...(config.gravity || {}) }
    };
  }

  /**
   * 更新物理链配置
   */
  setChainConfig(id: string, config: Partial<ChainConfig>): boolean {
    const chain = this.chains.get(id);
    if (!chain) return false;
    chain.config = { ...chain.config, ...config };
    return true;
  }

  /**
   * 获取物理链数量
   */
  getChainCount(): number {
    return this.chains.size;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.isDestroyed = true;
    this.stop();
    this.chains.clear();
    this.callbacks.clear();
  }
}
