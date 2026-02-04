/**
 * PerformancePanel - 表演编排面板
 * 
 * 功能：
 * - 选择和预览表演模板
 * - 播放控制（播放/暂停/停止）
 * - 进度条和时间显示
 * - 录制与表演同步
 * 
 * @version 1.0.0
 */

import { createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import { Button } from './ui';
import {
  getPerformanceDirector,
  type PerformanceScript,
  type PlaybackState
} from '../lib/PerformanceDirector';
import { avatarController } from '../lib/AvatarController';
import { avatarSystem } from '../lib/AvatarSystem';
import { sceneDirector } from '../lib/SceneDirectorSystem';
import { emotionParticleSystem } from '../lib/EmotionParticleSystem';
import { getAvatarCaptureSystem } from '../lib/AvatarCaptureSystem';
import './PerformancePanel.css';

// 类别图标映射
const CATEGORY_ICONS: Record<string, string> = {
  basic: '🎭',
  presentation: '📊',
  storytelling: '📖',
  emotional: '💝',
  reaction: '😲'
};

// 格式化时间
function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const remainingMs = Math.floor((ms % 1000) / 10);
  
  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${remainingMs.toString().padStart(2, '0')}`;
  }
  return `${remainingSeconds}.${remainingMs.toString().padStart(2, '0')}s`;
}

export function PerformancePanel() {
  const director = getPerformanceDirector();
  
  // 状态
  const [scripts, setScripts] = createSignal<PerformanceScript[]>([]);
  const [selectedScript, setSelectedScript] = createSignal<PerformanceScript | null>(null);
  const [playbackState, setPlaybackState] = createSignal<PlaybackState>(director.getState());
  const [selectedCategory, setSelectedCategory] = createSignal<string>('all');
  const [isCompact, setIsCompact] = createSignal(true);
  const [autoRecord, setAutoRecord] = createSignal(false);
  const [loop, setLoop] = createSignal(false);
  
  // 加载脚本列表
  onMount(() => {
    setScripts(director.getAllScripts());
    
    // 订阅播放状态
    const unsubState = director.onStateChange((state) => {
      setPlaybackState(state);
      
      // 自动录制结束时停止
      if (autoRecord() && state.state === 'stopped' && getAvatarCaptureSystem().getState().isRecording) {
        getAvatarCaptureSystem().stopRecording();
      }
    });
    
    // 订阅表情执行
    const unsubExpr = director.on('execute:expression', (data: any) => {
      avatarController.setExpression(data.expression, data.transition);
    });
    
    // 订阅动作执行
    const unsubMotion = director.on('execute:motion', (data: any) => {
      avatarController.playMotion(data.motionGroup, data.motionIndex);
    });
    
    // 订阅语音执行
    const unsubSpeak = director.on('execute:speak', (data: any) => {
      avatarSystem.speak(data.text);
    });
    
    // 订阅场景执行
    const unsubScene = director.on('execute:scene', (data: any) => {
      if (data.mode) {
        sceneDirector.setMode(data.mode, {
          transition: data.transition,
          transitionDuration: data.transitionDuration
        });
      }
      if (data.timeOfDay) {
        sceneDirector.setTimeOfDay(data.timeOfDay);
      }
      if (data.weather) {
        sceneDirector.setWeather(data.weather);
      }
    });
    
    // 订阅粒子执行
    const unsubParticle = director.on('execute:particle', (data: any) => {
      if (data.burst) {
        emotionParticleSystem.burst(data.particleType, data.count || 20);
      }
    });
    
    onCleanup(() => {
      unsubState();
      unsubExpr();
      unsubMotion();
      unsubSpeak();
      unsubScene();
      unsubParticle();
    });
  });
  
  // 获取分类列表
  const categories = () => {
    const cats = new Set<string>();
    scripts().forEach(s => {
      if (s.category) cats.add(s.category);
    });
    return ['all', ...Array.from(cats)];
  };
  
  // 过滤脚本
  const filteredScripts = () => {
    if (selectedCategory() === 'all') {
      return scripts();
    }
    return scripts().filter(s => s.category === selectedCategory());
  };
  
  // 选择脚本
  function handleSelectScript(script: PerformanceScript) {
    setSelectedScript(script);
    director.load(script.id);
  }
  
  // 播放/暂停
  function handlePlayPause() {
    const state = playbackState();
    
    if (state.state === 'playing') {
      director.pause();
    } else if (state.state === 'paused') {
      director.play();
    } else {
      // 开始播放
      if (autoRecord()) {
        getAvatarCaptureSystem().startRecording({ format: 'webm' });
      }
      director.play({ loop: loop() });
    }
  }
  
  // 停止
  function handleStop() {
    director.stop();
    if (autoRecord() && getAvatarCaptureSystem().getState().isRecording) {
      getAvatarCaptureSystem().stopRecording();
    }
  }
  
  // 进度条点击
  function handleProgressClick(e: MouseEvent) {
    const script = selectedScript();
    if (!script) return;
    
    const bar = e.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / rect.width;
    
    director.seek(progress * script.duration);
  }
  
  // 速度调整
  function handleSpeedChange(speed: number) {
    director.setSpeed(speed);
  }
  
  return (
    <div class="performance-panel" classList={{ compact: isCompact() }}>
      {/* 标题栏 */}
      <div class="panel-header">
        <div class="header-left">
          <span class="header-icon">🎬</span>
          <span class="header-title">表演编排</span>
        </div>
        <div class="header-right">
          <button 
            class="compact-toggle"
            onClick={() => setIsCompact(!isCompact())}
            title={isCompact() ? '展开' : '收起'}
          >
            {isCompact() ? '▼' : '▲'}
          </button>
        </div>
      </div>
      
      <Show when={!isCompact()}>
        {/* 分类选择 */}
        <div class="category-tabs">
          <For each={categories()}>
            {(cat) => (
              <button
                class="category-tab"
                classList={{ active: selectedCategory() === cat }}
                onClick={() => setSelectedCategory(cat)}
              >
                <span class="cat-icon">{CATEGORY_ICONS[cat] || '📁'}</span>
                <span class="cat-name">{cat === 'all' ? '全部' : cat}</span>
              </button>
            )}
          </For>
        </div>
        
        {/* 脚本列表 */}
        <div class="scripts-list">
          <For each={filteredScripts()}>
            {(script) => (
              <button
                class="script-card"
                classList={{ selected: selectedScript()?.id === script.id }}
                onClick={() => handleSelectScript(script)}
              >
                <div class="script-icon">
                  {CATEGORY_ICONS[script.category || 'basic'] || '🎭'}
                </div>
                <div class="script-info">
                  <div class="script-name">{script.name}</div>
                  <div class="script-duration">{formatTime(script.duration)}</div>
                </div>
                <Show when={script.description}>
                  <div class="script-desc">{script.description}</div>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>
      
      {/* 播放控制 */}
      <Show when={selectedScript()}>
        <div class="playback-controls">
          {/* 当前脚本信息 */}
          <div class="current-script">
            <span class="current-icon">
              {CATEGORY_ICONS[selectedScript()!.category || 'basic']}
            </span>
            <span class="current-name">{selectedScript()!.name}</span>
          </div>
          
          {/* 进度条 */}
          <div class="progress-container" onClick={handleProgressClick}>
            <div class="progress-bar">
              <div 
                class="progress-fill"
                style={{ width: `${playbackState().progress * 100}%` }}
              />
              <div 
                class="progress-cursor"
                style={{ left: `${playbackState().progress * 100}%` }}
              />
            </div>
            <div class="time-display">
              <span class="time-current">{formatTime(playbackState().currentTime)}</span>
              <span class="time-separator">/</span>
              <span class="time-total">{formatTime(playbackState().duration)}</span>
            </div>
          </div>
          
          {/* 控制按钮 */}
          <div class="control-buttons">
            <button
              class="control-btn stop"
              onClick={handleStop}
              disabled={playbackState().state === 'idle' || playbackState().state === 'stopped'}
              title="停止"
            >
              ⏹
            </button>
            
            <button
              class="control-btn play-pause"
              onClick={handlePlayPause}
              classList={{ playing: playbackState().state === 'playing' }}
              title={playbackState().state === 'playing' ? '暂停' : '播放'}
            >
              {playbackState().state === 'playing' ? '⏸' : '▶'}
            </button>
            
            <button
              class="control-btn loop"
              classList={{ active: loop() }}
              onClick={() => setLoop(!loop())}
              title="循环播放"
            >
              🔁
            </button>
            
            <button
              class="control-btn record"
              classList={{ active: autoRecord() }}
              onClick={() => setAutoRecord(!autoRecord())}
              title="自动录制"
            >
              🔴
            </button>
          </div>
          
          {/* 速度控制 */}
          <div class="speed-controls">
            <span class="speed-label">速度:</span>
            <For each={[0.5, 1, 1.5, 2]}>
              {(speed) => (
                <button
                  class="speed-btn"
                  classList={{ active: playbackState().speed === speed }}
                  onClick={() => handleSpeedChange(speed)}
                >
                  {speed}x
                </button>
              )}
            </For>
          </div>
          
          {/* 状态指示 */}
          <div class="status-indicator">
            <div 
              class="status-dot"
              classList={{
                idle: playbackState().state === 'idle' || playbackState().state === 'stopped',
                playing: playbackState().state === 'playing',
                paused: playbackState().state === 'paused'
              }}
            />
            <span class="status-text">
              {playbackState().state === 'playing' && '播放中'}
              {playbackState().state === 'paused' && '已暂停'}
              {(playbackState().state === 'idle' || playbackState().state === 'stopped') && '就绪'}
            </span>
            <Show when={playbackState().loop && playbackState().loopCount > 0}>
              <span class="loop-count">循环 #{playbackState().loopCount}</span>
            </Show>
          </div>
        </div>
      </Show>
      
      {/* 空状态 */}
      <Show when={!selectedScript() && isCompact()}>
        <div class="empty-hint">
          点击展开选择表演模板
        </div>
      </Show>
    </div>
  );
}

export default PerformancePanel;
