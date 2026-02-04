import WebSocket from 'ws';

// 测试不同的 role 值
const roles = ['webchat', 'user', 'client', 'viewer', 'guest', ''];

async function testRole(role) {
  return new Promise((resolve) => {
    console.log(`\n🧪 Testing role="${role}"`);
    
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
              id: 'openclaw-control-ui',
              version: '1.0.0',
              platform: 'web',
              mode: 'webchat'
            },
            role: role || undefined,
            scopes: [],
            caps: [],
            auth: {},
            locale: 'zh-CN'
          }
        };
        
        // 如果 role 为空，删除该字段
        if (!role) delete connectReq.params.role;
        
        ws.send(JSON.stringify(connectReq));
      }
      
      if (msg.type === 'res' && msg.id === 'connect-1') {
        if (msg.ok) {
          console.log('  ✅ SUCCESS!');
          result = { success: true };
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
    }, 3000);
  });
}

for (const role of roles) {
  const result = await testRole(role);
  if (result?.success) {
    console.log('\n🎉 Found working role:', role || '(none)');
    break;
  }
}

process.exit(0);
