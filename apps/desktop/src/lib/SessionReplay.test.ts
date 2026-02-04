import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionReplay, ReplayEventType, Recording } from './SessionReplay';

describe('SessionReplay', () => {
  let replay: SessionReplay;
  let mockStorage: Map<string, string>;

  beforeEach(() => {
    vi.useFakeTimers();
    
    mockStorage = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage.get(key) || null,
      setItem: (key: string, value: string) => mockStorage.set(key, value),
      removeItem: (key: string) => mockStorage.delete(key),
      clear: () => mockStorage.clear(),
      length: 0,
      key: () => null
    });

    replay = new SessionReplay({
      autoSave: false
    });
  });

  afterEach(() => {
    replay.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('基础功能', () => {
    it('应该能创建实例', () => {
      expect(replay).toBeInstanceOf(SessionReplay);
    });

    it('初始状态应该正确', () => {
      const state = replay.getState();
      expect(state.isRecording).toBe(false);
      expect(state.isPlaying).toBe(false);
      expect(state.isPaused).toBe(false);
    });
  });

  describe('录制功能', () => {
    it('应该能开始录制', () => {
      replay.startRecording();
      expect(replay.getState().isRecording).toBe(true);
    });

    it('重复开始录制应该无效', () => {
      replay.startRecording();
      replay.recordEvent('expression', { name: 'happy' });
      
      replay.startRecording();  // 重复调用
      
      // 应该保持原有录制
      expect(replay.getState().isRecording).toBe(true);
    });

    it('应该能录制事件', () => {
      replay.startRecording();
      replay.recordEvent('expression', { name: 'happy' });
      replay.recordEvent('motion', { group: 'idle' });
      
      const recording = replay.stopRecording();
      expect(recording?.events.length).toBe(2);
    });

    it('未录制时 recordEvent 应该无效', () => {
      replay.recordEvent('expression', { name: 'happy' });
      // 不应该崩溃
      expect(replay.getState().isRecording).toBe(false);
    });

    it('应该能停止录制', () => {
      replay.startRecording();
      const recording = replay.stopRecording('Test Recording');
      
      expect(replay.getState().isRecording).toBe(false);
      expect(recording).not.toBeNull();
      expect(recording?.name).toBe('Test Recording');
    });

    it('未录制时 stopRecording 应该返回 null', () => {
      const recording = replay.stopRecording();
      expect(recording).toBeNull();
    });

    it('录制应该包含正确的时间戳', () => {
      replay.startRecording();
      
      vi.advanceTimersByTime(100);
      replay.recordEvent('expression', { name: 'happy' });
      
      vi.advanceTimersByTime(200);
      replay.recordEvent('motion', { group: 'idle' });
      
      const recording = replay.stopRecording();
      
      expect(recording?.events[0].timestamp).toBeCloseTo(100, -1);
      expect(recording?.events[1].timestamp).toBeCloseTo(300, -1);
    });

    it('录制应该包含 duration', () => {
      replay.startRecording();
      vi.advanceTimersByTime(500);
      const recording = replay.stopRecording();
      
      expect(recording?.duration).toBeCloseTo(500, -1);
    });
  });

  describe('事件数量限制', () => {
    it('应该限制最大事件数', () => {
      const limitedReplay = new SessionReplay({
        maxEventCount: 5,
        autoSave: false
      });
      
      limitedReplay.startRecording();
      for (let i = 0; i < 10; i++) {
        limitedReplay.recordEvent('expression', { index: i });
      }
      
      const recording = limitedReplay.stopRecording();
      expect(recording?.events.length).toBe(5);
      
      limitedReplay.destroy();
    });
  });

  describe('录制管理', () => {
    let recordingId: string;

    beforeEach(() => {
      replay.startRecording();
      replay.recordEvent('expression', { name: 'happy' });
      const recording = replay.stopRecording('Test');
      recordingId = recording!.id;
    });

    it('应该能获取所有录制', () => {
      const recordings = replay.getRecordings();
      expect(recordings.length).toBe(1);
    });

    it('应该能获取单个录制', () => {
      const recording = replay.getRecording(recordingId);
      expect(recording?.name).toBe('Test');
    });

    it('获取不存在的录制应该返回 undefined', () => {
      const recording = replay.getRecording('nonexistent');
      expect(recording).toBeUndefined();
    });

    it('应该能删除录制', () => {
      const deleted = replay.deleteRecording(recordingId);
      expect(deleted).toBe(true);
      expect(replay.getRecordings().length).toBe(0);
    });

    it('删除不存在的录制应该返回 false', () => {
      const deleted = replay.deleteRecording('nonexistent');
      expect(deleted).toBe(false);
    });

    it('应该能重命名录制', () => {
      const success = replay.renameRecording(recordingId, 'New Name');
      expect(success).toBe(true);
      expect(replay.getRecording(recordingId)?.name).toBe('New Name');
    });

    it('重命名不存在的录制应该返回 false', () => {
      const success = replay.renameRecording('nonexistent', 'New Name');
      expect(success).toBe(false);
    });

    it('应该能清除所有录制', () => {
      replay.clearRecordings();
      expect(replay.getRecordings().length).toBe(0);
    });
  });

  describe('播放功能', () => {
    let recordingId: string;

    beforeEach(() => {
      replay.startRecording();
      replay.recordEvent('expression', { name: 'happy' });
      vi.advanceTimersByTime(100);
      replay.recordEvent('motion', { group: 'idle' });
      const recording = replay.stopRecording();
      recordingId = recording!.id;
    });

    it('应该能开始播放', () => {
      const success = replay.play(recordingId);
      expect(success).toBe(true);
      expect(replay.getState().isPlaying).toBe(true);
    });

    it('播放不存在的录制应该返回 false', () => {
      const success = replay.play('nonexistent');
      expect(success).toBe(false);
    });

    it('应该能暂停播放', () => {
      replay.play(recordingId);
      replay.pause();
      expect(replay.getState().isPaused).toBe(true);
    });

    it('未播放时暂停应该无效', () => {
      replay.pause();
      expect(replay.getState().isPaused).toBe(false);
    });

    it('应该能继续播放', () => {
      replay.play(recordingId);
      replay.pause();
      replay.resume();
      expect(replay.getState().isPaused).toBe(false);
      expect(replay.getState().isPlaying).toBe(true);
    });

    it('未暂停时 resume 应该无效', () => {
      replay.play(recordingId);
      replay.resume();  // 没有暂停
      expect(replay.getState().isPlaying).toBe(true);
    });

    it('应该能停止播放', () => {
      replay.play(recordingId);
      replay.stop();
      expect(replay.getState().isPlaying).toBe(false);
    });

    it('播放结束后状态应该重置', () => {
      const callback = vi.fn();
      replay.onEvent(callback);
      
      replay.play(recordingId);
      
      // 等待所有事件播放完成
      vi.advanceTimersByTime(200);
      
      expect(replay.getState().isPlaying).toBe(false);
    });
  });

  describe('播放速度', () => {
    let recordingId: string;

    beforeEach(() => {
      replay.startRecording();
      replay.recordEvent('expression', { name: 'happy' });
      vi.advanceTimersByTime(100);
      replay.recordEvent('motion', { group: 'idle' });
      const recording = replay.stopRecording();
      recordingId = recording!.id;
    });

    it('应该能设置播放速度', () => {
      replay.setPlaybackSpeed(2);
      expect(replay.getState().playbackSpeed).toBe(2);
    });

    it('播放速度 0 或负数应该无效', () => {
      replay.setPlaybackSpeed(2);
      replay.setPlaybackSpeed(0);
      expect(replay.getState().playbackSpeed).toBe(2);
      
      replay.setPlaybackSpeed(-1);
      expect(replay.getState().playbackSpeed).toBe(2);
    });

    it('2x 速度应该更快完成', () => {
      const callback = vi.fn();
      replay.onEvent(callback);
      
      replay.setPlaybackSpeed(2);
      replay.play(recordingId);
      
      vi.advanceTimersByTime(60);  // 100ms / 2 = 50ms
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('跳转功能', () => {
    let recordingId: string;

    beforeEach(() => {
      replay.startRecording();
      replay.recordEvent('expression', { name: 'first' });
      vi.advanceTimersByTime(100);
      replay.recordEvent('expression', { name: 'second' });
      vi.advanceTimersByTime(100);
      replay.recordEvent('expression', { name: 'third' });
      const recording = replay.stopRecording();
      recordingId = recording!.id;
    });

    it('应该能跳转到指定时间', () => {
      replay.play(recordingId);
      replay.seek(150);
      
      const state = replay.getState();
      expect(state.currentTime).toBeCloseTo(150, -1);
    });

    it('跳转应该限制在有效范围内', () => {
      replay.play(recordingId);
      
      replay.seek(-100);
      expect(replay.getState().currentTime).toBeGreaterThanOrEqual(0);
      
      replay.seek(100000);
      expect(replay.getState().currentTime).toBeLessThanOrEqual(
        replay.getState().duration
      );
    });
  });

  describe('事件回调', () => {
    let recordingId: string;

    beforeEach(() => {
      replay.startRecording();
      replay.recordEvent('expression', { name: 'happy' });
      vi.advanceTimersByTime(50);
      replay.recordEvent('motion', { group: 'idle' });
      const recording = replay.stopRecording();
      recordingId = recording!.id;
    });

    it('应该触发事件回调', () => {
      const callback = vi.fn();
      replay.onEvent(callback);
      
      replay.play(recordingId);
      vi.advanceTimersByTime(100);
      
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('应该传递正确的事件数据', () => {
      const callback = vi.fn();
      replay.onEvent(callback);
      
      replay.play(recordingId);
      vi.advanceTimersByTime(10);
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'expression',
          data: { name: 'happy' }
        })
      );
    });

    it('应该能取消订阅', () => {
      const callback = vi.fn();
      const unsubscribe = replay.onEvent(callback);
      
      unsubscribe();
      
      replay.play(recordingId);
      vi.advanceTimersByTime(100);
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('回调抛出错误不应中断播放', () => {
      const callback1 = vi.fn(() => { throw new Error('test'); });
      const callback2 = vi.fn();
      
      replay.onEvent(callback1);
      replay.onEvent(callback2);
      
      replay.play(recordingId);
      vi.advanceTimersByTime(100);
      
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('状态回调', () => {
    it('应该触发状态变化回调', () => {
      const callback = vi.fn();
      replay.onStateChange(callback);
      
      replay.startRecording();
      
      expect(callback).toHaveBeenCalled();
    });

    it('应该能取消状态订阅', () => {
      const callback = vi.fn();
      const unsubscribe = replay.onStateChange(callback);
      
      unsubscribe();
      replay.startRecording();
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('导入导出', () => {
    let recordingId: string;

    beforeEach(() => {
      replay.startRecording();
      replay.recordEvent('expression', { name: 'happy' });
      const recording = replay.stopRecording('Export Test');
      recordingId = recording!.id;
    });

    it('应该能导出录制', () => {
      const json = replay.exportRecording(recordingId);
      expect(json).not.toBeNull();
      
      const parsed = JSON.parse(json!);
      expect(parsed.name).toBe('Export Test');
    });

    it('导出不存在的录制应该返回 null', () => {
      const json = replay.exportRecording('nonexistent');
      expect(json).toBeNull();
    });

    it('应该能导入录制', () => {
      const json = replay.exportRecording(recordingId)!;
      replay.clearRecordings();
      
      const imported = replay.importRecording(json);
      
      expect(imported).not.toBeNull();
      expect(imported?.name).toBe('Export Test');
    });

    it('导入无效 JSON 应该返回 null', () => {
      const imported = replay.importRecording('invalid json');
      expect(imported).toBeNull();
    });

    it('导入不完整的数据应该返回 null', () => {
      const imported = replay.importRecording('{}');
      expect(imported).toBeNull();
    });

    it('导入应该生成新 ID', () => {
      const json = replay.exportRecording(recordingId)!;
      const imported = replay.importRecording(json);
      
      expect(imported?.id).not.toBe(recordingId);
    });
  });

  describe('持久化', () => {
    it('autoSave 为 true 时应该保存到 storage', () => {
      const replayWithStorage = new SessionReplay({
        autoSave: true,
        storageKey: 'test-recordings'
      });
      
      replayWithStorage.startRecording();
      replayWithStorage.recordEvent('expression', { name: 'happy' });
      replayWithStorage.stopRecording();
      
      expect(mockStorage.has('test-recordings')).toBe(true);
      
      replayWithStorage.destroy();
    });

    it('应该从 storage 加载录制', () => {
      const recording: Recording = {
        id: 'loaded-1',
        name: 'Loaded Recording',
        createdAt: Date.now(),
        duration: 1000,
        events: [{ timestamp: 0, type: 'expression', data: {} }]
      };
      
      mockStorage.set('test-recordings', JSON.stringify([recording]));
      
      const replayWithStorage = new SessionReplay({
        autoSave: true,
        storageKey: 'test-recordings'
      });
      
      expect(replayWithStorage.getRecordings().length).toBe(1);
      
      replayWithStorage.destroy();
    });
  });

  describe('销毁', () => {
    it('应该清理所有资源', () => {
      replay.startRecording();
      replay.recordEvent('expression', { name: 'happy' });
      replay.stopRecording();
      
      const callback = vi.fn();
      replay.onEvent(callback);
      
      replay.destroy();
      
      expect(replay.getRecordings().length).toBe(0);
    });

    it('销毁应该停止播放', () => {
      replay.startRecording();
      replay.recordEvent('expression', { name: 'happy' });
      const recording = replay.stopRecording();
      
      replay.play(recording!.id);
      replay.destroy();
      
      expect(replay.getState().isPlaying).toBe(false);
    });
  });
});
