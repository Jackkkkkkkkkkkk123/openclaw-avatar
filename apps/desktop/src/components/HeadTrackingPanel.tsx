/**
 * HeadTrackingPanel - 头部追踪控制面板
 * 
 * 显示追踪状态、预览和控制选项
 */

import { Component, createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { Button, Switch } from './ui';
import { headTrackingService, type TrackingData } from '../lib/HeadTrackingService';
import './HeadTrackingPanel.css';

interface HeadTrackingPanelProps {
  onClose?: () => void;
}

export const HeadTrackingPanel: Component<HeadTrackingPanelProps> = (props) => {
  const [isTracking, setIsTracking] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [trackingData, setTrackingData] = createSignal<TrackingData | null>(null);
  
  // 设置
  const [mirrorMode, setMirrorMode] = createSignal(true);
  const [smoothing, setSmoothing] = createSignal(0.3);
  
  let unsubscribe: (() => void) | null = null;
  
  // 启动追踪
  const startTracking = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await headTrackingService.init();
      
      // 订阅数据
      unsubscribe = headTrackingService.onTracking((data) => {
        setTrackingData(data);
      });
      
      await headTrackingService.start();
      setIsTracking(true);
    } catch (err: any) {
      setError(err.message || '启动失败');
      console.error('[HeadTrackingPanel] 启动失败:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 停止追踪
  const stopTracking = () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    headTrackingService.stop();
    setIsTracking(false);
    setTrackingData(null);
  };
  
  // 切换追踪
  const toggleTracking = () => {
    if (isTracking()) {
      stopTracking();
    } else {
      startTracking();
    }
  };
  
  // 设置镜像模式
  createEffect(() => {
    headTrackingService.setMirrorMode(mirrorMode());
  });
  
  // 设置平滑系数
  createEffect(() => {
    headTrackingService.setSmoothingFactor(smoothing());
  });
  
  // 清理
  onCleanup(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
  
  // 格式化数值
  const formatValue = (value: number, precision = 2) => {
    return value.toFixed(precision);
  };
  
  // 获取情绪 emoji
  const getEmotionEmoji = (emotion: string | null) => {
    switch (emotion) {
      case 'happy': return '😊';
      case 'sad': return '😢';
      case 'surprised': return '😮';
      case 'angry': return '😠';
      default: return '😐';
    }
  };
  
  return (
    <div class="head-tracking-panel">
      <div class="panel-header">
        <h3>📷 头部追踪</h3>
        <Show when={props.onClose}>
          <button class="close-btn" onClick={props.onClose}>×</button>
        </Show>
      </div>
      
      {/* 状态指示 */}
      <div class="tracking-status" classList={{ active: isTracking() }}>
        <div class="status-indicator" />
        <span>{isTracking() ? '追踪中' : '未启动'}</span>
      </div>
      
      {/* 错误提示 */}
      <Show when={error()}>
        <div class="tracking-error">
          ⚠️ {error()}
        </div>
      </Show>
      
      {/* 启动按钮 */}
      <Button
        onClick={toggleTracking}
        disabled={isLoading()}
        class="tracking-toggle-btn"
      >
        {isLoading() ? '初始化中...' : isTracking() ? '停止追踪' : '启动追踪'}
      </Button>
      
      {/* 追踪数据显示 */}
      <Show when={trackingData()}>
        {(data) => (
          <div class="tracking-data">
            {/* 头部位置 */}
            <div class="data-section">
              <h4>头部位置</h4>
              <div class="data-grid">
                <div class="data-item">
                  <span class="label">X (左右)</span>
                  <span class="value">{formatValue(data().pose.x)}</span>
                  <div class="bar-container">
                    <div 
                      class="bar" 
                      style={{ 
                        width: `${Math.abs(data().pose.x) * 50}%`,
                        'margin-left': data().pose.x < 0 ? 'auto' : '50%',
                        'margin-right': data().pose.x >= 0 ? 'auto' : '50%',
                      }} 
                    />
                  </div>
                </div>
                <div class="data-item">
                  <span class="label">Y (上下)</span>
                  <span class="value">{formatValue(data().pose.y)}</span>
                  <div class="bar-container">
                    <div 
                      class="bar" 
                      style={{ width: `${Math.abs(data().pose.y) * 50}%` }} 
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* 表情 */}
            <div class="data-section">
              <h4>表情</h4>
              <div class="expression-display">
                <span class="emotion-emoji">
                  {getEmotionEmoji(data().expression.detectedEmotion)}
                </span>
                <span class="emotion-label">
                  {data().expression.detectedEmotion || 'neutral'}
                </span>
              </div>
              <div class="data-grid">
                <div class="data-item small">
                  <span class="label">左眼</span>
                  <span class="value">{formatValue(data().expression.leftEyeOpen, 1)}</span>
                </div>
                <div class="data-item small">
                  <span class="label">右眼</span>
                  <span class="value">{formatValue(data().expression.rightEyeOpen, 1)}</span>
                </div>
                <div class="data-item small">
                  <span class="label">嘴巴</span>
                  <span class="value">{formatValue(data().expression.mouthOpen, 1)}</span>
                </div>
                <div class="data-item small">
                  <span class="label">微笑</span>
                  <span class="value">{formatValue(data().expression.mouthSmile, 1)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Show>
      
      {/* 设置 */}
      <div class="tracking-settings">
        <h4>设置</h4>
        
        <div class="setting-item">
          <span>镜像模式</span>
          <Switch
            checked={mirrorMode()}
            onChange={setMirrorMode}
          />
        </div>
        
        <div class="setting-item">
          <span>平滑度: {(smoothing() * 100).toFixed(0)}%</span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={smoothing()}
            onInput={(e) => setSmoothing(parseFloat(e.currentTarget.value))}
          />
        </div>
      </div>
      
      {/* 快捷键提示 */}
      <div class="tracking-tip">
        💡 快捷键: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd> 开关追踪
      </div>
    </div>
  );
};

export default HeadTrackingPanel;
