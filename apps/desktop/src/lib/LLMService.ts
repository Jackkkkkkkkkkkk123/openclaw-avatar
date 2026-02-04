/**
 * LLMService - 通过 OpenClaw Gateway 调用真实 LLM
 * 
 * 提供同步和异步 API 用于：
 * - 情绪分析
 * - 意图识别
 * - 上下文理解
 * - 响应风格建议
 */

// 延迟导入以避免在测试环境中的 localStorage 问题
let _openClawConnector: any = null;
let _connectorPromise: Promise<any> | null = null;

async function getConnectorAsync() {
  if (_openClawConnector) {
    return _openClawConnector;
  }
  
  if (!_connectorPromise) {
    _connectorPromise = import('./OpenClawConnector')
      .then(module => {
        _openClawConnector = module.getOpenClawConnector();
        console.log('[LLMService] OpenClawConnector loaded successfully');
        return _openClawConnector;
      })
      .catch(e => {
        console.warn('[LLMService] Failed to load OpenClawConnector:', e);
        _connectorPromise = null;
        return null;
      });
  }
  
  return _connectorPromise;
}

function getConnector() {
  // 同步版本 - 返回已加载的 connector 或 null
  return _openClawConnector;
}

export interface MessageChunk {
  type: 'text' | 'end' | 'error';
  content: string;
  timestamp: number;
}

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  text: string;
  success: boolean;
  error?: string;
}

export interface EmotionAnalysisResult {
  emotion: string;
  confidence: number;
  reasoning: string;
  alternatives: Array<{ emotion: string; confidence: number }>;
}

export interface IntentAnalysisResult {
  intent: string;
  confidence: number;
  entities: string[];
  reasoning: string;
}

export interface ContextAnalysisResult {
  topic: string;
  phase: string;
  userEngagement: number;
  suggestedEmotion: string;
  suggestedStyle: {
    formality: number;
    enthusiasm: number;
    empathy: number;
    verbosity: number;
    humor: number;
  };
  reasoning: string;
}

// 系统提示词
const EMOTION_ANALYSIS_SYSTEM = `你是情绪分析专家。分析用户文本的情绪，返回 JSON 格式：
{
  "emotion": "主要情绪(neutral/happy/sad/angry/surprised/fear/excited/calm/confused/thinking/shy/grateful/hopeful)",
  "confidence": 0.0-1.0,
  "reasoning": "分析理由",
  "alternatives": [{"emotion": "备选情绪", "confidence": 0.0-1.0}]
}
只返回 JSON，不要其他内容。`;

const INTENT_ANALYSIS_SYSTEM = `你是意图识别专家。分析用户文本的意图，返回 JSON 格式：
{
  "intent": "主要意图(seek_info/seek_help/share_feeling/make_request/express_opinion/social_chat/confirm/reject/continue/change_topic)",
  "confidence": 0.0-1.0,
  "entities": ["提取的实体"],
  "reasoning": "分析理由"
}
只返回 JSON，不要其他内容。`;

const CONTEXT_ANALYSIS_SYSTEM = `你是对话上下文分析专家。分析对话历史，返回 JSON 格式：
{
  "topic": "话题类别(casual/question/story/emotion/task/creative/technical)",
  "phase": "对话阶段(greeting/warming/main/deepening/wrapping/farewell)",
  "userEngagement": 0.0-1.0,
  "suggestedEmotion": "建议的 Avatar 情绪",
  "suggestedStyle": {
    "formality": 0.0-1.0,
    "enthusiasm": 0.0-1.0,
    "empathy": 0.0-1.0,
    "verbosity": 0.0-1.0,
    "humor": 0.0-1.0
  },
  "reasoning": "分析理由"
}
只返回 JSON，不要其他内容。`;

type LLMCallback = (response: LLMResponse) => void;

class LLMServiceImpl {
  private pendingCallbacks: Map<string, LLMCallback> = new Map();
  private currentRequestId: string | null = null;
  private responseBuffer: string = '';
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  
  constructor() {
    // 异步初始化 connector
    this.initPromise = this.initializeAsync();
  }
  
  private async initializeAsync(): Promise<void> {
    const connector = await getConnectorAsync();
    if (connector) {
      this.setupMessageHandler(connector);
    }
  }
  
  private setupMessageHandler(connector: any) {
    if (this.isInitialized) return;
    this.isInitialized = true;
    
    console.log('[LLMService] Setting up message handler');
    
    connector.onMessage((chunk: MessageChunk) => {
      if (!this.currentRequestId) return;
      
      if (chunk.type === 'text') {
        this.responseBuffer += chunk.content;
      } else if (chunk.type === 'end') {
        const callback = this.pendingCallbacks.get(this.currentRequestId);
        if (callback) {
          callback({
            text: this.responseBuffer || chunk.content,
            success: true
          });
          this.pendingCallbacks.delete(this.currentRequestId);
        }
        this.currentRequestId = null;
        this.responseBuffer = '';
      } else if (chunk.type === 'error') {
        const callback = this.pendingCallbacks.get(this.currentRequestId);
        if (callback) {
          callback({
            text: '',
            success: false,
            error: chunk.content
          });
          this.pendingCallbacks.delete(this.currentRequestId);
        }
        this.currentRequestId = null;
        this.responseBuffer = '';
      }
    });
  }
  
  /**
   * 等待初始化完成
   */
  async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }
  
  /**
   * 检查是否已连接到 OpenClaw
   */
  isConnected(): boolean {
    const connector = getConnector();
    return connector ? connector.getStatus() === 'connected' : false;
  }
  
  /**
   * 发送 LLM 请求
   */
  async query(request: LLMRequest): Promise<LLMResponse> {
    // 确保 connector 已加载
    await this.waitForInit();
    
    const connector = getConnector();
    
    if (!connector || connector.getStatus() !== 'connected') {
      return {
        text: '',
        success: false,
        error: 'Not connected to OpenClaw Gateway'
      };
    }
    
    return new Promise((resolve) => {
      const requestId = `llm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      this.currentRequestId = requestId;
      this.responseBuffer = '';
      
      // 设置超时
      const timeout = setTimeout(() => {
        if (this.pendingCallbacks.has(requestId)) {
          this.pendingCallbacks.delete(requestId);
          resolve({
            text: '',
            success: false,
            error: 'Request timeout'
          });
          this.currentRequestId = null;
          this.responseBuffer = '';
        }
      }, 30000);
      
      this.pendingCallbacks.set(requestId, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });
      
      // 构建消息
      const message = request.systemPrompt 
        ? `[系统指令]\n${request.systemPrompt}\n\n[用户输入]\n${request.prompt}`
        : request.prompt;
      
      connector.sendMessage(message, {
        thinkingLevel: 'off'
      }).catch((e) => {
        clearTimeout(timeout);
        this.pendingCallbacks.delete(requestId);
        resolve({
          text: '',
          success: false,
          error: e.message
        });
        this.currentRequestId = null;
        this.responseBuffer = '';
      });
    });
  }
  
  /**
   * 分析情绪 (真实 LLM)
   */
  async analyzeEmotion(text: string): Promise<EmotionAnalysisResult | null> {
    const response = await this.query({
      prompt: `分析以下文本的情绪：\n\n"${text}"`,
      systemPrompt: EMOTION_ANALYSIS_SYSTEM
    });
    
    if (!response.success) {
      console.error('[LLMService] 情绪分析失败:', response.error);
      return null;
    }
    
    try {
      // 尝试提取 JSON
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as EmotionAnalysisResult;
      }
    } catch (e) {
      console.error('[LLMService] 解析情绪结果失败:', e);
    }
    
    return null;
  }
  
  /**
   * 分析意图 (真实 LLM)
   */
  async analyzeIntent(text: string): Promise<IntentAnalysisResult | null> {
    const response = await this.query({
      prompt: `分析以下文本的意图：\n\n"${text}"`,
      systemPrompt: INTENT_ANALYSIS_SYSTEM
    });
    
    if (!response.success) {
      console.error('[LLMService] 意图分析失败:', response.error);
      return null;
    }
    
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as IntentAnalysisResult;
      }
    } catch (e) {
      console.error('[LLMService] 解析意图结果失败:', e);
    }
    
    return null;
  }
  
  /**
   * 分析对话上下文 (真实 LLM)
   */
  async analyzeContext(
    conversationHistory: Array<{ role: string; text: string }>,
    currentText: string
  ): Promise<ContextAnalysisResult | null> {
    const historyStr = conversationHistory
      .slice(-10)
      .map(t => `${t.role}: ${t.text}`)
      .join('\n');
    
    const response = await this.query({
      prompt: `对话历史：\n${historyStr}\n\n当前消息：\n"${currentText}"`,
      systemPrompt: CONTEXT_ANALYSIS_SYSTEM
    });
    
    if (!response.success) {
      console.error('[LLMService] 上下文分析失败:', response.error);
      return null;
    }
    
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as ContextAnalysisResult;
      }
    } catch (e) {
      console.error('[LLMService] 解析上下文结果失败:', e);
    }
    
    return null;
  }
}

// 单例
export const llmService = new LLMServiceImpl();
