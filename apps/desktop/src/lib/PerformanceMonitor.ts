/**
 * Performance Monitor - 性能监控工具
 * 
 * 实时监控 FPS、内存、渲染性能等指标
 * 
 * v1.0 - SOTA 工程质量优化
 */

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;        // ms per frame
  memoryUsed: number;       // MB (estimated)
  memoryLimit: number;      // MB
  drawCalls: number;        // estimated
  timestamp: number;
}

export interface PerformanceConfig {
  sampleInterval: number;   // 采样间隔 (ms)
  historySize: number;      // 历史记录大小
  enabled: boolean;
}

const DEFAULT_CONFIG: PerformanceConfig = {
  sampleInterval: 1000,     // 每秒采样一次
  historySize: 60,          // 保留60秒历史
  enabled: true,
};

type MetricsCallback = (metrics: PerformanceMetrics) => void;

export class PerformanceMonitor {
  private config: PerformanceConfig;
  private callbacks: Set<MetricsCallback> = new Set();
  private history: PerformanceMetrics[] = [];
  
  // FPS 计算
  private frameCount = 0;
  private lastFpsTime = 0;
  private fps = 0;
  private frameTimeHistory: number[] = [];
  
  // 动画帧
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  
  // 采样定时器
  private sampleIntervalId: ReturnType<typeof setInterval> | null = null;
  
  // 启动时间
  private startTime = Date.now();

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.enabled) {
      this.start();
    }
  }

  /**
   * 启动性能监控
   */
  start() {
    if (this.animationFrameId !== null) return;
    
    this.lastFpsTime = performance.now();
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    
    // 动画帧计数
    const countFrame = () => {
      const now = performance.now();
      const frameTime = now - this.lastFrameTime;
      this.lastFrameTime = now;
      
      // 记录帧时间
      this.frameTimeHistory.push(frameTime);
      if (this.frameTimeHistory.length > 60) {
        this.frameTimeHistory.shift();
      }
      
      this.frameCount++;
      
      // 每秒计算一次 FPS
      const elapsed = now - this.lastFpsTime;
      if (elapsed >= 1000) {
        this.fps = Math.round((this.frameCount * 1000) / elapsed);
        this.frameCount = 0;
        this.lastFpsTime = now;
      }
      
      this.animationFrameId = requestAnimationFrame(countFrame);
    };
    
    this.animationFrameId = requestAnimationFrame(countFrame);
    
    // 定期采样并通知
    this.sampleIntervalId = setInterval(() => {
      const metrics = this.getMetrics();
      this.history.push(metrics);
      
      // 限制历史大小
      if (this.history.length > this.config.historySize) {
        this.history.shift();
      }
      
      // 通知所有订阅者
      for (const callback of this.callbacks) {
        try {
          callback(metrics);
        } catch (e) {
          console.error('[PerformanceMonitor] Callback error:', e);
        }
      }
    }, this.config.sampleInterval);
    
    console.log('[PerformanceMonitor] 已启动');
  }

  /**
   * 停止性能监控
   */
  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    if (this.sampleIntervalId !== null) {
      clearInterval(this.sampleIntervalId);
      this.sampleIntervalId = null;
    }
    
    console.log('[PerformanceMonitor] 已停止');
  }

  /**
   * 获取当前性能指标
   */
  getMetrics(): PerformanceMetrics {
    // 计算平均帧时间
    const avgFrameTime = this.frameTimeHistory.length > 0
      ? this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length
      : 0;
    
    // 获取内存信息 (Chrome only)
    let memoryUsed = 0;
    let memoryLimit = 0;
    
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsed = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      memoryLimit = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
    }
    
    return {
      fps: this.fps,
      frameTime: Math.round(avgFrameTime * 100) / 100,
      memoryUsed,
      memoryLimit,
      drawCalls: this.estimateDrawCalls(),
      timestamp: Date.now(),
    };
  }

  /**
   * 估算 Draw Calls（基于 Canvas 数量和复杂度）
   */
  private estimateDrawCalls(): number {
    const canvases = document.querySelectorAll('canvas');
    let estimate = 0;
    
    for (const canvas of canvases) {
      // Live2D 模型大约 10-50 draw calls
      if (canvas.id?.includes('live2d') || canvas.className?.includes('avatar')) {
        estimate += 30;
      } else {
        estimate += 5;
      }
    }
    
    return estimate;
  }

  /**
   * 获取历史记录
   */
  getHistory(): PerformanceMetrics[] {
    return [...this.history];
  }

  /**
   * 获取运行时间
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * 获取格式化的运行时间
   */
  getUptimeFormatted(): string {
    const uptime = this.getUptime();
    const seconds = Math.floor(uptime / 1000) % 60;
    const minutes = Math.floor(uptime / 60000) % 60;
    const hours = Math.floor(uptime / 3600000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * 订阅性能更新
   */
  onMetrics(callback: MetricsCallback): () => void {
    this.callbacks.add(callback);
    // 立即发送当前指标
    callback(this.getMetrics());
    return () => this.callbacks.delete(callback);
  }

  /**
   * 获取性能评级
   */
  getPerformanceRating(): 'excellent' | 'good' | 'fair' | 'poor' {
    const metrics = this.getMetrics();
    
    if (metrics.fps >= 55) return 'excellent';
    if (metrics.fps >= 45) return 'good';
    if (metrics.fps >= 30) return 'fair';
    return 'poor';
  }

  /**
   * 获取性能建议
   */
  getPerformanceAdvice(): string[] {
    const metrics = this.getMetrics();
    const advice: string[] = [];
    
    if (metrics.fps < 30) {
      advice.push('FPS 较低，考虑关闭生命动画或降低动画复杂度');
    }
    
    if (metrics.frameTime > 20) {
      advice.push('帧时间较长，可能存在性能瓶颈');
    }
    
    if (metrics.memoryUsed > 300) {
      advice.push('内存使用较高，考虑减少模型数量或纹理质量');
    }
    
    if (advice.length === 0) {
      advice.push('性能良好，继续保持！');
    }
    
    return advice;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PerformanceConfig>) {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };
    
    // 处理启用/禁用变化
    if (wasEnabled && !this.config.enabled) {
      this.stop();
    } else if (!wasEnabled && this.config.enabled) {
      this.start();
    }
    
    // 如果采样间隔改变，重启采样器
    if (config.sampleInterval && this.sampleIntervalId) {
      clearInterval(this.sampleIntervalId);
      this.sampleIntervalId = setInterval(() => {
        const metrics = this.getMetrics();
        this.history.push(metrics);
        if (this.history.length > this.config.historySize) {
          this.history.shift();
        }
        for (const callback of this.callbacks) {
          try { callback(metrics); } catch {}
        }
      }, this.config.sampleInterval);
    }
  }

  /**
   * 销毁
   */
  destroy() {
    this.stop();
    this.callbacks.clear();
    this.history = [];
    this.frameTimeHistory = [];
  }
}

// 单例导出
export const performanceMonitor = new PerformanceMonitor();
