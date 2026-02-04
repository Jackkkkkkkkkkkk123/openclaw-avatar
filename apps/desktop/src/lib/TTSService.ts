/**
 * TTS Service - Fish Audio 语音合成
 * 
 * 使用 Fish Audio API 将文本转为语音
 * 在 Tauri 环境下通过 Rust 后端代理绕过 CORS
 */

import { invoke } from '@tauri-apps/api/core';

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

interface TauriTtsResponse {
  success: boolean;
  audio_base64: string | null;
  error: string | null;
}

const DEFAULT_CONFIG: Partial<TTSConfig> = {
  apiEndpoint: 'https://api.fish.audio/v1/tts',
  model: 's1',
  format: 'mp3',
};

// 检测是否在 Tauri 环境
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// 估算语音时长 (中文约 5 字/秒，英文约 3 词/秒)
function estimateDuration(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  
  const chineseDuration = chineseChars * 200; // 200ms per char
  const englishDuration = englishWords * 333; // 333ms per word
  
  return Math.max(500, chineseDuration + englishDuration);
}

// Base64 转 Blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
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

    let audioBlob: Blob;

    if (isTauri()) {
      // Tauri 环境：使用 Rust 后端代理
      console.log('[TTS] 使用 Tauri 代理');
      const response = await invoke<TauriTtsResponse>('tts_synthesize', {
        request: {
          text,
          api_key: this.config.apiKey,
          reference_id: this.config.referenceId,
          model: this.config.model,
          format: this.config.format,
        },
      });

      if (!response.success || !response.audio_base64) {
        throw new Error(`TTS 请求失败: ${response.error || '未知错误'}`);
      }

      const mimeType = this.config.format === 'mp3' ? 'audio/mpeg' : 
                       this.config.format === 'wav' ? 'audio/wav' : 'audio/opus';
      audioBlob = base64ToBlob(response.audio_base64, mimeType);
    } else {
      // 浏览器环境：使用本地 TTS 代理服务器 (端口 14201)
      console.log('[TTS] 使用本地代理服务器');
      try {
        // 使用本地代理端点 (tts-proxy.mjs) - 用当前页面的 hostname
        const proxyEndpoint = `http://${window.location.hostname}:14201`;
        const response = await fetch(proxyEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
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

        audioBlob = await response.blob();
      } catch (e) {
        console.error('[TTS] 合成失败:', e);
        throw e;
      }
    }

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
