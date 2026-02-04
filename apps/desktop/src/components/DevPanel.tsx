/**
 * Dev Panel - 开发者调试面板
 * 
 * 显示性能指标、系统状态、调试信息
 * 
 * v1.0 - SOTA 工程质量优化
 */

import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { performanceMonitor, type PerformanceMetrics } from '../lib/PerformanceMonitor';
import { avatarController } from '../lib/AvatarController';
import type { SystemState } from '../lib/AvatarSystem';
import './DevPanel.css';

export interface DevPanelProps {
  systemState: SystemState;
  visible?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  onToggle?: () => void;
}

export function DevPanel(props: DevPanelProps) {
  const [metrics, setMetrics] = createSignal<PerformanceMetrics | null>(null);
  const [expanded, setExpanded] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'performance' | 'avatar' | 'system'>('performance');
  
  // 生命动画状态
  const [lifeConfig, setLifeConfig] = createSignal(avatarController.getLifeConfig());
  
  onMount(() => {
    // 订阅性能指标
    const unsubscribe = performanceMonitor.onMetrics((m) => {
      setMetrics(m);
    });
    
    // 定期更新生命动画配置（检测外部变化）
    const interval = setInterval(() => {
      setLifeConfig(avatarController.getLifeConfig());
    }, 1000);
    
    onCleanup(() => {
      unsubscribe();
      clearInterval(interval);
    });
  });
  
  // FPS 颜色
  const getFpsColor = () => {
    const fps = metrics()?.fps ?? 0;
    if (fps >= 55) return 'var(--dev-color-success)';
    if (fps >= 45) return 'var(--dev-color-warning)';
    return 'var(--dev-color-error)';
  };
  
  // 性能评级
  const getRating = () => {
    const fps = metrics()?.fps ?? 0;
    if (fps >= 55) return '🟢 Excellent';
    if (fps >= 45) return '🟡 Good';
    if (fps >= 30) return '🟠 Fair';
    return '🔴 Poor';
  };
  
  // 连接状态图标
  const getConnectionIcon = () => {
    switch (props.systemState.connectionStatus) {
      case 'connected': return '🟢';
      case 'connecting': return '🟡';
      default: return '🔴';
    }
  };
  
  // 表情 emoji
  const getEmotionEmoji = () => {
    const emotionMap: Record<string, string> = {
      neutral: '😐', happy: '😊', sad: '😢', surprised: '😮',
      angry: '😠', fear: '😨', disgusted: '🤢', excited: '🤩',
      proud: '😤', loving: '🥰', grateful: '🙏', hopeful: '🌟',
      amused: '😆', relieved: '😌', anxious: '😰', embarrassed: '😳',
      confused: '😕', bored: '😑', disappointed: '😔', lonely: '🥺',
      thinking: '🤔', curious: '🧐', determined: '💪', playful: '😜',
    };
    return emotionMap[props.systemState.currentEmotion] ?? '❓';
  };
  
  // 切换生命动画
  const toggleLifeAnimation = (type: 'blink' | 'breath' | 'idle') => {
    const config = lifeConfig();
    switch (type) {
      case 'blink':
        avatarController.setBlinkEnabled(!config.blink.enabled);
        break;
      case 'breath':
        avatarController.setBreathEnabled(!config.breath.enabled);
        break;
      case 'idle':
        avatarController.setIdleSwayEnabled(!config.idle.enabled);
        break;
    }
    setLifeConfig(avatarController.getLifeConfig());
  };
  
  // 手动眨眼
  const triggerBlink = () => {
    avatarController.triggerBlink();
  };
  
  const position = props.position ?? 'top-right';
  
  return (
    <Show when={props.visible !== false}>
      <div class={`dev-panel dev-panel--${position} ${expanded() ? 'dev-panel--expanded' : ''}`}>
        {/* 折叠按钮 */}
        <button 
          class="dev-panel__toggle"
          onClick={() => setExpanded(!expanded())}
          title="开发者面板"
        >
          🛠️ {expanded() ? '◀' : '▶'}
        </button>
        
        <Show when={expanded()}>
          <div class="dev-panel__content">
            {/* 标签页 */}
            <div class="dev-panel__tabs">
              <button 
                class={`dev-panel__tab ${activeTab() === 'performance' ? 'active' : ''}`}
                onClick={() => setActiveTab('performance')}
              >
                📊 性能
              </button>
              <button 
                class={`dev-panel__tab ${activeTab() === 'avatar' ? 'active' : ''}`}
                onClick={() => setActiveTab('avatar')}
              >
                🎭 Avatar
              </button>
              <button 
                class={`dev-panel__tab ${activeTab() === 'system' ? 'active' : ''}`}
                onClick={() => setActiveTab('system')}
              >
                ⚙️ 系统
              </button>
            </div>
            
            {/* 性能面板 */}
            <Show when={activeTab() === 'performance'}>
              <div class="dev-panel__section">
                <h4>性能指标</h4>
                
                <div class="dev-panel__metrics">
                  <div class="dev-panel__metric">
                    <span class="metric-label">FPS</span>
                    <span class="metric-value" style={{ color: getFpsColor() }}>
                      {metrics()?.fps ?? '-'}
                    </span>
                  </div>
                  
                  <div class="dev-panel__metric">
                    <span class="metric-label">帧时间</span>
                    <span class="metric-value">
                      {metrics()?.frameTime?.toFixed(1) ?? '-'} ms
                    </span>
                  </div>
                  
                  <div class="dev-panel__metric">
                    <span class="metric-label">内存</span>
                    <span class="metric-value">
                      {metrics()?.memoryUsed ?? '-'} MB
                    </span>
                  </div>
                  
                  <div class="dev-panel__metric">
                    <span class="metric-label">Draw Calls</span>
                    <span class="metric-value">
                      ~{metrics()?.drawCalls ?? '-'}
                    </span>
                  </div>
                </div>
                
                <div class="dev-panel__rating">
                  <span>评级: {getRating()}</span>
                </div>
                
                <div class="dev-panel__uptime">
                  运行时间: {performanceMonitor.getUptimeFormatted()}
                </div>
              </div>
            </Show>
            
            {/* Avatar 面板 */}
            <Show when={activeTab() === 'avatar'}>
              <div class="dev-panel__section">
                <h4>Avatar 状态</h4>
                
                <div class="dev-panel__info">
                  <div class="info-row">
                    <span>当前表情</span>
                    <span>{getEmotionEmoji()} {props.systemState.currentEmotion}</span>
                  </div>
                  <div class="info-row">
                    <span>说话中</span>
                    <span>{props.systemState.isSpeaking ? '🎤 是' : '🔇 否'}</span>
                  </div>
                  <div class="info-row">
                    <span>Cubism 版本</span>
                    <span>v{avatarController.getCubismVersion()}</span>
                  </div>
                </div>
                
                <h4>生命动画</h4>
                
                <div class="dev-panel__toggles">
                  <label class="toggle-row">
                    <input 
                      type="checkbox" 
                      checked={lifeConfig().blink.enabled}
                      onChange={() => toggleLifeAnimation('blink')}
                    />
                    <span>眨眼 ({lifeConfig().blink.minInterval/1000}~{lifeConfig().blink.maxInterval/1000}s)</span>
                  </label>
                  
                  <label class="toggle-row">
                    <input 
                      type="checkbox" 
                      checked={lifeConfig().breath.enabled}
                      onChange={() => toggleLifeAnimation('breath')}
                    />
                    <span>呼吸 ({(lifeConfig().breath.cycle/1000).toFixed(1)}s 周期)</span>
                  </label>
                  
                  <label class="toggle-row">
                    <input 
                      type="checkbox" 
                      checked={lifeConfig().idle.enabled}
                      onChange={() => toggleLifeAnimation('idle')}
                    />
                    <span>待机摇摆 ({(lifeConfig().idle.swayCycle/1000).toFixed(1)}s 周期)</span>
                  </label>
                </div>
                
                <button class="dev-panel__btn" onClick={triggerBlink}>
                  👁️ 手动眨眼
                </button>
              </div>
            </Show>
            
            {/* 系统面板 */}
            <Show when={activeTab() === 'system'}>
              <div class="dev-panel__section">
                <h4>连接状态</h4>
                
                <div class="dev-panel__info">
                  <div class="info-row">
                    <span>OpenClaw</span>
                    <span>{getConnectionIcon()} {props.systemState.connectionStatus}</span>
                  </div>
                </div>
                
                <h4>可用表情 ({avatarController.getAvailableExpressions().length})</h4>
                <div class="dev-panel__list">
                  <For each={avatarController.getAvailableExpressions()}>
                    {(expr) => <span class="dev-panel__tag">{expr}</span>}
                  </For>
                </div>
                
                <h4>可用动作 ({avatarController.getAvailableMotions().length})</h4>
                <div class="dev-panel__list">
                  <For each={avatarController.getAvailableMotions()}>
                    {(motion) => <span class="dev-panel__tag">{motion}</span>}
                  </For>
                </div>
                
                <h4>支持表情 ({avatarController.getSupportedExpressions().length})</h4>
                <div class="dev-panel__mini-text">
                  {avatarController.getSupportedExpressions().join(', ')}
                </div>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );
}
