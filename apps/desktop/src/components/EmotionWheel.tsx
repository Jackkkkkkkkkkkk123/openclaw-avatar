/**
 * EmotionWheel - 互动表情轮盘
 * 
 * 可视化情绪选择器：
 * - 圆形轮盘布局，按情绪类别分区
 * - 鼠标悬停预览表情
 * - 点击切换 Avatar 表情
 * - 当前情绪高亮显示
 * - 情绪强度调节滑块
 * 
 * SOTA Round 38: 用户体验功能增强
 */

import { createSignal, For, Show, onMount, onCleanup } from 'solid-js';
import { avatarController } from '../lib/AvatarController';
import './EmotionWheel.css';

// 情绪定义：包含emoji、颜色和Valence-Arousal位置
interface EmotionDef {
  name: string;
  emoji: string;
  color: string;
  category: 'positive' | 'negative' | 'neutral' | 'complex';
  valence: number;  // -1 到 1 (消极到积极)
  arousal: number;  // -1 到 1 (平静到激动)
  description: string;
}

const EMOTIONS: EmotionDef[] = [
  // 高唤醒积极
  { name: 'excited', emoji: '🤩', color: '#FF6B35', category: 'positive', valence: 0.8, arousal: 0.9, description: '兴奋激动' },
  { name: 'happy', emoji: '😊', color: '#FFD93D', category: 'positive', valence: 0.9, arousal: 0.5, description: '开心快乐' },
  { name: 'amused', emoji: '😆', color: '#FFB347', category: 'positive', valence: 0.7, arousal: 0.6, description: '觉得有趣' },
  { name: 'playful', emoji: '😜', color: '#FF69B4', category: 'positive', valence: 0.6, arousal: 0.7, description: '调皮俏皮' },
  { name: 'loving', emoji: '🥰', color: '#FF85A2', category: 'positive', valence: 0.95, arousal: 0.4, description: '充满爱意' },
  
  // 低唤醒积极
  { name: 'grateful', emoji: '🙏', color: '#98D8C8', category: 'positive', valence: 0.8, arousal: -0.2, description: '心怀感激' },
  { name: 'relieved', emoji: '😌', color: '#87CEEB', category: 'positive', valence: 0.6, arousal: -0.5, description: '如释重负' },
  { name: 'hopeful', emoji: '🌟', color: '#9FE2BF', category: 'positive', valence: 0.7, arousal: 0.1, description: '充满希望' },
  { name: 'proud', emoji: '😤', color: '#DDA0DD', category: 'positive', valence: 0.75, arousal: 0.3, description: '感到骄傲' },
  
  // 中性
  { name: 'neutral', emoji: '😐', color: '#B0BEC5', category: 'neutral', valence: 0, arousal: 0, description: '平静中性' },
  { name: 'thinking', emoji: '🤔', color: '#78909C', category: 'neutral', valence: 0.1, arousal: 0.2, description: '陷入思考' },
  { name: 'curious', emoji: '🧐', color: '#90A4AE', category: 'neutral', valence: 0.3, arousal: 0.4, description: '好奇探索' },
  { name: 'determined', emoji: '💪', color: '#7986CB', category: 'neutral', valence: 0.4, arousal: 0.5, description: '坚定决心' },
  
  // 高唤醒消极
  { name: 'surprised', emoji: '😮', color: '#E040FB', category: 'complex', valence: 0.1, arousal: 0.8, description: '感到惊讶' },
  { name: 'angry', emoji: '😠', color: '#F44336', category: 'negative', valence: -0.8, arousal: 0.9, description: '生气愤怒' },
  { name: 'fear', emoji: '😨', color: '#9C27B0', category: 'negative', valence: -0.7, arousal: 0.8, description: '感到恐惧' },
  { name: 'anxious', emoji: '😰', color: '#7B1FA2', category: 'negative', valence: -0.5, arousal: 0.7, description: '焦虑不安' },
  { name: 'disgusted', emoji: '🤢', color: '#8BC34A', category: 'negative', valence: -0.6, arousal: 0.4, description: '感到恶心' },
  
  // 低唤醒消极
  { name: 'sad', emoji: '😢', color: '#64B5F6', category: 'negative', valence: -0.8, arousal: -0.4, description: '悲伤难过' },
  { name: 'disappointed', emoji: '😔', color: '#5C6BC0', category: 'negative', valence: -0.5, arousal: -0.3, description: '感到失望' },
  { name: 'lonely', emoji: '🥺', color: '#7E57C2', category: 'negative', valence: -0.6, arousal: -0.5, description: '感到孤独' },
  { name: 'bored', emoji: '😑', color: '#9E9E9E', category: 'negative', valence: -0.2, arousal: -0.6, description: '无聊乏味' },
  { name: 'embarrassed', emoji: '😳', color: '#EF9A9A', category: 'complex', valence: -0.3, arousal: 0.5, description: '感到尴尬' },
  { name: 'confused', emoji: '😕', color: '#FFCC80', category: 'complex', valence: -0.1, arousal: 0.3, description: '困惑不解' },
];

export interface EmotionWheelProps {
  currentEmotion: string;
  onEmotionSelect?: (emotion: string, intensity: number) => void;
  visible?: boolean;
  position?: 'left' | 'right';
}

export function EmotionWheel(props: EmotionWheelProps) {
  const [expanded, setExpanded] = createSignal(false);
  const [hoveredEmotion, setHoveredEmotion] = createSignal<EmotionDef | null>(null);
  const [intensity, setIntensity] = createSignal(0.8);
  const [previewActive, setPreviewActive] = createSignal(false);
  
  // 轮盘尺寸
  const WHEEL_SIZE = 320;
  const CENTER = WHEEL_SIZE / 2;
  const INNER_RADIUS = 40;
  const OUTER_RADIUS = 140;
  
  // 计算情绪在轮盘上的位置（基于 Valence-Arousal 模型）
  const getEmotionPosition = (emotion: EmotionDef) => {
    // 将 Valence-Arousal 映射到极坐标
    // Valence = x轴 (右正左负), Arousal = y轴 (上正下负)
    const angle = Math.atan2(-emotion.arousal, emotion.valence);
    const distance = Math.sqrt(emotion.valence ** 2 + emotion.arousal ** 2);
    const radius = INNER_RADIUS + (OUTER_RADIUS - INNER_RADIUS) * Math.min(distance, 1);
    
    return {
      x: CENTER + radius * Math.cos(angle),
      y: CENTER + radius * Math.sin(angle),
    };
  };
  
  // 处理情绪选择
  const handleEmotionClick = (emotion: EmotionDef) => {
    avatarController.setExpression(emotion.name);
    props.onEmotionSelect?.(emotion.name, intensity());
    setPreviewActive(false);
  };
  
  // 处理悬停预览
  const handleEmotionHover = (emotion: EmotionDef) => {
    setHoveredEmotion(emotion);
    if (previewActive()) {
      avatarController.setExpression(emotion.name);
    }
  };
  
  // 处理悬停离开
  const handleEmotionLeave = () => {
    setHoveredEmotion(null);
    if (previewActive()) {
      avatarController.setExpression(props.currentEmotion);
    }
  };
  
  // 获取当前情绪定义
  const getCurrentEmotionDef = () => 
    EMOTIONS.find(e => e.name === props.currentEmotion) || EMOTIONS.find(e => e.name === 'neutral')!;
  
  // 分类图例
  const categories = [
    { key: 'positive', label: '积极', color: '#4CAF50' },
    { key: 'negative', label: '消极', color: '#F44336' },
    { key: 'neutral', label: '中性', color: '#9E9E9E' },
    { key: 'complex', label: '复杂', color: '#9C27B0' },
  ];
  
  const position = props.position ?? 'right';
  
  return (
    <Show when={props.visible !== false}>
      <div class={`emotion-wheel emotion-wheel--${position} ${expanded() ? 'emotion-wheel--expanded' : ''}`}>
        {/* 折叠按钮 */}
        <button 
          class="emotion-wheel__toggle"
          onClick={() => setExpanded(!expanded())}
          title="表情轮盘"
          style={{ 'background-color': getCurrentEmotionDef().color }}
        >
          <span class="toggle-emoji">{getCurrentEmotionDef().emoji}</span>
          <span class="toggle-arrow">{expanded() ? (position === 'right' ? '▶' : '◀') : (position === 'right' ? '◀' : '▶')}</span>
        </button>
        
        <Show when={expanded()}>
          <div class="emotion-wheel__content">
            <div class="emotion-wheel__header">
              <h3>🎭 表情轮盘</h3>
              <div class="emotion-wheel__current">
                <span class="current-emoji">{getCurrentEmotionDef().emoji}</span>
                <span class="current-name">{getCurrentEmotionDef().description}</span>
              </div>
            </div>
            
            {/* 情绪轮盘 SVG */}
            <div class="emotion-wheel__wheel">
              <svg 
                width={WHEEL_SIZE} 
                height={WHEEL_SIZE} 
                viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}
              >
                {/* 背景圆圈 */}
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={OUTER_RADIUS + 10}
                  fill="rgba(0,0,0,0.2)"
                  stroke="rgba(255,255,255,0.1)"
                  stroke-width="1"
                />
                
                {/* Valence-Arousal 坐标轴 */}
                <line 
                  x1={CENTER - OUTER_RADIUS - 5} y1={CENTER} 
                  x2={CENTER + OUTER_RADIUS + 5} y2={CENTER}
                  stroke="rgba(255,255,255,0.15)"
                  stroke-width="1"
                  stroke-dasharray="4,4"
                />
                <line 
                  x1={CENTER} y1={CENTER - OUTER_RADIUS - 5} 
                  x2={CENTER} y2={CENTER + OUTER_RADIUS + 5}
                  stroke="rgba(255,255,255,0.15)"
                  stroke-width="1"
                  stroke-dasharray="4,4"
                />
                
                {/* 坐标轴标签 */}
                <text x={CENTER + OUTER_RADIUS + 15} y={CENTER + 4} fill="rgba(255,255,255,0.4)" font-size="10">积极</text>
                <text x={CENTER - OUTER_RADIUS - 30} y={CENTER + 4} fill="rgba(255,255,255,0.4)" font-size="10">消极</text>
                <text x={CENTER - 12} y={CENTER - OUTER_RADIUS - 10} fill="rgba(255,255,255,0.4)" font-size="10">激动</text>
                <text x={CENTER - 12} y={CENTER + OUTER_RADIUS + 20} fill="rgba(255,255,255,0.4)" font-size="10">平静</text>
                
                {/* 情绪点 */}
                <For each={EMOTIONS}>
                  {(emotion) => {
                    const pos = getEmotionPosition(emotion);
                    const isActive = emotion.name === props.currentEmotion;
                    const isHovered = hoveredEmotion()?.name === emotion.name;
                    const scale = isActive ? 1.3 : isHovered ? 1.2 : 1;
                    
                    return (
                      <g
                        class={`emotion-point ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
                        transform={`translate(${pos.x}, ${pos.y})`}
                        onMouseEnter={() => handleEmotionHover(emotion)}
                        onMouseLeave={handleEmotionLeave}
                        onClick={() => handleEmotionClick(emotion)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* 光晕效果 */}
                        {isActive && (
                          <circle
                            cx={0}
                            cy={0}
                            r={25}
                            fill="none"
                            stroke={emotion.color}
                            stroke-width="2"
                            opacity="0.5"
                            class="pulse-ring"
                          />
                        )}
                        
                        {/* 背景圆 */}
                        <circle
                          cx={0}
                          cy={0}
                          r={20 * scale}
                          fill={emotion.color}
                          stroke={isActive ? '#fff' : 'rgba(255,255,255,0.3)'}
                          stroke-width={isActive ? 3 : 1}
                          opacity={isActive ? 1 : 0.85}
                        />
                        
                        {/* Emoji */}
                        <text
                          x={0}
                          y={6}
                          text-anchor="middle"
                          font-size={16 * scale}
                          style={{ 'pointer-events': 'none' }}
                        >
                          {emotion.emoji}
                        </text>
                      </g>
                    );
                  }}
                </For>
                
                {/* 中心点 */}
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={INNER_RADIUS - 10}
                  fill="rgba(0,0,0,0.4)"
                  stroke="rgba(255,255,255,0.2)"
                  stroke-width="1"
                />
                <text
                  x={CENTER}
                  y={CENTER + 5}
                  text-anchor="middle"
                  fill="rgba(255,255,255,0.5)"
                  font-size="10"
                >
                  V-A模型
                </text>
              </svg>
            </div>
            
            {/* 悬停信息 */}
            <Show when={hoveredEmotion()}>
              <div class="emotion-wheel__tooltip">
                <span class="tooltip-emoji">{hoveredEmotion()!.emoji}</span>
                <span class="tooltip-name">{hoveredEmotion()!.name}</span>
                <span class="tooltip-desc">{hoveredEmotion()!.description}</span>
              </div>
            </Show>
            
            {/* 强度调节 */}
            <div class="emotion-wheel__intensity">
              <label>
                <span>表情强度</span>
                <span class="intensity-value">{Math.round(intensity() * 100)}%</span>
              </label>
              <input 
                type="range" 
                min="0.1" 
                max="1" 
                step="0.1"
                value={intensity()}
                onInput={(e) => setIntensity(parseFloat(e.currentTarget.value))}
              />
            </div>
            
            {/* 预览模式开关 */}
            <label class="emotion-wheel__preview-toggle">
              <input 
                type="checkbox" 
                checked={previewActive()}
                onChange={(e) => setPreviewActive(e.currentTarget.checked)}
              />
              <span>悬停预览模式</span>
            </label>
            
            {/* 图例 */}
            <div class="emotion-wheel__legend">
              <For each={categories}>
                {(cat) => (
                  <div class="legend-item">
                    <span class="legend-dot" style={{ 'background-color': cat.color }}></span>
                    <span class="legend-label">{cat.label}</span>
                  </div>
                )}
              </For>
            </div>
            
            {/* 快捷按钮 */}
            <div class="emotion-wheel__quick">
              <button onClick={() => handleEmotionClick(EMOTIONS.find(e => e.name === 'neutral')!)}>
                😐 重置
              </button>
              <button onClick={() => handleEmotionClick(EMOTIONS.find(e => e.name === 'happy')!)}>
                😊 开心
              </button>
              <button onClick={() => handleEmotionClick(EMOTIONS.find(e => e.name === 'thinking')!)}>
                🤔 思考
              </button>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}

export default EmotionWheel;
