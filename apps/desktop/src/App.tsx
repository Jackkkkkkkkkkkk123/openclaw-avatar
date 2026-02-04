import { createSignal, createEffect, onMount, onCleanup, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import Avatar from "./components/Avatar";
import { avatarController, type Expression, type MotionGroup } from "./lib/AvatarController";
import { avatarSystem, type SystemState } from "./lib/AvatarSystem";
import { lipSyncDriver } from "./lib/LipSyncDriver";
import "./App.css";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

function App() {
  const [status, setStatus] = createSignal("初始化中...");
  const [avatarReady, setAvatarReady] = createSignal(false);
  const [currentExpression, setCurrentExpression] = createSignal<Expression>('neutral');
  const [systemState, setSystemState] = createSignal<SystemState>({
    connectionStatus: 'disconnected',
    isSpeaking: false,
    currentEmotion: 'neutral',
    lastMessage: '',
    processingText: '',
  });
  
  // 聊天相关
  const [chatMessages, setChatMessages] = createSignal<ChatMessage[]>([]);
  const [inputText, setInputText] = createSignal('');
  const [showChat, setShowChat] = createSignal(true);
  
  // 配置
  const [gatewayUrl, setGatewayUrl] = createSignal('ws://localhost:3939/ws');
  const [fishApiKey, setFishApiKey] = createSignal('');
  const [showSettings, setShowSettings] = createSignal(false);

  // Avatar 加载完成
  function handleAvatarReady() {
    setAvatarReady(true);
    setStatus("Avatar 已就绪");
    
    // 订阅系统状态
    avatarSystem.onStateChange((state) => {
      setSystemState(state);
      setCurrentExpression(state.currentEmotion);
    });
    
    // 订阅文本更新
    avatarSystem.onText((text, isComplete) => {
      if (isComplete && text) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: text,
          timestamp: Date.now(),
        }]);
      }
    });
  }

  // Avatar 加载失败
  function handleAvatarError(error: Error) {
    setStatus(`Avatar 错误: ${error.message}`);
  }

  // 切换表情
  function changeExpression(expr: Expression) {
    avatarSystem.setEmotion(expr);
    setCurrentExpression(expr);
  }

  // 播放动作
  function playMotion(group: MotionGroup) {
    avatarController.playMotion(group);
  }

  // 连接 OpenClaw
  async function connectOpenClaw() {
    setStatus("连接中...");
    try {
      avatarSystem.updateConfig({
        gatewayUrl: gatewayUrl(),
        fishApiKey: fishApiKey(),
      });
      await avatarSystem.connect();
      setStatus("已连接 OpenClaw");
    } catch (e) {
      setStatus(`连接失败: ${e}`);
    }
  }

  // 断开连接
  function disconnectOpenClaw() {
    avatarSystem.disconnect();
    setStatus("已断开");
  }

  // 发送消息
  function sendMessage() {
    const text = inputText().trim();
    if (!text) return;
    
    // 添加用户消息
    setChatMessages(prev => [...prev, {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }]);
    
    // 发送给 OpenClaw 或模拟
    if (systemState().connectionStatus === 'connected') {
      avatarSystem.sendMessage(text);
    } else {
      // 模拟回复（测试用）
      simulateResponse(text);
    }
    
    setInputText('');
  }

  // 模拟回复（测试用）
  async function simulateResponse(userText: string) {
    const responses = [
      "你好呀！很高兴见到你~ 😊",
      "哈哈，这个问题很有趣呢！",
      "让我想想...嗯，我觉得是这样的~",
      "哇，真的吗？太惊讶了！",
      "好的，我明白了。",
      "唉，这有点难过呢...",
    ];
    
    // 模拟延迟
    await new Promise(r => setTimeout(r, 500));
    
    // 随机选择回复
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    // 使用系统处理
    await avatarSystem.simulateResponse(response);
  }

  // 测试 TTS（无需 API）
  async function testLipSync() {
    const testText = "你好，我是初音未来！很高兴认识你~";
    setStatus("测试口型同步...");
    
    // 使用模拟口型
    avatarSystem.setEmotion('happy');
    await lipSyncDriver.simulateLipSync(testText, 3000);
    avatarSystem.setEmotion('neutral');
    
    setStatus("口型测试完成");
  }

  // 测试 TTS（需要 API Key）
  async function testTTS() {
    if (!fishApiKey()) {
      setStatus("请先设置 Fish API Key");
      setShowSettings(true);
      return;
    }
    
    const testText = "你好，我是初音未来！今天的天气真不错呢~";
    setStatus("TTS 测试中...");
    
    try {
      avatarSystem.updateConfig({ fishApiKey: fishApiKey() });
      await avatarSystem.speak(testText);
      setStatus("TTS 测试完成");
    } catch (e) {
      setStatus(`TTS 错误: ${e}`);
    }
  }

  // 键盘事件
  function handleKeyPress(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // 清理
  onCleanup(() => {
    avatarSystem.destroy();
  });

  return (
    <main class="container">
      <div class="avatar-header">
        <h1>🎵 初音未来</h1>
        <p class="subtitle">OpenClaw Avatar System</p>
      </div>

      <div class="main-layout">
        {/* Live2D Avatar */}
        <div class="avatar-stage">
          <Avatar 
            modelPath="/live2d/shizuku/shizuku.model.json"
            width={500}
            height={450}
            onReady={handleAvatarReady}
            onError={handleAvatarError}
          />
          
          {/* 状态指示器 */}
          {systemState().isSpeaking && (
            <div class="speaking-indicator">
              <span class="pulse"></span>
              说话中...
            </div>
          )}
        </div>

        {/* 聊天面板 */}
        {showChat() && avatarReady() && (
          <div class="chat-panel">
            <div class="chat-messages">
              <For each={chatMessages()}>
                {(msg) => (
                  <div class={`chat-message ${msg.role}`}>
                    <span class="content">{msg.content}</span>
                  </div>
                )}
              </For>
              
              {/* 正在输入提示 */}
              {systemState().processingText && (
                <div class="chat-message assistant typing">
                  <span class="content">{systemState().processingText}</span>
                  <span class="typing-dots">...</span>
                </div>
              )}
            </div>
            
            <div class="chat-input">
              <input
                type="text"
                value={inputText()}
                onInput={(e) => setInputText(e.currentTarget.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入消息..."
              />
              <button onClick={sendMessage}>发送</button>
            </div>
          </div>
        )}
      </div>

      {/* 控制面板 */}
      {avatarReady() && (
        <div class="control-panel">
          <div class="control-group">
            <h3>表情</h3>
            <div class="button-row">
              <button 
                onClick={() => changeExpression('neutral')}
                class={currentExpression() === 'neutral' ? 'active' : ''}
              >
                😐 普通
              </button>
              <button 
                onClick={() => changeExpression('happy')}
                class={currentExpression() === 'happy' ? 'active' : ''}
              >
                😊 开心
              </button>
              <button 
                onClick={() => changeExpression('sad')}
                class={currentExpression() === 'sad' ? 'active' : ''}
              >
                😢 难过
              </button>
              <button 
                onClick={() => changeExpression('surprised')}
                class={currentExpression() === 'surprised' ? 'active' : ''}
              >
                😮 惊讶
              </button>
            </div>
          </div>

          <div class="control-group">
            <h3>动作</h3>
            <div class="button-row">
              <button onClick={() => playMotion('idle')}>🧘 Idle</button>
              <button onClick={() => playMotion('tap_body')}>👋 摸身体</button>
              <button onClick={() => playMotion('shake')}>🫨 摇晃</button>
              <button onClick={() => playMotion('flick_head')}>👆 摸头</button>
            </div>
          </div>

          <div class="control-group">
            <h3>测试</h3>
            <div class="button-row">
              <button onClick={testLipSync}>🎤 口型测试</button>
              <button onClick={testTTS}>🔊 TTS 测试</button>
              <button onClick={() => setShowChat(!showChat())}>
                💬 {showChat() ? '隐藏' : '显示'}聊天
              </button>
              <button onClick={() => setShowSettings(!showSettings())}>
                ⚙️ 设置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 设置面板 */}
      {showSettings() && (
        <div class="settings-panel">
          <h3>⚙️ 设置</h3>
          
          <div class="setting-item">
            <label>Gateway URL</label>
            <input
              type="text"
              value={gatewayUrl()}
              onInput={(e) => setGatewayUrl(e.currentTarget.value)}
              placeholder="ws://localhost:3939/ws"
            />
          </div>
          
          <div class="setting-item">
            <label>Fish Audio API Key</label>
            <input
              type="password"
              value={fishApiKey()}
              onInput={(e) => setFishApiKey(e.currentTarget.value)}
              placeholder="输入 API Key"
            />
          </div>
          
          <div class="button-row">
            {systemState().connectionStatus === 'connected' ? (
              <button onClick={disconnectOpenClaw} class="btn-danger">
                断开连接
              </button>
            ) : (
              <button onClick={connectOpenClaw} class="btn-primary">
                连接 OpenClaw
              </button>
            )}
            <button onClick={() => setShowSettings(false)}>关闭</button>
          </div>
        </div>
      )}

      <div class="status-panel">
        <div class={`status-indicator ${systemState().connectionStatus}`}>
          <span class="dot"></span>
          <span>
            {systemState().connectionStatus === 'connected' 
              ? 'OpenClaw 已连接' 
              : systemState().connectionStatus === 'connecting'
              ? '连接中...'
              : avatarReady() 
              ? 'Avatar 就绪 (离线模式)' 
              : '加载中...'}
          </span>
        </div>
        <p class="status-message">{status()}</p>
      </div>

      <footer class="tech-stack">
        <span>SolidJS</span>
        <span>•</span>
        <span>Tauri 2.0</span>
        <span>•</span>
        <span>Live2D</span>
        <span>•</span>
        <span>Fish Audio</span>
        <span>•</span>
        <span>OpenClaw</span>
      </footer>
    </main>
  );
}

export default App;
