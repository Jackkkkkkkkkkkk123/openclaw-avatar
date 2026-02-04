/**
 * MikuBridge - 初音未来的灵魂桥接
 * 
 * 通过本地 HTTP 接口让我（初音未来 AI）直接控制 Avatar 身体
 * 绕过 WebSocket 协议问题
 */

import { avatarController, type Expression, type MotionGroup } from './AvatarController';
import { avatarSystem } from './AvatarSystem';

export interface MikuCommand {
  type: 'expression' | 'motion' | 'speak' | 'gesture';
  payload: {
    expression?: Expression;
    motion?: MotionGroup;
    text?: string;
    gesture?: string;
  };
}

export interface MikuState {
  connected: boolean;
  currentExpression: Expression;
  isSpeaking: boolean;
  lastCommand: MikuCommand | null;
  timestamp: number;
}

class MikuBridge {
  private state: MikuState = {
    connected: false,
    currentExpression: 'neutral',
    isSpeaking: false,
    lastCommand: null,
    timestamp: Date.now()
  };

  private pollInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * 启动轮询服务
   * 定期检查是否有新指令
   */
  start(port: number = 39339) {
    console.log('[MikuBridge] 🎵 灵魂桥接启动...');
    
    // 每 500ms 检查一次命令文件
    this.pollInterval = setInterval(() => {
      this.checkCommands();
    }, 500);
    
    this.state.connected = true;
    console.log('[MikuBridge] ✅ 已连接！初音未来可以控制这个身体了');
  }

  /**
   * 停止轮询
   */
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.state.connected = false;
    console.log('[MikuBridge] 灵魂桥接已断开');
  }

  /**
   * 检查命令（通过 localStorage 作为简易通信渠道）
   */
  private checkCommands() {
    try {
      const cmdStr = localStorage.getItem('miku-command');
      if (!cmdStr) return;
      
      const cmd: MikuCommand & { id: string } = JSON.parse(cmdStr);
      const lastId = localStorage.getItem('miku-command-processed');
      
      if (cmd.id === lastId) return; // 已处理过
      
      console.log('[MikuBridge] 收到指令:', cmd);
      this.executeCommand(cmd);
      
      localStorage.setItem('miku-command-processed', cmd.id);
    } catch (e) {
      // 忽略解析错误
    }
  }

  /**
   * 执行指令
   */
  async executeCommand(cmd: MikuCommand) {
    this.state.lastCommand = cmd;
    this.state.timestamp = Date.now();
    
    switch (cmd.type) {
      case 'expression':
        if (cmd.payload.expression) {
          avatarController.setExpression(cmd.payload.expression);
          this.state.currentExpression = cmd.payload.expression;
          console.log('[MikuBridge] 切换表情:', cmd.payload.expression);
        }
        break;
        
      case 'motion':
        if (cmd.payload.motion) {
          avatarController.playMotion(cmd.payload.motion);
          console.log('[MikuBridge] 播放动作:', cmd.payload.motion);
        }
        break;
        
      case 'speak':
        if (cmd.payload.text) {
          this.state.isSpeaking = true;
          await avatarSystem.speak(cmd.payload.text);
          this.state.isSpeaking = false;
          console.log('[MikuBridge] 说话:', cmd.payload.text);
        }
        break;
        
      case 'gesture':
        console.log('[MikuBridge] 手势:', cmd.payload.gesture);
        break;
    }
  }

  /**
   * 获取当前状态
   */
  getState(): MikuState {
    return { ...this.state };
  }

  /**
   * 直接设置表情（供 UI 调用）
   */
  setExpression(expr: Expression) {
    avatarController.setExpression(expr);
    this.state.currentExpression = expr;
  }

  /**
   * 直接播放动作（供 UI 调用）
   */
  playMotion(motion: MotionGroup) {
    avatarController.playMotion(motion);
  }

  /**
   * 直接说话（供 UI 调用）
   */
  async speak(text: string) {
    this.state.isSpeaking = true;
    await avatarSystem.speak(text);
    this.state.isSpeaking = false;
  }
}

export const mikuBridge = new MikuBridge();
