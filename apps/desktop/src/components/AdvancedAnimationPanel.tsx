/**
 * Advanced Animation Panel - 高级动画测试面板
 * 
 * Phase 10: 测试 Viseme 口型和微表情系统
 */

import { createSignal, For } from 'solid-js';
import { avatarController } from '../lib/AvatarController';
import { visemeDriver, type Viseme } from '../lib/VisemeDriver';
import { microExpressionSystem } from '../lib/MicroExpressionSystem';
import './AdvancedAnimationPanel.css';

const VISEME_LIST: Viseme[] = [
  'sil', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR', 'aa', 'E', 'ih', 'oh', 'ou'
];

const VISEME_LABELS: Record<Viseme, string> = {
  sil: '静音',
  PP: 'p/b/m',
  FF: 'f/v',
  TH: 'th',
  DD: 't/d/n',
  kk: 'k/g',
  CH: 'ch/sh',
  SS: 's/z',
  nn: 'n/ng',
  RR: 'r',
  aa: 'a/ah',
  E: 'e/eh',
  ih: 'i/ee',
  oh: 'o',
  ou: 'u/oo',
};

const REACTION_TYPES = [
  { id: 'interest', label: '👀 感兴趣' },
  { id: 'surprise_light', label: '😮 轻微惊讶' },
  { id: 'thinking', label: '🤔 思考' },
  { id: 'doubt', label: '🤨 怀疑' },
  { id: 'agreement', label: '👍 赞同' },
  { id: 'realization', label: '💡 恍然大悟' },
] as const;

export function AdvancedAnimationPanel() {
  const [visemeEnabled, setVisemeEnabled] = createSignal(true);
  const [microEnabled, setMicroEnabled] = createSignal(true);
  const [testText, setTestText] = createSignal('你好，我是初音未来！很高兴认识你！');
  const [isPlayingViseme, setIsPlayingViseme] = createSignal(false);
  
  // 切换 Viseme
  const toggleViseme = (enabled: boolean) => {
    setVisemeEnabled(enabled);
    avatarController.setVisemeEnabled(enabled);
  };
  
  // 切换微表情
  const toggleMicroExpression = (enabled: boolean) => {
    setMicroEnabled(enabled);
    avatarController.setMicroExpressionEnabled(enabled);
  };
  
  // 单独测试 Viseme
  const testViseme = (viseme: Viseme) => {
    visemeDriver.setViseme(viseme);
  };
  
  // 播放完整文本的 Viseme 序列
  const playVisemeSequence = () => {
    const text = testText();
    const duration = text.length * 200; // 每字 200ms
    
    setIsPlayingViseme(true);
    avatarController.speakWithViseme(text, duration);
    
    setTimeout(() => {
      setIsPlayingViseme(false);
      visemeDriver.stop();
    }, duration);
  };
  
  // 触发微表情反应
  const triggerReaction = (type: string) => {
    microExpressionSystem.triggerReaction(type as any);
  };
  
  // 分析文本触发微表情
  const analyzeText = () => {
    microExpressionSystem.analyzeAndReact(testText());
  };

  return (
    <div class="advanced-panel">
      <h3>🎭 高级动画系统</h3>
      
      {/* 系统开关 */}
      <div class="panel-section">
        <h4>系统开关</h4>
        <div class="toggle-group">
          <label class="toggle-item">
            <input 
              type="checkbox" 
              checked={visemeEnabled()} 
              onChange={(e) => toggleViseme(e.target.checked)}
            />
            <span>Viseme 精确口型</span>
          </label>
          <label class="toggle-item">
            <input 
              type="checkbox" 
              checked={microEnabled()} 
              onChange={(e) => toggleMicroExpression(e.target.checked)}
            />
            <span>微表情系统</span>
          </label>
        </div>
      </div>
      
      {/* Viseme 测试 */}
      <div class="panel-section">
        <h4>👄 Viseme 口型测试</h4>
        <div class="viseme-grid">
          <For each={VISEME_LIST}>
            {(viseme) => (
              <button 
                class="viseme-btn"
                onClick={() => testViseme(viseme)}
                title={VISEME_LABELS[viseme]}
              >
                {viseme}
              </button>
            )}
          </For>
        </div>
        
        <div class="text-test">
          <input 
            type="text"
            value={testText()}
            onInput={(e) => setTestText(e.target.value)}
            placeholder="输入测试文本..."
          />
          <button 
            onClick={playVisemeSequence}
            disabled={isPlayingViseme()}
            class="play-btn"
          >
            {isPlayingViseme() ? '播放中...' : '▶ 播放口型'}
          </button>
        </div>
      </div>
      
      {/* 微表情测试 */}
      <div class="panel-section">
        <h4>😊 微表情反应</h4>
        <div class="reaction-grid">
          <For each={REACTION_TYPES}>
            {(reaction) => (
              <button 
                class="reaction-btn"
                onClick={() => triggerReaction(reaction.id)}
              >
                {reaction.label}
              </button>
            )}
          </For>
        </div>
        <button 
          class="analyze-btn"
          onClick={analyzeText}
        >
          🔍 分析文本触发微表情
        </button>
      </div>
      
      {/* 状态显示 */}
      <div class="panel-section status-section">
        <h4>📊 状态</h4>
        <div class="status-item">
          <span>Viseme:</span>
          <span class={`status-badge ${visemeEnabled() ? 'active' : ''}`}>
            {visemeEnabled() ? '启用' : '禁用'}
          </span>
        </div>
        <div class="status-item">
          <span>微表情:</span>
          <span class={`status-badge ${microEnabled() ? 'active' : ''}`}>
            {microEnabled() ? '启用' : '禁用'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default AdvancedAnimationPanel;
