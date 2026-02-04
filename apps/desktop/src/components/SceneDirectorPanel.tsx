/**
 * SceneDirectorPanel - 场景导演控制面板
 * 
 * SOTA Round 40 - 用户可直接操作的场景切换界面
 * 
 * 功能:
 * - 场景预设选择（卡片式）
 * - 时间氛围调节
 * - 天气效果选择
 * - 自动场景检测开关
 * - 实时状态预览
 */

import { createSignal, createEffect, For, Show, onCleanup } from 'solid-js';
import { 
  sceneDirector, 
  type SceneMode, 
  type TimeOfDay, 
  type WeatherEffect,
  type SceneState,
  type SceneChangeEvent 
} from '../lib/SceneDirectorSystem';
import './SceneDirectorPanel.css';

// 场景图标和颜色映射
const SCENE_META: Record<SceneMode, { icon: string; color: string; gradient: string }> = {
  casual_chat: { icon: '💬', color: '#39c5bb', gradient: 'linear-gradient(135deg, #39c5bb 0%, #2a9d8f 100%)' },
  work_meeting: { icon: '💼', color: '#4a90a4', gradient: 'linear-gradient(135deg, #4a90a4 0%, #357a8c 100%)' },
  storytelling: { icon: '📖', color: '#9b59b6', gradient: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)' },
  emotional_support: { icon: '🤗', color: '#e17055', gradient: 'linear-gradient(135deg, #e17055 0%, #d63031 100%)' },
  celebration: { icon: '🎉', color: '#f39c12', gradient: 'linear-gradient(135deg, #f39c12 0%, #e74c3c 100%)' },
  meditation: { icon: '🧘', color: '#00b894', gradient: 'linear-gradient(135deg, #00b894 0%, #00a381 100%)' },
  gaming: { icon: '🎮', color: '#6c5ce7', gradient: 'linear-gradient(135deg, #6c5ce7 0%, #5b4cdb 100%)' },
  learning: { icon: '📚', color: '#0984e3', gradient: 'linear-gradient(135deg, #0984e3 0%, #0873c9 100%)' },
  romantic: { icon: '💕', color: '#fd79a8', gradient: 'linear-gradient(135deg, #fd79a8 0%, #e84393 100%)' },
  horror: { icon: '👻', color: '#636e72', gradient: 'linear-gradient(135deg, #636e72 0%, #2d3436 100%)' },
  custom: { icon: '⚙️', color: '#b2bec3', gradient: 'linear-gradient(135deg, #b2bec3 0%, #95a5a6 100%)' },
};

const TIME_OPTIONS: { value: TimeOfDay; label: string; icon: string }[] = [
  { value: 'dawn', label: '黎明', icon: '🌅' },
  { value: 'morning', label: '早晨', icon: '☀️' },
  { value: 'afternoon', label: '下午', icon: '🌤️' },
  { value: 'evening', label: '傍晚', icon: '🌇' },
  { value: 'night', label: '夜晚', icon: '🌙' },
  { value: 'midnight', label: '深夜', icon: '🌃' },
];

const WEATHER_OPTIONS: { value: WeatherEffect; label: string; icon: string }[] = [
  { value: 'none', label: '无', icon: '✨' },
  { value: 'sunny', label: '晴朗', icon: '☀️' },
  { value: 'cloudy', label: '多云', icon: '☁️' },
  { value: 'rainy', label: '下雨', icon: '🌧️' },
  { value: 'snowy', label: '下雪', icon: '❄️' },
  { value: 'stormy', label: '暴风', icon: '⛈️' },
  { value: 'foggy', label: '迷雾', icon: '🌫️' },
];

export function SceneDirectorPanel() {
  const [state, setState] = createSignal<SceneState>(sceneDirector.getState());
  const [lastChange, setLastChange] = createSignal<SceneChangeEvent | null>(null);
  const [isExpanded, setIsExpanded] = createSignal(true);
  const [showHistory, setShowHistory] = createSignal(false);
  const [changeHistory, setChangeHistory] = createSignal<SceneChangeEvent[]>([]);

  // 订阅状态变化
  createEffect(() => {
    const unsubState = sceneDirector.onStateChange((newState) => {
      setState(newState);
    });

    const unsubChange = sceneDirector.onSceneChange((event) => {
      setLastChange(event);
      setChangeHistory(prev => [...prev.slice(-9), event]);
    });

    // 启动自动时间检测
    sceneDirector.startAutoTimeDetection();

    onCleanup(() => {
      unsubState();
      unsubChange();
      sceneDirector.stopAutoTimeDetection();
    });
  });

  const handleSceneSelect = (mode: SceneMode) => {
    sceneDirector.setScene(mode);
  };

  const handleTimeChange = (time: TimeOfDay) => {
    sceneDirector.setTimeOfDay(time);
  };

  const handleWeatherChange = (weather: WeatherEffect) => {
    sceneDirector.setWeather(weather);
  };

  const toggleAutoMode = () => {
    sceneDirector.setAutoMode(!state().autoModeEnabled);
  };

  const presets = sceneDirector.getAvailableScenes();

  return (
    <div class="scene-director-panel" classList={{ expanded: isExpanded() }}>
      {/* 面板头部 */}
      <div class="panel-header" onClick={() => setIsExpanded(!isExpanded())}>
        <div class="header-left">
          <span class="panel-icon">🎬</span>
          <span class="panel-title">场景导演</span>
        </div>
        <div class="header-right">
          <Show when={state().isTransitioning}>
            <span class="transition-badge">切换中...</span>
          </Show>
          <span class="current-scene">
            {SCENE_META[state().currentMode].icon} {presets.find(p => p.mode === state().currentMode)?.name}
          </span>
          <span class="expand-icon">{isExpanded() ? '▼' : '▶'}</span>
        </div>
      </div>

      <Show when={isExpanded()}>
        <div class="panel-content">
          {/* 自动模式开关 */}
          <div class="auto-mode-section">
            <label class="auto-mode-toggle">
              <input 
                type="checkbox" 
                checked={state().autoModeEnabled} 
                onChange={toggleAutoMode}
              />
              <span class="toggle-slider"></span>
              <span class="toggle-label">
                自动场景检测
                <span class="toggle-hint">根据对话内容自动切换场景</span>
              </span>
            </label>
          </div>

          {/* 场景预设网格 */}
          <div class="scenes-section">
            <h4 class="section-title">场景预设</h4>
            <div class="scenes-grid">
              <For each={presets.filter(p => p.mode !== 'custom')}>
                {(preset) => {
                  const meta = SCENE_META[preset.mode];
                  const isActive = () => state().currentMode === preset.mode;
                  
                  return (
                    <button 
                      class="scene-card"
                      classList={{ active: isActive() }}
                      style={{ '--scene-color': meta.color, '--scene-gradient': meta.gradient }}
                      onClick={() => handleSceneSelect(preset.mode)}
                      title={preset.description}
                    >
                      <span class="scene-icon">{meta.icon}</span>
                      <span class="scene-name">{preset.name}</span>
                      <Show when={isActive()}>
                        <span class="active-indicator">✓</span>
                      </Show>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>

          {/* 环境设置 */}
          <div class="environment-section">
            <h4 class="section-title">环境氛围</h4>
            
            {/* 时间选择 */}
            <div class="env-row">
              <span class="env-label">时间:</span>
              <div class="env-options">
                <For each={TIME_OPTIONS}>
                  {(option) => (
                    <button
                      class="env-btn"
                      classList={{ active: state().timeOfDay === option.value }}
                      onClick={() => handleTimeChange(option.value)}
                      title={option.label}
                    >
                      <span class="env-icon">{option.icon}</span>
                    </button>
                  )}
                </For>
              </div>
            </div>

            {/* 天气选择 */}
            <div class="env-row">
              <span class="env-label">天气:</span>
              <div class="env-options">
                <For each={WEATHER_OPTIONS}>
                  {(option) => (
                    <button
                      class="env-btn"
                      classList={{ active: state().weather === option.value }}
                      onClick={() => handleWeatherChange(option.value)}
                      title={option.label}
                    >
                      <span class="env-icon">{option.icon}</span>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </div>

          {/* 当前状态预览 */}
          <div class="status-section">
            <h4 class="section-title" onClick={() => setShowHistory(!showHistory())}>
              状态预览
              <span class="toggle-history">{showHistory() ? '隐藏历史' : '显示历史'}</span>
            </h4>
            
            <div class="status-grid">
              <div class="status-item">
                <span class="status-label">背景强度</span>
                <div class="status-bar">
                  <div 
                    class="status-fill" 
                    style={{ width: `${state().elements.background.intensity * 100}%` }}
                  />
                </div>
                <span class="status-value">{(state().elements.background.intensity * 100).toFixed(0)}%</span>
              </div>
              
              <div class="status-item">
                <span class="status-label">粒子密度</span>
                <div class="status-bar">
                  <div 
                    class="status-fill" 
                    style={{ width: `${Math.min(state().elements.particles.intensity * 50, 100)}%` }}
                  />
                </div>
                <span class="status-value">{(state().elements.particles.intensity * 100).toFixed(0)}%</span>
              </div>
              
              <div class="status-item">
                <span class="status-label">表情强度</span>
                <div class="status-bar">
                  <div 
                    class="status-fill" 
                    style={{ width: `${Math.min(state().elements.expression.intensity * 50, 100)}%` }}
                  />
                </div>
                <span class="status-value">{(state().elements.expression.intensity * 100).toFixed(0)}%</span>
              </div>
              
              <div class="status-item">
                <span class="status-label">亮度</span>
                <div class="status-bar">
                  <div 
                    class="status-fill" 
                    style={{ width: `${Math.min(state().elements.lighting.brightness * 50, 100)}%` }}
                  />
                </div>
                <span class="status-value">{(state().elements.lighting.brightness * 100).toFixed(0)}%</span>
              </div>
            </div>

            {/* 过渡进度条 */}
            <Show when={state().isTransitioning}>
              <div class="transition-progress">
                <div 
                  class="transition-bar"
                  style={{ width: `${state().transitionProgress * 100}%` }}
                />
              </div>
            </Show>
          </div>

          {/* 变化历史 */}
          <Show when={showHistory() && changeHistory().length > 0}>
            <div class="history-section">
              <h4 class="section-title">场景切换历史</h4>
              <div class="history-list">
                <For each={changeHistory().slice().reverse()}>
                  {(event) => {
                    const fromMeta = SCENE_META[event.from];
                    const toMeta = SCENE_META[event.to];
                    const time = new Date(event.timestamp).toLocaleTimeString();
                    
                    return (
                      <div class="history-item">
                        <span class="history-time">{time}</span>
                        <span class="history-flow">
                          <span style={{ color: fromMeta.color }}>{fromMeta.icon}</span>
                          <span class="history-arrow">→</span>
                          <span style={{ color: toMeta.color }}>{toMeta.icon}</span>
                        </span>
                        <span class="history-reason">
                          {event.reason === 'manual' ? '手动' : 
                           event.reason === 'auto_emotion' ? '情绪' :
                           event.reason === 'auto_keyword' ? '关键词' : '自动'}
                        </span>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export default SceneDirectorPanel;
