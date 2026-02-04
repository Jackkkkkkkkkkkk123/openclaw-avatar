/**
 * Avatar 截图 & 录制面板
 * 
 * SOTA Round 44: 用户可感知的核心功能
 * - 一键截图
 * - 视频录制
 * - 录制状态显示
 * - 格式选择
 */

import { createSignal, createEffect, onCleanup, Show, For } from 'solid-js';
import { 
  AvatarCaptureSystem, 
  getAvatarCaptureSystem,
  type RecordingState,
  type CaptureConfig,
} from '../lib/AvatarCaptureSystem';
import './CapturePanel.css';

interface CapturePanelProps {
  /** 是否显示面板 */
  visible?: boolean;
  /** 紧凑模式 */
  compact?: boolean;
  /** 截图系统实例 (可选，默认使用全局实例) */
  captureSystem?: AvatarCaptureSystem;
}

export function CapturePanel(props: CapturePanelProps) {
  const [recordingState, setRecordingState] = createSignal<RecordingState>({
    isRecording: false,
    duration: 0,
    frameCount: 0,
    startTime: null,
    isPaused: false,
    estimatedSize: 0,
  });
  
  const [imageFormat, setImageFormat] = createSignal<'png' | 'jpeg' | 'webp'>('png');
  const [videoFormat, setVideoFormat] = createSignal<'webm' | 'mp4'>('webm');
  const [showSettings, setShowSettings] = createSignal(false);
  const [lastAction, setLastAction] = createSignal<string>('');
  const [isCapturing, setIsCapturing] = createSignal(false);
  
  const captureSystem = () => props.captureSystem || getAvatarCaptureSystem();

  // 订阅录制状态
  createEffect(() => {
    const unsubscribe = captureSystem().onRecordingStateChange((state) => {
      setRecordingState(state);
    });
    
    onCleanup(unsubscribe);
  });

  // 格式化时长
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 格式化文件大小
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 截图
  const handleCapture = async () => {
    setIsCapturing(true);
    try {
      await captureSystem().captureAndDownload({ imageFormat: imageFormat() });
      setLastAction('📸 截图已保存');
      setTimeout(() => setLastAction(''), 3000);
    } catch (error) {
      console.error('Screenshot failed:', error);
      setLastAction('❌ 截图失败');
    } finally {
      setIsCapturing(false);
    }
  };

  // 复制到剪贴板
  const handleCopyToClipboard = async () => {
    setIsCapturing(true);
    try {
      const success = await captureSystem().captureAndCopy();
      setLastAction(success ? '📋 已复制到剪贴板' : '❌ 复制失败');
      setTimeout(() => setLastAction(''), 3000);
    } catch (error) {
      console.error('Copy failed:', error);
      setLastAction('❌ 复制失败');
    } finally {
      setIsCapturing(false);
    }
  };

  // 开始/停止录制
  const handleToggleRecording = async () => {
    const state = recordingState();
    
    if (state.isRecording) {
      try {
        await captureSystem().stopRecordingAndDownload();
        setLastAction('🎬 录制已保存');
        setTimeout(() => setLastAction(''), 3000);
      } catch (error) {
        console.error('Stop recording failed:', error);
        setLastAction('❌ 保存失败');
      }
    } else {
      try {
        captureSystem().startRecording({ videoFormat: videoFormat() });
        setLastAction('🔴 录制中...');
      } catch (error) {
        console.error('Start recording failed:', error);
        setLastAction('❌ 录制启动失败');
      }
    }
  };

  // 暂停/恢复
  const handlePauseResume = () => {
    captureSystem().pauseRecording();
    const state = recordingState();
    setLastAction(state.isPaused ? '⏸️ 已暂停' : '🔴 录制中...');
  };

  // 取消录制
  const handleCancelRecording = () => {
    captureSystem().cancelRecording();
    setLastAction('🚫 录制已取消');
    setTimeout(() => setLastAction(''), 3000);
  };

  if (props.visible === false) {
    return null;
  }

  const state = recordingState();
  const isRecording = state.isRecording;

  return (
    <div class={`capture-panel ${props.compact ? 'compact' : ''}`}>
      <div class="capture-panel-header">
        <span class="capture-panel-title">📷 截图 & 录制</span>
        <button 
          class="capture-settings-toggle"
          onClick={() => setShowSettings(!showSettings())}
          title="设置"
        >
          ⚙️
        </button>
      </div>

      {/* 主要操作按钮 */}
      <div class="capture-actions">
        {/* 截图按钮 */}
        <div class="capture-action-group">
          <button
            class="capture-btn screenshot-btn"
            onClick={handleCapture}
            disabled={isCapturing() || isRecording}
            title="截图 (Ctrl+Shift+S)"
          >
            <span class="capture-btn-icon">📸</span>
            <span class="capture-btn-text">截图</span>
          </button>
          
          <button
            class="capture-btn copy-btn"
            onClick={handleCopyToClipboard}
            disabled={isCapturing() || isRecording}
            title="复制到剪贴板"
          >
            <span class="capture-btn-icon">📋</span>
          </button>
        </div>

        {/* 录制按钮 */}
        <div class="capture-action-group">
          <button
            class={`capture-btn record-btn ${isRecording ? 'recording' : ''}`}
            onClick={handleToggleRecording}
            disabled={isCapturing()}
            title={isRecording ? '停止录制' : '开始录制 (Ctrl+Shift+R)'}
          >
            <span class="capture-btn-icon">
              {isRecording ? '⏹️' : '🔴'}
            </span>
            <span class="capture-btn-text">
              {isRecording ? '停止' : '录制'}
            </span>
          </button>

          <Show when={isRecording}>
            <button
              class="capture-btn pause-btn"
              onClick={handlePauseResume}
              title={state.isPaused ? '继续' : '暂停'}
            >
              <span class="capture-btn-icon">
                {state.isPaused ? '▶️' : '⏸️'}
              </span>
            </button>
            
            <button
              class="capture-btn cancel-btn"
              onClick={handleCancelRecording}
              title="取消录制"
            >
              <span class="capture-btn-icon">🚫</span>
            </button>
          </Show>
        </div>
      </div>

      {/* 录制状态 */}
      <Show when={isRecording}>
        <div class="recording-status">
          <div class="recording-indicator">
            <span class={`recording-dot ${state.isPaused ? 'paused' : ''}`} />
            <span class="recording-label">
              {state.isPaused ? '已暂停' : '录制中'}
            </span>
          </div>
          <div class="recording-stats">
            <span class="recording-duration">
              ⏱️ {formatDuration(state.duration)}
            </span>
            <span class="recording-frames">
              🎞️ {state.frameCount} 帧
            </span>
            <span class="recording-size">
              💾 {formatSize(state.estimatedSize)}
            </span>
          </div>
        </div>
      </Show>

      {/* 状态提示 */}
      <Show when={lastAction()}>
        <div class="capture-toast">
          {lastAction()}
        </div>
      </Show>

      {/* 设置面板 */}
      <Show when={showSettings()}>
        <div class="capture-settings">
          <div class="setting-group">
            <label>图片格式</label>
            <select 
              value={imageFormat()} 
              onChange={(e) => setImageFormat(e.target.value as 'png' | 'jpeg' | 'webp')}
            >
              <option value="png">PNG (无损)</option>
              <option value="jpeg">JPEG (小文件)</option>
              <option value="webp">WebP (推荐)</option>
            </select>
          </div>
          
          <div class="setting-group">
            <label>视频格式</label>
            <select 
              value={videoFormat()} 
              onChange={(e) => setVideoFormat(e.target.value as 'webm' | 'mp4')}
            >
              <option value="webm">WebM (推荐)</option>
              <option value="mp4">MP4</option>
            </select>
          </div>
        </div>
      </Show>

      {/* 快捷键提示 */}
      <Show when={!props.compact}>
        <div class="capture-shortcuts">
          <span>Ctrl+Shift+S: 截图</span>
          <span>Ctrl+Shift+R: 录制</span>
        </div>
      </Show>
    </div>
  );
}

export default CapturePanel;
