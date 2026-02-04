/**
 * EmotionParticles - 情绪粒子特效组件
 * 
 * 根据角色情绪显示相应的粒子效果
 * 
 * @author SOTA Optimizer
 * @version 1.0
 */

import { createSignal, onMount, onCleanup, For, Show, createEffect } from 'solid-js';
import { emotionParticleSystem, type Particle, type ParticleType } from '../lib/EmotionParticleSystem';
import type { Expression } from '../lib/AvatarController';
import './EmotionParticles.css';

interface EmotionParticlesProps {
  emotion: Expression;
  intensity?: number;
  enabled?: boolean;
  showControls?: boolean;
  showCounter?: boolean;
}

/**
 * 获取粒子的 CSS 类名
 */
function getParticleClassName(type: ParticleType, index: number): string {
  let className = `particle particle-${type}`;
  
  // 音符交替使用不同符号
  if (type === 'music' && index % 2 === 1) {
    className += ' alt';
  }
  
  return className;
}

/**
 * 获取粒子样式
 */
function getParticleStyle(particle: Particle): Record<string, string> {
  return {
    '--particle-color': particle.color,
    '--size': `${particle.size}`,
    left: `${particle.x}px`,
    top: `${particle.y}px`,
    width: `${particle.size}px`,
    height: `${particle.size}px`,
    opacity: `${particle.opacity}`,
    transform: `rotate(${particle.rotation}deg) scale(${particle.scale})`,
  };
}

export function EmotionParticles(props: EmotionParticlesProps) {
  const [particles, setParticles] = createSignal<Particle[]>([]);
  const [isEnabled, setIsEnabled] = createSignal(props.enabled ?? true);
  const [containerSize, setContainerSize] = createSignal({ width: 800, height: 600 });
  
  let containerRef: HTMLDivElement | undefined;
  let resizeObserver: ResizeObserver | undefined;
  
  // 同步启用状态
  createEffect(() => {
    const enabled = props.enabled ?? true;
    setIsEnabled(enabled);
    emotionParticleSystem.setEnabled(enabled);
  });
  
  // 同步情绪
  createEffect(() => {
    emotionParticleSystem.setEmotion(props.emotion);
  });
  
  // 同步强度
  createEffect(() => {
    if (props.intensity !== undefined) {
      emotionParticleSystem.setIntensity(props.intensity);
    }
  });
  
  onMount(() => {
    // 监听容器尺寸
    if (containerRef) {
      const updateSize = () => {
        const rect = containerRef!.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
        emotionParticleSystem.setContainerSize(rect.width, rect.height);
      };
      
      updateSize();
      
      resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(containerRef);
    }
    
    // 订阅粒子更新
    const unsubscribe = emotionParticleSystem.subscribe((newParticles) => {
      setParticles(newParticles);
    });
    
    // 启动粒子系统
    emotionParticleSystem.start();
    
    onCleanup(() => {
      unsubscribe();
      resizeObserver?.disconnect();
    });
  });
  
  // 切换启用状态
  function toggleEnabled() {
    const newEnabled = !isEnabled();
    setIsEnabled(newEnabled);
    emotionParticleSystem.setEnabled(newEnabled);
  }
  
  // 清除粒子
  function clearParticles() {
    emotionParticleSystem.clear();
  }
  
  return (
    <div class="emotion-particles" ref={containerRef}>
      {/* 粒子渲染 */}
      <For each={particles()}>
        {(particle, index) => (
          <div
            class={getParticleClassName(particle.type, index())}
            style={getParticleStyle(particle)}
          />
        )}
      </For>
      
      {/* 粒子计数器 */}
      <Show when={props.showCounter}>
        <div class="particle-counter">
          ✨ {particles().length}
        </div>
      </Show>
      
      {/* 控制按钮 */}
      <Show when={props.showControls}>
        <div class="particle-controls">
          <button 
            class={`particle-toggle ${isEnabled() ? 'active' : ''}`}
            onClick={toggleEnabled}
          >
            {isEnabled() ? '✨ 特效开' : '✨ 特效关'}
          </button>
          <button 
            class="particle-toggle"
            onClick={clearParticles}
          >
            🗑️ 清除
          </button>
        </div>
      </Show>
    </div>
  );
}

export default EmotionParticles;
