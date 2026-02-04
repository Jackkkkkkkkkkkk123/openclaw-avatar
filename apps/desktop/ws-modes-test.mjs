import WebSocket from 'ws';

// 测试不同的 client ID 和 mode 组合
const combinations = [
  { id: 'openclaw-control-ui', mode: 'control' },
  { id: 'gateway-client', mode: 'webchat' },
  { id: 'gateway-client', mode: 'control' },
  { id: 'cli', mode: 'cli' },
  { id: 'openclaw-cli', mode: 'cli' },
];

async function testCombination(clientId, clientMode) {
  return new Promise((resolve) => {
    console.log(`\n🧪 Testing: id="${clientId}", mode="${clientMode}"`);
    
    const ws = new WebSocket('ws://localhost:18789/ws');
    let result = null;

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        const connectReq = {
          type: 'req',
          id: 'connect-1',
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: clientId,
              version: '1.0.0',
              platform: 'macOS',
              mode: clientMode,
              instanceId: 'test-' + Date.now()
            },
            scopes: [],
            caps: [],
            auth: {},
            locale: 'zh-CN'
          }
        };
        
        ws.send(JSON.stringify(connectReq));
      }
      
      if (msg.type === 'res' && msg.id === 'connect-1') {
        if (msg.ok) {
          console.log('  ✅ SUCCESS!');
          result = { success: true, payload: msg.payload };
        } else {
          console.log('  ❌ Failed:', msg.error?.message?.substring(0, 80));
          result = { success: false, error: msg.error?.message };
        }
        ws.close();
      }
    });

    ws.on('close', () => resolve(result));
    ws.on('error', () => resolve({ success: false }));
    
    setTimeout(() => {
      ws.close();
      resolve(result);
    }, 5000);
  });
}

let found = false;
for (const { id, mode } of combinations) {
  const result = await testCombination(id, mode);
  if (result?.success) {
    console.log('\n🎉 Found working combination:', id, mode);
    console.log('Payload:', JSON.stringify(result.payload, null, 2));
    found = true;
    break;
  }
}

if (!found) {
  console.log('\n😕 No working combination found');
}

process.exit(0);
