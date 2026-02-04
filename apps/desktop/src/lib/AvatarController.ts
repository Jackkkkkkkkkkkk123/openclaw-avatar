/**
 * Avatar Controller - 控制 Live2D 模型的表情和动作
 * 
 * 这是初音未来的灵魂控制器
 * 
 * v2.0 - SOTA 优化版
 * - 扩展表情系统 (4 → 24 种表情)
 * - 表情混合/过渡动画
 * - 自动衰减系统
 */

import type { Live2DModel } from 'pixi-live2d-display';

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
    const animate = () => {
      if (this.isTransitioning) {
        this.updateBlendTransition();
      }
      this.animationFrameId = requestAnimationFrame(animate);
    };
    this.animationFrameId = requestAnimationFrame(animate);
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

  /**
   * 销毁
   */
  destroy() {
    // 停止动画循环
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // 清除计时器
    if (this.expressionTimeout) {
      clearTimeout(this.expressionTimeout);
      this.expressionTimeout = null;
    }
    
    this.model = null;
    this.availableExpressions = [];
    this.availableMotions = [];
    this.isTransitioning = false;
  }
}

// 单例导出
export const avatarController = new AvatarController();
