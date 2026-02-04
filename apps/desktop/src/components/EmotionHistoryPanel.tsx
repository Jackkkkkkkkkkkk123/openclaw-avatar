/**
 * EmotionHistoryPanel - 情绪历史可视化
 * 
 * 显示对话中的情绪变化趋势
 */

import { Component, createSignal, createEffect, For, Show, onCleanup } from 'solid-js';
import { emotionContextEngine, type EmotionEntry, type ConversationTone } from '../lib/EmotionContextEngine';
import './EmotionHistoryPanel.css';

interface EmotionHistoryPanelProps {
  maxEntries?: number;
  onClose?: () => void;
}

// 情绪颜色映射
const EMOTION_COLORS: Record<string, string> = {
  neutral: '#6b7280',
  happy: '#fbbf24',
  sad: '#3b82f6',
  surprised: '#f97316',
  angry: '#ef4444',
  fear: '#8b5cf6',
  disgust: '#22c55e',
  excited: '#ec4899',
  curious: '#06b6d4',
  confused: '#a855f7',
};

// 情绪 emoji 映射
const EMOTION_EMOJI: Record<string, string> = {
  neutral: '😐',
  happy: '😊',
  sad: '😢',
  surprised: '😮',
  angry: '😠',
  fear: '😨',
  disgust: '🤢',
  excited: '🤩',
  curious: '🤔',
  confused: '😕',
};

// 基调描述
const TONE_LABELS: Record<ConversationTone, { label: string; color: string }> = {
  casual: { label: '轻松', color: '#22c55e' },
  serious: { label: '认真', color: '#3b82f6' },
  playful: { label: '活泼', color: '#fbbf24' },
  supportive: { label: '支持', color: '#ec4899' },
  professional: { label: '专业', color: '#6366f1' },
};

export const EmotionHistoryPanel: Component<EmotionHistoryPanelProps> = (props) => {
  const maxEntries = () => props.maxEntries ?? 20;
  
  const [history, setHistory] = createSignal<EmotionEntry[]>([]);
  const [currentTone, setCurrentTone] = createSignal<ConversationTone>('casual');
  const [topics, setTopics] = createSignal<string[]>([]);
  
  // 定时更新
  let updateInterval: ReturnType<typeof setInterval>;
  
  createEffect(() => {
    const update = () => {
      setHistory(emotionContextEngine.getEmotionHistory().slice(-maxEntries()));
      setCurrentTone(emotionContextEngine.getCurrentTone());
      setTopics(emotionContextEngine.getActiveTopics());
    };
    
    update();
    updateInterval = setInterval(update, 500);
  });
  
  onCleanup(() => {
    clearInterval(updateInterval);
  });
  
  // 计算情绪分布
  const emotionDistribution = () => {
    const hist = history();
    if (hist.length === 0) return [];
    
    const counts: Record<string, number> = {};
    hist.forEach(e => {
      counts[e.emotion] = (counts[e.emotion] || 0) + e.intensity;
    });
    
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    
    return Object.entries(counts)
      .map(([emotion, count]) => ({
        emotion,
        percentage: (count / total) * 100,
        color: EMOTION_COLORS[emotion] || '#6b7280',
        emoji: EMOTION_EMOJI[emotion] || '😐',
      }))
      .sort((a, b) => b.percentage - a.percentage);
  };
  
  // 计算平均强度
  const averageIntensity = () => {
    const hist = history();
    if (hist.length === 0) return 0;
    return hist.reduce((sum, e) => sum + e.intensity, 0) / hist.length;
  };
  
  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  return (
    <div class="emotion-history-panel">
      <div class="panel-header">
        <h3>💭 情绪分析</h3>
        <Show when={props.onClose}>
          <button class="close-btn" onClick={props.onClose}>×</button>
        </Show>
      </div>
      
      {/* 当前基调 */}
      <div class="current-tone">
        <span class="tone-label">对话基调:</span>
        <span 
          class="tone-badge"
          style={{ 
            background: `${TONE_LABELS[currentTone()].color}20`,
            color: TONE_LABELS[currentTone()].color,
            'border-color': TONE_LABELS[currentTone()].color,
          }}
        >
          {TONE_LABELS[currentTone()].label}
        </span>
      </div>
      
      {/* 活跃话题 */}
      <Show when={topics().length > 0}>
        <div class="active-topics">
          <span class="topics-label">活跃话题:</span>
          <div class="topics-list">
            <For each={topics().slice(0, 5)}>
              {(topic) => <span class="topic-tag">{topic}</span>}
            </For>
          </div>
        </div>
      </Show>
      
      {/* 情绪分布 */}
      <div class="emotion-distribution">
        <h4>情绪分布</h4>
        <Show when={emotionDistribution().length > 0} fallback={
          <div class="empty-state">暂无数据</div>
        }>
          <div class="distribution-bars">
            <For each={emotionDistribution()}>
              {(item) => (
                <div class="distribution-item">
                  <span class="dist-emoji">{item.emoji}</span>
                  <div class="dist-bar-container">
                    <div 
                      class="dist-bar"
                      style={{ 
                        width: `${item.percentage}%`,
                        background: item.color,
                      }}
                    />
                  </div>
                  <span class="dist-percentage">{item.percentage.toFixed(0)}%</span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
      
      {/* 强度指示 */}
      <div class="intensity-indicator">
        <span>情绪强度:</span>
        <div class="intensity-bar-container">
          <div 
            class="intensity-bar"
            style={{ width: `${averageIntensity() * 100}%` }}
          />
        </div>
        <span class="intensity-value">{(averageIntensity() * 100).toFixed(0)}%</span>
      </div>
      
      {/* 时间线 */}
      <div class="emotion-timeline">
        <h4>情绪时间线</h4>
        <div class="timeline-container">
          <Show when={history().length > 0} fallback={
            <div class="empty-state">开始对话后将显示情绪变化</div>
          }>
            <div class="timeline-entries">
              <For each={[...history()].reverse().slice(0, 10)}>
                {(entry) => (
                  <div class="timeline-entry">
                    <div 
                      class="entry-indicator"
                      style={{ background: EMOTION_COLORS[entry.emotion] || '#6b7280' }}
                    />
                    <div class="entry-content">
                      <span class="entry-emotion">
                        {EMOTION_EMOJI[entry.emotion] || '😐'} {entry.emotion}
                      </span>
                      <span class="entry-time">{formatTime(entry.timestamp)}</span>
                    </div>
                    <div class="entry-intensity">
                      {(entry.intensity * 100).toFixed(0)}%
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
      
      {/* 统计 */}
      <div class="emotion-stats">
        <div class="stat-item">
          <span class="stat-value">{history().length}</span>
          <span class="stat-label">情绪变化</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{topics().length}</span>
          <span class="stat-label">识别话题</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{emotionDistribution().length}</span>
          <span class="stat-label">情绪类型</span>
        </div>
      </div>
    </div>
  );
};

export default EmotionHistoryPanel;
