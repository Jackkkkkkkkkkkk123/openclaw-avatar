/**
 * AnimationUtils 单元测试
 * 
 * 测试动画工具函数和类:
 * - 基础数学函数 (lerp, clamp, mapRange, smoothstep)
 * - 缓动函数 (easing functions)
 * - 帧率控制 (FrameRateLimiter, DeltaTimeCalculator)
 * - 动画值 (SmoothValue, SpringValue)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  lerp,
  clamp,
  mapRange,
  smoothstep,
  smootherstep,
  easeLinear,
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
  getEasing,
  easingFunctions,
  FrameRateLimiter,
  DeltaTimeCalculator,
  SmoothValue,
  SpringValue,
} from './AnimationUtils';

// ========== 基础数学函数测试 ==========
describe('基础数学函数', () => {
  describe('lerp', () => {
    it('t=0 时应返回 a', () => {
      expect(lerp(0, 100, 0)).toBe(0);
      expect(lerp(-50, 50, 0)).toBe(-50);
    });

    it('t=1 时应返回 b', () => {
      expect(lerp(0, 100, 1)).toBe(100);
      expect(lerp(-50, 50, 1)).toBe(50);
    });

    it('t=0.5 时应返回中点', () => {
      expect(lerp(0, 100, 0.5)).toBe(50);
      expect(lerp(-100, 100, 0.5)).toBe(0);
    });

    it('应支持负值插值', () => {
      expect(lerp(100, 0, 0.5)).toBe(50);
      expect(lerp(100, -100, 0.5)).toBe(0);
    });

    it('应支持超出 0-1 范围的 t 值', () => {
      expect(lerp(0, 100, 2)).toBe(200);
      expect(lerp(0, 100, -1)).toBe(-100);
    });
  });

  describe('clamp', () => {
    it('应将值限制在范围内', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('边界值应正确处理', () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });

    it('应支持负范围', () => {
      expect(clamp(0, -10, -5)).toBe(-5);
      expect(clamp(-20, -10, -5)).toBe(-10);
    });
  });

  describe('mapRange', () => {
    it('应正确映射范围', () => {
      expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
      expect(mapRange(0, 0, 10, 0, 100)).toBe(0);
      expect(mapRange(10, 0, 10, 0, 100)).toBe(100);
    });

    it('应支持反向映射', () => {
      expect(mapRange(5, 0, 10, 100, 0)).toBe(50);
    });

    it('应限制超出范围的值', () => {
      expect(mapRange(-5, 0, 10, 0, 100)).toBe(0);
      expect(mapRange(15, 0, 10, 0, 100)).toBe(100);
    });

    it('应支持负范围', () => {
      expect(mapRange(0, -10, 10, 0, 100)).toBe(50);
    });
  });

  describe('smoothstep', () => {
    it('应在边界返回正确值', () => {
      expect(smoothstep(0, 1, 0)).toBe(0);
      expect(smoothstep(0, 1, 1)).toBe(1);
    });

    it('中点应返回 0.5', () => {
      expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    });

    it('应限制超出范围的值', () => {
      expect(smoothstep(0, 1, -1)).toBe(0);
      expect(smoothstep(0, 1, 2)).toBe(1);
    });

    it('应产生平滑曲线', () => {
      // smoothstep 在 0.25 和 0.75 处的值应该不是线性的
      const at25 = smoothstep(0, 1, 0.25);
      const at75 = smoothstep(0, 1, 0.75);
      expect(at25).not.toBe(0.25);
      expect(at75).not.toBe(0.75);
      expect(at25).toBeCloseTo(0.15625, 5);
      expect(at75).toBeCloseTo(0.84375, 5);
    });
  });

  describe('smootherstep', () => {
    it('应在边界返回正确值', () => {
      expect(smootherstep(0, 1, 0)).toBe(0);
      expect(smootherstep(0, 1, 1)).toBe(1);
    });

    it('中点应返回 0.5', () => {
      expect(smootherstep(0, 1, 0.5)).toBe(0.5);
    });

    it('应产生比 smoothstep 更平滑的曲线', () => {
      // smootherstep 的导数在边界处为 0
      const ss25 = smoothstep(0, 1, 0.25);
      const ss25er = smootherstep(0, 1, 0.25);
      expect(ss25er).toBeLessThan(ss25);
    });
  });
});

// ========== 缓动函数测试 ==========
describe('缓动函数', () => {
  const testEasing = (fn: (t: number) => number, name: string) => {
    describe(name, () => {
      it('t=0 时应返回 0', () => {
        expect(fn(0)).toBeCloseTo(0, 5);
      });

      it('t=1 时应返回 1', () => {
        expect(fn(1)).toBeCloseTo(1, 5);
      });

      it('应产生 0-1 范围内的值', () => {
        for (let t = 0; t <= 1; t += 0.1) {
          const v = fn(t);
          // elastic 和 bounce 可能略微超出范围
          expect(v).toBeGreaterThanOrEqual(-0.5);
          expect(v).toBeLessThanOrEqual(1.5);
        }
      });
    });
  };

  testEasing(easeLinear, 'easeLinear');
  testEasing(easeInQuad, 'easeInQuad');
  testEasing(easeOutQuad, 'easeOutQuad');
  testEasing(easeInOutQuad, 'easeInOutQuad');
  testEasing(easeInCubic, 'easeInCubic');
  testEasing(easeOutCubic, 'easeOutCubic');
  testEasing(easeInOutCubic, 'easeInOutCubic');
  testEasing(easeInSine, 'easeInSine');
  testEasing(easeOutSine, 'easeOutSine');
  testEasing(easeInOutSine, 'easeInOutSine');
  testEasing(easeInElastic, 'easeInElastic');
  testEasing(easeOutElastic, 'easeOutElastic');
  testEasing(easeInBounce, 'easeInBounce');
  testEasing(easeOutBounce, 'easeOutBounce');

  describe('easeLinear 特性', () => {
    it('中点应返回 0.5', () => {
      expect(easeLinear(0.5)).toBe(0.5);
    });

    it('应产生线性变化', () => {
      expect(easeLinear(0.25)).toBe(0.25);
      expect(easeLinear(0.75)).toBe(0.75);
    });
  });

  describe('easeInOut 对称性', () => {
    it('easeInOutQuad 应在中点对称', () => {
      expect(easeInOutQuad(0.25) + easeInOutQuad(0.75)).toBeCloseTo(1, 5);
    });

    it('easeInOutCubic 应在中点对称', () => {
      expect(easeInOutCubic(0.25) + easeInOutCubic(0.75)).toBeCloseTo(1, 5);
    });

    it('easeInOutSine 应在中点对称', () => {
      expect(easeInOutSine(0.25) + easeInOutSine(0.75)).toBeCloseTo(1, 5);
    });
  });
});

// ========== 缓动函数映射测试 ==========
describe('easingFunctions 映射', () => {
  it('应包含所有基础缓动函数', () => {
    expect(easingFunctions.linear).toBe(easeLinear);
    expect(easingFunctions.easeIn).toBe(easeInQuad);
    expect(easingFunctions.easeOut).toBe(easeOutQuad);
    expect(easingFunctions.easeInOut).toBe(easeInOutQuad);
  });

  it('getEasing 应返回正确的函数', () => {
    expect(getEasing('linear')).toBe(easeLinear);
    expect(getEasing('easeInCubic')).toBe(easeInCubic);
  });

  it('getEasing 对未知名称应返回 linear', () => {
    expect(getEasing('unknown')).toBe(easeLinear);
    expect(getEasing('')).toBe(easeLinear);
  });
});

// ========== FrameRateLimiter 测试 ==========
describe('FrameRateLimiter', () => {
  let limiter: FrameRateLimiter;

  beforeEach(() => {
    limiter = new FrameRateLimiter(60);
  });

  it('应正确创建实例', () => {
    expect(limiter).toBeDefined();
  });

  it('第一帧应该渲染', () => {
    expect(limiter.shouldRender(0)).toBe(true);
  });

  it('间隔太短时不应渲染', () => {
    limiter.shouldRender(0);
    expect(limiter.shouldRender(5)).toBe(false);
    expect(limiter.shouldRender(10)).toBe(false);
  });

  it('间隔足够时应渲染', () => {
    limiter.shouldRender(0);
    expect(limiter.shouldRender(17)).toBe(true); // 60fps ≈ 16.67ms
  });

  it('应支持不同帧率', () => {
    const limiter30 = new FrameRateLimiter(30);
    limiter30.shouldRender(0);
    expect(limiter30.shouldRender(20)).toBe(false);
    expect(limiter30.shouldRender(34)).toBe(true); // 30fps ≈ 33.33ms
  });

  it('reset 应重置状态', () => {
    limiter.shouldRender(1000);
    limiter.reset();
    expect(limiter.shouldRender(0)).toBe(true);
  });
});

// ========== DeltaTimeCalculator 测试 ==========
describe('DeltaTimeCalculator', () => {
  let calc: DeltaTimeCalculator;

  beforeEach(() => {
    calc = new DeltaTimeCalculator();
  });

  it('应正确创建实例', () => {
    expect(calc).toBeDefined();
  });

  it('第一次更新应返回 0', () => {
    expect(calc.update(0)).toBe(0);
    expect(calc.update(1000)).toBe(0);
  });

  it('应正确计算增量时间', () => {
    calc.update(0);
    calc.update(1000);
    expect(calc.update(1016)).toBeCloseTo(0.016, 3);
  });

  it('getDelta 应返回上次计算的增量', () => {
    calc.update(0);
    calc.update(1000);
    calc.update(1100);
    expect(calc.getDelta()).toBeCloseTo(0.1, 3);
  });

  it('应限制过大的增量时间', () => {
    calc.update(0);
    calc.update(1000);
    // 模拟标签页休眠后恢复，1秒后
    const delta = calc.update(2000);
    expect(delta).toBe(0.1); // 最大 0.1 秒
  });

  it('reset 应重置状态', () => {
    calc.update(0);
    calc.update(1000);
    calc.update(1100);
    calc.reset();
    expect(calc.getDelta()).toBe(0);
    expect(calc.update(0)).toBe(0);
  });
});

// ========== SmoothValue 测试 ==========
describe('SmoothValue', () => {
  let smooth: SmoothValue;

  beforeEach(() => {
    smooth = new SmoothValue(0, 0.1);
  });

  it('应正确创建实例', () => {
    expect(smooth).toBeDefined();
    expect(smooth.getValue()).toBe(0);
    expect(smooth.getTarget()).toBe(0);
  });

  it('初始状态应在目标位置', () => {
    expect(smooth.isAtTarget()).toBe(true);
  });

  it('setTarget 应改变目标值', () => {
    smooth.setTarget(100);
    expect(smooth.getTarget()).toBe(100);
    expect(smooth.isAtTarget()).toBe(false);
  });

  it('setCurrent 应立即设置当前值', () => {
    smooth.setCurrent(50);
    expect(smooth.getValue()).toBe(50);
    expect(smooth.getTarget()).toBe(50);
    expect(smooth.isAtTarget()).toBe(true);
  });

  it('update 应使值向目标移动', () => {
    smooth.setTarget(100);
    const v1 = smooth.update(0.016);
    expect(v1).toBeGreaterThan(0);
    expect(v1).toBeLessThan(100);
  });

  it('多次 update 应最终到达目标', () => {
    smooth.setTarget(100);
    for (let i = 0; i < 100; i++) {
      smooth.update(0.016);
    }
    expect(smooth.getValue()).toBeCloseTo(100, 2);
    expect(smooth.isAtTarget()).toBe(true);
  });

  it('应支持自定义初始值', () => {
    const smooth2 = new SmoothValue(50);
    expect(smooth2.getValue()).toBe(50);
  });

  it('应支持自定义 smoothTime', () => {
    const fast = new SmoothValue(0, 0.01);
    const slow = new SmoothValue(0, 1);
    
    fast.setTarget(100);
    slow.setTarget(100);
    
    fast.update(0.016);
    slow.update(0.016);
    
    expect(fast.getValue()).toBeGreaterThan(slow.getValue());
  });
});

// ========== SpringValue 测试 ==========
describe('SpringValue', () => {
  let spring: SpringValue;

  beforeEach(() => {
    spring = new SpringValue(0, 100, 10);
  });

  it('应正确创建实例', () => {
    expect(spring).toBeDefined();
    expect(spring.getValue()).toBe(0);
    expect(spring.getTarget()).toBe(0);
  });

  it('初始状态应静止', () => {
    expect(spring.isAtRest()).toBe(true);
  });

  it('setTarget 应改变目标值', () => {
    spring.setTarget(100);
    expect(spring.getTarget()).toBe(100);
    expect(spring.isAtRest()).toBe(false);
  });

  it('setCurrent 应立即设置当前值并停止运动', () => {
    spring.setTarget(100);
    spring.update(0.016);
    spring.setCurrent(50);
    expect(spring.getValue()).toBe(50);
    expect(spring.getTarget()).toBe(50);
    expect(spring.isAtRest()).toBe(true);
  });

  it('update 应使值向目标移动', () => {
    spring.setTarget(100);
    const v1 = spring.update(0.016);
    expect(v1).toBeGreaterThan(0);
  });

  it('多次 update 应最终到达目标并静止', () => {
    spring.setTarget(100);
    for (let i = 0; i < 200; i++) {
      spring.update(0.016);
    }
    expect(spring.getValue()).toBeCloseTo(100, 1);
    expect(spring.isAtRest()).toBe(true);
  });

  it('弹簧可能会超调', () => {
    const bouncySpring = new SpringValue(0, 200, 5); // 高刚度低阻尼
    bouncySpring.setTarget(100);
    
    let maxValue = 0;
    for (let i = 0; i < 100; i++) {
      const v = bouncySpring.update(0.016);
      maxValue = Math.max(maxValue, v);
    }
    
    // 弹簧可能超过目标值
    expect(maxValue).toBeGreaterThan(100);
  });

  it('应支持自定义参数', () => {
    const stiff = new SpringValue(0, 500, 20);
    const soft = new SpringValue(0, 50, 5);
    
    stiff.setTarget(100);
    soft.setTarget(100);
    
    stiff.update(0.016);
    soft.update(0.016);
    
    // 更高刚度应该移动更快
    expect(stiff.getValue()).toBeGreaterThan(soft.getValue());
  });
});

// ========== 边界情况测试 ==========
describe('边界情况', () => {
  it('lerp 应处理 NaN', () => {
    expect(lerp(NaN, 100, 0.5)).toBeNaN();
    expect(lerp(0, NaN, 0.5)).toBeNaN();
    expect(lerp(0, 100, NaN)).toBeNaN();
  });

  it('clamp 应处理极端值', () => {
    expect(clamp(Infinity, 0, 100)).toBe(100);
    expect(clamp(-Infinity, 0, 100)).toBe(0);
  });

  it('SmoothValue 应处理零增量时间', () => {
    const smooth = new SmoothValue(0);
    smooth.setTarget(100);
    const v = smooth.update(0);
    expect(isFinite(v)).toBe(true);
  });

  it('SpringValue 应处理零增量时间', () => {
    const spring = new SpringValue(0);
    spring.setTarget(100);
    const v = spring.update(0);
    expect(v).toBe(0); // 应该不移动
  });

  it('FrameRateLimiter 应处理零帧率', () => {
    // 零帧率意味着无限间隔
    const limiter = new FrameRateLimiter(0);
    expect(limiter.shouldRender(0)).toBe(true);
  });
});
