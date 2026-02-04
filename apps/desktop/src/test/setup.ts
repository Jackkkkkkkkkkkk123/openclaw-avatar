/**
 * Vitest 测试设置
 * 
 * 为测试环境提供浏览器 API 的 mock 实现
 */

import { afterEach, beforeEach } from 'vitest';

// ========== requestAnimationFrame Mock ==========
// 使用 Map 追踪所有 pending 的 animation frames
const pendingAnimationFrames = new Map<number, { callback: FrameRequestCallback; timeoutId: ReturnType<typeof setTimeout> }>();
let nextFrameId = 1;

/**
 * 清理所有 pending 的 animation frames
 * 在每个测试后调用，防止回调泄漏到下一个测试
 */
function clearAllAnimationFrames() {
  for (const [id, frame] of pendingAnimationFrames) {
    clearTimeout(frame.timeoutId);
  }
  pendingAnimationFrames.clear();
  nextFrameId = 1;
}

global.requestAnimationFrame = (callback: FrameRequestCallback): number => {
  const id = nextFrameId++;
  
  // 使用 setTimeout 模拟 ~60fps 的帧间隔
  const timeoutId = setTimeout(() => {
    // 确保回调仍然在 pending 列表中（未被取消）
    if (pendingAnimationFrames.has(id)) {
      pendingAnimationFrames.delete(id);
      try {
        callback(performance.now());
      } catch (error) {
        // 忽略回调中的错误，防止影响其他测试
        console.warn('[RAF Mock] Callback error:', error);
      }
    }
  }, 16);
  
  pendingAnimationFrames.set(id, { callback, timeoutId });
  return id;
};

global.cancelAnimationFrame = (id: number): void => {
  const frame = pendingAnimationFrames.get(id);
  if (frame) {
    clearTimeout(frame.timeoutId);
    pendingAnimationFrames.delete(id);
  }
};

// 每个测试后清理 animation frames
afterEach(() => {
  clearAllAnimationFrames();
});

// 模拟 AudioContext
class MockAudioContext {
  createAnalyser() {
    return {
      fftSize: 256,
      frequencyBinCount: 128,
      getByteFrequencyData: (array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = 0;
        }
      },
      connect: () => {},
      disconnect: () => {},
    };
  }
  createMediaElementSource() {
    return { connect: () => {} };
  }
  close() {}
}

global.AudioContext = MockAudioContext as any;

// 模拟 HTMLMediaElement play/pause
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: () => Promise.resolve(),
});

Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: () => {},
});

// 模拟 console.debug 避免测试输出污染
const originalDebug = console.debug;
console.debug = () => {};

// 测试后恢复
afterAll(() => {
  console.debug = originalDebug;
});
