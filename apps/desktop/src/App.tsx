// OpenClaw Avatar - 主应用
import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import Avatar from './components/Avatar';
import { ChatPanel, type ChatMessage } from './components/ChatPanel';
import { SettingsDialog } from './components/SettingsDialog';
import { DevPanel } from './components/DevPanel';
import { OfflineIndicator } from './components/OfflineIndicator';
import { EmotionParticles } from './components/EmotionParticles';
import { EmotionBackground } from './components/EmotionBackground';
import { Button } from './components/ui';
import { avatarController, type Expression, type MotionGroup } from './lib/AvatarController';
import { avatarSystem, type SystemState } from './lib/AvatarSystem';
import { lipSyncDriver } from './lib/LipSyncDriver';
import { performanceMonitor } from './lib/PerformanceMonitor';
import { config, updateConfig, resetConfig } from './stores/configStore';
import { initTheme, toggleTheme, getThemeIcon } from './stores/themeStore';
import './theme.css';
import './App.css';

function App() {
  // 状态
  const [avatarReady, setAvatarReady] = createSignal(false);
  const [statusMessage, setStatusMessage] = createSignal('初始化中...');
  const [systemState, setSystemState] = createSignal<SystemState>({
    connectionStatus: 'disconnected',
    isSpeaking: false,
    currentEmotion: 'neutral',
    lastMessage: '',
    processingText: '',
  });
  
  // 聊天消息
  const [chatMessages, setChatMessages] = createSignal<ChatMessage[]>([]);
  
  // UI 状态
  const [showSettings, setShowSettings] = createSignal(false);
  const [controlsExpanded, setControlsExpanded] = createSignal(config().controlsExpanded);
  const [showDevPanel, setShowDevPanel] = createSignal(config().showDevPanel ?? false);
  
  // 当前模型路径
  const [modelPath, setModelPath] = createSignal(config().modelPath);
  
  // 初始化主题
  onMount(() => {
    initTheme();
  });
  
  // Avatar 加载完成
  function handleAvatarReady() {
    setAvatarReady(true);
    setStatusMessage('Avatar 已就绪');
    
    // 订阅系统状态
    avatarSystem.onStateChange((state) => {
      setSystemState(state);
    });
    
    // 订阅文本更新
    avatarSystem.onText((text, isComplete) => {
      if (isComplete && text) {
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: text,
          timestamp: Date.now(),
        }]);
      }
    });
    
    // 自动连接 OpenClaw Gateway
    avatarSystem.updateConfig({
      gatewayUrl: config().gatewayUrl,
      gatewayToken: config().gatewayToken,
    });
    avatarSystem.connect().catch(err => {
      console.warn('[App] OpenClaw 自动连接失败:', err);
      setStatusMessage('OpenClaw 连接失败，使用离线模式');
    });
  }
  
  // Avatar 加载失败
  function handleAvatarError(error: Error) {
    setStatusMessage(`Avatar 错误: ${error.message}`);
  }
  
  // 发送消息
  function handleSendMessage(text: string) {
    // 添加用户消息
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }]);
    
    // 发送或模拟
    if (systemState().connectionStatus === 'connected') {
      avatarSystem.sendMessage(text);
    } else {
      simulateResponse(text);
    }
  }
  
  // 模拟回复
  async function simulateResponse(_userText: string) {
    const responses = [
      "你好呀！很高兴见到你~ 😊",
      "哈哈，这个问题很有趣呢！",
      "让我想想...嗯，我觉得是这样的~",
      "哇，真的吗？太惊讶了！",
      "好的，我明白了。",
      "唉，这有点难过呢...",
    ];
    
    await new Promise(r => setTimeout(r, 500));
    const response = responses[Math.floor(Math.random() * responses.length)];
    await avatarSystem.simulateResponse(response);
  }
  
  // 清空聊天记录
  function handleClearHistory() {
    setChatMessages([]);
  }
  
  // 连接 OpenClaw
  async function handleConnect() {
    setStatusMessage('连接中...');
    try {
      avatarSystem.updateConfig({
        gatewayUrl: config().gatewayUrl,
        gatewayToken: config().gatewayToken,
        fishApiKey: config().fishApiKey,
      });
      await avatarSystem.connect();
      setStatusMessage('已连接 OpenClaw');
    } catch (e) {
      setStatusMessage(`连接失败: ${e}`);
    }
  }
  
  // 断开连接
  function handleDisconnect() {
    avatarSystem.disconnect();
    setStatusMessage('已断开');
  }
  
  // 切换表情
  function changeExpression(expr: Expression) {
    avatarSystem.setEmotion(expr);
  }
  
  // 播放动作
  function playMotion(group: MotionGroup) {
    avatarController.playMotion(group);
  }
  
  // 测试口型
  async function testLipSync() {
    setStatusMessage('测试口型同步...');
    avatarSystem.setEmotion('happy');
    await lipSyncDriver.simulateLipSync('你好，我是初音未来！', 3000);
    avatarSystem.setEmotion('neutral');
    setStatusMessage('口型测试完成');
  }
  
  // 测试 TTS
  async function testTTS() {
    if (!config().fishApiKey) {
      setStatusMessage('请先设置 Fish API Key');
      setShowSettings(true);
      return;
    }
    
    setStatusMessage('TTS 测试中...');
    try {
      avatarSystem.updateConfig({ fishApiKey: config().fishApiKey });
      await avatarSystem.speak('你好，我是初音未来！今天的天气真不错呢~');
      setStatusMessage('TTS 测试完成');
    } catch (e) {
      setStatusMessage(`TTS 错误: ${e}`);
    }
  }
  
  // 模型变更
  function handleModelChange(path: string, name: string) {
    setModelPath(path);
    setStatusMessage(`切换模型: ${name}`);
  }
  
  // 清理
  onCleanup(() => {
    avatarSystem.destroy();
    performanceMonitor.destroy();
  });
  
  return (
    <main class="app">
      {/* 离线状态指示器 */}
      <OfflineIndicator />
      
      {/* 头部 */}
      <header class="app-header">
        <div class="app-header__brand">
          <h1>🎵 初音未来</h1>
          <span class="app-header__subtitle">OpenClaw Avatar System</span>
        </div>
        
        <div class="app-header__actions">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setShowDevPanel(!showDevPanel());
              updateConfig({ showDevPanel: !showDevPanel() });
            }}
            title="开发者面板"
            active={showDevPanel()}
          >
            🛠️
          </Button>
          <Button variant="ghost" size="sm" onClick={toggleTheme} title="切换主题">
            {getThemeIcon(config().theme)}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)} title="设置">
            ⚙️
          </Button>
          <Button variant="ghost" size="sm" onClick={() => {
            resetConfig();
            window.location.reload();
          }} title="重置配置">
            🔄
          </Button>
        </div>
      </header>
      
      {/* 主区域 */}
      <div class={`app-main ${config().chatPosition === 'left' ? 'app-main--chat-left' : ''}`}>
        {/* Avatar 舞台 */}
        <section class="avatar-stage">
          {/* 情绪驱动背景 */}
          <EmotionBackground
            emotion={systemState().currentEmotion}
            enabled={config().enableBackground ?? true}
            intensity={1.0}
            showControls={showDevPanel()}
          />
          
          {/* 情绪粒子特效 */}
          <EmotionParticles
            emotion={systemState().currentEmotion}
            intensity={1.0}
            enabled={config().enableParticles ?? true}
            showControls={showDevPanel()}
            showCounter={showDevPanel()}
          />
          
          <Avatar 
            modelPath={modelPath()}
            width={500}
            height={450}
            onReady={handleAvatarReady}
            onError={handleAvatarError}
          />
          
          {/* 说话指示器 */}
          <Show when={systemState().isSpeaking}>
            <div class="speaking-badge">
              <span class="speaking-badge__pulse"></span>
              说话中...
            </div>
          </Show>
          
          {/* 表情状态 */}
          <div class="emotion-badge">
            {systemState().currentEmotion === 'happy' ? '😊' :
             systemState().currentEmotion === 'sad' ? '😢' :
             systemState().currentEmotion === 'surprised' ? '😮' : '😐'}
          </div>
        </section>
        
        {/* 聊天面板 */}
        <Show when={config().showChat && avatarReady()}>
          <aside class="chat-aside">
            <ChatPanel
              messages={chatMessages()}
              processingText={systemState().processingText}
              isSpeaking={systemState().isSpeaking}
              onSendMessage={handleSendMessage}
              onClearHistory={handleClearHistory}
            />
          </aside>
        </Show>
      </div>
      
      {/* 控制面板 */}
      <Show when={avatarReady()}>
        <section class="controls-panel">
          <div class="controls-panel__header">
            <span>控制面板</span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setControlsExpanded(!controlsExpanded());
                updateConfig({ controlsExpanded: !controlsExpanded() });
              }}
            >
              {controlsExpanded() ? '收起 ▲' : '展开 ▼'}
            </Button>
          </div>
          
          <Show when={controlsExpanded()}>
            <div class="controls-panel__body">
              {/* 表情控制 */}
              <div class="control-group">
                <h4>表情</h4>
                <div class="control-buttons">
                  <Button 
                    active={systemState().currentEmotion === 'neutral'}
                    onClick={() => changeExpression('neutral')}
                  >
                    😐 普通
                  </Button>
                  <Button 
                    active={systemState().currentEmotion === 'happy'}
                    onClick={() => changeExpression('happy')}
                  >
                    😊 开心
                  </Button>
                  <Button 
                    active={systemState().currentEmotion === 'sad'}
                    onClick={() => changeExpression('sad')}
                  >
                    😢 难过
                  </Button>
                  <Button 
                    active={systemState().currentEmotion === 'surprised'}
                    onClick={() => changeExpression('surprised')}
                  >
                    😮 惊讶
                  </Button>
                </div>
              </div>
              
              {/* 动作控制 */}
              <div class="control-group">
                <h4>动作</h4>
                <div class="control-buttons">
                  <Button onClick={() => playMotion('Idle')}>🧘 待机</Button>
                  <Button onClick={() => playMotion('zuoshou')}>👈 左手挥</Button>
                  <Button onClick={() => playMotion('youshou')}>👉 右手挥</Button>
                  <Button onClick={() => playMotion('zuoshou_goodbye')}>👋 左手再见</Button>
                  <Button onClick={() => playMotion('youshou_goodbye')}>🙋 右手再见</Button>
                </div>
              </div>
              
              {/* 测试功能 */}
              <div class="control-group">
                <h4>测试</h4>
                <div class="control-buttons">
                  <Button onClick={testLipSync}>🎤 口型测试</Button>
                  <Button onClick={testTTS}>🔊 TTS 测试</Button>
                  <Button onClick={() => updateConfig({ showChat: !config().showChat })}>
                    💬 {config().showChat ? '隐藏' : '显示'}聊天
                  </Button>
                </div>
              </div>
              
              {/* 视觉效果 */}
              <div class="control-group">
                <h4>特效</h4>
                <div class="control-buttons">
                  <Button 
                    active={config().enableBackground}
                    onClick={() => updateConfig({ enableBackground: !config().enableBackground })}
                  >
                    🌈 动态背景 {config().enableBackground ? '开' : '关'}
                  </Button>
                  <Button 
                    active={config().enableParticles}
                    onClick={() => updateConfig({ enableParticles: !config().enableParticles })}
                  >
                    ✨ 粒子特效 {config().enableParticles ? '开' : '关'}
                  </Button>
                </div>
              </div>
            </div>
          </Show>
        </section>
      </Show>
      
      {/* 状态栏 */}
      <footer class="status-bar">
        <div class={`connection-indicator connection-indicator--${systemState().connectionStatus}`}>
          <span class="connection-indicator__dot"></span>
          <span>
            {systemState().connectionStatus === 'connected' ? 'OpenClaw 已连接' :
             systemState().connectionStatus === 'connecting' ? '连接中...' :
             avatarReady() ? 'Avatar 就绪 (离线模式)' : '加载中...'}
          </span>
        </div>
        
        <span class="status-message">{statusMessage()}</span>
        
        <div class="tech-badges">
          <span>SolidJS</span>
          <span>•</span>
          <span>Tauri 2.0</span>
          <span>•</span>
          <span>Live2D</span>
        </div>
      </footer>
      
      {/* 设置对话框 */}
      <SettingsDialog
        open={showSettings()}
        onOpenChange={setShowSettings}
        connectionStatus={systemState().connectionStatus}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onModelChange={handleModelChange}
      />
      
      {/* 开发者调试面板 */}
      <DevPanel
        systemState={systemState()}
        visible={showDevPanel()}
        position="top-right"
      />
    </main>
  );
}

export default App;
