/**
 * MultiTouchGesture - 多点触控手势识别
 * 
 * 支持：
 * - 单指滑动（方向识别）
 * - 双指捏合（缩放）
 * - 双指旋转
 * - 三指滑动（特殊手势）
 * - 长按
 * - 双击/三击
 * - 自定义手势模式
 */

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

export type GestureType = 
  | 'tap' | 'double_tap' | 'triple_tap'
  | 'long_press'
  | 'swipe_left' | 'swipe_right' | 'swipe_up' | 'swipe_down'
  | 'pinch_in' | 'pinch_out'
  | 'rotate_cw' | 'rotate_ccw'
  | 'two_finger_swipe_up' | 'two_finger_swipe_down'
  | 'three_finger_swipe'
  | 'custom';

export interface GestureEvent {
  type: GestureType;
  fingers: number;
  center: { x: number; y: number };
  scale?: number;
  rotation?: number;
  velocity?: { x: number; y: number };
  direction?: number;
  distance?: number;
  duration: number;
  timestamp: number;
}

export interface GestureConfig {
  // 点击
  tapMaxDuration: number;       // 点击最大持续时间 (ms)
  tapMaxDistance: number;       // 点击最大移动距离 (px)
  doubleTapMaxDelay: number;    // 双击最大间隔 (ms)
  
  // 长按
  longPressMinDuration: number; // 长按最小持续时间 (ms)
  
  // 滑动
  swipeMinDistance: number;     // 滑动最小距离 (px)
  swipeMinVelocity: number;     // 滑动最小速度 (px/ms)
  
  // 捏合
  pinchMinScale: number;        // 捏合最小缩放比例
  
  // 旋转
  rotateMinAngle: number;       // 旋转最小角度 (弧度)
  
  // 通用
  enabled: boolean;
}

type GestureCallback = (event: GestureEvent) => void;

export class MultiTouchGesture {
  private element: HTMLElement | null = null;
  private config: GestureConfig;
  private activeTouches: Map<number, TouchPoint> = new Map();
  private startTouches: Map<number, TouchPoint> = new Map();
  private callbacks: Map<GestureType | 'any', Set<GestureCallback>> = new Map();
  private lastTapTime: number = 0;
  private tapCount: number = 0;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private initialPinchDistance: number = 0;
  private initialRotation: number = 0;
  private isDestroyed: boolean = false;

  constructor(config?: Partial<GestureConfig>) {
    this.config = {
      tapMaxDuration: 200,
      tapMaxDistance: 10,
      doubleTapMaxDelay: 300,
      longPressMinDuration: 500,
      swipeMinDistance: 50,
      swipeMinVelocity: 0.3,
      pinchMinScale: 0.1,
      rotateMinAngle: Math.PI / 12,  // 15度
      enabled: true,
      ...config
    };
  }

  /**
   * 绑定到 DOM 元素
   */
  attach(element: HTMLElement): void {
    if (this.element) {
      this.detach();
    }
    
    this.element = element;
    element.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    element.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    element.addEventListener('touchend', this.handleTouchEnd);
    element.addEventListener('touchcancel', this.handleTouchCancel);
    
    // 鼠标支持（模拟单指触控）
    element.addEventListener('mousedown', this.handleMouseDown);
    element.addEventListener('mousemove', this.handleMouseMove);
    element.addEventListener('mouseup', this.handleMouseUp);
  }

  /**
   * 解绑 DOM 元素
   */
  detach(): void {
    if (!this.element) return;
    
    this.element.removeEventListener('touchstart', this.handleTouchStart);
    this.element.removeEventListener('touchmove', this.handleTouchMove);
    this.element.removeEventListener('touchend', this.handleTouchEnd);
    this.element.removeEventListener('touchcancel', this.handleTouchCancel);
    this.element.removeEventListener('mousedown', this.handleMouseDown);
    this.element.removeEventListener('mousemove', this.handleMouseMove);
    this.element.removeEventListener('mouseup', this.handleMouseUp);
    
    this.element = null;
    this.clearState();
  }

  /**
   * 订阅手势事件
   */
  on(type: GestureType | 'any', callback: GestureCallback): () => void {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, new Set());
    }
    this.callbacks.get(type)!.add(callback);
    
    return () => {
      this.callbacks.get(type)?.delete(callback);
    };
  }

  /**
   * 取消订阅
   */
  off(type: GestureType | 'any', callback: GestureCallback): void {
    this.callbacks.get(type)?.delete(callback);
  }

  private handleTouchStart = (e: TouchEvent): void => {
    if (!this.config.enabled || this.isDestroyed) return;
    e.preventDefault();
    
    const now = performance.now();
    
    for (const touch of Array.from(e.changedTouches)) {
      const point: TouchPoint = {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        timestamp: now
      };
      this.activeTouches.set(touch.identifier, point);
      this.startTouches.set(touch.identifier, { ...point });
    }
    
    // 记录初始状态（双指手势）
    if (this.activeTouches.size === 2) {
      this.initialPinchDistance = this.getTouchDistance();
      this.initialRotation = this.getTouchRotation();
    }
    
    // 启动长按检测
    this.startLongPressDetection();
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (!this.config.enabled || this.isDestroyed) return;
    e.preventDefault();
    
    for (const touch of Array.from(e.changedTouches)) {
      const point = this.activeTouches.get(touch.identifier);
      if (point) {
        point.x = touch.clientX;
        point.y = touch.clientY;
      }
    }
    
    // 取消长按检测（移动时）
    if (this.hasMovedBeyondThreshold()) {
      this.cancelLongPress();
    }
    
    // 实时检测双指手势
    if (this.activeTouches.size === 2) {
      this.detectPinchAndRotate();
    }
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    if (!this.config.enabled || this.isDestroyed) return;
    
    const now = performance.now();
    
    for (const touch of Array.from(e.changedTouches)) {
      this.processTouchEnd(touch.identifier, now);
      this.activeTouches.delete(touch.identifier);
      this.startTouches.delete(touch.identifier);
    }
    
    if (this.activeTouches.size === 0) {
      this.cancelLongPress();
    }
  };

  private handleTouchCancel = (): void => {
    this.clearState();
  };

  // 鼠标支持
  private isMouseDown: boolean = false;

  private handleMouseDown = (e: MouseEvent): void => {
    if (!this.config.enabled || this.isDestroyed) return;
    
    this.isMouseDown = true;
    const now = performance.now();
    const point: TouchPoint = {
      id: -1,
      x: e.clientX,
      y: e.clientY,
      timestamp: now
    };
    this.activeTouches.set(-1, point);
    this.startTouches.set(-1, { ...point });
    
    this.startLongPressDetection();
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.config.enabled || this.isDestroyed || !this.isMouseDown) return;
    
    const point = this.activeTouches.get(-1);
    if (point) {
      point.x = e.clientX;
      point.y = e.clientY;
    }
    
    if (this.hasMovedBeyondThreshold()) {
      this.cancelLongPress();
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (!this.config.enabled || this.isDestroyed || !this.isMouseDown) return;
    
    this.isMouseDown = false;
    const now = performance.now();
    this.processTouchEnd(-1, now);
    this.activeTouches.delete(-1);
    this.startTouches.delete(-1);
    
    this.cancelLongPress();
  };

  private processTouchEnd(id: number, now: number): void {
    const startPoint = this.startTouches.get(id);
    const endPoint = this.activeTouches.get(id);
    
    if (!startPoint || !endPoint) return;
    
    const duration = now - startPoint.timestamp;
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const velocity = distance / duration;
    
    // 点击检测
    if (duration < this.config.tapMaxDuration && distance < this.config.tapMaxDistance) {
      this.processTap(now, endPoint);
      return;
    }
    
    // 滑动检测
    if (distance >= this.config.swipeMinDistance && velocity >= this.config.swipeMinVelocity) {
      this.processSwipe(startPoint, endPoint, duration, velocity);
    }
  }

  private processTap(now: number, point: TouchPoint): void {
    if (now - this.lastTapTime < this.config.doubleTapMaxDelay) {
      this.tapCount++;
    } else {
      this.tapCount = 1;
    }
    this.lastTapTime = now;
    
    // 延迟发送，等待可能的多击
    setTimeout(() => {
      if (now === this.lastTapTime) {
        let type: GestureType;
        if (this.tapCount >= 3) {
          type = 'triple_tap';
        } else if (this.tapCount === 2) {
          type = 'double_tap';
        } else {
          type = 'tap';
        }
        
        this.emit({
          type,
          fingers: 1,
          center: { x: point.x, y: point.y },
          duration: 0,
          timestamp: now
        });
        
        this.tapCount = 0;
      }
    }, this.config.doubleTapMaxDelay + 50);
  }

  private processSwipe(start: TouchPoint, end: TouchPoint, duration: number, velocity: number): void {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 判断方向
    let type: GestureType;
    const fingers = this.startTouches.size;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // 水平滑动
      type = dx > 0 ? 'swipe_right' : 'swipe_left';
    } else {
      // 垂直滑动
      if (fingers === 2) {
        type = dy > 0 ? 'two_finger_swipe_down' : 'two_finger_swipe_up';
      } else if (fingers >= 3) {
        type = 'three_finger_swipe';
      } else {
        type = dy > 0 ? 'swipe_down' : 'swipe_up';
      }
    }
    
    this.emit({
      type,
      fingers,
      center: {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2
      },
      velocity: { x: dx / duration, y: dy / duration },
      direction: angle,
      distance,
      duration,
      timestamp: performance.now()
    });
  }

  private detectPinchAndRotate(): void {
    const touches = Array.from(this.activeTouches.values());
    if (touches.length !== 2) return;
    
    const currentDistance = this.getTouchDistance();
    const currentRotation = this.getTouchRotation();
    
    // 捏合检测
    const scale = currentDistance / this.initialPinchDistance;
    if (Math.abs(scale - 1) > this.config.pinchMinScale) {
      const type: GestureType = scale > 1 ? 'pinch_out' : 'pinch_in';
      
      this.emit({
        type,
        fingers: 2,
        center: this.getTouchCenter(),
        scale,
        duration: performance.now() - touches[0].timestamp,
        timestamp: performance.now()
      });
      
      this.initialPinchDistance = currentDistance;
    }
    
    // 旋转检测
    let rotationDiff = currentRotation - this.initialRotation;
    // 处理角度跳变
    if (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
    if (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;
    
    if (Math.abs(rotationDiff) > this.config.rotateMinAngle) {
      const type: GestureType = rotationDiff > 0 ? 'rotate_cw' : 'rotate_ccw';
      
      this.emit({
        type,
        fingers: 2,
        center: this.getTouchCenter(),
        rotation: rotationDiff,
        duration: performance.now() - touches[0].timestamp,
        timestamp: performance.now()
      });
      
      this.initialRotation = currentRotation;
    }
  }

  private getTouchDistance(): number {
    const touches = Array.from(this.activeTouches.values());
    if (touches.length < 2) return 0;
    
    const dx = touches[1].x - touches[0].x;
    const dy = touches[1].y - touches[0].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getTouchRotation(): number {
    const touches = Array.from(this.activeTouches.values());
    if (touches.length < 2) return 0;
    
    return Math.atan2(
      touches[1].y - touches[0].y,
      touches[1].x - touches[0].x
    );
  }

  private getTouchCenter(): { x: number; y: number } {
    const touches = Array.from(this.activeTouches.values());
    if (touches.length === 0) return { x: 0, y: 0 };
    
    const sum = touches.reduce(
      (acc, t) => ({ x: acc.x + t.x, y: acc.y + t.y }),
      { x: 0, y: 0 }
    );
    
    return {
      x: sum.x / touches.length,
      y: sum.y / touches.length
    };
  }

  private hasMovedBeyondThreshold(): boolean {
    for (const [id, current] of this.activeTouches) {
      const start = this.startTouches.get(id);
      if (!start) continue;
      
      const dx = current.x - start.x;
      const dy = current.y - start.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > this.config.tapMaxDistance) {
        return true;
      }
    }
    return false;
  }

  private startLongPressDetection(): void {
    this.cancelLongPress();
    
    this.longPressTimer = setTimeout(() => {
      if (this.activeTouches.size > 0 && !this.hasMovedBeyondThreshold()) {
        const center = this.getTouchCenter();
        const start = Array.from(this.startTouches.values())[0];
        
        this.emit({
          type: 'long_press',
          fingers: this.activeTouches.size,
          center,
          duration: this.config.longPressMinDuration,
          timestamp: performance.now()
        });
      }
    }, this.config.longPressMinDuration);
  }

  private cancelLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private emit(event: GestureEvent): void {
    // 通知特定类型的回调
    const typeCallbacks = this.callbacks.get(event.type);
    if (typeCallbacks) {
      for (const callback of typeCallbacks) {
        try {
          callback(event);
        } catch (e) {
          console.error('[MultiTouchGesture] Callback error:', e);
        }
      }
    }
    
    // 通知 'any' 回调
    const anyCallbacks = this.callbacks.get('any');
    if (anyCallbacks) {
      for (const callback of anyCallbacks) {
        try {
          callback(event);
        } catch (e) {
          console.error('[MultiTouchGesture] Callback error:', e);
        }
      }
    }
  }

  private clearState(): void {
    this.activeTouches.clear();
    this.startTouches.clear();
    this.cancelLongPress();
    this.isMouseDown = false;
  }

  /**
   * 手动触发手势（用于测试）
   */
  simulateGesture(event: GestureEvent): void {
    this.emit(event);
  }

  /**
   * 获取配置
   */
  getConfig(): GestureConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<GestureConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 启用/禁用
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.clearState();
    }
  }

  /**
   * 是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 获取当前活动触点数量
   */
  getActiveTouchCount(): number {
    return this.activeTouches.size;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.isDestroyed = true;
    this.detach();
    this.callbacks.clear();
  }
}
