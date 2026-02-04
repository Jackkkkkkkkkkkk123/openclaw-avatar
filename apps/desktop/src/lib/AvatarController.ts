/**
 * Avatar Controller - 控制 Live2D 模型的表情和动作
 * 
 * 这是初音未来的灵魂控制器
 */

import type { Live2DModel } from 'pixi-live2d-display';

export type Expression = 'neutral' | 'happy' | 'sad' | 'surprised';
export type MotionGroup = 'idle' | 'tap_body' | 'shake' | 'flick_head' | 'zuoshou' | 'youshou' | 'zuoshou_goodbye' | 'youshou_goodbye';

// Cubism 2 表情映射 (shizuku 模型)
const CUBISM2_EXPRESSION_MAP: Record<Expression, string> = {
  neutral: 'f01',
  happy: 'f02',
  sad: 'f03',
  surprised: 'f04',
};

// Cubism 3 表情映射 (001 模型 - 中文表情)
const CUBISM3_EXPRESSION_MAP: Record<Expression, string> = {
  neutral: 'default111',
  happy: 'kaixin',
  sad: 'shangxin',
  surprised: 'haixiu',  // 害羞作为惊讶的映射
};

type CubismVersion = 2 | 3 | 4;

export class AvatarController {
  private model: Live2DModel | null = null;
  private currentExpression: Expression = 'neutral';
  private isPlaying = false;
  private cubismVersion: CubismVersion = 2;
  private availableExpressions: string[] = [];
  private availableMotions: string[] = [];

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
      });
    }
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
   * 设置表情
   */
  async setExpression(expression: Expression) {
    if (!this.model) {
      console.warn('[AvatarController] 模型未绑定');
      return;
    }

    const expressionName = this.getExpressionName(expression);
    if (!expressionName) {
      console.warn('[AvatarController] 未知表情:', expression);
      return;
    }

    try {
      await this.model.expression(expressionName);
      this.currentExpression = expression;
      console.log('[AvatarController] 表情切换:', expression, '→', expressionName);
    } catch (e) {
      console.error('[AvatarController] 表情切换失败:', e);
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
   * 获取可用表情列表
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
   * 销毁
   */
  destroy() {
    this.model = null;
    this.availableExpressions = [];
    this.availableMotions = [];
  }
}

// 单例导出
export const avatarController = new AvatarController();
