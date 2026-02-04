/**
 * ContextualResponseSystem 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  ContextualResponseSystem, 
  ConversationPhase, 
  TopicCategory, 
  UserIntent 
} from './ContextualResponseSystem';

describe('ContextualResponseSystem', () => {
  let system: ContextualResponseSystem;

  beforeEach(() => {
    system = new ContextualResponseSystem();
  });

  describe('初始化', () => {
    it('应该使用默认配置创建', () => {
      const state = system.getState();
      expect(state.phase).toBe('greeting');
      expect(state.turnCount).toBe(0);
      expect(state.currentTopic).toBe('casual');
    });

    it('应该使用自定义配置创建', () => {
      const custom = new ContextualResponseSystem({
        maxTurns: 100,
        topicChangeThreshold: 0.8
      });
      expect(custom).toBeDefined();
    });

    it('应该初始化响应风格', () => {
      const state = system.getState();
      expect(state.responseStyle.formality).toBeGreaterThan(0);
      expect(state.responseStyle.enthusiasm).toBeGreaterThan(0);
      expect(state.responseStyle.empathy).toBeGreaterThan(0);
    });
  });

  describe('对话轮次处理', () => {
    it('应该记录用户轮次', () => {
      system.processTurn('你好', 'user');
      expect(system.getState().turnCount).toBe(1);
    });

    it('应该记录助手轮次', () => {
      system.processTurn('你好', 'user');
      system.processTurn('你好呀！', 'assistant');
      expect(system.getTurns().length).toBe(2);
    });

    it('应该保存情感轨迹', () => {
      system.processTurn('我很开心', 'user', 'happy');
      expect(system.getState().emotionTrajectory).toContain('happy');
    });

    it('应该限制历史轮次数量', () => {
      const custom = new ContextualResponseSystem({ maxTurns: 3 });
      for (let i = 0; i < 5; i++) {
        custom.processTurn(`消息${i}`, 'user');
      }
      expect(custom.getTurns().length).toBe(3);
    });

    it('应该获取最近 N 轮对话', () => {
      for (let i = 0; i < 5; i++) {
        system.processTurn(`消息${i}`, 'user');
      }
      const recent = system.getRecentTurns(2);
      expect(recent.length).toBe(2);
      expect(recent[1].text).toBe('消息4');
    });
  });

  describe('意图检测', () => {
    it('应该检测寻求信息意图', () => {
      system.processTurn('这是什么？告诉我', 'user');
      const state = system.getState();
      expect(state.userIntents).toContain('seek_info');
    });

    it('应该检测寻求帮助意图', () => {
      system.processTurn('帮帮我，我不知道怎么办', 'user');
      const state = system.getState();
      expect(state.userIntents).toContain('seek_help');
    });

    it('应该检测分享感受意图', () => {
      system.processTurn('我觉得今天心情很好', 'user');
      const state = system.getState();
      expect(state.userIntents).toContain('share_feeling');
    });

    it('应该检测确认意图', () => {
      system.processTurn('好的，没问题', 'user');
      const state = system.getState();
      expect(state.userIntents).toContain('confirm');
    });

    it('应该检测拒绝意图', () => {
      system.processTurn('不要，算了', 'user');
      const state = system.getState();
      expect(state.userIntents).toContain('reject');
    });

    it('应该检测换话题意图', () => {
      system.processTurn('对了，话说另一件事', 'user');
      const state = system.getState();
      expect(state.userIntents).toContain('change_topic');
    });

    it('应该限制意图历史长度', () => {
      for (let i = 0; i < 15; i++) {
        system.processTurn('好的没问题', 'user');
      }
      expect(system.getState().userIntents.length).toBeLessThanOrEqual(10);
    });
  });

  describe('话题检测', () => {
    it('应该检测日常闲聊话题', () => {
      system.processTurn('今天天气真好，周末去看电影吧', 'user');
      expect(system.getState().currentTopic).toBe('casual');
    });

    it('应该检测问答话题', () => {
      system.processTurn('什么是人工智能？怎么学习？', 'user');
      expect(system.getState().currentTopic).toBe('question');
    });

    it('应该检测情感话题', () => {
      system.processTurn('我今天好难过好伤心', 'user');
      expect(system.getState().currentTopic).toBe('emotion');
    });

    it('应该检测任务话题', () => {
      system.processTurn('帮我完成这个任务，需要处理一下', 'user');
      expect(system.getState().currentTopic).toBe('task');
    });

    it('应该检测技术话题', () => {
      system.processTurn('这段代码有bug，程序调试出错了', 'user');
      expect(system.getState().currentTopic).toBe('technical');
    });

    it('应该追踪话题持续时间', () => {
      system.processTurn('今天天气好', 'user');
      system.processTurn('天气确实不错', 'assistant');
      system.processTurn('周末去玩', 'user');
      expect(system.getState().topicDuration).toBeGreaterThanOrEqual(1);
    });
  });

  describe('对话阶段', () => {
    it('应该从问候阶段开始', () => {
      expect(system.getState().phase).toBe('greeting');
    });

    it('应该识别问候', () => {
      system.processTurn('你好呀！', 'user');
      expect(system.getState().phase).toBe('greeting');
    });

    it('应该识别告别', () => {
      system.processTurn('再见！', 'user');
      expect(system.getState().phase).toBe('farewell');
    });

    it('应该推进到热身阶段', () => {
      system.processTurn('今天天气不错', 'user');  // turnCount = 1, < warmingTurns(2)
      expect(system.getState().phase).toBe('warming');
    });

    it('应该推进到主要讨论阶段', () => {
      for (let i = 0; i < 5; i++) {
        system.processTurn(`消息${i}`, 'user');
      }
      expect(['main', 'deepening']).toContain(system.getState().phase);
    });

    it('应该推进到深入讨论阶段', () => {
      for (let i = 0; i < 16; i++) {
        system.processTurn(`深入讨论消息${i}`, 'user');
      }
      expect(system.getState().phase).toBe('deepening');
    });
  });

  describe('响应建议', () => {
    it('应该返回响应建议', () => {
      const suggestion = system.getResponseSuggestion();
      expect(suggestion.emotion).toBeDefined();
      expect(suggestion.motionHint).toBeDefined();
    });

    it('问候阶段应该建议开心情绪', () => {
      system.processTurn('你好！', 'user');
      const suggestion = system.getResponseSuggestion();
      expect(suggestion.emotion).toBe('happy');
      expect(suggestion.motionHint).toBe('greeting');
    });

    it('告别阶段应该建议平静情绪', () => {
      system.processTurn('再见！', 'user');
      const suggestion = system.getResponseSuggestion();
      expect(suggestion.emotion).toBe('calm');
      expect(suggestion.motionHint).toBe('wave');
    });

    it('分享感受时应该增加共情', () => {
      system.processTurn('我觉得今天心情不好', 'user', 'sad');
      const suggestion = system.getResponseSuggestion();
      expect(suggestion.styleAdjustments.empathy).toBeGreaterThanOrEqual(0.8);
    });

    it('寻求帮助时应该建议思考', () => {
      system.processTurn('帮帮我，我不知道怎么办', 'user');
      const suggestion = system.getResponseSuggestion();
      expect(suggestion.emotion).toBe('thinking');
      expect(suggestion.motionHint).toBe('thinking');
    });

    it('创意话题应该建议兴奋', () => {
      system.processTurn('我有个创意想法要构思', 'user');
      const suggestion = system.getResponseSuggestion();
      expect(suggestion.emotion).toBe('excited');
    });

    it('应该包含开场短语建议', () => {
      system.processTurn('你好！', 'user');
      const suggestion = system.getResponseSuggestion();
      expect(suggestion.openingPhrases).toBeDefined();
      expect(suggestion.openingPhrases!.length).toBeGreaterThan(0);
    });
  });

  describe('参与度检测', () => {
    it('初始应该是参与的', () => {
      expect(system.getState().isEngaged).toBe(true);
    });

    it('长消息应该保持参与度', () => {
      system.processTurn('这是一条非常长的消息，包含很多内容和想法，显示用户很投入对话。', 'user');
      expect(system.getState().isEngaged).toBe(true);
    });

    it('短消息可能降低参与度', () => {
      // 连续发送很短的消息
      for (let i = 0; i < 10; i++) {
        system.processTurn('嗯', 'user');
      }
      // 参与度会随时间衰减
      expect(system.getState().turnCount).toBeGreaterThan(5);
    });
  });

  describe('主动话题发起', () => {
    it('应该检测是否需要主动发起话题', () => {
      const result = system.shouldInitiateTopic();
      expect(typeof result).toBe('boolean');
    });

    it('初始不需要主动发起', () => {
      expect(system.shouldInitiateTopic()).toBe(false);
    });
  });

  describe('订阅机制', () => {
    it('应该支持状态订阅', () => {
      const callback = vi.fn();
      system.onStateChange(callback);
      
      system.processTurn('测试', 'user');
      expect(callback).toHaveBeenCalled();
    });

    it('应该支持取消订阅', () => {
      const callback = vi.fn();
      const unsubscribe = system.onStateChange(callback);
      
      unsubscribe();
      system.processTurn('测试', 'user');
      expect(callback).not.toHaveBeenCalled();
    });

    it('回调错误不应该中断其他回调', () => {
      const errorCallback = vi.fn(() => { throw new Error('test'); });
      const normalCallback = vi.fn();
      
      system.onStateChange(errorCallback);
      system.onStateChange(normalCallback);
      
      system.processTurn('测试', 'user');
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('重置', () => {
    it('应该重置所有状态', () => {
      system.processTurn('你好', 'user');
      system.processTurn('你好！', 'assistant');
      
      system.reset();
      
      expect(system.getState().turnCount).toBe(0);
      expect(system.getTurns().length).toBe(0);
      expect(system.getState().phase).toBe('greeting');
    });

    it('重置应该通知订阅者', () => {
      const callback = vi.fn();
      system.onStateChange(callback);
      
      system.reset();
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('统计信息', () => {
    it('应该返回对话统计', () => {
      system.processTurn('你好', 'user');
      system.processTurn('你好呀！', 'assistant');
      
      const stats = system.getStatistics();
      expect(stats.totalTurns).toBe(2);
      expect(stats.userTurns).toBe(1);
    });

    it('应该计算平均消息长度', () => {
      system.processTurn('短消息', 'user');
      system.processTurn('这是一条比较长的消息', 'user');
      
      const stats = system.getStatistics();
      expect(stats.avgUserMsgLength).toBeGreaterThan(0);
    });

    it('应该统计话题变化', () => {
      system.processTurn('今天天气好', 'user');  // casual
      system.processTurn('这段代码有bug', 'user');  // technical
      
      const stats = system.getStatistics();
      expect(stats.topicChanges).toBeGreaterThanOrEqual(1);
    });

    it('应该找出主要话题', () => {
      system.processTurn('今天天气好', 'user');
      system.processTurn('周末去看电影', 'user');
      system.processTurn('最近好无聊', 'user');
      
      const stats = system.getStatistics();
      expect(stats.dominantTopic).toBe('casual');
    });

    it('应该找出主要意图', () => {
      system.processTurn('好的没问题', 'user');
      system.processTurn('行，可以', 'user');
      system.processTurn('嗯嗯同意', 'user');
      
      const stats = system.getStatistics();
      expect(stats.dominantIntent).toBe('confirm');
    });
  });

  describe('情感轨迹', () => {
    it('应该追踪情感变化', () => {
      system.processTurn('开心', 'user', 'happy');
      system.processTurn('难过', 'user', 'sad');
      system.processTurn('平静', 'user', 'calm');
      
      const trajectory = system.getState().emotionTrajectory;
      expect(trajectory).toEqual(['happy', 'sad', 'calm']);
    });

    it('应该限制情感历史长度', () => {
      for (let i = 0; i < 15; i++) {
        system.processTurn(`消息${i}`, 'user', 'happy');
      }
      expect(system.getState().emotionTrajectory.length).toBeLessThanOrEqual(10);
    });
  });

  describe('响应风格调整', () => {
    it('情感话题应该增加共情', () => {
      system.processTurn('我好难过好伤心', 'user');
      const style = system.getState().responseStyle;
      expect(style.empathy).toBeGreaterThanOrEqual(0.5);
    });

    it('技术话题应该增加正式程度', () => {
      system.processTurn('这段代码有bug', 'user');
      const style = system.getState().responseStyle;
      expect(style.formality).toBeGreaterThanOrEqual(0.3);
    });

    it('问候阶段应该增加热情', () => {
      system.processTurn('你好！', 'user');
      const style = system.getState().responseStyle;
      expect(style.enthusiasm).toBeGreaterThanOrEqual(0.7);
    });
  });
});
