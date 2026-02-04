import WebSocket from 'ws';

// 使用从 OpenClaw Control UI 发现的参数
console.log('🧪 Testing with openclaw-control-ui / webchat');

const ws = new WebSocket('ws://localhost:18789/ws');

ws.on('open', () => {
  console.log('✅ Connected');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📨 Received:', msg.type, msg.event || msg.method || '', msg.ok ?? '');
  
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    console.log('🔐 Challenge received, sending connect...');
    
    const connectReq = {
      type: 'req',
      id: 'connect-1',
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'openclaw-control-ui',
          version: '1.0.0',
          platform: 'web',
          mode: 'webchat'
        },
        role: 'control',
        scopes: [],
        caps: [],
        auth: {},
        locale: 'zh-CN'
      }
    };
    
    console.log('📤 Sending:', JSON.stringify(connectReq, null, 2));
    ws.send(JSON.stringify(connectReq));
  }
  
  if (msg.type === 'res' && msg.id === 'connect-1') {
    if (msg.ok) {
      console.log('✅ CONNECT SUCCESS!');
      console.log('Payload:', JSON.stringify(msg.payload, null, 2));
      
      // 发送测试消息
      console.log('\n📤 Sending test message to agent...');
      const agentReq = {
        type: 'req',
        id: 'agent-1',
        method: 'agent',
        params: {
          message: '你好！这是来自 Avatar 身体的测试消息。',
          idempotencyKey: 'test-' + Date.now()
        }
      };
      ws.send(JSON.stringify(agentReq));
    } else {
      console.log('❌ CONNECT FAILED:', msg.error?.message);
      ws.close();
    }
  }
  
  // Agent 事件（流式响应）
  if (msg.type === 'event' && msg.event === 'agent') {
    console.log('🤖 Agent event:', JSON.stringify(msg.payload).substring(0, 200));
  }
  
  // Agent 响应
  if (msg.type === 'res' && msg.id === 'agent-1') {
    console.log('📤 Agent response:', msg.ok ? 'OK' : 'FAIL', JSON.stringify(msg.payload || msg.error).substring(0, 200));
  }
});

ws.on('close', (code, reason) => {
  console.log('❌ Closed:', code, reason.toString());
});

ws.on('error', (err) => {
  console.log('💥 Error:', err.message);
});

// 30 秒后关闭
setTimeout(() => {
  console.log('\n⏱️ Timeout, closing...');
  ws.close();
}, 30000);
