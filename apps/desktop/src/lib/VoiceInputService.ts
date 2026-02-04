/**
 * VoiceInputService - 语音输入服务
 * 
 * 使用 Web Speech API 实现实时语音识别
 * 支持中文、日文、英文
 * 
 * Phase A - 多模态输入
 */

// 语音识别接口类型定义
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

// Web Speech API 类型
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type VoiceLanguage = 'zh-CN' | 'ja-JP' | 'en-US';

export interface VoiceInputConfig {
  language?: VoiceLanguage;
  continuous?: boolean;
  interimResults?: boolean;
}

export type VoiceInputStatus = 'idle' | 'listening' | 'processing' | 'error' | 'unsupported';

export interface VoiceInputResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  language: VoiceLanguage;
}

type ResultCallback = (result: VoiceInputResult) => void;
type StatusCallback = (status: VoiceInputStatus, error?: string) => void;
type VolumeCallback = (volume: number) => void;

/**
 * 检查浏览器是否支持语音识别
 */
export function isVoiceInputSupported(): boolean {
  return typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

/**
 * 语音输入服务
 */
export class VoiceInputService {
  private recognition: SpeechRecognition | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private volumeAnimationId: number | null = null;
  
  private config: Required<VoiceInputConfig>;
  private status: VoiceInputStatus = 'idle';
  
  private resultCallbacks: Set<ResultCallback> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();
  private volumeCallbacks: Set<VolumeCallback> = new Set();
  
  // 累积的转写文本
  private interimTranscript = '';
  private finalTranscript = '';

  constructor(config: VoiceInputConfig = {}) {
    this.config = {
      language: config.language ?? 'zh-CN',
      continuous: config.continuous ?? false,
      interimResults: config.interimResults ?? true,
    };

    if (!isVoiceInputSupported()) {
      this.status = 'unsupported';
      console.warn('[VoiceInput] 浏览器不支持语音识别');
      return;
    }

    this.initRecognition();
  }

  /**
   * 初始化语音识别
   */
  private initRecognition() {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionAPI();

    // 配置
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.lang = this.config.language;
    this.recognition.maxAlternatives = 1;

    // 事件处理
    this.recognition.onstart = () => {
      this.setStatus('listening');
      console.log('[VoiceInput] 开始监听...');
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.handleResult(event);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.handleError(event);
    };

    this.recognition.onend = () => {
      // 如果是连续模式且状态还是 listening，自动重启
      if (this.config.continuous && this.status === 'listening') {
        this.recognition?.start();
        return;
      }
      
      this.stopVolumeMonitor();
      
      // 最后输出最终结果
      if (this.finalTranscript) {
        this.notifyResult({
          transcript: this.finalTranscript,
          confidence: 1,
          isFinal: true,
          language: this.config.language,
        });
      }
      
      this.setStatus('idle');
      console.log('[VoiceInput] 监听结束');
    };

    this.recognition.onspeechstart = () => {
      console.log('[VoiceInput] 检测到语音');
    };

    this.recognition.onspeechend = () => {
      console.log('[VoiceInput] 语音结束');
    };
  }

  /**
   * 处理识别结果
   */
  private handleResult(event: SpeechRecognitionEvent) {
    this.interimTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;
      
      if (result.isFinal) {
        this.finalTranscript += transcript;
        
        this.notifyResult({
          transcript: transcript,
          confidence: confidence,
          isFinal: true,
          language: this.config.language,
        });
        
        console.log('[VoiceInput] 识别结果:', transcript, '置信度:', confidence);
      } else {
        this.interimTranscript += transcript;
        
        this.notifyResult({
          transcript: transcript,
          confidence: confidence,
          isFinal: false,
          language: this.config.language,
        });
      }
    }
  }

  /**
   * 处理错误
   */
  private handleError(event: SpeechRecognitionErrorEvent) {
    let errorMessage = '';
    
    switch (event.error) {
      case 'no-speech':
        errorMessage = '未检测到语音';
        // 不算真正的错误，用户可能还没开始说话
        console.log('[VoiceInput] 未检测到语音');
        return;
      
      case 'audio-capture':
        errorMessage = '无法访问麦克风';
        break;
      
      case 'not-allowed':
        errorMessage = '麦克风权限被拒绝';
        break;
      
      case 'network':
        errorMessage = '网络错误';
        break;
      
      case 'aborted':
        errorMessage = '识别已取消';
        console.log('[VoiceInput] 识别已取消');
        return;
      
      default:
        errorMessage = `识别错误: ${event.error}`;
    }
    
    this.setStatus('error', errorMessage);
    console.error('[VoiceInput] 错误:', errorMessage);
  }

  /**
   * 开始监听
   */
  async start(): Promise<boolean> {
    if (!this.recognition) {
      console.error('[VoiceInput] 语音识别未初始化');
      return false;
    }

    if (this.status === 'listening') {
      console.log('[VoiceInput] 已在监听中');
      return true;
    }

    try {
      // 请求麦克风权限并启动音量监控
      await this.startVolumeMonitor();
      
      // 重置累积文本
      this.interimTranscript = '';
      this.finalTranscript = '';
      
      // 开始识别
      this.recognition.start();
      return true;
    } catch (e) {
      console.error('[VoiceInput] 启动失败:', e);
      this.setStatus('error', '启动失败');
      return false;
    }
  }

  /**
   * 停止监听
   */
  stop() {
    if (this.recognition && this.status === 'listening') {
      this.recognition.stop();
    }
    this.stopVolumeMonitor();
  }

  /**
   * 取消监听（丢弃结果）
   */
  abort() {
    if (this.recognition) {
      this.recognition.abort();
    }
    this.stopVolumeMonitor();
    this.interimTranscript = '';
    this.finalTranscript = '';
    this.setStatus('idle');
  }

  /**
   * 启动音量监控（用于显示波形）
   */
  private async startVolumeMonitor() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);
      
      this.analyser.fftSize = 256;
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      
      const updateVolume = () => {
        if (!this.analyser || this.status !== 'listening') return;
        
        this.analyser.getByteFrequencyData(dataArray);
        
        // 计算平均音量
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalized = Math.min(1, average / 128);
        
        this.notifyVolume(normalized);
        
        this.volumeAnimationId = requestAnimationFrame(updateVolume);
      };
      
      updateVolume();
    } catch (e) {
      console.warn('[VoiceInput] 音量监控启动失败:', e);
    }
  }

  /**
   * 停止音量监控
   */
  private stopVolumeMonitor() {
    if (this.volumeAnimationId) {
      cancelAnimationFrame(this.volumeAnimationId);
      this.volumeAnimationId = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
  }

  /**
   * 设置语言
   */
  setLanguage(language: VoiceLanguage) {
    this.config.language = language;
    if (this.recognition) {
      this.recognition.lang = language;
    }
    console.log('[VoiceInput] 语言切换:', language);
  }

  /**
   * 获取当前状态
   */
  getStatus(): VoiceInputStatus {
    return this.status;
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): { code: VoiceLanguage; name: string }[] {
    return [
      { code: 'zh-CN', name: '中文' },
      { code: 'ja-JP', name: '日本語' },
      { code: 'en-US', name: 'English' },
    ];
  }

  /**
   * 订阅识别结果
   */
  onResult(callback: ResultCallback): () => void {
    this.resultCallbacks.add(callback);
    return () => this.resultCallbacks.delete(callback);
  }

  /**
   * 订阅状态变化
   */
  onStatus(callback: StatusCallback): () => void {
    this.statusCallbacks.add(callback);
    callback(this.status);
    return () => this.statusCallbacks.delete(callback);
  }

  /**
   * 订阅音量变化
   */
  onVolume(callback: VolumeCallback): () => void {
    this.volumeCallbacks.add(callback);
    return () => this.volumeCallbacks.delete(callback);
  }

  /**
   * 设置状态
   */
  private setStatus(status: VoiceInputStatus, error?: string) {
    this.status = status;
    for (const callback of this.statusCallbacks) {
      try {
        callback(status, error);
      } catch (e) {
        console.error('[VoiceInput] 状态回调错误:', e);
      }
    }
  }

  /**
   * 通知识别结果
   */
  private notifyResult(result: VoiceInputResult) {
    for (const callback of this.resultCallbacks) {
      try {
        callback(result);
      } catch (e) {
        console.error('[VoiceInput] 结果回调错误:', e);
      }
    }
  }

  /**
   * 通知音量变化
   */
  private notifyVolume(volume: number) {
    for (const callback of this.volumeCallbacks) {
      try {
        callback(volume);
      } catch (e) {
        console.error('[VoiceInput] 音量回调错误:', e);
      }
    }
  }

  /**
   * 销毁
   */
  destroy() {
    this.abort();
    this.resultCallbacks.clear();
    this.statusCallbacks.clear();
    this.volumeCallbacks.clear();
    this.recognition = null;
  }
}

// 全局实例
export const voiceInputService = new VoiceInputService();
