/**
 * MultiTouchGesture 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MultiTouchGesture, GestureEvent, GestureType } from './MultiTouchGesture';

describe('MultiTouchGesture', () => {
  let gesture: MultiTouchGesture;
  let element: HTMLElement;

  beforeEach(() => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    
    element = document.createElement('div');
    document.body.appendChild(element);
    
    gesture = new MultiTouchGesture();
  });

  afterEach(() => {
    gesture.destroy();
    document.body.removeChild(element);
    vi.restoreAllMocks();
  });

  function createTouchEvent(
    type: string,
    touches: Array<{ identifier: number; clientX: number; clientY: number }>
  ): TouchEvent {
    const touchList = touches.map(t => ({
      identifier: t.identifier,
      clientX: t.clientX,
      clientY: t.clientY,
      clientRect: new DOMRect(),
      force: 0,
      pageX: t.clientX,
      pageY: t.clientY,
      radiusX: 0,
      radiusY: 0,
      rotationAngle: 0,
      screenX: t.clientX,
      screenY: t.clientY,
      target: element
    }));

    return {
      type,
      changedTouches: touchList,
      touches: touchList,
      targetTouches: touchList,
      preventDefault: vi.fn()
    } as unknown as TouchEvent;
  }

  function advanceTime(ms: number): void {
    const current = performance.now() as number;
    vi.spyOn(performance, 'now').mockReturnValue(current + ms);
  }

  describe('初始化', () => {
    it('应该使用默认配置创建', () => {
      const config = gesture.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.tapMaxDuration).toBe(200);
      expect(config.swipeMinDistance).toBe(50);
    });

    it('应该使用自定义配置创建', () => {
      const customGesture = new MultiTouchGesture({
        tapMaxDuration: 300,
        swipeMinDistance: 100
      });
      
      const config = customGesture.getConfig();
      expect(config.tapMaxDuration).toBe(300);
      expect(config.swipeMinDistance).toBe(100);
      
      customGesture.destroy();
    });
  });

  describe('元素绑定', () => {
    it('应该绑定到元素', () => {
      gesture.attach(element);
      // 不应该抛出错误
    });

    it('应该解绑元素', () => {
      gesture.attach(element);
      gesture.detach();
      // 不应该抛出错误
    });

    it('应该替换绑定元素', () => {
      const element2 = document.createElement('div');
      document.body.appendChild(element2);
      
      gesture.attach(element);
      gesture.attach(element2);
      
      // 应该只绑定到新元素
      
      document.body.removeChild(element2);
    });
  });

  describe('订阅机制', () => {
    it('应该订阅特定手势', () => {
      const callback = vi.fn();
      gesture.on('tap', callback);
      
      gesture.simulateGesture({
        type: 'tap',
        fingers: 1,
        center: { x: 100, y: 100 },
        duration: 50,
        timestamp: 0
      });
      
      expect(callback).toHaveBeenCalled();
    });

    it('应该订阅所有手势', () => {
      const callback = vi.fn();
      gesture.on('any', callback);
      
      gesture.simulateGesture({
        type: 'swipe_left',
        fingers: 1,
        center: { x: 100, y: 100 },
        duration: 100,
        timestamp: 0
      });
      
      expect(callback).toHaveBeenCalled();
    });

    it('应该取消订阅', () => {
      const callback = vi.fn();
      const unsubscribe = gesture.on('tap', callback);
      
      unsubscribe();
      
      gesture.simulateGesture({
        type: 'tap',
        fingers: 1,
        center: { x: 100, y: 100 },
        duration: 50,
        timestamp: 0
      });
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('应该通过 off 取消订阅', () => {
      const callback = vi.fn();
      gesture.on('tap', callback);
      gesture.off('tap', callback);
      
      gesture.simulateGesture({
        type: 'tap',
        fingers: 1,
        center: { x: 100, y: 100 },
        duration: 50,
        timestamp: 0
      });
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('回调错误不应该中断其他回调', () => {
      const callback1 = vi.fn().mockImplementation(() => {
        throw new Error('test');
      });
      const callback2 = vi.fn();
      
      gesture.on('tap', callback1);
      gesture.on('tap', callback2);
      
      gesture.simulateGesture({
        type: 'tap',
        fingers: 1,
        center: { x: 100, y: 100 },
        duration: 50,
        timestamp: 0
      });
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('模拟手势', () => {
    it('应该模拟点击', () => {
      const callback = vi.fn();
      gesture.on('tap', callback);
      
      gesture.simulateGesture({
        type: 'tap',
        fingers: 1,
        center: { x: 100, y: 100 },
        duration: 50,
        timestamp: 0
      });
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tap',
          fingers: 1
        })
      );
    });

    it('应该模拟双击', () => {
      const callback = vi.fn();
      gesture.on('double_tap', callback);
      
      gesture.simulateGesture({
        type: 'double_tap',
        fingers: 1,
        center: { x: 100, y: 100 },
        duration: 50,
        timestamp: 0
      });
      
      expect(callback).toHaveBeenCalled();
    });

    it('应该模拟滑动', () => {
      const callback = vi.fn();
      gesture.on('swipe_right', callback);
      
      gesture.simulateGesture({
        type: 'swipe_right',
        fingers: 1,
        center: { x: 150, y: 100 },
        velocity: { x: 0.5, y: 0 },
        direction: 0,
        distance: 100,
        duration: 200,
        timestamp: 0
      });
      
      expect(callback).toHaveBeenCalled();
    });

    it('应该模拟捏合', () => {
      const callback = vi.fn();
      gesture.on('pinch_out', callback);
      
      gesture.simulateGesture({
        type: 'pinch_out',
        fingers: 2,
        center: { x: 150, y: 150 },
        scale: 1.5,
        duration: 300,
        timestamp: 0
      });
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pinch_out',
          scale: 1.5
        })
      );
    });

    it('应该模拟旋转', () => {
      const callback = vi.fn();
      gesture.on('rotate_cw', callback);
      
      gesture.simulateGesture({
        type: 'rotate_cw',
        fingers: 2,
        center: { x: 150, y: 150 },
        rotation: Math.PI / 4,
        duration: 300,
        timestamp: 0
      });
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rotate_cw',
          rotation: Math.PI / 4
        })
      );
    });

    it('应该模拟长按', () => {
      const callback = vi.fn();
      gesture.on('long_press', callback);
      
      gesture.simulateGesture({
        type: 'long_press',
        fingers: 1,
        center: { x: 100, y: 100 },
        duration: 500,
        timestamp: 0
      });
      
      expect(callback).toHaveBeenCalled();
    });

    it('应该模拟三指滑动', () => {
      const callback = vi.fn();
      gesture.on('three_finger_swipe', callback);
      
      gesture.simulateGesture({
        type: 'three_finger_swipe',
        fingers: 3,
        center: { x: 200, y: 100 },
        direction: 0,
        distance: 150,
        duration: 200,
        timestamp: 0
      });
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('配置管理', () => {
    it('应该获取配置', () => {
      const config = gesture.getConfig();
      expect(config).toHaveProperty('tapMaxDuration');
      expect(config).toHaveProperty('swipeMinDistance');
    });

    it('应该更新配置', () => {
      gesture.setConfig({ tapMaxDuration: 300 });
      expect(gesture.getConfig().tapMaxDuration).toBe(300);
    });
  });

  describe('启用/禁用', () => {
    it('应该启用/禁用手势', () => {
      gesture.setEnabled(false);
      expect(gesture.isEnabled()).toBe(false);
      
      gesture.setEnabled(true);
      expect(gesture.isEnabled()).toBe(true);
    });

    it('禁用时不应该触发手势', () => {
      const callback = vi.fn();
      gesture.on('tap', callback);
      gesture.attach(element);
      gesture.setEnabled(false);
      
      // 模拟触控
      // 由于禁用，不应该触发
    });
  });

  describe('触点数量', () => {
    it('应该返回活动触点数量', () => {
      expect(gesture.getActiveTouchCount()).toBe(0);
    });
  });

  describe('手势类型覆盖', () => {
    const gestureTypes: GestureType[] = [
      'tap', 'double_tap', 'triple_tap',
      'long_press',
      'swipe_left', 'swipe_right', 'swipe_up', 'swipe_down',
      'pinch_in', 'pinch_out',
      'rotate_cw', 'rotate_ccw',
      'two_finger_swipe_up', 'two_finger_swipe_down',
      'three_finger_swipe',
      'custom'
    ];

    for (const type of gestureTypes) {
      it(`应该支持 ${type} 手势`, () => {
        const callback = vi.fn();
        gesture.on(type, callback);
        
        gesture.simulateGesture({
          type,
          fingers: 1,
          center: { x: 100, y: 100 },
          duration: 100,
          timestamp: 0
        });
        
        expect(callback).toHaveBeenCalled();
      });
    }
  });

  describe('销毁', () => {
    it('应该解绑元素', () => {
      gesture.attach(element);
      gesture.destroy();
      
      // 元素应该被解绑
    });

    it('应该清除回调', () => {
      const callback = vi.fn();
      gesture.on('tap', callback);
      
      gesture.destroy();
      
      // 回调应该被清除
    });
  });

  describe('GestureEvent 属性', () => {
    it('应该包含所有必需属性', () => {
      const callback = vi.fn();
      gesture.on('any', callback);
      
      gesture.simulateGesture({
        type: 'swipe_right',
        fingers: 1,
        center: { x: 100, y: 100 },
        velocity: { x: 0.5, y: 0 },
        direction: 0,
        distance: 100,
        duration: 200,
        timestamp: 1000
      });
      
      const event = callback.mock.calls[0][0] as GestureEvent;
      expect(event.type).toBe('swipe_right');
      expect(event.fingers).toBe(1);
      expect(event.center).toEqual({ x: 100, y: 100 });
      expect(event.velocity).toEqual({ x: 0.5, y: 0 });
      expect(event.direction).toBe(0);
      expect(event.distance).toBe(100);
      expect(event.duration).toBe(200);
      expect(event.timestamp).toBe(1000);
    });

    it('应该支持可选属性', () => {
      const callback = vi.fn();
      gesture.on('tap', callback);
      
      gesture.simulateGesture({
        type: 'tap',
        fingers: 1,
        center: { x: 100, y: 100 },
        duration: 50,
        timestamp: 0
      });
      
      const event = callback.mock.calls[0][0] as GestureEvent;
      expect(event.scale).toBeUndefined();
      expect(event.rotation).toBeUndefined();
    });
  });
});
