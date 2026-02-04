/**
 * GestureReactionMapper - 手势到 Avatar 反应映射
 * 定义每种手势触发的 Avatar 行为
 */

import { avatarController, type Expression } from './AvatarController';
import { expressionSequencer } from './ExpressionSequencer';

export type GestureReactionType = 
  | 'expression'     // 切换表情
  | 'sequence'       // 播放表情序列
  | 'motion'         // 播放动作
  | 'wave_back'      // 挥手回应
  | 'nod'            // 点头
  | 'shake_head'     // 摇头
  | 'custom';        // 自定义

export interface GestureReaction {
  type: GestureReactionType;
  expression?: Expression;
  sequenceName?: string;
  motionName?: string;
  duration?: number;
  message?: string;  // 可选的消息反馈
}

export type GestureType =
  | 'none'
  | 'open_palm'
  | 'fist'
  | 'thumbs_up'
  | 'thumbs_down'
  | 'peace'
  | 'pointing'
  | 'wave'
  | 'heart'
  | 'ok'
  | 'rock';

// 默认手势 → 反应映射
const DEFAULT_REACTIONS: Record<GestureType, GestureReaction> = {
  none: { type: 'expression', expression: 'neutral' },
  
  open_palm: { 
    type: 'sequence', 
    sequenceName: 'greeting',
    message: '👋 你好！'
  },
  
  fist: { 
    type: 'expression', 
    expression: 'neutral',
    message: '💪 加油！'
  },
  
  thumbs_up: { 
    type: 'expression', 
    expression: 'happy',
    duration: 3000,
    message: '👍 太棒了！'
  },
  
  thumbs_down: { 
    type: 'expression', 
    expression: 'sad',
    duration: 2000,
    message: '😔 我会改进的...'
  },
  
  peace: { 
    type: 'expression', 
    expression: 'happy',
    duration: 3000,
    message: '✌️ 耶~'
  },
  
  pointing: { 
    type: 'expression', 
    expression: 'surprised',
    message: '👆 那是什么？'
  },
  
  wave: { 
    type: 'wave_back',
    message: '👋 嗨~'
  },
  
  heart: { 
    type: 'sequence', 
    sequenceName: 'excitement',
    message: '❤️ 我也爱你！'
  },
  
  ok: { 
    type: 'nod',
    expression: 'happy',
    message: '👌 没问题！'
  },
  
  rock: { 
    type: 'expression', 
    expression: 'surprised',
    duration: 3000,
    message: '🤘 太酷了！'
  },
};

type ReactionCallback = (gesture: GestureType, reaction: GestureReaction, message?: string) => void;

export class GestureReactionMapper {
  private static instance: GestureReactionMapper | null = null;
  
  private reactions: Record<GestureType, GestureReaction>;
  private callbacks: Set<ReactionCallback> = new Set();
  private enabled = true;
  private lastReactionTime = 0;
  private cooldownMs = 500;  // 反应冷却时间
  
  // 恢复表情的定时器
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private originalExpression: Expression = 'neutral';

  private constructor() {
    this.reactions = { ...DEFAULT_REACTIONS };
  }

  static getInstance(): GestureReactionMapper {
    if (!GestureReactionMapper.instance) {
      GestureReactionMapper.instance = new GestureReactionMapper();
    }
    return GestureReactionMapper.instance;
  }

  /**
   * 处理手势并触发反应
   */
  react(gesture: GestureType): GestureReaction | null {
    if (!this.enabled || gesture === 'none') return null;
    
    const now = Date.now();
    if (now - this.lastReactionTime < this.cooldownMs) {
      return null;  // 冷却中
    }
    
    this.lastReactionTime = now;
    const reaction = this.reactions[gesture];
    
    if (!reaction) return null;
    
    this.executeReaction(reaction);
    this.notifyCallbacks(gesture, reaction);
    
    return reaction;
  }

  /**
   * 执行反应动作
   */
  private executeReaction(reaction: GestureReaction): void {
    // 清除之前的恢复定时器
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    
    // 保存原始表情
    this.originalExpression = avatarController.getCurrentExpression?.() || 'neutral';

    switch (reaction.type) {
      case 'expression':
        if (reaction.expression) {
          avatarController.setExpression(reaction.expression);
          
          // 设置恢复定时器
          if (reaction.duration) {
            this.resetTimer = setTimeout(() => {
              avatarController.setExpression(this.originalExpression);
            }, reaction.duration);
          }
        }
        break;
        
      case 'sequence':
        if (reaction.sequenceName) {
          expressionSequencer.playPreset(reaction.sequenceName as any);
        }
        break;
        
      case 'motion':
        if (reaction.motionName) {
          avatarController.playMotion(reaction.motionName, 0);
        }
        break;
        
      case 'wave_back':
        // 播放挥手动作 + 开心表情
        avatarController.setExpression('happy');
        avatarController.playMotion?.('wave', 0) || 
          avatarController.playMotion?.('tap_body', 0);
        
        // 3秒后恢复
        this.resetTimer = setTimeout(() => {
          avatarController.setExpression(this.originalExpression);
        }, 3000);
        break;
        
      case 'nod':
        // 点头动作 + 表情
        if (reaction.expression) {
          avatarController.setExpression(reaction.expression);
        }
        // 模拟点头：快速上下视线移动
        this.simulateNod();
        break;
        
      case 'shake_head':
        // 摇头动作
        if (reaction.expression) {
          avatarController.setExpression(reaction.expression);
        }
        this.simulateShakeHead();
        break;
        
      case 'custom':
        // 由回调处理
        break;
    }
  }

  /**
   * 模拟点头动作
   */
  private simulateNod(): void {
    const steps = [0.3, 0.7, 0.3, 0.7, 0.5];
    let i = 0;
    
    const animate = () => {
      if (i < steps.length) {
        avatarController.lookAt(0.5, steps[i]);
        i++;
        setTimeout(animate, 150);
      }
    };
    
    animate();
  }

  /**
   * 模拟摇头动作
   */
  private simulateShakeHead(): void {
    const steps = [0.3, 0.7, 0.3, 0.7, 0.5];
    let i = 0;
    
    const animate = () => {
      if (i < steps.length) {
        avatarController.lookAt(steps[i], 0.5);
        i++;
        setTimeout(animate, 150);
      }
    };
    
    animate();
  }

  /**
   * 订阅反应事件
   */
  onReaction(callback: ReactionCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 通知回调
   */
  private notifyCallbacks(gesture: GestureType, reaction: GestureReaction): void {
    this.callbacks.forEach(cb => {
      try {
        cb(gesture, reaction, reaction.message);
      } catch (e) {
        console.error('[GestureReactionMapper] Callback error:', e);
      }
    });
  }

  /**
   * 自定义手势反应
   */
  setReaction(gesture: GestureType, reaction: GestureReaction): void {
    this.reactions[gesture] = reaction;
  }

  /**
   * 获取手势反应配置
   */
  getReaction(gesture: GestureType): GestureReaction {
    return this.reactions[gesture];
  }

  /**
   * 重置为默认反应
   */
  resetToDefaults(): void {
    this.reactions = { ...DEFAULT_REACTIONS };
  }

  /**
   * 启用/禁用
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 设置冷却时间
   */
  setCooldown(ms: number): void {
    this.cooldownMs = ms;
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    this.callbacks.clear();
    GestureReactionMapper.instance = null;
  }
}

export const gestureReactionMapper = GestureReactionMapper.getInstance();
