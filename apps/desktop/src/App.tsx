import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [status, setStatus] = createSignal("初始化中...");
  const [connected, setConnected] = createSignal(false);

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

  return (
    <main class="container">
      <div class="avatar-header">
        <h1>🎵 初音未来</h1>
        <p class="subtitle">OpenClaw Avatar System</p>
      </div>

      <div class="avatar-placeholder">
        <div class="avatar-circle">
          <span class="avatar-emoji">👤</span>
        </div>
        <p class="avatar-note">Live2D 模型将在这里显示</p>
      </div>

      <div class="status-panel">
        <div class={`status-indicator ${connected() ? "connected" : "disconnected"}`}>
          <span class="dot"></span>
          <span>{connected() ? "已连接" : "未连接"}</span>
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
        <span>Vite 6</span>
        <span>•</span>
        <span>TypeScript 5.8</span>
      </footer>
    </main>
  );
}

export default App;
