import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InteractionMemory, InteractionType, InteractionData } from './InteractionMemory';

describe('InteractionMemory', () => {
  let memory: InteractionMemory;
  let mockStorage: Map<string, string>;

  beforeEach(() => {
    mockStorage = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage.get(key) || null,
      setItem: (key: string, value: string) => mockStorage.set(key, value),
      removeItem: (key: string) => mockStorage.delete(key),
      clear: () => mockStorage.clear(),
      length: 0,
      key: () => null
    });

    memory = new InteractionMemory({
      persistToStorage: false  // 禁用持久化便于测试
    });
  });

  afterEach(() => {
    memory.destroy();
    vi.unstubAllGlobals();
  });

  describe('基础功能', () => {
    it('应该能创建实例', () => {
      expect(memory).toBeInstanceOf(InteractionMemory);
    });

    it('应该使用默认配置', () => {
      const config = memory.getConfig();
      expect(config.maxRecords).toBe(1000);
      expect(config.analysisWindow).toBe(24 * 60 * 60 * 1000);
    });

    it('应该能更新配置', () => {
      memory.updateConfig({ maxRecords: 500 });
      expect(memory.getConfig().maxRecords).toBe(500);
    });
  });

  describe('记录交互', () => {
    it('应该能记录交互', () => {
      const record = memory.record('message_sent', { text: 'Hello' });
      
      expect(record.type).toBe('message_sent');
      expect(record.data.text).toBe('Hello');
      expect(record.timestamp).toBeDefined();
      expect(record.id).toBeDefined();
    });

    it('应该能记录情绪', () => {
      const record = memory.record('expression_change', { 
        expression: 'happy',
        emotion: 'happy'
      });
      
      expect(record.emotion).toBe('happy');
    });

    it('应该能记录元数据', () => {
      const record = memory.record('gesture_detected', { gesture: 'wave' }, { 
        confidence: 0.95 
      });
      
      expect(record.metadata?.confidence).toBe(0.95);
    });

    it('应该增加记录数量', () => {
      expect(memory.getRecordCount()).toBe(0);
      
      memory.record('message_sent', { text: 'test' });
      memory.record('message_received', { text: 'response' });
      
      expect(memory.getRecordCount()).toBe(2);
    });
  });

  describe('记录数量限制', () => {
    it('应该限制最大记录数', () => {
      memory.updateConfig({ maxRecords: 5 });
      
      for (let i = 0; i < 10; i++) {
        memory.record('message_sent', { text: `msg ${i}` });
      }
      
      expect(memory.getRecordCount()).toBe(5);
    });

    it('应该保留最新的记录', () => {
      memory.updateConfig({ maxRecords: 3 });
      
      for (let i = 0; i < 5; i++) {
        memory.record('message_sent', { text: `msg ${i}` });
      }
      
      const recent = memory.getRecentRecords();
      expect(recent.some(r => r.data.text === 'msg 4')).toBe(true);
      expect(recent.some(r => r.data.text === 'msg 0')).toBe(false);
    });
  });

  describe('会话管理', () => {
    it('应该能开始新会话', () => {
      const session = memory.startSession();
      
      expect(session.sessionId).toBeDefined();
      expect(session.startTime).toBeDefined();
      expect(session.endTime).toBeNull();
      expect(session.messageCount).toBe(0);
    });

    it('应该能获取当前会话', () => {
      memory.startSession();
      const session = memory.getCurrentSession();
      
      expect(session).not.toBeNull();
      expect(session?.sessionId).toBeDefined();
    });

    it('没有会话时应该返回 null', () => {
      expect(memory.getCurrentSession()).toBeNull();
    });

    it('应该能结束会话', () => {
      memory.startSession();
      const session = memory.endSession();
      
      expect(session).not.toBeNull();
      expect(session?.endTime).toBeDefined();
    });

    it('结束不存在的会话应该返回 null', () => {
      expect(memory.endSession()).toBeNull();
    });

    it('会话中的消息应该被计数', () => {
      memory.startSession();
      memory.record('message_sent', { text: 'hello' });
      memory.record('message_received', { text: 'hi' });
      memory.record('expression_change', { expression: 'happy' });
      
      const session = memory.getCurrentSession();
      expect(session?.messageCount).toBe(2);
      expect(session?.interactionCount).toBe(4);  // 包括 session_start
    });

    it('会话中的表情应该被记录', () => {
      memory.startSession();
      memory.record('expression_change', { expression: 'happy' });
      memory.record('expression_change', { expression: 'sad' });
      memory.record('expression_change', { expression: 'happy' });
      
      const session = memory.getCurrentSession();
      expect(session?.expressionsUsed).toContain('happy');
      expect(session?.expressionsUsed).toContain('sad');
      expect(session?.expressionsUsed.length).toBe(2);  // 去重
    });
  });

  describe('情绪趋势', () => {
    it('应该计算情绪趋势', () => {
      memory.record('message_sent', { text: 'hi', emotion: 'happy' });
      memory.record('message_sent', { text: 'bye', emotion: 'happy' });
      memory.record('message_sent', { text: 'sad', emotion: 'sad' });
      
      const trends = memory.getEmotionTrends();
      
      expect(trends.length).toBeGreaterThan(0);
      expect(trends[0].emotion).toBe('happy');
      expect(trends[0].count).toBe(2);
    });

    it('应该计算百分比', () => {
      memory.record('message_sent', { text: 'a', emotion: 'happy' });
      memory.record('message_sent', { text: 'b', emotion: 'happy' });
      memory.record('message_sent', { text: 'c', emotion: 'sad' });
      memory.record('message_sent', { text: 'd', emotion: 'sad' });
      
      const trends = memory.getEmotionTrends();
      const happyTrend = trends.find(t => t.emotion === 'happy');
      
      expect(happyTrend?.percentage).toBe(50);
    });

    it('没有记录时应该返回空数组', () => {
      const trends = memory.getEmotionTrends();
      expect(trends).toEqual([]);
    });

    it('应该支持自定义时间窗口', () => {
      // 记录一个旧的
      const oldRecord = memory.record('message_sent', { emotion: 'sad' });
      (oldRecord as any).timestamp = Date.now() - 100000;
      
      memory.record('message_sent', { emotion: 'happy' });
      
      // 使用小窗口应该只看到新的
      const trends = memory.getEmotionTrends(1000);
      expect(trends.length).toBe(1);
      expect(trends[0].emotion).toBe('happy');
    });
  });

  describe('用户偏好', () => {
    it('应该分析表情偏好', () => {
      for (let i = 0; i < 5; i++) {
        memory.record('expression_change', { expression: 'happy' });
      }
      for (let i = 0; i < 3; i++) {
        memory.record('expression_change', { expression: 'sad' });
      }
      
      const prefs = memory.getUserPreferences();
      expect(prefs.preferredExpressions[0]).toBe('happy');
    });

    it('应该分析交互风格 - verbose', () => {
      for (let i = 0; i < 5; i++) {
        memory.record('message_sent', { 
          text: 'This is a very long message with lots of details and explanations that go on and on and on and on to exceed the 100 character threshold'
        });
      }
      
      const prefs = memory.getUserPreferences();
      expect(prefs.interactionStyle).toBe('verbose');
    });

    it('应该分析交互风格 - concise', () => {
      for (let i = 0; i < 5; i++) {
        memory.record('message_sent', { text: 'ok' });
      }
      
      const prefs = memory.getUserPreferences();
      expect(prefs.interactionStyle).toBe('concise');
    });

    it('应该分析情绪倾向', () => {
      for (let i = 0; i < 10; i++) {
        memory.record('message_sent', { emotion: 'happy' });
      }
      memory.record('message_sent', { emotion: 'sad' });
      
      const prefs = memory.getUserPreferences();
      expect(prefs.emotionalTendency).toBe('happy');
    });
  });

  describe('搜索功能', () => {
    beforeEach(async () => {
      memory.record('message_sent', { text: 'hello', emotion: 'happy' });
      await new Promise(r => setTimeout(r, 2));
      memory.record('message_received', { text: 'hi', emotion: 'happy' });
      await new Promise(r => setTimeout(r, 2));
      memory.record('expression_change', { expression: 'sad', emotion: 'sad' });
    });

    it('应该能按类型搜索', () => {
      const results = memory.search({ type: 'message_sent' });
      expect(results.length).toBe(1);
      expect(results[0].data.text).toBe('hello');
    });

    it('应该能按情绪搜索', () => {
      const results = memory.search({ emotion: 'happy' });
      expect(results.length).toBe(2);
    });

    it('应该能限制结果数量', () => {
      const results = memory.search({ limit: 1 });
      expect(results.length).toBe(1);
    });

    it('应该按时间倒序排列', () => {
      const results = memory.search({});
      expect(results[0].type).toBe('expression_change');  // 最新的
    });

    it('应该能按时间范围搜索', () => {
      const now = Date.now();
      const results = memory.search({
        startTime: now - 1000,
        endTime: now + 1000
      });
      expect(results.length).toBe(3);
    });
  });

  describe('获取最近记录', () => {
    it('应该获取最近的记录', () => {
      for (let i = 0; i < 10; i++) {
        memory.record('message_sent', { text: `msg ${i}` });
      }
      
      const recent = memory.getRecentRecords(5);
      expect(recent.length).toBe(5);
    });

    it('应该按时间倒序', async () => {
      memory.record('message_sent', { text: 'first' });
      await new Promise(r => setTimeout(r, 5));  // 确保时间戳不同
      memory.record('message_sent', { text: 'second' });
      
      const recent = memory.getRecentRecords();
      expect(recent[0].data.text).toBe('second');
    });
  });

  describe('清除功能', () => {
    it('应该清除所有记录', () => {
      memory.record('message_sent', { text: 'test' });
      memory.startSession();
      
      memory.clear();
      
      expect(memory.getRecordCount()).toBe(0);
      expect(memory.getCurrentSession()).toBeNull();
    });
  });

  describe('订阅机制', () => {
    it('应该能订阅新记录', () => {
      const callback = vi.fn();
      memory.onRecord(callback);
      
      memory.record('message_sent', { text: 'test' });
      
      expect(callback).toHaveBeenCalled();
    });

    it('应该传递记录给回调', () => {
      const callback = vi.fn();
      memory.onRecord(callback);
      
      memory.record('message_sent', { text: 'test' });
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message_sent',
          data: expect.objectContaining({ text: 'test' })
        })
      );
    });

    it('应该能取消订阅', () => {
      const callback = vi.fn();
      const unsubscribe = memory.onRecord(callback);
      
      unsubscribe();
      memory.record('message_sent', { text: 'test' });
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('回调抛出错误不应中断其他回调', () => {
      const callback1 = vi.fn(() => { throw new Error('test'); });
      const callback2 = vi.fn();
      
      memory.onRecord(callback1);
      memory.onRecord(callback2);
      
      memory.record('message_sent', { text: 'test' });
      
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('导入导出', () => {
    it('应该能导出数据', () => {
      memory.record('message_sent', { text: 'test' });
      
      const exported = memory.export();
      
      expect(exported.records.length).toBe(1);
      expect(exported.config).toBeDefined();
    });

    it('应该能导入数据', () => {
      const records = [
        {
          id: 'test-1',
          timestamp: Date.now(),
          type: 'message_sent' as InteractionType,
          data: { text: 'imported' }
        }
      ];
      
      memory.import({ records });
      
      expect(memory.getRecordCount()).toBe(1);
    });

    it('导入应该遵守最大记录数', () => {
      memory.updateConfig({ maxRecords: 2 });
      
      const records = [];
      for (let i = 0; i < 5; i++) {
        records.push({
          id: `test-${i}`,
          timestamp: Date.now(),
          type: 'message_sent' as InteractionType,
          data: { text: `msg ${i}` }
        });
      }
      
      memory.import({ records });
      
      expect(memory.getRecordCount()).toBe(2);
    });
  });

  describe('持久化', () => {
    it('启用持久化时应该保存到 storage', () => {
      const memoryWithStorage = new InteractionMemory({
        persistToStorage: true,
        storageKey: 'test-memory'
      });
      
      memoryWithStorage.record('message_sent', { text: 'test' });
      
      expect(mockStorage.has('test-memory')).toBe(true);
      
      memoryWithStorage.destroy();
    });

    it('应该从 storage 加载数据', () => {
      mockStorage.set('test-memory', JSON.stringify({
        records: [{
          id: 'test-1',
          timestamp: Date.now(),
          type: 'message_sent',
          data: { text: 'loaded' }
        }]
      }));
      
      const memoryWithStorage = new InteractionMemory({
        persistToStorage: true,
        storageKey: 'test-memory'
      });
      
      expect(memoryWithStorage.getRecordCount()).toBe(1);
      
      memoryWithStorage.destroy();
    });

    it('clear 应该清除 storage', () => {
      const memoryWithStorage = new InteractionMemory({
        persistToStorage: true,
        storageKey: 'test-memory'
      });
      
      memoryWithStorage.record('message_sent', { text: 'test' });
      memoryWithStorage.clear();
      
      expect(mockStorage.has('test-memory')).toBe(false);
      
      memoryWithStorage.destroy();
    });
  });

  describe('销毁', () => {
    it('应该清空所有状态', () => {
      memory.record('message_sent', { text: 'test' });
      memory.startSession();
      const callback = vi.fn();
      memory.onRecord(callback);
      
      memory.destroy();
      
      expect(memory.getRecordCount()).toBe(0);
      expect(memory.getCurrentSession()).toBeNull();
    });
  });

  describe('边界情况', () => {
    it('空消息应该正常处理', () => {
      const record = memory.record('message_sent', { text: '' });
      expect(record).toBeDefined();
    });

    it('无情绪的记录应该正常处理', () => {
      memory.record('message_sent', { text: 'test' });
      const trends = memory.getEmotionTrends();
      expect(Array.isArray(trends)).toBe(true);
    });

    it('非法 JSON 应该不崩溃', () => {
      mockStorage.set('test-memory', 'invalid json');
      
      expect(() => {
        new InteractionMemory({
          persistToStorage: true,
          storageKey: 'test-memory'
        });
      }).not.toThrow();
    });
  });
});
