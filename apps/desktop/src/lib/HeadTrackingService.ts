/**
 * HeadTrackingService - 摄像头头部追踪
 * 
 * 使用 MediaPipe Face Mesh 追踪用户头部位置和表情
 * 让 Avatar 跟随用户的头部移动和表情
 */

export interface HeadPose {
  // 头部位置 (归一化到 -1 ~ 1)
  x: number;      // 左右 (-1 = 左, 1 = 右)
  y: number;      // 上下 (-1 = 下, 1 = 上)
  z: number;      // 前后 (0 = 正常, 负 = 靠近)
  
  // 头部旋转 (弧度)
  pitch: number;  // 点头
  yaw: number;    // 摇头
  roll: number;   // 歪头
}

export interface FaceExpression {
  // 眼睛
  leftEyeOpen: number;   // 0-1
  rightEyeOpen: number;  // 0-1
  eyebrowRaise: number;  // 0-1
  
  // 嘴巴
  mouthOpen: number;     // 0-1
  mouthSmile: number;    // 0-1 (嘴角上扬)
  
  // 检测到的情绪
  detectedEmotion: 'neutral' | 'happy' | 'sad' | 'surprised' | 'angry' | null;
}

export interface TrackingData {
  pose: HeadPose;
  expression: FaceExpression;
  confidence: number;
  timestamp: number;
}

type TrackingCallback = (data: TrackingData) => void;

// Face Mesh 关键点索引
const LANDMARKS = {
  // 眼睛
  LEFT_EYE_TOP: 159,
  LEFT_EYE_BOTTOM: 145,
  RIGHT_EYE_TOP: 386,
  RIGHT_EYE_BOTTOM: 374,
  
  // 眉毛
  LEFT_EYEBROW: 105,
  RIGHT_EYEBROW: 334,
  
  // 嘴巴
  MOUTH_TOP: 13,
  MOUTH_BOTTOM: 14,
  MOUTH_LEFT: 61,
  MOUTH_RIGHT: 291,
  
  // 鼻子 (用于头部位置)
  NOSE_TIP: 1,
  
  // 头部方向参考点
  FOREHEAD: 10,
  CHIN: 152,
  LEFT_CHEEK: 234,
  RIGHT_CHEEK: 454,
};

export class HeadTrackingService {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private faceMesh: any = null;
  private camera: any = null;
  
  private isRunning = false;
  private callbacks: Set<TrackingCallback> = new Set();
  private lastData: TrackingData | null = null;
  
  // 平滑参数
  private smoothingFactor = 0.3;
  private smoothedPose: HeadPose = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
  private smoothedExpression: FaceExpression = {
    leftEyeOpen: 1,
    rightEyeOpen: 1,
    eyebrowRaise: 0,
    mouthOpen: 0,
    mouthSmile: 0,
    detectedEmotion: 'neutral',
  };
  
  // 镜像模式 (默认镜像，更自然)
  private mirrorMode = true;
  
  // 敏感度设置
  private sensitivity = {
    position: 1.5,  // 位置敏感度
    rotation: 1.2,  // 旋转敏感度
    expression: 1.0, // 表情敏感度
  };
  
  constructor() {
    console.log('[HeadTracking] 头部追踪服务初始化');
  }
  
  /**
   * 检查是否支持摄像头追踪
   */
  static async isSupported(): Promise<boolean> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false;
    }
    
    try {
      // 检查是否有摄像头权限
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(d => d.kind === 'videoinput');
    } catch {
      return false;
    }
  }
  
  /**
   * 初始化追踪系统
   */
  async init(): Promise<void> {
    console.log('[HeadTracking] 初始化中...');
    
    // 创建隐藏的 video 元素
    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', '');
    this.video.style.position = 'absolute';
    this.video.style.top = '-9999px';
    this.video.style.left = '-9999px';
    document.body.appendChild(this.video);
    
    // 创建 canvas 用于处理
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 480;
    this.ctx = this.canvas.getContext('2d');
    
    // 动态加载 MediaPipe
    await this.loadMediaPipe();
    
    console.log('[HeadTracking] 初始化完成');
  }
  
  /**
   * 动态加载 MediaPipe Face Mesh
   */
  private async loadMediaPipe(): Promise<void> {
    // 检查是否已加载
    if ((window as any).FaceMesh) {
      await this.setupFaceMesh();
      return;
    }
    
    // 加载 MediaPipe 脚本
    await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
    await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');
    
    await this.setupFaceMesh();
  }
  
  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // 检查是否已加载
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }
  
  private async setupFaceMesh(): Promise<void> {
    const FaceMesh = (window as any).FaceMesh;
    if (!FaceMesh) {
      throw new Error('MediaPipe FaceMesh not loaded');
    }
    
    this.faceMesh = new FaceMesh({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });
    
    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    
    this.faceMesh.onResults((results: any) => this.onResults(results));
    
    console.log('[HeadTracking] MediaPipe FaceMesh 已配置');
  }
  
  /**
   * 开始追踪
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    console.log('[HeadTracking] 启动摄像头...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        }
      });
      
      this.video!.srcObject = stream;
      await this.video!.play();
      
      this.isRunning = true;
      
      // 使用 MediaPipe Camera Utils 或手动循环
      const Camera = (window as any).Camera;
      if (Camera) {
        this.camera = new Camera(this.video, {
          onFrame: async () => {
            if (this.faceMesh && this.isRunning) {
              await this.faceMesh.send({ image: this.video });
            }
          },
          width: 640,
          height: 480,
        });
        await this.camera.start();
      } else {
        // 手动帧循环
        this.runLoop();
      }
      
      console.log('[HeadTracking] ✅ 追踪已启动');
    } catch (err) {
      console.error('[HeadTracking] 启动失败:', err);
      throw err;
    }
  }
  
  private runLoop = async () => {
    if (!this.isRunning) return;
    
    if (this.faceMesh && this.video) {
      await this.faceMesh.send({ image: this.video });
    }
    
    requestAnimationFrame(this.runLoop);
  };
  
  /**
   * 停止追踪
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.camera) {
      this.camera.stop();
      this.camera = null;
    }
    
    if (this.video?.srcObject) {
      const tracks = (this.video.srcObject as MediaStream).getTracks();
      tracks.forEach(t => t.stop());
      this.video.srcObject = null;
    }
    
    console.log('[HeadTracking] 追踪已停止');
  }
  
  /**
   * 处理 FaceMesh 结果
   */
  private onResults(results: any): void {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      // 没有检测到人脸
      return;
    }
    
    const landmarks = results.multiFaceLandmarks[0];
    
    // 计算头部姿态
    const pose = this.calculateHeadPose(landmarks);
    
    // 计算表情
    const expression = this.calculateExpression(landmarks);
    
    // 应用平滑
    this.applySmoothing(pose, expression);
    
    // 创建追踪数据
    const data: TrackingData = {
      pose: { ...this.smoothedPose },
      expression: { ...this.smoothedExpression },
      confidence: 1.0,
      timestamp: Date.now(),
    };
    
    this.lastData = data;
    
    // 通知回调
    this.callbacks.forEach(cb => cb(data));
  }
  
  /**
   * 计算头部姿态
   */
  private calculateHeadPose(landmarks: any[]): HeadPose {
    const nose = landmarks[LANDMARKS.NOSE_TIP];
    const forehead = landmarks[LANDMARKS.FOREHEAD];
    const chin = landmarks[LANDMARKS.CHIN];
    const leftCheek = landmarks[LANDMARKS.LEFT_CHEEK];
    const rightCheek = landmarks[LANDMARKS.RIGHT_CHEEK];
    
    // 位置 (归一化到 -1 ~ 1)
    let x = (nose.x - 0.5) * 2 * this.sensitivity.position;
    const y = -(nose.y - 0.5) * 2 * this.sensitivity.position; // Y 轴翻转
    const z = nose.z * this.sensitivity.position;
    
    // 镜像模式
    if (this.mirrorMode) {
      x = -x;
    }
    
    // 计算旋转
    const yaw = Math.atan2(rightCheek.z - leftCheek.z, rightCheek.x - leftCheek.x) * this.sensitivity.rotation;
    const pitch = Math.atan2(chin.z - forehead.z, chin.y - forehead.y) * this.sensitivity.rotation;
    const roll = Math.atan2(rightCheek.y - leftCheek.y, rightCheek.x - leftCheek.x) * this.sensitivity.rotation;
    
    return {
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
      z: Math.max(-1, Math.min(1, z)),
      pitch,
      yaw: this.mirrorMode ? -yaw : yaw,
      roll: this.mirrorMode ? -roll : roll,
    };
  }
  
  /**
   * 计算表情
   */
  private calculateExpression(landmarks: any[]): FaceExpression {
    // 眼睛开合度
    const leftEyeTop = landmarks[LANDMARKS.LEFT_EYE_TOP];
    const leftEyeBottom = landmarks[LANDMARKS.LEFT_EYE_BOTTOM];
    const rightEyeTop = landmarks[LANDMARKS.RIGHT_EYE_TOP];
    const rightEyeBottom = landmarks[LANDMARKS.RIGHT_EYE_BOTTOM];
    
    const leftEyeOpen = Math.min(1, Math.max(0, 
      (Math.abs(leftEyeTop.y - leftEyeBottom.y) * 30) * this.sensitivity.expression
    ));
    const rightEyeOpen = Math.min(1, Math.max(0,
      (Math.abs(rightEyeTop.y - rightEyeBottom.y) * 30) * this.sensitivity.expression
    ));
    
    // 眉毛
    const leftEyebrow = landmarks[LANDMARKS.LEFT_EYEBROW];
    const rightEyebrow = landmarks[LANDMARKS.RIGHT_EYEBROW];
    const eyebrowRaise = Math.min(1, Math.max(0,
      (0.5 - (leftEyebrow.y + rightEyebrow.y) / 2) * 4
    ));
    
    // 嘴巴
    const mouthTop = landmarks[LANDMARKS.MOUTH_TOP];
    const mouthBottom = landmarks[LANDMARKS.MOUTH_BOTTOM];
    const mouthLeft = landmarks[LANDMARKS.MOUTH_LEFT];
    const mouthRight = landmarks[LANDMARKS.MOUTH_RIGHT];
    
    const mouthOpen = Math.min(1, Math.max(0,
      Math.abs(mouthTop.y - mouthBottom.y) * 10 * this.sensitivity.expression
    ));
    
    // 嘴角上扬 (简化计算)
    const mouthWidth = Math.abs(mouthRight.x - mouthLeft.x);
    const mouthHeight = Math.abs(mouthTop.y - mouthBottom.y);
    const mouthSmile = Math.min(1, Math.max(0,
      (mouthWidth / Math.max(0.01, mouthHeight) - 2) * 0.3
    ));
    
    // 检测情绪
    let detectedEmotion: FaceExpression['detectedEmotion'] = 'neutral';
    if (mouthSmile > 0.5 && eyebrowRaise < 0.3) {
      detectedEmotion = 'happy';
    } else if (eyebrowRaise > 0.6 && mouthOpen > 0.4) {
      detectedEmotion = 'surprised';
    } else if (leftEyeOpen < 0.3 || rightEyeOpen < 0.3) {
      // 眯眼可能是微笑或生气
      detectedEmotion = mouthSmile > 0.3 ? 'happy' : 'neutral';
    }
    
    return {
      leftEyeOpen,
      rightEyeOpen,
      eyebrowRaise,
      mouthOpen,
      mouthSmile,
      detectedEmotion,
    };
  }
  
  /**
   * 应用平滑
   */
  private applySmoothing(pose: HeadPose, expression: FaceExpression): void {
    const f = this.smoothingFactor;
    
    // 平滑位置
    this.smoothedPose.x = this.smoothedPose.x * (1 - f) + pose.x * f;
    this.smoothedPose.y = this.smoothedPose.y * (1 - f) + pose.y * f;
    this.smoothedPose.z = this.smoothedPose.z * (1 - f) + pose.z * f;
    this.smoothedPose.pitch = this.smoothedPose.pitch * (1 - f) + pose.pitch * f;
    this.smoothedPose.yaw = this.smoothedPose.yaw * (1 - f) + pose.yaw * f;
    this.smoothedPose.roll = this.smoothedPose.roll * (1 - f) + pose.roll * f;
    
    // 平滑表情
    this.smoothedExpression.leftEyeOpen = this.smoothedExpression.leftEyeOpen * (1 - f) + expression.leftEyeOpen * f;
    this.smoothedExpression.rightEyeOpen = this.smoothedExpression.rightEyeOpen * (1 - f) + expression.rightEyeOpen * f;
    this.smoothedExpression.eyebrowRaise = this.smoothedExpression.eyebrowRaise * (1 - f) + expression.eyebrowRaise * f;
    this.smoothedExpression.mouthOpen = this.smoothedExpression.mouthOpen * (1 - f) + expression.mouthOpen * f;
    this.smoothedExpression.mouthSmile = this.smoothedExpression.mouthSmile * (1 - f) + expression.mouthSmile * f;
    this.smoothedExpression.detectedEmotion = expression.detectedEmotion;
  }
  
  /**
   * 订阅追踪数据
   */
  onTracking(callback: TrackingCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }
  
  /**
   * 获取最新数据
   */
  getLastData(): TrackingData | null {
    return this.lastData;
  }
  
  /**
   * 设置平滑系数
   */
  setSmoothingFactor(factor: number): void {
    this.smoothingFactor = Math.max(0.1, Math.min(1, factor));
  }
  
  /**
   * 设置镜像模式
   */
  setMirrorMode(enabled: boolean): void {
    this.mirrorMode = enabled;
  }
  
  /**
   * 设置敏感度
   */
  setSensitivity(type: 'position' | 'rotation' | 'expression', value: number): void {
    this.sensitivity[type] = Math.max(0.1, Math.min(3, value));
  }
  
  /**
   * 是否正在运行
   */
  get running(): boolean {
    return this.isRunning;
  }
  
  /**
   * 销毁服务
   */
  destroy(): void {
    this.stop();
    
    if (this.video) {
      this.video.remove();
      this.video = null;
    }
    
    this.faceMesh = null;
    this.callbacks.clear();
    
    console.log('[HeadTracking] 服务已销毁');
  }
}

// 单例导出
export const headTrackingService = new HeadTrackingService();
