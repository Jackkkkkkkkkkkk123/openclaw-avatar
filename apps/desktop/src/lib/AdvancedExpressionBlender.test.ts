/**
 * AdvancedExpressionBlender 单元测试
 * 
 * 测试高级表情混合系统的所有功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AdvancedExpressionBlender,
  advancedExpressionBlender,
  ExpressionLayer,
  ExpressionParams,
  BlendedResult,
  EXPRESSION_PRESETS,
} from './AdvancedExpressionBlender';

describe('AdvancedExpressionBlender', () => {
  let blender: AdvancedExpressionBlender;

  beforeEach(() => {
    blender = new AdvancedExpressionBlender();
    vi.useFakeTimers();
  });

  afterEach(() => {
    blender.destroy();
    vi.useRealTimers();
  });

  describe('构造函数', () => {
    it('应该创建实例', () => {
      expect(blender).toBeInstanceOf(AdvancedExpressionBlender);
    });

    it('初始状态应该是未运行', () => {
      expect(blender.isActive()).toBe(false);
    });

    it('初始状态应该没有任何层', () => {
      expect(blender.getAllLayers()).toHaveLength(0);
    });
  });

  describe('addLayer - 添加表情层', () => {
    it('应该添加表情层', () => {
      const layer = blender.addLayer('test', 'happy');
      expect(layer).toBeDefined();
      expect(layer.id).toBe('test');
      expect(layer.expression).toBe('happy');
    });

    it('应该使用默认参数', () => {
      const layer = blender.addLayer('test', 'happy');
      expect(layer.weight).toBe(1.0);
      expect(layer.priority).toBe(0);
      expect(layer.blendMode).toBe('additive');
      expect(layer.fadeInDuration).toBe(200);
      expect(layer.fadeOutDuration).toBe(200);
      expect(layer.duration).toBeNull();
    });

    it('应该接受自定义参数', () => {
      const layer = blender.addLayer('test', 'sad', {
        weight: 0.5,
        priority: 10,
        blendMode: 'replace',
        fadeInDuration: 100,
        fadeOutDuration: 300,
        duration: 1000,
      });
      expect(layer.weight).toBe(0.5);
      expect(layer.priority).toBe(10);
      expect(layer.blendMode).toBe('replace');
      expect(layer.fadeInDuration).toBe(100);
      expect(layer.fadeOutDuration).toBe(300);
      expect(layer.duration).toBe(1000);
    });

    it('应该记录开始时间', () => {
      const before = performance.now();
      const layer = blender.addLayer('test', 'happy');
      const after = performance.now();
      expect(layer.startTime).toBeGreaterThanOrEqual(before);
      expect(layer.startTime).toBeLessThanOrEqual(after);
    });

    it('应该限制最大层数 (8层)', () => {
      for (let i = 0; i < 10; i++) {
        blender.addLayer(`layer${i}`, 'happy', { priority: i });
      }
      expect(blender.getAllLayers()).toHaveLength(8);
    });

    it('超出层数限制时应该移除优先级最低的层', () => {
      for (let i = 0; i < 8; i++) {
        blender.addLayer(`layer${i}`, 'happy', { priority: i });
      }
      blender.addLayer('layer_high', 'sad', { priority: 100 });
      
      const layers = blender.getAllLayers();
      expect(layers.find(l => l.id === 'layer0')).toBeUndefined();
      expect(layers.find(l => l.id === 'layer_high')).toBeDefined();
    });
  });

  describe('removeLayer - 移除表情层', () => {
    it('应该移除存在的层', () => {
      blender.addLayer('test', 'happy');
      expect(blender.removeLayer('test')).toBe(true);
      expect(blender.getLayer('test')).toBeUndefined();
    });

    it('移除不存在的层应该返回 false', () => {
      expect(blender.removeLayer('nonexistent')).toBe(false);
    });
  });

  describe('getLayer - 获取表情层', () => {
    it('应该返回存在的层', () => {
      blender.addLayer('test', 'happy');
      const layer = blender.getLayer('test');
      expect(layer).toBeDefined();
      expect(layer?.id).toBe('test');
    });

    it('不存在的层应该返回 undefined', () => {
      expect(blender.getLayer('nonexistent')).toBeUndefined();
    });
  });

  describe('getAllLayers - 获取所有层', () => {
    it('没有层时应该返回空数组', () => {
      expect(blender.getAllLayers()).toEqual([]);
    });

    it('应该返回所有层', () => {
      blender.addLayer('layer1', 'happy');
      blender.addLayer('layer2', 'sad');
      blender.addLayer('layer3', 'surprised');
      
      const layers = blender.getAllLayers();
      expect(layers).toHaveLength(3);
    });
  });

  describe('setLayerWeight - 设置层权重', () => {
    it('应该更新层权重', () => {
      blender.addLayer('test', 'happy');
      blender.setLayerWeight('test', 0.5);
      expect(blender.getLayer('test')?.weight).toBe(0.5);
    });

    it('权重应该限制在 0-1 范围', () => {
      blender.addLayer('test', 'happy');
      
      blender.setLayerWeight('test', -0.5);
      expect(blender.getLayer('test')?.weight).toBe(0);
      
      blender.setLayerWeight('test', 1.5);
      expect(blender.getLayer('test')?.weight).toBe(1);
    });

    it('不存在的层不应该报错', () => {
      expect(() => blender.setLayerWeight('nonexistent', 0.5)).not.toThrow();
    });
  });

  describe('setBaseExpression - 设置基础表情', () => {
    it('应该设置基础表情', () => {
      blender.setBaseExpression('happy');
      const result = blender.blend();
      expect(result.params.mouthSmile).toBeGreaterThan(0);
    });

    it('默认基础表情应该是 neutral', () => {
      const result = blender.blend();
      expect(result.params.mouthSmile).toBe(0);
    });
  });

  describe('getPresetParams - 获取预设参数', () => {
    it('应该返回预设表情参数', () => {
      const happyParams = blender.getPresetParams('happy');
      expect(happyParams.mouthSmile).toBe(0.8);
      expect(happyParams.cheekBlush).toBe(0.2);
    });

    it('未知表情应该返回空对象', () => {
      const unknownParams = blender.getPresetParams('unknown_expression');
      expect(unknownParams).toEqual({});
    });

    it('neutral 表情应该返回空对象', () => {
      const neutralParams = blender.getPresetParams('neutral');
      expect(neutralParams).toEqual({});
    });
  });

  describe('EXPRESSION_PRESETS - 预设表情', () => {
    it('应该包含多种预设表情', () => {
      const presets = Object.keys(EXPRESSION_PRESETS);
      expect(presets).toContain('neutral');
      expect(presets).toContain('happy');
      expect(presets).toContain('sad');
      expect(presets).toContain('surprised');
      expect(presets).toContain('angry');
      expect(presets).toContain('fear');
      expect(presets).toContain('disgust');
      expect(presets).toContain('thinking');
      expect(presets).toContain('shy');
      expect(presets).toContain('excited');
      expect(presets).toContain('sleepy');
      expect(presets).toContain('confident');
      expect(presets).toContain('embarrassed');
      expect(presets).toContain('wink_left');
      expect(presets).toContain('wink_right');
      expect(presets).toContain('pout');
      expect(presets).toContain('smirk');
      expect(presets).toContain('laugh');
      expect(presets).toContain('cry');
      expect(presets).toContain('tease');
    });

    it('每种预设应该有有效的参数值', () => {
      for (const [name, params] of Object.entries(EXPRESSION_PRESETS)) {
        for (const [key, value] of Object.entries(params)) {
          expect(typeof value).toBe('number');
        }
      }
    });
  });

  describe('detectConflicts - 冲突检测', () => {
    it('无冲突时应该返回空数组', () => {
      const conflicts = blender.detectConflicts(['happy', 'thinking']);
      expect(conflicts).toHaveLength(0);
    });

    it('应该检测嘴型冲突', () => {
      const conflicts = blender.detectConflicts(['happy', 'sad', 'laugh']);
      expect(conflicts.some(c => c.includes('mouth_shape'))).toBe(true);
    });

    it('应该检测眼睛状态冲突', () => {
      const conflicts = blender.detectConflicts(['surprised', 'sleepy']);
      expect(conflicts.some(c => c.includes('eye_state'))).toBe(true);
    });

    it('应该检测眉毛位置冲突', () => {
      const conflicts = blender.detectConflicts(['happy', 'angry']);
      expect(conflicts.some(c => c.includes('brow_position'))).toBe(true);
    });

    it('应该列出冲突的表情名称', () => {
      const conflicts = blender.detectConflicts(['happy', 'sad']);
      expect(conflicts[0]).toContain('happy');
      expect(conflicts[0]).toContain('sad');
    });
  });

  describe('blend - 混合计算', () => {
    it('应该返回混合结果', () => {
      const result = blender.blend();
      expect(result).toHaveProperty('params');
      expect(result).toHaveProperty('activeLayers');
      expect(result).toHaveProperty('conflicts');
    });

    it('无层时应该只有基础表情', () => {
      blender.setBaseExpression('happy');
      const result = blender.blend();
      expect(result.activeLayers).toHaveLength(0);
      expect(result.params.mouthSmile).toBe(0.8);
    });

    it('应该混合多个层 (additive 模式)', () => {
      blender.setBaseExpression('neutral');
      blender.addLayer('layer1', 'happy', { blendMode: 'additive', weight: 0.5 });
      
      // 等待淡入完成
      vi.advanceTimersByTime(300);
      
      const result = blender.blend();
      expect(result.params.mouthSmile).toBeCloseTo(0.4); // 0.8 * 0.5
    });

    it('应该支持 replace 混合模式', () => {
      blender.setBaseExpression('sad');
      blender.addLayer('layer1', 'happy', { blendMode: 'replace', weight: 1.0 });
      
      // 等待淡入完成
      vi.advanceTimersByTime(300);
      
      const result = blender.blend();
      expect(result.params.mouthSmile).toBeCloseTo(0.8);
    });

    it('应该支持 multiply 混合模式', () => {
      blender.setBaseExpression('happy'); // mouthSmile: 0.8
      blender.addLayer('layer1', 'excited', { blendMode: 'multiply', weight: 1.0 });
      
      // 等待淡入完成
      vi.advanceTimersByTime(300);
      
      const result = blender.blend();
      // multiply: 0.8 * (1 + (0.9 - 1) * 1.0) = 0.8 * 0.9 = 0.72
      expect(result.params.mouthSmile).toBeCloseTo(0.72);
    });

    it('应该按优先级排序混合', () => {
      blender.addLayer('low', 'happy', { priority: 0 });
      blender.addLayer('high', 'sad', { priority: 10 });
      
      const layers = blender.getAllLayers().sort((a, b) => a.priority - b.priority);
      expect(layers[0].id).toBe('low');
      expect(layers[1].id).toBe('high');
    });

    it('应该处理淡入动画', () => {
      blender.addLayer('test', 'happy', { 
        fadeInDuration: 200,
        weight: 1.0,
        blendMode: 'additive',
      });
      
      // 淡入中
      vi.advanceTimersByTime(100);
      let result = blender.blend();
      expect(result.params.mouthSmile).toBeLessThan(0.8);
      
      // 淡入完成
      vi.advanceTimersByTime(200);
      result = blender.blend();
      expect(result.params.mouthSmile).toBeCloseTo(0.8);
    });

    it('应该处理淡出动画', () => {
      blender.addLayer('test', 'happy', { 
        duration: 500,
        fadeOutDuration: 200,
        weight: 1.0,
      });
      
      // 淡入完成后
      vi.advanceTimersByTime(300);
      let result = blender.blend();
      expect(result.activeLayers).toContain('test');
      
      // 淡出中
      vi.advanceTimersByTime(300);
      result = blender.blend();
      
      // 完全淡出后应该移除
      vi.advanceTimersByTime(300);
      result = blender.blend();
      expect(result.activeLayers).not.toContain('test');
    });

    it('应该自动移除过期的层', () => {
      blender.addLayer('temp', 'happy', { duration: 100 });
      
      vi.advanceTimersByTime(500);
      const result = blender.blend();
      
      expect(blender.getLayer('temp')).toBeUndefined();
    });

    it('应该限制参数范围', () => {
      // 添加多个层，可能导致参数超出范围
      blender.addLayer('layer1', 'excited', { weight: 1.0 });
      blender.addLayer('layer2', 'happy', { weight: 1.0 });
      blender.addLayer('layer3', 'laugh', { weight: 1.0 });
      
      vi.advanceTimersByTime(300);
      const result = blender.blend();
      
      // 所有参数应该在有效范围内
      expect(result.params.mouthSmile).toBeLessThanOrEqual(1);
      expect(result.params.mouthSmile).toBeGreaterThanOrEqual(-1);
      expect(result.params.eyeLeftOpen).toBeLessThanOrEqual(1.5);
      expect(result.params.eyeLeftOpen).toBeGreaterThanOrEqual(0);
    });

    it('应该返回冲突信息', () => {
      blender.addLayer('layer1', 'happy');
      blender.addLayer('layer2', 'sad');
      
      vi.advanceTimersByTime(300);
      const result = blender.blend();
      
      expect(result.conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('toLive2DParams - 转换为 Live2D 参数', () => {
    it('应该转换参数名称', () => {
      blender.setBaseExpression('happy');
      const result = blender.blend();
      const live2dParams = blender.toLive2DParams(result);
      
      expect(live2dParams).toHaveProperty('ParamMouthSmile');
      expect(live2dParams).toHaveProperty('ParamEyeLOpen');
      expect(live2dParams).toHaveProperty('ParamEyeROpen');
      expect(live2dParams).toHaveProperty('ParamBrowLY');
      expect(live2dParams).toHaveProperty('ParamBrowRY');
    });

    it('参数值应该正确映射', () => {
      blender.setBaseExpression('happy');
      const result = blender.blend();
      const live2dParams = blender.toLive2DParams(result);
      
      expect(live2dParams.ParamMouthSmile).toBe(result.params.mouthSmile);
      expect(live2dParams.ParamCheekBlush).toBe(result.params.cheekBlush);
    });
  });

  describe('start/stop - 启动/停止', () => {
    it('start 应该开始自动更新', () => {
      const callback = vi.fn();
      blender.onUpdate(callback);
      
      blender.start();
      expect(blender.isActive()).toBe(true);
      
      // 触发动画帧
      vi.advanceTimersByTime(16);
      
      blender.stop();
    });

    it('stop 应该停止自动更新', () => {
      blender.start();
      blender.stop();
      expect(blender.isActive()).toBe(false);
    });

    it('重复 start 不应该创建多个循环', () => {
      blender.start();
      blender.start();
      blender.start();
      
      expect(blender.isActive()).toBe(true);
      blender.stop();
    });

    it('未启动时 stop 不应该报错', () => {
      expect(() => blender.stop()).not.toThrow();
    });
  });

  describe('isActive - 运行状态', () => {
    it('初始状态应该是 false', () => {
      expect(blender.isActive()).toBe(false);
    });

    it('启动后应该是 true', () => {
      blender.start();
      expect(blender.isActive()).toBe(true);
      blender.stop();
    });

    it('停止后应该是 false', () => {
      blender.start();
      blender.stop();
      expect(blender.isActive()).toBe(false);
    });
  });

  describe('onUpdate - 订阅更新', () => {
    it('应该在每帧调用回调', () => {
      const callback = vi.fn();
      blender.onUpdate(callback);
      blender.start();
      
      vi.advanceTimersByTime(16);
      
      expect(callback).toHaveBeenCalled();
      blender.stop();
    });

    it('应该传递混合结果', () => {
      const callback = vi.fn();
      blender.setBaseExpression('happy');
      blender.onUpdate(callback);
      blender.start();
      
      vi.advanceTimersByTime(16);
      
      const result = callback.mock.calls[0][0] as BlendedResult;
      expect(result.params.mouthSmile).toBe(0.8);
      
      blender.stop();
    });

    it('应该返回取消订阅函数', () => {
      const callback = vi.fn();
      const unsubscribe = blender.onUpdate(callback);
      
      unsubscribe();
      blender.start();
      vi.advanceTimersByTime(16);
      
      expect(callback).not.toHaveBeenCalled();
      blender.stop();
    });

    it('多个回调应该都被调用', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      blender.onUpdate(callback1);
      blender.onUpdate(callback2);
      blender.start();
      
      vi.advanceTimersByTime(16);
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      
      blender.stop();
    });
  });

  describe('setExpression - 快速设置表情', () => {
    it('应该清除现有层并设置基础表情', () => {
      blender.addLayer('old', 'happy');
      blender.setExpression('sad');
      
      expect(blender.getAllLayers()).toHaveLength(0);
      const result = blender.blend();
      expect(result.params.mouthSmile).toBeLessThan(0);
    });

    it('带持续时间时应该添加临时层', () => {
      blender.setExpression('happy', 1000);
      
      expect(blender.getAllLayers()).toHaveLength(1);
      const layer = blender.getLayer('temp_expression');
      expect(layer?.duration).toBe(1000);
    });

    it('临时层应该有淡入淡出', () => {
      blender.setExpression('happy', 1000);
      
      const layer = blender.getLayer('temp_expression');
      expect(layer?.fadeInDuration).toBe(150);
      expect(layer?.fadeOutDuration).toBe(150);
    });
  });

  describe('addMicroExpression - 添加微表情', () => {
    it('应该添加 blink 微表情', () => {
      blender.addMicroExpression('blink');
      
      const layers = blender.getAllLayers();
      expect(layers.some(l => l.id.startsWith('micro_blink'))).toBe(true);
    });

    it('应该添加 twitch 微表情', () => {
      blender.addMicroExpression('twitch');
      
      const layers = blender.getAllLayers();
      expect(layers.some(l => l.id.startsWith('micro_twitch'))).toBe(true);
    });

    it('应该添加 glance 微表情', () => {
      blender.addMicroExpression('glance');
      
      const layers = blender.getAllLayers();
      expect(layers.some(l => l.id.startsWith('micro_glance'))).toBe(true);
    });

    it('应该添加 smirk 微表情', () => {
      blender.addMicroExpression('smirk');
      
      const layers = blender.getAllLayers();
      expect(layers.some(l => l.id.startsWith('micro_smirk'))).toBe(true);
    });

    it('微表情应该有低优先级', () => {
      blender.addMicroExpression('blink');
      
      const layer = blender.getAllLayers().find(l => l.id.startsWith('micro_blink'));
      expect(layer?.priority).toBe(-1);
    });

    it('微表情应该有短持续时间', () => {
      blender.addMicroExpression('blink');
      
      const layer = blender.getAllLayers().find(l => l.id.startsWith('micro_blink'));
      expect(layer?.duration).toBe(150);
    });

    it('微表情应该自动过期', () => {
      blender.addMicroExpression('blink');
      
      vi.advanceTimersByTime(500);
      blender.blend(); // 触发过期检查
      
      const layers = blender.getAllLayers();
      expect(layers.some(l => l.id.startsWith('micro_blink'))).toBe(false);
    });
  });

  describe('reset - 重置', () => {
    it('应该清除所有层', () => {
      blender.addLayer('layer1', 'happy');
      blender.addLayer('layer2', 'sad');
      blender.reset();
      
      expect(blender.getAllLayers()).toHaveLength(0);
    });

    it('应该重置基础表情为 neutral', () => {
      blender.setBaseExpression('happy');
      blender.reset();
      
      const result = blender.blend();
      expect(result.params.mouthSmile).toBe(0);
    });
  });

  describe('destroy - 销毁', () => {
    it('应该停止运行', () => {
      blender.start();
      blender.destroy();
      
      expect(blender.isActive()).toBe(false);
    });

    it('应该清除所有层', () => {
      blender.addLayer('test', 'happy');
      blender.destroy();
      
      expect(blender.getAllLayers()).toHaveLength(0);
    });

    it('应该清除所有回调', () => {
      const callback = vi.fn();
      blender.onUpdate(callback);
      blender.destroy();
      
      // 重新启动，回调不应该被调用
      blender.start();
      vi.advanceTimersByTime(16);
      
      expect(callback).not.toHaveBeenCalled();
      blender.stop();
    });
  });

  describe('默认实例', () => {
    it('应该导出默认实例', () => {
      expect(advancedExpressionBlender).toBeInstanceOf(AdvancedExpressionBlender);
    });
  });

  describe('边界情况', () => {
    it('空表情名称应该不报错', () => {
      expect(() => blender.addLayer('test', '')).not.toThrow();
    });

    it('权重为 0 的层不应该影响结果', () => {
      blender.addLayer('test', 'happy', { weight: 0 });
      
      vi.advanceTimersByTime(300);
      const result = blender.blend();
      
      expect(result.params.mouthSmile).toBe(0);
    });

    it('多次添加相同 id 的层应该覆盖', () => {
      blender.addLayer('test', 'happy');
      blender.addLayer('test', 'sad');
      
      expect(blender.getAllLayers()).toHaveLength(1);
      expect(blender.getLayer('test')?.expression).toBe('sad');
    });

    it('多个回调都会被调用，但错误回调会抛出异常', () => {
      const normalCallback1 = vi.fn();
      const normalCallback2 = vi.fn();
      
      blender.onUpdate(normalCallback1);
      blender.onUpdate(normalCallback2);
      blender.start();
      
      vi.advanceTimersByTime(16);
      
      // 两个正常回调都应该被调用
      expect(normalCallback1).toHaveBeenCalled();
      expect(normalCallback2).toHaveBeenCalled();
      
      blender.stop();
    });
  });

  describe('综合场景', () => {
    it('应该正确处理复杂的表情混合', () => {
      // 基础表情
      blender.setBaseExpression('neutral');
      
      // 添加主表情
      blender.addLayer('main', 'happy', { priority: 5, weight: 0.8 });
      
      // 添加微表情叠加
      blender.addMicroExpression('smirk');
      
      vi.advanceTimersByTime(300);
      const result = blender.blend();
      
      expect(result.activeLayers.length).toBeGreaterThanOrEqual(1);
      expect(result.params.mouthSmile).toBeGreaterThan(0);
    });

    it('应该支持表情过渡序列', () => {
      // 设置初始表情
      blender.setExpression('neutral');
      
      // 过渡到开心
      blender.setExpression('happy', 500);
      vi.advanceTimersByTime(100);
      let result = blender.blend();
      expect(result.params.mouthSmile).toBeGreaterThan(0);
      
      // 过渡完成
      vi.advanceTimersByTime(600);
      result = blender.blend();
      expect(result.activeLayers).toHaveLength(0); // 临时层已过期
    });

    it('实时更新应该平滑运行', () => {
      const results: BlendedResult[] = [];
      
      blender.onUpdate(result => results.push(result));
      blender.addLayer('test', 'happy', { fadeInDuration: 100 });
      blender.start();
      
      // 模拟多帧
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(16);
      }
      
      blender.stop();
      
      expect(results.length).toBeGreaterThan(0);
      
      // 检查淡入是否平滑
      const smileValues = results.map(r => r.params.mouthSmile);
      for (let i = 1; i < smileValues.length; i++) {
        expect(smileValues[i]).toBeGreaterThanOrEqual(smileValues[i - 1] - 0.01);
      }
    });
  });
});
