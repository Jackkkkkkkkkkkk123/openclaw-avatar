/**
 * Lip Sync Driver - 口型同步驱动
 * 
 * 分析音频实时驱动 Live2D 嘴型动画
 * 使用 Web Audio API 进行音量分析
 */

export interface LipSyncConfig {
  smoothing?: number;      // 平滑系数 (0-1)，越高越平滑
  sensitivity?: number;    // 灵敏度 (0-1)
  minThreshold?: number;   // 最小阈值
  maxThreshold?: number;   // 最大阈值
  updateInterval?: number; // 更新间隔 (ms)
}

type MouthUpdateCallback = (openY: number) => void;

const DEFAULT_CONFIG: Required<LipSyncConfig> = {
  smoothing: 0.5,
  sensitivity: 1.0,
  minThreshold: 0.01,
  maxThreshold: 0.8,
  updateInterval: 16, // ~60fps
};

export class LipSyncDriver {
  private config: Required<LipSyncConfig>;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private animationFrame: number | null = null;
  private callbacks: Set<MouthUpdateCallback> = new Set();
  private lastValue = 0;
  private isRunning = false;

  constructor(config: LipSyncConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * 连接音频元素进行分析
   */
  async connect(audioElement: HTMLAudioElement): Promise<void> {
    // 清理之前的连接
    this.disconnect();

    // 创建 AudioContext
    this.audioContext = new AudioContext();
    
    // 创建分析器
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = this.config.smoothing;
    
    // 连接音频源
    this.sourceNode = this.audioContext.createMediaElementSource(audioElement);
    this.sourceNode.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
    
    // 创建数据数组
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    console.log('[LipSync] 已连接音频元素');
  }

  /**
   * 开始分析
   */
  start() {
    if (this.isRunning || !this.analyser || !this.dataArray) {
      return;
    }
    
    this.isRunning = true;
    this.analyse();
    console.log('[LipSync] 开始分析');
  }

  /**
   * 停止分析
   */
  stop() {
    this.isRunning = false;
    
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    // 重置嘴型
    this.notifyCallbacks(0);
    this.lastValue = 0;
    
    console.log('[LipSync] 停止分析');
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.stop();
    
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {
        // 忽略
      }
      this.sourceNode = null;
    }
    
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch (e) {
        // 忽略
      }
      this.analyser = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.dataArray = null;
  }

  /**
   * 订阅嘴型更新
   */
  onMouthUpdate(callback: MouthUpdateCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 分析循环
   */
  private analyse() {
    if (!this.isRunning || !this.analyser || !this.dataArray) {
      return;
    }

    // 获取音量数据
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // 计算平均音量 (重点关注人声频率范围 85-255 Hz)
    // 在 256 点 FFT，采样率 44100 Hz 下：
    // 每个 bin 约 172 Hz，人声主要在 bin 0-3
    const voiceRange = Math.min(8, this.dataArray.length);
    let sum = 0;
    for (let i = 0; i < voiceRange; i++) {
      sum += this.dataArray[i];
    }
    const average = sum / voiceRange / 255; // 归一化到 0-1
    
    // 应用阈值和灵敏度
    let value = (average - this.config.minThreshold) / 
                (this.config.maxThreshold - this.config.minThreshold);
    value = Math.max(0, Math.min(1, value * this.config.sensitivity));
    
    // 平滑处理
    value = this.lastValue * this.config.smoothing + value * (1 - this.config.smoothing);
    this.lastValue = value;
    
    // 通知回调
    this.notifyCallbacks(value);
    
    // 继续循环
    this.animationFrame = requestAnimationFrame(() => this.analyse());
  }

  /**
   * 通知所有回调
   */
  private notifyCallbacks(value: number) {
    for (const callback of this.callbacks) {
      try {
        callback(value);
      } catch (e) {
        console.error('[LipSync] 回调错误:', e);
      }
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LipSyncConfig>) {
    this.config = {
      ...this.config,
      ...config,
    };
    
    if (this.analyser && config.smoothing !== undefined) {
      this.analyser.smoothingTimeConstant = config.smoothing;
    }
  }

  /**
   * 模拟口型（用于测试或无音频时）
   */
  simulateLipSync(text: string, durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const charDuration = durationMs / text.length;
      
      // 基于文本生成口型数据
      const vowels = /[aeiouäöüàáâãäåæçèéêëìíîïðñòóôõöøùúûüýÿ啊哦呃以乌]/gi;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        
        if (elapsed >= durationMs) {
          this.notifyCallbacks(0);
          resolve();
          return;
        }
        
        // 计算当前字符位置
        const charIndex = Math.floor(elapsed / charDuration);
        const char = text[charIndex] || '';
        
        // 元音张嘴大，辅音张嘴小
        let openY = vowels.test(char) ? 0.7 + Math.random() * 0.3 : 0.2 + Math.random() * 0.3;
        
        // 添加一些随机波动
        openY = Math.max(0, Math.min(1, openY + (Math.random() - 0.5) * 0.1));
        
        // 平滑处理
        openY = this.lastValue * 0.3 + openY * 0.7;
        this.lastValue = openY;
        
        this.notifyCallbacks(openY);
        
        requestAnimationFrame(animate);
      };
      
      animate();
    });
  }

  /**
   * 销毁
   */
  destroy() {
    this.disconnect();
    this.callbacks.clear();
  }
}

// 单例导出
export const lipSyncDriver = new LipSyncDriver();
