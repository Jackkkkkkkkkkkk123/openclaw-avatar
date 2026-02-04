/**
 * ExpressionSequencer 单元测试
 * 
 * SOTA 优化器 - Round 10
 * 测试表情序列播放、情绪惯性、智能切换
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock avatarController
vi.mock('./AvatarController', () => ({
  avatarController: {
    setExpression: vi.fn(),
    blendExpressions: vi.fn(),
  },
}));

import { expressionSequencer, ExpressionSequencer } from './ExpressionSequencer';
import { avatarController } from './AvatarController';

describe('ExpressionSequencer', () => {
  let sequencer: ExpressionSequencer;
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // 创建新实例以隔离测试
    sequencer = new ExpressionSequencer();
  });
  
  afterEach(() => {
    sequencer.stop();
    vi.useRealTimers();
  });
  
  // ========== 基础序列播放 ==========
  
  describe('基础序列播放', () => {
    it('应该能获取预设序列列表', () => {
      const presets = sequencer.getPresetNames();
      
      expect(presets).toContain('delighted');
      expect(presets).toContain('shyReaction');
      expect(presets).toContain('figureOut');
      expect(presets).toContain('sympathy');
      expect(presets).toContain('playfulWink');
      expect(presets.length).toBeGreaterThanOrEqual(10);
    });
    
    it('应该能播放预设序列', () => {
      const result = sequencer.playPreset('delighted');
      
      expect(result).toBe(true);
      expect(sequencer.isSequencePlaying()).toBe(true);
      expect(sequencer.getCurrentSequenceName()).toBe('delighted');
    });
    
    it('播放不存在的预设应该返回 false', () => {
      // @ts-expect-error - 测试无效预设名
      const result = sequencer.playPreset('nonexistent');
      
      expect(result).toBe(false);
      expect(sequencer.isSequencePlaying()).toBe(false);
    });
    
    it('应该能播放自定义序列', () => {
      const customSequence = {
        name: 'custom',
        steps: [
          { expression: 'happy' as const, duration: 500 },
          { expression: 'excited' as const, duration: 500 },
        ],
      };
      
      const result = sequencer.play(customSequence);
      
      expect(result).toBe(true);
      expect(sequencer.getCurrentSequenceName()).toBe('custom');
    });
    
    it('空序列应该返回 false', () => {
      const emptySequence = {
        name: 'empty',
        steps: [],
      };
      
      const result = sequencer.play(emptySequence);
      
      expect(result).toBe(false);
    });
  });
  
  // ========== 序列执行 ==========
  
  describe('序列执行', () => {
    it('应该按顺序执行序列步骤', async () => {
      const customSequence = {
        name: 'test',
        steps: [
          { expression: 'surprised' as const, duration: 100 },
          { expression: 'happy' as const, duration: 100 },
        ],
      };
      
      sequencer.play(customSequence);
      
      // 第一步应该立即执行
      expect(avatarController.setExpression).toHaveBeenCalledWith('surprised', { duration: 0 });
      
      // 推进时间到第二步
      vi.advanceTimersByTime(100);
      
      expect(avatarController.setExpression).toHaveBeenCalledWith('happy', { duration: 0 });
    });
    
    it('应该支持带 delay 的步骤', () => {
      const customSequence = {
        name: 'test-delay',
        steps: [
          { expression: 'thinking' as const, duration: 100, delay: 50 },
        ],
      };
      
      sequencer.play(customSequence);
      
      // 延迟期间不应执行
      expect(avatarController.setExpression).not.toHaveBeenCalled();
      
      // 推进到延迟后
      vi.advanceTimersByTime(50);
      
      expect(avatarController.setExpression).toHaveBeenCalledWith('thinking', { duration: 0 });
    });
    
    it('应该支持表情混合 (blend)', () => {
      const customSequence = {
        name: 'test-blend',
        steps: [
          { 
            expression: 'sad' as const, 
            duration: 100,
            blend: { target: 'loving' as const, ratio: 0.4 }
          },
        ],
      };
      
      sequencer.play(customSequence);
      
      expect(avatarController.blendExpressions).toHaveBeenCalledWith('sad', 'loving', 0.4);
    });
    
    it('序列完成后 isPlaying 应该为 false', () => {
      const customSequence = {
        name: 'short',
        steps: [
          { expression: 'happy' as const, duration: 50 },
        ],
      };
      
      sequencer.play(customSequence);
      expect(sequencer.isSequencePlaying()).toBe(true);
      
      // 推进到完成
      vi.advanceTimersByTime(100);
      
      expect(sequencer.isSequencePlaying()).toBe(false);
    });
    
    it('应该执行 onComplete 回调', () => {
      const onComplete = vi.fn();
      const customSequence = {
        name: 'callback-test',
        steps: [
          { expression: 'happy' as const, duration: 50 },
        ],
        onComplete,
      };
      
      sequencer.play(customSequence);
      vi.advanceTimersByTime(100);
      
      expect(onComplete).toHaveBeenCalledOnce();
    });
  });
  
  // ========== 序列控制 ==========
  
  describe('序列控制', () => {
    it('stop() 应该停止当前序列', () => {
      sequencer.playPreset('delighted');
      expect(sequencer.isSequencePlaying()).toBe(true);
      
      sequencer.stop();
      
      expect(sequencer.isSequencePlaying()).toBe(false);
      expect(sequencer.getCurrentSequenceName()).toBeNull();
    });
    
    it('pause() 应该暂停序列', () => {
      sequencer.playPreset('delighted');
      
      sequencer.pause();
      
      expect(sequencer.isSequencePlaying()).toBe(false);
      // 但序列名应该还在（可以恢复）
    });
    
    it('resume() 应该恢复暂停的序列', () => {
      const customSequence = {
        name: 'resume-test',
        steps: [
          { expression: 'surprised' as const, duration: 100 },
          { expression: 'happy' as const, duration: 100 },
        ],
      };
      
      sequencer.play(customSequence);
      vi.advanceTimersByTime(50); // 还在第一步
      
      sequencer.pause();
      vi.clearAllMocks();
      
      sequencer.resume();
      
      expect(sequencer.isSequencePlaying()).toBe(true);
    });
    
    it('新序列应该停止旧序列', () => {
      sequencer.playPreset('delighted');
      expect(sequencer.getCurrentSequenceName()).toBe('delighted');
      
      sequencer.playPreset('shyReaction');
      
      expect(sequencer.getCurrentSequenceName()).toBe('shyReaction');
    });
  });
  
  // ========== 情绪状态管理 ==========
  
  describe('情绪状态管理', () => {
    it('应该跟踪当前情绪状态', () => {
      const state = sequencer.getEmotionState();
      
      expect(state).toHaveProperty('current');
      expect(state).toHaveProperty('previous');
      expect(state).toHaveProperty('timestamp');
      expect(state).toHaveProperty('intensity');
      expect(state).toHaveProperty('momentum');
    });
    
    it('播放序列应该更新情绪历史', () => {
      const customSequence = {
        name: 'history-test',
        steps: [
          { expression: 'happy' as const, duration: 50 },
          { expression: 'excited' as const, duration: 50 },
        ],
      };
      
      sequencer.play(customSequence);
      vi.advanceTimersByTime(50);
      
      const history = sequencer.getEmotionHistory();
      
      expect(history.length).toBeGreaterThan(0);
      expect(history.some(h => h.emotion === 'happy')).toBe(true);
    });
    
    it('情绪历史应该有最大长度限制', () => {
      // 播放多次以超过历史长度
      for (let i = 0; i < 15; i++) {
        const seq = {
          name: `test-${i}`,
          steps: [{ expression: 'happy' as const, duration: 10 }],
        };
        sequencer.play(seq);
        vi.advanceTimersByTime(20);
      }
      
      const history = sequencer.getEmotionHistory();
      expect(history.length).toBeLessThanOrEqual(10);
    });
  });
  
  // ========== 智能表情切换 ==========
  
  describe('智能表情切换 (setEmotionSmart)', () => {
    it('应该切换到新表情', () => {
      // 等待足够时间以避免最小切换间隔
      vi.advanceTimersByTime(1000);
      
      const result = sequencer.setEmotionSmart('happy');
      
      expect(result).toBe(true);
      expect(avatarController.setExpression).toHaveBeenCalledWith('happy');
    });
    
    it('相同表情应该返回 false', () => {
      vi.advanceTimersByTime(1000);
      sequencer.setEmotionSmart('happy');
      vi.clearAllMocks();
      vi.advanceTimersByTime(1000);
      
      const result = sequencer.setEmotionSmart('happy');
      
      expect(result).toBe(false);
    });
    
    it('切换过快应该被阻止（惯性系统）', () => {
      sequencer.setConfig({ enableInertia: true, minSwitchInterval: 500 });
      
      sequencer.setEmotionSmart('happy');
      vi.advanceTimersByTime(100); // 只过了 100ms，小于 500ms
      vi.clearAllMocks();
      
      const result = sequencer.setEmotionSmart('sad');
      
      expect(result).toBe(false);
    });
    
    it('禁用惯性后应该允许快速切换', () => {
      sequencer.setConfig({ enableInertia: false });
      
      sequencer.setEmotionSmart('happy');
      vi.advanceTimersByTime(10);
      vi.clearAllMocks();
      
      const result = sequencer.setEmotionSmart('sad');
      
      expect(result).toBe(true);
    });
  });
  
  // ========== 文本分析触发序列 ==========
  
  describe('文本分析触发序列 (analyzeAndPlaySequence)', () => {
    it('应该识别惊喜关键词并播放 delighted', () => {
      const result = sequencer.analyzeAndPlaySequence('哇，太棒了！');
      
      expect(result).toBe(true);
      expect(sequencer.getCurrentSequenceName()).toBe('delighted');
    });
    
    it('应该识别害羞关键词并播放 shyReaction', () => {
      const result = sequencer.analyzeAndPlaySequence('不好意思啦 ///');
      
      expect(result).toBe(true);
      expect(sequencer.getCurrentSequenceName()).toBe('shyReaction');
    });
    
    it('应该识别恍然大悟关键词并播放 figureOut', () => {
      const result = sequencer.analyzeAndPlaySequence('原来如此，我明白了');
      
      expect(result).toBe(true);
      expect(sequencer.getCurrentSequenceName()).toBe('figureOut');
    });
    
    it('应该识别同情关键词并播放 sympathy', () => {
      const result = sequencer.analyzeAndPlaySequence('辛苦了，抱抱');
      
      expect(result).toBe(true);
      expect(sequencer.getCurrentSequenceName()).toBe('sympathy');
    });
    
    it('应该识别好奇关键词并播放 curiousExplore', () => {
      const result = sequencer.analyzeAndPlaySequence('为什么会这样呢？');
      
      expect(result).toBe(true);
      expect(sequencer.getCurrentSequenceName()).toBe('curiousExplore');
    });
    
    it('应该识别调皮关键词并播放 playfulWink', () => {
      const result = sequencer.analyzeAndPlaySequence('嘿嘿');
      
      expect(result).toBe(true);
      expect(sequencer.getCurrentSequenceName()).toBe('playfulWink');
    });
    
    it('无匹配关键词应该返回 false', () => {
      const result = sequencer.analyzeAndPlaySequence('普通的一句话');
      
      expect(result).toBe(false);
      expect(sequencer.isSequencePlaying()).toBe(false);
    });
    
    it('应该不区分大小写匹配英文关键词', () => {
      const result = sequencer.analyzeAndPlaySequence('WOW Amazing!');
      
      expect(result).toBe(true);
      expect(sequencer.getCurrentSequenceName()).toBe('delighted');
    });
  });
  
  // ========== 配置管理 ==========
  
  describe('配置管理', () => {
    it('应该能更新配置', () => {
      sequencer.setConfig({ enableRebound: false });
      
      const config = sequencer.getConfig();
      
      expect(config.enableRebound).toBe(false);
    });
    
    it('部分更新不应影响其他配置', () => {
      const originalConfig = sequencer.getConfig();
      
      sequencer.setConfig({ minSwitchInterval: 1000 });
      
      const newConfig = sequencer.getConfig();
      expect(newConfig.minSwitchInterval).toBe(1000);
      expect(newConfig.enableInertia).toBe(originalConfig.enableInertia);
    });
  });
  
  // ========== 步骤回调 ==========
  
  describe('步骤回调', () => {
    it('应该能注册和触发步骤回调', () => {
      const callback = vi.fn();
      sequencer.onStep(callback);
      
      const customSequence = {
        name: 'callback-test',
        steps: [
          { expression: 'happy' as const, duration: 50 },
        ],
      };
      
      sequencer.play(customSequence);
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ expression: 'happy' }),
        0
      );
    });
    
    it('应该能移除回调', () => {
      const callback = vi.fn();
      const unsubscribe = sequencer.onStep(callback);
      
      unsubscribe();
      
      sequencer.playPreset('delighted');
      
      expect(callback).not.toHaveBeenCalled();
    });
  });
  
  // ========== 循环序列 ==========
  
  describe('循环序列', () => {
    it('loop 序列应该重新开始', () => {
      const customSequence = {
        name: 'loop-test',
        steps: [
          { expression: 'happy' as const, duration: 50 },
        ],
        loop: true,
      };
      
      sequencer.play(customSequence);
      
      // 第一轮完成
      vi.advanceTimersByTime(60);
      
      // 应该还在播放（循环）
      expect(sequencer.isSequencePlaying()).toBe(true);
      expect(sequencer.getCurrentSequenceName()).toBe('loop-test');
    });
  });
  
  // ========== 边界情况 ==========
  
  describe('边界情况', () => {
    it('未播放时 getCurrentSequenceName 应该返回 null', () => {
      expect(sequencer.getCurrentSequenceName()).toBeNull();
    });
    
    it('停止后再 resume 不应该做任何事', () => {
      sequencer.playPreset('delighted');
      sequencer.stop();
      vi.clearAllMocks();
      
      sequencer.resume();
      
      expect(sequencer.isSequencePlaying()).toBe(false);
      expect(avatarController.setExpression).not.toHaveBeenCalled();
    });
    
    it('blend 缺少 target 时应该使用 neutral', () => {
      const customSequence = {
        name: 'blend-default',
        steps: [
          { 
            expression: 'happy' as const, 
            duration: 50,
            blend: { ratio: 0.5 }
          },
        ],
      };
      
      sequencer.play(customSequence);
      
      expect(avatarController.blendExpressions).toHaveBeenCalledWith('happy', 'neutral', 0.5);
    });
    
    it('blend 缺少 ratio 时应该使用 0.5', () => {
      const customSequence = {
        name: 'blend-ratio-default',
        steps: [
          { 
            expression: 'happy' as const, 
            duration: 50,
            blend: { target: 'sad' as const }
          },
        ],
      };
      
      sequencer.play(customSequence);
      
      expect(avatarController.blendExpressions).toHaveBeenCalledWith('happy', 'sad', 0.5);
    });
  });
});

// ========== 单例测试 ==========

describe('expressionSequencer 单例', () => {
  it('应该导出单例实例', () => {
    expect(expressionSequencer).toBeInstanceOf(ExpressionSequencer);
  });
});
