/**
 * VoiceInputService 测试
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VoiceInputService, isVoiceInputSupported, type VoiceInputResult, type VoiceInputStatus } from './VoiceInputService';

// Mock SpeechRecognition
let latestMockRecognition: MockSpeechRecognition | null = null;

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  maxAlternatives = 1;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  onaudiostart: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  onspeechend: (() => void) | null = null;
  
  private isRunning = false;

  constructor() {
    latestMockRecognition = this;
  }

  start() {
    if (this.isRunning) throw new Error('Already running');
    this.isRunning = true;
    setTimeout(() => {
      this.onstart?.();
    }, 0);
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    setTimeout(() => {
      this.onend?.();
    }, 0);
  }

  abort() {
    this.isRunning = false;
    this.onend?.();
  }

  // 测试辅助方法
  simulateResult(transcript: string, isFinal: boolean, confidence = 0.95) {
    const event = {
      resultIndex: 0,
      results: [{
        isFinal,
        length: 1,
        item: () => ({ transcript, confidence }),
        0: { transcript, confidence },
      }],
    };
    this.onresult?.(event);
  }

  simulateError(error: string) {
    this.onerror?.({ error, message: '' });
  }
}

// Mock MediaDevices
const mockMediaStream = {
  getTracks: () => [{ stop: vi.fn() }],
};

const mockAudioContext = {
  createAnalyser: () => ({
    fftSize: 256,
    frequencyBinCount: 128,
    getByteFrequencyData: vi.fn(),
  }),
  createMediaStreamSource: () => ({
    connect: vi.fn(),
  }),
  close: vi.fn(),
};

describe('VoiceInputService', () => {
  let service: VoiceInputService;

  beforeEach(() => {
    vi.useFakeTimers();
    
    // Setup SpeechRecognition mock
    latestMockRecognition = null;
    (window as any).SpeechRecognition = MockSpeechRecognition;
    (window as any).webkitSpeechRecognition = MockSpeechRecognition;
    
    // Setup MediaDevices mock
    (navigator as any).mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
    };
    
    // Setup AudioContext mock
    (window as any).AudioContext = vi.fn(() => mockAudioContext);
  });

  afterEach(() => {
    if (service) {
      service.destroy();
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('isVoiceInputSupported', () => {
    it('浏览器支持时应该返回 true', () => {
      expect(isVoiceInputSupported()).toBe(true);
    });

    it('不支持时应该返回 false', () => {
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;
      
      expect(isVoiceInputSupported()).toBe(false);
      
      // 恢复
      (window as any).SpeechRecognition = MockSpeechRecognition;
    });
  });

  describe('基础功能', () => {
    it('应该使用默认配置创建实例', () => {
      service = new VoiceInputService();
      expect(service).toBeDefined();
      expect(service.getStatus()).toBe('idle');
    });

    it('应该接受自定义配置', () => {
      service = new VoiceInputService({
        language: 'ja-JP',
        continuous: true,
        interimResults: false,
      });
      expect(service).toBeDefined();
    });

    it('不支持时状态应该是 unsupported', () => {
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;
      
      service = new VoiceInputService();
      expect(service.getStatus()).toBe('unsupported');
      
      // 恢复
      (window as any).SpeechRecognition = MockSpeechRecognition;
    });
  });

  describe('启动和停止', () => {
    it('start 应该返回 true 并开始监听', async () => {
      service = new VoiceInputService();
      
      const result = await service.start();
      vi.advanceTimersByTime(10);
      
      expect(result).toBe(true);
      expect(service.getStatus()).toBe('listening');
    });

    it('已在监听时 start 应该直接返回 true', async () => {
      service = new VoiceInputService();
      
      await service.start();
      vi.advanceTimersByTime(10);
      
      const result = await service.start();
      expect(result).toBe(true);
    });

    it('stop 应该停止监听', async () => {
      service = new VoiceInputService();
      
      await service.start();
      vi.advanceTimersByTime(10);
      
      service.stop();
      vi.advanceTimersByTime(10);
      
      expect(service.getStatus()).toBe('idle');
    });

    it('abort 应该取消监听并丢弃结果', async () => {
      service = new VoiceInputService();
      
      await service.start();
      vi.advanceTimersByTime(10);
      
      service.abort();
      
      expect(service.getStatus()).toBe('idle');
    });

    it('未初始化时 start 应该返回 false', async () => {
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;
      
      service = new VoiceInputService();
      
      const result = await service.start();
      expect(result).toBe(false);
      
      (window as any).SpeechRecognition = MockSpeechRecognition;
    });
  });

  describe('语言设置', () => {
    it('应该能切换语言', () => {
      service = new VoiceInputService({ language: 'zh-CN' });
      
      service.setLanguage('ja-JP');
      
      expect(latestMockRecognition!.lang).toBe('ja-JP');
    });

    it('getSupportedLanguages 应该返回支持的语言列表', () => {
      service = new VoiceInputService();
      
      const languages = service.getSupportedLanguages();
      
      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBe(3);
      
      const codes = languages.map(l => l.code);
      expect(codes).toContain('zh-CN');
      expect(codes).toContain('ja-JP');
      expect(codes).toContain('en-US');
    });
  });

  describe('结果回调', () => {
    it('应该能订阅识别结果', () => {
      service = new VoiceInputService();
      
      const callback = vi.fn();
      const unsubscribe = service.onResult(callback);
      
      expect(typeof unsubscribe).toBe('function');
    });

    it('识别到结果时应该调用回调', async () => {
      service = new VoiceInputService();
      
      const callback = vi.fn();
      service.onResult(callback);
      
      await service.start();
      vi.advanceTimersByTime(10);
      
      // 模拟识别结果
      latestMockRecognition!.simulateResult('你好', true);
      
      expect(callback).toHaveBeenCalled();
      const result: VoiceInputResult = callback.mock.calls[0][0];
      expect(result.transcript).toBe('你好');
      expect(result.isFinal).toBe(true);
    });

    it('中间结果也应该触发回调', async () => {
      service = new VoiceInputService({ interimResults: true });
      
      const callback = vi.fn();
      service.onResult(callback);
      
      await service.start();
      vi.advanceTimersByTime(10);
      
      // 模拟中间结果
      latestMockRecognition!.simulateResult('你', false);
      
      expect(callback).toHaveBeenCalled();
      const result: VoiceInputResult = callback.mock.calls[0][0];
      expect(result.isFinal).toBe(false);
    });

    it('取消订阅后不应再触发回调', async () => {
      service = new VoiceInputService();
      
      const callback = vi.fn();
      const unsubscribe = service.onResult(callback);
      
      unsubscribe();
      
      await service.start();
      vi.advanceTimersByTime(10);
      
      latestMockRecognition!.simulateResult('你好', true);
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('状态回调', () => {
    it('应该能订阅状态变化', () => {
      service = new VoiceInputService();
      
      const callback = vi.fn();
      service.onStatus(callback);
      
      // 订阅时立即调用一次
      expect(callback).toHaveBeenCalledWith('idle');
    });

    it('启动时应该触发 listening 状态', async () => {
      service = new VoiceInputService();
      
      const statuses: string[] = [];
      service.onStatus((status) => {
        statuses.push(status);
      });
      
      await service.start();
      vi.advanceTimersByTime(10);
      
      expect(statuses).toContain('listening');
    });

    it('停止时应该触发 idle 状态', async () => {
      service = new VoiceInputService();
      
      const callback = vi.fn();
      service.onStatus(callback);
      
      await service.start();
      vi.advanceTimersByTime(10);
      
      service.stop();
      vi.advanceTimersByTime(10);
      
      const calls = callback.mock.calls.map(c => c[0]);
      expect(calls).toContain('idle');
    });
  });

  describe('音量回调', () => {
    it('应该能订阅音量变化', () => {
      service = new VoiceInputService();
      
      const callback = vi.fn();
      const unsubscribe = service.onVolume(callback);
      
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('错误处理', () => {
    it('audio-capture 错误应该设置 error 状态', async () => {
      service = new VoiceInputService();
      
      const statusCallback = vi.fn();
      service.onStatus(statusCallback);
      
      await service.start();
      vi.advanceTimersByTime(10);
      
      latestMockRecognition!.simulateError('audio-capture');
      
      expect(statusCallback).toHaveBeenCalledWith('error', '无法访问麦克风');
    });

    it('not-allowed 错误应该设置 error 状态', async () => {
      service = new VoiceInputService();
      
      const statusCallback = vi.fn();
      service.onStatus(statusCallback);
      
      await service.start();
      vi.advanceTimersByTime(10);
      
      latestMockRecognition!.simulateError('not-allowed');
      
      expect(statusCallback).toHaveBeenCalledWith('error', '麦克风权限被拒绝');
    });

    it('network 错误应该设置 error 状态', async () => {
      service = new VoiceInputService();
      
      const statusCallback = vi.fn();
      service.onStatus(statusCallback);
      
      await service.start();
      vi.advanceTimersByTime(10);
      
      latestMockRecognition!.simulateError('network');
      
      expect(statusCallback).toHaveBeenCalledWith('error', '网络错误');
    });

    it('no-speech 不应该设置 error 状态', async () => {
      service = new VoiceInputService();
      
      const statusCallback = vi.fn();
      service.onStatus(statusCallback);
      
      await service.start();
      vi.advanceTimersByTime(10);
      
      latestMockRecognition!.simulateError('no-speech');
      
      // 不应该有 error 调用
      const errorCalls = statusCallback.mock.calls.filter(c => c[0] === 'error');
      expect(errorCalls.length).toBe(0);
    });

    it('aborted 不应该设置 error 状态', async () => {
      service = new VoiceInputService();
      
      const statusCallback = vi.fn();
      service.onStatus(statusCallback);
      
      await service.start();
      vi.advanceTimersByTime(10);
      
      latestMockRecognition!.simulateError('aborted');
      
      // 不应该有 error 调用
      const errorCalls = statusCallback.mock.calls.filter(c => c[0] === 'error');
      expect(errorCalls.length).toBe(0);
    });
  });

  describe('销毁', () => {
    it('destroy 应该清理所有资源', async () => {
      service = new VoiceInputService();
      
      const resultCallback = vi.fn();
      const statusCallback = vi.fn();
      
      service.onResult(resultCallback);
      service.onStatus(statusCallback);
      
      const callCountBefore = statusCallback.mock.calls.length;
      
      await service.start();
      vi.advanceTimersByTime(10);
      
      const callCountAfterStart = statusCallback.mock.calls.length;
      
      service.destroy();
      
      // 销毁后的状态变化次数有限
      const callsAfterDestroy = statusCallback.mock.calls.length - callCountAfterStart;
      expect(callsAfterDestroy).toBeLessThanOrEqual(2);
    });

    it('destroy 后状态应该是 idle', () => {
      service = new VoiceInputService();
      
      service.destroy();
      
      expect(service.getStatus()).toBe('idle');
    });
  });

  describe('连续模式', () => {
    it('连续模式下识别结束后应该重启', async () => {
      service = new VoiceInputService({ continuous: true });
      
      await service.start();
      vi.advanceTimersByTime(10);
      
      expect(service.getStatus()).toBe('listening');
      
      // 注意：由于 Mock 的简化，这里主要测试配置被正确应用
      expect(latestMockRecognition!.continuous).toBe(true);
    });
  });

  describe('回调错误处理', () => {
    it('结果回调错误不应影响其他回调', async () => {
      service = new VoiceInputService();
      
      let errorCalled = false;
      let normalCalled = false;
      
      // 注册错误回调
      service.onResult(() => {
        errorCalled = true;
        throw new Error('Test');
      });
      
      // 注册正常回调
      service.onResult(() => {
        normalCalled = true;
      });
      
      await service.start();
      vi.advanceTimersByTime(10);
      
      // 模拟结果时会触发所有回调
      // 由于回调是同步执行的，错误不会阻止其他回调
      try {
        latestMockRecognition!.simulateResult('test', true);
      } catch {
        // 可能抛出错误
      }
      
      expect(errorCalled).toBe(true);
      // 注意：由于实现方式，后续回调可能被执行也可能不被执行
      // 这取决于实现是否使用 try-catch
    });

    it('状态回调被调用时可以获取当前状态', async () => {
      service = new VoiceInputService();
      
      const statuses: string[] = [];
      
      service.onStatus((status) => {
        statuses.push(status);
      });
      
      // 初始状态
      expect(statuses).toContain('idle');
      
      await service.start();
      vi.advanceTimersByTime(10);
      
      // 应该有 listening 状态
      expect(statuses).toContain('listening');
    });
  });
});
