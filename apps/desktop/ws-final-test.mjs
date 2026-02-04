import WebSocket from 'ws';
import crypto from 'crypto';

// 生成设备密钥对
function generateDeviceIdentity() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey
  };
}

// 签名设备身份
function signDeviceIdentity(privateKey, deviceId, nonce) {
  const signedAt = Date.now();
  const message = `${deviceId}:${nonce}:${signedAt}`;
  const signature = crypto.sign(null, Buffer.from(message), privateKey).toString('base64');
  return { signature, signedAt };
}

console.log('🧪 Testing with device identity...');

const ws = new WebSocket('ws://localhost:18789/ws');
let challengeNonce = null;
const deviceId = 'avatar-test-' + Date.now();
const { publicKey, privateKey } = generateDeviceIdentity();

ws.on('open', () => {
  console.log('✅ Connected');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📨', msg.type, msg.event || '', msg.ok ?? '');
  
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    challengeNonce = msg.payload?.nonce;
    console.log('🔐 Challenge received, nonce:', challengeNonce);
    
    // 签名
    const { signature, signedAt } = signDeviceIdentity(privateKey, deviceId, challengeNonce);
    
    const connectReq = {
      type: 'req',
      id: 'connect-1',
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'cli',  // 使用 cli 客户端
          version: '1.0.0',
          platform: 'macOS',
          mode: 'cli'
        },
        scopes: [],
        caps: [],
        auth: {},
        locale: 'zh-CN',
        device: {
          id: deviceId,
          publicKey: publicKey,
          signature: signature,
          signedAt: signedAt
        }
      }
    };
    
    console.log('📤 Sending connect with device identity...');
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
            message: '你好！简短回复。',
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
    if (p.text || p.content) {
      process.stdout.write(p.text || p.content || '');
    }
    if (p.type === 'end' || p.type === 'done') {
      console.log('\n🤖 [Response complete]');
    }
  }
  
  // Agent 响应
  if (msg.type === 'res' && msg.id === 'agent-1') {
    console.log('📤 Agent:', msg.ok ? 'OK' : 'FAIL - ' + msg.error?.message);
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
