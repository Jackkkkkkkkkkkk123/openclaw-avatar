/**
 * GesturePanel - 手势识别控制面板
 */

import { Component, createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { gestureRecognitionService, GestureResult, GestureType } from '../lib/GestureRecognitionService';
import './GesturePanel.css';

interface GestureInfo {
  type: GestureType;
  emoji: string;
  name: string;
  description: string;
}

const GESTURE_INFO: GestureInfo[] = [
  { type: 'open_palm', emoji: '🖐️', name: '张开手掌', description: '打招呼' },
  { type: 'fist', emoji: '✊', name: '握拳', description: '停止' },
  { type: 'thumbs_up', emoji: '👍', name: '大拇指向上', description: '赞同' },
  { type: 'thumbs_down', emoji: '👎', name: '大拇指向下', description: '不赞同' },
  { type: 'peace', emoji: '✌️', name: '剪刀手', description: '胜利/和平' },
  { type: 'pointing', emoji: '👆', name: '指向', description: '指示方向' },
  { type: 'wave', emoji: '👋', name: '挥手', description: '打招呼/再见' },
  { type: 'ok', emoji: '👌', name: 'OK', description: '确认' },
  { type: 'rock', emoji: '🤘', name: '摇滚', description: '兴奋' },
];

export const GesturePanel: Component = () => {
  const [isEnabled, setIsEnabled] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [currentGesture, setCurrentGesture] = createSignal<GestureResult | null>(null);
  const [gestureHistory, setGestureHistory] = createSignal<GestureResult[]>([]);
  const [showVideo, setShowVideo] = createSignal(false);

  let videoRef: HTMLVideoElement | undefined;
  let unsubscribe: (() => void) | null = null;

  const handleGesture = (result: GestureResult) => {
    setCurrentGesture(result);
    setGestureHistory(prev => [result, ...prev].slice(0, 10));

    // 手势反馈动画
    triggerFeedback(result.gesture);
  };

  const triggerFeedback = (gesture: GestureType) => {
    // 发送事件供其他组件响应
    window.dispatchEvent(new CustomEvent('gesture-detected', { 
      detail: { gesture } 
    }));
  };

  const toggleGesture = async () => {
    if (isLoading()) return;

    if (isEnabled()) {
      gestureRecognitionService.stop();
      setIsEnabled(false);
      setCurrentGesture(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await gestureRecognitionService.start();
      if (success) {
        unsubscribe = gestureRecognitionService.onGesture(handleGesture);
        setIsEnabled(true);
      } else {
        setError('无法启动手势识别');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsLoading(false);
    }
  };

  const getGestureInfo = (type: GestureType): GestureInfo | undefined => {
    return GESTURE_INFO.find(g => g.type === type);
  };

  onMount(() => {
    // Check if service is already running
    if (gestureRecognitionService.isActive()) {
      setIsEnabled(true);
      unsubscribe = gestureRecognitionService.onGesture(handleGesture);
    }
  });

  onCleanup(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });

  return (
    <div class="gesture-panel">
      <div class="gesture-header">
        <h3>✋ 手势识别</h3>
        <button
          class={`toggle-btn ${isEnabled() ? 'active' : ''}`}
          onClick={toggleGesture}
          disabled={isLoading()}
        >
          {isLoading() ? '启动中...' : isEnabled() ? '🔴 停止' : '🟢 启动'}
        </button>
      </div>

      <Show when={error()}>
        <div class="error-message">
          ⚠️ {error()}
        </div>
      </Show>

      <Show when={isEnabled()}>
        <div class="gesture-status">
          <div class="current-gesture">
            <Show 
              when={currentGesture()} 
              fallback={
                <div class="waiting">
                  <span class="pulse">👋</span>
                  <p>等待手势...</p>
                </div>
              }
            >
              {(gesture) => {
                const info = getGestureInfo(gesture().gesture);
                return (
                  <div class="detected">
                    <span class="gesture-emoji">{info?.emoji || '❓'}</span>
                    <div class="gesture-info">
                      <p class="gesture-name">{info?.name || gesture().gesture}</p>
                      <p class="gesture-desc">{info?.description}</p>
                      <p class="gesture-meta">
                        {gesture().hand === 'left' ? '左手' : '右手'} · 
                        {Math.round(gesture().confidence * 100)}%
                      </p>
                    </div>
                  </div>
                );
              }}
            </Show>
          </div>

          <div class="video-toggle">
            <label>
              <input 
                type="checkbox" 
                checked={showVideo()} 
                onChange={(e) => setShowVideo(e.currentTarget.checked)}
              />
              显示摄像头画面
            </label>
          </div>

          <Show when={showVideo()}>
            <div class="video-preview">
              <video ref={videoRef} autoplay playsinline muted />
            </div>
          </Show>
        </div>

        <div class="gesture-history">
          <h4>识别历史</h4>
          <Show when={gestureHistory().length > 0} fallback={<p class="no-history">暂无记录</p>}>
            <ul>
              <For each={gestureHistory()}>
                {(result) => {
                  const info = getGestureInfo(result.gesture);
                  return (
                    <li>
                      <span class="history-emoji">{info?.emoji}</span>
                      <span class="history-name">{info?.name}</span>
                      <span class="history-time">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                    </li>
                  );
                }}
              </For>
            </ul>
          </Show>
        </div>
      </Show>

      <Show when={!isEnabled()}>
        <div class="gesture-guide">
          <h4>支持的手势</h4>
          <div class="gesture-list">
            <For each={GESTURE_INFO}>
              {(info) => (
                <div class="gesture-item">
                  <span class="item-emoji">{info.emoji}</span>
                  <span class="item-name">{info.name}</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default GesturePanel;
