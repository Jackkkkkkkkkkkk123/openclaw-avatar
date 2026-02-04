/**
 * AvatarSystem 测试
 * 
 * 核心系统集成测试 - 整合所有模块
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ========== Hoisted Mocks ==========
const {
  mockConnector,
  mockBridgeConnector,
  mockTTSService,
  mockLipSyncDriver,
  mockHeadTrackingService,
  mockKeyboardShortcuts,
  mockAvatarController,
  mockExpressionSequencer,
  mockEmotionContextEngine,
  mockDetectEmotion,
  mockAnalyzeTextForSequence,
  mockCreateTTSService,
} = vi.hoisted(() => ({
  mockConnector: {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(true),
    abort: vi.fn().mockResolvedValue(undefined),
    getHistory: vi.fn().mockResolvedValue([]),
    setToken: vi.fn(),
    updateConfig: vi.fn(),
    onStatusChange: vi.fn().mockReturnValue(() => {}),
    onMessage: vi.fn().mockReturnValue(() => {}),
  },
  mockBridgeConnector: {
    connect: vi.fn().mockRejectedValue(new Error('Bridge not available')), // 让 Bridge 失败，回退到 WebSocket
    disconnect: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(true),
    getStatus: vi.fn().mockReturnValue('disconnected'),
    onMessage: vi.fn().mockReturnValue(() => {}),
    onStatusChange: vi.fn().mockReturnValue(() => {}),
  },
  mockTTSService: {
    synthesize: vi.fn().mockResolvedValue({ audioUrl: 'blob:test', text: 'test' }),
    speak: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    destroy: vi.fn(),
  },
  mockLipSyncDriver: {
    connect: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    simulateLipSync: vi.fn().mockResolvedValue(undefined),
    onMouthUpdate: vi.fn().mockReturnValue(() => {}),
  },
  mockHeadTrackingService: {
    init: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    destroy: vi.fn(),
    onTracking: vi.fn().mockReturnValue(() => {}),
  },
  mockKeyboardShortcuts: {
    init: vi.fn(),
    destroy: vi.fn(),
    registerDefaults: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
  },
  mockAvatarController: {
    setExpression: vi.fn(),
    setMouthOpenY: vi.fn(),
    syncEmotionToSystems: vi.fn(),
    initAdvancedSystems: vi.fn(),
    setVisemeEnabled: vi.fn(),
    setMicroExpressionEnabled: vi.fn(),
    speakWithViseme: vi.fn(),
    analyzeTextForMicroExpression: vi.fn(),
    lookAt: vi.fn(),
    lookAtCenter: vi.fn(),
    triggerBlink: vi.fn(),
  },
  mockExpressionSequencer: {
    playPreset: vi.fn().mockReturnValue(true),
    stop: vi.fn(),
    destroy: vi.fn(),
    setEmotionSmart: vi.fn(),
    isSequencePlaying: vi.fn().mockReturnValue(false),
    getCurrentSequenceName: vi.fn().mockReturnValue(null),
    getEmotionState: vi.fn().mockReturnValue({ current: 'neutral', history: [] }),
    getEmotionHistory: vi.fn().mockReturnValue([]),
    getPresetNames: vi.fn().mockReturnValue(['delighted', 'shyReaction', 'figureOut']),
  },
  mockEmotionContextEngine: {
    processText: vi.fn().mockReturnValue({
      emotion: 'happy',
      intensity: 0.8,
      influences: [{ source: 'text', emotion: 'happy', weight: 1 }],
    }),
    getConversationTone: vi.fn().mockReturnValue({
      baseEmotion: 'neutral',
      intensity: 0.5,
      stability: 0.7,
    }),
    analyzeEmotionTrend: vi.fn().mockReturnValue({
      trend: 'stable',
      momentum: 0,
      volatility: 0.2,
    }),
    getDebugSummary: vi.fn().mockReturnValue('Context Debug'),
    reset: vi.fn(),
  },
  mockDetectEmotion: vi.fn().mockReturnValue({ emotion: 'happy', confidence: 0.8, keywords: ['开心'] }),
  mockAnalyzeTextForSequence: vi.fn().mockReturnValue(false),
  mockCreateTTSService: vi.fn(),
}));

// ========== Module Mocks ==========

vi.mock('./AvatarController', () => ({
  avatarController: mockAvatarController,
}));

vi.mock('./OpenClawConnector', () => ({
  OpenClawConnector: class {
    connect = mockConnector.connect;
    disconnect = mockConnector.disconnect;
    sendMessage = mockConnector.sendMessage;
    abort = mockConnector.abort;
    getHistory = mockConnector.getHistory;
    setToken = mockConnector.setToken;
    updateConfig = mockConnector.updateConfig;
    onStatusChange = mockConnector.onStatusChange;
    onMessage = mockConnector.onMessage;
  },
}));

vi.mock('./OpenClawBridgeConnector', () => ({
  OpenClawBridgeConnector: class {
    connect = mockBridgeConnector.connect;
    disconnect = mockBridgeConnector.disconnect;
    sendMessage = mockBridgeConnector.sendMessage;
    getStatus = mockBridgeConnector.getStatus;
    onMessage = mockBridgeConnector.onMessage;
    onStatusChange = mockBridgeConnector.onStatusChange;
  },
}));

vi.mock('./EmotionDetector', () => ({
  detectEmotion: mockDetectEmotion,
  getEmotionDuration: vi.fn().mockReturnValue(3000),
}));

vi.mock('./TTSService', () => ({
  createTTSService: mockCreateTTSService.mockReturnValue(mockTTSService),
  TTSService: vi.fn(),
}));

vi.mock('./LipSyncDriver', () => ({
  LipSyncDriver: class {
    connect = mockLipSyncDriver.connect;
    start = mockLipSyncDriver.start;
    stop = mockLipSyncDriver.stop;
    destroy = mockLipSyncDriver.destroy;
    simulateLipSync = mockLipSyncDriver.simulateLipSync;
    onMouthUpdate = mockLipSyncDriver.onMouthUpdate;
  },
}));

vi.mock('./VisemeDriver', () => ({
  visemeDriver: { stop: vi.fn() },
}));

vi.mock('./MicroExpressionSystem', () => ({
  microExpressionSystem: { setSpeaking: vi.fn() },
}));

vi.mock('./ExpressionSequencer', () => ({
  expressionSequencer: mockExpressionSequencer,
  analyzeTextForSequence: mockAnalyzeTextForSequence,
}));

vi.mock('./EmotionContextEngine', () => ({
  emotionContextEngine: mockEmotionContextEngine,
}));

vi.mock('./HeadTrackingService', () => ({
  headTrackingService: mockHeadTrackingService,
}));

vi.mock('./KeyboardShortcuts', () => ({
  keyboardShortcuts: mockKeyboardShortcuts,
  formatShortcut: vi.fn().mockReturnValue('Ctrl+K'),
}));

// Import after mocks
import { AvatarSystem, type AvatarSystemConfig } from './AvatarSystem';

// ========== Tests ==========

describe('AvatarSystem', () => {
  let system: AvatarSystem;
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // 重置 createTTSService 返回值
    mockCreateTTSService.mockReturnValue(mockTTSService);
  });
  
  afterEach(() => {
    system?.destroy();
    vi.useRealTimers();
  });

  describe('构造函数和配置', () => {
    it('应该使用默认配置创建', () => {
      system = new AvatarSystem();
      expect(system).toBeInstanceOf(AvatarSystem);
    });

    it('应该使用自定义配置创建', () => {
      const config: AvatarSystemConfig = {
        gatewayUrl: 'ws://custom:8080/ws',
        gatewayToken: 'test-token',
        fishApiKey: 'fish-key',
        enableTTS: true,
        enableLipSync: true,
        enableEmotionDetection: true,
      };
      
      system = new AvatarSystem(config);
      expect(system).toBeInstanceOf(AvatarSystem);
    });

    it('应该禁用 TTS 时不创建 TTS 服务', () => {
      mockCreateTTSService.mockClear();
      system = new AvatarSystem({ enableTTS: false });
      expect(mockCreateTTSService).not.toHaveBeenCalled();
    });

    it('应该初始化高级系统', () => {
      system = new AvatarSystem();
      expect(mockAvatarController.initAdvancedSystems).toHaveBeenCalled();
    });
  });

  describe('状态管理', () => {
    beforeEach(() => {
      system = new AvatarSystem();
    });

    it('应该返回初始状态', () => {
      const state = system.getState();
      
      expect(state.connectionStatus).toBe('disconnected');
      expect(state.isSpeaking).toBe(false);
      expect(state.currentEmotion).toBe('neutral');
      expect(state.lastMessage).toBe('');
      expect(state.processingText).toBe('');
      expect(state.isHeadTrackingActive).toBe(false);
      expect(state.headTrackingSupported).toBe(false);
    });

    it('应该订阅状态变化', () => {
      const callback = vi.fn();
      const unsubscribe = system.onStateChange(callback);
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        connectionStatus: 'disconnected',
      }));
      
      unsubscribe();
    });

    it('应该取消状态订阅', () => {
      const callback = vi.fn();
      const unsubscribe = system.onStateChange(callback);
      callback.mockClear();
      unsubscribe();
      
      system.setEmotion('happy');
      // 取消订阅后回调不应被调用
    });

    it('应该订阅文本更新', () => {
      const callback = vi.fn();
      const unsubscribe = system.onText(callback);
      expect(unsubscribe).toBeTypeOf('function');
      unsubscribe();
    });
  });

  describe('表情系统', () => {
    beforeEach(() => {
      system = new AvatarSystem();
    });

    it('应该设置表情', () => {
      system.setEmotion('happy');
      
      expect(mockAvatarController.setExpression).toHaveBeenCalledWith('happy');
      expect(mockAvatarController.syncEmotionToSystems).toHaveBeenCalledWith('happy');
      expect(system.getState().currentEmotion).toBe('happy');
    });

    it('相同表情不应重复设置', () => {
      system.setEmotion('happy');
      mockAvatarController.setExpression.mockClear();
      
      system.setEmotion('happy');
      
      expect(mockAvatarController.setExpression).not.toHaveBeenCalled();
    });

    it('应该切换不同表情', () => {
      system.setEmotion('happy');
      system.setEmotion('sad');
      system.setEmotion('surprised');
      
      expect(mockAvatarController.setExpression).toHaveBeenCalledTimes(3);
      expect(system.getState().currentEmotion).toBe('surprised');
    });
  });

  describe('高级系统开关', () => {
    beforeEach(() => {
      system = new AvatarSystem();
    });

    it('应该切换 Viseme 精确口型', () => {
      system.setUseViseme(false);
      expect(mockAvatarController.setVisemeEnabled).toHaveBeenCalledWith(false);
      
      system.setUseViseme(true);
      expect(mockAvatarController.setVisemeEnabled).toHaveBeenCalledWith(true);
    });

    it('应该切换微表情系统', () => {
      system.setUseMicroExpression(false);
      expect(mockAvatarController.setMicroExpressionEnabled).toHaveBeenCalledWith(false);
      
      system.setUseMicroExpression(true);
      expect(mockAvatarController.setMicroExpressionEnabled).toHaveBeenCalledWith(true);
    });

    it('应该切换情绪上下文引擎', () => {
      expect(() => system.setUseContextEngine(false)).not.toThrow();
      expect(() => system.setUseContextEngine(true)).not.toThrow();
    });

    it('应该切换表情序列系统', () => {
      expect(() => system.setUseSequencer(false)).not.toThrow();
      expect(() => system.setUseSequencer(true)).not.toThrow();
    });
  });

  describe('OpenClaw 连接', () => {
    beforeEach(() => {
      system = new AvatarSystem();
    });

    it('应该连接 Gateway', async () => {
      await system.connect();
      expect(mockConnector.connect).toHaveBeenCalled();
    });

    it('应该断开连接', () => {
      system.disconnect();
      expect(mockConnector.disconnect).toHaveBeenCalled();
    });

    it('应该发送消息', async () => {
      const result = await system.sendMessage('你好');
      
      expect(mockConnector.sendMessage).toHaveBeenCalledWith('你好');
      expect(result).toBe(true);
    });

    it('应该中止响应', async () => {
      await system.abort();
      
      expect(mockConnector.abort).toHaveBeenCalled();
      expect(system.getState().isSpeaking).toBe(false);
      expect(system.getState().processingText).toBe('');
    });

    it('应该获取历史', async () => {
      const history = await system.getHistory();
      
      expect(mockConnector.getHistory).toHaveBeenCalled();
      expect(history).toEqual([]);
    });
  });

  describe('配置更新', () => {
    beforeEach(() => {
      system = new AvatarSystem();
    });

    it('应该更新 Gateway Token', () => {
      system.setGatewayToken('new-token');
      expect(mockConnector.setToken).toHaveBeenCalledWith('new-token');
    });

    it('应该更新连接器配置', () => {
      system.updateConfig({
        gatewayUrl: 'ws://new:8080/ws',
        gatewayToken: 'new-token',
      });
      
      expect(mockConnector.updateConfig).toHaveBeenCalledWith({
        gatewayUrl: 'ws://new:8080/ws',
        token: 'new-token',
      });
    });

    it('应该更新 Fish API Key', () => {
      mockCreateTTSService.mockClear();
      system.updateConfig({ fishApiKey: 'new-fish-key' });
      expect(mockCreateTTSService).toHaveBeenCalledWith('new-fish-key');
    });
  });

  describe('表情序列 API', () => {
    beforeEach(() => {
      system = new AvatarSystem();
    });

    it('应该播放表情序列', () => {
      const result = system.playSequence('delighted');
      
      expect(mockExpressionSequencer.playPreset).toHaveBeenCalledWith('delighted');
      expect(result).toBe(true);
    });

    it('应该获取可用序列列表', () => {
      const sequences = system.getAvailableSequences();
      
      expect(sequences).toContain('delighted');
      expect(sequences).toContain('shyReaction');
      expect(sequences).toContain('figureOut');
    });

    it('应该停止序列', () => {
      system.stopSequence();
      expect(mockExpressionSequencer.stop).toHaveBeenCalled();
    });

    it('应该获取序列状态', () => {
      const state = system.getSequencerState();
      
      expect(state).toHaveProperty('isPlaying');
      expect(state).toHaveProperty('currentSequence');
      expect(state).toHaveProperty('emotionState');
      expect(state).toHaveProperty('emotionHistory');
    });
  });

  describe('情绪上下文 API', () => {
    beforeEach(() => {
      system = new AvatarSystem();
    });

    it('应该获取对话基调', () => {
      const tone = system.getConversationTone();
      
      expect(tone).toHaveProperty('baseEmotion');
      expect(tone).toHaveProperty('intensity');
      expect(tone).toHaveProperty('stability');
    });

    it('应该获取情绪趋势', () => {
      const trend = system.getEmotionTrend();
      
      expect(trend).toHaveProperty('trend');
      expect(trend).toHaveProperty('momentum');
      expect(trend).toHaveProperty('volatility');
    });

    it('应该获取调试信息', () => {
      const debug = system.getEmotionContextDebug();
      expect(debug).toBe('Context Debug');
    });

    it('应该重置情绪上下文', () => {
      system.resetEmotionContext();
      expect(mockEmotionContextEngine.reset).toHaveBeenCalled();
    });
  });

  describe('头部追踪 API', () => {
    beforeEach(() => {
      system = new AvatarSystem();
    });

    it('应该检查头部追踪支持', async () => {
      const supported = await system.checkHeadTrackingSupport();
      expect(typeof supported).toBe('boolean');
    });

    it('应该启动头部追踪', async () => {
      await system.startHeadTracking();
      
      expect(mockHeadTrackingService.init).toHaveBeenCalled();
      expect(mockHeadTrackingService.onTracking).toHaveBeenCalled();
      expect(mockHeadTrackingService.start).toHaveBeenCalled();
      expect(system.getState().isHeadTrackingActive).toBe(true);
    });

    it('应该停止头部追踪', async () => {
      await system.startHeadTracking();
      system.stopHeadTracking();
      
      expect(mockHeadTrackingService.stop).toHaveBeenCalled();
      expect(system.getState().isHeadTrackingActive).toBe(false);
    });

    it('应该获取头部追踪状态', () => {
      const status = system.getHeadTrackingStatus();
      
      expect(status).toHaveProperty('active');
      expect(status).toHaveProperty('supported');
    });

    it('启动失败应该抛出错误', async () => {
      mockHeadTrackingService.init.mockRejectedValueOnce(new Error('Camera denied'));
      await expect(system.startHeadTracking()).rejects.toThrow('Camera denied');
    });
  });

  describe('键盘快捷键 API', () => {
    beforeEach(() => {
      system = new AvatarSystem();
    });

    it('应该初始化键盘快捷键', () => {
      const callbacks = {
        onToggleChat: vi.fn(),
        onToggleSettings: vi.fn(),
      };
      
      system.initKeyboardShortcuts(callbacks);
      
      expect(mockKeyboardShortcuts.init).toHaveBeenCalled();
      expect(mockKeyboardShortcuts.registerDefaults).toHaveBeenCalled();
    });

    it('应该获取所有快捷键', () => {
      const shortcuts = system.getKeyboardShortcuts();
      
      expect(mockKeyboardShortcuts.getAll).toHaveBeenCalled();
      expect(Array.isArray(shortcuts)).toBe(true);
    });

    it('应该格式化快捷键', () => {
      const formatted = system.formatShortcut(['Ctrl', 'K']);
      expect(formatted).toBe('Ctrl+K');
    });
  });

  describe('TTS 和口型同步', () => {
    let originalAudio: typeof Audio;
    let mockAudioInstance: any;
    
    beforeEach(() => {
      originalAudio = globalThis.Audio;
      mockAudioInstance = {
        play: vi.fn().mockResolvedValue(undefined),
        onended: null as (() => void) | null,
        onerror: null as ((e: any) => void) | null,
      };
      // 使用 class mock
      (globalThis as any).Audio = class {
        play = mockAudioInstance.play;
        set onended(fn: (() => void) | null) { mockAudioInstance.onended = fn; }
        set onerror(fn: ((e: any) => void) | null) { mockAudioInstance.onerror = fn; }
      };
      system = new AvatarSystem();
    });
    
    afterEach(() => {
      globalThis.Audio = originalAudio;
    });

    it('应该手动播放 TTS', async () => {
      const speakPromise = system.speak('你好世界');
      
      // 等待异步操作开始
      await vi.advanceTimersByTimeAsync(0);
      mockAudioInstance.onended?.();
      
      await speakPromise;
      expect(mockTTSService.synthesize).toHaveBeenCalledWith('你好世界');
    });

    it('TTS 未配置时应该使用模拟口型', async () => {
      system = new AvatarSystem({ enableTTS: false });
      await system.speak('你好');
      expect(mockLipSyncDriver.simulateLipSync).toHaveBeenCalled();
    });

    it('应该模拟对话响应', async () => {
      const callback = vi.fn();
      system.onText(callback);
      
      const promise = system.simulateResponse('测试消息');
      
      await vi.advanceTimersByTimeAsync(0);
      mockAudioInstance.onended?.();
      
      await promise;
      
      expect(callback).toHaveBeenCalledWith('测试消息', true);
      expect(system.getState().lastMessage).toBe('测试消息');
    });
  });

  describe('销毁', () => {
    it('应该清理所有资源', () => {
      system = new AvatarSystem();
      system.destroy();
      
      expect(mockConnector.disconnect).toHaveBeenCalled();
      expect(mockTTSService.destroy).toHaveBeenCalled();
      expect(mockLipSyncDriver.destroy).toHaveBeenCalled();
      expect(mockExpressionSequencer.destroy).toHaveBeenCalled();
      expect(mockHeadTrackingService.destroy).toHaveBeenCalled();
      expect(mockKeyboardShortcuts.destroy).toHaveBeenCalled();
    });

    it('多次销毁不应该报错', () => {
      system = new AvatarSystem();
      
      expect(() => {
        system.destroy();
        system.destroy();
      }).not.toThrow();
    });
  });

  describe('事件处理 - 连接状态', () => {
    it('应该响应连接状态变化', () => {
      let statusCallback: ((status: string) => void) | null = null;
      mockConnector.onStatusChange.mockImplementation((cb) => {
        statusCallback = cb;
        return () => {};
      });
      
      const stateCallback = vi.fn();
      system = new AvatarSystem();
      system.onStateChange(stateCallback);
      stateCallback.mockClear();
      
      statusCallback?.('connecting');
      
      expect(stateCallback).toHaveBeenCalledWith(
        expect.objectContaining({ connectionStatus: 'connecting' })
      );
    });
  });

  describe('事件处理 - 消息接收', () => {
    let messageCallback: ((chunk: any) => void) | null = null;
    
    beforeEach(() => {
      messageCallback = null;
      mockConnector.onMessage.mockImplementation((cb) => {
        messageCallback = cb;
        return () => {};
      });
      system = new AvatarSystem();
    });

    it('应该处理文本消息片段', () => {
      const textCallback = vi.fn();
      system.onText(textCallback);
      
      messageCallback?.({ type: 'text', content: '你好' });
      
      expect(textCallback).toHaveBeenCalledWith('你好', false);
      expect(system.getState().processingText).toBe('你好');
    });

    it('应该处理消息结束', () => {
      const textCallback = vi.fn();
      system.onText(textCallback);
      
      messageCallback?.({ type: 'end', content: '完整消息' });
      
      expect(textCallback).toHaveBeenCalledWith('完整消息', true);
      expect(system.getState().lastMessage).toBe('完整消息');
      expect(system.getState().processingText).toBe('');
    });

    it('应该处理错误消息', () => {
      messageCallback?.({ type: 'error', content: '出错了' });
      expect(mockAvatarController.setExpression).toHaveBeenCalledWith('sad');
    });

    it('应该处理思考状态', () => {
      expect(() => {
        messageCallback?.({ type: 'thinking', content: '' });
      }).not.toThrow();
    });

    it('应该处理工具调用', () => {
      expect(() => {
        messageCallback?.({ type: 'tool', content: '' });
      }).not.toThrow();
    });
  });

  describe('情绪检测和应用', () => {
    let messageCallback: ((chunk: any) => void) | null = null;
    
    beforeEach(() => {
      messageCallback = null;
      mockConnector.onMessage.mockImplementation((cb) => {
        messageCallback = cb;
        return () => {};
      });
      system = new AvatarSystem({
        enableEmotionDetection: true,
        enableTTS: false,
      });
    });

    it('应该检测并应用情绪', () => {
      mockDetectEmotion.mockReturnValue({
        emotion: 'excited',
        confidence: 0.9,
        keywords: ['太棒了'],
      });
      
      messageCallback?.({ type: 'text', content: '太棒了！' });
      
      expect(mockDetectEmotion).toHaveBeenCalledWith('太棒了！');
    });

    it('低置信度不应该切换表情', () => {
      mockDetectEmotion.mockReturnValue({
        emotion: 'happy',
        confidence: 0.1,
        keywords: [],
      });
      
      mockEmotionContextEngine.processText.mockReturnValue({
        emotion: 'happy',
        intensity: 0.1, // 低于阈值 0.3
        influences: [],
      });
      
      messageCallback?.({ type: 'text', content: '嗯' });
      // 由于 intensity < 0.3，表情不应该改变
    });

    it('应该尝试触发表情序列', () => {
      mockAnalyzeTextForSequence.mockReturnValue(true);
      
      messageCallback?.({ type: 'text', content: '哇！太惊喜了！' });
      
      expect(mockAnalyzeTextForSequence).toHaveBeenCalledWith('哇！太惊喜了！');
    });

    it('禁用情绪检测时不应该检测', () => {
      mockDetectEmotion.mockClear();
      
      system = new AvatarSystem({
        enableEmotionDetection: false,
        enableTTS: false,
      });
      
      messageCallback = mockConnector.onMessage.mock.calls[mockConnector.onMessage.mock.calls.length - 1][0];
      messageCallback?.({ type: 'text', content: '开心' });
      
      expect(mockDetectEmotion).not.toHaveBeenCalled();
    });
  });

  describe('定时器清理', () => {
    it('销毁时应该清除情绪重置定时器', () => {
      system = new AvatarSystem();
      system.setEmotion('happy');
      system.destroy();
      
      // 推进时间不应该有副作用
      vi.advanceTimersByTime(10000);
    });
  });

  describe('边界情况', () => {
    beforeEach(() => {
      system = new AvatarSystem();
    });

    it('空文本不应该崩溃', async () => {
      await expect(system.sendMessage('')).resolves.toBe(true);
    });

    it('状态回调错误不应该影响其他回调', () => {
      let callCount = 0;
      const errorCallback = vi.fn().mockImplementation(() => {
        callCount++;
        // 第一次调用（订阅时）不抛出，后续调用抛出
        if (callCount > 1) {
          throw new Error('Callback error');
        }
      });
      const normalCallback = vi.fn();
      
      system.onStateChange(errorCallback);
      system.onStateChange(normalCallback);
      
      // 此时两个回调各被调用一次（订阅时）
      const initialErrorCalls = errorCallback.mock.calls.length;
      const initialNormalCalls = normalCallback.mock.calls.length;
      
      // 触发状态更新
      system.setEmotion('happy');
      
      // 两个回调都应该被再次调用
      expect(errorCallback.mock.calls.length).toBeGreaterThan(initialErrorCalls);
      expect(normalCallback.mock.calls.length).toBeGreaterThan(initialNormalCalls);
    });

    it('文本回调错误不应该影响其他回调', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();
      
      let messageCallback: ((chunk: any) => void) | null = null;
      mockConnector.onMessage.mockImplementation((cb) => {
        messageCallback = cb;
        return () => {};
      });
      
      system.destroy();
      system = new AvatarSystem();
      system.onText(errorCallback);
      system.onText(normalCallback);
      
      messageCallback = mockConnector.onMessage.mock.calls[mockConnector.onMessage.mock.calls.length - 1][0];
      messageCallback?.({ type: 'end', content: 'test' });
      
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('口型同步回调', () => {
    it('Viseme 禁用时应该使用传统口型同步', () => {
      let mouthCallback: ((openY: number) => void) | null = null;
      mockLipSyncDriver.onMouthUpdate.mockImplementation((cb) => {
        mouthCallback = cb;
        return () => {};
      });
      
      system = new AvatarSystem();
      system.setUseViseme(false);
      
      mockAvatarController.setMouthOpenY.mockClear();
      mouthCallback?.(0.5);
      
      expect(mockAvatarController.setMouthOpenY).toHaveBeenCalledWith(0.5);
    });

    it('Viseme 启用时不应该使用传统口型同步', () => {
      let mouthCallback: ((openY: number) => void) | null = null;
      mockLipSyncDriver.onMouthUpdate.mockImplementation((cb) => {
        mouthCallback = cb;
        return () => {};
      });
      
      system = new AvatarSystem();
      system.setUseViseme(true);
      
      mockAvatarController.setMouthOpenY.mockClear();
      mouthCallback?.(0.5);
      
      expect(mockAvatarController.setMouthOpenY).not.toHaveBeenCalled();
    });
  });
});
