import WebSocket from 'ws';
import crypto from 'crypto';
import fs from 'fs';

// 读取 OpenClaw 的设备身份
const deviceJson = JSON.parse(fs.readFileSync(
  process.env.HOME + '/.openclaw/identity/device.json', 
  'utf8'
));
const deviceAuthJson = JSON.parse(fs.readFileSync(
  process.env.HOME + '/.openclaw/identity/device-auth.json', 
  'utf8'
));

const deviceId = deviceJson.deviceId;
const privateKey = crypto.createPrivateKey(deviceJson.privateKeyPem);
const publicKey = crypto.createPublicKey(deviceJson.publicKeyPem);

// 从 PEM 提取原始公钥（32 字节）
const rawPubKey = publicKey.export({ type: 'spki', format: 'der' }).slice(-32);
const publicKeyBase64 = rawPubKey.toString('base64');

// 设备 token
const deviceToken = deviceAuthJson.tokens?.operator?.token;

console.log('🔑 Using OpenClaw device identity:');
console.log('  Device ID:', deviceId);
console.log('  Public Key:', publicKeyBase64);
console.log('  Device Token:', deviceToken ? 'present' : 'none');

const ws = new WebSocket('ws://localhost:18789/ws');

ws.on('open', () => {
  console.log('\n✅ Connected');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📨', msg.type, msg.event || '', msg.ok ?? '');
  
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    const nonce = msg.payload?.nonce;
    const signedAt = Date.now();
    
    console.log('🔐 Challenge nonce:', nonce);
    
    // 尝试只签名 nonce
    const message = nonce;
    console.log('Signing message:', message);
    const signature = crypto.sign(null, Buffer.from(message), privateKey).toString('base64');
    
    const connectReq = {
      type: 'req',
      id: 'connect-1',
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'cli',
          version: '1.0.0',
          platform: 'macOS',
          mode: 'cli'
        },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        caps: [],
        auth: {
          // deviceToken 不应该在这里
        },
        locale: 'zh-CN',
        device: {
          id: deviceId,
          publicKey: publicKeyBase64,
          signature: signature,
          signedAt: signedAt,
          nonce: nonce  // 添加 nonce
        }
      }
    };
    
    console.log('📤 Sending connect with OpenClaw device identity...');
    ws.send(JSON.stringify(connectReq));
  }
  
  if (msg.type === 'res' && msg.id === 'connect-1') {
    if (msg.ok) {
      console.log('✅ CONNECT SUCCESS!');
      console.log('Payload:', JSON.stringify(msg.payload, null, 2));
      
      // 发送测试消息
      setTimeout(() => {
        console.log('\n📤 Sending test message to agent...');
        const agentReq = {
          type: 'req',
          id: 'agent-1',
          method: 'agent',
          params: {
            message: '你好！这是来自 Avatar 身体的测试消息。请简短回复确认你收到了。',
            idempotencyKey: 'avatar-test-' + Date.now()
          }
        };
        ws.send(JSON.stringify(agentReq));
      }, 500);
    } else {
      console.log('❌ CONNECT FAILED:', msg.error?.message);
      ws.close();
    }
  }
  
  // Agent 事件（流式响应）
  if (msg.type === 'event' && msg.event === 'agent') {
    const p = msg.payload;
    if (p.text || p.content) {
      process.stdout.write(p.text || p.content || '');
    }
    if (p.type === 'end' || p.type === 'done' || p.status === 'completed') {
      console.log('\n🤖 [Response complete]');
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
    console.log('📨 Event:', msg.event);
  }
});

ws.on('close', (code, reason) => {
  console.log('\n❌ Closed:', code, reason.toString());
  process.exit(0);
});

ws.on('error', (err) => {
  console.log('💥 Error:', err.message);
});

setTimeout(() => {
  console.log('\n⏱️ Timeout');
  ws.close();
}, 60000);
