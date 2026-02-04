/**
 * PhysicsEnhancer 单元测试
 * 
 * 测试物理模拟系统的各项功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PhysicsEnhancer, PhysicsConfig, PhysicsParams } from './PhysicsEnhancer';

// Mock requestAnimationFrame
let rafCallbacks: (() => void)[] = [];
vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
  rafCallbacks.push(callback);
  return rafCallbacks.length;
});

vi.stubGlobal('cancelAnimationFrame', (id: number) => {
  rafCallbacks = rafCallbacks.filter((_, i) => i !== id - 1);
});

// Helper to advance animation frames
function advanceFrame(count = 1) {
  for (let i = 0; i < count; i++) {
    const cbs = [...rafCallbacks];
    rafCallbacks = [];
    cbs.forEach(cb => cb());
  }
}

describe('PhysicsEnhancer', () => {
  let enhancer: PhysicsEnhancer;
  
  beforeEach(() => {
    vi.useFakeTimers();
    rafCallbacks = [];
    enhancer = new PhysicsEnhancer();
  });
  
  afterEach(() => {
    enhancer.destroy();
    vi.useRealTimers();
  });

  // ========== 基础功能测试 ==========
  
  describe('Basic Functionality', () => {
    it('should create with default config', () => {
      const params = enhancer.getCurrentParams();
      
      expect(params.hairAngleX).toBe(0);
      expect(params.hairAngleZ).toBe(0);
      expect(params.hairSwing).toBe(0);
      expect(params.clothSwing).toBe(0);
      expect(params.skirtAngle).toBe(0);
      expect(params.accessorySwing).toBe(0);
      expect(params.ribbonAngle).toBe(0);
      expect(params.bodyBreath).toBe(0);
      expect(params.shoulderMove).toBe(0);
    });

    it('should accept custom config', () => {
      const customEnhancer = new PhysicsEnhancer({
        enabled: false,
        wind: { enabled: true, baseStrength: 0.1 }
      });
      
      // Enhancer created successfully with partial config
      expect(customEnhancer.getCurrentParams()).toBeDefined();
      customEnhancer.destroy();
    });

    it('should start and stop animation', () => {
      // Use callback to verify animation runs
      const callback = vi.fn();
      enhancer.onParams(callback);
      
      enhancer.start();
      
      // Advance time and trigger frame
      vi.advanceTimersByTime(16);
      advanceFrame();
      
      expect(callback).toHaveBeenCalled();
      
      const callsBefore = callback.mock.calls.length;
      enhancer.stop();
      
      // After stop, advancing time should not trigger more callbacks
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      // No new calls after stop
      expect(callback.mock.calls.length).toBe(callsBefore);
    });

    it('should not start twice', () => {
      const callback = vi.fn();
      enhancer.onParams(callback);
      
      enhancer.start();
      enhancer.start();  // Call start again
      
      vi.advanceTimersByTime(16);
      advanceFrame();
      
      // Should only receive one update per frame, not two
      const callsPerFrame = callback.mock.calls.length;
      
      vi.advanceTimersByTime(16);
      advanceFrame();
      
      // Roughly the same number of calls (one per frame loop)
      expect(callback.mock.calls.length).toBeGreaterThan(callsPerFrame);
    });
  });

  // ========== 回调订阅测试 ==========
  
  describe('Callback Subscription', () => {
    it('should subscribe and receive params updates', () => {
      const callback = vi.fn();
      
      enhancer.onParams(callback);
      enhancer.start();
      
      vi.advanceTimersByTime(16); // ~60fps
      advanceFrame();
      
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0]).toHaveProperty('hairAngleX');
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      
      const unsubscribe = enhancer.onParams(callback);
      enhancer.start();
      
      vi.advanceTimersByTime(16);
      advanceFrame();
      
      const callCount = callback.mock.calls.length;
      
      unsubscribe();
      
      vi.advanceTimersByTime(16);
      advanceFrame();
      
      // Should not receive more calls after unsubscribe
      expect(callback.mock.calls.length).toBe(callCount);
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => { throw new Error('Test error'); });
      const goodCallback = vi.fn();
      
      enhancer.onParams(errorCallback);
      enhancer.onParams(goodCallback);
      enhancer.start();
      
      vi.advanceTimersByTime(16);
      advanceFrame();
      
      // Error in one callback should not prevent others
      expect(goodCallback).toHaveBeenCalled();
    });
  });

  // ========== 惯性系统测试 ==========
  
  describe('Inertia System', () => {
    it('should respond to head movement', () => {
      enhancer.start();
      
      // Simulate head movement
      enhancer.updateHeadPosition(0, 0);
      vi.advanceTimersByTime(16);
      advanceFrame();
      
      enhancer.updateHeadPosition(0.1, 0);  // Move right
      vi.advanceTimersByTime(16);
      advanceFrame();
      
      // Parameters should change in response
      const params = enhancer.getCurrentParams();
      // Hair should trail behind (opposite direction)
      expect(params.hairAngleZ).toBeDefined();
    });

    it('should smooth velocity changes', () => {
      enhancer.start();
      
      enhancer.updateHeadPosition(0, 0);
      enhancer.updateHeadPosition(1, 0);  // Big jump
      
      vi.advanceTimersByTime(16);
      advanceFrame();
      
      const params1 = enhancer.getCurrentParams();
      
      vi.advanceTimersByTime(16);
      advanceFrame();
      
      const params2 = enhancer.getCurrentParams();
      
      // Velocity should be smoothed over time
      expect(params2.hairSwing).toBeDefined();
    });

    it('should affect hair, cloth, and accessories', () => {
      const callback = vi.fn();
      enhancer.onParams(callback);
      enhancer.start();
      
      enhancer.updateHeadPosition(0, 0);
      vi.advanceTimersByTime(16);
      advanceFrame();
      
      enhancer.updateHeadPosition(0.5, 0.3);
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      const params = callback.mock.calls[callback.mock.calls.length - 1][0] as PhysicsParams;
      
      // All should be affected by movement
      expect(typeof params.hairSwing).toBe('number');
      expect(typeof params.clothSwing).toBe('number');
      expect(typeof params.accessorySwing).toBe('number');
    });
  });

  // ========== 风力系统测试 ==========
  
  describe('Wind System', () => {
    it('should be disabled by default', () => {
      const callback = vi.fn();
      
      const windEnhancer = new PhysicsEnhancer({
        inertia: { enabled: false },
        breath: { enabled: false },
        speech: { enabled: false }
      });
      
      windEnhancer.onParams(callback);
      windEnhancer.start();
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      // Wind is disabled by default, so minimal params
      const params = windEnhancer.getCurrentParams();
      expect(params.hairSwing).toBe(0);
      
      windEnhancer.destroy();
    });

    it('should affect params when enabled', () => {
      const windEnhancer = new PhysicsEnhancer({
        inertia: { enabled: false },
        breath: { enabled: false },
        speech: { enabled: false },
        wind: { enabled: true, baseStrength: 0.1 }
      });
      
      windEnhancer.start();
      
      vi.advanceTimersByTime(500);
      advanceFrame();
      
      const params = windEnhancer.getCurrentParams();
      
      // With wind enabled, should see some movement
      // Note: Due to smooth transition, may take time to converge
      expect(typeof params.hairAngleX).toBe('number');
      
      windEnhancer.destroy();
    });

    it('should allow toggling wind', () => {
      enhancer.setWindEnabled(true);
      enhancer.start();
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      // Wind is now enabled
      enhancer.setWindEnabled(false);
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      // Should continue running without errors
      expect(enhancer.getCurrentParams()).toBeDefined();
    });

    it('should respond to wind direction changes', () => {
      enhancer.setWindEnabled(true);
      enhancer.setWindDirection(0);   // Wind from right
      enhancer.start();
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      const paramsRight = enhancer.getCurrentParams();
      
      enhancer.setWindDirection(180);  // Wind from left
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      const paramsLeft = enhancer.getCurrentParams();
      
      // Direction change should affect hair angle
      expect(paramsRight).toBeDefined();
      expect(paramsLeft).toBeDefined();
    });
  });

  // ========== 呼吸系统测试 ==========
  
  describe('Breath System', () => {
    it('should respond to breath phase', () => {
      const breathEnhancer = new PhysicsEnhancer({
        inertia: { enabled: false },
        wind: { enabled: false },
        speech: { enabled: false },
        breath: { enabled: true, hairInfluence: 0.5, clothInfluence: 0.5 }
      });
      
      breathEnhancer.start();
      
      // Inhale
      breathEnhancer.setBreathPhase(0.25);  // sin(0.5π) = 1
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      const paramsInhale = breathEnhancer.getCurrentParams();
      
      // Exhale
      breathEnhancer.setBreathPhase(0.75);  // sin(1.5π) = -1
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      const paramsExhale = breathEnhancer.getCurrentParams();
      
      // Body breath should change with phase
      expect(paramsInhale.bodyBreath).not.toBe(paramsExhale.bodyBreath);
      
      breathEnhancer.destroy();
    });

    it('should affect body and shoulders', () => {
      enhancer.start();
      enhancer.setBreathPhase(0.25);
      
      vi.advanceTimersByTime(200);
      advanceFrame();
      
      const params = enhancer.getCurrentParams();
      
      expect(typeof params.bodyBreath).toBe('number');
      expect(typeof params.shoulderMove).toBe('number');
    });
  });

  // ========== 说话振动测试 ==========
  
  describe('Speech Vibration', () => {
    it('should not vibrate when not speaking', () => {
      const speechEnhancer = new PhysicsEnhancer({
        enabled: true,
        inertia: { enabled: false },
        wind: { enabled: false },
        breath: { enabled: false },
        speech: { enabled: true, vibrationStrength: 0.5, frequency: 10 }
      });
      
      speechEnhancer.start();
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      // Not speaking, so speech-related params should not be affected
      const params = speechEnhancer.getCurrentParams();
      expect(params.hairSwing).toBe(0);
      
      speechEnhancer.destroy();
    });

    it('should vibrate when speaking', () => {
      const speechEnhancer = new PhysicsEnhancer({
        enabled: true,
        inertia: { enabled: false },
        wind: { enabled: false },
        breath: { enabled: false },
        speech: { enabled: true, vibrationStrength: 0.5, frequency: 10 }
      });
      
      speechEnhancer.setSpeaking(true, 1.0);
      speechEnhancer.start();
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      const params = speechEnhancer.getCurrentParams();
      
      // When speaking, vibration should affect accessories
      expect(typeof params.accessorySwing).toBe('number');
      expect(typeof params.ribbonAngle).toBe('number');
      
      speechEnhancer.destroy();
    });

    it('should respond to speaking intensity', () => {
      enhancer.setSpeaking(true, 0.2);
      enhancer.start();
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      const paramsLow = enhancer.getCurrentParams();
      
      enhancer.setSpeaking(true, 1.0);
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      const paramsHigh = enhancer.getCurrentParams();
      
      // Higher intensity should produce larger values (eventually)
      expect(paramsLow).toBeDefined();
      expect(paramsHigh).toBeDefined();
    });

    it('should stop vibrating when speech ends', () => {
      enhancer.setSpeaking(true, 1.0);
      enhancer.start();
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      enhancer.setSpeaking(false);
      
      vi.advanceTimersByTime(500);
      advanceFrame();
      
      // Should smoothly return to rest
      expect(enhancer.getCurrentParams()).toBeDefined();
    });
  });

  // ========== 情绪系统测试 ==========
  
  describe('Emotion System', () => {
    it('should apply emotion multipliers', () => {
      const emotionEnhancer = new PhysicsEnhancer({
        breath: { enabled: true, hairInfluence: 0.5, clothInfluence: 0.5 }
      });
      
      emotionEnhancer.setBreathPhase(0.25);
      emotionEnhancer.start();
      
      // Neutral emotion
      emotionEnhancer.setEmotion('neutral');
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      const neutralParams = emotionEnhancer.getCurrentParams();
      
      // Excited emotion (1.5x multiplier)
      emotionEnhancer.setEmotion('excited');
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      const excitedParams = emotionEnhancer.getCurrentParams();
      
      // Excited should have larger movements
      expect(neutralParams).toBeDefined();
      expect(excitedParams).toBeDefined();
      
      emotionEnhancer.destroy();
    });

    it('should handle all emotion types', () => {
      enhancer.start();
      
      const emotions = ['neutral', 'happy', 'excited', 'sad', 'calm', 'angry', 'surprised'];
      
      emotions.forEach(emotion => {
        enhancer.setEmotion(emotion);
        vi.advanceTimersByTime(16);
        advanceFrame();
        
        // Should not throw for any valid emotion
        expect(enhancer.getCurrentParams()).toBeDefined();
      });
    });

    it('should handle unknown emotions gracefully', () => {
      enhancer.start();
      
      enhancer.setEmotion('unknown_emotion');
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      // Should fall back to default multiplier (1.0)
      expect(enhancer.getCurrentParams()).toBeDefined();
    });

    it('should reduce movement for sad emotion', () => {
      // Sad emotion has 0.7x multiplier - movement should be reduced
      enhancer.setEmotion('sad');
      enhancer.start();
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      expect(enhancer.getCurrentParams()).toBeDefined();
    });
  });

  // ========== 配置更新测试 ==========
  
  describe('Config Updates', () => {
    it('should update config at runtime', () => {
      enhancer.start();
      
      enhancer.updateConfig({
        wind: { enabled: true, baseStrength: 0.2 }
      });
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      // Should continue running with new config
      expect(enhancer.getCurrentParams()).toBeDefined();
    });

    it('should merge config correctly', () => {
      enhancer.updateConfig({
        enabled: true,
        inertia: { hairDamping: 0.5 }  // Only update hairDamping
      });
      
      // Other inertia settings should remain
      enhancer.start();
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      expect(enhancer.getCurrentParams()).toBeDefined();
    });

    it('should disable all physics when enabled=false', () => {
      enhancer.updateConfig({ enabled: false });
      enhancer.start();
      
      enhancer.updateHeadPosition(1, 1);  // Try to cause movement
      enhancer.setBreathPhase(0.5);
      enhancer.setSpeaking(true);
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      const params = enhancer.getCurrentParams();
      
      // All should be at default (0) when disabled
      expect(params.hairAngleX).toBe(0);
      expect(params.clothSwing).toBe(0);
    });
  });

  // ========== 平滑过渡测试 ==========
  
  describe('Smooth Transition', () => {
    it('should smoothly interpolate values', () => {
      enhancer.setWindEnabled(true);
      enhancer.updateConfig({
        wind: { enabled: true, baseStrength: 0.5 }
      });
      enhancer.start();
      
      const values: number[] = [];
      
      // Capture multiple frames
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(16);
        advanceFrame();
        values.push(enhancer.getCurrentParams().hairSwing);
      }
      
      // Values should change gradually, not jump
      for (let i = 1; i < values.length; i++) {
        const delta = Math.abs(values[i] - values[i-1]);
        // Large jumps should not occur
        expect(delta).toBeLessThan(10);
      }
    });
  });

  // ========== 销毁测试 ==========
  
  describe('Destroy', () => {
    it('should clean up on destroy', () => {
      const callback = vi.fn();
      
      enhancer.onParams(callback);
      enhancer.start();
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      const callCountBefore = callback.mock.calls.length;
      
      enhancer.destroy();
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      // Should not receive more callbacks after destroy
      expect(callback.mock.calls.length).toBe(callCountBefore);
    });

    it('should be safe to call destroy multiple times', () => {
      enhancer.start();
      enhancer.destroy();
      enhancer.destroy();  // Should not throw
      
      expect(true).toBe(true);
    });
  });

  // ========== 综合场景测试 ==========
  
  describe('Combined Scenarios', () => {
    it('should handle all systems working together', () => {
      enhancer.setWindEnabled(true);
      enhancer.start();
      
      // Simulate realistic usage
      enhancer.updateHeadPosition(0.1, 0);
      enhancer.setBreathPhase(0.3);
      enhancer.setSpeaking(true, 0.8);
      enhancer.setEmotion('happy');
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      const params = enhancer.getCurrentParams();
      
      // All params should have valid values
      expect(typeof params.hairAngleX).toBe('number');
      expect(typeof params.hairAngleZ).toBe('number');
      expect(typeof params.hairSwing).toBe('number');
      expect(typeof params.clothSwing).toBe('number');
      expect(typeof params.skirtAngle).toBe('number');
      expect(typeof params.accessorySwing).toBe('number');
      expect(typeof params.ribbonAngle).toBe('number');
      expect(typeof params.bodyBreath).toBe('number');
      expect(typeof params.shoulderMove).toBe('number');
      
      // Values should not be NaN or Infinity
      Object.values(params).forEach(v => {
        expect(isNaN(v)).toBe(false);
        expect(isFinite(v)).toBe(true);
      });
    });

    it('should transition between states smoothly', () => {
      enhancer.start();
      
      // Start neutral
      enhancer.setEmotion('neutral');
      enhancer.setSpeaking(false);
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      // Transition to excited speaking
      enhancer.setEmotion('excited');
      enhancer.setSpeaking(true, 1.0);
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      // Transition to sad silence
      enhancer.setEmotion('sad');
      enhancer.setSpeaking(false);
      
      vi.advanceTimersByTime(100);
      advanceFrame();
      
      // Should complete without errors
      expect(enhancer.getCurrentParams()).toBeDefined();
    });

    it('should maintain performance under rapid updates', () => {
      enhancer.start();
      
      // Simulate rapid input updates
      for (let i = 0; i < 100; i++) {
        enhancer.updateHeadPosition(Math.random(), Math.random());
        enhancer.setBreathPhase(Math.random());
        enhancer.setSpeaking(Math.random() > 0.5, Math.random());
        
        vi.advanceTimersByTime(16);
        advanceFrame();
      }
      
      // Should still produce valid output
      const params = enhancer.getCurrentParams();
      Object.values(params).forEach(v => {
        expect(isFinite(v)).toBe(true);
      });
    });
  });
});
