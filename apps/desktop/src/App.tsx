import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import Avatar from "./components/Avatar";
import { avatarController, type Expression, type MotionGroup } from "./lib/AvatarController";
import "./App.css";

function App() {
  const [status, setStatus] = createSignal("初始化中...");
  const [connected, setConnected] = createSignal(false);
  const [avatarReady, setAvatarReady] = createSignal(false);
  const [currentExpression, setCurrentExpression] = createSignal<Expression>('neutral');

  // 测试 Tauri IPC
  async function testConnection() {
    try {
      const result = await invoke("greet", { name: "初音未来" });
      setStatus(result as string);
      setConnected(true);
    } catch (e) {
      setStatus(`连接错误: ${e}`);
      setConnected(false);
    }
  }

  // Avatar 加载完成
  function handleAvatarReady() {
    setAvatarReady(true);
    setStatus("Avatar 加载完成！");
  }

  // Avatar 加载失败
  function handleAvatarError(error: Error) {
    setStatus(`Avatar 错误: ${error.message}`);
  }

  // 切换表情
  function changeExpression(expr: Expression) {
    avatarController.setExpression(expr);
    setCurrentExpression(expr);
  }

  // 播放动作
  function playMotion(group: MotionGroup) {
    avatarController.playMotion(group);
  }

  return (
    <main class="container">
      <div class="avatar-header">
        <h1>🎵 初音未来</h1>
        <p class="subtitle">OpenClaw Avatar System</p>
      </div>

      {/* Live2D Avatar */}
      <div class="avatar-stage">
        <Avatar 
          modelPath="/live2d/shizuku/shizuku.model.json"
          width={600}
          height={500}
          onReady={handleAvatarReady}
          onError={handleAvatarError}
        />
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
        </div>
      )}

      <div class="status-panel">
        <div class={`status-indicator ${connected() ? "connected" : "disconnected"}`}>
          <span class="dot"></span>
          <span>{avatarReady() ? "Avatar 已就绪" : connected() ? "已连接" : "未连接"}</span>
        </div>
        <p class="status-message">{status()}</p>
      </div>

      <div class="controls">
        <button onClick={testConnection} class="btn-primary">
          测试 Tauri IPC
        </button>
      </div>

      <footer class="tech-stack">
        <span>SolidJS</span>
        <span>•</span>
        <span>Tauri 2.0</span>
        <span>•</span>
        <span>PixiJS 8</span>
        <span>•</span>
        <span>Live2D</span>
      </footer>
    </main>
  );
}

export default App;
