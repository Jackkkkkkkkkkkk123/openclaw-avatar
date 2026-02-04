/**
 * Viseme Driver - SOTA 精确口型同步系统
 * 
 * Phase 10: 基于音素 (Viseme) 的口型同步，而非简单音量
 * 
 * 支持:
 * - 15 种标准 Viseme 口型
 * - 音频频谱分析映射
 * - 协同发音 (Coarticulation) - 口型之间平滑过渡
 * - 情绪调制 - 不同情绪下口型表现不同
 */

export type Viseme = 
  | 'sil'      // 静音 (闭嘴)
  | 'PP'       // p, b, m - 双唇闭合
  | 'FF'       // f, v - 上齿咬下唇
  | 'TH'       // th - 舌尖露出
  | 'DD'       // t, d, n, l - 舌尖顶上齿
  | 'kk'       // k, g - 舌根音
  | 'CH'       // ch, j, sh, zh - 擦音
  | 'SS'       // s, z - 齿音
  | 'nn'       // n, ng - 鼻音
  | 'RR'       // r - 卷舌
  | 'aa'       // a, ah - 大开口
  | 'E'        // e, eh - 中开口
  | 'ih'       // i, ee - 扁嘴
  | 'oh'       // o - 圆唇
  | 'ou';      // u, oo - 小圆唇

// Viseme 对应的口型参数
interface VisemeParams {
  mouthOpenY: number;      // 嘴巴张开程度 0-1
  mouthForm: number;       // 嘴型 -1(撇嘴) to 1(微笑)
  mouthWidth: number;      // 嘴巴宽度 0-1
  lipRound: number;        // 嘴唇圆润度 0-1
  tongueOut?: number;      // 舌头伸出 0-1 (TH, RR)
  teethShow?: number;      // 露齿程度 0-1
}

// 每种 Viseme 的口型参数
const VISEME_PARAMS: Record<Viseme, VisemeParams> = {
  sil:  { mouthOpenY: 0,    mouthForm: 0,    mouthWidth: 0.5, lipRound: 0.3 },
  PP:   { mouthOpenY: 0,    mouthForm: 0,    mouthWidth: 0.4, lipRound: 0.5 },
  FF:   { mouthOpenY: 0.15, mouthForm: 0,    mouthWidth: 0.5, lipRound: 0,   teethShow: 0.3 },
  TH:   { mouthOpenY: 0.2,  mouthForm: 0,    mouthWidth: 0.5, lipRound: 0,   tongueOut: 0.3 },
  DD:   { mouthOpenY: 0.2,  mouthForm: 0.1,  mouthWidth: 0.5, lipRound: 0 },
  kk:   { mouthOpenY: 0.25, mouthForm: 0,    mouthWidth: 0.5, lipRound: 0.2 },
  CH:   { mouthOpenY: 0.2,  mouthForm: 0.2,  mouthWidth: 0.4, lipRound: 0.4 },
  SS:   { mouthOpenY: 0.15, mouthForm: 0.3,  mouthWidth: 0.6, lipRound: 0,   teethShow: 0.4 },
  nn:   { mouthOpenY: 0.15, mouthForm: 0.1,  mouthWidth: 0.5, lipRound: 0.2 },
  RR:   { mouthOpenY: 0.3,  mouthForm: 0,    mouthWidth: 0.4, lipRound: 0.5, tongueOut: 0.1 },
  aa:   { mouthOpenY: 0.9,  mouthForm: 0,    mouthWidth: 0.6, lipRound: 0.1 },
  E:    { mouthOpenY: 0.5,  mouthForm: 0.2,  mouthWidth: 0.6, lipRound: 0 },
  ih:   { mouthOpenY: 0.3,  mouthForm: 0.4,  mouthWidth: 0.7, lipRound: 0 },
  oh:   { mouthOpenY: 0.6,  mouthForm: 0,    mouthWidth: 0.4, lipRound: 0.8 },
  ou:   { mouthOpenY: 0.4,  mouthForm: 0,    mouthWidth: 0.3, lipRound: 1.0 },
};

// 中文拼音到 Viseme 映射
const PINYIN_VISEME_MAP: Record<string, Viseme[]> = {
  // 声母
  b: ['PP'], p: ['PP'], m: ['PP'],
  f: ['FF'],
  d: ['DD'], t: ['DD'], n: ['nn'], l: ['DD'],
  g: ['kk'], k: ['kk'], h: ['kk'],
  j: ['CH'], q: ['CH'], x: ['SS'],
  zh: ['CH'], ch: ['CH'], sh: ['CH'], r: ['RR'],
  z: ['SS'], c: ['SS'], s: ['SS'],
  // 韵母
  a: ['aa'], ai: ['aa', 'ih'], ao: ['aa', 'ou'],
  e: ['E'], ei: ['E', 'ih'],
  i: ['ih'], ia: ['ih', 'aa'], ie: ['ih', 'E'], iu: ['ih', 'ou'],
  o: ['oh'], ou: ['oh', 'ou'],
  u: ['ou'], ua: ['ou', 'aa'], uo: ['ou', 'oh'], ui: ['ou', 'ih'],
  ü: ['ou', 'ih'],
  an: ['aa', 'nn'], en: ['E', 'nn'], in: ['ih', 'nn'], un: ['ou', 'nn'],
  ang: ['aa', 'nn'], eng: ['E', 'nn'], ing: ['ih', 'nn'], ong: ['oh', 'nn'],
  // 特殊音节
  er: ['E', 'RR'],
};

// 日文假名到 Viseme 映射 (为初音未来准备)
const KANA_VISEME_MAP: Record<string, Viseme> = {
  // あ行
  'あ': 'aa', 'い': 'ih', 'う': 'ou', 'え': 'E', 'お': 'oh',
  'ア': 'aa', 'イ': 'ih', 'ウ': 'ou', 'エ': 'E', 'オ': 'oh',
  // か行
  'か': 'kk', 'き': 'kk', 'く': 'kk', 'け': 'kk', 'こ': 'kk',
  'カ': 'kk', 'キ': 'kk', 'ク': 'kk', 'ケ': 'kk', 'コ': 'kk',
  // さ行
  'さ': 'SS', 'し': 'CH', 'す': 'SS', 'せ': 'SS', 'そ': 'SS',
  'サ': 'SS', 'シ': 'CH', 'ス': 'SS', 'セ': 'SS', 'ソ': 'SS',
  // た行
  'た': 'DD', 'ち': 'CH', 'つ': 'SS', 'て': 'DD', 'と': 'DD',
  'タ': 'DD', 'チ': 'CH', 'ツ': 'SS', 'テ': 'DD', 'ト': 'DD',
  // な行
  'な': 'nn', 'に': 'nn', 'ぬ': 'nn', 'ね': 'nn', 'の': 'nn',
  'ナ': 'nn', 'ニ': 'nn', 'ヌ': 'nn', 'ネ': 'nn', 'ノ': 'nn',
  // は行
  'は': 'kk', 'ひ': 'kk', 'ふ': 'FF', 'へ': 'kk', 'ほ': 'kk',
  'ハ': 'kk', 'ヒ': 'kk', 'フ': 'FF', 'ヘ': 'kk', 'ホ': 'kk',
  // ま行
  'ま': 'PP', 'み': 'PP', 'む': 'PP', 'め': 'PP', 'も': 'PP',
  'マ': 'PP', 'ミ': 'PP', 'ム': 'PP', 'メ': 'PP', 'モ': 'PP',
  // や行
  'や': 'ih', 'ゆ': 'ou', 'よ': 'ih',
  'ヤ': 'ih', 'ユ': 'ou', 'ヨ': 'ih',
  // ら行
  'ら': 'RR', 'り': 'RR', 'る': 'RR', 'れ': 'RR', 'ろ': 'RR',
  'ラ': 'RR', 'リ': 'RR', 'ル': 'RR', 'レ': 'RR', 'ロ': 'RR',
  // わ行
  'わ': 'ou', 'を': 'oh', 'ん': 'nn',
  'ワ': 'ou', 'ヲ': 'oh', 'ン': 'nn',
};

// 情绪对口型的调制
interface EmotionModulation {
  openScale: number;       // 张嘴程度缩放
  formOffset: number;      // 嘴型偏移
  widthScale: number;      // 宽度缩放
}

const EMOTION_MODULATIONS: Record<string, EmotionModulation> = {
  neutral:    { openScale: 1.0, formOffset: 0,    widthScale: 1.0 },
  happy:      { openScale: 1.1, formOffset: 0.2,  widthScale: 1.1 },
  sad:        { openScale: 0.8, formOffset: -0.1, widthScale: 0.9 },
  surprised:  { openScale: 1.3, formOffset: 0,    widthScale: 1.0 },
  angry:      { openScale: 1.0, formOffset: -0.2, widthScale: 1.1 },
  fear:       { openScale: 1.2, formOffset: -0.1, widthScale: 0.9 },
  excited:    { openScale: 1.2, formOffset: 0.3,  widthScale: 1.2 },
  loving:     { openScale: 0.9, formOffset: 0.2,  widthScale: 0.9 },
  thinking:   { openScale: 0.7, formOffset: 0,    widthScale: 0.9 },
};

export interface VisemeCallbacks {
  onMouthParams: (params: VisemeParams) => void;
}

export interface VisemeConfig {
  smoothing?: number;           // 过渡平滑度 0-1
  coarticulationStrength?: number;  // 协同发音强度 0-1
  emotion?: string;             // 当前情绪
  speed?: number;               // 语速倍率
}

const DEFAULT_CONFIG: Required<VisemeConfig> = {
  smoothing: 0.4,
  coarticulationStrength: 0.5,
  emotion: 'neutral',
  speed: 1.0,
};

export class VisemeDriver {
  private config: Required<VisemeConfig>;
  private callbacks: Set<VisemeCallbacks['onMouthParams']> = new Set();
  
  // 当前状态
  private currentViseme: Viseme = 'sil';
  private currentParams: VisemeParams = { ...VISEME_PARAMS.sil };
  private targetParams: VisemeParams = { ...VISEME_PARAMS.sil };
  
  // 动画
  private animationFrame: number | null = null;
  private isAnimating = false;
  
  // Viseme 队列 (协同发音)
  private visemeQueue: { viseme: Viseme; duration: number }[] = [];
  private queueStartTime = 0;
  private queueIndex = 0;

  constructor(config: VisemeConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 订阅口型参数更新
   */
  onMouthParams(callback: VisemeCallbacks['onMouthParams']): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 设置当前情绪 (影响口型表现)
   */
  setEmotion(emotion: string) {
    this.config.emotion = emotion;
  }

  /**
   * 设置目标 Viseme
   */
  setViseme(viseme: Viseme) {
    this.currentViseme = viseme;
    this.targetParams = this.getModulatedParams(viseme);
    
    if (!this.isAnimating) {
      this.startAnimation();
    }
  }

  /**
   * 根据文本生成 Viseme 序列
   */
  generateVisemeSequence(text: string, durationMs: number): { viseme: Viseme; duration: number }[] {
    const sequence: { viseme: Viseme; duration: number }[] = [];
    const chars = text.split('');
    
    // 基础每字符时长
    const baseCharDuration = durationMs / Math.max(1, chars.length);
    
    for (const char of chars) {
      // 检查日文假名
      if (KANA_VISEME_MAP[char]) {
        sequence.push({ viseme: KANA_VISEME_MAP[char], duration: baseCharDuration });
        continue;
      }
      
      // 检查中文/拼音
      const visemes = this.charToVisemes(char);
      const perVisemeDuration = baseCharDuration / visemes.length;
      
      for (const v of visemes) {
        sequence.push({ viseme: v, duration: perVisemeDuration });
      }
    }
    
    // 添加结尾静音
    sequence.push({ viseme: 'sil', duration: 100 });
    
    return sequence;
  }

  /**
   * 播放 Viseme 序列
   */
  playSequence(sequence: { viseme: Viseme; duration: number }[]) {
    this.visemeQueue = sequence;
    this.queueIndex = 0;
    this.queueStartTime = Date.now();
    
    if (!this.isAnimating) {
      this.startAnimation();
    }
  }

  /**
   * 基于音频分析设置 Viseme
   * 使用频谱特征估计口型
   */
  setFromAudioSpectrum(spectrum: Uint8Array, sampleRate: number = 44100) {
    const fftSize = spectrum.length * 2;
    const binWidth = sampleRate / fftSize;
    
    // 计算不同频段能量
    let lowEnergy = 0;    // 0-500 Hz (元音基频)
    let midEnergy = 0;    // 500-2000 Hz (共振峰)
    let highEnergy = 0;   // 2000-8000 Hz (摩擦音/齿音)
    
    for (let i = 0; i < spectrum.length; i++) {
      const freq = i * binWidth;
      const value = spectrum[i] / 255;
      
      if (freq < 500) {
        lowEnergy += value;
      } else if (freq < 2000) {
        midEnergy += value;
      } else if (freq < 8000) {
        highEnergy += value;
      }
    }
    
    // 归一化
    const lowBins = Math.floor(500 / binWidth);
    const midBins = Math.floor(1500 / binWidth);
    const highBins = Math.floor(6000 / binWidth);
    
    lowEnergy /= Math.max(1, lowBins);
    midEnergy /= Math.max(1, midBins);
    highEnergy /= Math.max(1, highBins);
    
    // 总能量
    const totalEnergy = lowEnergy + midEnergy + highEnergy;
    
    if (totalEnergy < 0.05) {
      this.setViseme('sil');
      return;
    }
    
    // 基于频谱特征估计 Viseme
    let viseme: Viseme;
    
    if (highEnergy > midEnergy * 1.5) {
      // 高频占优 - 齿音/摩擦音
      viseme = lowEnergy > 0.3 ? 'CH' : 'SS';
    } else if (lowEnergy > midEnergy * 1.2) {
      // 低频占优 - 闭口音
      viseme = 'PP';
    } else {
      // 中频占优 - 元音
      const ratio = lowEnergy / (midEnergy + 0.01);
      if (ratio > 0.8) {
        viseme = 'aa';  // 大开口
      } else if (ratio > 0.5) {
        viseme = 'oh';  // 圆唇
      } else if (ratio > 0.3) {
        viseme = 'E';   // 中开口
      } else {
        viseme = 'ih';  // 扁嘴
      }
    }
    
    this.setViseme(viseme);
  }

  /**
   * 停止
   */
  stop() {
    this.visemeQueue = [];
    this.setViseme('sil');
  }

  /**
   * 销毁
   */
  destroy() {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.callbacks.clear();
  }

  // ========== 私有方法 ==========

  /**
   * 字符转 Viseme 序列
   */
  private charToVisemes(char: string): Viseme[] {
    // 标点/空格
    if (/[\s,.!?，。！？、；：""''（）【】]/.test(char)) {
      return ['sil'];
    }
    
    // 英文字母
    const englishMap: Record<string, Viseme> = {
      a: 'aa', e: 'E', i: 'ih', o: 'oh', u: 'ou',
      b: 'PP', p: 'PP', m: 'PP',
      f: 'FF', v: 'FF',
      t: 'DD', d: 'DD', n: 'nn', l: 'DD',
      k: 'kk', g: 'kk',
      s: 'SS', z: 'SS', c: 'SS',
      r: 'RR',
      w: 'ou', y: 'ih',
      h: 'kk', j: 'CH', q: 'kk', x: 'SS',
    };
    
    const lower = char.toLowerCase();
    if (englishMap[lower]) {
      return [englishMap[lower]];
    }
    
    // 中文 - 简单映射到元音
    if (/[\u4e00-\u9fa5]/.test(char)) {
      // 随机选择一个元音
      const vowels: Viseme[] = ['aa', 'E', 'ih', 'oh', 'ou'];
      return [vowels[Math.floor(Math.random() * vowels.length)]];
    }
    
    // 数字
    if (/[0-9]/.test(char)) {
      return ['ih'];
    }
    
    return ['sil'];
  }

  /**
   * 获取情绪调制后的参数
   */
  private getModulatedParams(viseme: Viseme): VisemeParams {
    const base = { ...VISEME_PARAMS[viseme] };
    const mod = EMOTION_MODULATIONS[this.config.emotion] || EMOTION_MODULATIONS.neutral;
    
    return {
      mouthOpenY: Math.min(1, base.mouthOpenY * mod.openScale),
      mouthForm: Math.max(-1, Math.min(1, base.mouthForm + mod.formOffset)),
      mouthWidth: Math.min(1, base.mouthWidth * mod.widthScale),
      lipRound: base.lipRound,
      tongueOut: base.tongueOut,
      teethShow: base.teethShow,
    };
  }

  /**
   * 启动动画循环
   */
  private startAnimation() {
    this.isAnimating = true;
    
    const animate = () => {
      // 处理队列
      if (this.visemeQueue.length > 0) {
        this.processQueue();
      }
      
      // 平滑过渡到目标
      this.smoothTransition();
      
      // 通知回调
      this.notifyCallbacks();
      
      if (this.isAnimating) {
        this.animationFrame = requestAnimationFrame(animate);
      }
    };
    
    this.animationFrame = requestAnimationFrame(animate);
  }

  /**
   * 处理 Viseme 队列
   */
  private processQueue() {
    const now = Date.now();
    const elapsed = now - this.queueStartTime;
    
    // 计算当前应该在哪个 viseme
    let accumulatedTime = 0;
    for (let i = 0; i < this.visemeQueue.length; i++) {
      accumulatedTime += this.visemeQueue[i].duration / this.config.speed;
      
      if (elapsed < accumulatedTime) {
        if (i !== this.queueIndex) {
          this.queueIndex = i;
          
          // 协同发音: 混合当前和下一个 viseme
          const current = this.visemeQueue[i];
          const next = this.visemeQueue[i + 1];
          
          if (next && this.config.coarticulationStrength > 0) {
            const progress = (elapsed - (accumulatedTime - current.duration / this.config.speed)) / (current.duration / this.config.speed);
            this.targetParams = this.blendParams(
              this.getModulatedParams(current.viseme),
              this.getModulatedParams(next.viseme),
              progress * this.config.coarticulationStrength
            );
          } else {
            this.targetParams = this.getModulatedParams(current.viseme);
          }
        }
        return;
      }
    }
    
    // 队列播放完毕
    this.visemeQueue = [];
    this.targetParams = this.getModulatedParams('sil');
  }

  /**
   * 平滑过渡
   */
  private smoothTransition() {
    const smoothing = this.config.smoothing;
    
    this.currentParams = {
      mouthOpenY: this.lerp(this.currentParams.mouthOpenY, this.targetParams.mouthOpenY, 1 - smoothing),
      mouthForm: this.lerp(this.currentParams.mouthForm, this.targetParams.mouthForm, 1 - smoothing),
      mouthWidth: this.lerp(this.currentParams.mouthWidth, this.targetParams.mouthWidth, 1 - smoothing),
      lipRound: this.lerp(this.currentParams.lipRound, this.targetParams.lipRound, 1 - smoothing),
      tongueOut: this.lerp(this.currentParams.tongueOut || 0, this.targetParams.tongueOut || 0, 1 - smoothing),
      teethShow: this.lerp(this.currentParams.teethShow || 0, this.targetParams.teethShow || 0, 1 - smoothing),
    };
  }

  /**
   * 混合两组参数
   */
  private blendParams(a: VisemeParams, b: VisemeParams, t: number): VisemeParams {
    return {
      mouthOpenY: this.lerp(a.mouthOpenY, b.mouthOpenY, t),
      mouthForm: this.lerp(a.mouthForm, b.mouthForm, t),
      mouthWidth: this.lerp(a.mouthWidth, b.mouthWidth, t),
      lipRound: this.lerp(a.lipRound, b.lipRound, t),
      tongueOut: this.lerp(a.tongueOut || 0, b.tongueOut || 0, t),
      teethShow: this.lerp(a.teethShow || 0, b.teethShow || 0, t),
    };
  }

  /**
   * 线性插值
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * 通知回调
   */
  private notifyCallbacks() {
    for (const callback of this.callbacks) {
      try {
        callback(this.currentParams);
      } catch (e) {
        console.error('[VisemeDriver] 回调错误:', e);
      }
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<VisemeConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前参数
   */
  getCurrentParams(): VisemeParams {
    return { ...this.currentParams };
  }
}

// 单例导出
export const visemeDriver = new VisemeDriver();
