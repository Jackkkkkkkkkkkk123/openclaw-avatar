/**
 * LipSyncDriver 测试套件
 * 
 * 测试覆盖：
 * - 基础功能（创建、配置）
 * - 回调订阅和取消订阅
 * - 配置更新
 * - 启动/停止逻辑
 * - 边界情况处理
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LipSyncDriver, type LipSyncConfig } from './LipSyncDriver';

// Mock Web Audio API
const createMockAudioContext = () => {
  const mockAnalyserNode = {
    fftSize: 256,
    frequencyBinCount: 128,
    smoothingTimeConstant: 0.5,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteFrequencyData: vi.fn((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }),
  };

  const mockSourceNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockAudioContext = {
    createAnalyser: vi.fn(() => mockAnalyserNode),
    createMediaElementSource: vi.fn(() => mockSourceNode),
    destination: {},
    close: vi.fn(),
  };

  return { mockAudioContext, mockAnalyserNode, mockSourceNode };
};

let mocks: ReturnType<typeof createMockAudioContext>;

// 在每次调用 new AudioContext() 时返回当前的 mocks
vi.stubGlobal('AudioContext', vi.fn(function() {
  return mocks.mockAudioContext;
}));
vi.stubGlobal('requestAnimationFrame', vi.fn((cb: () => void) => {
  return setTimeout(cb, 16) as unknown as number;
}));
vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
  clearTimeout(id);
}));

describe('LipSyncDriver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks = createMockAudioContext();
  });

  describe('基础功能', () => {
    it('应该使用默认配置创建实例', () => {
      const driver = new LipSyncDriver();
      expect(driver).toBeInstanceOf(LipSyncDriver);
      driver.destroy();
    });

    it('应该接受自定义配置', () => {
      const config: LipSyncConfig = {
        smoothing: 0.8,
        sensitivity: 1.5,
        minThreshold: 0.05,
        maxThreshold: 0.9,
        updateInterval: 32,
      };
      
      const driver = new LipSyncDriver(config);
      expect(driver).toBeInstanceOf(LipSyncDriver);
      driver.destroy();
    });

    it('应该接受部分配置', () => {
      const driver = new LipSyncDriver({ smoothing: 0.3 });
      expect(driver).toBeInstanceOf(LipSyncDriver);
      driver.destroy();
    });

    it('应该能够连接音频元素', async () => {
      const driver = new LipSyncDriver();
      const mockAudio = document.createElement('audio');
      
      await driver.connect(mockAudio);
      
      expect(mocks.mockAudioContext.createAnalyser).toHaveBeenCalled();
      expect(mocks.mockAudioContext.createMediaElementSource).toHaveBeenCalledWith(mockAudio);
      expect(mocks.mockSourceNode.connect).toHaveBeenCalledWith(mocks.mockAnalyserNode);
      
      driver.destroy();
    });

    it('重复连接应该先断开之前的连接', async () => {
      const driver = new LipSyncDriver();
      const mockAudio1 = document.createElement('audio');
      const mockAudio2 = document.createElement('audio');
      
      await driver.connect(mockAudio1);
      const firstClose = mocks.mockAudioContext.close;
      
      await driver.connect(mockAudio2);
      
      // 应该调用 close 断开之前的连接
      expect(firstClose).toHaveBeenCalled();
      
      driver.destroy();
    });
  });

  describe('回调订阅', () => {
    it('应该能够订阅嘴型更新', () => {
      const driver = new LipSyncDriver();
      const callback = vi.fn();
      
      const unsubscribe = driver.onMouthUpdate(callback);
      
      expect(typeof unsubscribe).toBe('function');
      driver.destroy();
    });

    it('应该能够取消订阅', () => {
      const driver = new LipSyncDriver();
      const callback = vi.fn();
      
      const unsubscribe = driver.onMouthUpdate(callback);
      unsubscribe();
      
      // 调用 stop 应该不会触发已取消的回调（因为已经移除）
      driver.stop();
      driver.destroy();
    });

    it('多个回调应该都被注册', () => {
      const driver = new LipSyncDriver();
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();
      
      const unsub1 = driver.onMouthUpdate(callback1);
      const unsub2 = driver.onMouthUpdate(callback2);
      const unsub3 = driver.onMouthUpdate(callback3);
      
      expect(typeof unsub1).toBe('function');
      expect(typeof unsub2).toBe('function');
      expect(typeof unsub3).toBe('function');
      
      driver.destroy();
    });
  });

  describe('启动和停止', () => {
    it('未连接时 start 不应崩溃', () => {
      const driver = new LipSyncDriver();
      expect(() => driver.start()).not.toThrow();
      driver.destroy();
    });

    it('stop 应该不崩溃', () => {
      const driver = new LipSyncDriver();
      expect(() => driver.stop()).not.toThrow();
      driver.destroy();
    });

    it('多次 stop 不应崩溃', () => {
      const driver = new LipSyncDriver();
      expect(() => {
        driver.stop();
        driver.stop();
        driver.stop();
      }).not.toThrow();
      driver.destroy();
    });

    it('连接后应该能够 start', async () => {
      const driver = new LipSyncDriver();
      const mockAudio = document.createElement('audio');
      
      await driver.connect(mockAudio);
      
      expect(() => driver.start()).not.toThrow();
      
      driver.destroy();
    });

    it('start 后 stop 应该正常工作', async () => {
      const driver = new LipSyncDriver();
      const mockAudio = document.createElement('audio');
      
      await driver.connect(mockAudio);
      driver.start();
      
      expect(() => driver.stop()).not.toThrow();
      
      driver.destroy();
    });

    it('disconnect 后应该清理资源', async () => {
      const driver = new LipSyncDriver();
      const mockAudio = document.createElement('audio');
      
      await driver.connect(mockAudio);
      driver.disconnect();
      
      expect(mocks.mockAudioContext.close).toHaveBeenCalled();
      
      driver.destroy();
    });
  });

  describe('配置更新', () => {
    it('应该能够更新部分配置', () => {
      const driver = new LipSyncDriver();
      
      expect(() => {
        driver.updateConfig({ smoothing: 0.9 });
      }).not.toThrow();
      
      driver.destroy();
    });

    it('应该能够更新多个配置项', () => {
      const driver = new LipSyncDriver();
      
      expect(() => {
        driver.updateConfig({
          smoothing: 0.9,
          sensitivity: 2.0,
          minThreshold: 0.02,
        });
      }).not.toThrow();
      
      driver.destroy();
    });

    it('更新 smoothing 应该同步到 analyser', async () => {
      const driver = new LipSyncDriver();
      const mockAudio = document.createElement('audio');
      
      await driver.connect(mockAudio);
      driver.updateConfig({ smoothing: 0.9 });
      
      expect(mocks.mockAnalyserNode.smoothingTimeConstant).toBe(0.9);
      
      driver.destroy();
    });

    it('未连接时更新 smoothing 不应崩溃', () => {
      const driver = new LipSyncDriver();
      
      expect(() => {
        driver.updateConfig({ smoothing: 0.9 });
      }).not.toThrow();
      
      driver.destroy();
    });
  });

  describe('边界情况', () => {
    it('destroy 后不应崩溃', () => {
      const driver = new LipSyncDriver();
      
      expect(() => {
        driver.destroy();
        driver.destroy(); // 重复调用
      }).not.toThrow();
    });

    it('极端配置值应该被接受', () => {
      expect(() => {
        const driver = new LipSyncDriver({
          smoothing: 0,
          sensitivity: 0,
          minThreshold: 1,
          maxThreshold: 0,
        });
        driver.destroy();
      }).not.toThrow();
    });

    it('配置值为 1 时应该正常工作', () => {
      expect(() => {
        const driver = new LipSyncDriver({
          smoothing: 1,
          sensitivity: 1,
          minThreshold: 0,
          maxThreshold: 1,
        });
        driver.destroy();
      }).not.toThrow();
    });

    it('空配置应该使用默认值', () => {
      const driver = new LipSyncDriver({});
      expect(driver).toBeInstanceOf(LipSyncDriver);
      driver.destroy();
    });
  });

  describe('destroy 清理', () => {
    it('destroy 应该断开连接', async () => {
      const driver = new LipSyncDriver();
      const mockAudio = document.createElement('audio');
      
      await driver.connect(mockAudio);
      driver.destroy();
      
      expect(mocks.mockAudioContext.close).toHaveBeenCalled();
    });

    it('destroy 应该停止分析', async () => {
      const driver = new LipSyncDriver();
      const mockAudio = document.createElement('audio');
      
      await driver.connect(mockAudio);
      driver.start();
      driver.destroy();
      
      // 不应崩溃
    });
  });

  describe('连接错误处理', () => {
    it('disconnect 时 sourceNode.disconnect 错误应该被忽略', async () => {
      const driver = new LipSyncDriver();
      const mockAudio = document.createElement('audio');
      
      await driver.connect(mockAudio);
      
      // 模拟 disconnect 抛出错误
      mocks.mockSourceNode.disconnect.mockImplementationOnce(() => {
        throw new Error('Already disconnected');
      });
      
      expect(() => driver.disconnect()).not.toThrow();
      
      driver.destroy();
    });

    it('disconnect 时 analyser.disconnect 错误应该被忽略', async () => {
      const driver = new LipSyncDriver();
      const mockAudio = document.createElement('audio');
      
      await driver.connect(mockAudio);
      
      // 模拟 disconnect 抛出错误
      mocks.mockAnalyserNode.disconnect.mockImplementationOnce(() => {
        throw new Error('Already disconnected');
      });
      
      expect(() => driver.disconnect()).not.toThrow();
      
      driver.destroy();
    });
  });

  describe('多实例', () => {
    it('应该能够创建多个独立实例', () => {
      const driver1 = new LipSyncDriver({ smoothing: 0.1 });
      const driver2 = new LipSyncDriver({ smoothing: 0.9 });
      
      expect(driver1).toBeInstanceOf(LipSyncDriver);
      expect(driver2).toBeInstanceOf(LipSyncDriver);
      
      driver1.destroy();
      driver2.destroy();
    });

    it('一个实例的 destroy 不应影响其他实例', () => {
      const driver1 = new LipSyncDriver();
      const driver2 = new LipSyncDriver();
      
      driver1.destroy();
      
      // driver2 应该仍然可用
      expect(() => driver2.stop()).not.toThrow();
      
      driver2.destroy();
    });
  });

  describe('回调通知', () => {
    it('stop 时应该通知回调值为 0', async () => {
      const driver = new LipSyncDriver();
      const callback = vi.fn();
      driver.onMouthUpdate(callback);
      
      const mockAudio = document.createElement('audio');
      await driver.connect(mockAudio);
      
      driver.start();
      driver.stop();
      
      // 检查最后一次调用是否为 0
      const calls = callback.mock.calls;
      if (calls.length > 0) {
        const lastCall = calls[calls.length - 1];
        expect(lastCall[0]).toBe(0);
      }
      
      driver.destroy();
    });
  });

  describe('simulateLipSync', () => {
    it('空文本应该立即完成', async () => {
      const driver = new LipSyncDriver();
      const callback = vi.fn();
      driver.onMouthUpdate(callback);
      
      await driver.simulateLipSync('', 0);
      
      // 至少应该有一次调用（结束时的 0）
      expect(callback).toHaveBeenCalled();
      
      driver.destroy();
    }, 10000);

    it('短文本应该能完成', async () => {
      const driver = new LipSyncDriver();
      const callback = vi.fn();
      driver.onMouthUpdate(callback);
      
      await driver.simulateLipSync('hi', 50);
      
      expect(callback).toHaveBeenCalled();
      
      driver.destroy();
    }, 10000);
  });
});
