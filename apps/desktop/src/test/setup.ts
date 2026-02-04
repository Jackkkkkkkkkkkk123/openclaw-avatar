/**
 * Vitest 测试设置
 */

// 模拟 requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback) => {
  return setTimeout(() => callback(Date.now()), 16) as unknown as number;
};

global.cancelAnimationFrame = (id: number) => {
  clearTimeout(id);
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
