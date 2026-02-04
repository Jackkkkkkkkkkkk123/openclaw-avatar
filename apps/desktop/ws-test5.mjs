import WebSocket from 'ws';

// 带 origin 头的连接
console.log('🧪 Testing with origin header for secure context');

const ws = new WebSocket('ws://localhost:18789/ws', {
  headers: {
    'Origin': 'http://localhost:18789'
  }
});

ws.on('open', () => {
  console.log('✅ Connected');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📨 Received:', msg.type, msg.event || '', msg.ok ?? '');
  
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    console.log('🔐 Challenge received');
    
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
        // 不指定 role
        scopes: [],
        caps: [],
        auth: {},
        locale: 'zh-CN'
      }
    };
    
    console.log('📤 Sending connect (no role)');
    ws.send(JSON.stringify(connectReq));
  }
  
  if (msg.type === 'res' && msg.id === 'connect-1') {
    if (msg.ok) {
      console.log('✅ CONNECT SUCCESS!');
      console.log('Payload:', JSON.stringify(msg.payload, null, 2));
      
      // 发送测试消息
      setTimeout(() => {
        console.log('\n📤 Sending test message...');
        const agentReq = {
          type: 'req',
          id: 'agent-1',
          method: 'agent',
          params: {
            message: '你好！',
            idempotencyKey: 'test-' + Date.now()
          }
        };
        ws.send(JSON.stringify(agentReq));
      }, 500);
    } else {
      console.log('❌ CONNECT FAILED:', msg.error?.message);
      ws.close();
    }
  }
  
  // Agent 事件
  if (msg.type === 'event' && msg.event === 'agent') {
    const p = msg.payload;
    if (p.type === 'text' || p.type === 'chunk') {
      process.stdout.write(p.text || p.content || '');
    } else if (p.type === 'end' || p.type === 'done') {
      console.log('\n🤖 [Response complete]');
    } else {
      console.log('🤖 Agent:', JSON.stringify(p).substring(0, 100));
    }
  }
  
  // Agent 响应
  if (msg.type === 'res' && msg.id === 'agent-1') {
    if (msg.ok) {
      console.log('📤 Agent request accepted');
    } else {
      console.log('📤 Agent request failed:', msg.error?.message);
    }
  }
  
  // 其他事件
  if (msg.type === 'event' && !['connect.challenge', 'agent', 'tick'].includes(msg.event)) {
    console.log('📨 Event:', msg.event, JSON.stringify(msg.payload).substring(0, 100));
  }
});

ws.on('close', (code, reason) => {
  console.log('❌ Closed:', code, reason.toString());
  process.exit(0);
});

ws.on('error', (err) => {
  console.log('💥 Error:', err.message);
});

setTimeout(() => {
  console.log('\n⏱️ Timeout');
  ws.close();
}, 30000);
