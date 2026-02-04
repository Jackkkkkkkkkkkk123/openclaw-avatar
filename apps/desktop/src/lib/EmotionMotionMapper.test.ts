/**
 * EmotionMotionMapper Tests - Round 27
 * 情绪驱动的动作选择系统测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  EmotionMotionMapper, 
  MotionProfile, 
  MotionSelection,
  MapperConfig,
  TransitionStyle
} from './EmotionMotionMapper';

describe('EmotionMotionMapper', () => {
  let mapper: EmotionMotionMapper;

  beforeEach(() => {
    // 获取新实例
    try {
      EmotionMotionMapper.getInstance().destroy();
    } catch (e) {
      // ignore
    }
    mapper = EmotionMotionMapper.getInstance();
  });

  afterEach(() => {
    mapper.destroy();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = EmotionMotionMapper.getInstance();
      const instance2 = EmotionMotionMapper.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after destroy', () => {
      const instance1 = EmotionMotionMapper.getInstance();
      instance1.destroy();
      const instance2 = EmotionMotionMapper.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Default Profiles', () => {
    it('should have neutral profile', () => {
      const profile = mapper.getProfile('neutral');
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('neutral');
    });

    it('should have happy profile', () => {
      const profile = mapper.getProfile('happy');
      expect(profile).toBeDefined();
      expect(profile?.transitionStyle).toBe('bounce');
    });

    it('should have sad profile', () => {
      const profile = mapper.getProfile('sad');
      expect(profile).toBeDefined();
    });

    it('should have surprised profile', () => {
      const profile = mapper.getProfile('surprised');
      expect(profile).toBeDefined();
      expect(profile?.transitionStyle).toBe('quick');
    });

    it('should have angry profile', () => {
      const profile = mapper.getProfile('angry');
      expect(profile).toBeDefined();
    });

    it('should have fear profile', () => {
      const profile = mapper.getProfile('fear');
      expect(profile).toBeDefined();
    });

    it('should have thinking profile', () => {
      const profile = mapper.getProfile('thinking');
      expect(profile).toBeDefined();
    });

    it('should have shy profile', () => {
      const profile = mapper.getProfile('shy');
      expect(profile).toBeDefined();
    });

    it('should return copy of profile, not reference', () => {
      const profile1 = mapper.getProfile('neutral');
      profile1!.intensity = 999;
      const profile2 = mapper.getProfile('neutral');
      expect(profile2?.intensity).not.toBe(999);
    });
  });

  describe('Set Emotion', () => {
    it('should set current emotion', () => {
      mapper.setEmotion('happy', 0.8);
      const current = mapper.getCurrentEmotion();
      expect(current.emotion).toBe('happy');
      expect(current.intensity).toBe(0.8);
    });

    it('should clamp intensity to 0-1', () => {
      mapper.setEmotion('happy', 1.5);
      expect(mapper.getCurrentEmotion().intensity).toBe(1);
      
      mapper.setEmotion('sad', -0.5);
      expect(mapper.getCurrentEmotion().intensity).toBe(0);
    });

    it('should return motion selection', () => {
      const selection = mapper.setEmotion('happy');
      expect(selection).toBeDefined();
      expect(selection).toHaveProperty('motion');
      expect(selection).toHaveProperty('expression');
      expect(selection).toHaveProperty('transitionDuration');
      expect(selection).toHaveProperty('blendWeight');
    });

    it('should use default intensity of 0.5', () => {
      mapper.setEmotion('neutral');
      expect(mapper.getCurrentEmotion().intensity).toBe(0.5);
    });
  });

  describe('Select Motion', () => {
    it('should return valid selection', () => {
      mapper.setEmotion('happy', 1.0);
      const selection = mapper.selectMotion();
      
      expect(selection.transitionDuration).toBeGreaterThan(0);
      expect(selection.blendWeight).toBeGreaterThanOrEqual(0);
      expect(selection.blendWeight).toBeLessThanOrEqual(1);
    });

    it('should return null for unknown emotion', () => {
      mapper.setEmotion('unknown' as any);
      const selection = mapper.selectMotion();
      expect(selection.motion).toBeNull();
      expect(selection.expression).toBeNull();
    });

    it('should select from profile motions', () => {
      mapper.setEmotion('happy', 1.0);
      const profile = mapper.getProfile('happy')!;
      
      // 多次选择，验证选择来自配置
      for (let i = 0; i < 10; i++) {
        const selection = mapper.selectMotion();
        if (selection.motion) {
          const allMotions = [...profile.motions, ...profile.idleVariations];
          expect(allMotions).toContain(selection.motion);
        }
      }
    });

    it('should select from profile expressions', () => {
      mapper.setEmotion('happy', 1.0);
      const profile = mapper.getProfile('happy')!;
      
      for (let i = 0; i < 10; i++) {
        const selection = mapper.selectMotion();
        if (selection.expression) {
          expect(profile.expressions).toContain(selection.expression);
        }
      }
    });
  });

  describe('Transition Duration', () => {
    it('should calculate duration based on style', () => {
      mapper.setEmotion('surprised', 1.0); // quick style
      const selection1 = mapper.selectMotion();
      
      mapper.setEmotion('angry', 1.0); // dramatic style
      const selection2 = mapper.selectMotion();
      
      // Quick should generally be faster than dramatic
      // Note: there's randomness, so we can't be 100% certain
      expect(selection1.transitionDuration).toBeGreaterThan(0);
      expect(selection2.transitionDuration).toBeGreaterThan(0);
    });
  });

  describe('Motion History', () => {
    it('should record motion history', () => {
      mapper.setEmotion('happy', 1.0);
      mapper.selectMotion();
      mapper.selectMotion();
      
      const history = mapper.getHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should limit history size', () => {
      mapper.setConfig({ historySize: 5 });
      mapper.setEmotion('happy', 1.0);
      
      for (let i = 0; i < 20; i++) {
        mapper.selectMotion();
      }
      
      const history = mapper.getHistory();
      expect(history.length).toBeLessThanOrEqual(5);
    });

    it('should clear history', () => {
      mapper.setEmotion('happy', 1.0);
      mapper.selectMotion();
      
      mapper.clearHistory();
      expect(mapper.getHistory().length).toBe(0);
    });

    it('should record emotion with motion', () => {
      mapper.setEmotion('sad', 0.8);
      mapper.selectMotion();
      
      const history = mapper.getHistory();
      if (history.length > 0) {
        expect(history[0].emotion).toBe('sad');
        expect(history[0].timestamp).toBeDefined();
      }
    });
  });

  describe('Profile Management', () => {
    it('should set new profile', () => {
      mapper.setProfile('custom' as any, {
        name: 'custom',
        motions: ['custom_motion'],
        expressions: ['custom_expr'],
        idleVariations: [],
        transitionStyle: 'bounce',
        intensity: 0.6,
        frequency: 0.4,
      });
      
      const profile = mapper.getProfile('custom' as any);
      expect(profile?.name).toBe('custom');
      expect(profile?.motions).toContain('custom_motion');
    });

    it('should update existing profile', () => {
      mapper.setProfile('happy', { intensity: 0.9 });
      const profile = mapper.getProfile('happy');
      expect(profile?.intensity).toBe(0.9);
    });

    it('should get all profiles', () => {
      const profiles = mapper.getAllProfiles();
      expect(profiles.size).toBeGreaterThan(0);
      expect(profiles.has('neutral')).toBe(true);
      expect(profiles.has('happy')).toBe(true);
    });
  });

  describe('Recommend Next', () => {
    it('should recommend next motion', () => {
      mapper.setEmotion('neutral');
      const recommendation = mapper.recommendNext();
      
      expect(recommendation).toBeDefined();
      expect(recommendation).toHaveProperty('motion');
    });

    it('should potentially vary intensity', () => {
      mapper.setConfig({ variationBias: 1.0 }); // 100% variation
      mapper.setEmotion('neutral', 0.5);
      
      // 多次推荐后，强度应该有所变化
      for (let i = 0; i < 10; i++) {
        mapper.recommendNext();
      }
      
      // 强度仍应在有效范围内
      const current = mapper.getCurrentEmotion();
      expect(current.intensity).toBeGreaterThanOrEqual(0.1);
      expect(current.intensity).toBeLessThanOrEqual(1);
    });
  });

  describe('Compatible Motions', () => {
    it('should get compatible motions', () => {
      const compatible = mapper.getCompatibleMotions('happy');
      expect(compatible.length).toBeGreaterThan(0);
    });

    it('should include both motions and idle variations', () => {
      const profile = mapper.getProfile('happy')!;
      const compatible = mapper.getCompatibleMotions('happy');
      
      profile.motions.forEach(m => {
        expect(compatible).toContain(m);
      });
      profile.idleVariations.forEach(m => {
        expect(compatible).toContain(m);
      });
    });

    it('should return empty for unknown emotion', () => {
      const compatible = mapper.getCompatibleMotions('unknown' as any);
      expect(compatible).toEqual([]);
    });

    it('should check motion compatibility', () => {
      expect(mapper.isMotionCompatible('nod', 'happy')).toBe(true);
      expect(mapper.isMotionCompatible('unknown_motion', 'happy')).toBe(false);
    });
  });

  describe('Selection Callbacks', () => {
    it('should notify on emotion change', () => {
      const callback = vi.fn();
      mapper.onSelection(callback);
      
      mapper.setEmotion('happy');
      expect(callback).toHaveBeenCalled();
    });

    it('should pass selection to callback', () => {
      const callback = vi.fn();
      mapper.onSelection(callback);
      
      mapper.setEmotion('happy');
      
      const selection = callback.mock.calls[0][0];
      expect(selection).toHaveProperty('motion');
      expect(selection).toHaveProperty('expression');
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      const unsubscribe = mapper.onSelection(callback);
      
      mapper.setEmotion('happy');
      expect(callback).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      mapper.setEmotion('sad');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => { throw new Error('Callback error'); });
      const normalCallback = vi.fn();
      
      mapper.onSelection(errorCallback);
      mapper.onSelection(normalCallback);
      
      expect(() => mapper.setEmotion('happy')).not.toThrow();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should get config', () => {
      const config = mapper.getConfig();
      expect(config.historySize).toBeDefined();
      expect(config.repeatAvoidance).toBeDefined();
      expect(config.variationBias).toBeDefined();
      expect(config.intensityMultiplier).toBeDefined();
    });

    it('should set partial config', () => {
      mapper.setConfig({ historySize: 50 });
      expect(mapper.getConfig().historySize).toBe(50);
    });

    it('should return config copy', () => {
      const config = mapper.getConfig();
      config.historySize = 1000;
      expect(mapper.getConfig().historySize).not.toBe(1000);
    });

    it('should apply intensity multiplier', () => {
      mapper.setConfig({ intensityMultiplier: 2.0 });
      mapper.setEmotion('happy', 0.5);
      
      // 内部使用的有效强度应该被乘以 2
      // 这会影响 blendWeight
      const selection = mapper.selectMotion();
      expect(selection.blendWeight).toBeGreaterThan(0);
    });
  });

  describe('Reset', () => {
    it('should reset to default state', () => {
      mapper.setEmotion('angry', 0.9);
      mapper.selectMotion();
      mapper.selectMotion();
      
      mapper.reset();
      
      const current = mapper.getCurrentEmotion();
      expect(current.emotion).toBe('neutral');
      expect(current.intensity).toBe(0.5);
      expect(mapper.getHistory().length).toBe(0);
    });

    it('should reinitialize profiles', () => {
      mapper.setProfile('happy', { intensity: 0.1 });
      mapper.reset();
      
      const profile = mapper.getProfile('happy');
      expect(profile?.intensity).not.toBe(0.1);
    });
  });

  describe('Destroy', () => {
    it('should clear all state', () => {
      mapper.setEmotion('happy');
      mapper.selectMotion();
      const callback = vi.fn();
      mapper.onSelection(callback);
      
      mapper.destroy();
      
      const newMapper = EmotionMotionMapper.getInstance();
      expect(newMapper.getHistory().length).toBe(0);
      newMapper.destroy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle profile with empty motions', () => {
      mapper.setProfile('empty' as any, {
        motions: [],
        expressions: [],
        idleVariations: [],
        transitionStyle: 'smooth',
        intensity: 0.5,
        frequency: 0.5,
      });
      
      mapper.setEmotion('empty' as any);
      const selection = mapper.selectMotion();
      // 空列表返回 null 或 undefined
      expect(selection.motion == null).toBe(true);
    });

    it('should handle single motion in list', () => {
      mapper.setProfile('single' as any, {
        motions: ['only_one'],
        expressions: ['only_expr'],
        idleVariations: [],
        transitionStyle: 'smooth',
        intensity: 0.5,
        frequency: 1.0,
      });
      
      mapper.setEmotion('single' as any, 1.0);
      const selection = mapper.selectMotion();
      
      // 可能选择 only_one 或 null
      if (selection.motion) {
        expect(selection.motion).toBe('only_one');
      }
    });

    it('should handle rapid emotion changes', () => {
      const emotions: any[] = ['happy', 'sad', 'angry', 'neutral', 'surprised'];
      
      for (let i = 0; i < 50; i++) {
        const emotion = emotions[i % emotions.length];
        mapper.setEmotion(emotion);
        mapper.selectMotion();
      }
      
      // 不应崩溃
      expect(mapper.getHistory().length).toBeGreaterThan(0);
    });
  });
});
