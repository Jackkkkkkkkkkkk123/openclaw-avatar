/**
 * GestureRecognitionService - 手势识别服务
 * 使用 MediaPipe Hands 识别手势，支持交互控制
 */

export type GestureType =
  | 'none'
  | 'open_palm'      // 张开手掌 - 打招呼
  | 'fist'           // 握拳 - 停止
  | 'thumbs_up'      // 竖起大拇指 - 赞同
  | 'thumbs_down'    // 大拇指向下 - 不赞同
  | 'peace'          // 剪刀手/V字 - 和平/胜利
  | 'pointing'       // 指向 - 指示方向
  | 'wave'           // 挥手 - 打招呼/再见
  | 'heart'          // 爱心手势 - 喜欢
  | 'ok'             // OK手势 - 确认
  | 'rock';          // 摇滚手势 - 兴奋

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandData {
  landmarks: HandLandmark[];
  handedness: 'Left' | 'Right';
  score: number;
}

export interface GestureResult {
  gesture: GestureType;
  confidence: number;
  hand: 'left' | 'right' | 'both';
  position: { x: number; y: number };
  timestamp: number;
}

export interface GestureConfig {
  minConfidence: number;
  gestureHoldTime: number;  // 手势需要保持的时间 (ms)
  cooldownTime: number;     // 同一手势的冷却时间 (ms)
  maxHands: number;
  enableWaveDetection: boolean;
}

type GestureCallback = (result: GestureResult) => void;

// 手指关键点索引
const FINGER_TIPS = [4, 8, 12, 16, 20];  // 拇指、食指、中指、无名指、小指指尖
const FINGER_PIPS = [3, 6, 10, 14, 18];  // 第二关节
const FINGER_MCPS = [2, 5, 9, 13, 17];   // 第一关节
const WRIST = 0;

export class GestureRecognitionService {
  private static instance: GestureRecognitionService | null = null;
  
  private hands: any = null;
  private camera: any = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  
  private isInitialized = false;
  private isRunning = false;
  private callbacks: Set<GestureCallback> = new Set();
  
  private config: GestureConfig = {
    minConfidence: 0.7,
    gestureHoldTime: 300,
    cooldownTime: 1000,
    maxHands: 2,
    enableWaveDetection: true
  };
  
  // 手势状态追踪
  private lastGestures: Map<string, { gesture: GestureType; startTime: number; triggered: boolean }> = new Map();
  private gestureCooldowns: Map<GestureType, number> = new Map();
  
  // 挥手检测状态
  private waveHistory: { x: number; time: number }[] = [];
  private lastWaveTime = 0;

  static getInstance(): GestureRecognitionService {
    if (!GestureRecognitionService.instance) {
      GestureRecognitionService.instance = new GestureRecognitionService();
    }
    return GestureRecognitionService.instance;
  }

  static isSupported(): boolean {
    return !!(
      typeof window !== 'undefined' &&
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    );
  }

  async init(videoElement?: HTMLVideoElement): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // 动态导入 MediaPipe Hands
      const { Hands } = await import('@mediapipe/hands');
      const { Camera } = await import('@mediapipe/camera_utils');

      // 创建或使用提供的视频元素
      if (videoElement) {
        this.videoElement = videoElement;
      } else {
        this.videoElement = document.createElement('video');
        this.videoElement.style.display = 'none';
        document.body.appendChild(this.videoElement);
      }

      // 创建canvas用于调试绘制
      this.canvasElement = document.createElement('canvas');
      this.canvasElement.width = 640;
      this.canvasElement.height = 480;
      this.canvasCtx = this.canvasElement.getContext('2d');

      // 初始化 MediaPipe Hands
      this.hands = new Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      this.hands.setOptions({
        maxNumHands: this.config.maxHands,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.hands.onResults((results: any) => this.processResults(results));

      // 初始化摄像头
      this.camera = new Camera(this.videoElement, {
        onFrame: async () => {
          if (this.hands && this.videoElement) {
            await this.hands.send({ image: this.videoElement });
          }
        },
        width: 640,
        height: 480
      });

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('[GestureRecognition] Init failed:', error);
      return false;
    }
  }

  async start(): Promise<boolean> {
    if (!this.isInitialized) {
      const success = await this.init();
      if (!success) return false;
    }

    if (this.isRunning) return true;

    try {
      await this.camera?.start();
      this.isRunning = true;
      return true;
    } catch (error) {
      console.error('[GestureRecognition] Start failed:', error);
      return false;
    }
  }

  stop(): void {
    if (!this.isRunning) return;
    
    this.camera?.stop();
    this.isRunning = false;
    this.waveHistory = [];
  }

  destroy(): void {
    this.stop();
    
    if (this.videoElement && !this.videoElement.parentElement) {
      this.videoElement.remove();
    }
    
    this.hands = null;
    this.camera = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.canvasCtx = null;
    this.callbacks.clear();
    this.lastGestures.clear();
    this.gestureCooldowns.clear();
    this.isInitialized = false;
    
    GestureRecognitionService.instance = null;
  }

  onGesture(callback: GestureCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  setConfig(config: Partial<GestureConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): GestureConfig {
    return { ...this.config };
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvasElement;
  }

  private processResults(results: any): void {
    if (!results.multiHandLandmarks || !results.multiHandedness) return;

    const now = Date.now();

    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const landmarks = results.multiHandLandmarks[i];
      const handedness = results.multiHandedness[i];
      
      const handData: HandData = {
        landmarks: landmarks.map((l: any) => ({ x: l.x, y: l.y, z: l.z })),
        handedness: handedness.label,
        score: handedness.score
      };

      // 识别手势
      const gesture = this.recognizeGesture(handData);
      
      if (gesture !== 'none' && handData.score >= this.config.minConfidence) {
        const handKey = handedness.label.toLowerCase();
        const lastState = this.lastGestures.get(handKey);

        // 检查是否是新手势或手势改变
        if (!lastState || lastState.gesture !== gesture) {
          this.lastGestures.set(handKey, {
            gesture,
            startTime: now,
            triggered: false
          });
        } else if (!lastState.triggered) {
          // 检查手势保持时间
          if (now - lastState.startTime >= this.config.gestureHoldTime) {
            // 检查冷却时间
            const cooldownEnd = this.gestureCooldowns.get(gesture) || 0;
            if (now >= cooldownEnd) {
              this.triggerGesture(gesture, handData, now);
              lastState.triggered = true;
              this.gestureCooldowns.set(gesture, now + this.config.cooldownTime);
            }
          }
        }
      }
    }

    // 挥手检测 (需要追踪手掌位置变化)
    if (this.config.enableWaveDetection && results.multiHandLandmarks.length > 0) {
      this.detectWave(results.multiHandLandmarks[0], now);
    }
  }

  private recognizeGesture(handData: HandData): GestureType {
    const landmarks = handData.landmarks;
    
    // 计算手指状态
    const fingerStates = this.getFingerStates(landmarks);
    const [thumb, index, middle, ring, pinky] = fingerStates;

    // 张开手掌 - 所有手指伸展
    if (thumb && index && middle && ring && pinky) {
      return 'open_palm';
    }

    // 握拳 - 所有手指弯曲
    if (!thumb && !index && !middle && !ring && !pinky) {
      return 'fist';
    }

    // 竖起大拇指
    if (thumb && !index && !middle && !ring && !pinky) {
      // 检查大拇指方向
      const thumbTip = landmarks[FINGER_TIPS[0]];
      const thumbMcp = landmarks[FINGER_MCPS[0]];
      if (thumbTip.y < thumbMcp.y - 0.1) {
        return 'thumbs_up';
      } else if (thumbTip.y > thumbMcp.y + 0.1) {
        return 'thumbs_down';
      }
    }

    // 剪刀手/V字 - 食指和中指伸展
    if (!thumb && index && middle && !ring && !pinky) {
      return 'peace';
    }

    // 指向 - 只有食指伸展
    if (!thumb && index && !middle && !ring && !pinky) {
      return 'pointing';
    }

    // OK手势 - 大拇指和食指形成圆圈
    if (this.isOkGesture(landmarks)) {
      return 'ok';
    }

    // 摇滚手势 - 食指和小指伸展
    if (!thumb && index && !middle && !ring && pinky) {
      return 'rock';
    }

    // 爱心手势 (双手需要特殊处理，这里简化为单手)
    // 暂不实现，需要双手配合

    return 'none';
  }

  private getFingerStates(landmarks: HandLandmark[]): boolean[] {
    const states: boolean[] = [];

    // 大拇指 - 特殊处理，比较 x 坐标
    const thumbTip = landmarks[FINGER_TIPS[0]];
    const thumbIp = landmarks[3]; // IP关节
    const thumbMcp = landmarks[FINGER_MCPS[0]];
    
    // 判断是左手还是右手（通过手腕和中指MCP的位置关系）
    const wrist = landmarks[WRIST];
    const middleMcp = landmarks[FINGER_MCPS[2]];
    const isRightHand = middleMcp.x < wrist.x;
    
    if (isRightHand) {
      states.push(thumbTip.x < thumbIp.x);
    } else {
      states.push(thumbTip.x > thumbIp.x);
    }

    // 其他四指 - 比较指尖和第二关节的 y 坐标
    for (let i = 1; i < 5; i++) {
      const tip = landmarks[FINGER_TIPS[i]];
      const pip = landmarks[FINGER_PIPS[i]];
      states.push(tip.y < pip.y);
    }

    return states;
  }

  private isOkGesture(landmarks: HandLandmark[]): boolean {
    const thumbTip = landmarks[FINGER_TIPS[0]];
    const indexTip = landmarks[FINGER_TIPS[1]];
    
    // 大拇指和食指指尖距离很近
    const distance = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) +
      Math.pow(thumbTip.y - indexTip.y, 2)
    );

    // 其他手指应该伸展
    const fingerStates = this.getFingerStates(landmarks);
    const [, , middle, ring, pinky] = fingerStates;

    return distance < 0.08 && middle && ring && pinky;
  }

  private detectWave(landmarks: HandLandmark[], now: number): void {
    const wrist = landmarks[WRIST];
    
    // 记录手腕位置历史
    this.waveHistory.push({ x: wrist.x, time: now });
    
    // 只保留最近500ms的数据
    this.waveHistory = this.waveHistory.filter(p => now - p.time < 500);
    
    if (this.waveHistory.length < 5) return;

    // 检测左右摆动
    let directionChanges = 0;
    let lastDirection = 0;
    
    for (let i = 1; i < this.waveHistory.length; i++) {
      const dx = this.waveHistory[i].x - this.waveHistory[i - 1].x;
      const direction = dx > 0.01 ? 1 : dx < -0.01 ? -1 : lastDirection;
      
      if (direction !== 0 && direction !== lastDirection && lastDirection !== 0) {
        directionChanges++;
      }
      lastDirection = direction;
    }

    // 2次以上方向变化视为挥手
    if (directionChanges >= 2 && now - this.lastWaveTime > this.config.cooldownTime) {
      const handData: HandData = {
        landmarks: landmarks,
        handedness: 'Right',
        score: 0.9
      };
      
      this.triggerGesture('wave', handData, now);
      this.lastWaveTime = now;
      this.waveHistory = [];
    }
  }

  private triggerGesture(gesture: GestureType, handData: HandData, timestamp: number): void {
    const wrist = handData.landmarks[WRIST];
    
    const result: GestureResult = {
      gesture,
      confidence: handData.score,
      hand: handData.handedness.toLowerCase() as 'left' | 'right',
      position: { x: wrist.x, y: wrist.y },
      timestamp
    };

    this.callbacks.forEach(cb => {
      try {
        cb(result);
      } catch (error) {
        console.error('[GestureRecognition] Callback error:', error);
      }
    });
  }

  // 公开的手势识别方法，用于测试
  recognizeFromLandmarks(landmarks: HandLandmark[]): GestureType {
    const handData: HandData = {
      landmarks,
      handedness: 'Right',
      score: 1.0
    };
    return this.recognizeGesture(handData);
  }
}

export const gestureRecognitionService = GestureRecognitionService.getInstance();
