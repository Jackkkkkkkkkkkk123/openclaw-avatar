/**
 * Avatar System - 整合所有模块的核心系统
 * 
 * 将 OpenClaw 连接、情绪检测、TTS、口型同步统一管理
 * 
 * v4.0 - SOTA Round 6: 情绪上下文引擎
 * - Viseme 精确口型
 * - 微表情系统
 * - 表情序列动画 (复合表情、情绪惯性)
 * - ✨ 情绪上下文引擎 (对话基调、话题识别、情绪惯性)
 */

import { avatarController, type Expression } from './AvatarController';
import { OpenClawConnector, type ConnectionStatus, type MessageChunk } from './OpenClawConnector';
import { OpenClawBridgeConnector } from './OpenClawBridgeConnector';
import { detectEmotion, getEmotionDuration } from './EmotionDetector';
import { TTSService, createTTSService, type TTSResult } from './TTSService';
import { LipSyncDriver } from './LipSyncDriver';
import { visemeDriver } from './VisemeDriver';
import { microExpressionSystem } from './MicroExpressionSystem';
import { expressionSequencer, analyzeTextForSequence } from './ExpressionSequencer';
import { emotionContextEngine, type ConversationTone } from './EmotionContextEngine';
import { headTrackingService, type TrackingData } from './HeadTrackingService';
import { keyboardShortcuts, formatShortcut } from './KeyboardShortcuts';
import { gestureRecognitionService, type GestureResult } from './GestureRecognitionService';
import { gestureReactionMapper, type GestureReaction } from './GestureReactionMapper';
import { expressionVariantSystem, type VariantContext, type VariantSelection } from './ExpressionVariantSystem';
import { 
  sceneDirector, 
  type SceneMode, 
  type SceneState, 
  type SceneElements,
  type SceneChangeEvent 
} from './SceneDirectorSystem';

export interface AvatarSystemConfig {
  gatewayUrl?: string;
  gatewayToken?: string;
  fishApiKey?: string;
  bridgeUrl?: string;       // OpenClaw Bridge URL
  useBridge?: boolean;      // 使用 Bridge 模式
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
  isHeadTrackingActive: boolean;
  headTrackingSupported: boolean;
  isGestureRecognitionActive: boolean;
  lastGesture: string | null;
  lastGestureMessage: string | null;
}

type StateChangeCallback = (state: SystemState) => void;
type TextCallback = (text: string, isComplete: boolean) => void;

export class AvatarSystem {
  private connector: OpenClawConnector;
  private bridgeConnector: OpenClawBridgeConnector;
  private useBridge: boolean = true;  // 默认使用 Bridge
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
    isHeadTrackingActive: false,
    headTrackingSupported: false,
    isGestureRecognitionActive: false,
    lastGesture: null,
    lastGestureMessage: null,
  };
  
  // 头部追踪取消订阅函数
  private headTrackingUnsubscribe: (() => void) | null = null;

  // 手势识别取消订阅函数
  private gestureRecognitionUnsubscribe: (() => void) | null = null;
  private gestureReactionUnsubscribe: (() => void) | null = null;

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
      bridgeUrl: config.bridgeUrl ?? 'http://localhost:12394',
      useBridge: config.useBridge ?? true,
      enableTTS: config.enableTTS ?? true,
      enableLipSync: config.enableLipSync ?? true,
      enableEmotionDetection: config.enableEmotionDetection ?? true,
    };

    this.useBridge = this.config.useBridge ?? true;

    // 初始化 WebSocket 连接器
    this.connector = new OpenClawConnector({
      gatewayUrl: this.config.gatewayUrl,
      token: this.config.gatewayToken,
    });

    // 初始化 Bridge 连接器 (更稳定)
    this.bridgeConnector = new OpenClawBridgeConnector({
      bridgeUrl: this.config.bridgeUrl ?? 'http://localhost:12394',
    });

    // 初始化口型同步
    this.lipSyncDriver = new LipSyncDriver({
      smoothing: 0.4,
      sensitivity: 1.2,
    });

    // 初始化 TTS (API Key 已内置)
    if (this.config.enableTTS) {
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

    // 口型同步更新 (fallback 用)
    this.lipSyncDriver.onMouthUpdate((openY) => {
      // 如果 Viseme 没有启用，使用简单口型同步
      if (!this.useViseme) {
        avatarController.setMouthOpenY(openY);
      }
    });

    // 初始化高级系统 (Viseme + 微表情)
    avatarController.initAdvancedSystems();
    
    console.log('[AvatarSystem] 高级动画系统已启动');
  }

  // 是否使用 Viseme 精确口型 (默认启用)
  private useViseme = true;

  /**
   * 启用/禁用 Viseme 精确口型
   */
  setUseViseme(enabled: boolean) {
    this.useViseme = enabled;
    avatarController.setVisemeEnabled(enabled);
    console.log('[AvatarSystem] Viseme 口型:', enabled ? '启用' : '禁用');
  }

  /**
   * 启用/禁用微表情系统
   */
  setUseMicroExpression(enabled: boolean) {
    avatarController.setMicroExpressionEnabled(enabled);
    console.log('[AvatarSystem] 微表情:', enabled ? '启用' : '禁用');
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
    else if ((chunk as any).type === 'thinking') {
      // 思考时可以显示一个 "思考中" 的状态
      console.log('[AvatarSystem] 🤔 思考中...');
      // 思考时保持当前表情或显示中性
    }
    else if ((chunk as any).type === 'tool') {
      console.log('[AvatarSystem] 🔧 工具调用');
      // 工具调用时可以显示一个忙碌的表情
    }
  }

  // 是否使用情绪上下文引擎 (默认启用)
  private useContextEngine = true;

  /**
   * 启用/禁用情绪上下文引擎
   */
  setUseContextEngine(enabled: boolean) {
    this.useContextEngine = enabled;
    console.log('[AvatarSystem] 情绪上下文引擎:', enabled ? '启用' : '禁用');
  }

  /**
   * 获取对话基调
   */
  getConversationTone(): ConversationTone {
    return emotionContextEngine.getConversationTone();
  }

  /**
   * 获取情绪趋势分析
   */
  getEmotionTrend() {
    return emotionContextEngine.analyzeEmotionTrend();
  }

  /**
   * 获取情绪上下文调试信息
   */
  getEmotionContextDebug(): string {
    return emotionContextEngine.getDebugSummary();
  }

  /**
   * 重置情绪上下文
   */
  resetEmotionContext() {
    emotionContextEngine.reset();
    console.log('[AvatarSystem] 情绪上下文已重置');
  }

  /**
   * 检测并应用情绪 (v4.0 - 带上下文感知)
   */
  private detectAndApplyEmotion(text: string) {
    // 首先尝试匹配表情序列（更丰富的表情反应）
    if (this.useSequencer && analyzeTextForSequence(text)) {
      console.log('[AvatarSystem] 触发表情序列');
      return;
    }
    
    // 基础情绪检测
    const result = detectEmotion(text);
    
    let finalEmotion = result.emotion;
    let finalIntensity = result.confidence;
    
    // 使用上下文引擎增强情绪检测
    if (this.useContextEngine) {
      const contextResult = emotionContextEngine.processText(
        text,
        result.emotion,
        result.confidence
      );
      
      finalEmotion = contextResult.emotion;
      finalIntensity = contextResult.intensity;
      
      // 记录上下文影响
      if (contextResult.influences.length > 1) {
        const sources = contextResult.influences.map(i => `${i.source}:${i.emotion}`).join(', ');
        console.log('[AvatarSystem] 情绪上下文:', sources, '→', finalEmotion);
      }
      
      // SOTA Round 40: 场景导演自动分析
      if (this.useSceneDirector) {
        const tone = emotionContextEngine.getConversationTone();
        sceneDirector.analyzeText(text, finalEmotion, tone.atmosphere);
      }
    }
    
    // 只有置信度足够高才切换表情
    if (finalIntensity > 0.3 && finalEmotion !== 'neutral') {
      let expressionToApply: Expression = finalEmotion;
      
      // SOTA Round 26: 使用表情变体系统选择更丰富的表情
      if (this.useVariantSystem) {
        // 根据文本推断上下文
        const inferredContext = expressionVariantSystem.inferContextFromText(text);
        expressionVariantSystem.setContext(inferredContext);
        
        // 选择表情变体
        const variantSelection = expressionVariantSystem.selectVariant(
          finalEmotion as any, // emotion 转换
          finalIntensity,
          inferredContext
        );
        
        expressionToApply = variantSelection.expression;
        console.log('[AvatarSystem] 变体选择:', 
          `${finalEmotion} → ${expressionToApply}`,
          `(${inferredContext}, ${variantSelection.reason})`
        );
      }
      
      // 使用智能表情切换（带惯性）
      if (this.useSequencer) {
        expressionSequencer.setEmotionSmart(expressionToApply);
      } else {
        this.setEmotion(expressionToApply);
      }
      
      // 设置自动恢复 - 基于上下文调整持续时间
      const baseDuration = getEmotionDuration(result);
      const tone = emotionContextEngine.getConversationTone();
      // 如果对话基调和当前情绪一致，延长持续时间
      const durationMultiplier = tone.baseEmotion === finalEmotion ? 1.5 : 1.0;
      this.scheduleEmotionReset(baseDuration * durationMultiplier);
    }
  }
  
  // 是否使用表情序列系统 (默认启用)
  private useSequencer = true;
  
  // 是否使用表情变体系统 (默认启用) - SOTA Round 26
  private useVariantSystem = true;
  
  // 是否使用场景导演系统 (默认启用) - SOTA Round 40
  private useSceneDirector = true;

  /**
   * 启用/禁用表情变体系统
   */
  setUseVariantSystem(enabled: boolean) {
    this.useVariantSystem = enabled;
    console.log('[AvatarSystem] 表情变体系统:', enabled ? '启用' : '禁用');
  }

  // ========== SOTA Round 40: 场景导演系统 API ==========

  /**
   * 启用/禁用场景导演系统
   */
  setUseSceneDirector(enabled: boolean) {
    this.useSceneDirector = enabled;
    console.log('[AvatarSystem] 场景导演系统:', enabled ? '启用' : '禁用');
  }

  /**
   * 手动切换场景
   */
  setScene(mode: SceneMode, immediate?: boolean) {
    sceneDirector.setScene(mode, { immediate });
    console.log('[AvatarSystem] 场景切换:', mode);
  }

  /**
   * 获取当前场景状态
   */
  getSceneState(): SceneState {
    return sceneDirector.getState();
  }

  /**
   * 获取当前场景元素配置
   */
  getSceneElements(): SceneElements {
    return sceneDirector.getCurrentElements();
  }

  /**
   * 设置场景自动检测
   */
  setSceneAutoMode(enabled: boolean) {
    sceneDirector.setAutoMode(enabled);
    console.log('[AvatarSystem] 场景自动检测:', enabled ? '启用' : '禁用');
  }

  /**
   * 订阅场景变化
   */
  onSceneChange(callback: (event: SceneChangeEvent) => void): () => void {
    return sceneDirector.onSceneChange(callback);
  }

  /**
   * 获取场景建议
   */
  getSceneSuggestion(text: string) {
    const emotion = detectEmotion(text).emotion;
    return sceneDirector.getSuggestion(text, emotion);
  }

  /**
   * 手动选择表情变体
   */
  selectExpressionVariant(emotion: string, intensity?: number, context?: VariantContext): VariantSelection {
    return expressionVariantSystem.selectVariant(emotion as any, intensity, context);
  }

  /**
   * 设置表情变体上下文
   */
  setVariantContext(context: VariantContext): void {
    expressionVariantSystem.setContext(context);
  }

  /**
   * 获取表情变体使用统计
   */
  getVariantStats() {
    return {
      usage: expressionVariantSystem.getUsageStats(),
      context: expressionVariantSystem.getContextStats(),
      history: expressionVariantSystem.getHistory(),
    };
  }

  /**
   * 设置表情
   */
  setEmotion(emotion: Expression) {
    if (emotion !== this.state.currentEmotion) {
      avatarController.setExpression(emotion);
      // 同步情绪到 Viseme 和微表情系统
      avatarController.syncEmotionToSystems(emotion);
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
  private async speakWithLipSync(text: string, ttsResult: TTSResult): Promise<void> {
    const audio = new Audio(ttsResult.audioUrl);
    
    // 估算音频时长 (中文约 5 字/秒)
    const estimatedDuration = Math.max(1000, text.length * 200);
    
    // 标记开始说话
    microExpressionSystem.setSpeaking(true);
    
    // 使用 Viseme 精确口型
    if (this.useViseme && this.config.enableLipSync) {
      // 生成 Viseme 序列并播放
      avatarController.speakWithViseme(text, estimatedDuration);
      
      // 分析文本触发微表情
      avatarController.analyzeTextForMicroExpression(text);
    }
    
    // 同时连接传统口型同步 (作为备用)
    if (this.config.enableLipSync && !this.useViseme) {
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
        visemeDriver.stop();
        microExpressionSystem.setSpeaking(false);
        resolve();
      };
      
      audio.onerror = (e) => {
        this.lipSyncDriver.stop();
        visemeDriver.stop();
        microExpressionSystem.setSpeaking(false);
        reject(e);
      };

      audio.play().catch((e) => {
        this.lipSyncDriver.stop();
        visemeDriver.stop();
        microExpressionSystem.setSpeaking(false);
        reject(e);
      });
    });
  }

  /**
   * 连接 OpenClaw（自动选择 Bridge 或 WebSocket）
   */
  async connect(): Promise<void> {
    if (this.useBridge) {
      console.log('[AvatarSystem] 使用 Bridge 模式连接...');
      try {
        await this.bridgeConnector.connect();
        // 设置 Bridge 消息处理
        this.bridgeConnector.onMessage((chunk) => {
          this.handleMessageChunk(chunk);
        });
        this.bridgeConnector.onStatusChange((status) => {
          this.updateState({ connectionStatus: status });
        });
        console.log('[AvatarSystem] ✅ Bridge 连接成功！初音未来已上线~');
        return;
      } catch (e) {
        console.warn('[AvatarSystem] Bridge 连接失败，尝试 WebSocket:', e);
      }
    }
    
    // 回退到 WebSocket
    console.log('[AvatarSystem] 使用 WebSocket 模式连接...');
    await this.connector.connect();
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.connector.disconnect();
    this.bridgeConnector.disconnect();
    this.ttsService?.stop();
    this.lipSyncDriver.stop();
    this.ttsQueue = [];
    this.isProcessingTTS = false;
  }

  /**
   * 发送消息
   */
  async sendMessage(text: string): Promise<boolean> {
    if (this.useBridge && this.bridgeConnector.getStatus() === 'connected') {
      return this.bridgeConnector.sendMessage(text);
    }
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

  // ========== 表情序列系统 API ==========

  /**
   * 启用/禁用表情序列系统
   */
  setUseSequencer(enabled: boolean) {
    this.useSequencer = enabled;
    console.log('[AvatarSystem] 表情序列系统:', enabled ? '启用' : '禁用');
  }

  /**
   * 播放预定义的表情序列
   */
  playSequence(name: string): boolean {
    return expressionSequencer.playPreset(name as any);
  }

  /**
   * 获取可用的表情序列列表
   */
  getAvailableSequences(): string[] {
    return expressionSequencer.getPresetNames();
  }

  /**
   * 停止当前表情序列
   */
  stopSequence() {
    expressionSequencer.stop();
  }

  /**
   * 获取表情序列系统状态
   */
  getSequencerState() {
    return {
      isPlaying: expressionSequencer.isSequencePlaying(),
      currentSequence: expressionSequencer.getCurrentSequenceName(),
      emotionState: expressionSequencer.getEmotionState(),
      emotionHistory: expressionSequencer.getEmotionHistory(),
    };
  }

  // ========== 头部追踪 API ==========

  /**
   * 检查头部追踪是否支持
   */
  async checkHeadTrackingSupport(): Promise<boolean> {
    const supported = await headTrackingService.constructor.isSupported?.() ?? 
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    this.updateState({ headTrackingSupported: supported });
    return supported;
  }

  /**
   * 启动头部追踪
   */
  async startHeadTracking(): Promise<void> {
    try {
      // 初始化服务
      await headTrackingService.init();
      
      // 订阅追踪数据
      this.headTrackingUnsubscribe = headTrackingService.onTracking((data: TrackingData) => {
        this.handleHeadTrackingData(data);
      });
      
      // 启动追踪
      await headTrackingService.start();
      
      this.updateState({ isHeadTrackingActive: true });
      console.log('[AvatarSystem] ✅ 头部追踪已启动');
    } catch (err) {
      console.error('[AvatarSystem] 头部追踪启动失败:', err);
      throw err;
    }
  }

  /**
   * 停止头部追踪
   */
  stopHeadTracking(): void {
    if (this.headTrackingUnsubscribe) {
      this.headTrackingUnsubscribe();
      this.headTrackingUnsubscribe = null;
    }
    
    headTrackingService.stop();
    this.updateState({ isHeadTrackingActive: false });
    console.log('[AvatarSystem] 头部追踪已停止');
  }

  /**
   * 处理头部追踪数据
   */
  private handleHeadTrackingData(data: TrackingData): void {
    // 更新 Avatar 视线位置
    const screenX = (data.pose.x + 1) / 2;  // 转换到 0-1
    const screenY = (data.pose.y + 1) / 2;
    avatarController.lookAt(screenX, screenY);
    
    // 可选: 根据用户表情同步 Avatar 表情
    if (data.expression.detectedEmotion && data.expression.detectedEmotion !== 'neutral') {
      // 用户微笑时，Avatar 也微笑
      if (data.expression.mouthSmile > 0.5 && this.state.currentEmotion === 'neutral') {
        this.setEmotion('happy');
      }
    }
    
    // 根据眼睛状态触发眨眼
    if (data.expression.leftEyeOpen < 0.2 && data.expression.rightEyeOpen < 0.2) {
      avatarController.triggerBlink?.();
    }
  }

  /**
   * 获取头部追踪状态
   */
  getHeadTrackingStatus(): { active: boolean; supported: boolean } {
    return {
      active: this.state.isHeadTrackingActive,
      supported: this.state.headTrackingSupported,
    };
  }

  // ========== 键盘快捷键 API ==========

  /**
   * 初始化键盘快捷键
   */
  initKeyboardShortcuts(callbacks: {
    onToggleChat?: () => void;
    onToggleSettings?: () => void;
    onToggleVoice?: () => void;
    onToggleTracking?: () => void;
    onExpressionChange?: (emotion: Expression) => void;
    onFocusInput?: () => void;
    onSendMessage?: () => void;
    onClearChat?: () => void;
    onToggleTheme?: () => void;
    onToggleFullscreen?: () => void;
    onEscape?: () => void;
    onHelp?: () => void;
  }): void {
    keyboardShortcuts.init();
    
    keyboardShortcuts.registerDefaults({
      'toggle-chat': callbacks.onToggleChat,
      'toggle-settings': callbacks.onToggleSettings,
      'toggle-voice': callbacks.onToggleVoice,
      'toggle-tracking': callbacks.onToggleTracking ?? (() => {
        if (this.state.isHeadTrackingActive) {
          this.stopHeadTracking();
        } else {
          this.startHeadTracking().catch(console.error);
        }
      }),
      'expression-happy': () => callbacks.onExpressionChange?.('happy') ?? this.setEmotion('happy'),
      'expression-sad': () => callbacks.onExpressionChange?.('sad') ?? this.setEmotion('sad'),
      'expression-surprised': () => callbacks.onExpressionChange?.('surprised') ?? this.setEmotion('surprised'),
      'expression-neutral': () => callbacks.onExpressionChange?.('neutral') ?? this.setEmotion('neutral'),
      'focus-input': callbacks.onFocusInput,
      'send-message': callbacks.onSendMessage,
      'clear-chat': callbacks.onClearChat,
      'toggle-theme': callbacks.onToggleTheme,
      'toggle-fullscreen': callbacks.onToggleFullscreen ?? (() => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      }),
      'escape': callbacks.onEscape,
      'help': callbacks.onHelp,
    });
    
    console.log('[AvatarSystem] ✅ 键盘快捷键已初始化');
  }

  /**
   * 获取所有快捷键
   */
  getKeyboardShortcuts() {
    return keyboardShortcuts.getAll();
  }

  /**
   * 格式化快捷键显示
   */
  formatShortcut(keys: string[]): string {
    return formatShortcut(keys);
  }

  // ========== 手势识别 API ==========

  /**
   * 启动手势识别
   */
  async startGestureRecognition(): Promise<void> {
    try {
      // 初始化并启动手势识别
      const success = await gestureRecognitionService.start();
      
      if (!success) {
        throw new Error('手势识别启动失败');
      }
      
      // 订阅手势事件
      this.gestureRecognitionUnsubscribe = gestureRecognitionService.onGesture((result: GestureResult) => {
        this.handleGestureResult(result);
      });
      
      // 订阅反应事件
      this.gestureReactionUnsubscribe = gestureReactionMapper.onReaction((gesture, reaction, message) => {
        this.updateState({
          lastGesture: gesture,
          lastGestureMessage: message || null,
        });
      });
      
      this.updateState({ isGestureRecognitionActive: true });
      console.log('[AvatarSystem] ✅ 手势识别已启动');
    } catch (err) {
      console.error('[AvatarSystem] 手势识别启动失败:', err);
      throw err;
    }
  }

  /**
   * 停止手势识别
   */
  stopGestureRecognition(): void {
    if (this.gestureRecognitionUnsubscribe) {
      this.gestureRecognitionUnsubscribe();
      this.gestureRecognitionUnsubscribe = null;
    }
    
    if (this.gestureReactionUnsubscribe) {
      this.gestureReactionUnsubscribe();
      this.gestureReactionUnsubscribe = null;
    }
    
    gestureRecognitionService.stop();
    this.updateState({ 
      isGestureRecognitionActive: false,
      lastGesture: null,
      lastGestureMessage: null,
    });
    console.log('[AvatarSystem] 手势识别已停止');
  }

  /**
   * 处理手势识别结果
   */
  private handleGestureResult(result: GestureResult): void {
    // 使用 GestureReactionMapper 处理手势
    gestureReactionMapper.react(result.gesture);
    
    console.log('[AvatarSystem] 检测到手势:', result.gesture, '置信度:', result.confidence);
  }

  /**
   * 获取手势识别状态
   */
  getGestureRecognitionStatus(): { 
    active: boolean; 
    lastGesture: string | null;
    lastMessage: string | null;
  } {
    return {
      active: this.state.isGestureRecognitionActive,
      lastGesture: this.state.lastGesture,
      lastMessage: this.state.lastGestureMessage,
    };
  }

  /**
   * 设置手势反应启用状态
   */
  setGestureReactionEnabled(enabled: boolean): void {
    gestureReactionMapper.setEnabled(enabled);
  }

  /**
   * 自定义手势反应
   */
  setGestureReaction(gesture: string, reaction: GestureReaction): void {
    gestureReactionMapper.setReaction(gesture as any, reaction);
  }

  /**
   * 销毁
   */
  destroy() {
    this.disconnect();
    this.ttsService?.destroy();
    this.lipSyncDriver.destroy();
    expressionSequencer.destroy();
    
    // 停止头部追踪
    this.stopHeadTracking();
    headTrackingService.destroy();
    
    // 停止手势识别
    this.stopGestureRecognition();
    gestureRecognitionService.destroy();
    gestureReactionMapper.destroy();
    
    // 销毁键盘快捷键
    keyboardShortcuts.destroy();
    
    if (this.emotionResetTimer) {
      clearTimeout(this.emotionResetTimer);
    }
    
    this.stateCallbacks.clear();
    this.textCallbacks.clear();
  }
}

// 全局实例
export const avatarSystem = new AvatarSystem();
