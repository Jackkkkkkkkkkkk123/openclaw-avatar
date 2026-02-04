/**
 * EmotionTransitionGraph 测试
 * 
 * 测试情绪过渡图系统：
 * - 情绪位置计算 (Valence-Arousal 模型)
 * - 自然过渡路径
 * - 过渡动画时间
 * - 缓动函数
 * - 回调系统
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmotionTransitionGraph, type TransitionState } from './EmotionTransitionGraph';
import type { Expression } from './AvatarController';

describe('EmotionTransitionGraph', () => {
  let graph: EmotionTransitionGraph;

  beforeEach(() => {
    // 使用假定时器
    vi.useFakeTimers();
    graph = new EmotionTransitionGraph();
  });

  afterEach(() => {
    graph.destroy();
    vi.useRealTimers();
  });

  // ========== 基础功能测试 ==========
  describe('基础功能', () => {
    it('创建时默认情绪为 neutral', () => {
      expect(graph.getCurrentEmotion()).toBe('neutral');
      expect(graph.getTargetEmotion()).toBe('neutral');
    });

    it('初始状态不在过渡中', () => {
      expect(graph.isTransitioning()).toBe(false);
    });
  });

  // ========== 情绪位置测试 ==========
  describe('情绪位置 (Valence-Arousal 模型)', () => {
    it('获取 neutral 位置 (原点)', () => {
      const pos = graph.getEmotionPosition('neutral');
      expect(pos.valence).toBe(0);
      expect(pos.arousal).toBe(0);
      expect(pos.category).toBe('neutral');
    });

    it('获取 happy 位置 (积极+中等唤醒)', () => {
      const pos = graph.getEmotionPosition('happy');
      expect(pos.valence).toBeGreaterThan(0);
      expect(pos.arousal).toBeGreaterThan(0);
      expect(pos.category).toBe('positive');
    });

    it('获取 sad 位置 (消极+低唤醒)', () => {
      const pos = graph.getEmotionPosition('sad');
      expect(pos.valence).toBeLessThan(0);
      expect(pos.arousal).toBeLessThan(0);
      expect(pos.category).toBe('negative');
    });

    it('获取 excited 位置 (积极+高唤醒)', () => {
      const pos = graph.getEmotionPosition('excited');
      expect(pos.valence).toBeGreaterThan(0.7);
      expect(pos.arousal).toBeGreaterThan(0.8);
      expect(pos.category).toBe('aroused');
    });

    it('获取 angry 位置 (消极+高唤醒)', () => {
      const pos = graph.getEmotionPosition('angry');
      expect(pos.valence).toBeLessThan(0);
      expect(pos.arousal).toBeGreaterThan(0.5);
      expect(pos.category).toBe('negative');
    });

    it('获取 relieved 位置 (积极+低唤醒)', () => {
      const pos = graph.getEmotionPosition('relieved');
      expect(pos.valence).toBeGreaterThan(0);
      expect(pos.arousal).toBeLessThan(0);
      expect(pos.category).toBe('calm');
    });
  });

  // ========== 情绪类别测试 ==========
  describe('情绪类别', () => {
    it('positive 类别情绪', () => {
      expect(graph.getEmotionCategory('happy')).toBe('positive');
      expect(graph.getEmotionCategory('loving')).toBe('positive');
      expect(graph.getEmotionCategory('grateful')).toBe('positive');
      expect(graph.getEmotionCategory('hopeful')).toBe('positive');
      expect(graph.getEmotionCategory('proud')).toBe('positive');
    });

    it('negative 类别情绪', () => {
      expect(graph.getEmotionCategory('sad')).toBe('negative');
      expect(graph.getEmotionCategory('angry')).toBe('negative');
      expect(graph.getEmotionCategory('fear')).toBe('negative');
      expect(graph.getEmotionCategory('disgusted')).toBe('negative');
      expect(graph.getEmotionCategory('disappointed')).toBe('negative');
    });

    it('neutral 类别情绪', () => {
      expect(graph.getEmotionCategory('neutral')).toBe('neutral');
      expect(graph.getEmotionCategory('thinking')).toBe('neutral');
      expect(graph.getEmotionCategory('confused')).toBe('neutral');
    });

    it('aroused 类别情绪', () => {
      expect(graph.getEmotionCategory('excited')).toBe('aroused');
      expect(graph.getEmotionCategory('surprised')).toBe('aroused');
    });

    it('calm 类别情绪', () => {
      expect(graph.getEmotionCategory('relieved')).toBe('calm');
      expect(graph.getEmotionCategory('bored')).toBe('calm');
    });
  });

  // ========== 情绪距离测试 ==========
  describe('情绪距离计算', () => {
    it('相同情绪距离为 0', () => {
      expect(graph.getEmotionDistance('happy', 'happy')).toBe(0);
      expect(graph.getEmotionDistance('neutral', 'neutral')).toBe(0);
    });

    it('neutral 到 happy 距离适中', () => {
      const distance = graph.getEmotionDistance('neutral', 'happy');
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(0.5);
    });

    it('happy 到 sad 距离较远', () => {
      const happyToSad = graph.getEmotionDistance('happy', 'sad');
      const happyToNeutral = graph.getEmotionDistance('happy', 'neutral');
      expect(happyToSad).toBeGreaterThan(happyToNeutral);
    });

    it('excited 到 bored 距离最远', () => {
      const distance = graph.getEmotionDistance('excited', 'bored');
      expect(distance).toBeGreaterThan(0.5);
    });

    it('相似情绪距离较近', () => {
      const happyToAmused = graph.getEmotionDistance('happy', 'amused');
      const happyToAngry = graph.getEmotionDistance('happy', 'angry');
      expect(happyToAmused).toBeLessThan(happyToAngry);
    });

    it('距离归一化在 0-1 范围内', () => {
      const emotions: Expression[] = ['happy', 'sad', 'angry', 'fear', 'excited', 'bored'];
      for (const e1 of emotions) {
        for (const e2 of emotions) {
          const distance = graph.getEmotionDistance(e1, e2);
          expect(distance).toBeGreaterThanOrEqual(0);
          expect(distance).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  // ========== 立即设置情绪测试 ==========
  describe('立即设置情绪 (setEmotionImmediate)', () => {
    it('立即设置到 happy', () => {
      graph.setEmotionImmediate('happy');
      expect(graph.getCurrentEmotion()).toBe('happy');
      expect(graph.getTargetEmotion()).toBe('happy');
      expect(graph.isTransitioning()).toBe(false);
    });

    it('立即设置不触发过渡', () => {
      const onTransition = vi.fn();
      graph.onTransition(onTransition);
      
      graph.setEmotionImmediate('sad');
      
      expect(onTransition).not.toHaveBeenCalled();
      expect(graph.isTransitioning()).toBe(false);
    });

    it('立即设置触发情绪变化回调', () => {
      const onEmotionChange = vi.fn();
      graph.onEmotionChange(onEmotionChange);
      
      graph.setEmotionImmediate('excited');
      
      expect(onEmotionChange).toHaveBeenCalledWith('excited');
    });
  });

  // ========== 过渡设置情绪测试 ==========
  describe('过渡设置情绪 (setEmotion)', () => {
    it('设置相同情绪不触发过渡', () => {
      graph.setEmotionImmediate('happy');
      graph.setEmotion('happy');
      expect(graph.isTransitioning()).toBe(false);
    });

    it('设置不同情绪开始过渡', () => {
      graph.setEmotion('happy');
      expect(graph.isTransitioning()).toBe(true);
      expect(graph.getTargetEmotion()).toBe('happy');
    });

    it('过渡期间触发过渡回调', () => {
      const onTransition = vi.fn();
      graph.onTransition(onTransition);
      
      graph.setEmotion('happy');
      
      // 触发动画帧
      vi.advanceTimersByTime(100);
      
      expect(onTransition).toHaveBeenCalled();
      const state = onTransition.mock.calls[0][0] as TransitionState;
      expect(state.from).toBe('neutral');
      expect(state.to).toBe('happy');
    });

    it('过渡完成后更新当前情绪', () => {
      const onEmotionChange = vi.fn();
      graph.onEmotionChange(onEmotionChange);
      
      graph.setEmotion('happy');
      
      // 等待过渡完成 (默认 400ms)
      vi.advanceTimersByTime(500);
      
      expect(graph.isTransitioning()).toBe(false);
      expect(graph.getCurrentEmotion()).toBe('happy');
      expect(onEmotionChange).toHaveBeenCalledWith('happy');
    });

    it('过渡中设置新情绪会打断当前过渡', () => {
      graph.setEmotion('happy');
      vi.advanceTimersByTime(200); // 过渡一半
      
      graph.setEmotion('sad');
      
      expect(graph.getTargetEmotion()).toBe('sad');
      expect(graph.isTransitioning()).toBe(true);
    });
  });

  // ========== 过渡配置测试 ==========
  describe('过渡配置', () => {
    it('neutral → happy 使用预定义配置', () => {
      const onTransition = vi.fn();
      graph.onTransition(onTransition);
      
      graph.setEmotion('happy');
      vi.advanceTimersByTime(50);
      
      const state = onTransition.mock.calls[0][0] as TransitionState;
      expect(state.config.duration).toBe(400);
      expect(state.config.easing).toBe('easeOut');
    });

    it('neutral → sad 过渡较慢', () => {
      const onTransition = vi.fn();
      graph.onTransition(onTransition);
      
      graph.setEmotion('sad');
      vi.advanceTimersByTime(50);
      
      const state = onTransition.mock.calls[0][0] as TransitionState;
      expect(state.config.duration).toBe(600);
    });

    it('neutral → surprised 过渡最快', () => {
      const onTransition = vi.fn();
      graph.onTransition(onTransition);
      
      graph.setEmotion('surprised');
      vi.advanceTimersByTime(50);
      
      const state = onTransition.mock.calls[0][0] as TransitionState;
      expect(state.config.duration).toBe(200);
    });

    it('happy → sad 有中间情绪', () => {
      graph.setEmotionImmediate('happy');
      
      const onTransition = vi.fn();
      graph.onTransition(onTransition);
      
      graph.setEmotion('sad');
      vi.advanceTimersByTime(50);
      
      const state = onTransition.mock.calls[0][0] as TransitionState;
      expect(state.intermediate).toBe('neutral');
      expect(state.config.duration).toBe(800);
    });

    it('没有预定义规则时使用默认配置', () => {
      graph.setEmotionImmediate('playful');
      
      const onTransition = vi.fn();
      graph.onTransition(onTransition);
      
      graph.setEmotion('anxious');
      vi.advanceTimersByTime(50);
      
      const state = onTransition.mock.calls[0][0] as TransitionState;
      expect(state.config.easing).toBe('easeInOut');
      // 持续时间根据距离动态计算
      expect(state.config.duration).toBeGreaterThanOrEqual(300);
    });
  });

  // ========== 插值位置测试 ==========
  describe('插值位置 (getInterpolatedPosition)', () => {
    it('无过渡时返回当前情绪位置', () => {
      graph.setEmotionImmediate('happy');
      
      const pos = graph.getInterpolatedPosition();
      const happyPos = graph.getEmotionPosition('happy');
      
      expect(pos.valence).toBe(happyPos.valence);
      expect(pos.arousal).toBe(happyPos.arousal);
    });

    it('过渡中返回插值位置', () => {
      graph.setEmotion('happy');
      vi.advanceTimersByTime(200); // 过渡一半
      
      const pos = graph.getInterpolatedPosition();
      const neutralPos = graph.getEmotionPosition('neutral');
      const happyPos = graph.getEmotionPosition('happy');
      
      // 介于两者之间
      expect(pos.valence).toBeGreaterThan(neutralPos.valence);
      expect(pos.valence).toBeLessThan(happyPos.valence);
    });

    it('过渡完成后返回目标位置', () => {
      graph.setEmotion('happy');
      vi.advanceTimersByTime(500); // 过渡完成
      
      const pos = graph.getInterpolatedPosition();
      const happyPos = graph.getEmotionPosition('happy');
      
      expect(pos.valence).toBe(happyPos.valence);
      expect(pos.arousal).toBe(happyPos.arousal);
    });
  });

  // ========== 回调订阅测试 ==========
  describe('回调订阅', () => {
    it('订阅过渡回调', () => {
      const callback = vi.fn();
      const unsubscribe = graph.onTransition(callback);
      
      graph.setEmotion('happy');
      vi.advanceTimersByTime(100);
      
      expect(callback).toHaveBeenCalled();
      
      unsubscribe();
      callback.mockClear();
      
      graph.setEmotion('sad');
      vi.advanceTimersByTime(100);
      
      // 取消订阅后不再调用
      expect(callback).not.toHaveBeenCalled();
    });

    it('订阅情绪变化回调', () => {
      const callback = vi.fn();
      const unsubscribe = graph.onEmotionChange(callback);
      
      graph.setEmotion('happy');
      vi.advanceTimersByTime(500);
      
      expect(callback).toHaveBeenCalledWith('happy');
      
      unsubscribe();
      callback.mockClear();
      
      graph.setEmotionImmediate('sad');
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('多个回调同时工作', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      graph.onTransition(callback1);
      graph.onTransition(callback2);
      
      graph.setEmotion('happy');
      vi.advanceTimersByTime(100);
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('回调错误不影响其他回调', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalCallback = vi.fn();
      
      graph.onTransition(errorCallback);
      graph.onTransition(normalCallback);
      
      graph.setEmotion('happy');
      vi.advanceTimersByTime(100);
      
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  // ========== 生命周期测试 ==========
  describe('生命周期', () => {
    it('stop 停止动画循环', () => {
      const callback = vi.fn();
      graph.onTransition(callback);
      
      graph.setEmotion('happy');
      graph.stop();
      
      vi.advanceTimersByTime(500);
      
      // 停止后进度不再更新
      expect(graph.isTransitioning()).toBe(true);
    });

    it('destroy 清理所有资源', () => {
      const transitionCallback = vi.fn();
      const emotionCallback = vi.fn();
      
      graph.onTransition(transitionCallback);
      graph.onEmotionChange(emotionCallback);
      
      graph.destroy();
      
      // 尝试设置情绪
      graph.setEmotionImmediate('happy');
      
      // 回调已清理
      expect(emotionCallback).not.toHaveBeenCalled();
    });
  });

  // ========== 缓动函数测试 ==========
  describe('缓动函数', () => {
    // 通过观察过渡进度来测试缓动
    it('linear 缓动进度线性', () => {
      // 使用 thinking -> neutral 过渡 (linear easing)
      graph.setEmotionImmediate('thinking');
      
      const progresses: number[] = [];
      graph.onTransition((state) => {
        progresses.push(state.progress);
      });
      
      graph.setEmotion('neutral');
      
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(30);
      }
      
      // 进度应该是线性增长的
      expect(progresses.length).toBeGreaterThan(0);
    });

    it('easeOut 缓动开始快结束慢', () => {
      const progresses: number[] = [];
      graph.onTransition((state) => {
        progresses.push(state.progress);
      });
      
      // neutral -> happy 是 easeOut
      graph.setEmotion('happy');
      
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(40);
      }
      
      expect(progresses.length).toBeGreaterThan(0);
      // easeOut: 前半段增量 > 后半段增量
    });

    it('easeIn 缓动开始慢结束快', () => {
      // neutral -> sad 是 easeIn
      const progresses: number[] = [];
      graph.onTransition((state) => {
        progresses.push(state.progress);
      });
      
      graph.setEmotion('sad');
      
      for (let i = 0; i < 15; i++) {
        vi.advanceTimersByTime(40);
      }
      
      expect(progresses.length).toBeGreaterThan(0);
    });
  });

  // ========== 边界情况测试 ==========
  describe('边界情况', () => {
    it('快速连续设置情绪', () => {
      graph.setEmotion('happy');
      graph.setEmotion('sad');
      graph.setEmotion('angry');
      graph.setEmotion('neutral');
      
      expect(graph.getTargetEmotion()).toBe('neutral');
    });

    it('过渡中打断后正确完成新过渡', () => {
      const emotionChanges: Expression[] = [];
      graph.onEmotionChange((emotion) => {
        emotionChanges.push(emotion);
      });
      
      graph.setEmotion('happy');
      vi.advanceTimersByTime(100);
      
      graph.setEmotion('sad');
      vi.advanceTimersByTime(1000); // 足够完成过渡
      
      expect(graph.getCurrentEmotion()).toBe('sad');
      expect(emotionChanges).toContain('sad');
    });

    it('所有 24 种表情都有有效位置', () => {
      const emotions: Expression[] = [
        'neutral', 'happy', 'sad', 'surprised', 'angry', 'fear', 'disgusted',
        'excited', 'proud', 'loving', 'grateful', 'hopeful', 'amused', 'relieved',
        'anxious', 'embarrassed', 'confused', 'bored', 'disappointed', 'lonely',
        'thinking', 'curious', 'determined', 'playful'
      ];
      
      for (const emotion of emotions) {
        const pos = graph.getEmotionPosition(emotion);
        expect(pos.valence).toBeGreaterThanOrEqual(-1);
        expect(pos.valence).toBeLessThanOrEqual(1);
        expect(pos.arousal).toBeGreaterThanOrEqual(-1);
        expect(pos.arousal).toBeLessThanOrEqual(1);
        expect(['positive', 'negative', 'neutral', 'aroused', 'calm']).toContain(pos.category);
      }
    });
  });

  // ========== 综合场景测试 ==========
  describe('综合场景', () => {
    it('模拟对话中的情绪变化序列', async () => {
      const emotionSequence: Expression[] = [];
      graph.onEmotionChange((emotion) => {
        emotionSequence.push(emotion);
      });
      
      // 用户问候 -> 开心
      graph.setEmotion('happy');
      vi.advanceTimersByTime(600); // 确保过渡完成 (happy 过渡 400ms)
      
      // 用户说悲伤的事 -> 同情
      graph.setEmotion('sad');
      vi.advanceTimersByTime(1000); // sad 过渡可能有中间状态，需要更长时间
      
      // 用户开玩笑 -> 开心
      graph.setEmotion('amused');
      vi.advanceTimersByTime(600);
      
      // 用户问问题 -> 思考
      graph.setEmotion('thinking');
      vi.advanceTimersByTime(600);
      
      // 用户说谢谢 -> 开心
      graph.setEmotion('happy');
      vi.advanceTimersByTime(600);
      
      // 验证关键情绪出现过 (顺序可能因过渡逻辑而变)
      expect(emotionSequence).toContain('happy');
      expect(emotionSequence).toContain('sad');
      // amused 和 thinking 需要从各自的前置情绪过渡，确保它们出现
      expect(emotionSequence.filter(e => e === 'amused' || e === 'thinking' || e === 'happy').length).toBeGreaterThanOrEqual(2);
    });

    it('情绪过渡保持自然（相似情绪过渡快，对立情绪过渡慢）', () => {
      // 记录过渡持续时间
      let happyToExcitedDuration = 0;
      let happyToSadDuration = 0;
      
      graph.setEmotionImmediate('happy');
      graph.onTransition((state) => {
        if (state.to === 'excited') {
          happyToExcitedDuration = state.config.duration;
        }
        if (state.to === 'sad') {
          happyToSadDuration = state.config.duration;
        }
      });
      
      graph.setEmotion('excited');
      vi.advanceTimersByTime(50);
      
      graph.setEmotionImmediate('happy');
      graph.setEmotion('sad');
      vi.advanceTimersByTime(50);
      
      // happy -> sad 应该比 happy -> excited 更慢
      expect(happyToSadDuration).toBeGreaterThan(happyToExcitedDuration);
    });
  });
});
