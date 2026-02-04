/**
 * Avatar 组件 - Live2D 模型渲染
 * 
 * 使用 PixiJS 7 + pixi-live2d-display 0.5.0-beta
 */

import { onMount, onCleanup, createSignal } from 'solid-js';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display';
import { avatarController } from '../lib/AvatarController';

// 注册 PIXI 到全局（pixi-live2d-display 需要）
if (typeof window !== 'undefined') {
  (window as any).PIXI = PIXI;
}

// 注册 Ticker (让 Live2D 模型自动更新)
Live2DModel.registerTicker(PIXI.Ticker);

interface AvatarProps {
  modelPath: string;
  width?: number;
  height?: number;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export function Avatar(props: AvatarProps) {
  let containerRef: HTMLDivElement | undefined;
  let app: PIXI.Application | null = null;
  let model: any = null;

  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    if (!containerRef) return;

    try {
      // 创建 PixiJS 应用
      app = new PIXI.Application({
        width: props.width || 800,
        height: props.height || 600,
        backgroundAlpha: 0, // 透明背景
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      containerRef.appendChild(app.view as HTMLCanvasElement);

      // 加载 Live2D 模型
      console.log('[Avatar] 加载模型:', props.modelPath);
      model = await Live2DModel.from(props.modelPath, {
        autoHitTest: true,
        autoFocus: true,
        autoUpdate: true,
      });

      // 设置模型位置和缩放
      const scale = Math.min(
        (props.width || 800) / model.width,
        (props.height || 600) / model.height
      ) * 0.8;

      model.scale.set(scale);
      model.x = (props.width || 800) / 2;
      model.y = (props.height || 600) * 0.9;
      model.anchor.set(0.5, 1);

      // 添加到舞台
      app.stage.addChild(model);

      // 绑定控制器
      avatarController.bind(model);

      // 设置鼠标跟随
      app.stage.eventMode = 'static';
      app.stage.hitArea = new PIXI.Rectangle(0, 0, props.width || 800, props.height || 600);
      app.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
        const point = e.global;
        model?.focus(point.x, point.y);
      });

      // 点击触发动作
      model.on('hit', (hitAreas: string[]) => {
        console.log('[Avatar] Hit:', hitAreas);
        if (hitAreas.includes('body')) {
          avatarController.playMotion('tap_body');
        } else if (hitAreas.includes('head')) {
          avatarController.playMotion('flick_head');
        }
      });

      setLoading(false);
      props.onReady?.();
      console.log('[Avatar] 模型加载成功');

      // 播放初始 idle 动作
      avatarController.playIdleMotion();

    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('[Avatar] 加载失败:', err);
      setError(err.message);
      setLoading(false);
      props.onError?.(err);
    }
  });

  onCleanup(() => {
    model?.destroy();
    app?.destroy(true);
    avatarController.destroy();
  });

  return (
    <div 
      ref={containerRef} 
      class="avatar-container"
      style={{
        width: `${props.width || 800}px`,
        height: `${props.height || 600}px`,
        position: 'relative',
      }}
    >
      {loading() && (
        <div class="avatar-loading">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      )}
      {error() && (
        <div class="avatar-error">
          <p>❌ {error()}</p>
        </div>
      )}
    </div>
  );
}

export default Avatar;
