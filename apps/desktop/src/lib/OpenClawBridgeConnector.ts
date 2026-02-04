/**
 * OpenClaw Bridge Connector
 * 
 * 通过 openclaw-bridge HTTP API 连接初音未来
 * 比直接 WebSocket 更稳定
 */

export interface BridgeConfig {
  bridgeUrl: string;  // 如 http://localhost:12394
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type MessageHandler = (chunk: { type: 'text' | 'end' | 'error'; content: string }) => void;
type StatusHandler = (status: ConnectionStatus) => void;

export class OpenClawBridgeConnector {
  private config: BridgeConfig;
  private status: ConnectionStatus = 'disconnected';
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private abortController: AbortController | null = null;

  constructor(config: BridgeConfig) {
    this.config = {
      bridgeUrl: config.bridgeUrl || 'http://localhost:12394'
    };
  }

  /**
   * 测试连接
   */
  async connect(): Promise<void> {
    this.setStatus('connecting');
    
    try {
      const response = await fetch(`${this.config.bridgeUrl}/health`);
      if (!response.ok) {
        throw new Error(`Bridge 不可用: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.status === 'UP') {
        this.setStatus('connected');
        console.log('[BridgeConnector] ✅ 已连接到 OpenClaw Bridge');
      } else {
        throw new Error('Bridge 状态异常');
      }
    } catch (e) {
      this.setStatus('error');
      console.error('[BridgeConnector] 连接失败:', e);
      throw e;
    }
  }

  /**
   * 发送消息并获取回复
   */
  async sendMessage(text: string): Promise<boolean> {
    if (this.status !== 'connected') {
      console.warn('[BridgeConnector] 未连接');
      return false;
    }

    this.abortController = new AbortController();

    try {
      console.log('[BridgeConnector] 发送消息:', text.slice(0, 50));
      
      const response = await fetch(`${this.config.bridgeUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'openclaw',
          messages: [{ role: 'user', content: text }],
          stream: false
        }),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const data = await response.json();
      
      // 提取回复内容
      const content = data.choices?.[0]?.message?.content || '';
      
      if (content) {
        // 通知消息处理器
        this.notifyMessage({ type: 'text', content });
        this.notifyMessage({ type: 'end', content });  // end 消息也要带完整内容
        console.log('[BridgeConnector] 收到回复:', content.slice(0, 100));
        return true;
      }
      
      return false;
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('[BridgeConnector] 请求被取消');
        return false;
      }
      
      console.error('[BridgeConnector] 发送失败:', e);
      this.notifyMessage({ type: 'error', content: e.message });
      return false;
    }
  }

  /**
   * 中止当前请求
   */
  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.abort();
    this.setStatus('disconnected');
  }

  /**
   * 订阅消息
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * 订阅状态变化
   */
  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  /**
   * 获取当前状态
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status;
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }

  private notifyMessage(chunk: { type: 'text' | 'end' | 'error'; content: string }) {
    for (const handler of this.messageHandlers) {
      handler(chunk);
    }
  }
}

// 默认实例
export const bridgeConnector = new OpenClawBridgeConnector({
  bridgeUrl: 'http://localhost:12394'
});
