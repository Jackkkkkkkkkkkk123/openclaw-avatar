/**
 * PhysicsSimulation 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PhysicsSimulation,
  PRESET_CHAINS,
  type Vector2,
  type WindConfig,
  type PhysicsChain,
} from './PhysicsSimulation';

describe('PhysicsSimulation', () => {
  let physics: PhysicsSimulation;
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let rafId: number;
  let originalRaf: typeof requestAnimationFrame;
  let originalCaf: typeof cancelAnimationFrame;
  let originalPerformanceNow: typeof performance.now;

  beforeEach(() => {
    rafCallbacks = new Map();
    rafId = 0;

    originalRaf = globalThis.requestAnimationFrame;
    originalCaf = globalThis.cancelAnimationFrame;
    originalPerformanceNow = performance.now;

    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = ++rafId;
      rafCallbacks.set(id, callback);
      return id;
    });

    globalThis.cancelAnimationFrame = vi.fn((id: number) => {
      rafCallbacks.delete(id);
    });

    let mockTime = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => mockTime);

    physics = new PhysicsSimulation();
  });

  afterEach(() => {
    physics.destroy();
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCaf;
    vi.restoreAllMocks();
  });

  // 辅助函数：推进时间
  const advanceTime = (ms: number) => {
    const currentTime = performance.now();
    vi.spyOn(performance, 'now').mockReturnValue(currentTime + ms);
    
    // 执行所有待处理的 RAF 回调
    const callbacks = Array.from(rafCallbacks.entries());
    rafCallbacks.clear();
    for (const [id, callback] of callbacks) {
      callback(currentTime + ms);
    }
  };

  describe('构造函数', () => {
    it('应该使用默认配置创建', () => {
      expect(physics).toBeDefined();
      expect(physics.isActive()).toBe(false);
    });

    it('应该接受自定义配置', () => {
      const customPhysics = new PhysicsSimulation({
        enabled: false,
        timeScale: 2.0,
        gravity: { x: 0.5, y: 0.5 },
      });

      expect(customPhysics).toBeDefined();
      customPhysics.destroy();
    });
  });

  describe('createChain', () => {
    it('应该创建基本物理链', () => {
      const chain = physics.createChain(
        'test_chain',
        'Test',
        { x: 0, y: 0 },
        null
      );

      expect(chain).toBeDefined();
      expect(chain.id).toBe('test_chain');
      expect(chain.name).toBe('Test');
      expect(chain.points.length).toBeGreaterThan(0);
      expect(chain.enabled).toBe(true);
    });

    it('应该使用预设配置创建', () => {
      const chain = physics.createChain(
        'twintail',
        'TwintailLeft',
        { x: -0.5, y: -0.3 },
        'twintail_left'
      );

      expect(chain.points.length).toBe(PRESET_CHAINS.twintail_left.pointCount);
      expect(chain.springConfig.stiffness).toBe(PRESET_CHAINS.twintail_left.springConfig.stiffness);
    });

    it('应该正确设置锚点位置', () => {
      const anchor: Vector2 = { x: 0.5, y: 0.2 };
      const chain = physics.createChain('test', 'Test', anchor, null);

      const fixedPoint = chain.points.find(p => p.isFixed);
      expect(fixedPoint).toBeDefined();
      expect(fixedPoint!.position.x).toBe(anchor.x);
      expect(fixedPoint!.position.y).toBe(anchor.y);
    });

    it('应该第一个点为固定点', () => {
      const chain = physics.createChain('test', 'Test', { x: 0, y: 0 }, null);

      expect(chain.points[0].isFixed).toBe(true);
      expect(chain.points[1].isFixed).toBe(false);
    });

    it('应该使用自定义点数', () => {
      const chain = physics.createChain(
        'test',
        'Test',
        { x: 0, y: 0 },
        null,
        { pointCount: 10 }
      );

      expect(chain.points.length).toBe(10);
    });

    it('应该使用自定义弹簧配置', () => {
      const customSpring = {
        stiffness: 0.8,
        damping: 0.9,
        mass: 2.0,
        restLength: 0.2,
      };

      const chain = physics.createChain(
        'test',
        'Test',
        { x: 0, y: 0 },
        null,
        { springConfig: customSpring }
      );

      expect(chain.springConfig).toEqual(customSpring);
    });

    it('应该使用自定义方向', () => {
      const direction = { x: 1, y: 0 }; // 水平方向
      const chain = physics.createChain(
        'test',
        'Test',
        { x: 0, y: 0 },
        null,
        { direction, pointCount: 3 }
      );

      // 点应该沿水平方向排列
      expect(chain.points[1].position.x).toBeGreaterThan(chain.points[0].position.x);
      expect(Math.abs(chain.points[1].position.y - chain.points[0].position.y)).toBeLessThan(0.01);
    });

    it('应该质量末端递减', () => {
      const chain = physics.createChain('test', 'Test', { x: 0, y: 0 }, null, { pointCount: 5 });

      // 末端质量应该小于首端
      const firstNonFixedMass = chain.points[1].mass;
      const lastMass = chain.points[chain.points.length - 1].mass;
      expect(lastMass).toBeLessThan(firstNonFixedMass);
    });
  });

  describe('removeChain', () => {
    it('应该移除已存在的链', () => {
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null);
      expect(physics.getChain('test')).toBeDefined();

      const result = physics.removeChain('test');
      expect(result).toBe(true);
      expect(physics.getChain('test')).toBeUndefined();
    });

    it('应该返回 false 如果链不存在', () => {
      const result = physics.removeChain('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getChain', () => {
    it('应该返回已存在的链', () => {
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null);
      const chain = physics.getChain('test');

      expect(chain).toBeDefined();
      expect(chain!.id).toBe('test');
    });

    it('应该返回 undefined 如果链不存在', () => {
      const chain = physics.getChain('nonexistent');
      expect(chain).toBeUndefined();
    });
  });

  describe('getAllChains', () => {
    it('应该返回所有链', () => {
      physics.createChain('chain1', 'Chain1', { x: 0, y: 0 }, null);
      physics.createChain('chain2', 'Chain2', { x: 1, y: 0 }, null);

      const chains = physics.getAllChains();
      expect(chains.length).toBe(2);
    });

    it('应该返回空数组如果没有链', () => {
      const chains = physics.getAllChains();
      expect(chains).toEqual([]);
    });
  });

  describe('setAnchorPosition', () => {
    it('应该更新锚点位置', () => {
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null);
      physics.setAnchorPosition('test', { x: 0.5, y: 0.5 });

      const chain = physics.getChain('test');
      const fixedPoint = chain!.points.find(p => p.isFixed);
      expect(fixedPoint!.position).toEqual({ x: 0.5, y: 0.5 });
    });

    it('应该忽略不存在的链', () => {
      // 不应该抛出异常
      physics.setAnchorPosition('nonexistent', { x: 0, y: 0 });
    });
  });

  describe('setWind / getWind', () => {
    it('应该设置风力', () => {
      physics.setWind({ strength: 0.5, direction: { x: 1, y: 0 } });
      const wind = physics.getWind();

      expect(wind.strength).toBe(0.5);
      expect(wind.direction).toEqual({ x: 1, y: 0 });
    });

    it('应该部分更新风力配置', () => {
      const initialWind = physics.getWind();
      physics.setWind({ strength: 0.8 });
      const newWind = physics.getWind();

      expect(newWind.strength).toBe(0.8);
      expect(newWind.direction).toEqual(initialWind.direction);
    });

    it('应该返回风力配置副本', () => {
      const wind1 = physics.getWind();
      const wind2 = physics.getWind();
      expect(wind1).not.toBe(wind2);
    });
  });

  describe('applyImpulse', () => {
    it('应该对所有非固定点应用冲击力', () => {
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null, { pointCount: 3 });
      
      const chainBefore = physics.getChain('test')!;
      const velocityBefore = chainBefore.points[1].velocity.x;

      physics.applyImpulse('test', { x: 1, y: 0 });

      const chainAfter = physics.getChain('test')!;
      expect(chainAfter.points[1].velocity.x).toBeGreaterThan(velocityBefore);
    });

    it('应该不影响固定点', () => {
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null);
      physics.applyImpulse('test', { x: 1, y: 0 });

      const chain = physics.getChain('test')!;
      expect(chain.points[0].velocity).toEqual({ x: 0, y: 0 });
    });

    it('应该对指定点应用冲击力', () => {
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null, { pointCount: 5 });
      physics.applyImpulse('test', { x: 1, y: 0 }, 2);

      const chain = physics.getChain('test')!;
      expect(chain.points[2].velocity.x).toBeGreaterThan(0);
      expect(chain.points[3].velocity.x).toBe(0);
    });

    it('应该忽略不存在的链', () => {
      // 不应该抛出异常
      physics.applyImpulse('nonexistent', { x: 1, y: 0 });
    });
  });

  describe('start / stop / isActive', () => {
    it('应该启动物理模拟', () => {
      physics.start();
      expect(physics.isActive()).toBe(true);
    });

    it('应该停止物理模拟', () => {
      physics.start();
      physics.stop();
      expect(physics.isActive()).toBe(false);
    });

    it('应该不重复启动', () => {
      physics.start();
      physics.start(); // 重复调用
      expect(physics.isActive()).toBe(true);
    });

    it('应该取消动画帧', () => {
      physics.start();
      physics.stop();
      expect(cancelAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('onUpdate', () => {
    it('应该订阅更新回调', () => {
      const callback = vi.fn();
      physics.onUpdate(callback);

      physics.createChain('test', 'Test', { x: 0, y: 0 }, null);
      physics.start();
      advanceTime(16);

      expect(callback).toHaveBeenCalled();
    });

    it('应该返回取消订阅函数', () => {
      const callback = vi.fn();
      const unsubscribe = physics.onUpdate(callback);

      unsubscribe();
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null);
      physics.start();
      advanceTime(16);

      expect(callback).not.toHaveBeenCalled();
    });

    it('应该传递状态给回调', () => {
      const callback = vi.fn();
      physics.onUpdate(callback);

      physics.createChain('test', 'Test', { x: 0, y: 0 }, null);
      physics.start();
      advanceTime(16);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        chains: expect.any(Object),
        wind: expect.any(Object),
        time: expect.any(Number),
        deltaTime: expect.any(Number),
      }));
    });
  });

  describe('getState', () => {
    it('应该返回当前状态', () => {
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null);
      const state = physics.getState();

      expect(state.chains).toBeDefined();
      expect(state.chains['test']).toBeDefined();
      expect(state.wind).toBeDefined();
      expect(state.time).toBe(0);
    });

    it('应该返回状态副本', () => {
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null);
      const state1 = physics.getState();
      const state2 = physics.getState();

      expect(state1).not.toBe(state2);
    });
  });

  describe('reset', () => {
    it('应该重置物理状态', () => {
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null);
      physics.applyImpulse('test', { x: 1, y: 1 });
      physics.start();
      advanceTime(100);
      physics.stop();

      physics.reset();

      const chain = physics.getChain('test')!;
      // 速度应该被重置
      for (const point of chain.points) {
        expect(point.velocity).toEqual({ x: 0, y: 0 });
      }
    });

    it('应该重置时间', () => {
      physics.start();
      advanceTime(1000);
      physics.stop();

      physics.reset();
      const state = physics.getState();
      expect(state.time).toBe(0);
    });
  });

  describe('setEnabled / setChainEnabled', () => {
    it('应该设置全局启用状态', () => {
      const callback = vi.fn();
      physics.onUpdate(callback);
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null);

      physics.setEnabled(false);
      physics.start();
      advanceTime(16);

      // 禁用时不应该触发更新回调
      expect(callback).not.toHaveBeenCalled();
    });

    it('应该设置单个链的启用状态', () => {
      physics.createChain('chain1', 'Chain1', { x: 0, y: 0 }, null);
      physics.createChain('chain2', 'Chain2', { x: 1, y: 0 }, null);

      physics.setChainEnabled('chain1', false);

      const chain1 = physics.getChain('chain1')!;
      const chain2 = physics.getChain('chain2')!;

      expect(chain1.enabled).toBe(false);
      expect(chain2.enabled).toBe(true);
    });
  });

  describe('getChainPositions', () => {
    it('应该返回链的位置数组', () => {
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null, { pointCount: 3 });
      const positions = physics.getChainPositions('test');

      expect(positions.length).toBe(3);
      expect(positions[0]).toHaveProperty('x');
      expect(positions[0]).toHaveProperty('y');
    });

    it('应该返回空数组如果链不存在', () => {
      const positions = physics.getChainPositions('nonexistent');
      expect(positions).toEqual([]);
    });

    it('应该返回位置副本', () => {
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null);
      const pos1 = physics.getChainPositions('test');
      const pos2 = physics.getChainPositions('test');

      expect(pos1[0]).not.toBe(pos2[0]);
    });
  });

  describe('getLive2DParams', () => {
    it('应该返回 Live2D 参数', () => {
      physics.createChain('test', 'Hair', { x: 0, y: 0 }, null, { pointCount: 4 });
      const params = physics.getLive2DParams('test');

      expect(params).toHaveProperty('ParamHairSwingX');
      expect(params).toHaveProperty('ParamHairSwingY');
    });

    it('应该返回角度参数', () => {
      physics.createChain('test', 'Hair', { x: 0, y: 0 }, null, { pointCount: 4 });
      const params = physics.getLive2DParams('test');

      expect(params).toHaveProperty('ParamHairAngle1');
      expect(params).toHaveProperty('ParamHairAngle2');
      expect(params).toHaveProperty('ParamHairAngle3');
    });

    it('应该返回空对象如果链不存在', () => {
      const params = physics.getLive2DParams('nonexistent');
      expect(params).toEqual({});
    });

    it('应该返回空对象如果点数不足', () => {
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null, { pointCount: 1 });
      const params = physics.getLive2DParams('test');
      expect(params).toEqual({});
    });

    it('应该将角度归一化到 -1 ~ 1', () => {
      physics.createChain('test', 'Hair', { x: 0, y: 0 }, null, { pointCount: 3 });
      const params = physics.getLive2DParams('test');

      for (const key of Object.keys(params)) {
        if (key.includes('Angle') || key.includes('Swing')) {
          expect(params[key]).toBeGreaterThanOrEqual(-1);
          expect(params[key]).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('destroy', () => {
    it('应该停止模拟', () => {
      physics.start();
      physics.destroy();
      expect(physics.isActive()).toBe(false);
    });

    it('应该清除所有链', () => {
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null);
      physics.destroy();

      expect(physics.getAllChains()).toEqual([]);
    });

    it('应该清除回调', () => {
      const callback = vi.fn();
      physics.onUpdate(callback);
      physics.destroy();

      // 重新创建后不应该触发旧回调
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null);
      physics.start();
      advanceTime(16);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('物理模拟行为', () => {
    it('应该在重力作用下下落', () => {
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null, { 
        pointCount: 3,
        gravity: 1.0,
      });

      const initialY = physics.getChain('test')!.points[2].position.y;

      physics.start();
      advanceTime(100);
      physics.stop();

      const finalY = physics.getChain('test')!.points[2].position.y;
      expect(finalY).toBeGreaterThan(initialY);
    });

    it('应该响应风力', () => {
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null, { pointCount: 3 });
      physics.setWind({ strength: 1.0, direction: { x: 1, y: 0 } });

      const initialX = physics.getChain('test')!.points[2].position.x;

      physics.start();
      advanceTime(100);
      physics.stop();

      const finalX = physics.getChain('test')!.points[2].position.x;
      expect(finalX).toBeGreaterThan(initialX);
    });

    it('应该保持链的连接', () => {
      physics.createChain('test', 'Test', { x: 0, y: 0 }, null, {
        pointCount: 5,
        springConfig: { stiffness: 0.5, damping: 0.5, mass: 1, restLength: 0.1 },
      });

      physics.applyImpulse('test', { x: 2, y: 2 });
      physics.start();
      advanceTime(500);
      physics.stop();

      const chain = physics.getChain('test')!;
      for (let i = 0; i < chain.points.length - 1; i++) {
        const p1 = chain.points[i];
        const p2 = chain.points[i + 1];
        const distance = Math.sqrt(
          (p2.position.x - p1.position.x) ** 2 +
          (p2.position.y - p1.position.y) ** 2
        );
        // 不应该拉伸超过静止长度的 1.5 倍太多
        expect(distance).toBeLessThan(chain.springConfig.restLength * 2);
      }
    });
  });

  describe('PRESET_CHAINS', () => {
    it('应该包含双马尾预设', () => {
      expect(PRESET_CHAINS.twintail_left).toBeDefined();
      expect(PRESET_CHAINS.twintail_right).toBeDefined();
    });

    it('应该包含刘海预设', () => {
      expect(PRESET_CHAINS.bangs).toBeDefined();
    });

    it('应该包含配饰预设', () => {
      expect(PRESET_CHAINS.accessory).toBeDefined();
    });

    it('应该包含裙摆预设', () => {
      expect(PRESET_CHAINS.skirt).toBeDefined();
    });

    it('应该包含飘带预设', () => {
      expect(PRESET_CHAINS.ribbon).toBeDefined();
    });

    it('所有预设应该有必需字段', () => {
      for (const [name, preset] of Object.entries(PRESET_CHAINS)) {
        expect(preset.pointCount).toBeGreaterThan(0);
        expect(preset.springConfig).toBeDefined();
        expect(preset.gravity).toBeDefined();
        expect(preset.airResistance).toBeDefined();
      }
    });
  });
});
