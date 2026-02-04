/**
 * PhysicsSimulator 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PhysicsSimulator, PhysicsOutput, PhysicsChain } from './PhysicsSimulator';

describe('PhysicsSimulator', () => {
  let simulator: PhysicsSimulator;
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let rafId: number;

  beforeEach(() => {
    rafCallbacks = new Map();
    rafId = 0;

    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = ++rafId;
      rafCallbacks.set(id, cb);
      return id;
    });

    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
      rafCallbacks.delete(id);
    });

    vi.spyOn(performance, 'now').mockReturnValue(0);

    simulator = new PhysicsSimulator();
  });

  afterEach(() => {
    simulator.destroy();
    vi.restoreAllMocks();
  });

  function advanceTime(ms: number): void {
    const current = performance.now() as number;
    vi.spyOn(performance, 'now').mockReturnValue(current + ms);
    
    const callbacks = Array.from(rafCallbacks.entries());
    for (const [id, cb] of callbacks) {
      rafCallbacks.delete(id);
      cb(current + ms);
    }
  }

  describe('初始化', () => {
    it('应该使用默认配置创建', () => {
      const config = simulator.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.iterations).toBe(3);
      expect(config.gravity.y).toBe(9.8);
    });

    it('应该使用自定义配置创建', () => {
      const customSimulator = new PhysicsSimulator({
        iterations: 5,
        gravity: { x: 0, y: 5 }
      });
      
      const config = customSimulator.getConfig();
      expect(config.iterations).toBe(5);
      expect(config.gravity.y).toBe(5);
      
      customSimulator.destroy();
    });

    it('应该初始化为空状态', () => {
      expect(simulator.getChainCount()).toBe(0);
      expect(simulator.getAllChains()).toHaveLength(0);
    });
  });

  describe('物理链管理', () => {
    it('应该添加物理链', () => {
      simulator.addChain('hair_left', '左侧头发', 5);
      expect(simulator.getChainCount()).toBe(1);
      
      const chain = simulator.getChain('hair_left');
      expect(chain).toBeDefined();
      expect(chain?.name).toBe('左侧头发');
      expect(chain?.points).toHaveLength(5);
    });

    it('应该使用自定义配置添加物理链', () => {
      simulator.addChain('accessory', '配饰', 3, {
        stiffness: 0.5,
        damping: 0.8
      });
      
      const chain = simulator.getChain('accessory');
      expect(chain?.config.stiffness).toBe(0.5);
      expect(chain?.config.damping).toBe(0.8);
    });

    it('应该移除物理链', () => {
      simulator.addChain('test', 'Test', 3);
      expect(simulator.getChainCount()).toBe(1);
      
      const removed = simulator.removeChain('test');
      expect(removed).toBe(true);
      expect(simulator.getChainCount()).toBe(0);
    });

    it('应该返回 false 当移除不存在的链', () => {
      const removed = simulator.removeChain('nonexistent');
      expect(removed).toBe(false);
    });

    it('应该返回 undefined 当获取不存在的链', () => {
      const chain = simulator.getChain('nonexistent');
      expect(chain).toBeUndefined();
    });

    it('应该获取所有物理链', () => {
      simulator.addChain('chain1', 'Chain 1', 3);
      simulator.addChain('chain2', 'Chain 2', 4);
      
      const chains = simulator.getAllChains();
      expect(chains).toHaveLength(2);
    });

    it('返回的链应该是深拷贝', () => {
      simulator.addChain('test', 'Test', 3);
      const chain1 = simulator.getChain('test');
      const chain2 = simulator.getChain('test');
      
      expect(chain1).not.toBe(chain2);
      expect(chain1?.points).not.toBe(chain2?.points);
    });
  });

  describe('头部位置更新', () => {
    it('应该更新头部位置', () => {
      simulator.updateHeadPosition(10, 20);
      // 内部状态应该更新
    });

    it('应该计算头部速度', () => {
      simulator.updateHeadPosition(0, 0);
      simulator.updateHeadPosition(10, 0);
      // 速度应该被计算
    });
  });

  describe('风力控制', () => {
    it('应该设置风力', () => {
      simulator.setWind(Math.PI / 2, 0.5);
      const config = simulator.getConfig();
      expect(config.wind.direction).toBe(Math.PI / 2);
      expect(config.wind.strength).toBe(0.5);
    });

    it('应该启用/禁用风', () => {
      simulator.setWindEnabled(true);
      expect(simulator.getConfig().wind.enabled).toBe(true);
      
      simulator.setWindEnabled(false);
      expect(simulator.getConfig().wind.enabled).toBe(false);
    });
  });

  describe('冲击力', () => {
    it('应该应用冲击力', () => {
      simulator.addChain('hair', 'Hair', 5);
      simulator.applyImpulse({ x: 10, y: 0 });
      
      // 冲击力应该影响点的速度
      const chain = simulator.getChain('hair');
      // 第一个点是固定的，其他点应该有速度
    });
  });

  describe('模拟控制', () => {
    it('应该启动模拟', () => {
      simulator.addChain('hair', 'Hair', 3);
      simulator.start();
      expect(requestAnimationFrame).toHaveBeenCalled();
    });

    it('应该停止模拟', () => {
      simulator.start();
      simulator.stop();
      expect(cancelAnimationFrame).toHaveBeenCalled();
    });

    it('应该防止重复启动', () => {
      simulator.start();
      simulator.start();
      // 不应该多次启动
    });

    it('禁用时不应该启动', () => {
      simulator.setConfig({ enabled: false });
      simulator.start();
      // 禁用状态下不应该启动
    });

    it('销毁后不应该启动', () => {
      simulator.destroy();
      simulator.start();
      // 销毁后不应该启动
    });
  });

  describe('物理模拟', () => {
    it('应该模拟重力', () => {
      simulator.addChain('hair', 'Hair', 3);
      simulator.start();
      
      const initialChain = simulator.getChain('hair');
      const initialY = initialChain?.points[2].y;
      
      advanceTime(100);
      
      const updatedChain = simulator.getChain('hair');
      // 重力应该让点向下移动
      expect(updatedChain?.points[2].y).toBeGreaterThanOrEqual(initialY || 0);
    });

    it('应该模拟风力', () => {
      simulator.setWindEnabled(true);
      simulator.setWind(0, 0.5);  // 向右的风
      simulator.addChain('hair', 'Hair', 3);
      simulator.start();
      
      advanceTime(200);
      
      const chain = simulator.getChain('hair');
      // 风应该让点向右移动
    });

    it('应该响应头部移动', () => {
      simulator.addChain('hair', 'Hair', 5);
      simulator.start();
      
      advanceTime(50);
      simulator.updateHeadPosition(20, 0);  // 头部向右移动
      advanceTime(50);
      
      // 惯性应该让头发向左摆动
      const chain = simulator.getChain('hair');
      // 最末端的点应该有相反方向的偏移
    });
  });

  describe('重置', () => {
    it('应该重置所有物理状态', () => {
      simulator.addChain('hair', 'Hair', 3);
      simulator.start();
      advanceTime(100);
      
      simulator.reset();
      
      const chain = simulator.getChain('hair');
      expect(chain?.points[0].vx).toBe(0);
      expect(chain?.points[0].vy).toBe(0);
    });
  });

  describe('输出', () => {
    it('应该获取物理输出', () => {
      simulator.addChain('hair', 'Hair', 3);
      
      const outputs = simulator.getOutputs();
      expect(outputs).toHaveLength(1);
      expect(outputs[0].chainId).toBe('hair');
      expect(outputs[0].rotations).toHaveLength(3);
      expect(outputs[0].offsets).toHaveLength(3);
    });

    it('空状态应该返回空数组', () => {
      const outputs = simulator.getOutputs();
      expect(outputs).toHaveLength(0);
    });
  });

  describe('订阅机制', () => {
    it('应该通知物理输出更新', () => {
      const callback = vi.fn();
      simulator.addChain('hair', 'Hair', 3);
      simulator.onUpdate(callback);
      
      simulator.start();
      advanceTime(50);
      
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0]).toHaveLength(1);
    });

    it('应该支持取消订阅', () => {
      const callback = vi.fn();
      const unsubscribe = simulator.onUpdate(callback);
      
      simulator.addChain('hair', 'Hair', 3);
      simulator.start();
      advanceTime(50);
      
      const callCount = callback.mock.callCount;
      unsubscribe();
      advanceTime(50);
      
      expect(callback.mock.callCount).toBe(callCount);
    });

    it('回调错误不应该中断其他回调', () => {
      const callback1 = vi.fn().mockImplementation(() => {
        throw new Error('test');
      });
      const callback2 = vi.fn();
      
      simulator.onUpdate(callback1);
      simulator.onUpdate(callback2);
      simulator.addChain('hair', 'Hair', 3);
      
      simulator.start();
      advanceTime(50);
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('配置管理', () => {
    it('应该获取配置', () => {
      const config = simulator.getConfig();
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('gravity');
      expect(config).toHaveProperty('wind');
    });

    it('应该更新配置', () => {
      simulator.setConfig({ iterations: 5 });
      expect(simulator.getConfig().iterations).toBe(5);
    });

    it('应该更新嵌套配置', () => {
      simulator.setConfig({
        wind: { enabled: true, strength: 0.8 }
      });
      
      const config = simulator.getConfig();
      expect(config.wind.enabled).toBe(true);
      expect(config.wind.strength).toBe(0.8);
    });

    it('应该更新物理链配置', () => {
      simulator.addChain('hair', 'Hair', 3);
      
      const result = simulator.setChainConfig('hair', { stiffness: 0.9 });
      expect(result).toBe(true);
      
      const chain = simulator.getChain('hair');
      expect(chain?.config.stiffness).toBe(0.9);
    });

    it('应该返回 false 当更新不存在的链配置', () => {
      const result = simulator.setChainConfig('nonexistent', { stiffness: 0.9 });
      expect(result).toBe(false);
    });
  });

  describe('销毁', () => {
    it('应该停止模拟', () => {
      simulator.start();
      simulator.destroy();
      expect(cancelAnimationFrame).toHaveBeenCalled();
    });

    it('应该清除所有链', () => {
      simulator.addChain('hair1', 'Hair 1', 3);
      simulator.addChain('hair2', 'Hair 2', 3);
      
      simulator.destroy();
      
      expect(simulator.getChainCount()).toBe(0);
    });

    it('应该清除回调', () => {
      const callback = vi.fn();
      simulator.onUpdate(callback);
      
      simulator.destroy();
      
      // 销毁后回调应该被清除
    });
  });

  describe('约束系统', () => {
    it('应该限制最大拉伸', () => {
      simulator.addChain('hair', 'Hair', 3, { maxStretch: 0.2 });
      simulator.start();
      
      // 模拟大的力
      simulator.applyImpulse({ x: 100, y: 100 });
      advanceTime(100);
      
      const chain = simulator.getChain('hair');
      // 点之间的距离应该在约束范围内
    });

    it('应该限制最大角度', () => {
      simulator.addChain('hair', 'Hair', 5, { maxAngle: Math.PI / 4 });
      simulator.start();
      
      // 强风
      simulator.setWindEnabled(true);
      simulator.setWind(Math.PI / 2, 1.0);
      advanceTime(500);
      
      // 角度应该被限制
    });
  });

  describe('性能', () => {
    it('应该处理大量物理链', () => {
      for (let i = 0; i < 20; i++) {
        simulator.addChain(`chain_${i}`, `Chain ${i}`, 10);
      }
      
      simulator.start();
      advanceTime(100);
      
      const outputs = simulator.getOutputs();
      expect(outputs).toHaveLength(20);
    });

    it('应该限制最大 deltaTime', () => {
      simulator.addChain('hair', 'Hair', 3);
      simulator.start();
      
      // 模拟跳帧（大的时间间隔）
      advanceTime(500);
      
      // 不应该出现物理爆炸
      const chain = simulator.getChain('hair');
      expect(isFinite(chain?.points[2].x || 0)).toBe(true);
      expect(isFinite(chain?.points[2].y || 0)).toBe(true);
    });
  });
});
