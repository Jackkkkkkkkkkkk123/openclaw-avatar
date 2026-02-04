import WebSocket from 'ws';

// 尝试不同的参数组合
const testParams = [
  { id: 'openclaw-control', mode: 'control' },
  { id: 'control', mode: 'control' },
  { id: 'openclaw', mode: 'operator' },
];

async function testConnection(clientId, clientMode) {
  return new Promise((resolve) => {
    console.log(`\n🧪 Testing: id="${clientId}", mode="${clientMode}"`);
    
    const ws = new WebSocket('ws://localhost:18789/ws');
    let result = null;

    ws.on('open', () => {
      console.log('  ✅ Connected');
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        console.log('  🔐 Challenge received');
        
        const connectReq = {
          type: 'req',
          id: 'test-connect',
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: clientId,
              version: '0.1.0',
              platform: 'web',
              mode: clientMode
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
      
      if (msg.type === 'res' && msg.id === 'test-connect') {
        if (msg.ok) {
          console.log('  ✅ SUCCESS!');
          result = { success: true, payload: msg.payload };
        } else {
          console.log('  ❌ Failed:', msg.error?.message?.substring(0, 100));
          result = { success: false, error: msg.error };
        }
        ws.close();
      }
    });

    ws.on('close', () => {
      resolve(result);
    });

    ws.on('error', (err) => {
      console.log('  💥 Error:', err.message);
      resolve({ success: false, error: err.message });
    });

    setTimeout(() => {
      ws.close();
      resolve(result);
    }, 3000);
  });
}

// 测试所有组合
for (const { id, mode } of testParams) {
  await testConnection(id, mode);
}

// 尝试模拟 control UI 的连接方式（无签名，本地连接）
console.log('\n🧪 Testing: local control UI style (no device signature)');
const ws = new WebSocket('ws://localhost:18789/ws');

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    console.log('  🔐 Challenge received');
    
    // 尝试最简化的 connect 请求
    const connectReq = {
      type: 'req',
      id: 'test-connect',
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'openclaw-control',
          version: '1.0.0',
          platform: 'web',
          mode: 'control'
        },
        role: 'control',
        scopes: [],
        caps: [],
        auth: {},
        locale: 'zh-CN'
      }
    };
    
    ws.send(JSON.stringify(connectReq));
  }
  
  if (msg.type === 'res' && msg.id === 'test-connect') {
    if (msg.ok) {
      console.log('  ✅ SUCCESS! Payload:', JSON.stringify(msg.payload, null, 2));
    } else {
      console.log('  ❌ Failed:', msg.error?.message);
    }
    ws.close();
  }
});

ws.on('close', () => {
  console.log('Done.');
  process.exit(0);
});

setTimeout(() => {
  ws.close();
  process.exit(0);
}, 10000);
