/**
 * OpenClaw Connector - WebSocket 连接 OpenClaw Gateway
 * 
 * 实现 OpenClaw Gateway WebSocket 协议 v3
 * @see https://docs.openclaw.ai/gateway/protocol
 */

export interface MessageChunk {
  type: 'text' | 'end' | 'error';
  content: string;
  timestamp: number;
}

export interface OpenClawConfig {
  gatewayUrl: string;
  token?: string;
  /** 初始重连间隔 (ms)，默认 1000 */
  reconnectInterval?: number;
  /** 最大重连次数，默认 20 */
  maxReconnectAttempts?: number;
  /** 指数退避最大间隔 (ms)，默认 32000 */
  maxReconnectDelay?: number;
}

type MessageHandler = (chunk: MessageChunk) => void;
type StatusHandler = (status: ConnectionStatus) => void;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface ReconnectInfo {
  /** 当前重连次数 */
  attempt: number;
  /** 最大重连次数 */
  maxAttempts: number;
  /** 下次重连间隔 (ms) */
  nextDelay: number;
  /** 下次重连时间戳 */
  nextRetryAt: number | null;
}

// 协议版本
const PROTOCOL_VERSION = 3;

// 生成唯一 ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// 生成设备 ID (基于随机数，持久化到 localStorage)
function getDeviceId(): string {
  let deviceId = localStorage.getItem('openclaw-avatar-device-id');
  if (!deviceId) {
    deviceId = `avatar-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('openclaw-avatar-device-id', deviceId);
  }
  return deviceId;
}

export class OpenClawConnector {
  private ws: WebSocket | null = null;
  private config: Required<OpenClawConfig>;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private reconnectInfoHandlers: Set<(info: ReconnectInfo) => void> = new Set();
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentStreamBuffer = '';
  private pendingRequests: Map<string, { resolve: (data: any) => void; reject: (err: Error) => void }> = new Map();
  private isConnected = false;
  private deviceToken: string | null = null;
  private challengeNonce: string | null = null;
  private hadSuccessfulConnection = false;
  private nextRetryAt: number | null = null;

  constructor(config: OpenClawConfig) {
    this.config = {
      gatewayUrl: config.gatewayUrl,
      token: config.token ?? '',
      reconnectInterval: config.reconnectInterval ?? 1000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 20,
      maxReconnectDelay: config.maxReconnectDelay ?? 32000,
    };

    // 尝试从 localStorage 恢复 device token
    this.deviceToken = localStorage.getItem('openclaw-avatar-device-token');
  }

  /**
   * 设置 Gateway token
   */
  setToken(token: string) {
    this.config.token = token;
  }

  /**
   * 连接到 OpenClaw Gateway
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN && this.isConnected) {
        resolve();
        return;
      }

      this.setStatus('connecting');
      console.log('[OpenClaw] 连接中...', this.config.gatewayUrl);

      try {
        this.ws = new WebSocket(this.config.gatewayUrl);

        this.ws.onopen = () => {
          console.log('[OpenClaw] WebSocket 已打开，等待 challenge...');
        };

        this.ws.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('[OpenClaw] 收到消息:', message.type, message.event || message.method || '');

            // 处理 connect.challenge 事件
            if (message.type === 'event' && message.event === 'connect.challenge') {
              this.challengeNonce = message.payload?.nonce;
              console.log('[OpenClaw] 收到 challenge, 发送 connect 请求...');
              await this.sendConnect();
              return;
            }

            // 处理 connect 响应
            if (message.type === 'res' && this.pendingRequests.has(message.id)) {
              const pending = this.pendingRequests.get(message.id)!;
              this.pendingRequests.delete(message.id);

              if (message.ok) {
                // 保存 device token
                if (message.payload?.auth?.deviceToken) {
                  this.deviceToken = message.payload.auth.deviceToken;
                  localStorage.setItem('openclaw-avatar-device-token', this.deviceToken);
                  console.log('[OpenClaw] 已保存 device token');
                }
                pending.resolve(message.payload);
                
                // 如果是 connect 响应成功
                if (message.payload?.type === 'hello-ok') {
                  this.isConnected = true;
                  this.hadSuccessfulConnection = true;
                  this.setStatus('connected');
                  this.reconnectAttempts = 0;
                  this.nextRetryAt = null;
                  this.notifyReconnectInfo();
                  console.log('[OpenClaw] ✅ 连接成功! 协议版本:', message.payload.protocol);
                  resolve();
                }
              } else {
                console.error('[OpenClaw] 请求失败:', message.error);
                pending.reject(new Error(message.error?.message || 'Request failed'));
                
                // 如果 connect 失败，关闭连接
                if (!this.isConnected) {
                  this.setStatus('error');
                  reject(new Error(message.error?.message || 'Connect failed'));
                }
              }
              return;
            }

            // 处理其他响应
            if (message.type === 'res' && this.pendingRequests.has(message.id)) {
              const pending = this.pendingRequests.get(message.id)!;
              this.pendingRequests.delete(message.id);
              if (message.ok) {
                pending.resolve(message.payload);
              } else {
                pending.reject(new Error(message.error?.message || 'Request failed'));
              }
              return;
            }

            // 处理事件
            if (message.type === 'event') {
              this.handleEvent(message);
              return;
            }

          } catch (e) {
            console.error('[OpenClaw] 解析消息失败:', e, event.data);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[OpenClaw] WebSocket 错误:', error);
          this.setStatus('error');
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('[OpenClaw] 连接关闭:', event.code, event.reason);
          const wasConnected = this.isConnected;
          this.isConnected = false;

          // 正常关闭 (code 1000) 或从未成功连接过，不自动重连
          if (event.code === 1000 || !this.hadSuccessfulConnection) {
            this.setStatus('disconnected');
            return;
          }

          // 尝试自动重连
          if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.attemptReconnect();
          } else {
            this.setStatus('error');
          }
        };
      } catch (e) {
        this.setStatus('error');
        reject(e);
      }
    });
  }

  /**
   * 发送 connect 请求
   * 使用 openclaw-control-ui / webchat 模式，与 OpenClaw Control UI 相同
   */
  private async sendConnect(): Promise<void> {
    const connectId = generateId();
    
    // 使用 avatar 客户端参数（支持远程连接）
    const connectRequest = {
      type: 'req',
      id: connectId,
      method: 'connect',
      params: {
        minProtocol: PROTOCOL_VERSION,
        maxProtocol: PROTOCOL_VERSION,
        client: {
          id: 'webchat',  // 使用 webchat 客户端 ID（Gateway 认可）
          version: '1.0.0',
          platform: typeof navigator !== 'undefined' ? navigator.platform || 'web' : 'web',
          mode: 'webchat',  // 必需的 mode 属性
        },
        scopes: ['chat', 'events'],  // 请求的权限
        caps: ['streaming'],  // 支持流式响应
        auth: {
          token: this.config.token || undefined,
          deviceToken: this.deviceToken || undefined
        },
        locale: typeof navigator !== 'undefined' ? navigator.language || 'zh-CN' : 'zh-CN'
      }
    };

    // 清理 undefined 值
    if (!connectRequest.params.auth.token) delete (connectRequest.params.auth as any).token;
    if (!connectRequest.params.auth.deviceToken) delete (connectRequest.params.auth as any).deviceToken;

    console.log('[OpenClaw] 发送 connect 请求:', JSON.stringify(connectRequest, null, 2));

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(connectId, { resolve, reject });
      this.ws?.send(JSON.stringify(connectRequest));
    });
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.hadSuccessfulConnection = false; // 防止 onclose 触发自动重连

    if (this.ws) {
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }

    this.isConnected = false;
    this.setStatus('disconnected');
    this.reconnectAttempts = 0;
    this.nextRetryAt = null;
    this.notifyReconnectInfo();
  }

  /**
   * 发送请求到 Gateway
   */
  private async sendRequest(method: string, params: any = {}): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isConnected) {
      throw new Error('Not connected');
    }

    const requestId = generateId();
    const request = {
      type: 'req',
      id: requestId,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      this.ws?.send(JSON.stringify(request));
      
      // 30 秒超时
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * 发送消息给 AI Agent
   * 
   * 注意：agent 方法会返回流式响应，通过 onMessage 订阅接收
   */
  async sendMessage(text: string, options?: {
    sessionKey?: string;
    thinkingLevel?: 'off' | 'minimal' | 'low' | 'medium' | 'high';
    model?: string;
  }): Promise<boolean> {
    if (!this.isConnected) {
      console.error('[OpenClaw] 未连接，无法发送消息');
      return false;
    }

    try {
      console.log('[OpenClaw] 发送消息:', text.slice(0, 50));
      
      // 清空流缓冲区
      this.currentStreamBuffer = '';
      
      // 使用 agent 方法发送消息
      // 响应会通过 agent 事件流式返回
      const response = await this.sendRequest('agent', {
        message: text,
        idempotencyKey: generateId(),
        sessionKey: options?.sessionKey,
        thinkingLevel: options?.thinkingLevel,
        model: options?.model,
      });

      // agent 方法返回 ack，包含 runId
      if (response?.status === 'accepted') {
        console.log('[OpenClaw] ✅ 消息已接受, runId:', response.runId);
        return true;
      }
      
      console.log('[OpenClaw] Agent 响应:', response);
      return true;
    } catch (e) {
      console.error('[OpenClaw] 发送消息失败:', e);
      return false;
    }
  }

  /**
   * 处理 Gateway 事件
   */
  private handleEvent(message: any) {
    const { event, payload } = message;
    
    switch (event) {
      case 'agent':
        this.handleAgentEvent(payload);
        break;
      
      case 'tick':
        // 心跳事件，不需要处理
        break;
      
      case 'presence':
        console.log('[OpenClaw] Presence 更新:', payload);
        break;
      
      case 'chat':
        this.handleChatEvent(payload);
        break;
      
      default:
        console.log('[OpenClaw] 未处理的事件:', event, payload);
    }
  }

  /**
   * 处理 Agent 事件 (流式响应)
   * 
   * 事件格式：
   * {"type":"event","event":"agent","payload":{
   *   "runId":"...",
   *   "stream":"assistant" | "tool" | "thinking",
   *   "data":{"text":"累积文本","delta":"增量文本"},
   *   "sessionKey":"...",
   *   "seq":7
   * }}
   */
  private handleAgentEvent(payload: any) {
    // console.log('[OpenClaw] Agent 事件:', payload.stream, payload.data?.delta?.slice(0, 20));

    // 流式文本 (assistant 流)
    if (payload.stream === 'assistant' && payload.data) {
      const delta = payload.data.delta || '';
      if (delta) {
        const chunk: MessageChunk = {
          type: 'text',
          content: delta,
          timestamp: Date.now()
        };
        this.currentStreamBuffer = payload.data.text || (this.currentStreamBuffer + delta);
        this.notifyHandlers(chunk);
      }
    }
    // 思考流 (可选显示)
    else if (payload.stream === 'thinking' && payload.data) {
      const chunk: MessageChunk = {
        type: 'thinking' as any, // 扩展类型
        content: payload.data.delta || payload.data.text || '',
        timestamp: Date.now()
      };
      this.notifyHandlers(chunk);
    }
    // 工具调用
    else if (payload.stream === 'tool') {
      const chunk: MessageChunk = {
        type: 'tool' as any,
        content: JSON.stringify(payload.data),
        timestamp: Date.now()
      };
      this.notifyHandlers(chunk);
    }
    // 响应完成
    else if (payload.status === 'completed' || payload.status === 'done') {
      const chunk: MessageChunk = {
        type: 'end',
        content: this.currentStreamBuffer || payload.data?.text || '',
        timestamp: Date.now()
      };
      this.notifyHandlers(chunk);
      this.currentStreamBuffer = '';
      console.log('[OpenClaw] ✅ 响应完成');
    }
    // 响应被中止
    else if (payload.status === 'aborted') {
      const chunk: MessageChunk = {
        type: 'end',
        content: this.currentStreamBuffer,
        timestamp: Date.now()
      };
      this.notifyHandlers(chunk);
      this.currentStreamBuffer = '';
      console.log('[OpenClaw] ⏹️ 响应被中止');
    }
    // 错误
    else if (payload.status === 'error' || payload.error) {
      const chunk: MessageChunk = {
        type: 'error',
        content: payload.error?.message || payload.error || 'Unknown error',
        timestamp: Date.now()
      };
      this.notifyHandlers(chunk);
      this.currentStreamBuffer = '';
    }
  }

  /**
   * 处理 Chat 事件 (来自其他渠道的消息)
   */
  private handleChatEvent(payload: any) {
    console.log('[OpenClaw] Chat 事件:', payload);
    
    // 如果是 AI 的回复
    if (payload.fromAssistant || payload.role === 'assistant') {
      const chunk: MessageChunk = {
        type: 'text',
        content: payload.text || payload.content || payload.message || '',
        timestamp: Date.now()
      };
      this.notifyHandlers(chunk);
      
      // 同时发送 end 事件
      const endChunk: MessageChunk = {
        type: 'end',
        content: chunk.content,
        timestamp: Date.now()
      };
      this.notifyHandlers(endChunk);
    }
  }

  /**
   * 订阅消息
   */
  onMessage(handler: MessageHandler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * 订阅连接状态
   */
  onStatusChange(handler: StatusHandler) {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }

  /**
   * 获取当前状态
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * 通知所有消息处理器
   */
  private notifyHandlers(chunk: MessageChunk) {
    this.messageHandlers.forEach(handler => {
      try {
        handler(chunk);
      } catch (e) {
        console.error('[OpenClaw] 消息处理器错误:', e);
      }
    });
  }

  /**
   * 设置状态并通知
   */
  private setStatus(status: ConnectionStatus) {
    this.status = status;
    this.statusHandlers.forEach(handler => {
      try {
        handler(status);
      } catch (e) {
        console.error('[OpenClaw] 状态处理器错误:', e);
      }
    });
  }

  /**
   * 计算指数退避延迟 (带 jitter)
   */
  private getBackoffDelay(): number {
    // 指数退避: baseDelay * 2^(attempt-1)，加上随机 jitter
    const exponentialDelay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxReconnectDelay);
    // 添加 ±20% 的随机 jitter 避免多客户端同时重连
    const jitter = cappedDelay * (0.8 + Math.random() * 0.4);
    return Math.round(jitter);
  }

  /**
   * 尝试重连 (指数退避策略)
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.log('[OpenClaw] 达到最大重连次数，停止重连');
      this.setStatus('error');
      this.nextRetryAt = null;
      this.notifyReconnectInfo();
      return;
    }

    this.reconnectAttempts++;
    const delay = this.getBackoffDelay();
    this.nextRetryAt = Date.now() + delay;

    this.setStatus('reconnecting');
    this.notifyReconnectInfo();

    console.log(
      `[OpenClaw] ${delay}ms 后重连 (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})，` +
      `退避延迟: ${(delay / 1000).toFixed(1)}s`
    );

    this.reconnectTimer = setTimeout(() => {
      this.nextRetryAt = null;
      this.connect().catch(e => {
        console.error('[OpenClaw] 重连失败:', e);
      });
    }, delay);
  }

  /**
   * 手动触发重连 (重置计数器)
   */
  manualReconnect(): Promise<void> {
    // 清除现有重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.nextRetryAt = null;
    this.hadSuccessfulConnection = true; // 允许自动重连
    this.notifyReconnectInfo();

    // 关闭现有连接
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    return this.connect();
  }

  /**
   * 获取重连信息
   */
  getReconnectInfo(): ReconnectInfo {
    return {
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts,
      nextDelay: this.reconnectAttempts > 0 ? this.getBackoffDelay() : this.config.reconnectInterval,
      nextRetryAt: this.nextRetryAt,
    };
  }

  /**
   * 订阅重连信息变化
   */
  onReconnectInfo(handler: (info: ReconnectInfo) => void): () => void {
    this.reconnectInfoHandlers.add(handler);
    handler(this.getReconnectInfo());
    return () => this.reconnectInfoHandlers.delete(handler);
  }

  /**
   * 通知重连信息变化
   */
  private notifyReconnectInfo() {
    const info = this.getReconnectInfo();
    this.reconnectInfoHandlers.forEach(handler => {
      try {
        handler(info);
      } catch (e) {
        console.error('[OpenClaw] 重连信息处理器错误:', e);
      }
    });
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<OpenClawConfig>) {
    if (config.gatewayUrl) {
      this.config.gatewayUrl = config.gatewayUrl;
    }
    if (config.token !== undefined) {
      this.config.token = config.token;
    }
  }
}

// 默认实例（延迟创建，避免在模块加载时访问 localStorage）
let _openClawConnector: OpenClawConnector | null = null;

export function getOpenClawConnector(): OpenClawConnector {
  if (!_openClawConnector) {
    _openClawConnector = new OpenClawConnector({
      gatewayUrl: 'ws://localhost:18789/ws',
      // token 会从配置存储中读取
    });
  }
  return _openClawConnector;
}

// 向后兼容：提供 getter 形式的默认导出
// @deprecated 使用 getOpenClawConnector() 代替
export const openClawConnector = {
  get instance() {
    return getOpenClawConnector();
  }
};
