import puppeteer from 'puppeteer';

async function testFromGateway() {
  console.log('🚀 Testing WebSocket from Gateway page...');
  
  const browser = await puppeteer.launch({
    headless: false,  // 使用有界面的浏览器
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  // 监听控制台输出
  page.on('console', msg => {
    console.log('🌐', msg.text());
  });
  
  // 导航到 Gateway 页面
  await page.goto('http://localhost:18789/');
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('📄 Gateway page loaded, injecting WebSocket test...');
  
  // 在页面中注入 WebSocket 测试代码
  const result = await page.evaluate(() => {
    return new Promise((resolve) => {
      const ws = new WebSocket('ws://localhost:18789/ws');
      const logs = [];
      
      ws.onopen = () => {
        logs.push('Connected');
      };
      
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        logs.push(`${msg.type} ${msg.event || ''} ${msg.ok ?? ''}`);
        
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
                platform: navigator.platform || 'web',
                mode: 'webchat',
                instanceId: 'avatar-test-' + Date.now()
              },
              scopes: [],
              caps: [],
              auth: {},
              locale: navigator.language || 'zh-CN'
            }
          };
          ws.send(JSON.stringify(connectReq));
        }
        
        if (msg.type === 'res' && msg.id === 'connect-1') {
          if (msg.ok) {
            logs.push('✅ CONNECT SUCCESS!');
            logs.push(JSON.stringify(msg.payload));
            
            // 发送测试消息
            setTimeout(() => {
              const agentReq = {
                type: 'req',
                id: 'agent-1',
                method: 'agent',
                params: {
                  message: '你好！简短回复一下。',
                  idempotencyKey: 'test-' + Date.now()
                }
              };
              ws.send(JSON.stringify(agentReq));
            }, 500);
          } else {
            logs.push('❌ CONNECT FAILED: ' + msg.error?.message);
            ws.close();
            resolve(logs);
          }
        }
        
        if (msg.type === 'event' && msg.event === 'agent') {
          const p = msg.payload;
          if (p.text || p.content) {
            logs.push('🤖 ' + (p.text || p.content));
          }
          if (p.type === 'end' || p.type === 'done') {
            logs.push('[Agent response complete]');
            setTimeout(() => {
              ws.close();
              resolve(logs);
            }, 1000);
          }
        }
      };
      
      ws.onclose = () => {
        logs.push('Connection closed');
        resolve(logs);
      };
      
      ws.onerror = () => {
        logs.push('Connection error');
        resolve(logs);
      };
      
      // 超时
      setTimeout(() => {
        ws.close();
        resolve(logs);
      }, 30000);
    });
  });
  
  console.log('\n📋 Result:');
  result.forEach(log => console.log('  ', log));
  
  await browser.close();
  console.log('\n✅ Test complete');
}

testFromGateway().catch(console.error);
