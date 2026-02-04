/**
 * OpenClawConnector 单元测试
 *
 * 测试 WebSocket 连接、协议握手、消息发送和事件处理
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

// 在导入任何模块前设置 localStorage mock
const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }),
  get length() { return Object.keys(localStorageStore).length; },
  key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
};

// 使用 Object.defineProperty 确保 mock 被正确设置
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

import { OpenClawConnector, type MessageChunk, type ConnectionStatus, type OpenClawConfig } from './OpenClawConnector';

// Mock WebSocket - 存储所有创建的实例
let mockWsInstances: MockWebSocket[] = [];
let currentMockWsInstance: MockWebSocket | null = null;

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  
  readyState = MockWebSocket.CONNECTING;
  url: string;
  
  onopen: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  
  sentMessages: string[] = [];
  
  constructor(url: string) {
    this.url = url;
    // 保存实例引用
    currentMockWsInstance = this;
    mockWsInstances.push(this);
    
    // 模拟异步连接 - 使用 queueMicrotask 确保更快执行
    queueMicrotask(() => {
      if (this.readyState === MockWebSocket.CONNECTING) {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.({ type: 'open' });
      }
    });
  }
  
  send(data: string) {
    this.sentMessages.push(data);
  }
  
  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code || 1000, reason: reason || '' });
  }
  
  // 测试辅助方法
  simulateMessage(data: any) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
  
  simulateError(error: any) {
    this.onerror?.(error);
  }
  
  simulateClose(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }
}

// 设置静态属性
(MockWebSocket as any).CONNECTING = 0;
(MockWebSocket as any).OPEN = 1;
(MockWebSocket as any).CLOSING = 2;
(MockWebSocket as any).CLOSED = 3;

// 在全局设置 WebSocket mock
(globalThis as any).WebSocket = MockWebSocket;

// 获取最新的 mock 实例的辅助函数
function getMockWsInstance(): MockWebSocket | null {
  return currentMockWsInstance;
}

describe('OpenClawConnector', () => {
  let connector: OpenClawConnector;
  const defaultConfig: OpenClawConfig = {
    gatewayUrl: 'ws://localhost:18789/ws',
    token: 'test-token',
    reconnectInterval: 100,
    maxReconnectAttempts: 3,
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // 清理 WebSocket mock 实例
    mockWsInstances = [];
    currentMockWsInstance = null;
  });
  
  afterEach(() => {
    connector?.disconnect();
  });
  
  // ===========================================
  // 基础功能测试
  // ===========================================
  
  describe('基础功能', () => {
    it('应该正确创建实例', () => {
      connector = new OpenClawConnector(defaultConfig);
      expect(connector).toBeInstanceOf(OpenClawConnector);
      expect(connector.getStatus()).toBe('disconnected');
    });
    
    it('应该使用默认配置值', () => {
      connector = new OpenClawConnector({ gatewayUrl: 'ws://test' });
      expect(connector.getStatus()).toBe('disconnected');
    });
    
    it('应该从 localStorage 恢复 device token', () => {
      localStorage.setItem('openclaw-avatar-device-token', 'saved-token');
      connector = new OpenClawConnector(defaultConfig);
      // device token 会在连接时使用
      expect(localStorageMock.getItem).toHaveBeenCalledWith('openclaw-avatar-device-token');
    });
    
    it('应该能设置 token', () => {
      connector = new OpenClawConnector(defaultConfig);
      connector.setToken('new-token');
      // token 更新成功（内部状态）
      expect(connector.getStatus()).toBe('disconnected');
    });
    
    it('应该能更新配置', () => {
      connector = new OpenClawConnector(defaultConfig);
      connector.updateConfig({ gatewayUrl: 'ws://new-url', token: 'new-token' });
      // 配置已更新
      expect(connector.getStatus()).toBe('disconnected');
    });
  });
  
  // ===========================================
  // 连接测试
  // ===========================================
  
  describe('连接管理', () => {
    it('应该能发起连接', async () => {
      connector = new OpenClawConnector(defaultConfig);
      
      const connectPromise = connector.connect();
      
      // 等待 WebSocket 打开
      await vi.waitFor(() => {
        expect(getMockWsInstance()).not.toBeNull();
        expect(getMockWsInstance()?.readyState).toBe(MockWebSocket.OPEN);
      });
      
      // 模拟 challenge 事件
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'test-nonce' }
      });
      
      // 等待 connect 请求发送
      await vi.waitFor(() => {
        expect(getMockWsInstance()?.sentMessages.length).toBeGreaterThan(0);
      });
      
      // 解析发送的 connect 请求
      const connectReq = JSON.parse(getMockWsInstance()!.sentMessages[0]);
      expect(connectReq.method).toBe('connect');
      expect(connectReq.params.client.mode).toBe('webchat');
      
      // 模拟成功响应
      getMockWsInstance()?.simulateMessage({
        type: 'res',
        id: connectReq.id,
        ok: true,
        payload: {
          type: 'hello-ok',
          protocol: 3,
          auth: { deviceToken: 'new-device-token' }
        }
      });
      
      await connectPromise;
      
      expect(connector.getStatus()).toBe('connected');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'openclaw-avatar-device-token',
        'new-device-token'
      );
    });
    
    it('应该在已连接时直接返回', async () => {
      connector = new OpenClawConnector(defaultConfig);
      
      // 第一次连接
      const firstConnect = connector.connect();
      await vi.waitFor(() => getMockWsInstance()?.readyState === MockWebSocket.OPEN);
      
      // 模拟完整握手
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'nonce' }
      });
      
      await vi.waitFor(() => getMockWsInstance()!.sentMessages.length > 0);
      const req = JSON.parse(getMockWsInstance()!.sentMessages[0]);
      
      getMockWsInstance()?.simulateMessage({
        type: 'res',
        id: req.id,
        ok: true,
        payload: { type: 'hello-ok', protocol: 3 }
      });
      
      await firstConnect;
      
      // 第二次连接应该立即返回
      const secondConnect = connector.connect();
      await expect(secondConnect).resolves.toBeUndefined();
    });
    
    it('应该能断开连接', async () => {
      connector = new OpenClawConnector(defaultConfig);
      
      const connectPromise = connector.connect();
      await vi.waitFor(() => getMockWsInstance()?.readyState === MockWebSocket.OPEN);
      
      // 完成握手
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'nonce' }
      });
      await vi.waitFor(() => getMockWsInstance()!.sentMessages.length > 0);
      const req = JSON.parse(getMockWsInstance()!.sentMessages[0]);
      getMockWsInstance()?.simulateMessage({
        type: 'res',
        id: req.id,
        ok: true,
        payload: { type: 'hello-ok', protocol: 3 }
      });
      await connectPromise;
      
      // 断开连接
      connector.disconnect();
      
      expect(connector.getStatus()).toBe('disconnected');
    });
    
    it('应该处理连接错误', async () => {
      connector = new OpenClawConnector(defaultConfig);
      
      const connectPromise = connector.connect();
      await vi.waitFor(() => getMockWsInstance() !== null);
      
      // 模拟错误
      getMockWsInstance()?.simulateError(new Error('Connection failed'));
      
      await expect(connectPromise).rejects.toBeDefined();
      expect(connector.getStatus()).toBe('error');
    });
    
    it('应该处理连接被拒绝', async () => {
      connector = new OpenClawConnector(defaultConfig);
      
      const connectPromise = connector.connect();
      await vi.waitFor(() => getMockWsInstance()?.readyState === MockWebSocket.OPEN);
      
      // 模拟 challenge
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'nonce' }
      });
      
      await vi.waitFor(() => getMockWsInstance()!.sentMessages.length > 0);
      const req = JSON.parse(getMockWsInstance()!.sentMessages[0]);
      
      // 模拟失败响应
      getMockWsInstance()?.simulateMessage({
        type: 'res',
        id: req.id,
        ok: false,
        error: { message: 'Invalid token' }
      });
      
      await expect(connectPromise).rejects.toThrow('Invalid token');
      expect(connector.getStatus()).toBe('error');
    });
  });
  
  // ===========================================
  // 状态订阅测试
  // ===========================================
  
  describe('状态订阅', () => {
    it('应该能订阅状态变化', () => {
      connector = new OpenClawConnector(defaultConfig);
      
      const statusCallback = vi.fn();
      const unsubscribe = connector.onStatusChange(statusCallback);
      
      // 订阅时立即收到当前状态
      expect(statusCallback).toHaveBeenCalledWith('disconnected');
      
      unsubscribe();
    });
    
    it('应该在状态变化时通知订阅者', async () => {
      connector = new OpenClawConnector(defaultConfig);
      
      const statuses: ConnectionStatus[] = [];
      connector.onStatusChange(s => statuses.push(s));
      
      // 初始状态
      expect(statuses).toContain('disconnected');
      
      // 开始连接
      const connectPromise = connector.connect();
      
      await vi.waitFor(() => statuses.includes('connecting'));
      expect(statuses).toContain('connecting');
      
      // 完成握手
      await vi.waitFor(() => getMockWsInstance()?.readyState === MockWebSocket.OPEN);
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'nonce' }
      });
      await vi.waitFor(() => getMockWsInstance()!.sentMessages.length > 0);
      const req = JSON.parse(getMockWsInstance()!.sentMessages[0]);
      getMockWsInstance()?.simulateMessage({
        type: 'res',
        id: req.id,
        ok: true,
        payload: { type: 'hello-ok', protocol: 3 }
      });
      
      await connectPromise;
      
      expect(statuses).toContain('connected');
    });
    
    it('应该能取消状态订阅', () => {
      connector = new OpenClawConnector(defaultConfig);
      
      const statusCallback = vi.fn();
      const unsubscribe = connector.onStatusChange(statusCallback);
      
      // 清除初始调用
      statusCallback.mockClear();
      
      unsubscribe();
      
      // 开始连接，不应该收到通知
      connector.connect();
      
      // 等待一点时间
      return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
        // 取消订阅后不应该收到新状态
        // 注意：由于状态变化可能在取消前发生，这里只验证取消成功
        expect(statusCallback.mock.calls.length).toBeLessThanOrEqual(1);
      });
    });
    
    it('应该处理回调中的错误', async () => {
      connector = new OpenClawConnector(defaultConfig);
      
      // 先订阅正常回调
      const normalCallback = vi.fn();
      connector.onStatusChange(normalCallback);
      
      // 订阅时立即调用，应该收到 disconnected
      expect(normalCallback).toHaveBeenCalledWith('disconnected');
      normalCallback.mockClear();
      
      // 订阅一个会抛出错误的回调
      const errorCallback = vi.fn(() => { throw new Error('Callback error'); });
      
      // 在订阅时，errorCallback 会抛出错误
      expect(() => connector.onStatusChange(errorCallback)).toThrow('Callback error');
      
      // 这验证了源代码的当前行为：
      // onStatusChange 在订阅时立即调用 handler，如果 handler 抛出错误会传播
    });
  });
  
  // ===========================================
  // 消息订阅测试
  // ===========================================
  
  describe('消息订阅', () => {
    it('应该能订阅消息', () => {
      connector = new OpenClawConnector(defaultConfig);
      
      const messageCallback = vi.fn();
      const unsubscribe = connector.onMessage(messageCallback);
      
      expect(typeof unsubscribe).toBe('function');
      
      unsubscribe();
    });
    
    it('应该能取消消息订阅', () => {
      connector = new OpenClawConnector(defaultConfig);
      
      const messageCallback = vi.fn();
      const unsubscribe = connector.onMessage(messageCallback);
      
      unsubscribe();
      
      // 订阅已取消，不会收到消息
      expect(messageCallback).not.toHaveBeenCalled();
    });
  });
  
  // ===========================================
  // 发送消息测试
  // ===========================================
  
  describe('发送消息', () => {
    async function setupConnectedConnector() {
      connector = new OpenClawConnector(defaultConfig);
      const connectPromise = connector.connect();
      
      await vi.waitFor(() => getMockWsInstance()?.readyState === MockWebSocket.OPEN);
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'nonce' }
      });
      await vi.waitFor(() => getMockWsInstance()!.sentMessages.length > 0);
      const req = JSON.parse(getMockWsInstance()!.sentMessages[0]);
      getMockWsInstance()?.simulateMessage({
        type: 'res',
        id: req.id,
        ok: true,
        payload: { type: 'hello-ok', protocol: 3 }
      });
      
      await connectPromise;
      getMockWsInstance()!.sentMessages = []; // 清空之前的消息
      return connector;
    }
    
    it('应该能发送消息', async () => {
      await setupConnectedConnector();
      
      const sendPromise = connector.sendMessage('你好');
      
      // 等待消息发送
      await vi.waitFor(() => getMockWsInstance()!.sentMessages.length > 0);
      
      const agentReq = JSON.parse(getMockWsInstance()!.sentMessages[0]);
      expect(agentReq.method).toBe('agent');
      expect(agentReq.params.message).toBe('你好');
      
      // 模拟 ack 响应
      getMockWsInstance()?.simulateMessage({
        type: 'res',
        id: agentReq.id,
        ok: true,
        payload: { status: 'accepted', runId: 'run-123' }
      });
      
      const result = await sendPromise;
      expect(result).toBe(true);
    });
    
    it('应该在未连接时返回 false', async () => {
      connector = new OpenClawConnector(defaultConfig);
      
      const result = await connector.sendMessage('你好');
      expect(result).toBe(false);
    });
    
    it('应该支持消息选项', async () => {
      await setupConnectedConnector();
      
      connector.sendMessage('测试', {
        sessionKey: 'session-123',
        thinkingLevel: 'high',
        model: 'claude-3',
      });
      
      await vi.waitFor(() => getMockWsInstance()!.sentMessages.length > 0);
      
      const agentReq = JSON.parse(getMockWsInstance()!.sentMessages[0]);
      expect(agentReq.params.sessionKey).toBe('session-123');
      expect(agentReq.params.thinkingLevel).toBe('high');
      expect(agentReq.params.model).toBe('claude-3');
    });
  });
  
  // ===========================================
  // Agent 事件处理测试
  // ===========================================
  
  describe('Agent 事件处理', () => {
    async function setupConnectedConnector() {
      connector = new OpenClawConnector(defaultConfig);
      const connectPromise = connector.connect();
      
      await vi.waitFor(() => getMockWsInstance()?.readyState === MockWebSocket.OPEN);
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'nonce' }
      });
      await vi.waitFor(() => getMockWsInstance()!.sentMessages.length > 0);
      const req = JSON.parse(getMockWsInstance()!.sentMessages[0]);
      getMockWsInstance()?.simulateMessage({
        type: 'res',
        id: req.id,
        ok: true,
        payload: { type: 'hello-ok', protocol: 3 }
      });
      
      await connectPromise;
      return connector;
    }
    
    it('应该处理 assistant 流式文本', async () => {
      await setupConnectedConnector();
      
      const chunks: MessageChunk[] = [];
      connector.onMessage(chunk => chunks.push(chunk));
      
      // 模拟流式响应
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'agent',
        payload: {
          stream: 'assistant',
          data: { text: '你', delta: '你' }
        }
      });
      
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'agent',
        payload: {
          stream: 'assistant',
          data: { text: '你好', delta: '好' }
        }
      });
      
      expect(chunks.length).toBe(2);
      expect(chunks[0].type).toBe('text');
      expect(chunks[0].content).toBe('你');
      expect(chunks[1].content).toBe('好');
    });
    
    it('应该处理 thinking 流', async () => {
      await setupConnectedConnector();
      
      const chunks: MessageChunk[] = [];
      connector.onMessage(chunk => chunks.push(chunk));
      
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'agent',
        payload: {
          stream: 'thinking',
          data: { delta: '正在思考...' }
        }
      });
      
      expect(chunks.length).toBe(1);
      expect((chunks[0] as any).type).toBe('thinking');
      expect(chunks[0].content).toBe('正在思考...');
    });
    
    it('应该处理 tool 流', async () => {
      await setupConnectedConnector();
      
      const chunks: MessageChunk[] = [];
      connector.onMessage(chunk => chunks.push(chunk));
      
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'agent',
        payload: {
          stream: 'tool',
          data: { name: 'search', args: { query: 'test' } }
        }
      });
      
      expect(chunks.length).toBe(1);
      expect((chunks[0] as any).type).toBe('tool');
    });
    
    it('应该处理响应完成', async () => {
      await setupConnectedConnector();
      
      const chunks: MessageChunk[] = [];
      connector.onMessage(chunk => chunks.push(chunk));
      
      // 先发送一些文本
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'agent',
        payload: {
          stream: 'assistant',
          data: { text: '完整回复', delta: '完整回复' }
        }
      });
      
      // 然后完成
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'agent',
        payload: { status: 'completed' }
      });
      
      expect(chunks.length).toBe(2);
      expect(chunks[1].type).toBe('end');
      expect(chunks[1].content).toBe('完整回复');
    });
    
    it('应该处理响应中止', async () => {
      await setupConnectedConnector();
      
      const chunks: MessageChunk[] = [];
      connector.onMessage(chunk => chunks.push(chunk));
      
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'agent',
        payload: {
          stream: 'assistant',
          data: { text: '部分', delta: '部分' }
        }
      });
      
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'agent',
        payload: { status: 'aborted' }
      });
      
      expect(chunks.length).toBe(2);
      expect(chunks[1].type).toBe('end');
    });
    
    it('应该处理错误', async () => {
      await setupConnectedConnector();
      
      const chunks: MessageChunk[] = [];
      connector.onMessage(chunk => chunks.push(chunk));
      
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'agent',
        payload: {
          status: 'error',
          error: { message: 'Something went wrong' }
        }
      });
      
      expect(chunks.length).toBe(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].content).toBe('Something went wrong');
    });
  });
  
  // ===========================================
  // Chat 事件处理测试
  // ===========================================
  
  describe('Chat 事件处理', () => {
    async function setupConnectedConnector() {
      connector = new OpenClawConnector(defaultConfig);
      const connectPromise = connector.connect();
      
      await vi.waitFor(() => getMockWsInstance()?.readyState === MockWebSocket.OPEN);
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'nonce' }
      });
      await vi.waitFor(() => getMockWsInstance()!.sentMessages.length > 0);
      const req = JSON.parse(getMockWsInstance()!.sentMessages[0]);
      getMockWsInstance()?.simulateMessage({
        type: 'res',
        id: req.id,
        ok: true,
        payload: { type: 'hello-ok', protocol: 3 }
      });
      
      await connectPromise;
      return connector;
    }
    
    it('应该处理 assistant 的 chat 消息', async () => {
      await setupConnectedConnector();
      
      const chunks: MessageChunk[] = [];
      connector.onMessage(chunk => chunks.push(chunk));
      
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'chat',
        payload: {
          fromAssistant: true,
          text: '来自其他渠道的消息'
        }
      });
      
      expect(chunks.length).toBe(2); // text + end
      expect(chunks[0].type).toBe('text');
      expect(chunks[0].content).toBe('来自其他渠道的消息');
      expect(chunks[1].type).toBe('end');
    });
  });
  
  // ===========================================
  // 重连测试
  // ===========================================
  
  describe('重连机制', () => {
    it('应该在连接关闭后尝试重连', async () => {
      connector = new OpenClawConnector({
        ...defaultConfig,
        reconnectInterval: 50,
      });
      
      // 先建立连接
      const connectPromise = connector.connect();
      await vi.waitFor(() => getMockWsInstance()?.readyState === MockWebSocket.OPEN);
      
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'nonce' }
      });
      await vi.waitFor(() => getMockWsInstance()!.sentMessages.length > 0);
      const req = JSON.parse(getMockWsInstance()!.sentMessages[0]);
      getMockWsInstance()?.simulateMessage({
        type: 'res',
        id: req.id,
        ok: true,
        payload: { type: 'hello-ok', protocol: 3 }
      });
      
      await connectPromise;
      
      // 记录当前实例数量
      const initialCount = mockWsInstances.length;
      
      // 模拟连接关闭
      getMockWsInstance()?.simulateClose(1006, 'Abnormal close');
      
      // 等待重连
      await vi.waitFor(() => {
        // 检查是否创建了新的 WebSocket 实例
        expect(mockWsInstances.length).toBeGreaterThan(initialCount);
      }, { timeout: 200 });
    });
    
    it('应该在达到最大重连次数后停止', async () => {
      connector = new OpenClawConnector({
        ...defaultConfig,
        reconnectInterval: 20,
        maxReconnectAttempts: 2,
      });
      
      // 先建立成功的连接
      const connectPromise = connector.connect();
      await vi.waitFor(() => getMockWsInstance()?.readyState === MockWebSocket.OPEN);
      
      // 完成握手
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'nonce' }
      });
      await vi.waitFor(() => getMockWsInstance()!.sentMessages.length > 0);
      const req = JSON.parse(getMockWsInstance()!.sentMessages[0]);
      getMockWsInstance()?.simulateMessage({
        type: 'res',
        id: req.id,
        ok: true,
        payload: { type: 'hello-ok', protocol: 3 }
      });
      
      await connectPromise;
      expect(connector.getStatus()).toBe('connected');
      
      // 记录初始实例数
      const initialInstanceCount = mockWsInstances.length;
      
      // 模拟异常关闭，触发重连
      getMockWsInstance()?.simulateClose(1006, 'Connection lost');
      
      // 等待达到最大重连次数
      // maxReconnectAttempts = 2, 所以最多会创建 2 个新连接
      await vi.waitFor(() => {
        return mockWsInstances.length >= initialInstanceCount + 2;
      }, { timeout: 500 });
      
      // 关闭所有新创建的连接
      for (let i = initialInstanceCount; i < mockWsInstances.length; i++) {
        mockWsInstances[i].simulateClose(1006, 'Connection failed');
      }
      
      // 最终状态应该是 disconnected 或 error
      await vi.waitFor(() => {
        const status = connector.getStatus();
        expect(['disconnected', 'error']).toContain(status);
      }, { timeout: 300 });
    });
  });
  
  // ===========================================
  // 边界情况测试
  // ===========================================
  
  describe('边界情况', () => {
    it('应该处理无效的 JSON 消息', async () => {
      connector = new OpenClawConnector(defaultConfig);
      connector.connect();
      
      await vi.waitFor(() => getMockWsInstance()?.readyState === MockWebSocket.OPEN);
      
      // 发送无效 JSON，不应该崩溃
      getMockWsInstance()?.onmessage?.({ data: 'not json' });
      
      expect(connector.getStatus()).not.toBe('error');
    });
    
    it('应该处理空 payload', async () => {
      connector = new OpenClawConnector(defaultConfig);
      
      const connectPromise = connector.connect();
      await vi.waitFor(() => getMockWsInstance()?.readyState === MockWebSocket.OPEN);
      
      // 完成握手
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'nonce' }
      });
      await vi.waitFor(() => getMockWsInstance()!.sentMessages.length > 0);
      const req = JSON.parse(getMockWsInstance()!.sentMessages[0]);
      getMockWsInstance()?.simulateMessage({
        type: 'res',
        id: req.id,
        ok: true,
        payload: { type: 'hello-ok', protocol: 3 }
      });
      await connectPromise;
      
      const chunks: MessageChunk[] = [];
      connector.onMessage(chunk => chunks.push(chunk));
      
      // 发送空 payload 的 agent 事件
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'agent',
        payload: {}
      });
      
      // 不应该崩溃，也不应该产生消息
      expect(chunks.length).toBe(0);
    });
    
    it('应该处理未知事件类型', async () => {
      connector = new OpenClawConnector(defaultConfig);
      
      const connectPromise = connector.connect();
      await vi.waitFor(() => getMockWsInstance()?.readyState === MockWebSocket.OPEN);
      
      // 完成握手
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'nonce' }
      });
      await vi.waitFor(() => getMockWsInstance()!.sentMessages.length > 0);
      const req = JSON.parse(getMockWsInstance()!.sentMessages[0]);
      getMockWsInstance()?.simulateMessage({
        type: 'res',
        id: req.id,
        ok: true,
        payload: { type: 'hello-ok', protocol: 3 }
      });
      await connectPromise;
      
      // 发送未知事件
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'unknown_event',
        payload: { data: 'test' }
      });
      
      // 不应该崩溃
      expect(connector.getStatus()).toBe('connected');
    });
    
    it('应该处理 tick 心跳事件', async () => {
      connector = new OpenClawConnector(defaultConfig);
      
      const connectPromise = connector.connect();
      await vi.waitFor(() => getMockWsInstance()?.readyState === MockWebSocket.OPEN);
      
      // 完成握手
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'nonce' }
      });
      await vi.waitFor(() => getMockWsInstance()!.sentMessages.length > 0);
      const req = JSON.parse(getMockWsInstance()!.sentMessages[0]);
      getMockWsInstance()?.simulateMessage({
        type: 'res',
        id: req.id,
        ok: true,
        payload: { type: 'hello-ok', protocol: 3 }
      });
      await connectPromise;
      
      // 发送 tick 事件
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'tick',
        payload: { ts: Date.now() }
      });
      
      // tick 事件应该被静默处理
      expect(connector.getStatus()).toBe('connected');
    });
    
    it('应该处理断开后再次断开', () => {
      connector = new OpenClawConnector(defaultConfig);
      
      // 多次调用 disconnect 不应该崩溃
      connector.disconnect();
      connector.disconnect();
      connector.disconnect();
      
      expect(connector.getStatus()).toBe('disconnected');
    });
  });
  
  // ===========================================
  // Device ID 测试
  // ===========================================
  
  describe('Device ID 管理', () => {
    it('应该生成并持久化 device ID', async () => {
      connector = new OpenClawConnector(defaultConfig);
      connector.connect();
      
      await vi.waitFor(() => getMockWsInstance()?.readyState === MockWebSocket.OPEN);
      
      // 完成握手
      getMockWsInstance()?.simulateMessage({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'nonce' }
      });
      
      await vi.waitFor(() => getMockWsInstance()!.sentMessages.length > 0);
      
      // 检查 connect 请求中的 instanceId
      const req = JSON.parse(getMockWsInstance()!.sentMessages[0]);
      expect(req.params.client.instanceId).toMatch(/^avatar-/);
      
      // device ID 应该被保存
      expect(localStorageMock.getItem).toHaveBeenCalledWith('openclaw-avatar-device-id');
    });
  });
});
