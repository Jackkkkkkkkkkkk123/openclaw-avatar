/**
 * VoiceEmotionAnalyzer - 语音情感分析器
 * 
 * 通过分析语音的声学特征推断情绪状态：
 * - 音高 (Pitch/F0) - 兴奋/悲伤
 * - 音量 (Volume/Energy) - 激动/平静
 * - 语速 (Speech Rate) - 紧张/放松
 * - 音色变化 (Spectral Flux) - 情绪波动
 * - 停顿模式 (Pause Pattern) - 思考/犹豫
 * 
 * 用于驱动 Avatar 表情，不仅仅依赖文本内容
 */

export type VoiceEmotion = 
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'fear'
  | 'surprised'
  | 'excited'
  | 'calm'
  | 'anxious'
  | 'tender'
  | 'thinking';

export interface VoiceFeatures {
  /** 基频 (Hz) - 通常 85-255Hz 为人声范围 */
  pitch: number;
  /** 音高变化率 (标准差) */
  pitchVariance: number;
  /** 音量 (0-1) */
  volume: number;
  /** 音量变化率 */
  volumeVariance: number;
  /** 语速估计 (syllables/second) */
  speechRate: number;
  /** 频谱变化率 (情绪波动) */
  spectralFlux: number;
  /** 静音比例 (0-1) */
  silenceRatio: number;
  /** 高频能量比例 (0-1) - 尖锐度 */
  highFreqRatio: number;
  /** 低频能量比例 (0-1) - 温暖度 */
  lowFreqRatio: number;
}

export interface VoiceEmotionResult {
  /** 主要情绪 */
  emotion: VoiceEmotion;
  /** 置信度 (0-1) */
  confidence: number;
  /** 情绪强度 (0-1) */
  intensity: number;
  /** 原始特征 */
  features: VoiceFeatures;
  /** Valence-Arousal 坐标 */
  valence: number;  // -1 (消极) to 1 (积极)
  arousal: number;  // -1 (平静) to 1 (激动)
  /** 次要情绪候选 */
  secondary?: { emotion: VoiceEmotion; confidence: number }[];
}

export interface VoiceEmotionConfig {
  /** FFT 大小 (2的幂次) */
  fftSize: number;
  /** 平滑因子 (0-1) */
  smoothingFactor: number;
  /** 分析帧率 */
  analysisRate: number;
  /** 音高检测范围 (Hz) */
  pitchRange: { min: number; max: number };
  /** 静音阈值 (0-1) */
  silenceThreshold: number;
  /** 情绪变化敏感度 (0-1) */
  sensitivity: number;
  /** 启用历史平滑 */
  enableHistorySmoothing: boolean;
  /** 历史窗口大小 */
  historyWindowSize: number;
}

const DEFAULT_CONFIG: VoiceEmotionConfig = {
  fftSize: 2048,
  smoothingFactor: 0.8,
  analysisRate: 30,
  pitchRange: { min: 75, max: 400 },
  silenceThreshold: 0.02,
  sensitivity: 0.6,
  enableHistorySmoothing: true,
  historyWindowSize: 10,
};

// 情绪在 Valence-Arousal 空间的位置
const EMOTION_VA_MAP: Record<VoiceEmotion, { valence: number; arousal: number }> = {
  neutral:   { valence: 0.0, arousal: 0.0 },
  happy:     { valence: 0.8, arousal: 0.5 },
  sad:       { valence: -0.7, arousal: -0.4 },
  angry:     { valence: -0.6, arousal: 0.8 },
  fear:      { valence: -0.8, arousal: 0.6 },
  surprised: { valence: 0.3, arousal: 0.9 },
  excited:   { valence: 0.9, arousal: 0.9 },
  calm:      { valence: 0.3, arousal: -0.7 },
  anxious:   { valence: -0.4, arousal: 0.5 },
  tender:    { valence: 0.7, arousal: -0.3 },
  thinking:  { valence: 0.0, arousal: 0.2 },
};

/**
 * 语音情感分析器
 */
export class VoiceEmotionAnalyzer {
  private config: VoiceEmotionConfig;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Float32Array | null = null;
  private frequencyData: Uint8Array | null = null;
  
  private isRunning = false;
  private animationId: number | null = null;
  private lastAnalysisTime = 0;
  
  // 历史记录用于平滑
  private featureHistory: VoiceFeatures[] = [];
  private emotionHistory: VoiceEmotionResult[] = [];
  
  // 基线校准（用于个性化）
  private pitchBaseline: number | null = null;
  private volumeBaseline: number | null = null;
  private calibrationSamples: VoiceFeatures[] = [];
  private isCalibrating = false;
  
  // 回调
  private callbacks: Set<(result: VoiceEmotionResult) => void> = new Set();
  
  constructor(config: Partial<VoiceEmotionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 初始化音频分析器
   */
  async init(audioSource?: MediaStream | HTMLAudioElement): Promise<void> {
    if (typeof window === 'undefined') return;
    
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.config.fftSize;
    this.analyser.smoothingTimeConstant = this.config.smoothingFactor;
    
    this.dataArray = new Float32Array(this.analyser.fftSize);
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    
    if (audioSource) {
      this.connectSource(audioSource);
    }
  }
  
  /**
   * 连接音频源
   */
  connectSource(source: MediaStream | HTMLAudioElement): void {
    if (!this.audioContext || !this.analyser) {
      throw new Error('VoiceEmotionAnalyzer not initialized');
    }
    
    let sourceNode: AudioNode;
    if (source instanceof MediaStream) {
      sourceNode = this.audioContext.createMediaStreamSource(source);
    } else {
      sourceNode = this.audioContext.createMediaElementSource(source);
      sourceNode.connect(this.audioContext.destination);
    }
    
    sourceNode.connect(this.analyser);
  }
  
  /**
   * 开始分析
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.analyze();
  }
  
  /**
   * 停止分析
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  /**
   * 开始校准（收集个人基线）
   */
  startCalibration(): void {
    this.isCalibrating = true;
    this.calibrationSamples = [];
  }
  
  /**
   * 结束校准
   */
  endCalibration(): { pitchBaseline: number; volumeBaseline: number } {
    this.isCalibrating = false;
    
    if (this.calibrationSamples.length > 0) {
      const avgPitch = this.calibrationSamples.reduce((sum, f) => sum + f.pitch, 0) / this.calibrationSamples.length;
      const avgVolume = this.calibrationSamples.reduce((sum, f) => sum + f.volume, 0) / this.calibrationSamples.length;
      
      this.pitchBaseline = avgPitch;
      this.volumeBaseline = avgVolume;
    }
    
    return {
      pitchBaseline: this.pitchBaseline || 150,
      volumeBaseline: this.volumeBaseline || 0.3,
    };
  }
  
  /**
   * 订阅情绪变化
   */
  onEmotionChange(callback: (result: VoiceEmotionResult) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }
  
  /**
   * 获取最近的情绪结果
   */
  getLastResult(): VoiceEmotionResult | null {
    return this.emotionHistory[this.emotionHistory.length - 1] || null;
  }
  
  /**
   * 获取情绪趋势
   */
  getEmotionTrend(): { valence: 'positive' | 'negative' | 'stable'; arousal: 'increasing' | 'decreasing' | 'stable' } {
    if (this.emotionHistory.length < 3) {
      return { valence: 'stable', arousal: 'stable' };
    }
    
    const recent = this.emotionHistory.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    
    const valenceDiff = last.valence - first.valence;
    const arousalDiff = last.arousal - first.arousal;
    
    return {
      valence: valenceDiff > 0.1 ? 'positive' : valenceDiff < -0.1 ? 'negative' : 'stable',
      arousal: arousalDiff > 0.1 ? 'increasing' : arousalDiff < -0.1 ? 'decreasing' : 'stable',
    };
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    this.stop();
    this.callbacks.clear();
    this.featureHistory = [];
    this.emotionHistory = [];
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.dataArray = null;
    this.frequencyData = null;
  }
  
  // ==================== 私有方法 ====================
  
  private analyze = (): void => {
    if (!this.isRunning) return;
    
    const now = performance.now();
    const interval = 1000 / this.config.analysisRate;
    
    if (now - this.lastAnalysisTime >= interval) {
      this.lastAnalysisTime = now;
      
      const features = this.extractFeatures();
      if (features) {
        // 校准模式下收集样本
        if (this.isCalibrating) {
          this.calibrationSamples.push(features);
        }
        
        // 历史平滑
        const smoothedFeatures = this.smoothFeatures(features);
        
        // 分析情绪
        const result = this.analyzeEmotion(smoothedFeatures);
        
        // 保存历史
        this.emotionHistory.push(result);
        if (this.emotionHistory.length > this.config.historyWindowSize * 2) {
          this.emotionHistory.shift();
        }
        
        // 触发回调
        this.callbacks.forEach(cb => cb(result));
      }
    }
    
    this.animationId = requestAnimationFrame(this.analyze);
  };
  
  /**
   * 提取声学特征
   */
  private extractFeatures(): VoiceFeatures | null {
    if (!this.analyser || !this.dataArray || !this.frequencyData) {
      return null;
    }
    
    // 获取时域数据（用于音高检测）
    this.analyser.getFloatTimeDomainData(this.dataArray);
    
    // 获取频域数据
    this.analyser.getByteFrequencyData(this.frequencyData);
    
    // 计算音量（RMS）
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }
    const volume = Math.sqrt(sum / this.dataArray.length);
    
    // 检测是否静音
    if (volume < this.config.silenceThreshold) {
      return {
        pitch: 0,
        pitchVariance: 0,
        volume: 0,
        volumeVariance: 0,
        speechRate: 0,
        spectralFlux: 0,
        silenceRatio: 1,
        highFreqRatio: 0,
        lowFreqRatio: 0,
      };
    }
    
    // 音高检测（自相关法）
    const pitch = this.detectPitch(this.dataArray);
    
    // 频谱分析
    const { highFreqRatio, lowFreqRatio, spectralFlux } = this.analyzeSpectrum(this.frequencyData);
    
    // 估算语速（基于能量包络变化）
    const speechRate = this.estimateSpeechRate(this.dataArray);
    
    // 计算历史方差
    const pitchVariance = this.calculateVariance('pitch', pitch);
    const volumeVariance = this.calculateVariance('volume', volume);
    
    return {
      pitch,
      pitchVariance,
      volume,
      volumeVariance,
      speechRate,
      spectralFlux,
      silenceRatio: 0,
      highFreqRatio,
      lowFreqRatio,
    };
  }
  
  /**
   * 音高检测（自相关法）
   */
  private detectPitch(data: Float32Array): number {
    const sampleRate = this.audioContext?.sampleRate || 44100;
    const minPeriod = Math.floor(sampleRate / this.config.pitchRange.max);
    const maxPeriod = Math.floor(sampleRate / this.config.pitchRange.min);
    
    let bestCorrelation = 0;
    let bestPeriod = 0;
    
    for (let period = minPeriod; period < maxPeriod && period < data.length / 2; period++) {
      let correlation = 0;
      for (let i = 0; i < data.length - period; i++) {
        correlation += data[i] * data[i + period];
      }
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    if (bestPeriod === 0) return 0;
    return sampleRate / bestPeriod;
  }
  
  /**
   * 频谱分析
   */
  private analyzeSpectrum(freqData: Uint8Array): { highFreqRatio: number; lowFreqRatio: number; spectralFlux: number } {
    const binCount = freqData.length;
    const lowBins = Math.floor(binCount * 0.1);   // 0-10% 低频
    const highBins = Math.floor(binCount * 0.3);  // 70-100% 高频
    
    let totalEnergy = 0;
    let lowEnergy = 0;
    let highEnergy = 0;
    
    for (let i = 0; i < binCount; i++) {
      const energy = freqData[i] / 255;
      totalEnergy += energy;
      
      if (i < lowBins) {
        lowEnergy += energy;
      } else if (i >= binCount - highBins) {
        highEnergy += energy;
      }
    }
    
    const lowFreqRatio = totalEnergy > 0 ? lowEnergy / totalEnergy : 0;
    const highFreqRatio = totalEnergy > 0 ? highEnergy / totalEnergy : 0;
    
    // 频谱变化率（与上一帧比较）
    let spectralFlux = 0;
    if (this.featureHistory.length > 0) {
      const lastFeatures = this.featureHistory[this.featureHistory.length - 1];
      spectralFlux = Math.abs(highFreqRatio - lastFeatures.highFreqRatio) + 
                     Math.abs(lowFreqRatio - lastFeatures.lowFreqRatio);
    }
    
    return { highFreqRatio, lowFreqRatio, spectralFlux };
  }
  
  /**
   * 估算语速
   */
  private estimateSpeechRate(data: Float32Array): number {
    // 简化：基于能量包络的过零率估算
    let zeroCrossings = 0;
    for (let i = 1; i < data.length; i++) {
      if ((data[i] >= 0 && data[i - 1] < 0) || (data[i] < 0 && data[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    
    // 粗略映射到语速
    const sampleRate = this.audioContext?.sampleRate || 44100;
    const duration = data.length / sampleRate;
    const rate = zeroCrossings / duration;
    
    // 归一化到大约 2-8 syllables/second
    return Math.min(8, Math.max(0, rate / 500));
  }
  
  /**
   * 计算特征的历史方差
   */
  private calculateVariance(feature: keyof VoiceFeatures, currentValue: number): number {
    if (this.featureHistory.length < 3) return 0;
    
    const recent = this.featureHistory.slice(-10).map(f => f[feature] as number);
    recent.push(currentValue);
    
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / recent.length;
    
    return Math.sqrt(variance);
  }
  
  /**
   * 平滑特征
   */
  private smoothFeatures(features: VoiceFeatures): VoiceFeatures {
    this.featureHistory.push(features);
    if (this.featureHistory.length > this.config.historyWindowSize) {
      this.featureHistory.shift();
    }
    
    if (!this.config.enableHistorySmoothing || this.featureHistory.length < 2) {
      return features;
    }
    
    // 指数加权移动平均
    const alpha = 0.3;
    const prev = this.featureHistory[this.featureHistory.length - 2];
    
    return {
      pitch: alpha * features.pitch + (1 - alpha) * prev.pitch,
      pitchVariance: features.pitchVariance,
      volume: alpha * features.volume + (1 - alpha) * prev.volume,
      volumeVariance: features.volumeVariance,
      speechRate: alpha * features.speechRate + (1 - alpha) * prev.speechRate,
      spectralFlux: features.spectralFlux,
      silenceRatio: features.silenceRatio,
      highFreqRatio: alpha * features.highFreqRatio + (1 - alpha) * prev.highFreqRatio,
      lowFreqRatio: alpha * features.lowFreqRatio + (1 - alpha) * prev.lowFreqRatio,
    };
  }
  
  /**
   * 分析情绪
   */
  private analyzeEmotion(features: VoiceFeatures): VoiceEmotionResult {
    // 静音时返回中性
    if (features.silenceRatio > 0.8) {
      return this.createResult('neutral', 0.5, 0, features);
    }
    
    // 计算相对于基线的偏移
    const basePitch = this.pitchBaseline || 150;
    const baseVolume = this.volumeBaseline || 0.3;
    
    const pitchOffset = (features.pitch - basePitch) / basePitch;
    const volumeOffset = (features.volume - baseVolume) / baseVolume;
    
    // 映射到 Valence-Arousal 空间
    let arousal = 0;
    let valence = 0;
    
    // Arousal 主要由音量和语速决定
    arousal = Math.tanh(
      volumeOffset * 1.5 +           // 音量越大越激动
      features.speechRate * 0.1 +     // 语速越快越激动
      features.spectralFlux * 0.5     // 频谱变化越大越激动
    );
    
    // Valence 主要由音高和音色决定
    valence = Math.tanh(
      pitchOffset * 0.8 +             // 音高偏高倾向积极
      features.highFreqRatio * 0.5 -  // 高频多倾向积极
      features.lowFreqRatio * 0.3     // 低频多倾向消极
    );
    
    // 特殊模式检测
    // 1. 高音高 + 高方差 = 惊讶/兴奋
    if (features.pitchVariance > 30 && pitchOffset > 0.2) {
      arousal = Math.max(arousal, 0.7);
      valence = Math.max(valence, 0.3);
    }
    
    // 2. 低音量 + 慢语速 = 悲伤/疲惫
    if (features.volume < baseVolume * 0.5 && features.speechRate < 3) {
      arousal = Math.min(arousal, -0.3);
      valence = Math.min(valence, -0.2);
    }
    
    // 3. 高音量 + 低音高 + 快语速 = 愤怒
    if (features.volume > baseVolume * 1.5 && pitchOffset < 0 && features.speechRate > 5) {
      arousal = Math.max(arousal, 0.6);
      valence = Math.min(valence, -0.4);
    }
    
    // 4. 停顿较多 = 思考
    if (features.silenceRatio > 0.3 && features.speechRate < 2) {
      return this.createResult('thinking', 0.6, 0.3, features, 0, 0.2);
    }
    
    // 应用敏感度
    arousal *= this.config.sensitivity;
    valence *= this.config.sensitivity;
    
    // 从 VA 空间找最近的情绪
    const emotion = this.findClosestEmotion(valence, arousal);
    const distance = this.calculateVADistance(valence, arousal, emotion);
    const confidence = 1 - Math.min(1, distance);
    const intensity = Math.sqrt(valence * valence + arousal * arousal);
    
    return this.createResult(emotion, confidence, intensity, features, valence, arousal);
  }
  
  /**
   * 找到 VA 空间中最近的情绪
   */
  private findClosestEmotion(valence: number, arousal: number): VoiceEmotion {
    let closest: VoiceEmotion = 'neutral';
    let minDistance = Infinity;
    
    for (const [emotion, va] of Object.entries(EMOTION_VA_MAP)) {
      const distance = Math.sqrt(
        Math.pow(valence - va.valence, 2) + 
        Math.pow(arousal - va.arousal, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closest = emotion as VoiceEmotion;
      }
    }
    
    return closest;
  }
  
  /**
   * 计算 VA 距离
   */
  private calculateVADistance(valence: number, arousal: number, emotion: VoiceEmotion): number {
    const va = EMOTION_VA_MAP[emotion];
    return Math.sqrt(
      Math.pow(valence - va.valence, 2) + 
      Math.pow(arousal - va.arousal, 2)
    );
  }
  
  /**
   * 创建结果对象
   */
  private createResult(
    emotion: VoiceEmotion,
    confidence: number,
    intensity: number,
    features: VoiceFeatures,
    valence?: number,
    arousal?: number
  ): VoiceEmotionResult {
    const va = EMOTION_VA_MAP[emotion];
    
    // 计算次要情绪候选
    const secondary = this.findSecondaryEmotions(
      valence ?? va.valence, 
      arousal ?? va.arousal, 
      emotion
    );
    
    return {
      emotion,
      confidence: Math.min(1, Math.max(0, confidence)),
      intensity: Math.min(1, Math.max(0, intensity)),
      features,
      valence: valence ?? va.valence,
      arousal: arousal ?? va.arousal,
      secondary,
    };
  }
  
  /**
   * 找到次要情绪候选
   */
  private findSecondaryEmotions(
    valence: number,
    arousal: number,
    primary: VoiceEmotion
  ): { emotion: VoiceEmotion; confidence: number }[] {
    const candidates: { emotion: VoiceEmotion; confidence: number }[] = [];
    
    for (const [emotion, va] of Object.entries(EMOTION_VA_MAP)) {
      if (emotion === primary) continue;
      
      const distance = Math.sqrt(
        Math.pow(valence - va.valence, 2) + 
        Math.pow(arousal - va.arousal, 2)
      );
      
      if (distance < 0.8) {
        candidates.push({
          emotion: emotion as VoiceEmotion,
          confidence: 1 - distance,
        });
      }
    }
    
    return candidates
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 2);
  }
}

// ==================== 便捷函数 ====================

let globalVoiceEmotionAnalyzer: VoiceEmotionAnalyzer | null = null;

/**
 * 获取全局语音情感分析器
 */
export function getVoiceEmotionAnalyzer(): VoiceEmotionAnalyzer {
  if (!globalVoiceEmotionAnalyzer) {
    globalVoiceEmotionAnalyzer = new VoiceEmotionAnalyzer();
  }
  return globalVoiceEmotionAnalyzer;
}

/**
 * 从语音情绪映射到 Avatar 表情
 */
export function mapVoiceEmotionToExpression(voiceEmotion: VoiceEmotion): string {
  const mapping: Record<VoiceEmotion, string> = {
    neutral: 'neutral',
    happy: 'happy',
    sad: 'sad',
    angry: 'angry',
    fear: 'fear',
    surprised: 'surprised',
    excited: 'excited',
    calm: 'relaxed',
    anxious: 'anxious',
    tender: 'loving',
    thinking: 'thinking',
  };
  
  return mapping[voiceEmotion] || 'neutral';
}

/**
 * 获取情绪对应的表情强度
 */
export function getEmotionIntensityMultiplier(result: VoiceEmotionResult): number {
  // 基础强度
  let multiplier = result.intensity;
  
  // 高置信度时增强
  if (result.confidence > 0.7) {
    multiplier *= 1.2;
  }
  
  // 高 arousal 时增强
  if (Math.abs(result.arousal) > 0.5) {
    multiplier *= 1.1;
  }
  
  return Math.min(1.5, Math.max(0.5, multiplier));
}
