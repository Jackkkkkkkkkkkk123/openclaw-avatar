/**
 * Avatar Controller - 控制 Live2D 模型的表情和动作
 * 
 * 这是初音未来的灵魂控制器
 */

import type { Live2DModel } from 'pixi-live2d-display';

export type Expression = 'neutral' | 'happy' | 'sad' | 'surprised';
export type MotionGroup = 'idle' | 'tap_body' | 'shake' | 'flick_head';

// 表情映射 (shizuku 模型的表情文件)
const EXPRESSION_MAP: Record<Expression, string> = {
  neutral: 'f01',
  happy: 'f02',
  sad: 'f03',
  surprised: 'f04',
};

export class AvatarController {
  private model: Live2DModel | null = null;
  private currentExpression: Expression = 'neutral';
  private isPlaying = false;

  /**
   * 绑定 Live2D 模型
   */
  bind(model: Live2DModel) {
    this.model = model;
    console.log('[AvatarController] 模型已绑定');
    
    // 打印可用的表情和动作
    if (model.internalModel) {
      console.log('[AvatarController] 模型信息:', {
        expressions: model.internalModel.motionManager?.expressionManager?.definitions,
        motions: model.internalModel.motionManager?.definitions,
      });
    }
  }

  /**
   * 设置表情
   */
  async setExpression(expression: Expression) {
    if (!this.model) {
      console.warn('[AvatarController] 模型未绑定');
      return;
    }

    const expressionName = EXPRESSION_MAP[expression];
    if (!expressionName) {
      console.warn('[AvatarController] 未知表情:', expression);
      return;
    }

    try {
      await this.model.expression(expressionName);
      this.currentExpression = expression;
      console.log('[AvatarController] 表情切换:', expression);
    } catch (e) {
      console.error('[AvatarController] 表情切换失败:', e);
    }
  }

  /**
   * 播放动作
   */
  async playMotion(group: MotionGroup, index?: number) {
    if (!this.model) {
      console.warn('[AvatarController] 模型未绑定');
      return;
    }

    if (this.isPlaying) {
      console.log('[AvatarController] 动作正在播放中，跳过');
      return;
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
    const index = Math.floor(Math.random() * 3);
    this.playMotion('idle', index);
  }

  /**
   * 口型同步 (用于语音)
   */
  setMouthOpenY(value: number) {
    if (!this.model?.internalModel) return;
    
    // 值范围 0-1
    const clamped = Math.max(0, Math.min(1, value));
    
    try {
      // Cubism 2 模型参数
      const coreModel = this.model.internalModel.coreModel as any;
      if (coreModel?.setParamFloat) {
        coreModel.setParamFloat('PARAM_MOUTH_OPEN_Y', clamped);
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
   * 销毁
   */
  destroy() {
    this.model = null;
  }
}

// 单例导出
export const avatarController = new AvatarController();
