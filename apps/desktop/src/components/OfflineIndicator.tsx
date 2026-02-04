/**
 * OfflineIndicator - 离线状态指示器
 * 
 * 当用户离线时显示提示
 */

import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { serviceWorkerManager } from '../lib/ServiceWorkerManager';
import './OfflineIndicator.css';

export function OfflineIndicator() {
  const [offline, setOffline] = createSignal(false);
  const [updateAvailable, setUpdateAvailable] = createSignal(false);
  const [visible, setVisible] = createSignal(false);

  onMount(() => {
    const unsubscribe = serviceWorkerManager.onStateChange((state) => {
      setOffline(state.offline);
      setUpdateAvailable(state.updateAvailable);
      
      // 显示动画
      if (state.offline || state.updateAvailable) {
        setVisible(true);
      }
    });

    onCleanup(unsubscribe);
  });

  const handleUpdate = () => {
    serviceWorkerManager.applyUpdate();
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  return (
    <Show when={visible() && (offline() || updateAvailable())}>
      <div class={`offline-indicator ${offline() ? 'offline' : 'update'}`}>
        <div class="offline-indicator-content">
          <Show when={offline()}>
            <span class="offline-icon">📡</span>
            <span class="offline-text">离线模式 - 部分功能可能不可用</span>
          </Show>
          <Show when={!offline() && updateAvailable()}>
            <span class="offline-icon">🆕</span>
            <span class="offline-text">新版本可用</span>
            <button class="update-button" onClick={handleUpdate}>
              立即更新
            </button>
          </Show>
          <button class="dismiss-button" onClick={handleDismiss} title="关闭">
            ✕
          </button>
        </div>
      </div>
    </Show>
  );
}
