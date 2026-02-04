/**
 * PerformancePanel - 性能监控面板
 * 
 * 显示 FPS、内存、渲染性能等实时数据
 */

import { Component, createSignal, createEffect, onCleanup, Show, For } from 'solid-js';
import { performanceMonitor, type PerformanceMetrics, type PerformanceReport } from '../lib/PerformanceMonitor';
import './PerformancePanel.css';

interface PerformancePanelProps {
  onClose?: () => void;
  compact?: boolean;
}

// 性能等级颜色
const getGradeColor = (grade: string) => {
  switch (grade) {
    case 'S': return '#22c55e';
    case 'A': return '#4ade80';
    case 'B': return '#fbbf24';
    case 'C': return '#f97316';
    case 'D': return '#ef4444';
    default: return '#6b7280';
  }
};

// 性能等级说明
const GRADE_DESCRIPTIONS: Record<string, string> = {
  'S': '完美',
  'A': '优秀',
  'B': '良好',
  'C': '一般',
  'D': '需优化',
};

export const PerformancePanel: Component<PerformancePanelProps> = (props) => {
  const [metrics, setMetrics] = createSignal<PerformanceMetrics | null>(null);
  const [report, setReport] = createSignal<PerformanceReport | null>(null);
  const [fpsHistory, setFpsHistory] = createSignal<number[]>([]);
  const [isMonitoring, setIsMonitoring] = createSignal(false);
  
  let unsubscribe: (() => void) | null = null;
  let updateInterval: ReturnType<typeof setInterval>;
  
  // 启动监控
  const startMonitoring = () => {
    performanceMonitor.startMonitoring();
    
    unsubscribe = performanceMonitor.onMetrics((m) => {
      setMetrics(m);
      // 记录 FPS 历史
      setFpsHistory(prev => [...prev.slice(-59), m.fps]);
    });
    
    setIsMonitoring(true);
  };
  
  // 停止监控
  const stopMonitoring = () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    performanceMonitor.stopMonitoring();
    setIsMonitoring(false);
  };
  
  // 切换监控
  const toggleMonitoring = () => {
    if (isMonitoring()) {
      stopMonitoring();
    } else {
      startMonitoring();
    }
  };
  
  // 获取报告
  const getReport = () => {
    setReport(performanceMonitor.getReport());
  };
  
  // 自动启动监控
  createEffect(() => {
    startMonitoring();
    updateInterval = setInterval(getReport, 2000);
  });
  
  onCleanup(() => {
    stopMonitoring();
    clearInterval(updateInterval);
  });
  
  // FPS 状态颜色
  const getFpsColor = (fps: number) => {
    if (fps >= 55) return '#22c55e';
    if (fps >= 45) return '#fbbf24';
    if (fps >= 30) return '#f97316';
    return '#ef4444';
  };
  
  // 内存使用格式化
  const formatMemory = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };
  
  // 紧凑模式
  if (props.compact) {
    return (
      <div class="perf-panel-compact">
        <Show when={metrics()}>
          {(m) => (
            <>
              <span class="fps" style={{ color: getFpsColor(m().fps) }}>
                {m().fps} FPS
              </span>
              <span class="mem">{formatMemory(m().memoryUsed)}</span>
            </>
          )}
        </Show>
      </div>
    );
  }
  
  return (
    <div class="performance-panel">
      <div class="panel-header">
        <h3>📊 性能监控</h3>
        <div class="header-actions">
          <button 
            class="monitor-toggle"
            classList={{ active: isMonitoring() }}
            onClick={toggleMonitoring}
          >
            {isMonitoring() ? '⏹ 停止' : '▶ 开始'}
          </button>
          <Show when={props.onClose}>
            <button class="close-btn" onClick={props.onClose}>×</button>
          </Show>
        </div>
      </div>
      
      {/* 实时指标 */}
      <Show when={metrics()}>
        {(m) => (
          <div class="realtime-metrics">
            {/* FPS */}
            <div class="metric-card fps-card">
              <div class="metric-value" style={{ color: getFpsColor(m().fps) }}>
                {m().fps}
              </div>
              <div class="metric-label">FPS</div>
              {/* FPS 曲线图 */}
              <div class="fps-chart">
                <svg viewBox="0 0 60 20" preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke={getFpsColor(m().fps)}
                    stroke-width="1"
                    points={fpsHistory().map((fps, i) => `${i},${20 - (fps / 60) * 20}`).join(' ')}
                  />
                </svg>
              </div>
            </div>
            
            {/* 帧时间 */}
            <div class="metric-card">
              <div class="metric-value">{m().frameTime.toFixed(1)}</div>
              <div class="metric-label">帧时间 (ms)</div>
            </div>
            
            {/* 内存 */}
            <div class="metric-card">
              <div class="metric-value">{formatMemory(m().memoryUsed)}</div>
              <div class="metric-label">内存使用</div>
            </div>
            
            {/* 渲染时间 */}
            <div class="metric-card">
              <div class="metric-value">{m().renderTime.toFixed(1)}</div>
              <div class="metric-label">渲染 (ms)</div>
            </div>
          </div>
        )}
      </Show>
      
      {/* 性能报告 */}
      <Show when={report()}>
        {(r) => (
          <div class="performance-report">
            <h4>性能评级</h4>
            
            {/* 总体评级 */}
            <div class="overall-grade">
              <div 
                class="grade-badge"
                style={{ background: getGradeColor(r().overallGrade) }}
              >
                {r().overallGrade}
              </div>
              <span class="grade-desc">{GRADE_DESCRIPTIONS[r().overallGrade]}</span>
            </div>
            
            {/* 分项评级 */}
            <div class="grade-items">
              <div class="grade-item">
                <span>FPS</span>
                <span 
                  class="grade"
                  style={{ color: getGradeColor(r().grades.fps) }}
                >
                  {r().grades.fps}
                </span>
              </div>
              <div class="grade-item">
                <span>帧时间</span>
                <span 
                  class="grade"
                  style={{ color: getGradeColor(r().grades.frameTime) }}
                >
                  {r().grades.frameTime}
                </span>
              </div>
              <div class="grade-item">
                <span>内存</span>
                <span 
                  class="grade"
                  style={{ color: getGradeColor(r().grades.memory) }}
                >
                  {r().grades.memory}
                </span>
              </div>
              <div class="grade-item">
                <span>稳定性</span>
                <span 
                  class="grade"
                  style={{ color: getGradeColor(r().grades.stability) }}
                >
                  {r().grades.stability}
                </span>
              </div>
            </div>
            
            {/* 统计数据 */}
            <div class="stats-section">
              <h4>统计数据</h4>
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-label">平均 FPS</span>
                  <span class="stat-value">{r().stats.avgFps.toFixed(1)}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">最低 FPS</span>
                  <span class="stat-value">{r().stats.minFps}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">最高 FPS</span>
                  <span class="stat-value">{r().stats.maxFps}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">掉帧次数</span>
                  <span class="stat-value">{r().stats.droppedFrames}</span>
                </div>
              </div>
            </div>
            
            {/* 建议 */}
            <Show when={r().suggestions.length > 0}>
              <div class="suggestions">
                <h4>优化建议</h4>
                <ul>
                  <For each={r().suggestions}>
                    {(suggestion) => <li>{suggestion}</li>}
                  </For>
                </ul>
              </div>
            </Show>
          </div>
        )}
      </Show>
      
      <Show when={!isMonitoring()}>
        <div class="not-monitoring">
          点击"开始"按钮启动性能监控
        </div>
      </Show>
    </div>
  );
};

export default PerformancePanel;
