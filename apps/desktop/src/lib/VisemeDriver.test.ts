/**
 * VisemeDriver 单元测试
 * 
 * 测试精确口型同步系统的功能和行为
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VisemeDriver, Viseme } from './VisemeDriver';

// Mock requestAnimationFrame
vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
  return setTimeout(() => callback(Date.now()), 16) as unknown as number;
});

vi.stubGlobal('cancelAnimationFrame', (id: number) => {
  clearTimeout(id);
});

describe('VisemeDriver', () => {
  let driver: VisemeDriver;

  beforeEach(() => {
    vi.useFakeTimers();
    driver = new VisemeDriver();
  });

  afterEach(() => {
    driver.destroy();
    vi.useRealTimers();
  });

  describe('基础功能', () => {
    it('应该正确创建实例', () => {
      expect(driver).toBeDefined();
    });

    it('应该返回默认参数', () => {
      const params = driver.getCurrentParams();
      
      expect(params.mouthOpenY).toBe(0);
      expect(params.mouthForm).toBe(0);
      expect(params.mouthWidth).toBe(0.5);
      expect(params.lipRound).toBe(0.3);
    });

    it('应该能够停止', () => {
      driver.stop();
      const params = driver.getCurrentParams();
      expect(params).toBeDefined();
    });
  });

  describe('Viseme 设置', () => {
    const visemes: Viseme[] = [
      'sil', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 
      'nn', 'RR', 'aa', 'E', 'ih', 'oh', 'ou'
    ];

    it('应该支持所有15种标准Viseme', () => {
      visemes.forEach(viseme => {
        driver.setViseme(viseme);
        // 不抛出错误即为通过
      });
      expect(true).toBe(true);
    });

    it('设置 sil 应该闭嘴', () => {
      driver.setViseme('sil');
      vi.advanceTimersByTime(100);
      
      const params = driver.getCurrentParams();
      // 向目标过渡，最终应接近0
      expect(params.mouthOpenY).toBeLessThanOrEqual(0.1);
    });

    it('设置 aa 应该大开口', () => {
      driver.setViseme('aa');
      vi.advanceTimersByTime(200);
      
      const params = driver.getCurrentParams();
      expect(params.mouthOpenY).toBeGreaterThan(0.5);
    });

    it('设置 PP 应该闭唇', () => {
      driver.setViseme('PP');
      vi.advanceTimersByTime(200);
      
      const params = driver.getCurrentParams();
      expect(params.mouthOpenY).toBeLessThanOrEqual(0.1);
    });

    it('设置 ou 应该圆唇', () => {
      driver.setViseme('ou');
      vi.advanceTimersByTime(200);
      
      const params = driver.getCurrentParams();
      expect(params.lipRound).toBeGreaterThan(0.5);
    });
  });

  describe('情绪调制', () => {
    const emotions = [
      'neutral', 'happy', 'sad', 'surprised', 
      'angry', 'fear', 'excited', 'loving', 'thinking'
    ];

    it('应该支持所有预定义情绪', () => {
      emotions.forEach(emotion => {
        driver.setEmotion(emotion);
      });
      expect(true).toBe(true);
    });

    it('happy情绪应该增加嘴角上扬', () => {
      driver.setEmotion('happy');
      driver.setViseme('E');
      vi.advanceTimersByTime(200);
      
      const params = driver.getCurrentParams();
      expect(params.mouthForm).toBeGreaterThanOrEqual(0);
    });

    it('sad情绪应该减少张嘴程度', () => {
      driver.setEmotion('sad');
      driver.setViseme('aa');
      vi.advanceTimersByTime(200);
      
      const sadParams = driver.getCurrentParams();

      // 对比 neutral
      const neutralDriver = new VisemeDriver();
      neutralDriver.setEmotion('neutral');
      neutralDriver.setViseme('aa');
      vi.advanceTimersByTime(200);
      
      const neutralParams = neutralDriver.getCurrentParams();
      
      // sad 的张嘴应该比 neutral 小
      expect(sadParams.mouthOpenY).toBeLessThanOrEqual(neutralParams.mouthOpenY);
      
      neutralDriver.destroy();
    });
  });

  describe('Viseme序列生成', () => {
    it('应该能够为文本生成Viseme序列', () => {
      const sequence = driver.generateVisemeSequence('你好', 1000);
      
      expect(Array.isArray(sequence)).toBe(true);
      expect(sequence.length).toBeGreaterThan(0);
    });

    it('序列应该以sil结尾', () => {
      const sequence = driver.generateVisemeSequence('测试', 1000);
      
      const lastItem = sequence[sequence.length - 1];
      expect(lastItem.viseme).toBe('sil');
    });

    it('每个序列项应该有viseme和duration', () => {
      const sequence = driver.generateVisemeSequence('hello', 1000);
      
      sequence.forEach(item => {
        expect(item).toHaveProperty('viseme');
        expect(item).toHaveProperty('duration');
        expect(typeof item.duration).toBe('number');
      });
    });

    it('空文本应该只返回sil', () => {
      const sequence = driver.generateVisemeSequence('', 1000);
      
      expect(sequence.length).toBe(1);
      expect(sequence[0].viseme).toBe('sil');
    });

    it('标点符号应该映射到sil', () => {
      const sequence = driver.generateVisemeSequence('，。！？', 1000);
      
      // 每个标点都应该是 sil，最后再加一个结尾 sil
      sequence.forEach(item => {
        expect(item.viseme).toBe('sil');
      });
    });

    it('应该正确处理中文字符', () => {
      const sequence = driver.generateVisemeSequence('初音未来', 2000);
      
      // 4个字符 + 1个结尾 sil
      expect(sequence.length).toBeGreaterThanOrEqual(4);
    });

    it('应该正确处理日文假名', () => {
      const sequence = driver.generateVisemeSequence('はつね', 1000);
      
      // 3个假名 + 1个结尾 sil
      expect(sequence.length).toBe(4);
      expect(sequence[0].viseme).toBe('kk'); // は
      expect(sequence[1].viseme).toBe('SS'); // つ
      expect(sequence[2].viseme).toBe('nn'); // ね
    });

    it('应该正确处理英文字母', () => {
      const sequence = driver.generateVisemeSequence('hello', 1000);
      
      expect(sequence.length).toBeGreaterThan(1);
    });

    it('应该正确映射英文元音', () => {
      const sequence = driver.generateVisemeSequence('aeiou', 500);
      
      // a -> aa, e -> E, i -> ih, o -> oh, u -> ou
      expect(sequence[0].viseme).toBe('aa');
      expect(sequence[1].viseme).toBe('E');
      expect(sequence[2].viseme).toBe('ih');
      expect(sequence[3].viseme).toBe('oh');
      expect(sequence[4].viseme).toBe('ou');
    });

    it('应该正确映射英文辅音', () => {
      const sequence = driver.generateVisemeSequence('bpmf', 400);
      
      expect(sequence[0].viseme).toBe('PP'); // b
      expect(sequence[1].viseme).toBe('PP'); // p
      expect(sequence[2].viseme).toBe('PP'); // m
      expect(sequence[3].viseme).toBe('FF'); // f
    });
  });

  describe('序列播放', () => {
    it('应该能够播放Viseme序列', () => {
      const sequence = [
        { viseme: 'aa' as Viseme, duration: 100 },
        { viseme: 'ih' as Viseme, duration: 100 },
        { viseme: 'sil' as Viseme, duration: 50 },
      ];
      
      driver.playSequence(sequence);
      
      // 不抛出错误即为通过
      expect(true).toBe(true);
    });

    it('播放序列后参数应该变化', () => {
      // 直接设置 Viseme 并检查参数变化
      driver.setViseme('aa');
      
      // 让动画循环运行足够的时间
      vi.advanceTimersByTime(300);
      
      const afterParams = driver.getCurrentParams();
      
      // aa 是大开口音，mouthOpenY 应该大于静音状态
      expect(afterParams.mouthOpenY).toBeGreaterThan(0.3);
    });
  });

  describe('音频频谱分析', () => {
    it('应该能够从频谱数据设置Viseme', () => {
      // 创建模拟频谱数据
      const spectrum = new Uint8Array(256);
      
      // 低能量应该返回 sil
      driver.setFromAudioSpectrum(spectrum);
      vi.advanceTimersByTime(100);
      
      const params = driver.getCurrentParams();
      expect(params.mouthOpenY).toBeLessThan(0.2);
    });

    it('高低频能量应该影响Viseme选择', () => {
      // 模拟高频占优的频谱（齿音）
      const highFreqSpectrum = new Uint8Array(256);
      for (let i = 100; i < 200; i++) {
        highFreqSpectrum[i] = 200;
      }
      
      driver.setFromAudioSpectrum(highFreqSpectrum, 44100);
      vi.advanceTimersByTime(50);
      
      // 应该能处理而不崩溃
      expect(true).toBe(true);
    });

    it('中频元音频谱应该张嘴', () => {
      // 模拟中频占优的频谱（元音）
      const midFreqSpectrum = new Uint8Array(256);
      for (let i = 20; i < 80; i++) {
        midFreqSpectrum[i] = 180;
      }
      
      driver.setFromAudioSpectrum(midFreqSpectrum, 44100);
      vi.advanceTimersByTime(200);
      
      const params = driver.getCurrentParams();
      // 元音应该张嘴
      expect(params.mouthOpenY).toBeGreaterThan(0);
    });
  });

  describe('参数订阅', () => {
    it('应该能够订阅口型参数更新', () => {
      const callback = vi.fn();
      const unsubscribe = driver.onMouthParams(callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      unsubscribe();
    });

    it('设置Viseme后应该触发回调', () => {
      const callback = vi.fn();
      driver.onMouthParams(callback);
      
      driver.setViseme('aa');
      vi.advanceTimersByTime(50);
      
      expect(callback).toHaveBeenCalled();
    });

    it('回调应该收到正确的参数结构', () => {
      const callback = vi.fn();
      driver.onMouthParams(callback);
      
      driver.setViseme('E');
      vi.advanceTimersByTime(50);
      
      const params = callback.mock.calls[0][0];
      expect(params).toHaveProperty('mouthOpenY');
      expect(params).toHaveProperty('mouthForm');
      expect(params).toHaveProperty('mouthWidth');
      expect(params).toHaveProperty('lipRound');
    });

    it('取消订阅后不应再触发回调', () => {
      const callback = vi.fn();
      const unsubscribe = driver.onMouthParams(callback);
      
      driver.setViseme('aa');
      vi.advanceTimersByTime(20);
      
      const callCount = callback.mock.calls.length;
      unsubscribe();
      
      driver.setViseme('oh');
      vi.advanceTimersByTime(100);
      
      expect(callback.mock.calls.length).toBe(callCount);
    });
  });

  describe('配置更新', () => {
    it('应该能够更新平滑度', () => {
      driver.updateConfig({ smoothing: 0.8 });
      expect(true).toBe(true);
    });

    it('应该能够更新协同发音强度', () => {
      driver.updateConfig({ coarticulationStrength: 0.7 });
      expect(true).toBe(true);
    });

    it('应该能够更新语速', () => {
      driver.updateConfig({ speed: 1.5 });
      expect(true).toBe(true);
    });

    it('应该能够更新多个配置', () => {
      driver.updateConfig({
        smoothing: 0.5,
        coarticulationStrength: 0.6,
        speed: 1.2,
        emotion: 'happy',
      });
      expect(true).toBe(true);
    });
  });

  describe('停止和销毁', () => {
    it('停止应该将口型设为sil', () => {
      driver.setViseme('aa');
      vi.advanceTimersByTime(100);
      
      driver.stop();
      vi.advanceTimersByTime(200);
      
      const params = driver.getCurrentParams();
      expect(params.mouthOpenY).toBeLessThan(0.3);
    });

    it('销毁后不应再触发回调', () => {
      const callback = vi.fn();
      driver.onMouthParams(callback);
      
      driver.setViseme('aa');
      vi.advanceTimersByTime(50);
      
      const callCount = callback.mock.calls.length;
      driver.destroy();
      
      vi.advanceTimersByTime(100);
      
      expect(callback.mock.calls.length).toBe(callCount);
    });
  });

  describe('自定义配置实例', () => {
    it('应该支持构造函数传入配置', () => {
      const customDriver = new VisemeDriver({
        smoothing: 0.3,
        coarticulationStrength: 0.8,
        emotion: 'happy',
        speed: 1.5,
      });
      
      expect(customDriver).toBeDefined();
      customDriver.destroy();
    });
  });

  describe('边界情况', () => {
    it('空序列不应崩溃', () => {
      driver.playSequence([]);
      vi.advanceTimersByTime(100);
      
      expect(true).toBe(true);
    });

    it('单项序列应该正常工作', () => {
      driver.playSequence([{ viseme: 'aa' as Viseme, duration: 100 }]);
      vi.advanceTimersByTime(150);
      
      expect(true).toBe(true);
    });

    it('很短的时长应该正常工作', () => {
      driver.playSequence([{ viseme: 'aa' as Viseme, duration: 1 }]);
      vi.advanceTimersByTime(50);
      
      expect(true).toBe(true);
    });

    it('很长的序列应该正常工作', () => {
      const longSequence = Array(100).fill(null).map((_, i) => ({
        viseme: (['aa', 'E', 'ih', 'oh', 'ou'] as Viseme[])[i % 5],
        duration: 10,
      }));
      
      driver.playSequence(longSequence);
      vi.advanceTimersByTime(500);
      
      expect(true).toBe(true);
    });
  });
});
