#!/usr/bin/env node
/**
 * 本地 TTS 代理服务器
 * 绕过 CORS，通过系统代理访问 Fish Audio API
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

const PROXY_PORT = 14201;
const SYSTEM_PROXY = 'http://127.0.0.1:7897';
const FISH_AUDIO_API = 'https://api.fish.audio/v1/tts';

// 解析系统代理
const proxyUrl = new URL(SYSTEM_PROXY);

function makeProxyRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(FISH_AUDIO_API);
    
    const proxyOptions = {
      hostname: proxyUrl.hostname,
      port: proxyUrl.port,
      method: 'CONNECT',
      path: `${targetUrl.hostname}:443`,
    };

    const proxyReq = http.request(proxyOptions);
    
    proxyReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Proxy CONNECT failed: ${res.statusCode}`));
        return;
      }

      const httpsOptions = {
        hostname: targetUrl.hostname,
        port: 443,
        path: targetUrl.pathname,
        method: 'POST',
        headers: options.headers,
        socket: socket,
        agent: false,
      };

      const req = https.request(httpsOptions, (response) => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks),
          });
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    proxyReq.on('error', reject);
    proxyReq.end();
  });
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method not allowed');
    return;
  }

  // 读取请求体
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString();

  console.log(`[TTS Proxy] 收到请求: ${body.slice(0, 100)}...`);

  try {
    const response = await makeProxyRequest({
      headers: {
        'Authorization': req.headers['authorization'],
        'Content-Type': 'application/json',
      },
    }, body);

    console.log(`[TTS Proxy] Fish Audio 响应: ${response.statusCode}, ${response.body.length} bytes`);

    res.writeHead(response.statusCode, {
      'Content-Type': response.headers['content-type'] || 'audio/mpeg',
      'Content-Length': response.body.length,
    });
    res.end(response.body);
  } catch (error) {
    console.error(`[TTS Proxy] 错误:`, error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log(`[TTS Proxy] 运行在 http://127.0.0.1:${PROXY_PORT}`);
  console.log(`[TTS Proxy] 系统代理: ${SYSTEM_PROXY}`);
});
