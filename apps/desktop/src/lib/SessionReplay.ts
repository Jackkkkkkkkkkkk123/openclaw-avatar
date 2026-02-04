/**
 * SessionReplay - 会话录制与回放系统
 * 
 * 录制用户与 Avatar 的交互，支持回放以重现体验
 * 用途：调试、演示、教学
 */

export interface ReplayEvent {
  timestamp: number;
  type: ReplayEventType;
  data: unknown;
}

export type ReplayEventType =
  | 'expression'
  | 'motion'
  | 'lip_sync'
  | 'look_at'
  | 'message'
  | 'tts_start'
  | 'tts_end'
  | 'emotion'
  | 'custom';

export interface Recording {
  id: string;
  name: string;
  createdAt: number;
  duration: number;
  events: ReplayEvent[];
  metadata?: Record<string, unknown>;
}

export interface ReplayState {
  isRecording: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
}

export interface ReplayConfig {
  maxEventCount: number;
  storageKey: string;
  autoSave: boolean;
}

type ReplayCallback = (event: ReplayEvent) => void;
type StateCallback = (state: ReplayState) => void;

export class SessionReplay {
  private config: ReplayConfig;
  private currentRecording: ReplayEvent[] = [];
  private recordingStartTime: number = 0;
  private recordings: Map<string, Recording> = new Map();
  
  private isRecording: boolean = false;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private playbackStartTime: number = 0;
  private playbackOffset: number = 0;
  private playbackSpeed: number = 1;
  private currentEventIndex: number = 0;
  private playingRecording: Recording | null = null;
  
  private eventCallbacks: Set<ReplayCallback> = new Set();
  private stateCallbacks: Set<StateCallback> = new Set();
  private playbackTimer: number | null = null;

  constructor(config?: Partial<ReplayConfig>) {
    this.config = {
      maxEventCount: 10000,
      storageKey: 'openclaw-avatar-recordings',
      autoSave: true,
      ...config
    };
    
    this.loadFromStorage();
  }

  /**
   * 开始录制
   */
  startRecording(): void {
    if (this.isRecording) return;
    
    this.isRecording = true;
    this.currentRecording = [];
    this.recordingStartTime = Date.now();
    
    this.notifyStateChange();
  }

  /**
   * 停止录制并保存
   */
  stopRecording(name?: string): Recording | null {
    if (!this.isRecording) return null;
    
    this.isRecording = false;
    
    const recording: Recording = {
      id: this.generateId(),
      name: name || `Recording ${new Date().toLocaleString()}`,
      createdAt: this.recordingStartTime,
      duration: Date.now() - this.recordingStartTime,
      events: [...this.currentRecording]
    };
    
    this.recordings.set(recording.id, recording);
    this.currentRecording = [];
    
    if (this.config.autoSave) {
      this.saveToStorage();
    }
    
    this.notifyStateChange();
    return recording;
  }

  /**
   * 录制事件
   */
  recordEvent(type: ReplayEventType, data: unknown): void {
    if (!this.isRecording) return;
    
    const event: ReplayEvent = {
      timestamp: Date.now() - this.recordingStartTime,
      type,
      data
    };
    
    this.currentRecording.push(event);
    
    // 限制事件数量
    if (this.currentRecording.length > this.config.maxEventCount) {
      this.currentRecording.shift();
    }
  }

  /**
   * 开始播放
   */
  play(recordingId: string): boolean {
    const recording = this.recordings.get(recordingId);
    if (!recording) return false;
    
    this.stopPlayback();
    
    this.isPlaying = true;
    this.isPaused = false;
    this.playingRecording = recording;
    this.playbackStartTime = Date.now();
    this.playbackOffset = 0;
    this.currentEventIndex = 0;
    
    this.scheduleNextEvent();
    this.notifyStateChange();
    
    return true;
  }

  /**
   * 暂停播放
   */
  pause(): void {
    if (!this.isPlaying || this.isPaused) return;
    
    this.isPaused = true;
    this.playbackOffset = this.getCurrentPlaybackTime();
    
    if (this.playbackTimer !== null) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    
    this.notifyStateChange();
  }

  /**
   * 继续播放
   */
  resume(): void {
    if (!this.isPlaying || !this.isPaused) return;
    
    this.isPaused = false;
    this.playbackStartTime = Date.now();
    
    this.scheduleNextEvent();
    this.notifyStateChange();
  }

  /**
   * 停止播放
   */
  stop(): void {
    this.stopPlayback();
    this.notifyStateChange();
  }

  /**
   * 跳转到指定时间
   */
  seek(timeMs: number): void {
    if (!this.playingRecording) return;
    
    const clampedTime = Math.max(0, Math.min(timeMs, this.playingRecording.duration));
    
    // 找到对应的事件索引
    this.currentEventIndex = this.playingRecording.events.findIndex(
      e => e.timestamp >= clampedTime
    );
    
    if (this.currentEventIndex === -1) {
      this.currentEventIndex = this.playingRecording.events.length;
    }
    
    this.playbackOffset = clampedTime;
    this.playbackStartTime = Date.now();
    
    if (this.isPlaying && !this.isPaused) {
      if (this.playbackTimer !== null) {
        clearTimeout(this.playbackTimer);
      }
      this.scheduleNextEvent();
    }
    
    this.notifyStateChange();
  }

  /**
   * 设置播放速度
   */
  setPlaybackSpeed(speed: number): void {
    if (speed <= 0) return;
    
    // 保存当前进度
    if (this.isPlaying && !this.isPaused) {
      this.playbackOffset = this.getCurrentPlaybackTime();
      this.playbackStartTime = Date.now();
    }
    
    this.playbackSpeed = speed;
    
    // 重新调度
    if (this.isPlaying && !this.isPaused) {
      if (this.playbackTimer !== null) {
        clearTimeout(this.playbackTimer);
      }
      this.scheduleNextEvent();
    }
    
    this.notifyStateChange();
  }

  /**
   * 获取当前状态
   */
  getState(): ReplayState {
    return {
      isRecording: this.isRecording,
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentTime: this.isPlaying ? this.getCurrentPlaybackTime() : 0,
      duration: this.playingRecording?.duration || 0,
      playbackSpeed: this.playbackSpeed
    };
  }

  /**
   * 获取所有录制
   */
  getRecordings(): Recording[] {
    return Array.from(this.recordings.values());
  }

  /**
   * 获取单个录制
   */
  getRecording(id: string): Recording | undefined {
    return this.recordings.get(id);
  }

  /**
   * 删除录制
   */
  deleteRecording(id: string): boolean {
    const deleted = this.recordings.delete(id);
    if (deleted && this.config.autoSave) {
      this.saveToStorage();
    }
    return deleted;
  }

  /**
   * 重命名录制
   */
  renameRecording(id: string, newName: string): boolean {
    const recording = this.recordings.get(id);
    if (!recording) return false;
    
    recording.name = newName;
    if (this.config.autoSave) {
      this.saveToStorage();
    }
    return true;
  }

  /**
   * 清除所有录制
   */
  clearRecordings(): void {
    this.recordings.clear();
    if (this.config.autoSave) {
      this.clearStorage();
    }
  }

  /**
   * 导出录制
   */
  exportRecording(id: string): string | null {
    const recording = this.recordings.get(id);
    if (!recording) return null;
    return JSON.stringify(recording);
  }

  /**
   * 导入录制
   */
  importRecording(json: string): Recording | null {
    try {
      const recording = JSON.parse(json) as Recording;
      if (!recording.id || !recording.events) return null;
      
      // 生成新 ID 避免冲突
      recording.id = this.generateId();
      this.recordings.set(recording.id, recording);
      
      if (this.config.autoSave) {
        this.saveToStorage();
      }
      
      return recording;
    } catch {
      return null;
    }
  }

  /**
   * 订阅事件回放
   */
  onEvent(callback: ReplayCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }

  /**
   * 订阅状态变化
   */
  onStateChange(callback: StateCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ReplayConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stopPlayback();
    this.eventCallbacks.clear();
    this.stateCallbacks.clear();
    this.recordings.clear();
  }

  // 私有方法

  private generateId(): string {
    return `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentPlaybackTime(): number {
    if (!this.isPlaying) return 0;
    if (this.isPaused) return this.playbackOffset;
    return this.playbackOffset + (Date.now() - this.playbackStartTime) * this.playbackSpeed;
  }

  private stopPlayback(): void {
    this.isPlaying = false;
    this.isPaused = false;
    this.playingRecording = null;
    this.currentEventIndex = 0;
    
    if (this.playbackTimer !== null) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  private scheduleNextEvent(): void {
    if (!this.playingRecording || !this.isPlaying || this.isPaused) return;
    
    const events = this.playingRecording.events;
    
    if (this.currentEventIndex >= events.length) {
      // 播放结束
      this.stopPlayback();
      this.notifyStateChange();
      return;
    }
    
    const nextEvent = events[this.currentEventIndex];
    const currentTime = this.getCurrentPlaybackTime();
    const delay = (nextEvent.timestamp - currentTime) / this.playbackSpeed;
    
    if (delay <= 0) {
      // 立即触发
      this.fireEvent(nextEvent);
      this.currentEventIndex++;
      this.scheduleNextEvent();
    } else {
      this.playbackTimer = setTimeout(() => {
        if (this.isPlaying && !this.isPaused) {
          this.fireEvent(nextEvent);
          this.currentEventIndex++;
          this.scheduleNextEvent();
        }
      }, delay) as unknown as number;
    }
  }

  private fireEvent(event: ReplayEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error('[SessionReplay] Event callback error:', e);
      }
    }
  }

  private notifyStateChange(): void {
    const state = this.getState();
    for (const callback of this.stateCallbacks) {
      try {
        callback(state);
      } catch (e) {
        console.error('[SessionReplay] State callback error:', e);
      }
    }
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const data = localStorage.getItem(this.config.storageKey);
      if (data) {
        const recordings = JSON.parse(data) as Recording[];
        for (const recording of recordings) {
          this.recordings.set(recording.id, recording);
        }
      }
    } catch (e) {
      console.error('[SessionReplay] Failed to load from storage:', e);
    }
  }

  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const data = JSON.stringify(Array.from(this.recordings.values()));
      localStorage.setItem(this.config.storageKey, data);
    } catch (e) {
      console.error('[SessionReplay] Failed to save to storage:', e);
    }
  }

  private clearStorage(): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      localStorage.removeItem(this.config.storageKey);
    } catch (e) {
      console.error('[SessionReplay] Failed to clear storage:', e);
    }
  }
}

// 单例导出
export const sessionReplay = new SessionReplay();
