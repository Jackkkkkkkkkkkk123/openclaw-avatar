/**
 * Vitest 测试设置
 */

// 模拟 requestAnimationFrame - 使用同步方式避免异步问题
const pendingAnimationFrames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;

global.requestAnimationFrame = (callback: FrameRequestCallback) => {
  const id = nextFrameId++;
  pendingAnimationFrames.set(id, callback);
  // 使用 setImmediate 或 queueMicrotask 代替 setTimeout，更好地配合 fake timers
  const timeoutId = setTimeout(() => {
    if (pendingAnimationFrames.has(id)) {
      pendingAnimationFrames.delete(id);
      callback(Date.now());
    }
  }, 16);
  // 存储 timeoutId 用于取消
  (global as any).__rafTimeouts = (global as any).__rafTimeouts || new Map();
  (global as any).__rafTimeouts.set(id, timeoutId);
  return id;
};

global.cancelAnimationFrame = (id: number) => {
  pendingAnimationFrames.delete(id);
  const timeouts = (global as any).__rafTimeouts;
  if (timeouts && timeouts.has(id)) {
    clearTimeout(timeouts.get(id));
    timeouts.delete(id);
  }
};

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
