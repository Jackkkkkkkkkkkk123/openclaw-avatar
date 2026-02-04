/**
 * Vitest 测试全局设置
 * 设置浏览器 API 模拟
 */
import { vi } from 'vitest';

// 确保 requestAnimationFrame 存在
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16) as unknown as number);
}
if (typeof globalThis.cancelAnimationFrame === 'undefined') {
  globalThis.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));
}

// Mock AudioContext
class MockAnalyserNode {
  fftSize = 256;
  frequencyBinCount = 128;
  smoothingTimeConstant = 0.8;
  getByteFrequencyData = vi.fn((array: Uint8Array) => {
    // 模拟音频数据
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 50);
    }
  });
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockMediaStreamSource {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioContext {
  state: AudioContextState = 'running';
  sampleRate = 44100;
  
  createAnalyser = vi.fn(() => new MockAnalyserNode());
  createMediaStreamSource = vi.fn(() => new MockMediaStreamSource());
  createGain = vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  close = vi.fn().mockResolvedValue(undefined);
  resume = vi.fn().mockResolvedValue(undefined);
  suspend = vi.fn().mockResolvedValue(undefined);
}

// Mock SpeechRecognition
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  maxAlternatives = 1;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  onaudiostart: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  onspeechend: (() => void) | null = null;
  
  private isRunning = false;

  start() {
    if (this.isRunning) throw new Error('Already running');
    this.isRunning = true;
    setTimeout(() => {
      this.onstart?.();
    }, 0);
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    setTimeout(() => {
      this.onend?.();
    }, 0);
  }

  abort() {
    this.isRunning = false;
    this.onend?.();
  }
}

// Mock MediaDevices
const mockMediaStream = {
  getTracks: () => [{ stop: vi.fn() }],
  getAudioTracks: () => [{ stop: vi.fn() }],
  getVideoTracks: () => [{ stop: vi.fn() }],
};

// 设置全局模拟
if (typeof window !== 'undefined') {
  // AudioContext
  (window as any).AudioContext = MockAudioContext;
  (window as any).webkitAudioContext = MockAudioContext;
  
  // SpeechRecognition
  (window as any).SpeechRecognition = MockSpeechRecognition;
  (window as any).webkitSpeechRecognition = MockSpeechRecognition;
  
  // MediaDevices
  if (!navigator.mediaDevices) {
    (navigator as any).mediaDevices = {};
  }
  navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockMediaStream);
  
  // requestAnimationFrame
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
  }
  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));
  }
  
  // localStorage
  const storage: Record<string, string> = {};
  if (!window.localStorage) {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => storage[key] || null),
        setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
        removeItem: vi.fn((key: string) => { delete storage[key]; }),
        clear: vi.fn(() => { Object.keys(storage).forEach(k => delete storage[k]); }),
        key: vi.fn((i: number) => Object.keys(storage)[i] || null),
        get length() { return Object.keys(storage).length; },
      },
      writable: true,
    });
  }
  
  // WebSocket
  if (!(window as any).WebSocket) {
    (window as any).WebSocket = class MockWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      
      readonly CONNECTING = 0;
      readonly OPEN = 1;
      readonly CLOSING = 2;
      readonly CLOSED = 3;
      
      readyState = 0;
      url: string;
      onopen: ((event: any) => void) | null = null;
      onclose: ((event: any) => void) | null = null;
      onmessage: ((event: any) => void) | null = null;
      onerror: ((event: any) => void) | null = null;
      
      constructor(url: string) {
        this.url = url;
        setTimeout(() => {
          this.readyState = 1;
          this.onopen?.({});
        }, 0);
      }
      
      send = vi.fn();
      close = vi.fn(() => {
        this.readyState = 3;
        this.onclose?.({ code: 1000, reason: '' });
      });
    };
  }
  
  // URL.createObjectURL / revokeObjectURL
  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = vi.fn();
  }
  
  // matchMedia
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
}

// 导出 mock 类以便测试中使用
export { MockAudioContext, MockSpeechRecognition, MockAnalyserNode };
