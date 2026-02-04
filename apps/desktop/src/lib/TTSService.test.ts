/**
 * TTSService 单元测试
 * 
 * 测试 Fish Audio TTS 语音合成服务
 * - 配置管理
 * - 语音合成
 * - 播放控制
 * - 缓存机制
 * - 时长估算
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TTSService, createTTSService, type TTSConfig, type TTSResult } from './TTSService';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Audio
class MockAudio {
  src = '';
  currentTime = 0;
  duration = 5;
  paused = true;
  
  onended: (() => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  
  async play() {
    this.paused = false;
    return Promise.resolve();
  }
  
  pause() {
    this.paused = true;
  }
}

// @ts-ignore
global.Audio = MockAudio;

// Mock URL.createObjectURL and revokeObjectURL
const mockObjectURLs = new Map<string, Blob>();
let objectURLCounter = 0;

global.URL.createObjectURL = vi.fn((blob: Blob) => {
  const url = `blob:test-${objectURLCounter++}`;
  mockObjectURLs.set(url, blob);
  return url;
});

global.URL.revokeObjectURL = vi.fn((url: string) => {
  mockObjectURLs.delete(url);
});

describe('TTSService', () => {
  let ttsService: TTSService;
  
  const defaultConfig: TTSConfig = {
    apiEndpoint: 'https://api.fish.audio/v1/tts',
    apiKey: 'test-api-key',
    referenceId: 'test-reference-id',
    model: 's1',
    format: 'mp3',
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockObjectURLs.clear();
    objectURLCounter = 0;
    ttsService = new TTSService(defaultConfig);
  });
  
  afterEach(() => {
    ttsService.destroy();
  });
  
  describe('创建和配置', () => {
    it('应该使用提供的配置创建服务', () => {
      const service = new TTSService(defaultConfig);
      expect(service).toBeDefined();
      service.destroy();
    });
    
    it('应该合并默认配置', () => {
      const minimalConfig = {
        apiEndpoint: 'https://custom.api/tts',
        apiKey: 'key',
        referenceId: 'ref',
      };
      const service = new TTSService(minimalConfig);
      // 服务应该被创建成功，使用默认的 model 和 format
      expect(service).toBeDefined();
      service.destroy();
    });
    
    it('createTTSService 应该创建预配置的服务', () => {
      const service = createTTSService('custom-key');
      expect(service).toBeDefined();
      service.destroy();
    });
    
    it('createTTSService 不传 key 应该使用内置 key', () => {
      const service = createTTSService();
      expect(service).toBeDefined();
      service.destroy();
    });
  });
  
  describe('语音合成 synthesize()', () => {
    it('应该成功合成语音', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });
      
      const result = await ttsService.synthesize('你好世界');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fish.audio/v1/tts',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
        })
      );
      
      expect(result).toHaveProperty('audioUrl');
      expect(result).toHaveProperty('audioBlob');
      expect(result).toHaveProperty('duration');
      expect(result.duration).toBeGreaterThan(0);
    });
    
    it('应该缓存合成结果', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });
      
      // 第一次合成
      const result1 = await ttsService.synthesize('测试文本');
      // 第二次应该从缓存返回
      const result2 = await ttsService.synthesize('测试文本');
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result1.audioUrl).toBe(result2.audioUrl);
    });
    
    it('应该处理 API 错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });
      
      await expect(ttsService.synthesize('测试')).rejects.toThrow('TTS 请求失败');
    });
    
    it('应该处理网络错误', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(ttsService.synthesize('测试')).rejects.toThrow('Network error');
    });
    
    it('应该发送正确的请求体', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });
      
      await ttsService.synthesize('Hello World');
      
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      
      expect(body).toEqual({
        text: 'Hello World',
        reference_id: 'test-reference-id',
        format: 'mp3',
      });
    });
  });
  
  describe('播放控制', () => {
    beforeEach(() => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });
    });
    
    it('speak() 应该播放合成的语音', async () => {
      const speakPromise = ttsService.speak('测试语音');
      
      // 等待合成完成
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // 模拟音频结束
      const audio = (ttsService as any).currentAudio;
      if (audio && audio.onended) {
        audio.onended();
      }
      
      await speakPromise;
      expect(mockFetch).toHaveBeenCalled();
    });
    
    it('speak() 应该调用时间更新回调', async () => {
      const onTimeUpdate = vi.fn();
      const speakPromise = ttsService.speak('测试', onTimeUpdate);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const audio = (ttsService as any).currentAudio as MockAudio;
      if (audio && audio.ontimeupdate) {
        audio.ontimeupdate();
      }
      
      expect(onTimeUpdate).toHaveBeenCalled();
      
      // 结束播放
      if (audio && audio.onended) {
        audio.onended();
      }
      await speakPromise;
    });
    
    it('stop() 应该停止当前播放', async () => {
      ttsService.speak('测试');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      ttsService.stop();
      
      expect((ttsService as any).currentAudio).toBeNull();
    });
    
    it('pause() 应该暂停播放', async () => {
      ttsService.speak('测试');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const audio = (ttsService as any).currentAudio as MockAudio;
      ttsService.pause();
      
      expect(audio.paused).toBe(true);
    });
    
    it('resume() 应该继续播放', async () => {
      ttsService.speak('测试');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      ttsService.pause();
      ttsService.resume();
      
      const audio = (ttsService as any).currentAudio as MockAudio;
      expect(audio.paused).toBe(false);
    });
    
    it('isPlaying() 应该返回正确的状态', async () => {
      expect(ttsService.isPlaying()).toBe(false);
      
      ttsService.speak('测试');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(ttsService.isPlaying()).toBe(true);
      
      ttsService.pause();
      expect(ttsService.isPlaying()).toBe(false);
    });
    
    it('getCurrentAudio() 应该返回当前音频对象', async () => {
      expect(ttsService.getCurrentAudio()).toBeNull();
      
      ttsService.speak('测试');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(ttsService.getCurrentAudio()).not.toBeNull();
    });
    
    it('speak() 应该自动停止之前的播放', async () => {
      // 开始第一次播放
      ttsService.speak('第一段');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const firstAudio = (ttsService as any).currentAudio;
      
      // 开始第二次播放（应该停止第一次）
      ttsService.speak('第二段');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const secondAudio = (ttsService as any).currentAudio;
      
      expect(secondAudio).not.toBe(firstAudio);
    });
  });
  
  describe('缓存管理', () => {
    it('clearCache() 应该清除所有缓存', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });
      
      await ttsService.synthesize('测试1');
      await ttsService.synthesize('测试2');
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      ttsService.clearCache();
      
      // 再次合成应该重新请求
      await ttsService.synthesize('测试1');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
    
    it('clearCache() 应该释放 Object URLs', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });
      
      await ttsService.synthesize('测试');
      
      expect(mockObjectURLs.size).toBe(1);
      
      ttsService.clearCache();
      
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });
  
  describe('destroy()', () => {
    it('应该停止播放并清除缓存', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });
      
      await ttsService.synthesize('测试');
      ttsService.speak('播放测试');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      ttsService.destroy();
      
      expect((ttsService as any).currentAudio).toBeNull();
      expect((ttsService as any).audioCache.size).toBe(0);
    });
  });
  
  describe('时长估算', () => {
    it('应该正确估算中文时长', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });
      
      // 5个中文字符 = 5 * 200ms = 1000ms
      const result = await ttsService.synthesize('你好世界啊');
      expect(result.duration).toBe(1000);
    });
    
    it('应该正确估算英文时长', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });
      
      // 3个英文单词 = 3 * 333ms = 999ms
      const result = await ttsService.synthesize('hello world test');
      expect(result.duration).toBe(999);
    });
    
    it('应该正确估算中英混合时长', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });
      
      // 2个中文 + 1个英文单词 = 400ms + 333ms = 733ms
      const result = await ttsService.synthesize('你好 world');
      expect(result.duration).toBe(733);
    });
    
    it('空文本应该返回最小时长', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });
      
      const result = await ttsService.synthesize('');
      expect(result.duration).toBe(500); // 最小500ms
    });
  });
  
  describe('边界情况', () => {
    it('应该处理长文本', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });
      
      const longText = '测试'.repeat(100);
      const result = await ttsService.synthesize(longText);
      
      expect(result.audioUrl).toBeDefined();
    });
    
    it('应该处理特殊字符', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });
      
      const specialText = '你好！🎵 "测试" & <script>';
      const result = await ttsService.synthesize(specialText);
      
      expect(result.audioUrl).toBeDefined();
    });
    
    it('缓存键应该截断长文本', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });
      
      const longText1 = '测试'.repeat(100);
      const longText2 = '测试'.repeat(100) + '不同';
      
      await ttsService.synthesize(longText1);
      await ttsService.synthesize(longText2);
      
      // 两个文本的前100字符相同，应该共享缓存
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    
    it('pause/resume 在没有播放时不应该报错', () => {
      expect(() => ttsService.pause()).not.toThrow();
      expect(() => ttsService.resume()).not.toThrow();
    });
    
    it('stop 在没有播放时不应该报错', () => {
      expect(() => ttsService.stop()).not.toThrow();
    });
    
    it('多次 destroy 不应该报错', () => {
      ttsService.destroy();
      expect(() => ttsService.destroy()).not.toThrow();
    });
  });
});
