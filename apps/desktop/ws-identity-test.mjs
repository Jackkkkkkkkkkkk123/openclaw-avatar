import WebSocket from 'ws';
import crypto from 'crypto';

// 生成 Ed25519 密钥对（原始格式）
function generateDeviceKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  // 导出原始的 32 字节公钥
  const rawPubKey = publicKey.export({ type: 'spki', format: 'der' });
  // SPKI 格式的 Ed25519 公钥：前 12 字节是头，后 32 字节是实际公钥
  const pubKeyBytes = rawPubKey.slice(-32);
  return {
    publicKeyBase64: pubKeyBytes.toString('base64'),
    privateKey
  };
}

// 签名
function createSignature(privateKey, nonce, signedAt) {
  // 尝试不同的消息格式
  // 格式1: nonce:signedAt
  const message = `${nonce}:${signedAt}`;
  const signature = crypto.sign(null, Buffer.from(message), privateKey);
  return signature.toString('base64');
}

console.log('🧪 Testing device identity with raw Ed25519 key...');

const ws = new WebSocket('ws://localhost:18789/ws');
const { publicKeyBase64, privateKey } = generateDeviceKeys();
const deviceId = 'avatar-' + Date.now();

console.log('Device ID:', deviceId);
console.log('Public Key (base64):', publicKeyBase64);

ws.on('open', () => {
  console.log('✅ Connected');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📨', msg.type, msg.event || '', msg.ok ?? '');
  
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    const nonce = msg.payload?.nonce;
    const signedAt = Date.now();
    
    console.log('🔐 Challenge nonce:', nonce);
    
    // 尝试几种不同的签名消息格式
    const formats = [
      `${nonce}:${signedAt}`,
      `${deviceId}:${nonce}:${signedAt}`,
      nonce,
      JSON.stringify({ nonce, signedAt }),
      JSON.stringify({ nonce, signedAt, deviceId }),
    ];
    
    // 使用第一种格式
    const message = formats[0];
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
        scopes: [],
        caps: [],
        auth: {},
        locale: 'zh-CN',
        device: {
          id: deviceId,
          publicKey: publicKeyBase64,
          signature: signature,
          signedAt: signedAt
        }
      }
    };
    
    console.log('📤 Device params:', JSON.stringify(connectReq.params.device, null, 2));
    ws.send(JSON.stringify(connectReq));
  }
  
  if (msg.type === 'res' && msg.id === 'connect-1') {
    if (msg.ok) {
      console.log('✅ CONNECT SUCCESS!');
      console.log('Payload:', JSON.stringify(msg.payload, null, 2));
    } else {
      console.log('❌ CONNECT FAILED:', msg.error?.message);
    }
    ws.close();
  }
});

ws.on('close', (code, reason) => {
  console.log('Closed:', code, reason.toString());
  process.exit(0);
});

ws.on('error', (err) => {
  console.log('💥 Error:', err.message);
});

setTimeout(() => ws.close(), 10000);
