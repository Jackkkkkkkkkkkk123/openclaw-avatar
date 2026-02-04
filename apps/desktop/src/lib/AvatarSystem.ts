/**
 * Avatar System - 整合所有模块的核心系统
 * 
 * 将 OpenClaw 连接、情绪检测、TTS、口型同步统一管理
 */

import { avatarController, type Expression } from './AvatarController';
import { OpenClawConnector, type ConnectionStatus, type MessageChunk } from './OpenClawConnector';
import { detectEmotion, getEmotionDuration } from './EmotionDetector';
import { TTSService, createTTSService, type TTSResult } from './TTSService';
import { LipSyncDriver } from './LipSyncDriver';

export interface AvatarSystemConfig {
  gatewayUrl?: string;
  gatewayToken?: string;
  fishApiKey?: string;
  enableTTS?: boolean;
  enableLipSync?: boolean;
  enableEmotionDetection?: boolean;
}

export interface SystemState {
  connectionStatus: ConnectionStatus;
  isSpeaking: boolean;
  currentEmotion: Expression;
  lastMessage: string;
  processingText: string;
}

type StateChangeCallback = (state: SystemState) => void;
type TextCallback = (text: string, isComplete: boolean) => void;

export class AvatarSystem {
  private connector: OpenClawConnector;
  private ttsService: TTSService | null = null;
  private lipSyncDriver: LipSyncDriver;
  private config: Required<AvatarSystemConfig>;
  
  private stateCallbacks: Set<StateChangeCallback> = new Set();
  private textCallbacks: Set<TextCallback> = new Set();
  
  private state: SystemState = {
    connectionStatus: 'disconnected',
    isSpeaking: false,
    currentEmotion: 'neutral',
    lastMessage: '',
    processingText: '',
  };

  // 情绪恢复定时器
  private emotionResetTimer: ReturnType<typeof setTimeout> | null = null;
  
  // TTS 队列
  private ttsQueue: string[] = [];
  private isProcessingTTS = false;

  constructor(config: AvatarSystemConfig = {}) {
    this.config = {
      gatewayUrl: config.gatewayUrl ?? 'ws://localhost:18789/ws',
      gatewayToken: config.gatewayToken ?? '',
      fishApiKey: config.fishApiKey ?? '',
      enableTTS: config.enableTTS ?? true,
      enableLipSync: config.enableLipSync ?? true,
      enableEmotionDetection: config.enableEmotionDetection ?? true,
    };

    // 初始化连接器
    this.connector = new OpenClawConnector({
      gatewayUrl: this.config.gatewayUrl,
      token: this.config.gatewayToken,
    });

    // 初始化口型同步
    this.lipSyncDriver = new LipSyncDriver({
      smoothing: 0.4,
      sensitivity: 1.2,
    });

    // 初始化 TTS
    if (this.config.fishApiKey && this.config.enableTTS) {
      this.ttsService = createTTSService(this.config.fishApiKey);
    }

    // 设置事件处理
    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers() {
    // 连接状态变化
    this.connector.onStatusChange((status) => {
      this.updateState({ connectionStatus: status });
    });

    // 消息接收
    this.connector.onMessage((chunk) => {
      this.handleMessageChunk(chunk);
    });

    // 口型同步更新
    this.lipSyncDriver.onMouthUpdate((openY) => {
      avatarController.setMouthOpenY(openY);
    });
  }

  /**
   * 处理消息片段
   */
  private handleMessageChunk(chunk: MessageChunk) {
    if (chunk.type === 'text') {
      // 累积文本
      this.updateState({
        processingText: this.state.processingText + chunk.content,
      });

      // 通知文本回调
      this.notifyTextCallbacks(chunk.content, false);

      // 实时情绪检测
      if (this.config.enableEmotionDetection) {
        this.detectAndApplyEmotion(chunk.content);
      }

      // 将句子加入 TTS 队列
      if (this.config.enableTTS && this.ttsService) {
        this.queueTTS(chunk.content);
      }
    } 
    else if (chunk.type === 'end') {
      // 完整消息
      const fullText = chunk.content;
      this.updateState({
        lastMessage: fullText,
        processingText: '',
      });

      // 通知完成
      this.notifyTextCallbacks(fullText, true);

      console.log('[AvatarSystem] 消息完成:', fullText.slice(0, 100));
    }
    else if (chunk.type === 'error') {
      console.error('[AvatarSystem] 消息错误:', chunk.content);
      this.setEmotion('sad');
    }
    else if (chunk.type === 'thinking') {
      console.log('[AvatarSystem] 思考中:', chunk.content.slice(0, 50));
      // 思考时显示中性表情
      this.setEmotion('neutral');
    }
    else if (chunk.type === 'tool') {
      console.log('[AvatarSystem] 工具调用:', chunk.content.slice(0, 100));
    }
  }

  /**
   * 检测并应用情绪
   */
  private detectAndApplyEmotion(text: string) {
    const result = detectEmotion(text);
    
    // 只有置信度足够高才切换表情
    if (result.confidence > 0.3 && result.emotion !== 'neutral') {
      this.setEmotion(result.emotion);
      
      // 设置自动恢复 neutral
      const duration = getEmotionDuration(result);
      this.scheduleEmotionReset(duration);
    }
  }

  /**
   * 设置表情
   */
  setEmotion(emotion: Expression) {
    if (emotion !== this.state.currentEmotion) {
      avatarController.setExpression(emotion);
      this.updateState({ currentEmotion: emotion });
      console.log('[AvatarSystem] 表情切换:', emotion);
    }
  }

  /**
   * 定时恢复 neutral 表情
   */
  private scheduleEmotionReset(delayMs: number) {
    if (this.emotionResetTimer) {
      clearTimeout(this.emotionResetTimer);
    }
    
    this.emotionResetTimer = setTimeout(() => {
      if (!this.state.isSpeaking) {
        this.setEmotion('neutral');
      }
      this.emotionResetTimer = null;
    }, delayMs);
  }

  /**
   * 将文本加入 TTS 队列
   */
  private queueTTS(text: string) {
    // 按句子分割
    const sentences = text.split(/(?<=[。！？.!?])/g).filter(s => s.trim());
    
    for (const sentence of sentences) {
      if (sentence.trim().length > 0) {
        this.ttsQueue.push(sentence.trim());
      }
    }
    
    // 开始处理队列
    this.processTTSQueue();
  }

  /**
   * 处理 TTS 队列
   */
  private async processTTSQueue() {
    if (this.isProcessingTTS || !this.ttsService || this.ttsQueue.length === 0) {
      return;
    }

    this.isProcessingTTS = true;
    this.updateState({ isSpeaking: true });

    while (this.ttsQueue.length > 0) {
      const text = this.ttsQueue.shift()!;
      
      try {
        console.log('[AvatarSystem] TTS 播放:', text);
        
        // 合成语音
        const result = await this.ttsService.synthesize(text);
        
        // 播放并同步口型
        await this.speakWithLipSync(text, result);
      } catch (e) {
        console.error('[AvatarSystem] TTS 错误:', e);
        
        // TTS 失败时使用模拟口型
        if (this.config.enableLipSync) {
          await this.lipSyncDriver.simulateLipSync(text, text.length * 150);
        }
      }
    }

    this.isProcessingTTS = false;
    this.updateState({ isSpeaking: false });
    
    // 恢复 neutral 表情
    this.setEmotion('neutral');
  }

  /**
   * 播放语音并同步口型
   */
  private async speakWithLipSync(_text: string, ttsResult: TTSResult): Promise<void> {
    const audio = new Audio(ttsResult.audioUrl);
    
    // 连接口型同步
    if (this.config.enableLipSync) {
      try {
        await this.lipSyncDriver.connect(audio);
        this.lipSyncDriver.start();
      } catch (e) {
        console.warn('[AvatarSystem] 口型同步连接失败，使用模拟:', e);
      }
    }

    return new Promise((resolve, reject) => {
      audio.onended = () => {
        this.lipSyncDriver.stop();
        resolve();
      };
      
      audio.onerror = (e) => {
        this.lipSyncDriver.stop();
        reject(e);
      };

      audio.play().catch((e) => {
        this.lipSyncDriver.stop();
        reject(e);
      });
    });
  }

  /**
   * 连接 OpenClaw Gateway
   */
  async connect(): Promise<void> {
    await this.connector.connect();
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.connector.disconnect();
    this.ttsService?.stop();
    this.lipSyncDriver.stop();
    this.ttsQueue = [];
    this.isProcessingTTS = false;
  }

  /**
   * 发送消息
   */
  async sendMessage(text: string): Promise<boolean> {
    return this.connector.sendMessage(text);
  }

  /**
   * 中止当前响应
   */
  async abort(): Promise<void> {
    await this.connector.abort();
    this.ttsQueue = [];
    this.isProcessingTTS = false;
    this.updateState({ isSpeaking: false, processingText: '' });
  }

  /**
   * 获取聊天历史
   */
  async getHistory(): Promise<unknown[]> {
    return this.connector.getHistory();
  }

  /**
   * 手动 TTS 播放（用于测试）
   */
  async speak(text: string): Promise<void> {
    if (!this.ttsService) {
      console.warn('[AvatarSystem] TTS 未配置');
      // 使用模拟口型
      await this.lipSyncDriver.simulateLipSync(text, text.length * 150);
      return;
    }

    this.updateState({ isSpeaking: true });
    
    try {
      // 检测情绪
      if (this.config.enableEmotionDetection) {
        this.detectAndApplyEmotion(text);
      }

      const result = await this.ttsService.synthesize(text);
      await this.speakWithLipSync(text, result);
    } finally {
      this.updateState({ isSpeaking: false });
    }
  }

  /**
   * 模拟对话（用于测试，无需 OpenClaw 连接）
   */
  async simulateResponse(text: string): Promise<void> {
    // 检测情绪
    if (this.config.enableEmotionDetection) {
      this.detectAndApplyEmotion(text);
    }

    // 更新状态
    this.updateState({
      lastMessage: text,
      processingText: '',
    });

    // 通知文本回调
    this.notifyTextCallbacks(text, true);

    // 播放 TTS
    await this.speak(text);
  }

  /**
   * 订阅状态变化
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateCallbacks.add(callback);
    // 立即发送当前状态
    callback(this.state);
    return () => this.stateCallbacks.delete(callback);
  }

  /**
   * 订阅文本更新
   */
  onText(callback: TextCallback): () => void {
    this.textCallbacks.add(callback);
    return () => this.textCallbacks.delete(callback);
  }

  /**
   * 获取当前状态
   */
  getState(): SystemState {
    return { ...this.state };
  }

  /**
   * 更新状态
   */
  private updateState(partial: Partial<SystemState>) {
    this.state = { ...this.state, ...partial };
    
    for (const callback of this.stateCallbacks) {
      try {
        callback(this.state);
      } catch (e) {
        console.error('[AvatarSystem] 状态回调错误:', e);
      }
    }
  }

  /**
   * 通知文本回调
   */
  private notifyTextCallbacks(text: string, isComplete: boolean) {
    for (const callback of this.textCallbacks) {
      try {
        callback(text, isComplete);
      } catch (e) {
        console.error('[AvatarSystem] 文本回调错误:', e);
      }
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AvatarSystemConfig>) {
    if (config.fishApiKey && config.fishApiKey !== this.config.fishApiKey) {
      this.ttsService = createTTSService(config.fishApiKey);
      console.log('[AvatarSystem] TTS 服务已更新');
    }
    
    // 更新连接器配置
    const connectorUpdates: { token?: string; gatewayUrl?: string } = {};
    
    if (config.gatewayToken !== undefined) {
      connectorUpdates.token = config.gatewayToken;
    }
    
    if (config.gatewayUrl) {
      connectorUpdates.gatewayUrl = config.gatewayUrl;
    }
    
    if (Object.keys(connectorUpdates).length > 0) {
      this.connector.updateConfig(connectorUpdates);
      console.log('[AvatarSystem] 连接器配置已更新:', Object.keys(connectorUpdates));
    }
    
    this.config = { ...this.config, ...config };
  }

  /**
   * 设置 Gateway Token (便捷方法)
   */
  setGatewayToken(token: string) {
    this.config.gatewayToken = token;
    this.connector.setToken(token);
  }

  /**
   * 销毁
   */
  destroy() {
    this.disconnect();
    this.ttsService?.destroy();
    this.lipSyncDriver.destroy();
    
    if (this.emotionResetTimer) {
      clearTimeout(this.emotionResetTimer);
    }
    
    this.stateCallbacks.clear();
    this.textCallbacks.clear();
  }
}

// 全局实例
export const avatarSystem = new AvatarSystem();
