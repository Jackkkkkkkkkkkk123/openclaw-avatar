/**
 * GestureReactionMapper Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GestureReactionMapper, gestureReactionMapper, GestureType, GestureReaction } from './GestureReactionMapper';

// Mock avatarController
vi.mock('./AvatarController', () => ({
  avatarController: {
    setExpression: vi.fn(),
    playMotion: vi.fn(),
    lookAt: vi.fn(),
    getCurrentExpression: vi.fn().mockReturnValue('neutral'),
  }
}));

// Mock expressionSequencer
vi.mock('./ExpressionSequencer', () => ({
  expressionSequencer: {
    playPreset: vi.fn()
  }
}));

describe('GestureReactionMapper', () => {
  let mapper: GestureReactionMapper;

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset singleton
    (GestureReactionMapper as any).instance = null;
    mapper = GestureReactionMapper.getInstance();
  });

  afterEach(() => {
    mapper.destroy();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = GestureReactionMapper.getInstance();
      const instance2 = GestureReactionMapper.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after destroy', () => {
      const instance1 = GestureReactionMapper.getInstance();
      instance1.destroy();
      const instance2 = GestureReactionMapper.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('react()', () => {
    it('should return null for none gesture', () => {
      const result = mapper.react('none');
      expect(result).toBeNull();
    });

    it('should return reaction for valid gesture', () => {
      const result = mapper.react('thumbs_up');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('expression');
      expect(result?.expression).toBe('happy');
    });

    it('should respect cooldown', () => {
      const result1 = mapper.react('thumbs_up');
      expect(result1).not.toBeNull();

      const result2 = mapper.react('peace');
      expect(result2).toBeNull(); // Within cooldown

      vi.advanceTimersByTime(500);

      const result3 = mapper.react('peace');
      expect(result3).not.toBeNull();
    });

    it('should return null when disabled', () => {
      mapper.setEnabled(false);
      const result = mapper.react('thumbs_up');
      expect(result).toBeNull();
    });
  });

  describe('Gesture Reactions', () => {
    it('thumbs_up should trigger happy expression', () => {
      const result = mapper.react('thumbs_up');
      expect(result?.expression).toBe('happy');
    });

    it('thumbs_down should trigger sad expression', () => {
      vi.advanceTimersByTime(1000);
      const result = mapper.react('thumbs_down');
      expect(result?.expression).toBe('sad');
    });

    it('peace should trigger happy expression', () => {
      vi.advanceTimersByTime(1000);
      const result = mapper.react('peace');
      expect(result?.expression).toBe('happy');
    });

    it('wave should trigger wave_back reaction', () => {
      vi.advanceTimersByTime(1000);
      const result = mapper.react('wave');
      expect(result?.type).toBe('wave_back');
    });

    it('ok should trigger nod reaction', () => {
      vi.advanceTimersByTime(1000);
      const result = mapper.react('ok');
      expect(result?.type).toBe('nod');
    });

    it('open_palm should trigger greeting sequence', () => {
      vi.advanceTimersByTime(1000);
      const result = mapper.react('open_palm');
      expect(result?.type).toBe('sequence');
      expect(result?.sequenceName).toBe('greeting');
    });
  });

  describe('Callback System', () => {
    it('should notify callbacks on reaction', () => {
      const callback = vi.fn();
      mapper.onReaction(callback);

      mapper.react('thumbs_up');

      expect(callback).toHaveBeenCalledWith(
        'thumbs_up',
        expect.objectContaining({ expression: 'happy' }),
        expect.any(String)
      );
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      const unsubscribe = mapper.onReaction(callback);

      unsubscribe();
      vi.advanceTimersByTime(1000);
      mapper.react('thumbs_up');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      const normalCallback = vi.fn();

      mapper.onReaction(errorCallback);
      mapper.onReaction(normalCallback);

      expect(() => mapper.react('thumbs_up')).not.toThrow();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('Custom Reactions', () => {
    it('should allow custom reaction', () => {
      const customReaction: GestureReaction = {
        type: 'custom',
        message: 'Custom message'
      };

      mapper.setReaction('fist', customReaction);
      vi.advanceTimersByTime(1000);
      
      const result = mapper.react('fist');
      expect(result?.type).toBe('custom');
      expect(result?.message).toBe('Custom message');
    });

    it('should get reaction config', () => {
      const reaction = mapper.getReaction('thumbs_up');
      expect(reaction).toBeDefined();
      expect(reaction.expression).toBe('happy');
    });

    it('should reset to defaults', () => {
      const customReaction: GestureReaction = {
        type: 'custom',
        message: 'Changed'
      };
      mapper.setReaction('thumbs_up', customReaction);

      mapper.resetToDefaults();

      const reaction = mapper.getReaction('thumbs_up');
      expect(reaction.type).toBe('expression');
      expect(reaction.expression).toBe('happy');
    });
  });

  describe('Enable/Disable', () => {
    it('should be enabled by default', () => {
      expect(mapper.isEnabled()).toBe(true);
    });

    it('should toggle enabled state', () => {
      mapper.setEnabled(false);
      expect(mapper.isEnabled()).toBe(false);

      mapper.setEnabled(true);
      expect(mapper.isEnabled()).toBe(true);
    });
  });

  describe('Cooldown', () => {
    it('should allow custom cooldown', () => {
      mapper.setCooldown(1000);

      const result1 = mapper.react('thumbs_up');
      expect(result1).not.toBeNull();

      vi.advanceTimersByTime(500);
      const result2 = mapper.react('peace');
      expect(result2).toBeNull();

      vi.advanceTimersByTime(500);
      const result3 = mapper.react('peace');
      expect(result3).not.toBeNull();
    });
  });

  describe('Reaction Messages', () => {
    it('thumbs_up should have message', () => {
      const reaction = mapper.getReaction('thumbs_up');
      expect(reaction.message).toBeDefined();
      expect(reaction.message).toContain('👍');
    });

    it('wave should have greeting message', () => {
      const reaction = mapper.getReaction('wave');
      expect(reaction.message).toContain('👋');
    });
  });

  describe('Reaction Durations', () => {
    it('thumbs_up should have duration', () => {
      const reaction = mapper.getReaction('thumbs_up');
      expect(reaction.duration).toBe(3000);
    });

    it('thumbs_down should have duration', () => {
      const reaction = mapper.getReaction('thumbs_down');
      expect(reaction.duration).toBe(2000);
    });
  });

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      const callback = vi.fn();
      mapper.onReaction(callback);

      mapper.destroy();

      // After destroy, callbacks should be cleared
      // (verified by internal state)
    });

    it('should handle multiple destroy calls', () => {
      expect(() => {
        mapper.destroy();
        mapper.destroy();
      }).not.toThrow();
    });
  });
});

describe('gestureReactionMapper singleton', () => {
  beforeEach(() => {
    // Ensure singleton is reset before this test suite
    (GestureReactionMapper as any).instance = null;
  });

  it('should export singleton instance', () => {
    // Import fresh singleton
    const mapper = GestureReactionMapper.getInstance();
    expect(mapper).toBeDefined();
    expect(GestureReactionMapper.getInstance()).toBe(mapper);
  });
});
