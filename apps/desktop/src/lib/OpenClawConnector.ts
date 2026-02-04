/**
 * OpenClaw Connector - WebSocket 连接 OpenClaw Gateway
 * 
 * 负责与 OpenClaw 通信，接收 AI 流式响应
 */

export interface MessageChunk {
  type: 'text' | 'end' | 'error';
  content: string;
  timestamp: number;
}

export interface OpenClawConfig {
  gatewayUrl: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

type MessageHandler = (chunk: MessageChunk) => void;
type StatusHandler = (status: ConnectionStatus) => void;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export class OpenClawConnector {
  private ws: WebSocket | null = null;
  private config: Required<OpenClawConfig>;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentStreamBuffer = '';

  constructor(config: OpenClawConfig) {
    this.config = {
      gatewayUrl: config.gatewayUrl,
      reconnectInterval: config.reconnectInterval ?? 3000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
    };
  }

  /**
   * 连接到 OpenClaw Gateway
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setStatus('connecting');
      console.log('[OpenClaw] 连接中...', this.config.gatewayUrl);

      try {
        this.ws = new WebSocket(this.config.gatewayUrl);

        this.ws.onopen = () => {
          console.log('[OpenClaw] 连接成功');
          this.setStatus('connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('[OpenClaw] WebSocket 错误:', error);
          this.setStatus('error');
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('[OpenClaw] 连接关闭:', event.code, event.reason);
          this.setStatus('disconnected');
          this.attemptReconnect();
        };
      } catch (e) {
        this.setStatus('error');
        reject(e);
      }
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
    
    if (this.ws) {
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }
    
    this.setStatus('disconnected');
    this.reconnectAttempts = 0;
  }

  /**
   * 发送消息给 AI
   */
  sendMessage(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[OpenClaw] 未连接，无法发送消息');
      return false;
    }

    const message = {
      type: 'message',
      content: text,
      timestamp: Date.now(),
    };

    this.ws.send(JSON.stringify(message));
    console.log('[OpenClaw] 发送消息:', text);
    return true;
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
    // 立即发送当前状态
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
   * 处理收到的消息
   */
  private handleMessage(data: string) {
    try {
      const parsed = JSON.parse(data);
      
      // 处理流式响应
      if (parsed.type === 'stream' || parsed.type === 'chunk') {
        const chunk: MessageChunk = {
          type: 'text',
          content: parsed.content || parsed.text || '',
          timestamp: Date.now(),
        };
        this.currentStreamBuffer += chunk.content;
        this.notifyHandlers(chunk);
      } 
      // 流结束
      else if (parsed.type === 'end' || parsed.type === 'done') {
        const chunk: MessageChunk = {
          type: 'end',
          content: this.currentStreamBuffer,
          timestamp: Date.now(),
        };
        this.notifyHandlers(chunk);
        this.currentStreamBuffer = '';
      }
      // 错误
      else if (parsed.type === 'error') {
        const chunk: MessageChunk = {
          type: 'error',
          content: parsed.message || 'Unknown error',
          timestamp: Date.now(),
        };
        this.notifyHandlers(chunk);
      }
      // 普通文本消息
      else if (parsed.content || parsed.text || parsed.message) {
        const chunk: MessageChunk = {
          type: 'text',
          content: parsed.content || parsed.text || parsed.message,
          timestamp: Date.now(),
        };
        this.notifyHandlers(chunk);
      }
    } catch (e) {
      // 纯文本消息
      const chunk: MessageChunk = {
        type: 'text',
        content: data,
        timestamp: Date.now(),
      };
      this.notifyHandlers(chunk);
    }
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
   * 尝试重连
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.log('[OpenClaw] 达到最大重连次数，停止重连');
      this.setStatus('error');
      return;
    }

    this.reconnectAttempts++;
    console.log(`[OpenClaw] ${this.config.reconnectInterval}ms 后重连 (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(e => {
        console.error('[OpenClaw] 重连失败:', e);
      });
    }, this.config.reconnectInterval);
  }
}

// 默认实例（本地开发）
export const openClawConnector = new OpenClawConnector({
  gatewayUrl: 'ws://localhost:3939/ws',
});
