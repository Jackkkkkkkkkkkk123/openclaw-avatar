// 优化后的聊天面板组件
import { createSignal, createEffect, For, Show } from 'solid-js';
import { Button } from './ui';
import './ChatPanel.css';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status?: 'sending' | 'sent' | 'error';
}

export interface ChatPanelProps {
  messages: ChatMessage[];
  processingText?: string;
  isSpeaking?: boolean;
  onSendMessage: (text: string) => void;
  onClearHistory?: () => void;
  disabled?: boolean;
}

export function ChatPanel(props: ChatPanelProps) {
  const [inputText, setInputText] = createSignal('');
  let messagesEndRef: HTMLDivElement | undefined;
  let inputRef: HTMLTextAreaElement | undefined;
  
  // 自动滚动到底部
  function scrollToBottom() {
    messagesEndRef?.scrollIntoView({ behavior: 'smooth' });
  }
  
  // 消息变化时滚动
  createEffect(() => {
    props.messages;
    props.processingText;
    scrollToBottom();
  });
  
  // 发送消息
  function sendMessage() {
    const text = inputText().trim();
    if (!text || props.disabled) return;
    
    props.onSendMessage(text);
    setInputText('');
    inputRef?.focus();
  }
  
  // 键盘事件
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter 换行
        return;
      }
      e.preventDefault();
      sendMessage();
    }
  }
  
  // 自动调整输入框高度
  function adjustTextareaHeight() {
    if (inputRef) {
      inputRef.style.height = 'auto';
      inputRef.style.height = Math.min(inputRef.scrollHeight, 120) + 'px';
    }
  }
  
  // 格式化时间
  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  return (
    <div class="chat-panel">
      {/* 头部 */}
      <div class="chat-panel__header">
        <span class="chat-panel__title">💬 对话</span>
        <Show when={props.messages.length > 0}>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={props.onClearHistory}
            title="清空历史"
          >
            🗑️
          </Button>
        </Show>
      </div>
      
      {/* 消息列表 */}
      <div class="chat-panel__messages">
        <Show when={props.messages.length === 0}>
          <div class="chat-panel__empty">
            <span class="chat-panel__empty-icon">💭</span>
            <p>开始和初音未来聊天吧~</p>
          </div>
        </Show>
        
        <For each={props.messages}>
          {(msg) => (
            <div class={`chat-message chat-message--${msg.role}`}>
              <div class="chat-message__content">
                <p>{msg.content}</p>
              </div>
              <div class="chat-message__meta">
                <span class="chat-message__time">{formatTime(msg.timestamp)}</span>
                <Show when={msg.status === 'error'}>
                  <span class="chat-message__error">发送失败</span>
                </Show>
              </div>
            </div>
          )}
        </For>
        
        {/* 正在输入提示 */}
        <Show when={props.processingText}>
          <div class="chat-message chat-message--assistant chat-message--typing">
            <div class="chat-message__content">
              <p>{props.processingText}</p>
              <span class="typing-indicator">
                <span></span><span></span><span></span>
              </span>
            </div>
          </div>
        </Show>
        
        {/* 说话提示 */}
        <Show when={props.isSpeaking && !props.processingText}>
          <div class="chat-panel__speaking">
            <span class="speaking-wave">🎵</span>
            <span>正在说话...</span>
          </div>
        </Show>
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* 输入区域 */}
      <div class="chat-panel__input">
        <textarea
          ref={inputRef}
          value={inputText()}
          onInput={(e) => {
            setInputText(e.currentTarget.value);
            adjustTextareaHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
          rows={1}
          disabled={props.disabled}
        />
        <Button 
          variant="primary" 
          onClick={sendMessage}
          disabled={props.disabled || !inputText().trim()}
        >
          发送
        </Button>
      </div>
    </div>
  );
}
