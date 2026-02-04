import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExpressionPaletteSystem, ExpressionWeight, PalettePreset } from './ExpressionPaletteSystem';

describe('ExpressionPaletteSystem', () => {
  let system: ExpressionPaletteSystem;
  let mockRaf: ReturnType<typeof vi.fn>;
  let rafCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafCallbacks = [];
    mockRaf = vi.fn((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    vi.stubGlobal('requestAnimationFrame', mockRaf);
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
      rafCallbacks.splice(id - 1, 1);
    }));

    system = new ExpressionPaletteSystem({
      smoothTransition: false  // 禁用动画便于测试
    });
  });

  afterEach(() => {
    system.destroy();
    vi.unstubAllGlobals();
  });

  function runAnimationFrames(count: number = 100): void {
    for (let i = 0; i < count && rafCallbacks.length > 0; i++) {
      const callbacks = [...rafCallbacks];
      rafCallbacks = [];
      callbacks.forEach(cb => cb(performance.now()));
    }
  }

  describe('基础功能', () => {
    it('应该能创建实例', () => {
      expect(system).toBeInstanceOf(ExpressionPaletteSystem);
    });

    it('应该使用默认配置', () => {
      const config = system.getConfig();
      expect(config.maxConcurrentExpressions).toBe(4);
      expect(config.autoNormalize).toBe(true);
      expect(config.conflictResolution).toBe('blend');
    });

    it('应该能更新配置', () => {
      system.updateConfig({ maxConcurrentExpressions: 6 });
      expect(system.getConfig().maxConcurrentExpressions).toBe(6);
    });
  });

  describe('表情设置', () => {
    it('应该能设置单个表情', () => {
      system.setExpression('happy', 0.8);
      const result = system.getBlendResult();
      
      expect(result.finalWeights.get('happy')).toBe(0.8);
    });

    it('权重为 0 时应该移除表情', () => {
      system.setExpression('happy', 0.8);
      system.setExpression('happy', 0);
      const result = system.getBlendResult();
      
      expect(result.finalWeights.has('happy')).toBe(false);
    });

    it('应该限制权重在 0-1 之间', () => {
      system.setExpression('happy', 1.5);
      let result = system.getBlendResult();
      expect(result.finalWeights.get('happy')).toBe(1);

      system.setExpression('sad', -0.5);
      result = system.getBlendResult();
      expect(result.finalWeights.has('sad')).toBe(false);
    });

    it('应该能设置多个表情', () => {
      system.setExpressions([
        { expression: 'happy', weight: 0.5 },
        { expression: 'surprised', weight: 0.3 }
      ]);
      const result = system.getBlendResult();
      
      expect(result.finalWeights.get('happy')).toBe(0.5);
      expect(result.finalWeights.get('surprised')).toBe(0.3);
    });

    it('setExpressions 应该替换而非追加', () => {
      system.setExpression('angry', 0.5);
      system.setExpressions([
        { expression: 'happy', weight: 0.5 }
      ]);
      const result = system.getBlendResult();
      
      expect(result.finalWeights.has('angry')).toBe(false);
      expect(result.finalWeights.get('happy')).toBe(0.5);
    });
  });

  describe('最大表情数限制', () => {
    it('应该限制同时激活的表情数', () => {
      system.updateConfig({ maxConcurrentExpressions: 2 });
      
      system.setExpressions([
        { expression: 'happy', weight: 0.8 },
        { expression: 'sad', weight: 0.6 },
        { expression: 'surprised', weight: 0.4 }
      ]);
      
      const result = system.getBlendResult();
      expect(result.finalWeights.size).toBeLessThanOrEqual(2);
    });

    it('应该保留权重最高的表情', () => {
      system.updateConfig({ maxConcurrentExpressions: 2 });
      
      system.setExpressions([
        { expression: 'happy', weight: 0.8 },
        { expression: 'sad', weight: 0.3 },
        { expression: 'surprised', weight: 0.6 }
      ]);
      
      const result = system.getBlendResult();
      expect(result.finalWeights.has('happy')).toBe(true);
      expect(result.finalWeights.has('surprised')).toBe(true);
      expect(result.finalWeights.has('sad')).toBe(false);
    });

    it('优先级高的表情应该优先保留', () => {
      system.updateConfig({ maxConcurrentExpressions: 2 });
      
      system.setExpressions([
        { expression: 'happy', weight: 0.8, priority: 0 },
        { expression: 'sad', weight: 0.3, priority: 10 },  // 高优先级
        { expression: 'surprised', weight: 0.6, priority: 0 }
      ]);
      
      const result = system.getBlendResult();
      expect(result.finalWeights.has('sad')).toBe(true);  // 高优先级保留
    });
  });

  describe('冲突检测', () => {
    it('应该检测到冲突的表情', () => {
      system.setExpressions([
        { expression: 'happy', weight: 0.5 },
        { expression: 'sad', weight: 0.5 }
      ]);
      
      const result = system.getBlendResult();
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0]).toMatch(/happy|sad/);
    });

    it('surprised 不应该与其他表情冲突', () => {
      system.setExpressions([
        { expression: 'happy', weight: 0.5 },
        { expression: 'surprised', weight: 0.5 }
      ]);
      
      const result = system.getBlendResult();
      expect(result.conflicts.length).toBe(0);
    });

    it('priority 模式应该解决冲突', () => {
      system.updateConfig({ conflictResolution: 'priority' });
      
      system.setExpressions([
        { expression: 'happy', weight: 0.5, priority: 10 },
        { expression: 'sad', weight: 0.5, priority: 0 }
      ]);
      
      const result = system.getBlendResult();
      // 优先级高的保留
      expect(result.finalWeights.has('happy')).toBe(true);
    });
  });

  describe('权重归一化', () => {
    it('autoNormalize 为 true 时应该归一化', () => {
      system.updateConfig({ autoNormalize: true });
      
      system.setExpressions([
        { expression: 'happy', weight: 0.8 },
        { expression: 'surprised', weight: 0.8 }
      ]);
      
      const result = system.getBlendResult();
      expect(result.totalWeight).toBeCloseTo(1, 1);
    });

    it('autoNormalize 为 false 时不应该归一化', () => {
      system.updateConfig({ autoNormalize: false });
      
      system.setExpressions([
        { expression: 'happy', weight: 0.8 },
        { expression: 'surprised', weight: 0.8 }
      ]);
      
      const result = system.getBlendResult();
      expect(result.totalWeight).toBeCloseTo(1.6, 1);
    });
  });

  describe('预设功能', () => {
    it('应该有默认预设', () => {
      const presets = system.getPresets();
      expect(presets.length).toBeGreaterThan(0);
    });

    it('应该能应用预设', () => {
      const applied = system.applyPreset('bittersweet');
      expect(applied).toBe(true);
      
      const result = system.getBlendResult();
      expect(result.finalWeights.has('happy')).toBe(true);
      expect(result.finalWeights.has('sad')).toBe(true);
    });

    it('应用不存在的预设应该返回 false', () => {
      const applied = system.applyPreset('nonexistent');
      expect(applied).toBe(false);
    });

    it('应该能添加自定义预设', () => {
      const custom: PalettePreset = {
        name: 'my_preset',
        description: 'Test preset',
        expressions: [{ expression: 'happy', weight: 1 }]
      };
      
      system.addPreset(custom);
      const presets = system.getPresets();
      expect(presets.some(p => p.name === 'my_preset')).toBe(true);
    });

    it('应该能删除预设', () => {
      system.addPreset({
        name: 'to_remove',
        description: 'Test',
        expressions: []
      });
      
      const removed = system.removePreset('to_remove');
      expect(removed).toBe(true);
      
      const presets = system.getPresets();
      expect(presets.some(p => p.name === 'to_remove')).toBe(false);
    });
  });

  describe('清除功能', () => {
    it('应该能清除所有表情', () => {
      system.setExpressions([
        { expression: 'happy', weight: 0.5 },
        { expression: 'sad', weight: 0.5 }
      ]);
      
      system.clear();
      
      const result = system.getBlendResult();
      expect(result.finalWeights.size).toBe(0);
    });
  });

  describe('订阅机制', () => {
    it('应该能订阅变化', () => {
      const callback = vi.fn();
      system.onChange(callback);
      
      system.setExpression('happy', 0.5);
      
      expect(callback).toHaveBeenCalled();
    });

    it('应该能取消订阅', () => {
      const callback = vi.fn();
      const unsubscribe = system.onChange(callback);
      
      unsubscribe();
      system.setExpression('happy', 0.5);
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('回调应该接收 BlendResult', () => {
      const callback = vi.fn();
      system.onChange(callback);
      
      system.setExpression('happy', 0.5);
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          finalWeights: expect.any(Map),
          conflicts: expect.any(Array),
          totalWeight: expect.any(Number)
        })
      );
    });

    it('回调抛出错误不应中断其他回调', () => {
      const callback1 = vi.fn(() => { throw new Error('test'); });
      const callback2 = vi.fn();
      
      system.onChange(callback1);
      system.onChange(callback2);
      
      system.setExpression('happy', 0.5);
      
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('平滑过渡', () => {
    it('启用 smoothTransition 时应该使用动画', () => {
      system.updateConfig({ smoothTransition: true });
      
      system.setExpression('happy', 0.8);
      
      expect(mockRaf).toHaveBeenCalled();
    });

    it('禁用 smoothTransition 时应该立即应用', () => {
      system.updateConfig({ smoothTransition: false });
      mockRaf.mockClear();
      
      system.setExpression('happy', 0.8);
      
      expect(mockRaf).not.toHaveBeenCalled();
      const result = system.getBlendResult();
      expect(result.finalWeights.get('happy')).toBe(0.8);
    });

    it('过渡完成后应该达到目标值', () => {
      system.updateConfig({ smoothTransition: true, transitionSpeed: 0.5 });
      
      system.setExpression('happy', 0.8);
      runAnimationFrames(100);
      
      const result = system.getBlendResult();
      expect(result.finalWeights.get('happy')).toBeCloseTo(0.8, 1);
    });
  });

  describe('销毁', () => {
    it('销毁后应该清空所有状态', () => {
      system.setExpression('happy', 0.5);
      const callback = vi.fn();
      system.onChange(callback);
      
      system.destroy();
      
      const result = system.getBlendResult();
      expect(result.finalWeights.size).toBe(0);
    });

    it('销毁后应该取消动画帧', () => {
      system.updateConfig({ smoothTransition: true });
      system.setExpression('happy', 0.8);
      
      system.destroy();
      
      // 不应该有更多的 RAF 调用
      expect(rafCallbacks.length).toBe(0);
    });
  });

  describe('边界情况', () => {
    it('空表情列表应该正常处理', () => {
      system.setExpressions([]);
      const result = system.getBlendResult();
      expect(result.finalWeights.size).toBe(0);
    });

    it('相同表情多次设置应该覆盖', () => {
      system.setExpressions([
        { expression: 'happy', weight: 0.3 },
        { expression: 'happy', weight: 0.8 }
      ]);
      
      const result = system.getBlendResult();
      expect(result.finalWeights.get('happy')).toBe(0.8);
    });

    it('未知表情应该正常处理', () => {
      system.setExpression('custom_expression', 0.5);
      const result = system.getBlendResult();
      expect(result.finalWeights.get('custom_expression')).toBe(0.5);
    });
  });

  describe('预设内容验证', () => {
    it('bittersweet 预设应该包含 happy 和 sad', () => {
      system.applyPreset('bittersweet');
      const result = system.getBlendResult();
      
      expect(result.finalWeights.has('happy')).toBe(true);
      expect(result.finalWeights.has('sad')).toBe(true);
    });

    it('nervous_smile 预设应该包含 happy 和 shy', () => {
      system.applyPreset('nervous_smile');
      const result = system.getBlendResult();
      
      expect(result.finalWeights.has('happy')).toBe(true);
      expect(result.finalWeights.has('shy')).toBe(true);
    });

    it('curious_excited 预设应该包含 surprised 和 happy', () => {
      system.applyPreset('curious_excited');
      const result = system.getBlendResult();
      
      expect(result.finalWeights.has('surprised')).toBe(true);
      expect(result.finalWeights.has('happy')).toBe(true);
    });
  });
});
