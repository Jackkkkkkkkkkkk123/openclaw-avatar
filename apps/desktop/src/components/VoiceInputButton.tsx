/**
 * VoiceInputButton - 语音输入按钮组件
 * 
 * 按住说话模式，松开发送
 */

import { createSignal, onCleanup, Show } from 'solid-js';
import { 
  voiceInputService, 
  isVoiceInputSupported,
  type VoiceInputStatus,
  type VoiceInputResult,
  type VoiceLanguage
} from '../lib/VoiceInputService';
import './VoiceInputButton.css';

export interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInputButton(props: VoiceInputButtonProps) {
  const [status, setStatus] = createSignal<VoiceInputStatus>('idle');
  const [volume, setVolume] = createSignal(0);
  const [interimText, setInterimText] = createSignal('');
  const [error, setError] = createSignal('');
  const [language, setLanguage] = createSignal<VoiceLanguage>('zh-CN');

  // 检查支持
  const supported = isVoiceInputSupported();

  // 订阅状态和结果
  const cleanupStatus = voiceInputService.onStatus((newStatus, err) => {
    setStatus(newStatus);
    if (err) setError(err);
    else setError('');
  });

  const cleanupVolume = voiceInputService.onVolume((v) => {
    setVolume(v);
  });

  // 累积的文本
  let finalText = '';

  const cleanupResult = voiceInputService.onResult((result: VoiceInputResult) => {
    if (result.isFinal) {
      finalText += result.transcript;
      setInterimText('');
    } else {
      setInterimText(result.transcript);
    }
  });

  onCleanup(() => {
    cleanupStatus();
    cleanupVolume();
    cleanupResult();
  });

  // 开始录音
  async function startRecording() {
    if (props.disabled || !supported) return;
    
    finalText = '';
    setInterimText('');
    setError('');
    
    voiceInputService.setLanguage(language());
    await voiceInputService.start();
  }

  // 停止录音并发送
  function stopRecording() {
    voiceInputService.stop();
    
    // 等待一小段时间让最后的结果返回
    setTimeout(() => {
      const text = finalText.trim();
      if (text) {
        props.onTranscript(text);
      }
      finalText = '';
      setInterimText('');
    }, 300);
  }

  // 取消录音
  function cancelRecording() {
    voiceInputService.abort();
    finalText = '';
    setInterimText('');
  }

  // 切换语言
  function cycleLanguage() {
    const languages: VoiceLanguage[] = ['zh-CN', 'ja-JP', 'en-US'];
    const currentIndex = languages.indexOf(language());
    const nextIndex = (currentIndex + 1) % languages.length;
    setLanguage(languages[nextIndex]);
    voiceInputService.setLanguage(languages[nextIndex]);
  }

  // 语言标签
  function getLanguageLabel(): string {
    switch (language()) {
      case 'zh-CN': return '中';
      case 'ja-JP': return '日';
      case 'en-US': return 'EN';
      default: return '?';
    }
  }

  // 状态图标
  function getStatusIcon(): string {
    switch (status()) {
      case 'listening': return '🎤';
      case 'processing': return '⏳';
      case 'error': return '❌';
      case 'unsupported': return '🚫';
      default: return '🎙️';
    }
  }

  if (!supported) {
    return (
      <button 
        class="voice-input-btn voice-input-btn--unsupported"
        disabled
        title="浏览器不支持语音识别"
      >
        🚫
      </button>
    );
  }

  return (
    <div class="voice-input-container">
      {/* 语言切换按钮 */}
      <button
        class="voice-input-lang-btn"
        onClick={cycleLanguage}
        title={`切换语言 (当前: ${language()})`}
        disabled={status() === 'listening'}
      >
        {getLanguageLabel()}
      </button>

      {/* 主录音按钮 */}
      <button
        class={`voice-input-btn ${status() === 'listening' ? 'voice-input-btn--active' : ''}`}
        onPointerDown={startRecording}
        onPointerUp={stopRecording}
        onPointerLeave={cancelRecording}
        onContextMenu={(e) => e.preventDefault()}
        disabled={props.disabled || status() === 'unsupported'}
        title="按住说话，松开发送"
      >
        <span class="voice-input-icon">{getStatusIcon()}</span>
        
        {/* 音量波形 */}
        <Show when={status() === 'listening'}>
          <div class="voice-input-waves">
            <div class="voice-wave" style={{ height: `${20 + volume() * 80}%` }} />
            <div class="voice-wave" style={{ height: `${30 + volume() * 70}%`, "animation-delay": "0.1s" }} />
            <div class="voice-wave" style={{ height: `${25 + volume() * 75}%`, "animation-delay": "0.2s" }} />
          </div>
        </Show>
      </button>

      {/* 实时转写预览 */}
      <Show when={status() === 'listening' && (interimText() || finalText)}>
        <div class="voice-input-preview">
          <span class="voice-preview-text">
            {finalText}{interimText()}
          </span>
          <span class="voice-preview-hint">松开发送</span>
        </div>
      </Show>

      {/* 错误提示 */}
      <Show when={error()}>
        <div class="voice-input-error">
          {error()}
        </div>
      </Show>
    </div>
  );
}
