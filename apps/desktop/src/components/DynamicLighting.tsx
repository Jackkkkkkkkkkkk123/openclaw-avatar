/**
 * DynamicLighting - 动态光照渲染组件
 * 
 * SOTA Round 41 - 真实的动态光照效果
 * 
 * 使用 CSS 渲染多光源、阴影、辉光和体积光效果
 */

import { createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import { getDynamicLightingSystem, type LightingState } from '../lib/DynamicLightingSystem';
import './DynamicLighting.css';

interface DynamicLightingProps {
  enabled?: boolean;
  className?: string;
  emotion?: string;
  timeOfDay?: string;
  weather?: string;
}

export function DynamicLighting(props: DynamicLightingProps) {
  const [state, setState] = createSignal<LightingState | null>(null);
  const [enabled, setEnabled] = createSignal(props.enabled ?? true);
  
  const lightingSystem = getDynamicLightingSystem();
  
  onMount(() => {
    // 订阅光照状态
    const unsubscribe = lightingSystem.subscribe(setState);
    
    // 启动动画
    lightingSystem.start();
    
    onCleanup(() => {
      unsubscribe();
      lightingSystem.stop();
    });
  });
  
  // 同步 enabled prop
  createEffect(() => {
    setEnabled(props.enabled ?? true);
  });
  
  // 获取光源渲染数据
  const getLights = () => {
    const currentState = state();
    if (!currentState) return [];
    return lightingSystem.getLightRenderData();
  };
  
  // 获取 CSS 变量
  const getCSSVars = () => {
    const currentState = state();
    if (!currentState) return {};
    return lightingSystem.getCSSVariables();
  };
  
  // 生成阴影样式
  const getShadowStyle = () => {
    const currentState = state();
    if (!currentState || !currentState.shadow.enabled) return {};
    
    const { color, blur, offset, opacity } = currentState.shadow;
    return {
      'box-shadow': `${offset.x}px ${offset.y}px ${blur}px rgba(0, 0, 0, ${opacity})`,
      '--shadow-color': color,
    };
  };
  
  // 生成辉光样式
  const getBloomStyle = () => {
    const currentState = state();
    if (!currentState || !currentState.bloom.enabled) return {};
    
    const { intensity, radius, color } = currentState.bloom;
    return {
      '--bloom-intensity': intensity,
      '--bloom-radius': `${radius}px`,
      '--bloom-color': color || '#ffffff',
    };
  };
  
  return (
    <Show when={enabled()}>
      <div 
        class={`dynamic-lighting ${props.className || ''}`}
        style={getCSSVars() as any}
        data-emotion={props.emotion || 'neutral'}
        data-time={props.timeOfDay || 'afternoon'}
        data-weather={props.weather || 'none'}
      >
        {/* 环境光层 */}
        <div class="lighting-ambient" />
        
        {/* 光源层 */}
        <div class="lighting-sources">
          <For each={getLights()}>
            {(light) => (
              <div
                class={`light-source light-${light.type}`}
                style={{
                  '--light-color': light.color,
                  '--light-intensity': light.intensity,
                  '--light-x': `${light.x}%`,
                  '--light-y': `${light.y}%`,
                  '--light-size': `${light.size}px`,
                  '--light-blur': `${light.blur}px`,
                } as any}
              />
            )}
          </For>
        </div>
        
        {/* 辉光层 */}
        <Show when={state()?.bloom.enabled}>
          <div class="lighting-bloom" style={getBloomStyle() as any} />
        </Show>
        
        {/* 体积光层 */}
        <Show when={state()?.volumetric.enabled}>
          <div class="lighting-volumetric">
            <For each={Array.from({ length: state()?.volumetric.rays || 0 }, (_, i) => i)}>
              {(index) => (
                <div
                  class="volumetric-ray"
                  style={{
                    '--ray-index': index,
                    '--ray-color': state()?.volumetric.color,
                    '--ray-intensity': state()?.volumetric.intensity,
                    '--ray-angle': `${state()?.volumetric.angle}deg`,
                  } as any}
                />
              )}
            </For>
          </div>
        </Show>
        
        {/* 暗角层 */}
        <div class="lighting-vignette" />
        
        {/* 滤镜层 (应用于整体) */}
        <div 
          class="lighting-filters"
          style={{ filter: state()?.cssFilters || 'none' }}
        />
      </div>
    </Show>
  );
}

/**
 * 光照控制面板组件
 */
export function LightingControlPanel() {
  const [expanded, setExpanded] = createSignal(false);
  const [state, setState] = createSignal<LightingState | null>(null);
  
  const lightingSystem = getDynamicLightingSystem();
  
  onMount(() => {
    const unsubscribe = lightingSystem.subscribe(setState);
    onCleanup(unsubscribe);
  });
  
  const emotions = [
    'neutral', 'happy', 'sad', 'surprised', 'angry', 'fear', 
    'excited', 'loving', 'thinking', 'playful'
  ] as const;
  
  const times = ['dawn', 'morning', 'afternoon', 'evening', 'night', 'midnight'] as const;
  const weathers = ['clear', 'cloudy', 'rainy', 'stormy', 'snowy', 'foggy'] as const;
  
  return (
    <div class="lighting-control-panel">
      <button 
        class="panel-toggle"
        onClick={() => setExpanded(!expanded())}
      >
        💡 光照 {expanded() ? '▼' : '▶'}
      </button>
      
      <Show when={expanded()}>
        <div class="panel-content">
          {/* 当前状态 */}
          <div class="current-state">
            <div class="state-item">
              <span class="label">场景:</span>
              <span class="value">{state()?.currentScene || '-'}</span>
            </div>
            <div class="state-item">
              <span class="label">曝光:</span>
              <span class="value">{state()?.exposure?.toFixed(2) || '-'}</span>
            </div>
            <div class="state-item">
              <span class="label">对比度:</span>
              <span class="value">{state()?.contrast?.toFixed(2) || '-'}</span>
            </div>
            <div class="state-item">
              <span class="label">饱和度:</span>
              <span class="value">{state()?.saturation?.toFixed(2) || '-'}</span>
            </div>
          </div>
          
          {/* 情绪选择 */}
          <div class="control-group">
            <label>情绪光照:</label>
            <div class="button-grid">
              <For each={emotions}>
                {(emotion) => (
                  <button
                    class="emotion-btn"
                    onClick={() => lightingSystem.setEmotion(emotion)}
                  >
                    {emotion}
                  </button>
                )}
              </For>
            </div>
          </div>
          
          {/* 时间选择 */}
          <div class="control-group">
            <label>时间氛围:</label>
            <div class="button-grid">
              <For each={times}>
                {(time) => (
                  <button
                    class="time-btn"
                    onClick={() => lightingSystem.setTimeOfDay(time)}
                  >
                    {time}
                  </button>
                )}
              </For>
            </div>
          </div>
          
          {/* 天气选择 */}
          <div class="control-group">
            <label>天气效果:</label>
            <div class="button-grid">
              <For each={weathers}>
                {(weather) => (
                  <button
                    class="weather-btn"
                    onClick={() => lightingSystem.setWeather(weather)}
                  >
                    {weather}
                  </button>
                )}
              </For>
            </div>
          </div>
          
          {/* 光源列表 */}
          <div class="lights-list">
            <label>活跃光源 ({state()?.lights.length || 0}):</label>
            <For each={state()?.lights || []}>
              {(light) => (
                <div class="light-item">
                  <span 
                    class="light-color" 
                    style={{ background: light.color }}
                  />
                  <span class="light-type">{light.type}</span>
                  <span class="light-intensity">
                    {(light.intensity * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default DynamicLighting;
