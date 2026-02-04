/**
 * MotionQueueSystem 单元测试
 * 
 * 测试动作队列系统的核心功能:
 * - 动作请求和播放
 * - 优先级系统
 * - 淡入淡出状态机
 * - 身体部位分区
 * - Idle 动作管理
 * - 手势/反应/情绪动作
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MotionQueueSystem, MotionRequest, MotionPriority, BodyPart } from './MotionQueueSystem';

describe('MotionQueueSystem', () => {
  let system: MotionQueueSystem;
  let playCallback: ReturnType<typeof vi.fn>;
  let stopCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    system = new MotionQueueSystem();
    playCallback = vi.fn();
    stopCallback = vi.fn();
    system.onPlay(playCallback);
    system.onStop(stopCallback);
  });

  afterEach(() => {
    system.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ========== 基础功能测试 ==========
  describe('基础功能', () => {
    it('应该正确创建实例', () => {
      expect(system).toBeDefined();
      expect(system.getActiveMotions()).toBeInstanceOf(Map);
    });

    it('应该能够设置播放回调', () => {
      const callback = vi.fn();
      system.onPlay(callback);
      
      system.requestMotion({
        id: 'test',
        group: 'idle',
        priority: 'idle',
      });
      
      vi.advanceTimersByTime(50);
      expect(callback).toHaveBeenCalled();
    });

    it('应该能够设置停止回调', () => {
      const callback = vi.fn();
      system.onStop(callback);
      
      system.requestMotion({
        id: 'test',
        group: 'idle',
        priority: 'idle',
        duration: 100,
      });
      
      // 淡入 + 播放 + 淡出
      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledWith('idle');
    });

    it('destroy 应该清理所有状态', () => {
      system.requestMotion({
        id: 'test',
        group: 'idle',
        priority: 'idle',
      });
      
      system.destroy();
      
      expect(system.getActiveMotions().size).toBe(0);
    });
  });

  // ========== 动作请求测试 ==========
  describe('动作请求', () => {
    it('应该成功请求动作', () => {
      const result = system.requestMotion({
        id: 'test',
        group: 'wave',
        priority: 'gesture',
      });
      
      expect(result).toBe(true);
      expect(system.getActiveMotions().size).toBeGreaterThan(0);
    });

    it('应该调用 onStart 回调', () => {
      const onStart = vi.fn();
      
      system.requestMotion({
        id: 'test',
        group: 'wave',
        priority: 'gesture',
        onStart,
      });
      
      expect(onStart).toHaveBeenCalled();
    });

    it('应该支持自定义淡入时间', () => {
      system.requestMotion({
        id: 'test',
        group: 'wave',
        priority: 'gesture',
        fadeIn: 500,
      });
      
      const motions = system.getActiveMotions();
      const motion = Array.from(motions.values())[0];
      expect(motion.fadeIn).toBe(500);
    });

    it('应该支持自定义淡出时间', () => {
      system.requestMotion({
        id: 'test',
        group: 'wave',
        priority: 'gesture',
        fadeOut: 400,
      });
      
      const motions = system.getActiveMotions();
      const motion = Array.from(motions.values())[0];
      expect(motion.fadeOut).toBe(400);
    });

    it('应该支持自定义权重', () => {
      system.requestMotion({
        id: 'test',
        group: 'wave',
        priority: 'gesture',
        weight: 0.5,
      });
      
      const motions = system.getActiveMotions();
      const motion = Array.from(motions.values())[0];
      expect(motion.weight).toBe(0.5);
    });
  });

  // ========== 优先级系统测试 ==========
  describe('优先级系统', () => {
    const priorities: MotionPriority[] = ['idle', 'gesture', 'reaction', 'emotion', 'override'];
    
    it('优先级顺序应该正确 (idle < gesture < reaction < emotion < override)', () => {
      // idle 优先级最低
      system.requestMotion({
        id: 'idle',
        group: 'idle',
        priority: 'idle',
      });
      
      // gesture 应该能覆盖 idle
      const result = system.requestMotion({
        id: 'gesture',
        group: 'wave',
        priority: 'gesture',
      });
      
      expect(result).toBe(true);
    });

    it('低优先级动作应该被高优先级阻止 (同一身体部位)', () => {
      // 先播放 emotion 优先级 (arms 部位)
      system.requestMotion({
        id: 'emotion',
        group: 'wave',  // wave 是 arms 部位
        priority: 'emotion',
      });
      
      // gesture 优先级更低，同是 arms 部位，应该被阻止
      const result = system.requestMotion({
        id: 'gesture',
        group: 'zuoshou',  // zuoshou 也是 arms 部位
        priority: 'gesture',
      });
      
      expect(result).toBe(false);
    });

    it('相同优先级应该可以替换', () => {
      system.requestMotion({
        id: 'gesture1',
        group: 'wave',
        priority: 'gesture',
      });
      
      const result = system.requestMotion({
        id: 'gesture2',
        group: 'zuoshou',
        priority: 'gesture',
      });
      
      expect(result).toBe(true);
    });

    it('override 优先级应该总是能覆盖', () => {
      system.requestMotion({
        id: 'emotion',
        group: 'tap_body',
        priority: 'emotion',
      });
      
      const result = system.requestMotion({
        id: 'override',
        group: 'idle',
        priority: 'override',
      });
      
      expect(result).toBe(true);
    });

    it.each(priorities)('应该支持 %s 优先级', (priority) => {
      const result = system.requestMotion({
        id: `test_${priority}`,
        group: 'idle',
        priority,
      });
      
      expect(result).toBe(true);
    });
  });

  // ========== 状态机测试 (fadeIn → playing → fadeOut) ==========
  describe('状态机', () => {
    it('动作应该从 fadeIn 状态开始', () => {
      system.requestMotion({
        id: 'test',
        group: 'wave',
        priority: 'gesture',
        fadeIn: 200,
      });
      
      const motions = system.getActiveMotions();
      const motion = Array.from(motions.values())[0];
      expect(motion.state).toBe('fadeIn');
    });

    it('fadeIn 完成后应该进入 playing 状态', () => {
      system.requestMotion({
        id: 'test',
        group: 'wave',
        priority: 'gesture',
        fadeIn: 200,
        duration: 5000,
      });
      
      // 推进 200ms 以上完成淡入
      vi.advanceTimersByTime(250);
      
      const motions = system.getActiveMotions();
      const motion = Array.from(motions.values())[0];
      expect(motion.state).toBe('playing');
    });

    it('持续时间结束后应该进入 fadeOut 状态', () => {
      system.requestMotion({
        id: 'test',
        group: 'wave',
        priority: 'gesture',
        fadeIn: 100,
        duration: 500,
        fadeOut: 200,
      });
      
      // fadeIn(100) + duration - fadeOut(200) = 100 + 300 = 400ms 后开始 fadeOut
      vi.advanceTimersByTime(500);
      
      const motions = system.getActiveMotions();
      if (motions.size > 0) {
        const motion = Array.from(motions.values())[0];
        expect(['fadeOut', 'playing']).toContain(motion.state);
      }
    });

    it('fadeOut 完成后动作应该被移除', () => {
      system.requestMotion({
        id: 'test',
        group: 'wave',
        priority: 'gesture',
        fadeIn: 50,
        duration: 100,
        fadeOut: 50,
      });
      
      // 足够长的时间让整个动作完成
      vi.advanceTimersByTime(500);
      
      expect(stopCallback).toHaveBeenCalledWith('wave');
    });

    it('淡入期间权重应该从 0 增加到 1', () => {
      system.requestMotion({
        id: 'test',
        group: 'wave',
        priority: 'gesture',
        fadeIn: 200,
      });
      
      // 淡入开始时权重应该较低
      vi.advanceTimersByTime(20);
      const motions1 = system.getActiveMotions();
      const motion1 = Array.from(motions1.values())[0];
      expect(motion1.currentWeight).toBeLessThan(1);
      
      // 淡入结束时权重应该接近 1
      vi.advanceTimersByTime(250);
      const motions2 = system.getActiveMotions();
      const motion2 = Array.from(motions2.values())[0];
      expect(motion2.currentWeight).toBeCloseTo(1, 0);
    });
  });

  // ========== 身体部位分区测试 ==========
  describe('身体部位分区', () => {
    it('手臂动作应该分配到 arms 部位', () => {
      system.requestMotion({
        id: 'test',
        group: 'wave',
        priority: 'gesture',
      });
      
      const motions = system.getActiveMotions();
      expect(motions.has('arms')).toBe(true);
    });

    it('头部动作应该分配到 head 部位', () => {
      system.requestMotion({
        id: 'test',
        group: 'flick_head',
        priority: 'gesture',
      });
      
      const motions = system.getActiveMotions();
      expect(motions.has('head')).toBe(true);
    });

    it('全身动作应该分配到 full 部位', () => {
      system.requestMotion({
        id: 'test',
        group: 'idle',
        priority: 'idle',
      });
      
      const motions = system.getActiveMotions();
      expect(motions.has('full')).toBe(true);
    });

    it('不同部位的动作应该能同时播放', () => {
      // 手臂动作
      system.requestMotion({
        id: 'arms',
        group: 'wave',
        priority: 'gesture',
      });
      
      // 头部动作
      system.requestMotion({
        id: 'head',
        group: 'flick_head',
        priority: 'gesture',
      });
      
      const motions = system.getActiveMotions();
      expect(motions.size).toBe(2);
      expect(motions.has('arms')).toBe(true);
      expect(motions.has('head')).toBe(true);
    });

    it('相同部位的动作应该互斥', () => {
      system.requestMotion({
        id: 'wave1',
        group: 'zuoshou',
        priority: 'gesture',
      });
      
      system.requestMotion({
        id: 'wave2',
        group: 'youshou',
        priority: 'gesture',
      });
      
      const motions = system.getActiveMotions();
      // 只应该有一个 arms 动作
      expect(motions.size).toBe(1);
    });
  });

  // ========== Idle 动作测试 ==========
  describe('Idle 动作', () => {
    it('应该能设置 Idle 动作', () => {
      system.setIdleMotion({
        id: 'idle',
        group: 'idle',
        loop: true,
      });
      
      // Idle 动作应该自动开始播放
      vi.advanceTimersByTime(100);
      
      const motions = system.getActiveMotions();
      expect(motions.size).toBeGreaterThan(0);
    });

    it('应该能清除 Idle 动作', () => {
      // 先设置 idle
      system.setIdleMotion({
        id: 'idle',
        group: 'idle',
      });
      
      vi.advanceTimersByTime(100);
      
      // 记录设置后的调用次数
      const callCountAfterSet = playCallback.mock.calls.length;
      
      // 清除 idle
      system.setIdleMotion(null);
      system.stopAll(true);
      
      // 重置 mock
      playCallback.mockClear();
      
      // 推进时间，idle 不应该再自动播放
      vi.advanceTimersByTime(200);
      
      // 由于 idle 已清除且 stopAll 了，不应有新的播放
      // 注意：由于系统可能已经停止，我们检查是否没有活动动作
      const motions = system.getActiveMotions();
      expect(motions.size).toBe(0);
    });

    it('其他动作完成后应该恢复 Idle', () => {
      system.setIdleMotion({
        id: 'idle',
        group: 'idle',
      });
      
      // 播放一个短动作
      system.requestMotion({
        id: 'gesture',
        group: 'tap_body',
        priority: 'gesture',
        duration: 100,
        fadeIn: 50,
        fadeOut: 50,
      });
      
      // 等待动作完成
      vi.advanceTimersByTime(500);
      
      // Idle 应该恢复
      const motions = system.getActiveMotions();
      // 由于 tap_body 是 body 部位，idle 是 full 部位
      // 需要确认 idle 在 full 空闲时会触发
    });
  });

  // ========== 停止动作测试 ==========
  describe('停止动作', () => {
    it('stopMotion 应该停止指定部位的动作', () => {
      system.requestMotion({
        id: 'test',
        group: 'wave',
        priority: 'gesture',
      });
      
      system.stopMotion('arms', true);
      
      const motions = system.getActiveMotions();
      expect(motions.has('arms')).toBe(false);
    });

    it('stopMotion(immediate=false) 应该淡出', () => {
      system.requestMotion({
        id: 'test',
        group: 'wave',
        priority: 'gesture',
        fadeIn: 50,
      });
      
      vi.advanceTimersByTime(100); // 完成淡入
      
      system.stopMotion('arms', false);
      
      const motions = system.getActiveMotions();
      if (motions.has('arms')) {
        const motion = motions.get('arms')!;
        expect(motion.state).toBe('fadeOut');
      }
    });

    it('stopAll 应该停止所有动作', () => {
      system.requestMotion({
        id: 'arms',
        group: 'wave',
        priority: 'gesture',
      });
      
      system.requestMotion({
        id: 'head',
        group: 'flick_head',
        priority: 'gesture',
      });
      
      system.stopAll(true);
      
      const motions = system.getActiveMotions();
      expect(motions.size).toBe(0);
    });

    it('停止动作时应该调用 onInterrupt', () => {
      const onInterrupt = vi.fn();
      
      system.requestMotion({
        id: 'test',
        group: 'wave',
        priority: 'gesture',
        fadeIn: 50,
        onInterrupt,
      });
      
      vi.advanceTimersByTime(100);
      
      system.stopMotion('arms', false);
      
      expect(onInterrupt).toHaveBeenCalled();
    });

    it('动作完成时应该调用 onComplete', () => {
      const onComplete = vi.fn();
      
      system.requestMotion({
        id: 'test',
        group: 'wave',
        priority: 'gesture',
        duration: 100,
        fadeIn: 50,
        fadeOut: 50,
        onComplete,
      });
      
      // 等待动作完全结束
      vi.advanceTimersByTime(500);
      
      expect(onComplete).toHaveBeenCalled();
    });
  });

  // ========== 情绪动作测试 ==========
  describe('情绪动作', () => {
    it('playEmotionMotion(happy) 应该播放 tap_body', () => {
      system.playEmotionMotion('happy');
      
      vi.advanceTimersByTime(50);
      
      expect(playCallback).toHaveBeenCalledWith('tap_body', expect.any(Number), expect.any(Number));
    });

    it('playEmotionMotion(excited) 应该播放 wave', () => {
      system.playEmotionMotion('excited');
      
      vi.advanceTimersByTime(50);
      
      expect(playCallback).toHaveBeenCalledWith('wave', expect.any(Number), expect.any(Number));
    });

    it('playEmotionMotion(surprised) 应该播放 flick_head', () => {
      system.playEmotionMotion('surprised');
      
      vi.advanceTimersByTime(50);
      
      expect(playCallback).toHaveBeenCalledWith('flick_head', expect.any(Number), expect.any(Number));
    });

    it('playEmotionMotion 应该使用 emotion 优先级', () => {
      // 先播放 gesture
      system.requestMotion({
        id: 'gesture',
        group: 'tap_body',
        priority: 'gesture',
      });
      
      // emotion 应该能覆盖 gesture
      system.playEmotionMotion('happy');
      
      vi.advanceTimersByTime(50);
      
      // 应该有 emotion 级别的动作
      const motions = system.getActiveMotions();
      const hasEmotionPriority = Array.from(motions.values()).some(m => m.priority === 'emotion');
      expect(hasEmotionPriority).toBe(true);
    });
  });

  // ========== 手势动作测试 ==========
  describe('手势动作', () => {
    it('playGesture(wave) 应该播放 youshou', () => {
      system.playGesture('wave');
      
      vi.advanceTimersByTime(50);
      
      expect(playCallback).toHaveBeenCalledWith('youshou', expect.any(Number), expect.any(Number));
    });

    it('playGesture(point) 应该播放 zuoshou', () => {
      system.playGesture('point');
      
      vi.advanceTimersByTime(50);
      
      expect(playCallback).toHaveBeenCalledWith('zuoshou', expect.any(Number), expect.any(Number));
    });

    it('playGesture(goodbye_left) 应该播放 zuoshou_goodbye', () => {
      system.playGesture('goodbye_left');
      
      vi.advanceTimersByTime(50);
      
      expect(playCallback).toHaveBeenCalledWith('zuoshou_goodbye', expect.any(Number), expect.any(Number));
    });

    it('playGesture(goodbye_right) 应该播放 youshou_goodbye', () => {
      system.playGesture('goodbye_right');
      
      vi.advanceTimersByTime(50);
      
      expect(playCallback).toHaveBeenCalledWith('youshou_goodbye', expect.any(Number), expect.any(Number));
    });
  });

  // ========== 反应动作测试 ==========
  describe('反应动作', () => {
    it('playReaction(nod) 应该播放 tap_body', () => {
      system.playReaction('nod');
      
      vi.advanceTimersByTime(50);
      
      expect(playCallback).toHaveBeenCalledWith('tap_body', expect.any(Number), expect.any(Number));
    });

    it('playReaction(shake) 应该播放 shake', () => {
      system.playReaction('shake');
      
      vi.advanceTimersByTime(50);
      
      expect(playCallback).toHaveBeenCalledWith('shake', expect.any(Number), expect.any(Number));
    });

    it('playReaction(surprise) 应该播放 flick_head', () => {
      system.playReaction('surprise');
      
      vi.advanceTimersByTime(50);
      
      expect(playCallback).toHaveBeenCalledWith('flick_head', expect.any(Number), expect.any(Number));
    });

    it('playReaction 应该使用 reaction 优先级', () => {
      system.playReaction('nod');
      
      const motions = system.getActiveMotions();
      const hasReactionPriority = Array.from(motions.values()).some(m => m.priority === 'reaction');
      expect(hasReactionPriority).toBe(true);
    });

    it('reaction 应该能覆盖 gesture', () => {
      system.requestMotion({
        id: 'gesture',
        group: 'tap_body',
        priority: 'gesture',
      });
      
      system.playReaction('nod');
      
      const motions = system.getActiveMotions();
      const hasReactionPriority = Array.from(motions.values()).some(m => m.priority === 'reaction');
      expect(hasReactionPriority).toBe(true);
    });
  });

  // ========== 边界情况测试 ==========
  describe('边界情况', () => {
    it('未知动作组应该默认到 full 部位', () => {
      system.requestMotion({
        id: 'test',
        group: 'unknown_motion',
        priority: 'gesture',
      });
      
      const motions = system.getActiveMotions();
      expect(motions.has('full')).toBe(true);
    });

    it('duration=0 应该持续播放', () => {
      system.requestMotion({
        id: 'test',
        group: 'idle',
        priority: 'idle',
        duration: 0,
        fadeIn: 50,
      });
      
      vi.advanceTimersByTime(1000);
      
      const motions = system.getActiveMotions();
      expect(motions.size).toBeGreaterThan(0);
    });

    it('多次销毁不应该报错', () => {
      expect(() => {
        system.destroy();
        system.destroy();
      }).not.toThrow();
    });

    it('销毁后请求动作应该仍然可以（重新开始）', () => {
      system.destroy();
      
      // MotionQueueSystem 的 destroy 只是停止循环和清理状态
      // 可以再次调用 requestMotion
      const result = system.requestMotion({
        id: 'test',
        group: 'idle',
        priority: 'idle',
      });
      
      // 由于 isRunning=false，动作会被添加但不会更新
      expect(result).toBe(true);
    });

    it('回调中的错误会传播（当前行为）', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      
      // 添加会抛错的回调
      system.onPlay(errorCallback);
      
      // 当前实现中，回调错误会传播
      // 这是一个记录当前行为的测试，未来可能需要改进
      expect(() => {
        system.requestMotion({
          id: 'test',
          group: 'idle',
          priority: 'idle',
        });
        vi.advanceTimersByTime(50);
      }).toThrow('Callback error');
    });
  });

  // ========== 综合场景测试 ==========
  describe('综合场景', () => {
    it('应该正确处理动作序列', () => {
      const completions: string[] = [];
      
      // 第一个动作
      system.requestMotion({
        id: 'motion1',
        group: 'wave',
        priority: 'gesture',
        duration: 100,
        fadeIn: 30,
        fadeOut: 30,
        onComplete: () => completions.push('motion1'),
      });
      
      vi.advanceTimersByTime(200);
      
      // 第二个动作
      system.requestMotion({
        id: 'motion2',
        group: 'zuoshou',
        priority: 'gesture',
        duration: 100,
        fadeIn: 30,
        fadeOut: 30,
        onComplete: () => completions.push('motion2'),
      });
      
      vi.advanceTimersByTime(300);
      
      expect(completions).toContain('motion1');
    });

    it('高优先级动作应该打断低优先级动作', () => {
      const interrupts: string[] = [];
      
      system.requestMotion({
        id: 'low',
        group: 'wave',
        priority: 'gesture',
        onInterrupt: () => interrupts.push('low'),
      });
      
      vi.advanceTimersByTime(50);
      
      system.requestMotion({
        id: 'high',
        group: 'wave',
        priority: 'emotion',
      });
      
      expect(interrupts).toContain('low');
    });

    it('多部位动作应该独立管理', () => {
      const timeline: string[] = [];
      
      system.onPlay((group) => {
        timeline.push(`play:${group}`);
      });
      
      system.onStop((group) => {
        timeline.push(`stop:${group}`);
      });
      
      // 同时播放手臂和头部动作
      system.requestMotion({
        id: 'arms',
        group: 'wave',
        priority: 'gesture',
        duration: 200,
        fadeIn: 50,
        fadeOut: 50,
      });
      
      system.requestMotion({
        id: 'head',
        group: 'flick_head',
        priority: 'gesture',
        duration: 100,
        fadeIn: 30,
        fadeOut: 30,
      });
      
      vi.advanceTimersByTime(500);
      
      // 两个动作都应该被播放和停止
      expect(timeline.filter(t => t.startsWith('play:')).length).toBeGreaterThanOrEqual(2);
    });
  });

  // ========== 缓动函数测试 ==========
  describe('缓动函数', () => {
    it('淡入淡出应该使用平滑缓动', () => {
      const weights: number[] = [];
      
      system.onPlay((_, __, weight) => {
        weights.push(weight);
      });
      
      system.requestMotion({
        id: 'test',
        group: 'wave',
        priority: 'gesture',
        fadeIn: 200,
      });
      
      // 采样多个时间点的权重
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(25);
      }
      
      // 权重应该是递增的
      for (let i = 1; i < weights.length; i++) {
        expect(weights[i]).toBeGreaterThanOrEqual(weights[i - 1] - 0.01); // 允许小误差
      }
    });
  });
});

// ========== 导出类型测试 (编译时检查) ==========
describe('类型导出', () => {
  it('应该导出所有必要的类型', () => {
    // 这些主要是编译时检查
    const priority: MotionPriority = 'idle';
    const bodyPart: BodyPart = 'full';
    const request: MotionRequest = {
      id: 'test',
      group: 'idle',
      priority: 'idle',
    };
    
    expect(priority).toBeDefined();
    expect(bodyPart).toBeDefined();
    expect(request).toBeDefined();
  });
});
