/**
 * ServiceWorkerManager - PWA Service Worker 管理
 * 
 * 提供离线支持、后台同步、推送通知等 PWA 功能
 */

export interface ServiceWorkerState {
  supported: boolean;
  registered: boolean;
  active: boolean;
  updateAvailable: boolean;
  offline: boolean;
}

type StateChangeCallback = (state: ServiceWorkerState) => void;

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private stateCallbacks: Set<StateChangeCallback> = new Set();
  private _state: ServiceWorkerState = {
    supported: false,
    registered: false,
    active: false,
    updateAvailable: false,
    offline: !navigator.onLine,
  };

  constructor() {
    this._state.supported = 'serviceWorker' in navigator;
    
    // 监听在线/离线状态
    window.addEventListener('online', () => this.updateOfflineState(false));
    window.addEventListener('offline', () => this.updateOfflineState(true));
  }

  get state(): ServiceWorkerState {
    return { ...this._state };
  }

  /**
   * 注册 Service Worker
   */
  async register(): Promise<boolean> {
    if (!this._state.supported) {
      console.warn('[SWManager] Service Worker not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[SWManager] Service Worker registered:', this.registration.scope);

      // 更新状态
      this._state.registered = true;
      this._state.active = !!this.registration.active;
      this.notifyStateChange();

      // 监听更新
      this.registration.addEventListener('updatefound', () => {
        console.log('[SWManager] Update found');
        const newWorker = this.registration?.installing;
        
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SWManager] New version available');
            this._state.updateAvailable = true;
            this.notifyStateChange();
          }
        });
      });

      // 监听控制器变化
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SWManager] Controller changed');
        this._state.active = true;
        this.notifyStateChange();
      });

      return true;
    } catch (error) {
      console.error('[SWManager] Registration failed:', error);
      return false;
    }
  }

  /**
   * 检查更新
   */
  async checkForUpdate(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      await this.registration.update();
      return this._state.updateAvailable;
    } catch (error) {
      console.error('[SWManager] Update check failed:', error);
      return false;
    }
  }

  /**
   * 应用更新 (刷新页面)
   */
  applyUpdate(): void {
    if (this._state.updateAvailable) {
      window.location.reload();
    }
  }

  /**
   * 跳过等待，立即激活新版本
   */
  async skipWaiting(): Promise<void> {
    const waiting = this.registration?.waiting;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  /**
   * 请求推送通知权限
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('[SWManager] Notifications not supported');
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    console.log('[SWManager] Notification permission:', permission);
    return permission;
  }

  /**
   * 显示本地通知
   */
  async showNotification(title: string, options?: NotificationOptions): Promise<void> {
    if (Notification.permission !== 'granted') {
      console.warn('[SWManager] Notification permission not granted');
      return;
    }

    if (this.registration) {
      await this.registration.showNotification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        ...options,
      });
    }
  }

  /**
   * 注册后台同步
   */
  async registerSync(tag: string): Promise<boolean> {
    if (!this.registration || !('sync' in this.registration)) {
      console.warn('[SWManager] Background sync not supported');
      return false;
    }

    try {
      // @ts-ignore - sync API 类型定义可能不完整
      await this.registration.sync.register(tag);
      console.log('[SWManager] Sync registered:', tag);
      return true;
    } catch (error) {
      console.error('[SWManager] Sync registration failed:', error);
      return false;
    }
  }

  /**
   * 获取缓存状态
   */
  async getCacheInfo(): Promise<{ names: string[]; size: number }> {
    if (!('caches' in window)) {
      return { names: [], size: 0 };
    }

    const names = await caches.keys();
    let totalSize = 0;

    for (const name of names) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      
      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }

    return { names, size: totalSize };
  }

  /**
   * 清除所有缓存
   */
  async clearAllCaches(): Promise<void> {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    console.log('[SWManager] All caches cleared');
  }

  /**
   * 订阅状态变化
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateCallbacks.add(callback);
    callback(this.state); // 立即回调当前状态
    
    return () => {
      this.stateCallbacks.delete(callback);
    };
  }

  private updateOfflineState(offline: boolean): void {
    if (this._state.offline !== offline) {
      this._state.offline = offline;
      console.log('[SWManager] Offline state:', offline);
      this.notifyStateChange();
    }
  }

  private notifyStateChange(): void {
    const state = this.state;
    this.stateCallbacks.forEach((cb) => cb(state));
  }

  /**
   * 注销 Service Worker
   */
  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    const success = await this.registration.unregister();
    if (success) {
      this._state.registered = false;
      this._state.active = false;
      this.registration = null;
      this.notifyStateChange();
    }
    return success;
  }
}

// 单例导出
export const serviceWorkerManager = new ServiceWorkerManager();
