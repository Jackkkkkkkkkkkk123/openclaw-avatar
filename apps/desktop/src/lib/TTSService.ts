/**
 * TTS Service - Fish Audio 语音合成
 * 
 * 使用 Fish Audio API 将文本转为语音
 * 配置在 TOOLS.md 中
 */

export interface TTSConfig {
  apiEndpoint: string;
  apiKey: string;
  referenceId: string;
  model?: string;
  format?: 'mp3' | 'wav' | 'opus';
}

export interface TTSResult {
  audioUrl: string;
  audioBlob: Blob;
  duration: number; // 估算的音频时长 (ms)
}

const DEFAULT_CONFIG: Partial<TTSConfig> = {
  apiEndpoint: 'https://api.fish.audio/v1/tts',
  model: 's1',
  format: 'mp3',
};

// 估算语音时长 (中文约 5 字/秒，英文约 3 词/秒)
function estimateDuration(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  
  const chineseDuration = chineseChars * 200; // 200ms per char
  const englishDuration = englishWords * 333; // 333ms per word
  
  return Math.max(500, chineseDuration + englishDuration);
}

export class TTSService {
  private config: Required<TTSConfig>;
  private audioCache: Map<string, TTSResult> = new Map();
  private currentAudio: HTMLAudioElement | null = null;
  
  constructor(config: TTSConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as Required<TTSConfig>;
  }

  /**
   * 将文本转为语音
   */
  async synthesize(text: string): Promise<TTSResult> {
    // 检查缓存
    const cacheKey = this.getCacheKey(text);
    if (this.audioCache.has(cacheKey)) {
      return this.audioCache.get(cacheKey)!;
    }

    console.log('[TTS] 合成语音:', text.slice(0, 50) + (text.length > 50 ? '...' : ''));

    try {
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'model': this.config.model,
        },
        body: JSON.stringify({
          text,
          reference_id: this.config.referenceId,
          format: this.config.format,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TTS 请求失败: ${response.status} - ${errorText}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const duration = estimateDuration(text);

      const result: TTSResult = {
        audioUrl,
        audioBlob,
        duration,
      };

      // 缓存结果
      this.audioCache.set(cacheKey, result);

      return result;
    } catch (e) {
      console.error('[TTS] 合成失败:', e);
      throw e;
    }
  }

  /**
   * 播放语音
   */
  async speak(text: string, onTimeUpdate?: (currentTime: number, duration: number) => void): Promise<void> {
    // 停止当前播放
    this.stop();

    const result = await this.synthesize(text);
    
    return new Promise((resolve, reject) => {
      this.currentAudio = new Audio(result.audioUrl);
      
      this.currentAudio.onended = () => {
        this.currentAudio = null;
        resolve();
      };
      
      this.currentAudio.onerror = (e) => {
        this.currentAudio = null;
        reject(e);
      };

      if (onTimeUpdate) {
        this.currentAudio.ontimeupdate = () => {
          if (this.currentAudio) {
            onTimeUpdate(
              this.currentAudio.currentTime * 1000,
              this.currentAudio.duration * 1000
            );
          }
        };
      }
      
      this.currentAudio.play().catch(reject);
    });
  }

  /**
   * 停止播放
   */
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  /**
   * 暂停播放
   */
  pause() {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
  }

  /**
   * 继续播放
   */
  resume() {
    if (this.currentAudio) {
      this.currentAudio.play();
    }
  }

  /**
   * 获取当前音频对象 (用于口型同步分析)
   */
  getCurrentAudio(): HTMLAudioElement | null {
    return this.currentAudio;
  }

  /**
   * 是否正在播放
   */
  isPlaying(): boolean {
    return this.currentAudio !== null && !this.currentAudio.paused;
  }

  /**
   * 清理缓存
   */
  clearCache() {
    for (const result of this.audioCache.values()) {
      URL.revokeObjectURL(result.audioUrl);
    }
    this.audioCache.clear();
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(text: string): string {
    return `${this.config.referenceId}:${text.slice(0, 100)}`;
  }

  /**
   * 销毁
   */
  destroy() {
    this.stop();
    this.clearCache();
  }
}

/**
 * 创建 TTS 服务实例
 */
export function createTTSService(apiKey?: string): TTSService {
  return new TTSService({
    apiEndpoint: 'https://api.fish.audio/v1/tts',
    apiKey: apiKey || 'ceea7f5420dc4214807f4ce5dccb9da3', // 内置 API Key
    referenceId: '9dec9671824543b4a4f9f382dbf15748', // 初音克隆音色
    model: 's1',
    format: 'mp3',
  });
}

// 预配置的默认 TTS 服务实例
export const ttsService = createTTSService();
