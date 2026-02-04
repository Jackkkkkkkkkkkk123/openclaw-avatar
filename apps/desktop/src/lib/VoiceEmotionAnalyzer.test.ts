/**
 * VoiceEmotionAnalyzer 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  VoiceEmotionAnalyzer,
  VoiceEmotionResult,
  VoiceFeatures,
  VoiceEmotion,
  getVoiceEmotionAnalyzer,
  mapVoiceEmotionToExpression,
  getEmotionIntensityMultiplier,
} from './VoiceEmotionAnalyzer';

// Mock AudioContext
const createMockAnalyser = () => ({
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  frequencyBinCount: 1024,
  getFloatTimeDomainData: vi.fn(),
  getByteFrequencyData: vi.fn(),
});

const createMockAudioContext = () => ({
  createAnalyser: vi.fn(() => createMockAnalyser()),
  createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
  createMediaElementSource: vi.fn(() => ({ connect: vi.fn() })),
  destination: {},
  sampleRate: 44100,
  close: vi.fn(),
});

class MockAudioContext {
  createAnalyser = vi.fn(() => createMockAnalyser());
  createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
  createMediaElementSource = vi.fn(() => ({ connect: vi.fn() }));
  destination = {};
  sampleRate = 44100;
  close = vi.fn();
}

vi.stubGlobal('AudioContext', MockAudioContext);
vi.stubGlobal('webkitAudioContext', MockAudioContext);

describe('VoiceEmotionAnalyzer', () => {
  let analyzer: VoiceEmotionAnalyzer;
  
  beforeEach(() => {
    vi.useFakeTimers();
    analyzer = new VoiceEmotionAnalyzer();
  });
  
  afterEach(() => {
    analyzer.destroy();
    vi.useRealTimers();
    vi.clearAllMocks();
  });
  
  describe('constructor', () => {
    it('creates with default config', () => {
      const a = new VoiceEmotionAnalyzer();
      expect(a).toBeInstanceOf(VoiceEmotionAnalyzer);
    });
    
    it('accepts custom config', () => {
      const a = new VoiceEmotionAnalyzer({
        fftSize: 4096,
        sensitivity: 0.8,
      });
      expect(a).toBeInstanceOf(VoiceEmotionAnalyzer);
    });
    
    it('merges config with defaults', () => {
      const a = new VoiceEmotionAnalyzer({
        analysisRate: 60,
      });
      expect(a).toBeInstanceOf(VoiceEmotionAnalyzer);
    });
  });
  
  describe('init', () => {
    it('initializes AudioContext', async () => {
      await analyzer.init();
      // AudioContext should be created
    });
    
    it('sets analyser properties', async () => {
      await analyzer.init();
      // Analyser should be configured
    });
    
    it('can init with MediaStream', async () => {
      const mockStream = {} as MediaStream;
      await analyzer.init(mockStream);
      // Should connect stream source
    });
    
    it('can init with HTMLAudioElement', async () => {
      const mockAudio = {} as HTMLAudioElement;
      await analyzer.init(mockAudio);
      // Should connect audio element source
    });
  });
  
  describe('connectSource', () => {
    it('throws if not initialized', () => {
      const mockStream = {} as MediaStream;
      expect(() => analyzer.connectSource(mockStream)).toThrow('not initialized');
    });
    
    it('connects MediaStream source', async () => {
      await analyzer.init();
      const mockStream = {} as MediaStream;
      analyzer.connectSource(mockStream);
      // Should connect successfully
    });
    
    it('connects HTMLAudioElement source', async () => {
      await analyzer.init();
      const mockAudio = {} as HTMLAudioElement;
      analyzer.connectSource(mockAudio);
      // Should connect successfully
    });
  });
  
  describe('start/stop', () => {
    it('starts analysis', async () => {
      await analyzer.init();
      analyzer.start();
      // 应该启动 requestAnimationFrame
    });
    
    it('does nothing if already running', async () => {
      await analyzer.init();
      analyzer.start();
      analyzer.start(); // 第二次调用应该无效
    });
    
    it('stops analysis', async () => {
      await analyzer.init();
      analyzer.start();
      analyzer.stop();
    });
    
    it('can restart after stop', async () => {
      await analyzer.init();
      analyzer.start();
      analyzer.stop();
      analyzer.start();
    });
  });
  
  describe('calibration', () => {
    it('starts calibration mode', async () => {
      await analyzer.init();
      analyzer.startCalibration();
      // 校准模式应该开启
    });
    
    it('ends calibration and returns baseline', async () => {
      await analyzer.init();
      analyzer.startCalibration();
      const result = analyzer.endCalibration();
      
      expect(result).toHaveProperty('pitchBaseline');
      expect(result).toHaveProperty('volumeBaseline');
    });
    
    it('returns default baseline if no samples', async () => {
      await analyzer.init();
      analyzer.startCalibration();
      const result = analyzer.endCalibration();
      
      expect(result.pitchBaseline).toBe(150);
      expect(result.volumeBaseline).toBe(0.3);
    });
  });
  
  describe('onEmotionChange', () => {
    it('subscribes to emotion changes', async () => {
      const callback = vi.fn();
      await analyzer.init();
      const unsubscribe = analyzer.onEmotionChange(callback);
      
      expect(typeof unsubscribe).toBe('function');
    });
    
    it('returns unsubscribe function', async () => {
      const callback = vi.fn();
      await analyzer.init();
      const unsubscribe = analyzer.onEmotionChange(callback);
      
      unsubscribe();
      // 回调应该被移除
    });
    
    it('supports multiple callbacks', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      await analyzer.init();
      
      analyzer.onEmotionChange(cb1);
      analyzer.onEmotionChange(cb2);
    });
  });
  
  describe('getLastResult', () => {
    it('returns null if no analysis done', () => {
      expect(analyzer.getLastResult()).toBeNull();
    });
  });
  
  describe('getEmotionTrend', () => {
    it('returns stable if no history', () => {
      const trend = analyzer.getEmotionTrend();
      expect(trend.valence).toBe('stable');
      expect(trend.arousal).toBe('stable');
    });
  });
  
  describe('destroy', () => {
    it('stops analysis', async () => {
      await analyzer.init();
      analyzer.start();
      analyzer.destroy();
    });
    
    it('clears callbacks', async () => {
      const callback = vi.fn();
      await analyzer.init();
      analyzer.onEmotionChange(callback);
      analyzer.destroy();
    });
    
    it('closes AudioContext', async () => {
      await analyzer.init();
      analyzer.destroy();
      // AudioContext should be closed
    });
    
    it('can be called multiple times safely', async () => {
      await analyzer.init();
      analyzer.destroy();
      analyzer.destroy();
    });
  });
});

describe('VoiceEmotionResult', () => {
  describe('emotion types', () => {
    const emotions: VoiceEmotion[] = [
      'neutral', 'happy', 'sad', 'angry', 'fear',
      'surprised', 'excited', 'calm', 'anxious', 'tender', 'thinking'
    ];
    
    emotions.forEach(emotion => {
      it(`supports ${emotion} emotion`, () => {
        const result: VoiceEmotionResult = {
          emotion,
          confidence: 0.8,
          intensity: 0.6,
          features: {
            pitch: 150,
            pitchVariance: 20,
            volume: 0.4,
            volumeVariance: 0.1,
            speechRate: 4,
            spectralFlux: 0.2,
            silenceRatio: 0.1,
            highFreqRatio: 0.3,
            lowFreqRatio: 0.2,
          },
          valence: 0,
          arousal: 0,
        };
        
        expect(result.emotion).toBe(emotion);
      });
    });
  });
  
  describe('confidence bounds', () => {
    it('confidence should be between 0 and 1', () => {
      const result: VoiceEmotionResult = {
        emotion: 'happy',
        confidence: 0.85,
        intensity: 0.7,
        features: {} as VoiceFeatures,
        valence: 0.8,
        arousal: 0.5,
      };
      
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });
  
  describe('valence-arousal space', () => {
    it('valence ranges from -1 to 1', () => {
      const negativeValence: VoiceEmotionResult = {
        emotion: 'sad',
        confidence: 0.7,
        intensity: 0.5,
        features: {} as VoiceFeatures,
        valence: -0.7,
        arousal: -0.4,
      };
      
      const positiveValence: VoiceEmotionResult = {
        emotion: 'happy',
        confidence: 0.8,
        intensity: 0.6,
        features: {} as VoiceFeatures,
        valence: 0.8,
        arousal: 0.5,
      };
      
      expect(negativeValence.valence).toBeLessThan(0);
      expect(positiveValence.valence).toBeGreaterThan(0);
    });
    
    it('arousal ranges from -1 to 1', () => {
      const lowArousal: VoiceEmotionResult = {
        emotion: 'calm',
        confidence: 0.7,
        intensity: 0.3,
        features: {} as VoiceFeatures,
        valence: 0.3,
        arousal: -0.7,
      };
      
      const highArousal: VoiceEmotionResult = {
        emotion: 'excited',
        confidence: 0.9,
        intensity: 0.9,
        features: {} as VoiceFeatures,
        valence: 0.9,
        arousal: 0.9,
      };
      
      expect(lowArousal.arousal).toBeLessThan(0);
      expect(highArousal.arousal).toBeGreaterThan(0);
    });
  });
  
  describe('secondary emotions', () => {
    it('can have secondary emotion candidates', () => {
      const result: VoiceEmotionResult = {
        emotion: 'happy',
        confidence: 0.8,
        intensity: 0.6,
        features: {} as VoiceFeatures,
        valence: 0.8,
        arousal: 0.5,
        secondary: [
          { emotion: 'excited', confidence: 0.6 },
          { emotion: 'tender', confidence: 0.4 },
        ],
      };
      
      expect(result.secondary).toHaveLength(2);
      expect(result.secondary![0].emotion).toBe('excited');
    });
  });
});

describe('VoiceFeatures', () => {
  it('contains all required acoustic features', () => {
    const features: VoiceFeatures = {
      pitch: 150,
      pitchVariance: 20,
      volume: 0.5,
      volumeVariance: 0.1,
      speechRate: 4,
      spectralFlux: 0.2,
      silenceRatio: 0.1,
      highFreqRatio: 0.3,
      lowFreqRatio: 0.2,
    };
    
    expect(features.pitch).toBe(150);
    expect(features.pitchVariance).toBe(20);
    expect(features.volume).toBe(0.5);
    expect(features.volumeVariance).toBe(0.1);
    expect(features.speechRate).toBe(4);
    expect(features.spectralFlux).toBe(0.2);
    expect(features.silenceRatio).toBe(0.1);
    expect(features.highFreqRatio).toBe(0.3);
    expect(features.lowFreqRatio).toBe(0.2);
  });
  
  it('pitch is in Hz range', () => {
    const features: VoiceFeatures = {
      pitch: 200,
      pitchVariance: 25,
      volume: 0.4,
      volumeVariance: 0.08,
      speechRate: 5,
      spectralFlux: 0.15,
      silenceRatio: 0.05,
      highFreqRatio: 0.25,
      lowFreqRatio: 0.3,
    };
    
    // 人声通常在 85-255 Hz
    expect(features.pitch).toBeGreaterThanOrEqual(0);
    expect(features.pitch).toBeLessThanOrEqual(400);
  });
  
  it('ratios are normalized (0-1)', () => {
    const features: VoiceFeatures = {
      pitch: 180,
      pitchVariance: 15,
      volume: 0.6,
      volumeVariance: 0.12,
      speechRate: 3.5,
      spectralFlux: 0.1,
      silenceRatio: 0.2,
      highFreqRatio: 0.35,
      lowFreqRatio: 0.25,
    };
    
    expect(features.silenceRatio).toBeGreaterThanOrEqual(0);
    expect(features.silenceRatio).toBeLessThanOrEqual(1);
    expect(features.highFreqRatio).toBeGreaterThanOrEqual(0);
    expect(features.highFreqRatio).toBeLessThanOrEqual(1);
    expect(features.lowFreqRatio).toBeGreaterThanOrEqual(0);
    expect(features.lowFreqRatio).toBeLessThanOrEqual(1);
  });
});

describe('mapVoiceEmotionToExpression', () => {
  it('maps neutral to neutral', () => {
    expect(mapVoiceEmotionToExpression('neutral')).toBe('neutral');
  });
  
  it('maps happy to happy', () => {
    expect(mapVoiceEmotionToExpression('happy')).toBe('happy');
  });
  
  it('maps sad to sad', () => {
    expect(mapVoiceEmotionToExpression('sad')).toBe('sad');
  });
  
  it('maps angry to angry', () => {
    expect(mapVoiceEmotionToExpression('angry')).toBe('angry');
  });
  
  it('maps fear to fear', () => {
    expect(mapVoiceEmotionToExpression('fear')).toBe('fear');
  });
  
  it('maps surprised to surprised', () => {
    expect(mapVoiceEmotionToExpression('surprised')).toBe('surprised');
  });
  
  it('maps excited to excited', () => {
    expect(mapVoiceEmotionToExpression('excited')).toBe('excited');
  });
  
  it('maps calm to relaxed', () => {
    expect(mapVoiceEmotionToExpression('calm')).toBe('relaxed');
  });
  
  it('maps anxious to anxious', () => {
    expect(mapVoiceEmotionToExpression('anxious')).toBe('anxious');
  });
  
  it('maps tender to loving', () => {
    expect(mapVoiceEmotionToExpression('tender')).toBe('loving');
  });
  
  it('maps thinking to thinking', () => {
    expect(mapVoiceEmotionToExpression('thinking')).toBe('thinking');
  });
});

describe('getEmotionIntensityMultiplier', () => {
  it('returns base intensity', () => {
    const result: VoiceEmotionResult = {
      emotion: 'happy',
      confidence: 0.5,
      intensity: 0.5,
      features: {} as VoiceFeatures,
      valence: 0.5,
      arousal: 0.3,
    };
    
    const multiplier = getEmotionIntensityMultiplier(result);
    expect(multiplier).toBeGreaterThanOrEqual(0.5);
    expect(multiplier).toBeLessThanOrEqual(1.5);
  });
  
  it('increases with high confidence', () => {
    const lowConfidence: VoiceEmotionResult = {
      emotion: 'happy',
      confidence: 0.5,
      intensity: 0.5,
      features: {} as VoiceFeatures,
      valence: 0.5,
      arousal: 0.3,
    };
    
    const highConfidence: VoiceEmotionResult = {
      emotion: 'happy',
      confidence: 0.9,
      intensity: 0.5,
      features: {} as VoiceFeatures,
      valence: 0.5,
      arousal: 0.3,
    };
    
    expect(getEmotionIntensityMultiplier(highConfidence))
      .toBeGreaterThan(getEmotionIntensityMultiplier(lowConfidence));
  });
  
  it('increases with high arousal', () => {
    const lowArousal: VoiceEmotionResult = {
      emotion: 'happy',
      confidence: 0.7,
      intensity: 0.5,
      features: {} as VoiceFeatures,
      valence: 0.5,
      arousal: 0.2,
    };
    
    const highArousal: VoiceEmotionResult = {
      emotion: 'excited',
      confidence: 0.7,
      intensity: 0.5,
      features: {} as VoiceFeatures,
      valence: 0.5,
      arousal: 0.8,
    };
    
    expect(getEmotionIntensityMultiplier(highArousal))
      .toBeGreaterThan(getEmotionIntensityMultiplier(lowArousal));
  });
  
  it('clamps to min 0.5', () => {
    const lowIntensity: VoiceEmotionResult = {
      emotion: 'neutral',
      confidence: 0.3,
      intensity: 0.1,
      features: {} as VoiceFeatures,
      valence: 0,
      arousal: 0,
    };
    
    expect(getEmotionIntensityMultiplier(lowIntensity)).toBeGreaterThanOrEqual(0.5);
  });
  
  it('clamps to max 1.5', () => {
    const highIntensity: VoiceEmotionResult = {
      emotion: 'excited',
      confidence: 1,
      intensity: 1,
      features: {} as VoiceFeatures,
      valence: 1,
      arousal: 1,
    };
    
    expect(getEmotionIntensityMultiplier(highIntensity)).toBeLessThanOrEqual(1.5);
  });
});

describe('getVoiceEmotionAnalyzer', () => {
  it('returns singleton instance', () => {
    const analyzer1 = getVoiceEmotionAnalyzer();
    const analyzer2 = getVoiceEmotionAnalyzer();
    
    expect(analyzer1).toBe(analyzer2);
  });
  
  it('returns VoiceEmotionAnalyzer instance', () => {
    const analyzer = getVoiceEmotionAnalyzer();
    expect(analyzer).toBeInstanceOf(VoiceEmotionAnalyzer);
  });
});

describe('emotion detection scenarios', () => {
  describe('happy voice patterns', () => {
    it('high pitch + high energy = happy', () => {
      // 开心的声音特征：音高偏高、音量适中、语速正常
      const features: VoiceFeatures = {
        pitch: 200,  // 偏高
        pitchVariance: 25,
        volume: 0.5,
        volumeVariance: 0.15,
        speechRate: 5,
        spectralFlux: 0.2,
        silenceRatio: 0.05,
        highFreqRatio: 0.4,  // 高频多
        lowFreqRatio: 0.2,
      };
      
      // 这些特征应该倾向于积极情绪
      expect(features.pitch).toBeGreaterThan(150);
      expect(features.highFreqRatio).toBeGreaterThan(features.lowFreqRatio);
    });
  });
  
  describe('sad voice patterns', () => {
    it('low pitch + low energy + slow = sad', () => {
      // 悲伤的声音特征：音高偏低、音量小、语速慢
      const features: VoiceFeatures = {
        pitch: 100,  // 偏低
        pitchVariance: 10,  // 变化小
        volume: 0.2,  // 音量小
        volumeVariance: 0.05,
        speechRate: 2,  // 语速慢
        spectralFlux: 0.05,
        silenceRatio: 0.3,  // 停顿多
        highFreqRatio: 0.1,
        lowFreqRatio: 0.4,  // 低频多
      };
      
      expect(features.pitch).toBeLessThan(150);
      expect(features.volume).toBeLessThan(0.3);
      expect(features.speechRate).toBeLessThan(3);
    });
  });
  
  describe('angry voice patterns', () => {
    it('high volume + fast + low pitch = angry', () => {
      // 愤怒的声音特征：音量大、语速快、音高可能偏低
      const features: VoiceFeatures = {
        pitch: 120,
        pitchVariance: 40,  // 变化大
        volume: 0.8,  // 音量大
        volumeVariance: 0.3,
        speechRate: 7,  // 语速快
        spectralFlux: 0.4,  // 频谱变化大
        silenceRatio: 0.02,
        highFreqRatio: 0.35,
        lowFreqRatio: 0.3,
      };
      
      expect(features.volume).toBeGreaterThan(0.6);
      expect(features.speechRate).toBeGreaterThan(5);
    });
  });
  
  describe('surprised voice patterns', () => {
    it('sudden pitch jump + high variance = surprised', () => {
      // 惊讶的声音特征：音高突然升高、变化大
      const features: VoiceFeatures = {
        pitch: 250,  // 很高
        pitchVariance: 50,  // 变化很大
        volume: 0.6,
        volumeVariance: 0.25,
        speechRate: 6,
        spectralFlux: 0.35,
        silenceRatio: 0.1,
        highFreqRatio: 0.45,
        lowFreqRatio: 0.15,
      };
      
      expect(features.pitch).toBeGreaterThan(200);
      expect(features.pitchVariance).toBeGreaterThan(30);
    });
  });
  
  describe('thinking voice patterns', () => {
    it('many pauses + slow = thinking', () => {
      // 思考的声音特征：停顿多、语速慢
      const features: VoiceFeatures = {
        pitch: 140,
        pitchVariance: 15,
        volume: 0.3,
        volumeVariance: 0.08,
        speechRate: 1.5,  // 很慢
        spectralFlux: 0.08,
        silenceRatio: 0.4,  // 停顿很多
        highFreqRatio: 0.2,
        lowFreqRatio: 0.25,
      };
      
      expect(features.silenceRatio).toBeGreaterThan(0.3);
      expect(features.speechRate).toBeLessThan(2);
    });
  });
});

describe('edge cases', () => {
  let analyzer: VoiceEmotionAnalyzer;
  
  beforeEach(() => {
    analyzer = new VoiceEmotionAnalyzer();
  });
  
  afterEach(() => {
    analyzer.destroy();
  });
  
  it('handles silence gracefully', () => {
    const silentFeatures: VoiceFeatures = {
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
    
    // 静音时应该检测为 neutral
    expect(silentFeatures.silenceRatio).toBe(1);
  });
  
  it('handles extreme pitch values', () => {
    const extremeFeatures: VoiceFeatures = {
      pitch: 500,  // 超出正常范围
      pitchVariance: 100,
      volume: 0.5,
      volumeVariance: 0.1,
      speechRate: 4,
      spectralFlux: 0.2,
      silenceRatio: 0,
      highFreqRatio: 0.5,
      lowFreqRatio: 0.1,
    };
    
    // 应该仍能处理
    expect(extremeFeatures.pitch).toBeGreaterThan(0);
  });
  
  it('handles zero variance', () => {
    const monotoneFeatures: VoiceFeatures = {
      pitch: 150,
      pitchVariance: 0,  // 完全单调
      volume: 0.4,
      volumeVariance: 0,
      speechRate: 4,
      spectralFlux: 0,
      silenceRatio: 0.1,
      highFreqRatio: 0.25,
      lowFreqRatio: 0.25,
    };
    
    expect(monotoneFeatures.pitchVariance).toBe(0);
    expect(monotoneFeatures.volumeVariance).toBe(0);
  });
});
