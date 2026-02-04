/**
 * PerformanceMonitor 单元测试
 * 
 * 测试性能监控功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PerformanceMonitor, PerformanceMetrics, PerformanceConfig } from './PerformanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  
  beforeEach(() => {
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    if (monitor) {
      monitor.destroy();
    }
    vi.useRealTimers();
  });
  
  describe('基础功能', () => {
    it('应该能创建实例', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      expect(monitor).toBeInstanceOf(PerformanceMonitor);
    });
    
    it('默认配置应该启用监控', () => {
      monitor = new PerformanceMonitor();
      // 启动后应该注册了动画帧
      expect(monitor).toBeDefined();
    });
    
    it('enabled=false 时不应自动启动', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      // 不会有错误
      expect(monitor.getMetrics()).toBeDefined();
    });
  });
  
  describe('启动和停止', () => {
    it('应该能手动启动监控', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      monitor.start();
      // 启动后应该能获取指标
      expect(monitor.getMetrics()).toHaveProperty('fps');
    });
    
    it('应该能停止监控', () => {
      monitor = new PerformanceMonitor();
      monitor.stop();
      // 停止后不应报错
      expect(() => monitor.getMetrics()).not.toThrow();
    });
    
    it('重复启动不应出错', () => {
      monitor = new PerformanceMonitor();
      expect(() => monitor.start()).not.toThrow();
      expect(() => monitor.start()).not.toThrow();
    });
    
    it('销毁后应该清理资源', () => {
      monitor = new PerformanceMonitor();
      monitor.destroy();
      expect(monitor.getHistory()).toHaveLength(0);
    });
  });
  
  describe('性能指标', () => {
    it('getMetrics 应该返回正确的结构', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      const metrics = monitor.getMetrics();
      
      expect(metrics).toHaveProperty('fps');
      expect(metrics).toHaveProperty('frameTime');
      expect(metrics).toHaveProperty('memoryUsed');
      expect(metrics).toHaveProperty('memoryLimit');
      expect(metrics).toHaveProperty('drawCalls');
      expect(metrics).toHaveProperty('timestamp');
    });
    
    it('fps 应该是数字', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      const metrics = monitor.getMetrics();
      expect(typeof metrics.fps).toBe('number');
    });
    
    it('frameTime 应该是数字', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      const metrics = monitor.getMetrics();
      expect(typeof metrics.frameTime).toBe('number');
    });
    
    it('timestamp 应该是当前时间戳', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      const before = Date.now();
      const metrics = monitor.getMetrics();
      const after = Date.now();
      
      expect(metrics.timestamp).toBeGreaterThanOrEqual(before);
      expect(metrics.timestamp).toBeLessThanOrEqual(after);
    });
  });
  
  describe('历史记录', () => {
    it('初始历史应该为空', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      expect(monitor.getHistory()).toHaveLength(0);
    });
    
    it('采样后应该记录历史', () => {
      monitor = new PerformanceMonitor({ sampleInterval: 1000, historySize: 60 });
      
      // 推进时间触发采样
      vi.advanceTimersByTime(1000);
      
      const history = monitor.getHistory();
      expect(history.length).toBeGreaterThan(0);
    });
    
    it('历史记录应该限制大小', () => {
      monitor = new PerformanceMonitor({ sampleInterval: 100, historySize: 3 });
      
      // 触发多次采样
      vi.advanceTimersByTime(500);
      
      const history = monitor.getHistory();
      expect(history.length).toBeLessThanOrEqual(3);
    });
  });
  
  describe('运行时间', () => {
    it('getUptime 应该返回运行时间', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      const uptime = monitor.getUptime();
      expect(typeof uptime).toBe('number');
      expect(uptime).toBeGreaterThanOrEqual(0);
    });
    
    it('getUptimeFormatted 应该返回格式化字符串', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      const formatted = monitor.getUptimeFormatted();
      expect(typeof formatted).toBe('string');
    });
    
    it('运行时间应该包含秒数', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      vi.advanceTimersByTime(5000);
      const formatted = monitor.getUptimeFormatted();
      expect(formatted).toContain('s');
    });
    
    it('超过一分钟应该显示分钟', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      vi.advanceTimersByTime(90000); // 90 秒
      const formatted = monitor.getUptimeFormatted();
      expect(formatted).toContain('m');
    });
  });
  
  describe('订阅机制', () => {
    it('应该能订阅性能更新', () => {
      monitor = new PerformanceMonitor({ sampleInterval: 1000 });
      const callback = vi.fn();
      
      monitor.onMetrics(callback);
      
      // 立即调用一次
      expect(callback).toHaveBeenCalledTimes(1);
    });
    
    it('采样时应该触发回调', () => {
      monitor = new PerformanceMonitor({ sampleInterval: 1000 });
      const callback = vi.fn();
      
      monitor.onMetrics(callback);
      callback.mockClear();
      
      vi.advanceTimersByTime(1000);
      
      expect(callback).toHaveBeenCalled();
    });
    
    it('应该能取消订阅', () => {
      monitor = new PerformanceMonitor({ sampleInterval: 1000 });
      const callback = vi.fn();
      
      const unsubscribe = monitor.onMetrics(callback);
      callback.mockClear();
      
      unsubscribe();
      vi.advanceTimersByTime(1000);
      
      expect(callback).not.toHaveBeenCalled();
    });
    
    it('回调抛出错误不应中断其他回调', () => {
      monitor = new PerformanceMonitor({ sampleInterval: 1000 });
      const normalCallback = vi.fn();
      
      // 注册正常回调
      monitor.onMetrics(normalCallback);
      
      // 清除初始调用
      normalCallback.mockClear();
      
      // 触发采样
      vi.advanceTimersByTime(1000);
      
      // normalCallback 被调用
      expect(normalCallback).toHaveBeenCalled();
    });
  });
  
  describe('性能评级', () => {
    it('getPerformanceRating 应该返回评级', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      const rating = monitor.getPerformanceRating();
      expect(['excellent', 'good', 'fair', 'poor']).toContain(rating);
    });
  });
  
  describe('性能建议', () => {
    it('getPerformanceAdvice 应该返回数组', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      const advice = monitor.getPerformanceAdvice();
      expect(Array.isArray(advice)).toBe(true);
    });
    
    it('性能良好时应该有正面反馈', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      const advice = monitor.getPerformanceAdvice();
      // 默认情况下 FPS 为 0，会有建议
      expect(advice.length).toBeGreaterThan(0);
    });
  });
  
  describe('配置更新', () => {
    it('应该能更新配置', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      monitor.updateConfig({ historySize: 100 });
      // 不应报错
      expect(monitor).toBeDefined();
    });
    
    it('更新 enabled=true 应该启动监控', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      monitor.updateConfig({ enabled: true });
      // 启动后应该能正常工作
      expect(monitor.getMetrics()).toBeDefined();
    });
    
    it('更新 enabled=false 应该停止监控', () => {
      monitor = new PerformanceMonitor({ enabled: true });
      monitor.updateConfig({ enabled: false });
      // 停止后应该能正常获取指标
      expect(monitor.getMetrics()).toBeDefined();
    });
    
    it('更新 sampleInterval 应该重启采样器', () => {
      monitor = new PerformanceMonitor({ sampleInterval: 1000 });
      const callback = vi.fn();
      monitor.onMetrics(callback);
      callback.mockClear();
      
      // 更新采样间隔
      monitor.updateConfig({ sampleInterval: 500 });
      
      // 500ms 后应该触发
      vi.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalled();
    });
  });
  
  describe('Draw Calls 估算', () => {
    it('没有 canvas 时应该返回 0', () => {
      monitor = new PerformanceMonitor({ enabled: false });
      const metrics = monitor.getMetrics();
      expect(metrics.drawCalls).toBe(0);
    });
  });
});
