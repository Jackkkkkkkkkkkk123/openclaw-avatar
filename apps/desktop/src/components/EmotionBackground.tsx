/**
 * EmotionBackground - 情绪驱动背景组件
 * 
 * 根据角色情绪动态渲染背景渐变、光效和波浪
 * 与粒子系统协同，创造沉浸式氛围
 * 
 * SOTA Round 37
 */

import { createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import { 
  emotionBackgroundSystem, 
  type BackgroundState, 
  type GlowConfig,
  type WaveConfig,
} from '../lib/EmotionBackgroundSystem';
import type { Expression } from '../lib/AvatarController';
import './EmotionBackground.css';

interface EmotionBackgroundProps {
  emotion: Expression;
  enabled?: boolean;
  showControls?: boolean;
  intensity?: number;       // 0-2, 默认 1
  // SOTA Round 40: 场景导演控制
  colorShift?: number;      // -1 到 1, 色调偏移 (冷-暖)
  brightness?: number;      // 0-2, 亮度
  warmth?: number;          // -1 到 1, 色温
  vignette?: number;        // 0-1, 暗角强度
}

export function EmotionBackground(props: EmotionBackgroundProps) {
  const [state, setState] = createSignal<BackgroundState>(emotionBackgroundSystem.getState());
  const [gradientCSS, setGradientCSS] = createSignal('');
  
  // 订阅状态变化
  onMount(() => {
    if (props.enabled !== false) {
      emotionBackgroundSystem.start();
    }
    
    const unsubscribe = emotionBackgroundSystem.onStateChange((newState) => {
      setState(newState);
      setGradientCSS(emotionBackgroundSystem.generateGradientCSS(newState.animationPhase));
    });
    
    onCleanup(() => {
      unsubscribe();
    });
  });
  
  // 响应情绪变化
  createEffect(() => {
    emotionBackgroundSystem.setEmotion(props.emotion);
  });
  
  // 响应启用状态变化
  createEffect(() => {
    emotionBackgroundSystem.setEnabled(props.enabled !== false);
  });
  
  // 计算光效样式
  function getGlowStyle(glow: GlowConfig, index: number): string {
    if (!glow.enabled) return 'display: none;';
    
    const intensity = (props.intensity ?? 1) * glow.intensity;
    const phase = state().animationPhase;
    
    // 脉冲效果
    let pulseScale = 1;
    let pulseOpacity = 1;
    if (glow.pulse) {
      const pulsePhase = Math.sin(phase * 2 + index * 0.5);
      pulseScale = 1 + pulsePhase * 0.1;
      pulseOpacity = 0.7 + pulsePhase * 0.3;
    }
    
    const size = glow.size * pulseScale;
    const opacity = intensity * pulseOpacity;
    
    return `
      left: ${glow.x}%;
      top: ${glow.y}%;
      width: ${size}px;
      height: ${size}px;
      background: radial-gradient(circle, ${glow.color}${Math.round(opacity * 255).toString(16).padStart(2, '0')} 0%, transparent 70%);
      transform: translate(-50%, -50%) scale(${pulseScale});
    `;
  }
  
  // 计算波浪样式
  function getWaveStyle(wave: WaveConfig, index: number): string {
    if (!wave.enabled) return 'display: none;';
    
    const phase = state().animationPhase;
    const intensity = props.intensity ?? 1;
    
    // 波浪动画
    const waveY = Math.sin(phase * wave.speed + index * Math.PI / wave.count) * wave.amplitude;
    const baseY = 70 + (index * 10); // 底部向上分布
    
    return `
      bottom: ${baseY + waveY}%;
      opacity: ${wave.opacity * intensity};
      background: linear-gradient(180deg, transparent 0%, ${wave.color}${Math.round(wave.opacity * 100).toString(16).padStart(2, '0')} 50%, transparent 100%);
    `;
  }
  
  // 生成波浪数组
  function getWaves(): number[] {
    const wave = state().currentConfig.wave;
    if (!wave.enabled) return [];
    return Array.from({ length: wave.count }, (_, i) => i);
  }
  
  return (
    <div 
      class="emotion-background"
      classList={{ 
        'emotion-background--transitioning': state().isTransitioning,
        'emotion-background--disabled': props.enabled === false,
      }}
      style={{
        '--transition-duration': `${state().currentConfig.transition.duration}ms`,
        '--transition-easing': state().currentConfig.transition.easing,
      }}
    >
      {/* 主渐变背景 */}
      <div 
        class="emotion-background__gradient"
        style={{ background: gradientCSS() }}
      />
      
      {/* 光效层 */}
      <div class="emotion-background__glows">
        <For each={state().currentConfig.glows}>
          {(glow, index) => (
            <div 
              class="emotion-background__glow"
              style={getGlowStyle(glow, index())}
            />
          )}
        </For>
      </div>
      
      {/* 波浪层 */}
      <Show when={state().currentConfig.wave.enabled}>
        <div class="emotion-background__waves">
          <For each={getWaves()}>
            {(index) => (
              <div 
                class="emotion-background__wave"
                style={getWaveStyle(state().currentConfig.wave, index)}
              />
            )}
          </For>
        </div>
      </Show>
      
      {/* 覆盖层（用于情绪叠加效果） */}
      <Show when={state().currentConfig.overlay}>
        <div 
          class="emotion-background__overlay"
          style={{
            background: state().currentConfig.overlay?.color,
            opacity: state().currentConfig.overlay?.opacity,
          }}
        />
      </Show>
      
      {/* 边缘渐变（让角色更突出）- 场景导演控制强度 */}
      <div 
        class="emotion-background__vignette" 
        style={{
          '--vignette-opacity': props.vignette ?? 0.3,
        }}
      />
      
      {/* SOTA Round 40: 场景导演滤镜层 */}
      <div 
        class="emotion-background__scene-filter"
        style={{
          '--scene-brightness': props.brightness ?? 1,
          '--scene-warmth': props.warmth ?? 0,
          '--scene-colorshift': props.colorShift ?? 0,
          filter: `
            brightness(${props.brightness ?? 1})
            saturate(${1 + Math.abs(props.colorShift ?? 0) * 0.3})
            sepia(${Math.max(0, (props.warmth ?? 0) * 0.3)})
            hue-rotate(${(props.colorShift ?? 0) * 15}deg)
          `.trim(),
        }}
      />
      
      {/* 控制面板 */}
      <Show when={props.showControls}>
        <div class="emotion-background__controls">
          <span class="emotion-background__label">
            🎨 {state().currentEmotion}
          </span>
          <button
            class="emotion-background__toggle"
            onClick={() => emotionBackgroundSystem.setEnabled(!emotionBackgroundSystem.isEnabled())}
          >
            {emotionBackgroundSystem.isEnabled() ? '🌈 ON' : '⚫ OFF'}
          </button>
        </div>
      </Show>
    </div>
  );
}

export default EmotionBackground;
