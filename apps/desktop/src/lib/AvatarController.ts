/**
 * Avatar Controller - 控制 Live2D 模型的表情和动作
 * 
 * 这是初音未来的灵魂控制器
 * 
 * v4.0 - SOTA 完整版
 * - 扩展表情系统 (4 → 24 种表情)
 * - 表情混合/过渡动画
 * - 自动衰减系统
 * - ✨ 自动眨眼系统 (随机间隔，自然眨眼)
 * - ✨ 呼吸动画 (轻微身体起伏)
 * - ✨ 待机微动作 (轻微摇摆)
 * - ✨ Viseme 精确口型同步
 * - ✨ 微表情系统 (眉毛、眼神、嘴角微动)
 */

import { visemeDriver, type Viseme } from './VisemeDriver';
import { microExpressionSystem } from './MicroExpressionSystem';
import { motionQueueSystem, type MotionPriority } from './MotionQueueSystem';
import { physicsEnhancer } from './PhysicsEnhancer';

import type { Live2DModel } from 'pixi-live2d-display';

// ========== 生命动画配置 ==========
interface LifeAnimationConfig {
  // 眨眼配置
  blink: {
    enabled: boolean;
    minInterval: number;   // 最小眨眼间隔 (ms)
    maxInterval: number;   // 最大眨眼间隔 (ms)
    duration: number;      // 眨眼持续时间 (ms)
    doubleBlinkChance: number;  // 连续眨眼概率 0-1
  };
  // 呼吸配置
  breath: {
    enabled: boolean;
    cycle: number;         // 呼吸周期 (ms)
    amplitude: number;     // 幅度 0-1
  };
  // 待机微动作配置
  idle: {
    enabled: boolean;
    swayAmplitude: number; // 摇摆幅度
    swayCycle: number;     // 摇摆周期 (ms)
  };
}

const DEFAULT_LIFE_CONFIG: LifeAnimationConfig = {
  blink: {
    enabled: true,
    minInterval: 2000,
    maxInterval: 6000,
    duration: 150,
    doubleBlinkChance: 0.2,
  },
  breath: {
    enabled: true,
    cycle: 3500,
    amplitude: 0.03,
  },
  idle: {
    enabled: true,
    swayAmplitude: 0.02,
    swayCycle: 5000,
  },
};

// 扩展表情类型 (从4个扩展到24个)
export type Expression = 
  // 基础情绪 (Basic Emotions)
  | 'neutral'      // 中性
  | 'happy'        // 开心
  | 'sad'          // 悲伤
  | 'surprised'    // 惊讶
  | 'angry'        // 生气
  | 'fear'         // 害怕
  | 'disgusted'    // 厌恶
  // 积极情绪 (Positive Emotions)
  | 'excited'      // 兴奋
  | 'proud'        // 骄傲
  | 'loving'       // 爱意
  | 'grateful'     // 感激
  | 'hopeful'      // 期待
  | 'amused'       // 觉得有趣
  | 'relieved'     // 释然
  // 消极情绪 (Negative Emotions)
  | 'anxious'      // 焦虑
  | 'embarrassed'  // 尴尬/害羞
  | 'confused'     // 困惑
  | 'bored'        // 无聊
  | 'disappointed' // 失望
  | 'lonely'       // 孤独
  // 复杂情绪 (Complex Emotions)
  | 'thinking'     // 思考
  | 'curious'      // 好奇
  | 'determined'   // 坚定
  | 'playful';     // 俏皮/调皮

export type MotionGroup = 'idle' | 'tap_body' | 'shake' | 'flick_head' | 'zuoshou' | 'youshou' | 'zuoshou_goodbye' | 'youshou_goodbye';

// Cubism 2 表情映射 (shizuku 模型)
const CUBISM2_EXPRESSION_MAP: Record<Expression, string> = {
  // 基础
  neutral: 'f01',
  happy: 'f02',
  sad: 'f03',
  surprised: 'f04',
  angry: 'f05',
  fear: 'f06',
  disgusted: 'f07',
  // 积极 - 映射到相近表情
  excited: 'f02',      // → happy
  proud: 'f02',        // → happy
  loving: 'f02',       // → happy
  grateful: 'f02',     // → happy
  hopeful: 'f02',      // → happy
  amused: 'f02',       // → happy
  relieved: 'f01',     // → neutral
  // 消极
  anxious: 'f06',      // → fear
  embarrassed: 'f04',  // → surprised
  confused: 'f04',     // → surprised
  bored: 'f01',        // → neutral
  disappointed: 'f03', // → sad
  lonely: 'f03',       // → sad
  // 复杂
  thinking: 'f01',     // → neutral
  curious: 'f04',      // → surprised
  determined: 'f05',   // → angry (轻度)
  playful: 'f02',      // → happy
};

// Cubism 3/4 表情映射 (001 模型 - 中文表情)
const CUBISM3_EXPRESSION_MAP: Record<Expression, string> = {
  // 基础
  neutral: 'default111',
  happy: 'kaixin',
  sad: 'shangxin',
  surprised: 'haixiu',     // 害羞
  angry: 'shengqi',
  fear: 'haipa',
  disgusted: 'yanwu',
  // 积极
  excited: 'xingfen',
  proud: 'jiaoao',
  loving: 'aiqing',
  grateful: 'ganxie',
  hopeful: 'qidai',
  amused: 'kaixin',        // → 开心
  relieved: 'fangsong',
  // 消极
  anxious: 'jiaolv',
  embarrassed: 'haixiu',
  confused: 'kunhuo',
  bored: 'wuliao',
  disappointed: 'shiwang',
  lonely: 'gudu',
  // 复杂
  thinking: 'sikao',
  curious: 'haoqi',
  determined: 'jianding',
  playful: 'tiaoqi',
};

// 表情参数混合配置 (用于 blend shapes)
interface ExpressionBlend {
  eyeOpenL?: number;      // 左眼睁开程度 0-1
  eyeOpenR?: number;      // 右眼睁开程度 0-1
  eyeSmileL?: number;     // 左眼笑眼程度 0-1
  eyeSmileR?: number;     // 右眼笑眼程度 0-1
  browL?: number;         // 左眉高度 -1 to 1
  browR?: number;         // 右眉高度 -1 to 1
  mouthSmile?: number;    // 嘴角上扬 0-1
  mouthOpen?: number;     // 嘴巴张开 0-1
  mouthForm?: number;     // 嘴型 -1 to 1 (撇嘴到微笑)
  cheek?: number;         // 脸红程度 0-1
}

// 每种表情的混合参数
const EXPRESSION_BLENDS: Record<Expression, ExpressionBlend> = {
  neutral:      { eyeOpenL: 1, eyeOpenR: 1, eyeSmileL: 0, eyeSmileR: 0, browL: 0, browR: 0, mouthSmile: 0, mouthOpen: 0, cheek: 0 },
  happy:        { eyeOpenL: 0.8, eyeOpenR: 0.8, eyeSmileL: 0.8, eyeSmileR: 0.8, browL: 0.2, browR: 0.2, mouthSmile: 0.9, mouthOpen: 0.3, cheek: 0.4 },
  sad:          { eyeOpenL: 0.7, eyeOpenR: 0.7, eyeSmileL: 0, eyeSmileR: 0, browL: -0.5, browR: -0.5, mouthSmile: -0.4, mouthOpen: 0.1, cheek: 0 },
  surprised:    { eyeOpenL: 1.2, eyeOpenR: 1.2, eyeSmileL: 0, eyeSmileR: 0, browL: 0.8, browR: 0.8, mouthSmile: 0.1, mouthOpen: 0.6, cheek: 0.1 },
  angry:        { eyeOpenL: 0.9, eyeOpenR: 0.9, eyeSmileL: 0, eyeSmileR: 0, browL: -0.8, browR: -0.8, mouthSmile: -0.3, mouthOpen: 0.2, cheek: 0 },
  fear:         { eyeOpenL: 1.1, eyeOpenR: 1.1, eyeSmileL: 0, eyeSmileR: 0, browL: 0.5, browR: -0.5, mouthSmile: -0.2, mouthOpen: 0.4, cheek: 0 },
  disgusted:    { eyeOpenL: 0.6, eyeOpenR: 0.8, eyeSmileL: 0, eyeSmileR: 0, browL: -0.3, browR: -0.6, mouthSmile: -0.5, mouthOpen: 0.1, cheek: 0 },
  excited:      { eyeOpenL: 1.1, eyeOpenR: 1.1, eyeSmileL: 0.5, eyeSmileR: 0.5, browL: 0.6, browR: 0.6, mouthSmile: 1, mouthOpen: 0.5, cheek: 0.6 },
  proud:        { eyeOpenL: 0.9, eyeOpenR: 0.9, eyeSmileL: 0.4, eyeSmileR: 0.4, browL: 0.3, browR: 0.3, mouthSmile: 0.5, mouthOpen: 0.1, cheek: 0.2 },
  loving:       { eyeOpenL: 0.7, eyeOpenR: 0.7, eyeSmileL: 0.9, eyeSmileR: 0.9, browL: 0.1, browR: 0.1, mouthSmile: 0.7, mouthOpen: 0.1, cheek: 0.8 },
  grateful:     { eyeOpenL: 0.8, eyeOpenR: 0.8, eyeSmileL: 0.6, eyeSmileR: 0.6, browL: 0, browR: 0, mouthSmile: 0.6, mouthOpen: 0.2, cheek: 0.3 },
  hopeful:      { eyeOpenL: 1, eyeOpenR: 1, eyeSmileL: 0.3, eyeSmileR: 0.3, browL: 0.4, browR: 0.4, mouthSmile: 0.4, mouthOpen: 0.1, cheek: 0.1 },
  amused:       { eyeOpenL: 0.8, eyeOpenR: 0.8, eyeSmileL: 0.7, eyeSmileR: 0.7, browL: 0.2, browR: 0.2, mouthSmile: 0.8, mouthOpen: 0.4, cheek: 0.3 },
  relieved:     { eyeOpenL: 0.7, eyeOpenR: 0.7, eyeSmileL: 0.3, eyeSmileR: 0.3, browL: -0.1, browR: -0.1, mouthSmile: 0.3, mouthOpen: 0.2, cheek: 0 },
  anxious:      { eyeOpenL: 1, eyeOpenR: 1, eyeSmileL: 0, eyeSmileR: 0, browL: 0.3, browR: -0.3, mouthSmile: -0.2, mouthOpen: 0.1, cheek: 0 },
  embarrassed:  { eyeOpenL: 0.6, eyeOpenR: 0.6, eyeSmileL: 0.2, eyeSmileR: 0.2, browL: 0.2, browR: 0.2, mouthSmile: 0.2, mouthOpen: 0.1, cheek: 1 },
  confused:     { eyeOpenL: 1, eyeOpenR: 0.8, eyeSmileL: 0, eyeSmileR: 0, browL: 0.4, browR: -0.2, mouthSmile: 0, mouthOpen: 0.2, cheek: 0 },
  bored:        { eyeOpenL: 0.5, eyeOpenR: 0.5, eyeSmileL: 0, eyeSmileR: 0, browL: -0.2, browR: -0.2, mouthSmile: -0.1, mouthOpen: 0, cheek: 0 },
  disappointed: { eyeOpenL: 0.7, eyeOpenR: 0.7, eyeSmileL: 0, eyeSmileR: 0, browL: -0.4, browR: -0.4, mouthSmile: -0.5, mouthOpen: 0.1, cheek: 0 },
  lonely:       { eyeOpenL: 0.6, eyeOpenR: 0.6, eyeSmileL: 0, eyeSmileR: 0, browL: -0.2, browR: -0.2, mouthSmile: -0.3, mouthOpen: 0, cheek: 0 },
  thinking:     { eyeOpenL: 0.9, eyeOpenR: 0.7, eyeSmileL: 0, eyeSmileR: 0, browL: 0.3, browR: 0, mouthSmile: 0, mouthOpen: 0, cheek: 0 },
  curious:      { eyeOpenL: 1.1, eyeOpenR: 1.1, eyeSmileL: 0.1, eyeSmileR: 0.1, browL: 0.5, browR: 0.5, mouthSmile: 0.2, mouthOpen: 0.2, cheek: 0 },
  determined:   { eyeOpenL: 1, eyeOpenR: 1, eyeSmileL: 0, eyeSmileR: 0, browL: -0.3, browR: -0.3, mouthSmile: 0.1, mouthOpen: 0, cheek: 0 },
  playful:      { eyeOpenL: 0.9, eyeOpenR: 0.7, eyeSmileL: 0.6, eyeSmileR: 0.4, browL: 0.3, browR: 0, mouthSmile: 0.7, mouthOpen: 0.2, cheek: 0.2 },
};

// 表情默认持续时间 (毫秒)
const EXPRESSION_DURATIONS: Record<Expression, number> = {
  neutral: 0,          // 永久
  happy: 4000,
  sad: 5000,
  surprised: 2000,     // 惊讶持续较短
  angry: 4000,
  fear: 3000,
  disgusted: 3000,
  excited: 3000,
  proud: 4000,
  loving: 5000,
  grateful: 4000,
  hopeful: 4000,
  amused: 3000,
  relieved: 4000,
  anxious: 3000,
  embarrassed: 3500,
  confused: 3000,
  bored: 5000,
  disappointed: 4500,
  lonely: 5000,
  thinking: 4000,
  curious: 3500,
  determined: 4000,
  playful: 3000,
};

// 表情过渡配置
interface TransitionConfig {
  duration: number;     // 过渡时间 (ms)
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

const DEFAULT_TRANSITION: TransitionConfig = {
  duration: 300,
  easing: 'easeInOut',
};

type CubismVersion = 2 | 3 | 4;

export class AvatarController {
  private model: Live2DModel | null = null;
  private currentExpression: Expression = 'neutral';
  private targetExpression: Expression = 'neutral';
  private isPlaying = false;
  private cubismVersion: CubismVersion = 2;
  private availableExpressions: string[] = [];
  private availableMotions: string[] = [];
  
  // 表情混合系统
  private currentBlend: ExpressionBlend = { ...EXPRESSION_BLENDS.neutral };
  private targetBlend: ExpressionBlend = { ...EXPRESSION_BLENDS.neutral };
  private transitionStartTime = 0;
  private transitionDuration = 0;
  private isTransitioning = false;
  
  // 自动衰减系统
  private expressionTimeout: ReturnType<typeof setTimeout> | null = null;
  private autoDecayEnabled = true;
  
  // 动画帧
  private animationFrameId: number | null = null;

  // ========== 生命动画系统 ==========
  private lifeConfig: LifeAnimationConfig = { ...DEFAULT_LIFE_CONFIG };
  private lifeAnimationEnabled = true;
  
  // 眨眼状态
  private blinkTimeout: ReturnType<typeof setTimeout> | null = null;
  private isBlinking = false;
  private blinkPhase: 'closing' | 'opening' | 'none' = 'none';
  private blinkStartTime = 0;
  private originalEyeOpenL = 1;
  private originalEyeOpenR = 1;
  
  // 呼吸/待机动画状态
  private breathStartTime = 0;
  private idleStartTime = 0;

  /**
   * 绑定 Live2D 模型
   */
  bind(model: Live2DModel) {
    this.model = model;
    console.log('[AvatarController] 模型已绑定');
    
    // 检测 Cubism 版本
    this.detectCubismVersion();
    
    // 打印可用的表情和动作
    if (model.internalModel) {
      const motionManager = model.internalModel.motionManager;
      
      // 获取可用表情
      const expressionDefs = motionManager?.expressionManager?.definitions;
      if (Array.isArray(expressionDefs)) {
        this.availableExpressions = expressionDefs.map((def: any) => def?.Name || def?.name || String(def)).filter(Boolean);
      }
      
      // 获取可用动作组
      const motionDefs = motionManager?.definitions;
      if (motionDefs) {
        this.availableMotions = Object.keys(motionDefs);
      }
      
      console.log('[AvatarController] 模型信息:', {
        cubismVersion: this.cubismVersion,
        expressions: this.availableExpressions,
        motions: this.availableMotions,
        supportedEmotions: this.getSupportedExpressions().length,
      });
    }
    
    // 启动混合动画循环
    this.startAnimationLoop();
  }

  /**
   * 检测 Cubism 版本
   */
  private detectCubismVersion() {
    if (!this.model?.internalModel) return;
    
    const coreModel = this.model.internalModel.coreModel as any;
    
    // Cubism 4/3 有 _model.parameters
    if (coreModel?._model?.parameters) {
      this.cubismVersion = 4; // Cubism 3 和 4 接口兼容
      console.log('[AvatarController] 检测到 Cubism 3/4 模型');
    } 
    // Cubism 2 有 setParamFloat
    else if (coreModel?.setParamFloat) {
      this.cubismVersion = 2;
      console.log('[AvatarController] 检测到 Cubism 2 模型');
    }
    else {
      console.log('[AvatarController] 无法检测 Cubism 版本，默认为 2');
    }
  }

  /**
   * 启动混合动画循环
   */
  private startAnimationLoop() {
    this.breathStartTime = Date.now();
    this.idleStartTime = Date.now();
    
    const animate = () => {
      const now = Date.now();
      
      // 表情过渡
      if (this.isTransitioning) {
        this.updateBlendTransition();
      }
      
      // 生命动画
      if (this.lifeAnimationEnabled) {
        this.updateLifeAnimations(now);
      }
      
      this.animationFrameId = requestAnimationFrame(animate);
    };
    this.animationFrameId = requestAnimationFrame(animate);
    
    // 启动眨眼计时器
    this.scheduleNextBlink();
  }

  /**
   * 更新生命动画（眨眼、呼吸、待机）
   */
  private updateLifeAnimations(now: number) {
    if (!this.model?.internalModel) return;
    
    const coreModel = this.model.internalModel.coreModel as any;
    
    // ===== 眨眼动画 =====
    if (this.lifeConfig.blink.enabled && this.blinkPhase !== 'none') {
      this.updateBlink(now);
    }
    
    // ===== 呼吸动画 =====
    if (this.lifeConfig.breath.enabled) {
      const breathElapsed = now - this.breathStartTime;
      const breathProgress = (breathElapsed % this.lifeConfig.breath.cycle) / this.lifeConfig.breath.cycle;
      // 使用正弦波实现平滑呼吸
      const breathValue = Math.sin(breathProgress * Math.PI * 2) * this.lifeConfig.breath.amplitude;
      
      this.applyBreath(coreModel, breathValue);
    }
    
    // ===== 待机微动作 =====
    if (this.lifeConfig.idle.enabled) {
      const idleElapsed = now - this.idleStartTime;
      const idleProgress = (idleElapsed % this.lifeConfig.idle.swayCycle) / this.lifeConfig.idle.swayCycle;
      // 使用正弦波实现轻微摇摆
      const swayValue = Math.sin(idleProgress * Math.PI * 2) * this.lifeConfig.idle.swayAmplitude;
      
      this.applyIdleSway(coreModel, swayValue);
    }
  }

  /**
   * 计划下一次眨眼
   */
  private scheduleNextBlink() {
    if (!this.lifeConfig.blink.enabled || !this.lifeAnimationEnabled) return;
    
    // 随机间隔
    const interval = this.lifeConfig.blink.minInterval + 
      Math.random() * (this.lifeConfig.blink.maxInterval - this.lifeConfig.blink.minInterval);
    
    this.blinkTimeout = setTimeout(() => {
      this.startBlink();
    }, interval);
  }

  /**
   * 开始眨眼
   */
  private startBlink() {
    if (this.isBlinking || !this.model) return;
    
    this.isBlinking = true;
    this.blinkPhase = 'closing';
    this.blinkStartTime = Date.now();
    
    // 保存当前眼睛状态
    this.originalEyeOpenL = this.currentBlend.eyeOpenL ?? 1;
    this.originalEyeOpenR = this.currentBlend.eyeOpenR ?? 1;
  }

  /**
   * 更新眨眼动画
   */
  private updateBlink(now: number) {
    const elapsed = now - this.blinkStartTime;
    const halfDuration = this.lifeConfig.blink.duration / 2;
    
    if (this.blinkPhase === 'closing') {
      // 闭眼阶段
      const progress = Math.min(1, elapsed / halfDuration);
      const easedProgress = this.applyEasing(progress, 'easeIn');
      
      this.applyEyeOpen(1 - easedProgress);
      
      if (progress >= 1) {
        this.blinkPhase = 'opening';
        this.blinkStartTime = now;
      }
    } else if (this.blinkPhase === 'opening') {
      // 睁眼阶段
      const progress = Math.min(1, elapsed / halfDuration);
      const easedProgress = this.applyEasing(progress, 'easeOut');
      
      this.applyEyeOpen(easedProgress);
      
      if (progress >= 1) {
        this.blinkPhase = 'none';
        this.isBlinking = false;
        
        // 有概率连续眨眼
        if (Math.random() < this.lifeConfig.blink.doubleBlinkChance) {
          setTimeout(() => this.startBlink(), 100);
        } else {
          this.scheduleNextBlink();
        }
      }
    }
  }

  /**
   * 应用眼睛张开程度
   */
  private applyEyeOpen(openAmount: number) {
    if (!this.model?.internalModel) return;
    
    const coreModel = this.model.internalModel.coreModel as any;
    const finalL = this.originalEyeOpenL * openAmount;
    const finalR = this.originalEyeOpenR * openAmount;
    
    try {
      if (this.cubismVersion >= 3) {
        const model = coreModel?._model;
        if (model?.parameters) {
          const paramNames = ['ParamEyeLOpen', 'PARAM_EYE_L_OPEN', 'ParamEyeOpen_L'];
          const paramNamesR = ['ParamEyeROpen', 'PARAM_EYE_R_OPEN', 'ParamEyeOpen_R'];
          
          for (const paramName of paramNames) {
            const idx = model.parameters.ids?.indexOf(paramName);
            if (idx >= 0) {
              model.parameters.values[idx] = finalL;
              break;
            }
          }
          for (const paramName of paramNamesR) {
            const idx = model.parameters.ids?.indexOf(paramName);
            if (idx >= 0) {
              model.parameters.values[idx] = finalR;
              break;
            }
          }
        }
      } else {
        if (coreModel?.setParamFloat) {
          coreModel.setParamFloat('PARAM_EYE_L_OPEN', finalL);
          coreModel.setParamFloat('PARAM_EYE_R_OPEN', finalR);
        }
      }
    } catch {
      // 静默处理
    }
  }

  /**
   * 应用呼吸动画
   */
  private applyBreath(coreModel: any, breathValue: number) {
    try {
      if (this.cubismVersion >= 3) {
        const model = coreModel?._model;
        if (model?.parameters) {
          // 呼吸影响身体 Y 轴位置
          const paramNames = ['ParamBreath', 'PARAM_BREATH', 'ParamBodyAngleY', 'PARAM_BODY_ANGLE_Y'];
          for (const paramName of paramNames) {
            const idx = model.parameters.ids?.indexOf(paramName);
            if (idx >= 0) {
              model.parameters.values[idx] = breathValue * 10; // 放大效果
              break;
            }
          }
        }
      } else {
        if (coreModel?.setParamFloat) {
          coreModel.setParamFloat('PARAM_BREATH', breathValue * 10);
        }
      }
    } catch {
      // 静默处理
    }
  }

  /**
   * 应用待机摇摆
   */
  private applyIdleSway(coreModel: any, swayValue: number) {
    try {
      if (this.cubismVersion >= 3) {
        const model = coreModel?._model;
        if (model?.parameters) {
          // 轻微的身体角度摇摆
          const paramNames = ['ParamBodyAngleX', 'PARAM_BODY_ANGLE_X', 'ParamAngleX', 'PARAM_ANGLE_X'];
          for (const paramName of paramNames) {
            const idx = model.parameters.ids?.indexOf(paramName);
            if (idx >= 0) {
              // 叠加到现有值而不是替换
              model.parameters.values[idx] += swayValue * 5;
              break;
            }
          }
        }
      } else {
        if (coreModel?.setParamFloat) {
          coreModel.setParamFloat('PARAM_BODY_ANGLE_X', swayValue * 5);
        }
      }
    } catch {
      // 静默处理
    }
  }

  /**
   * 更新混合过渡
   */
  private updateBlendTransition() {
    const elapsed = Date.now() - this.transitionStartTime;
    const progress = Math.min(1, elapsed / this.transitionDuration);
    
    // 应用缓动函数
    const easedProgress = this.applyEasing(progress, 'easeInOut');
    
    // 插值计算当前混合值
    const blendKeys = Object.keys(this.targetBlend) as (keyof ExpressionBlend)[];
    for (const key of blendKeys) {
      const start = this.currentBlend[key] ?? 0;
      const end = this.targetBlend[key] ?? 0;
      (this.currentBlend as any)[key] = start + (end - start) * easedProgress;
    }
    
    // 应用混合参数到模型
    this.applyBlendToModel();
    
    // 过渡完成
    if (progress >= 1) {
      this.isTransitioning = false;
      this.currentExpression = this.targetExpression;
      console.log('[AvatarController] 表情过渡完成:', this.currentExpression);
    }
  }

  /**
   * 缓动函数
   */
  private applyEasing(t: number, type: TransitionConfig['easing']): number {
    switch (type) {
      case 'linear': return t;
      case 'easeIn': return t * t;
      case 'easeOut': return t * (2 - t);
      case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default: return t;
    }
  }

  /**
   * 应用混合参数到模型
   */
  private applyBlendToModel() {
    if (!this.model?.internalModel) return;
    
    const coreModel = this.model.internalModel.coreModel as any;
    
    // 参数名映射
    const paramMap: Record<keyof ExpressionBlend, string[]> = {
      eyeOpenL: ['ParamEyeLOpen', 'PARAM_EYE_L_OPEN', 'ParamEyeOpen_L'],
      eyeOpenR: ['ParamEyeROpen', 'PARAM_EYE_R_OPEN', 'ParamEyeOpen_R'],
      eyeSmileL: ['ParamEyeLSmile', 'PARAM_EYE_L_SMILE'],
      eyeSmileR: ['ParamEyeRSmile', 'PARAM_EYE_R_SMILE'],
      browL: ['ParamBrowLY', 'PARAM_BROW_L_Y', 'ParamBrowL'],
      browR: ['ParamBrowRY', 'PARAM_BROW_R_Y', 'ParamBrowR'],
      mouthSmile: ['ParamMouthForm', 'PARAM_MOUTH_FORM'],
      mouthOpen: ['ParamMouthOpenY', 'PARAM_MOUTH_OPEN_Y'],
      cheek: ['ParamCheek', 'PARAM_CHEEK'],
    };
    
    try {
      if (this.cubismVersion >= 3) {
        const model = coreModel?._model;
        if (!model?.parameters) return;
        
        for (const [blendKey, paramNames] of Object.entries(paramMap)) {
          const value = this.currentBlend[blendKey as keyof ExpressionBlend];
          if (value === undefined) continue;
          
          for (const paramName of paramNames) {
            const paramIndex = model.parameters.ids?.indexOf(paramName);
            if (paramIndex >= 0) {
              model.parameters.values[paramIndex] = value;
              break;
            }
          }
        }
      } else {
        // Cubism 2
        if (!coreModel?.setParamFloat) return;
        
        for (const [blendKey, paramNames] of Object.entries(paramMap)) {
          const value = this.currentBlend[blendKey as keyof ExpressionBlend];
          if (value === undefined) continue;
          
          for (const paramName of paramNames) {
            try {
              coreModel.setParamFloat(paramName, value);
              break;
            } catch {
              // 尝试下一个参数名
            }
          }
        }
      }
    } catch (e) {
      // 静默处理
    }
  }

  /**
   * 获取当前模型的表情映射
   */
  private getExpressionName(expression: Expression): string | null {
    const map = this.cubismVersion >= 3 ? CUBISM3_EXPRESSION_MAP : CUBISM2_EXPRESSION_MAP;
    const mappedName = map[expression];
    
    // 检查映射的表情是否真的存在
    if (this.availableExpressions.length > 0 && !this.availableExpressions.includes(mappedName)) {
      console.warn(`[AvatarController] 表情 "${mappedName}" 不在可用列表中:`, this.availableExpressions);
      // 尝试模糊匹配
      const fuzzy = this.availableExpressions.find(e => 
        e.toLowerCase().includes(expression.toLowerCase()) ||
        (expression === 'happy' && e.toLowerCase().includes('kaixin')) ||
        (expression === 'sad' && e.toLowerCase().includes('shangxin'))
      );
      if (fuzzy) {
        console.log(`[AvatarController] 使用模糊匹配: ${fuzzy}`);
        return fuzzy;
      }
    }
    
    return mappedName;
  }

  /**
   * 设置表情（带过渡动画）
   */
  async setExpression(expression: Expression, options?: { 
    transition?: Partial<TransitionConfig>;
    duration?: number;  // 表情持续时间，0 = 永久
    blend?: boolean;    // 是否使用混合模式
  }) {
    if (!this.model) {
      console.warn('[AvatarController] 模型未绑定');
      return;
    }

    const { 
      transition = DEFAULT_TRANSITION,
      duration = EXPRESSION_DURATIONS[expression],
      blend = true,
    } = options || {};

    // 清除之前的衰减计时器
    if (this.expressionTimeout) {
      clearTimeout(this.expressionTimeout);
      this.expressionTimeout = null;
    }

    // 使用混合模式
    if (blend) {
      this.targetExpression = expression;
      this.targetBlend = { ...EXPRESSION_BLENDS[expression] };
      this.transitionStartTime = Date.now();
      this.transitionDuration = transition.duration || DEFAULT_TRANSITION.duration;
      this.isTransitioning = true;
      
      console.log('[AvatarController] 开始表情过渡:', this.currentExpression, '→', expression);
    }

    // 同时尝试使用模型内置表情
    const expressionName = this.getExpressionName(expression);
    if (expressionName) {
      try {
        await this.model.expression(expressionName);
        console.log('[AvatarController] 表情切换:', expression, '→', expressionName);
      } catch (e) {
        console.error('[AvatarController] 表情切换失败:', e);
      }
    }

    // 设置自动衰减
    if (this.autoDecayEnabled && duration > 0) {
      this.expressionTimeout = setTimeout(() => {
        this.decayToNeutral();
      }, duration);
    }
  }

  /**
   * 设置表情（不带过渡，立即切换）
   */
  async setExpressionImmediate(expression: Expression) {
    if (!this.model) return;

    this.currentExpression = expression;
    this.currentBlend = { ...EXPRESSION_BLENDS[expression] };
    this.targetBlend = { ...EXPRESSION_BLENDS[expression] };
    this.isTransitioning = false;
    
    this.applyBlendToModel();
    
    const expressionName = this.getExpressionName(expression);
    if (expressionName) {
      try {
        await this.model.expression(expressionName);
      } catch (e) {
        // 静默
      }
    }
  }

  /**
   * 衰减回中性表情
   */
  private decayToNeutral() {
    if (this.currentExpression !== 'neutral') {
      console.log('[AvatarController] 表情自动衰减到 neutral');
      this.setExpression('neutral', { 
        transition: { duration: 500, easing: 'easeOut' },
        duration: 0,
      });
    }
  }

  /**
   * 混合两个表情
   */
  blendExpressions(expr1: Expression, expr2: Expression, ratio: number) {
    const blend1 = EXPRESSION_BLENDS[expr1];
    const blend2 = EXPRESSION_BLENDS[expr2];
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    
    const blendKeys = Object.keys(blend1) as (keyof ExpressionBlend)[];
    const result: ExpressionBlend = {};
    
    for (const key of blendKeys) {
      const v1 = blend1[key] ?? 0;
      const v2 = blend2[key] ?? 0;
      result[key] = v1 * (1 - clampedRatio) + v2 * clampedRatio;
    }
    
    this.currentBlend = result;
    this.applyBlendToModel();
  }

  /**
   * 启用/禁用自动衰减
   */
  setAutoDecay(enabled: boolean) {
    this.autoDecayEnabled = enabled;
    if (!enabled && this.expressionTimeout) {
      clearTimeout(this.expressionTimeout);
      this.expressionTimeout = null;
    }
  }

  /**
   * 直接设置原始表情名称（用于调试）
   */
  async setRawExpression(name: string) {
    if (!this.model) return;
    try {
      await this.model.expression(name);
      console.log('[AvatarController] 原始表情:', name);
    } catch (e) {
      console.error('[AvatarController] 原始表情失败:', e);
    }
  }

  /**
   * 播放动作
   */
  async playMotion(group: MotionGroup | string, index?: number) {
    if (!this.model) {
      console.warn('[AvatarController] 模型未绑定');
      return;
    }

    if (this.isPlaying) {
      console.log('[AvatarController] 动作正在播放中，跳过');
      return;
    }

    // 检查动作组是否存在
    if (this.availableMotions.length > 0 && !this.availableMotions.includes(group)) {
      // 尝试映射 Idle → Idle
      const mappedGroup = this.availableMotions.find(m => 
        m.toLowerCase() === group.toLowerCase() ||
        m.toLowerCase().includes(group.toLowerCase())
      );
      if (mappedGroup) {
        group = mappedGroup;
      } else {
        console.warn(`[AvatarController] 动作组 "${group}" 不存在，可用:`, this.availableMotions);
        return;
      }
    }

    try {
      this.isPlaying = true;
      await this.model.motion(group, index);
      console.log('[AvatarController] 动作播放:', group, index);
    } catch (e) {
      console.error('[AvatarController] 动作播放失败:', e);
    } finally {
      this.isPlaying = false;
    }
  }

  /**
   * 随机播放 idle 动作
   */
  playIdleMotion() {
    const idleGroup = this.availableMotions.find(m => m.toLowerCase() === 'idle');
    if (idleGroup) {
      this.playMotion(idleGroup, 0);
    } else {
      this.playMotion('idle', 0);
    }
  }

  /**
   * 挥手动作（适用于 001 模型）
   */
  playWaveMotion() {
    if (this.availableMotions.includes('youshou_goodbye')) {
      this.playMotion('youshou_goodbye');
    } else if (this.availableMotions.includes('zuoshou_goodbye')) {
      this.playMotion('zuoshou_goodbye');
    } else {
      this.playMotion('tap_body');
    }
  }

  /**
   * 口型同步 (用于语音)
   */
  setMouthOpenY(value: number) {
    if (!this.model?.internalModel) return;
    
    // 值范围 0-1
    const clamped = Math.max(0, Math.min(1, value));
    
    // 同时更新混合参数
    this.currentBlend.mouthOpen = clamped;
    
    try {
      const coreModel = this.model.internalModel.coreModel as any;
      
      if (this.cubismVersion >= 3) {
        // Cubism 3/4 模型参数设置
        const model = coreModel?._model;
        if (model) {
          // 尝试多种参数名
          const paramNames = [
            'ParamMouthOpenY',
            'PARAM_MOUTH_OPEN_Y', 
            'Param_Mouth_Open_Y',
            'ParamMouthForm',
          ];
          
          for (const paramName of paramNames) {
            const paramIndex = model.parameters?.ids?.indexOf(paramName);
            if (paramIndex >= 0) {
              model.parameters.values[paramIndex] = clamped;
              break;
            }
          }
        }
      } else {
        // Cubism 2 模型参数
        if (coreModel?.setParamFloat) {
          coreModel.setParamFloat('PARAM_MOUTH_OPEN_Y', clamped);
        }
      }
    } catch (e) {
      // 静默处理
    }
  }

  /**
   * 让角色看向某个位置
   */
  lookAt(x: number, y: number) {
    if (!this.model) return;
    this.model.focus(x, y);
  }

  /**
   * 让角色看向中心
   */
  lookAtCenter() {
    this.lookAt(0, 0);
  }

  /**
   * 获取当前表情
   */
  getCurrentExpression(): Expression {
    return this.currentExpression;
  }

  /**
   * 获取支持的所有表情列表
   */
  getSupportedExpressions(): Expression[] {
    return [
      'neutral', 'happy', 'sad', 'surprised', 'angry', 'fear', 'disgusted',
      'excited', 'proud', 'loving', 'grateful', 'hopeful', 'amused', 'relieved',
      'anxious', 'embarrassed', 'confused', 'bored', 'disappointed', 'lonely',
      'thinking', 'curious', 'determined', 'playful',
    ];
  }

  /**
   * 获取可用表情列表（模型内置）
   */
  getAvailableExpressions(): string[] {
    return [...this.availableExpressions];
  }

  /**
   * 获取可用动作列表
   */
  getAvailableMotions(): string[] {
    return [...this.availableMotions];
  }

  /**
   * 获取 Cubism 版本
   */
  getCubismVersion(): CubismVersion {
    return this.cubismVersion;
  }

  /**
   * 获取当前混合参数
   */
  getCurrentBlend(): ExpressionBlend {
    return { ...this.currentBlend };
  }

  // ========== 生命动画控制 API ==========

  /**
   * 启用/禁用生命动画
   */
  setLifeAnimationEnabled(enabled: boolean) {
    this.lifeAnimationEnabled = enabled;
    
    if (enabled) {
      this.breathStartTime = Date.now();
      this.idleStartTime = Date.now();
      this.scheduleNextBlink();
    } else {
      // 停止眨眼计时器
      if (this.blinkTimeout) {
        clearTimeout(this.blinkTimeout);
        this.blinkTimeout = null;
      }
      this.blinkPhase = 'none';
      this.isBlinking = false;
    }
    
    console.log('[AvatarController] 生命动画:', enabled ? '启用' : '禁用');
  }

  /**
   * 获取生命动画状态
   */
  isLifeAnimationEnabled(): boolean {
    return this.lifeAnimationEnabled;
  }

  /**
   * 配置生命动画参数
   */
  setLifeConfig(config: Partial<LifeAnimationConfig>) {
    if (config.blink) {
      this.lifeConfig.blink = { ...this.lifeConfig.blink, ...config.blink };
    }
    if (config.breath) {
      this.lifeConfig.breath = { ...this.lifeConfig.breath, ...config.breath };
    }
    if (config.idle) {
      this.lifeConfig.idle = { ...this.lifeConfig.idle, ...config.idle };
    }
    console.log('[AvatarController] 生命动画配置更新:', this.lifeConfig);
  }

  /**
   * 获取生命动画配置
   */
  getLifeConfig(): LifeAnimationConfig {
    return { ...this.lifeConfig };
  }

  /**
   * 强制触发一次眨眼
   */
  triggerBlink() {
    if (!this.isBlinking) {
      this.startBlink();
    }
  }

  /**
   * 单独控制眨眼
   */
  setBlinkEnabled(enabled: boolean) {
    this.lifeConfig.blink.enabled = enabled;
    if (enabled && !this.blinkTimeout) {
      this.scheduleNextBlink();
    } else if (!enabled && this.blinkTimeout) {
      clearTimeout(this.blinkTimeout);
      this.blinkTimeout = null;
    }
  }

  /**
   * 单独控制呼吸
   */
  setBreathEnabled(enabled: boolean) {
    this.lifeConfig.breath.enabled = enabled;
    if (enabled) {
      this.breathStartTime = Date.now();
    }
  }

  /**
   * 单独控制待机微动作
   */
  setIdleSwayEnabled(enabled: boolean) {
    this.lifeConfig.idle.enabled = enabled;
    if (enabled) {
      this.idleStartTime = Date.now();
    }
  }

  // ========== Phase 10: Viseme & 微表情系统 ==========

  private visemeEnabled = true;
  private microExpressionEnabled = true;
  private visemeUnsubscribe: (() => void) | null = null;
  private microExpressionUnsubscribe: (() => void) | null = null;

  // 动作队列和物理系统
  private motionQueueEnabled = true;
  private physicsEnabled = true;
  private motionQueueUnsubscribe: (() => void) | null = null;
  private physicsUnsubscribe: (() => void) | null = null;

  /**
   * 初始化 Viseme 和微表情系统
   */
  initAdvancedSystems() {
    // 订阅 Viseme 口型参数
    this.visemeUnsubscribe = visemeDriver.onMouthParams((params) => {
      if (!this.visemeEnabled || !this.model?.internalModel) return;
      
      // 应用口型参数
      this.setMouthOpenY(params.mouthOpenY);
      this.applyMouthWidth(params.mouthWidth);
      this.applyLipRound(params.lipRound);
    });

    // 订阅微表情参数
    this.microExpressionUnsubscribe = microExpressionSystem.onParams((params) => {
      if (!this.microExpressionEnabled || !this.model?.internalModel) return;
      
      // 应用微表情参数
      this.applyMicroExpressionParams(params);
    });

    // 设置动作队列回调
    motionQueueSystem.onPlay((group, index, weight) => {
      if (!this.motionQueueEnabled || !this.model) return;
      this.model.motion(group, index, weight > 0.5 ? 2 : 1);
    });
    
    motionQueueSystem.onStop((group) => {
      if (!this.model) return;
      // Live2D 会自动结束动作
    });
    
    // 设置默认 Idle 动作
    motionQueueSystem.setIdleMotion({
      id: 'default_idle',
      group: 'idle',
      index: 0,
      loop: true,
    });

    // 订阅物理参数
    this.physicsUnsubscribe = physicsEnhancer.onParams((params) => {
      if (!this.physicsEnabled || !this.model?.internalModel) return;
      this.applyPhysicsParams(params);
    });
    
    // 启动物理系统
    physicsEnhancer.start();

    // 启动微表情系统
    microExpressionSystem.start();
    
    console.log('[AvatarController] 高级系统已初始化 (Viseme + 微表情 + 动作队列 + 物理)');
  }

  /**
   * 应用物理参数到模型
   */
  private applyPhysicsParams(params: {
    hairAngleX: number;
    hairAngleZ: number;
    hairSwing: number;
    clothSwing: number;
    skirtAngle: number;
    accessorySwing: number;
    ribbonAngle: number;
    bodyBreath: number;
    shoulderMove: number;
  }) {
    if (!this.model?.internalModel) return;
    
    const coreModel = this.model.internalModel.coreModel as any;
    
    try {
      if (this.cubismVersion >= 3) {
        const model = coreModel?._model;
        if (!model?.parameters) return;
        
        // 头发物理
        this.setParam(model, ['ParamHairFront', 'PARAM_HAIR_FRONT'], params.hairAngleX * 0.5);
        this.setParam(model, ['ParamHairSide', 'PARAM_HAIR_SIDE'], params.hairAngleZ * 0.5);
        this.setParam(model, ['ParamHairBack', 'PARAM_HAIR_BACK'], params.hairSwing * 0.3);
        
        // 身体物理
        this.setParam(model, ['ParamBodyAngleX', 'PARAM_BODY_ANGLE_X'], params.bodyBreath * 2);
        this.setParam(model, ['ParamBodyAngleZ', 'PARAM_BODY_ANGLE_Z'], params.clothSwing * 0.5);
        
        // 饰品物理 (如果模型支持)
        this.setParam(model, ['ParamArmL', 'PARAM_ARM_L'], params.accessorySwing * 0.3);
        this.setParam(model, ['ParamArmR', 'PARAM_ARM_R'], -params.accessorySwing * 0.3);
      }
    } catch (e) {
      // 静默处理
    }
  }

  /**
   * 启用/禁用动作队列系统
   */
  setMotionQueueEnabled(enabled: boolean) {
    this.motionQueueEnabled = enabled;
  }

  /**
   * 启用/禁用物理系统
   */
  setPhysicsEnabled(enabled: boolean) {
    this.physicsEnabled = enabled;
    if (enabled) {
      physicsEnhancer.start();
    } else {
      physicsEnhancer.stop();
    }
  }

  /**
   * 使用动作队列播放动作
   */
  queueMotion(group: string, options?: {
    index?: number;
    priority?: MotionPriority;
    duration?: number;
    fadeIn?: number;
    fadeOut?: number;
  }) {
    motionQueueSystem.requestMotion({
      id: `${group}_${Date.now()}`,
      group,
      index: options?.index ?? 0,
      priority: options?.priority ?? 'gesture',
      duration: options?.duration,
      fadeIn: options?.fadeIn,
      fadeOut: options?.fadeOut,
    });
  }

  /**
   * 播放手势动作
   */
  playGesture(gesture: 'wave' | 'point' | 'goodbye_left' | 'goodbye_right') {
    motionQueueSystem.playGesture(gesture);
  }

  /**
   * 播放反应动作
   */
  playReaction(reaction: 'nod' | 'shake' | 'surprise') {
    motionQueueSystem.playReaction(reaction);
  }

  /**
   * 设置风力
   */
  setWind(enabled: boolean, direction?: number) {
    physicsEnhancer.setWindEnabled(enabled);
    if (direction !== undefined) {
      physicsEnhancer.setWindDirection(direction);
    }
  }

  /**
   * 更新头部位置 (用于物理计算)
   */
  updateHeadPositionForPhysics(x: number, y: number) {
    physicsEnhancer.updateHeadPosition(x, y);
  }

  /**
   * 设置说话状态 (用于物理)
   */
  setSpeakingForPhysics(speaking: boolean, intensity = 0.5) {
    physicsEnhancer.setSpeaking(speaking, intensity);
  }

  /**
   * 启用/禁用 Viseme 口型系统
   */
  setVisemeEnabled(enabled: boolean) {
    this.visemeEnabled = enabled;
    if (!enabled) {
      visemeDriver.stop();
    }
  }

  /**
   * 启用/禁用微表情系统
   */
  setMicroExpressionEnabled(enabled: boolean) {
    this.microExpressionEnabled = enabled;
    if (enabled) {
      microExpressionSystem.start();
    } else {
      microExpressionSystem.stop();
    }
  }

  /**
   * 使用 Viseme 系统播放语音口型
   */
  speakWithViseme(text: string, durationMs: number) {
    const sequence = visemeDriver.generateVisemeSequence(text, durationMs);
    visemeDriver.playSequence(sequence);
    microExpressionSystem.setSpeaking(true);
    
    // 语音结束后重置
    setTimeout(() => {
      microExpressionSystem.setSpeaking(false);
    }, durationMs);
  }

  /**
   * 设置 Viseme (手动控制)
   */
  setViseme(viseme: Viseme) {
    visemeDriver.setViseme(viseme);
  }

  /**
   * 触发反应性微表情
   */
  triggerMicroReaction(type: 'interest' | 'surprise_light' | 'thinking' | 'doubt' | 'agreement' | 'realization') {
    microExpressionSystem.triggerReaction(type);
  }

  /**
   * 基于文本分析触发微表情
   */
  analyzeTextForMicroExpression(text: string) {
    microExpressionSystem.analyzeAndReact(text);
  }

  /**
   * 应用嘴巴宽度参数
   */
  private applyMouthWidth(width: number) {
    if (!this.model?.internalModel) return;
    
    const coreModel = this.model.internalModel.coreModel as any;
    
    try {
      if (this.cubismVersion >= 3) {
        const model = coreModel?._model;
        if (model?.parameters) {
          const paramNames = ['ParamMouthWidth', 'PARAM_MOUTH_WIDTH', 'ParamMouthForm'];
          for (const name of paramNames) {
            const idx = model.parameters.ids?.indexOf(name);
            if (idx >= 0) {
              // 转换为 -1 到 1 范围
              model.parameters.values[idx] = (width - 0.5) * 2;
              break;
            }
          }
        }
      }
    } catch (e) {
      // 静默处理
    }
  }

  /**
   * 应用嘴唇圆润度参数
   */
  private applyLipRound(round: number) {
    if (!this.model?.internalModel) return;
    
    const coreModel = this.model.internalModel.coreModel as any;
    
    try {
      if (this.cubismVersion >= 3) {
        const model = coreModel?._model;
        if (model?.parameters) {
          const paramNames = ['ParamMouthRound', 'PARAM_MOUTH_ROUND'];
          for (const name of paramNames) {
            const idx = model.parameters.ids?.indexOf(name);
            if (idx >= 0) {
              model.parameters.values[idx] = round;
              break;
            }
          }
        }
      }
    } catch (e) {
      // 静默处理
    }
  }

  /**
   * 应用微表情参数
   */
  private applyMicroExpressionParams(params: {
    browL: number;
    browR: number;
    eyeLookX: number;
    eyeLookY: number;
    eyeWideL: number;
    eyeWideR: number;
    mouthCornerL: number;
    mouthCornerR: number;
    cheekPuff: number;
    noseWrinkle: number;
  }) {
    if (!this.model?.internalModel) return;
    
    const coreModel = this.model.internalModel.coreModel as any;
    
    try {
      if (this.cubismVersion >= 3) {
        const model = coreModel?._model;
        if (!model?.parameters) return;
        
        // 眉毛
        this.setParam(model, ['ParamBrowLY', 'PARAM_BROW_L_Y'], params.browL);
        this.setParam(model, ['ParamBrowRY', 'PARAM_BROW_R_Y'], params.browR);
        
        // 眼神 (增量添加，不覆盖鼠标跟随)
        const currentX = this.getParam(model, ['ParamEyeBallX', 'PARAM_EYE_BALL_X']) || 0;
        const currentY = this.getParam(model, ['ParamEyeBallY', 'PARAM_EYE_BALL_Y']) || 0;
        this.setParam(model, ['ParamEyeBallX', 'PARAM_EYE_BALL_X'], currentX + params.eyeLookX);
        this.setParam(model, ['ParamEyeBallY', 'PARAM_EYE_BALL_Y'], currentY + params.eyeLookY);
        
        // 眼睛睁大
        this.setParam(model, ['ParamEyeLWide', 'PARAM_EYE_L_WIDE'], params.eyeWideL);
        this.setParam(model, ['ParamEyeRWide', 'PARAM_EYE_R_WIDE'], params.eyeWideR);
        
        // 嘴角 (仅在不说话时应用)
        if (!microExpressionSystem['isSpeaking']) {
          this.setParam(model, ['ParamMouthCornerL', 'PARAM_MOUTH_CORNER_L'], params.mouthCornerL);
          this.setParam(model, ['ParamMouthCornerR', 'PARAM_MOUTH_CORNER_R'], params.mouthCornerR);
        }
        
        // 鼓腮
        this.setParam(model, ['ParamCheekPuff', 'PARAM_CHEEK_PUFF'], params.cheekPuff);
        
        // 皱鼻 (如果模型支持)
        this.setParam(model, ['ParamNoseWrinkle', 'PARAM_NOSE_WRINKLE'], params.noseWrinkle);
      }
    } catch (e) {
      // 静默处理
    }
  }

  /**
   * 设置模型参数 (辅助方法)
   */
  private setParam(model: any, names: string[], value: number) {
    for (const name of names) {
      const idx = model.parameters?.ids?.indexOf(name);
      if (idx >= 0) {
        model.parameters.values[idx] = value;
        return;
      }
    }
  }

  /**
   * 获取模型参数 (辅助方法)
   */
  private getParam(model: any, names: string[]): number | null {
    for (const name of names) {
      const idx = model.parameters?.ids?.indexOf(name);
      if (idx >= 0) {
        return model.parameters.values[idx];
      }
    }
    return null;
  }

  /**
   * 同步情绪到所有系统
   */
  syncEmotionToSystems(emotion: string) {
    visemeDriver.setEmotion(emotion);
    microExpressionSystem.setEmotion(emotion);
  }

  /**
   * 销毁
   */
  destroy() {
    // 停止动画循环
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // 清除表情衰减计时器
    if (this.expressionTimeout) {
      clearTimeout(this.expressionTimeout);
      this.expressionTimeout = null;
    }
    
    // 清除眨眼计时器
    if (this.blinkTimeout) {
      clearTimeout(this.blinkTimeout);
      this.blinkTimeout = null;
    }
    
    // 清理 Viseme 和微表情系统
    if (this.visemeUnsubscribe) {
      this.visemeUnsubscribe();
      this.visemeUnsubscribe = null;
    }
    if (this.microExpressionUnsubscribe) {
      this.microExpressionUnsubscribe();
      this.microExpressionUnsubscribe = null;
    }
    if (this.physicsUnsubscribe) {
      this.physicsUnsubscribe();
      this.physicsUnsubscribe = null;
    }
    visemeDriver.destroy();
    microExpressionSystem.destroy();
    motionQueueSystem.destroy();
    physicsEnhancer.destroy();
    
    this.model = null;
    this.availableExpressions = [];
    this.availableMotions = [];
    this.isTransitioning = false;
    this.blinkPhase = 'none';
    this.isBlinking = false;
  }
}

// 单例导出
export const avatarController = new AvatarController();
