/**
 * ServiceWorkerManager 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock navigator.serviceWorker
const mockServiceWorkerRegistration = {
  scope: '/',
  active: { state: 'activated' },
  installing: null,
  waiting: null,
  update: vi.fn().mockResolvedValue(undefined),
  unregister: vi.fn().mockResolvedValue(true),
  addEventListener: vi.fn(),
  showNotification: vi.fn().mockResolvedValue(undefined),
};

const mockServiceWorker = {
  register: vi.fn().mockResolvedValue(mockServiceWorkerRegistration),
  controller: {},
  addEventListener: vi.fn(),
};

describe('ServiceWorkerManager', () => {
  let ServiceWorkerManager: any;
  let serviceWorkerManager: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: mockServiceWorker,
      writable: true,
      configurable: true,
    });

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });

    // Mock window events
    vi.spyOn(window, 'addEventListener').mockImplementation(() => {});
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});

    // Mock caches
    const mockCache = {
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
      keys: vi.fn().mockResolvedValue([]),
    };
    
    Object.defineProperty(window, 'caches', {
      value: {
        open: vi.fn().mockResolvedValue(mockCache),
        keys: vi.fn().mockResolvedValue(['test-cache']),
        delete: vi.fn().mockResolvedValue(true),
      },
      writable: true,
      configurable: true,
    });

    // Dynamic import to get fresh instance
    const module = await import('./ServiceWorkerManager');
    ServiceWorkerManager = module.serviceWorkerManager.constructor;
    serviceWorkerManager = new ServiceWorkerManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('初始化', () => {
    it('应该检测 Service Worker 支持', () => {
      expect(serviceWorkerManager.state.supported).toBe(true);
    });

    it('应该检测在线状态', () => {
      expect(serviceWorkerManager.state.offline).toBe(false);
    });

    it('初始状态应该是未注册', () => {
      expect(serviceWorkerManager.state.registered).toBe(false);
      expect(serviceWorkerManager.state.active).toBe(false);
    });
  });

  describe('注册', () => {
    it('应该能注册 Service Worker', async () => {
      const success = await serviceWorkerManager.register();
      
      expect(success).toBe(true);
      expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
      expect(serviceWorkerManager.state.registered).toBe(true);
    });

    it('注册失败应该返回 false', async () => {
      mockServiceWorker.register.mockRejectedValueOnce(new Error('Failed'));
      
      const success = await serviceWorkerManager.register();
      
      expect(success).toBe(false);
      expect(serviceWorkerManager.state.registered).toBe(false);
    });

    it('不支持时应该返回 false', async () => {
      // @ts-ignore
      delete navigator.serviceWorker;
      const manager = new ServiceWorkerManager();
      
      const success = await manager.register();
      
      expect(success).toBe(false);
    });
  });

  describe('更新检查', () => {
    it('未注册时应该返回 false', async () => {
      const hasUpdate = await serviceWorkerManager.checkForUpdate();
      
      expect(hasUpdate).toBe(false);
    });

    it('已注册时应该调用 update()', async () => {
      await serviceWorkerManager.register();
      
      const hasUpdate = await serviceWorkerManager.checkForUpdate();
      
      expect(mockServiceWorkerRegistration.update).toHaveBeenCalled();
      expect(hasUpdate).toBe(false); // 没有新版本
    });
  });

  describe('状态订阅', () => {
    it('应该能订阅状态变化', () => {
      const callback = vi.fn();
      
      const unsubscribe = serviceWorkerManager.onStateChange(callback);
      
      expect(callback).toHaveBeenCalledWith(serviceWorkerManager.state);
      expect(typeof unsubscribe).toBe('function');
    });

    it('取消订阅后不应该再收到回调', () => {
      const callback = vi.fn();
      
      const unsubscribe = serviceWorkerManager.onStateChange(callback);
      unsubscribe();
      
      // 第一次调用是订阅时立即触发的
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('多个订阅者应该都收到通知', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      serviceWorkerManager.onStateChange(callback1);
      serviceWorkerManager.onStateChange(callback2);
      
      // 注册会触发状态变化
      await serviceWorkerManager.register();
      
      // 初始回调 + 注册后回调
      expect(callback1).toHaveBeenCalledTimes(2);
      expect(callback2).toHaveBeenCalledTimes(2);
    });
  });

  describe('缓存管理', () => {
    it('应该能获取缓存信息', async () => {
      const info = await serviceWorkerManager.getCacheInfo();
      
      expect(info).toHaveProperty('names');
      expect(info).toHaveProperty('size');
      expect(Array.isArray(info.names)).toBe(true);
    });

    it('应该能清除所有缓存', async () => {
      await serviceWorkerManager.clearAllCaches();
      
      expect(window.caches.keys).toHaveBeenCalled();
      expect(window.caches.delete).toHaveBeenCalled();
    });
  });

  describe('通知', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'granted',
          requestPermission: vi.fn().mockResolvedValue('granted'),
        },
        writable: true,
        configurable: true,
      });
    });

    it('应该能请求通知权限', async () => {
      const permission = await serviceWorkerManager.requestNotificationPermission();
      
      expect(permission).toBe('granted');
    });

    it('应该能显示通知', async () => {
      await serviceWorkerManager.register();
      await serviceWorkerManager.showNotification('测试标题', { body: '测试内容' });
      
      expect(mockServiceWorkerRegistration.showNotification).toHaveBeenCalledWith(
        '测试标题',
        expect.objectContaining({ body: '测试内容' })
      );
    });

    it('无权限时不应该显示通知', async () => {
      Object.defineProperty(window.Notification, 'permission', {
        value: 'denied',
        configurable: true,
      });
      
      await serviceWorkerManager.register();
      await serviceWorkerManager.showNotification('测试');
      
      expect(mockServiceWorkerRegistration.showNotification).not.toHaveBeenCalled();
    });
  });

  describe('注销', () => {
    it('未注册时应该返回 false', async () => {
      const success = await serviceWorkerManager.unregister();
      
      expect(success).toBe(false);
    });

    it('已注册时应该能注销', async () => {
      await serviceWorkerManager.register();
      
      const success = await serviceWorkerManager.unregister();
      
      expect(success).toBe(true);
      expect(mockServiceWorkerRegistration.unregister).toHaveBeenCalled();
      expect(serviceWorkerManager.state.registered).toBe(false);
    });
  });

  describe('后台同步', () => {
    it('不支持时应该返回 false', async () => {
      await serviceWorkerManager.register();
      
      const success = await serviceWorkerManager.registerSync('test-sync');
      
      expect(success).toBe(false);
    });

    it('支持时应该注册同步', async () => {
      // Mock sync API
      const mockSync = {
        register: vi.fn().mockResolvedValue(undefined),
      };
      mockServiceWorkerRegistration.sync = mockSync;
      
      await serviceWorkerManager.register();
      const success = await serviceWorkerManager.registerSync('test-sync');
      
      expect(success).toBe(true);
      expect(mockSync.register).toHaveBeenCalledWith('test-sync');
    });
  });

  describe('应用更新', () => {
    it('没有更新时不应该刷新', () => {
      const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
      
      serviceWorkerManager.applyUpdate();
      
      expect(reloadSpy).not.toHaveBeenCalled();
    });
  });

  describe('跳过等待', () => {
    it('有等待中的 worker 时应该发送消息', async () => {
      const waitingWorker = {
        postMessage: vi.fn(),
      };
      mockServiceWorkerRegistration.waiting = waitingWorker;
      
      await serviceWorkerManager.register();
      await serviceWorkerManager.skipWaiting();
      
      expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    });

    it('没有等待中的 worker 时应该什么都不做', async () => {
      mockServiceWorkerRegistration.waiting = null;
      
      await serviceWorkerManager.register();
      await serviceWorkerManager.skipWaiting();
      
      // 没有抛出错误就是成功
    });
  });
});
