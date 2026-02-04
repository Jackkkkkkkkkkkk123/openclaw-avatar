/**
 * Avatar 截图 & 录制系统
 * 
 * SOTA Round 44: 核心用户功能
 * - 一键截图 Avatar 当前状态
 * - 录制 Avatar 动画为视频
 * - 支持多种导出格式
 * - GIF 动图导出
 * - 水印和品牌定制
 * 
 * 市场分析: HeyGen/Synthesia 核心功能
 */

export interface CaptureConfig {
  /** 输出宽度 (默认: Canvas 原始宽度) */
  width?: number;
  /** 输出高度 (默认: Canvas 原始高度) */
  height?: number;
  /** 图片格式 */
  imageFormat?: 'png' | 'jpeg' | 'webp';
  /** JPEG/WebP 质量 (0-1) */
  quality?: number;
  /** 视频格式 */
  videoFormat?: 'webm' | 'mp4';
  /** 视频比特率 (bps) */
  videoBitrate?: number;
  /** 帧率 */
  frameRate?: number;
  /** 是否包含音频 */
  includeAudio?: boolean;
  /** 水印配置 */
  watermark?: WatermarkConfig;
  /** 背景色 (用于 JPEG 导出) */
  backgroundColor?: string;
}

export interface WatermarkConfig {
  /** 水印文本 */
  text?: string;
  /** 水印图片 URL */
  imageUrl?: string;
  /** 位置 */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  /** 透明度 (0-1) */
  opacity?: number;
  /** 字体大小 */
  fontSize?: number;
  /** 字体颜色 */
  fontColor?: string;
  /** 边距 */
  margin?: number;
}

export interface CaptureResult {
  /** 数据 URL (base64) */
  dataUrl: string;
  /** Blob 对象 */
  blob: Blob;
  /** 文件名建议 */
  filename: string;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 时间戳 */
  timestamp: number;
}

export interface RecordingState {
  /** 是否正在录制 */
  isRecording: boolean;
  /** 录制时长 (ms) */
  duration: number;
  /** 已录制帧数 */
  frameCount: number;
  /** 录制开始时间 */
  startTime: number | null;
  /** 是否暂停 */
  isPaused: boolean;
  /** 文件大小估算 (bytes) */
  estimatedSize: number;
}

export interface RecordingResult {
  /** Blob 对象 */
  blob: Blob;
  /** 数据 URL */
  dataUrl: string;
  /** 文件名建议 */
  filename: string;
  /** 时长 (ms) */
  duration: number;
  /** 帧数 */
  frameCount: number;
  /** 格式 */
  format: string;
  /** 文件大小 */
  size: number;
}

export type RecordingStateCallback = (state: RecordingState) => void;

const DEFAULT_CONFIG: Required<CaptureConfig> = {
  width: 0,  // 0 表示使用 Canvas 原始尺寸
  height: 0,
  imageFormat: 'png',
  quality: 0.92,
  videoFormat: 'webm',
  videoBitrate: 5000000,  // 5 Mbps
  frameRate: 30,
  includeAudio: false,
  watermark: {},
  backgroundColor: '#ffffff',
};

/**
 * Avatar 截图 & 录制系统
 */
export class AvatarCaptureSystem {
  private canvas: HTMLCanvasElement | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private config: Required<CaptureConfig>;
  private recordingState: RecordingState = {
    isRecording: false,
    duration: 0,
    frameCount: 0,
    startTime: null,
    isPaused: false,
    estimatedSize: 0,
  };
  private stateCallbacks: Set<RecordingStateCallback> = new Set();
  private animationFrameId: number | null = null;
  private durationInterval: ReturnType<typeof setInterval> | null = null;
  private audioContext: AudioContext | null = null;
  private audioDestination: MediaStreamAudioDestinationNode | null = null;

  constructor(config?: Partial<CaptureConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 绑定 Canvas 元素
   */
  bindCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CaptureConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): Required<CaptureConfig> {
    return { ...this.config };
  }

  // ==================== 截图功能 ====================

  /**
   * 截图当前 Avatar 状态
   */
  async captureScreenshot(options?: Partial<CaptureConfig>): Promise<CaptureResult> {
    if (!this.canvas) {
      throw new Error('Canvas not bound. Call bindCanvas() first.');
    }

    const config = { ...this.config, ...options };
    
    // 创建临时 Canvas 用于处理
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }

    // 确定输出尺寸
    const width = config.width || this.canvas.width;
    const height = config.height || this.canvas.height;
    tempCanvas.width = width;
    tempCanvas.height = height;

    // 如果是 JPEG，填充背景色
    if (config.imageFormat === 'jpeg') {
      ctx.fillStyle = config.backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }

    // 绘制原始 Canvas 内容
    ctx.drawImage(this.canvas, 0, 0, width, height);

    // 添加水印
    if (config.watermark && (config.watermark.text || config.watermark.imageUrl)) {
      await this.applyWatermark(ctx, width, height, config.watermark);
    }

    // 导出
    const mimeType = this.getMimeType(config.imageFormat);
    const dataUrl = tempCanvas.toDataURL(mimeType, config.quality);
    const blob = await this.dataUrlToBlob(dataUrl);
    
    const timestamp = Date.now();
    const filename = this.generateFilename('screenshot', config.imageFormat, timestamp);

    return {
      dataUrl,
      blob,
      filename,
      width,
      height,
      timestamp,
    };
  }

  /**
   * 快速截图并下载
   */
  async captureAndDownload(options?: Partial<CaptureConfig>): Promise<void> {
    const result = await this.captureScreenshot(options);
    this.downloadBlob(result.blob, result.filename);
  }

  /**
   * 截图并复制到剪贴板
   */
  async captureAndCopy(options?: Partial<CaptureConfig>): Promise<boolean> {
    try {
      const result = await this.captureScreenshot({ ...options, imageFormat: 'png' });
      
      if (navigator.clipboard && 'write' in navigator.clipboard) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': result.blob,
          }),
        ]);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  // ==================== 录制功能 ====================

  /**
   * 开始录制
   */
  startRecording(options?: Partial<CaptureConfig>): void {
    if (!this.canvas) {
      throw new Error('Canvas not bound. Call bindCanvas() first.');
    }

    if (this.recordingState.isRecording) {
      console.warn('Already recording');
      return;
    }

    const config = { ...this.config, ...options };
    
    // 获取 Canvas 流
    const stream = this.canvas.captureStream(config.frameRate);

    // 如果需要音频，创建音频轨道
    if (config.includeAudio) {
      this.setupAudioCapture(stream);
    }

    // 确定 MIME 类型
    const mimeType = this.getVideoMimeType(config.videoFormat);
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      console.warn(`${mimeType} not supported, falling back to default`);
    }

    // 创建 MediaRecorder
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
      videoBitsPerSecond: config.videoBitrate,
    });

    this.recordedChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
        this.updateRecordingState({
          estimatedSize: this.recordedChunks.reduce((acc, chunk) => acc + chunk.size, 0),
        });
      }
    };

    this.mediaRecorder.onstop = () => {
      // 录制完成时的处理在 stopRecording 中进行
    };

    // 开始录制
    this.mediaRecorder.start(100);  // 每 100ms 产生一个数据块

    // 更新状态
    this.updateRecordingState({
      isRecording: true,
      duration: 0,
      frameCount: 0,
      startTime: Date.now(),
      isPaused: false,
      estimatedSize: 0,
    });

    // 启动时长计时器
    this.startDurationTimer();

    // 启动帧计数
    this.startFrameCounter();
  }

  /**
   * 暂停录制
   */
  pauseRecording(): void {
    if (!this.mediaRecorder || !this.recordingState.isRecording) {
      return;
    }

    if (this.recordingState.isPaused) {
      // 恢复
      this.mediaRecorder.resume();
      this.updateRecordingState({ isPaused: false });
      this.startDurationTimer();
      this.startFrameCounter();
    } else {
      // 暂停
      this.mediaRecorder.pause();
      this.updateRecordingState({ isPaused: true });
      this.stopDurationTimer();
      this.stopFrameCounter();
    }
  }

  /**
   * 停止录制并获取结果
   */
  async stopRecording(): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.recordingState.isRecording) {
        reject(new Error('Not recording'));
        return;
      }

      const duration = this.recordingState.duration;
      const frameCount = this.recordingState.frameCount;
      const format = this.config.videoFormat;

      this.mediaRecorder.onstop = async () => {
        try {
          const mimeType = this.getVideoMimeType(format);
          const blob = new Blob(this.recordedChunks, { type: mimeType });
          const dataUrl = await this.blobToDataUrl(blob);
          const timestamp = Date.now();
          const filename = this.generateFilename('recording', format, timestamp);

          // 清理
          this.recordedChunks = [];
          this.updateRecordingState({
            isRecording: false,
            duration: 0,
            frameCount: 0,
            startTime: null,
            isPaused: false,
            estimatedSize: 0,
          });

          resolve({
            blob,
            dataUrl,
            filename,
            duration,
            frameCount,
            format,
            size: blob.size,
          });
        } catch (error) {
          reject(error);
        }
      };

      // 停止计时器
      this.stopDurationTimer();
      this.stopFrameCounter();

      // 停止录制
      this.mediaRecorder.stop();
      this.mediaRecorder = null;

      // 清理音频
      this.cleanupAudioCapture();
    });
  }

  /**
   * 停止录制并下载
   */
  async stopRecordingAndDownload(): Promise<void> {
    const result = await this.stopRecording();
    this.downloadBlob(result.blob, result.filename);
  }

  /**
   * 取消录制
   */
  cancelRecording(): void {
    if (!this.mediaRecorder) {
      return;
    }

    this.stopDurationTimer();
    this.stopFrameCounter();
    
    this.mediaRecorder.stop();
    this.mediaRecorder = null;
    this.recordedChunks = [];

    this.updateRecordingState({
      isRecording: false,
      duration: 0,
      frameCount: 0,
      startTime: null,
      isPaused: false,
      estimatedSize: 0,
    });

    this.cleanupAudioCapture();
  }

  /**
   * 获取录制状态
   */
  getRecordingState(): RecordingState {
    return { ...this.recordingState };
  }

  /**
   * 订阅录制状态变化
   */
  onRecordingStateChange(callback: RecordingStateCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  // ==================== GIF 导出 ====================

  /**
   * 录制 GIF 动图
   * 注意: 需要额外的 GIF 编码库，这里提供帧数据收集
   */
  async captureFrames(
    durationMs: number,
    options?: {
      frameRate?: number;
      width?: number;
      height?: number;
    }
  ): Promise<{
    frames: ImageData[];
    width: number;
    height: number;
    frameRate: number;
  }> {
    if (!this.canvas) {
      throw new Error('Canvas not bound');
    }

    const frameRate = options?.frameRate || 10;  // GIF 通常 10fps
    const width = options?.width || this.canvas.width;
    const height = options?.height || this.canvas.height;
    const frameInterval = 1000 / frameRate;
    const totalFrames = Math.ceil(durationMs / frameInterval);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }

    const frames: ImageData[] = [];
    
    return new Promise((resolve) => {
      let frameCount = 0;
      const captureFrame = () => {
        if (frameCount >= totalFrames) {
          resolve({ frames, width, height, frameRate });
          return;
        }

        ctx.drawImage(this.canvas!, 0, 0, width, height);
        frames.push(ctx.getImageData(0, 0, width, height));
        frameCount++;

        setTimeout(captureFrame, frameInterval);
      };

      captureFrame();
    });
  }

  // ==================== 缩略图 ====================

  /**
   * 生成缩略图
   */
  async generateThumbnail(
    maxWidth: number = 200,
    maxHeight: number = 200
  ): Promise<CaptureResult> {
    if (!this.canvas) {
      throw new Error('Canvas not bound');
    }

    // 计算缩放比例保持宽高比
    const scale = Math.min(
      maxWidth / this.canvas.width,
      maxHeight / this.canvas.height
    );
    const width = Math.round(this.canvas.width * scale);
    const height = Math.round(this.canvas.height * scale);

    return this.captureScreenshot({
      width,
      height,
      imageFormat: 'jpeg',
      quality: 0.8,
    });
  }

  // ==================== 工具方法 ====================

  private async applyWatermark(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    watermark: WatermarkConfig
  ): Promise<void> {
    const position = watermark.position || 'bottom-right';
    const opacity = watermark.opacity ?? 0.7;
    const margin = watermark.margin ?? 20;

    ctx.save();
    ctx.globalAlpha = opacity;

    if (watermark.text) {
      const fontSize = watermark.fontSize || 16;
      const fontColor = watermark.fontColor || '#ffffff';
      
      ctx.font = `${fontSize}px Arial, sans-serif`;
      ctx.fillStyle = fontColor;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      const textMetrics = ctx.measureText(watermark.text);
      const textWidth = textMetrics.width;
      const textHeight = fontSize;

      let x = margin;
      let y = margin + textHeight;

      switch (position) {
        case 'top-left':
          x = margin;
          y = margin + textHeight;
          break;
        case 'top-right':
          x = width - textWidth - margin;
          y = margin + textHeight;
          break;
        case 'bottom-left':
          x = margin;
          y = height - margin;
          break;
        case 'bottom-right':
          x = width - textWidth - margin;
          y = height - margin;
          break;
        case 'center':
          x = (width - textWidth) / 2;
          y = (height + textHeight) / 2;
          break;
      }

      ctx.fillText(watermark.text, x, y);
    }

    if (watermark.imageUrl) {
      try {
        const img = await this.loadImage(watermark.imageUrl);
        const imgWidth = img.width;
        const imgHeight = img.height;

        let x = margin;
        let y = margin;

        switch (position) {
          case 'top-left':
            x = margin;
            y = margin;
            break;
          case 'top-right':
            x = width - imgWidth - margin;
            y = margin;
            break;
          case 'bottom-left':
            x = margin;
            y = height - imgHeight - margin;
            break;
          case 'bottom-right':
            x = width - imgWidth - margin;
            y = height - imgHeight - margin;
            break;
          case 'center':
            x = (width - imgWidth) / 2;
            y = (height - imgHeight) / 2;
            break;
        }

        ctx.drawImage(img, x, y);
      } catch (error) {
        console.warn('Failed to load watermark image:', error);
      }
    }

    ctx.restore();
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  private getMimeType(format: string): string {
    switch (format) {
      case 'png':
        return 'image/png';
      case 'jpeg':
        return 'image/jpeg';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/png';
    }
  }

  private getVideoMimeType(format: string): string {
    switch (format) {
      case 'webm':
        return 'video/webm;codecs=vp9';
      case 'mp4':
        return 'video/mp4';
      default:
        return 'video/webm';
    }
  }

  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    return response.blob();
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private generateFilename(prefix: string, format: string, timestamp: number): string {
    const date = new Date(timestamp);
    const dateStr = date.toISOString().slice(0, 10);
    const timeStr = date.toISOString().slice(11, 19).replace(/:/g, '-');
    return `avatar-${prefix}-${dateStr}-${timeStr}.${format}`;
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private updateRecordingState(update: Partial<RecordingState>): void {
    this.recordingState = { ...this.recordingState, ...update };
    this.stateCallbacks.forEach((cb) => cb(this.recordingState));
  }

  private startDurationTimer(): void {
    if (this.durationInterval) {
      return;
    }
    this.durationInterval = setInterval(() => {
      if (this.recordingState.startTime && !this.recordingState.isPaused) {
        const elapsed = Date.now() - this.recordingState.startTime;
        this.updateRecordingState({ duration: elapsed });
      }
    }, 100);
  }

  private stopDurationTimer(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  private startFrameCounter(): void {
    const countFrame = () => {
      if (this.recordingState.isRecording && !this.recordingState.isPaused) {
        this.updateRecordingState({
          frameCount: this.recordingState.frameCount + 1,
        });
        this.animationFrameId = requestAnimationFrame(countFrame);
      }
    };
    this.animationFrameId = requestAnimationFrame(countFrame);
  }

  private stopFrameCounter(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private setupAudioCapture(stream: MediaStream): void {
    try {
      this.audioContext = new AudioContext();
      this.audioDestination = this.audioContext.createMediaStreamDestination();
      
      // 将音频轨道添加到视频流
      this.audioDestination.stream.getAudioTracks().forEach((track) => {
        stream.addTrack(track);
      });
    } catch (error) {
      console.warn('Failed to setup audio capture:', error);
    }
  }

  private cleanupAudioCapture(): void {
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.audioDestination = null;
  }

  /**
   * 销毁系统
   */
  destroy(): void {
    this.cancelRecording();
    this.canvas = null;
    this.stateCallbacks.clear();
  }
}

// ==================== 便捷函数 ====================

let captureSystemInstance: AvatarCaptureSystem | null = null;

/**
 * 获取全局截图系统实例
 */
export function getAvatarCaptureSystem(): AvatarCaptureSystem {
  if (!captureSystemInstance) {
    captureSystemInstance = new AvatarCaptureSystem();
  }
  return captureSystemInstance;
}

/**
 * 创建新的截图系统实例
 */
export function createAvatarCaptureSystem(config?: Partial<CaptureConfig>): AvatarCaptureSystem {
  return new AvatarCaptureSystem(config);
}

export default AvatarCaptureSystem;
