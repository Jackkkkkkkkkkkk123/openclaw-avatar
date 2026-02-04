import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:18789/ws');

ws.on('open', () => {
  console.log('✅ Connected!');
});

ws.on('message', (data) => {
  console.log('📨 Message:', data.toString());
  
  // 解析消息
  try {
    const msg = JSON.parse(data.toString());
    
    // 如果是 challenge，发送 connect
    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      console.log('🔐 Got challenge, sending connect...');
      
      const connectReq = {
        type: 'req',
        id: 'test-connect-1',
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'ws-test',
            version: '0.1.0',
            platform: 'web',
            mode: 'operator'
          },
          role: 'operator',
          scopes: ['operator.read', 'operator.write'],
          caps: [],
          commands: [],
          permissions: {},
          auth: {},
          locale: 'zh-CN',
          userAgent: 'ws-test/0.1.0',
          device: {
            id: 'test-device-123'
          }
        }
      };
      
      ws.send(JSON.stringify(connectReq));
    }
    
    // 如果 connect 成功，发送一条消息测试
    if (msg.type === 'res' && msg.id === 'test-connect-1' && msg.ok) {
      console.log('✅ Connect OK! Sending test message...');
      
      const agentReq = {
        type: 'req',
        id: 'test-agent-1',
        method: 'agent',
        params: {
          message: '你好，这是测试消息',
          idempotencyKey: 'test-' + Date.now()
        }
      };
      
      ws.send(JSON.stringify(agentReq));
    }
    
    // 处理 agent 响应
    if (msg.type === 'event' && msg.event === 'agent') {
      console.log('🤖 Agent event:', JSON.stringify(msg.payload, null, 2));
    }
    
    if (msg.type === 'res' && msg.id === 'test-agent-1') {
      console.log('📤 Agent response:', JSON.stringify(msg, null, 2));
    }
    
  } catch (e) {
    console.log('Parse error:', e);
  }
});

ws.on('close', (code, reason) => {
  console.log('❌ Closed:', code, reason.toString());
});

ws.on('error', (err) => {
  console.log('💥 Error:', err.message);
});

setTimeout(() => {
  console.log('Timeout, closing...');
  ws.close();
}, 15000);
