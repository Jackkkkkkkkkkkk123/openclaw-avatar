/**
 * MikuFileBridge - 初音未来的文件系统灵魂桥接
 * 
 * 通过文件系统让我（初音未来 AI）直接控制 Avatar 身体
 * 使用 Tauri fs API 监听命令文件
 */

import { avatarController, type Expression, type MotionGroup } from './AvatarController';
import { avatarSystem } from './AvatarSystem';
import { readTextFile, watchImmediate } from '@tauri-apps/plugin-fs';
import { appDataDir } from '@tauri-apps/api/path';

// 命令文件路径
const COMMAND_FILENAME = 'miku-command.json';

export interface MikuCommand {
  id: string;
  timestamp: number;
  type: 'expression' | 'motion' | 'speak' | 'emotion' | 'scene' | 'gesture' | 'composite';
  payload: {
    expression?: Expression;
    motion?: MotionGroup;
    text?: string;
    emotion?: string;
    scene?: string;
    gesture?: string;
    // 复合命令
    actions?: MikuCommand[];
  };
}

export interface MikuState {
  connected: boolean;
  currentExpression: Expression;
  isSpeaking: boolean;
  lastCommand: MikuCommand | null;
  lastCommandId: string | null;
  timestamp: number;
}

class MikuFileBridge {
  private state: MikuState = {
    connected: false,
    currentExpression: 'neutral',
    isSpeaking: false,
    lastCommand: null,
    lastCommandId: null,
    timestamp: Date.now()
  };

  private unwatch: (() => void) | null = null;
  private commandFilePath: string = '';
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * 启动文件监听服务
   */
  async start() {
    console.log('[MikuFileBridge] 🎵 灵魂桥接启动...');
    
    try {
      // 获取应用数据目录
      const dataDir = await appDataDir();
      this.commandFilePath = `${dataDir}${COMMAND_FILENAME}`;
      console.log('[MikuFileBridge] 命令文件路径:', this.commandFilePath);

      // 尝试使用 Tauri fs watch（如果可用）
      try {
        this.unwatch = await watchImmediate(
          this.commandFilePath,
          (event) => {
            console.log('[MikuFileBridge] 文件变化:', event);
            this.checkCommands();
          },
          { recursive: false }
        );
        console.log('[MikuFileBridge] ✅ 文件监听已启动');
      } catch (watchErr) {
        console.warn('[MikuFileBridge] 文件监听不可用，使用轮询:', watchErr);
        // 降级到轮询模式
        this.pollInterval = setInterval(() => this.checkCommands(), 200);
      }

      // 同时使用简单的 /tmp 目录作为备用
      this.startTmpPolling();

      this.state.connected = true;
      console.log('[MikuFileBridge] ✅ 初音未来已连接到这个身体！');
      
      return true;
    } catch (e) {
      console.error('[MikuFileBridge] 启动失败:', e);
      // 降级到 /tmp 轮询
      this.startTmpPolling();
      this.state.connected = true;
      return true;
    }
  }

  /**
   * 启动 /tmp 目录轮询（最可靠的方式）
   */
  private startTmpPolling() {
    if (this.pollInterval) return;
    
    console.log('[MikuFileBridge] 启动 /tmp 轮询模式');
    this.pollInterval = setInterval(() => {
      this.checkTmpCommand();
    }, 200); // 200ms 轮询，足够快
  }

  /**
   * 检查 /tmp 目录的命令文件
   */
  private async checkTmpCommand() {
    try {
      // 直接读取 /tmp/miku-command.json
      const response = await fetch('tauri://localhost/tmp/miku-command.json');
      if (!response.ok) return;
      
      const cmd = await response.json() as MikuCommand;
      this.processCommand(cmd);
    } catch {
      // 文件不存在或解析错误，正常情况
    }
  }

  /**
   * 检查命令文件（Tauri fs 版本）
   */
  private async checkCommands() {
    try {
      const content = await readTextFile(this.commandFilePath);
      if (!content) return;
      
      const cmd = JSON.parse(content) as MikuCommand;
      this.processCommand(cmd);
    } catch {
      // 文件不存在或解析错误，正常情况
    }
  }

  /**
   * 处理命令
   */
  private processCommand(cmd: MikuCommand) {
    // 检查是否已处理过
    if (cmd.id === this.state.lastCommandId) return;
    
    console.log('[MikuFileBridge] 🎬 收到命令:', cmd.type, cmd.payload);
    this.state.lastCommandId = cmd.id;
    this.state.lastCommand = cmd;
    this.state.timestamp = Date.now();
    
    this.executeCommand(cmd);
  }

  /**
   * 停止服务
   */
  stop() {
    if (this.unwatch) {
      this.unwatch();
      this.unwatch = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.state.connected = false;
    console.log('[MikuFileBridge] 灵魂桥接已断开');
  }

  /**
   * 执行命令
   */
  async executeCommand(cmd: MikuCommand) {
    switch (cmd.type) {
      case 'expression':
        if (cmd.payload.expression) {
          avatarController.setExpression(cmd.payload.expression);
          this.state.currentExpression = cmd.payload.expression;
          console.log('[MikuFileBridge] 😊 切换表情:', cmd.payload.expression);
        }
        break;

      case 'motion':
        if (cmd.payload.motion) {
          avatarController.playMotion(cmd.payload.motion);
          console.log('[MikuFileBridge] 💃 播放动作:', cmd.payload.motion);
        }
        break;

      case 'speak':
        if (cmd.payload.text) {
          this.state.isSpeaking = true;
          console.log('[MikuFileBridge] 🎤 说话:', cmd.payload.text.slice(0, 50));
          await avatarSystem.speak(cmd.payload.text);
          this.state.isSpeaking = false;
        }
        break;

      case 'emotion':
        // 情感命令 - 自动映射到表情
        if (cmd.payload.emotion) {
          const expr = this.emotionToExpression(cmd.payload.emotion);
          avatarController.setExpression(expr);
          this.state.currentExpression = expr;
          console.log('[MikuFileBridge] 💝 情感:', cmd.payload.emotion, '→', expr);
        }
        break;

      case 'composite':
        // 复合命令 - 按顺序执行多个动作
        if (cmd.payload.actions) {
          console.log('[MikuFileBridge] 🎭 复合命令, 共', cmd.payload.actions.length, '个动作');
          for (const action of cmd.payload.actions) {
            await this.executeCommand(action);
            // 动作间短暂延迟
            await new Promise(r => setTimeout(r, 100));
          }
        }
        break;

      case 'gesture':
        console.log('[MikuFileBridge] 🖐️ 手势:', cmd.payload.gesture);
        // TODO: 实现手势系统
        break;

      default:
        console.warn('[MikuFileBridge] 未知命令类型:', cmd.type);
    }
  }

  /**
   * 情感词到表情的映射
   */
  private emotionToExpression(emotion: string): Expression {
    const mapping: Record<string, Expression> = {
      // 积极情感
      'happy': 'happy',
      'joy': 'happy',
      'excited': 'excited',
      'proud': 'proud',
      'love': 'loving',
      'grateful': 'grateful',
      'hopeful': 'hopeful',
      'playful': 'playful',
      'mischievous': 'mischievous',
      
      // 消极情感
      'sad': 'sad',
      'angry': 'angry',
      'fear': 'fear',
      'worried': 'worried',
      'embarrassed': 'embarrassed',
      'guilty': 'guilty',
      'lonely': 'lonely',
      
      // 中性情感
      'neutral': 'neutral',
      'thinking': 'thinking',
      'curious': 'curious',
      'confused': 'confused',
      'surprised': 'surprised',
      'sleepy': 'sleepy',
      'determined': 'determined',
    };
    
    return mapping[emotion.toLowerCase()] || 'neutral';
  }

  /**
   * 获取当前状态
   */
  getState(): MikuState {
    return { ...this.state };
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.state.connected;
  }
}

// 导出单例
export const mikuFileBridge = new MikuFileBridge();

// 默认导出
export default mikuFileBridge;
