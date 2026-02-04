/**
 * AvatarController 单元测试
 * 
 * 测试核心功能:
 * - 表情系统 (24种表情, 混合, 过渡, 衰减)
 * - 生命动画系统 (眨眼, 呼吸, 待机)
 * - 口型同步
 * - 动作播放
 * - 配置 API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AvatarController, type Expression } from './AvatarController';

// Mock pixi-live2d-display
vi.mock('pixi-live2d-display', () => ({
  Live2DModel: vi.fn(),
}));

// Mock 依赖模块
vi.mock('./VisemeDriver', () => ({
  visemeDriver: {
    onMouthParams: vi.fn(() => vi.fn()),
    stop: vi.fn(),
    destroy: vi.fn(),
    generateVisemeSequence: vi.fn(() => []),
    playSequence: vi.fn(),
    setViseme: vi.fn(),
    setEmotion: vi.fn(),
  },
}));

vi.mock('./MicroExpressionSystem', () => ({
  microExpressionSystem: {
    onParams: vi.fn(() => vi.fn()),
    start: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    setSpeaking: vi.fn(),
    triggerReaction: vi.fn(),
    analyzeAndReact: vi.fn(),
    setEmotion: vi.fn(),
  },
}));

vi.mock('./MotionQueueSystem', () => ({
  motionQueueSystem: {
    onPlay: vi.fn(() => vi.fn()),
    onStop: vi.fn(() => vi.fn()),
    setIdleMotion: vi.fn(),
    requestMotion: vi.fn(),
    playGesture: vi.fn(),
    playReaction: vi.fn(),
    destroy: vi.fn(),
  },
}));

vi.mock('./PhysicsEnhancer', () => ({
  physicsEnhancer: {
    onParams: vi.fn(() => vi.fn()),
    start: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    setWindEnabled: vi.fn(),
    setWindDirection: vi.fn(),
    updateHeadPosition: vi.fn(),
    setSpeaking: vi.fn(),
  },
}));

// 创建 Mock 模型
function createMockModel(cubismVersion: 2 | 3 | 4 = 3) {
  const parameterIds = [
    'ParamMouthOpenY', 'ParamEyeLOpen', 'ParamEyeROpen',
    'ParamBrowLY', 'ParamBrowRY', 'ParamMouthForm',
    'ParamBreath', 'ParamBodyAngleX', 'ParamBodyAngleY',
    'ParamEyeLSmile', 'ParamEyeRSmile', 'ParamCheek',
    'ParamMouthWidth', 'ParamMouthRound',
    'ParamEyeBallX', 'ParamEyeBallY',
  ];
  const parameterValues = new Array(parameterIds.length).fill(0);

  const mockCoreModel = cubismVersion >= 3 ? {
    _model: {
      parameters: {
        ids: parameterIds,
        values: parameterValues,
      },
    },
  } : {
    setParamFloat: vi.fn(),
  };

  return {
    internalModel: {
      coreModel: mockCoreModel,
      motionManager: {
        expressionManager: {
          definitions: [
            { Name: 'kaixin' },
            { Name: 'shangxin' },
            { Name: 'haixiu' },
            { Name: 'default111' },
          ],
        },
        definitions: {
          idle: [{ file: 'idle.motion3.json' }],
          tap_body: [{ file: 'tap.motion3.json' }],
        },
      },
    },
    expression: vi.fn().mockResolvedValue(undefined),
    motion: vi.fn().mockResolvedValue(undefined),
    focus: vi.fn(),
  };
}

describe('AvatarController', () => {
  let controller: AvatarController;
  
  beforeEach(() => {
    vi.useFakeTimers();
    controller = new AvatarController();
  });
  
  afterEach(() => {
    controller.destroy();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('基础功能', () => {
    it('应该能够创建实例', () => {
      expect(controller).toBeInstanceOf(AvatarController);
    });

    it('未绑定模型时应该优雅处理', async () => {
      // 不应该抛出错误
      await controller.setExpression('happy');
      controller.setMouthOpenY(0.5);
      controller.lookAt(100, 100);
      await controller.playMotion('idle');
    });

    it('应该能够绑定模型', () => {
      const mockModel = createMockModel();
      controller.bind(mockModel as any);
      
      expect(controller.getCubismVersion()).toBe(4); // Cubism 3/4 共用版本 4
      expect(controller.getAvailableExpressions()).toContain('kaixin');
      expect(controller.getAvailableMotions()).toContain('idle');
    });

    it('应该正确检测 Cubism 2 模型', () => {
      const mockModel = createMockModel(2);
      controller.bind(mockModel as any);
      
      expect(controller.getCubismVersion()).toBe(2);
    });
  });

  describe('表情系统', () => {
    beforeEach(() => {
      const mockModel = createMockModel();
      controller.bind(mockModel as any);
    });

    it('应该返回所有支持的表情 (24种)', () => {
      const expressions = controller.getSupportedExpressions();
      expect(expressions).toHaveLength(24);
      expect(expressions).toContain('neutral');
      expect(expressions).toContain('happy');
      expect(expressions).toContain('sad');
      expect(expressions).toContain('surprised');
      expect(expressions).toContain('thinking');
      expect(expressions).toContain('playful');
    });

    it('应该能设置表情', async () => {
      await controller.setExpression('happy');
      
      // 快进过渡时间
      vi.advanceTimersByTime(500);
      
      expect(controller.getCurrentExpression()).toBe('happy');
    });

    it('应该能立即设置表情 (无过渡)', async () => {
      await controller.setExpressionImmediate('excited');
      
      expect(controller.getCurrentExpression()).toBe('excited');
    });

    it('表情应该自动衰减到 neutral', async () => {
      await controller.setExpression('surprised', { duration: 1000 });
      
      // 快进过渡完成
      vi.advanceTimersByTime(400);
      expect(controller.getCurrentExpression()).toBe('surprised');
      
      // 快进到衰减触发时间，然后再等待过渡完成
      vi.advanceTimersByTime(1500);
      
      // 衰减被触发后会重新开始过渡
      expect(controller.getCurrentExpression()).toBe('neutral');
    });

    it('应该能禁用自动衰减', async () => {
      controller.setAutoDecay(false);
      await controller.setExpression('happy', { duration: 500 });
      
      vi.advanceTimersByTime(2000);
      
      // 表情应该保持不变
      expect(controller.getCurrentExpression()).toBe('happy');
    });

    it('应该能混合两个表情', () => {
      controller.blendExpressions('happy', 'sad', 0.5);
      
      const blend = controller.getCurrentBlend();
      // 混合后的值应该在两个表情的值之间
      expect(blend.mouthSmile).toBeDefined();
    });

    it('混合比例应该被 clamp 到 0-1', () => {
      // 不应该抛出错误
      controller.blendExpressions('happy', 'sad', -1);
      controller.blendExpressions('happy', 'sad', 2);
    });
  });

  describe('生命动画系统', () => {
    beforeEach(() => {
      const mockModel = createMockModel();
      controller.bind(mockModel as any);
    });

    it('应该默认启用生命动画', () => {
      expect(controller.isLifeAnimationEnabled()).toBe(true);
    });

    it('应该能禁用生命动画', () => {
      controller.setLifeAnimationEnabled(false);
      expect(controller.isLifeAnimationEnabled()).toBe(false);
    });

    it('应该能重新启用生命动画', () => {
      controller.setLifeAnimationEnabled(false);
      controller.setLifeAnimationEnabled(true);
      expect(controller.isLifeAnimationEnabled()).toBe(true);
    });

    it('应该返回默认配置', () => {
      const config = controller.getLifeConfig();
      
      expect(config.blink.enabled).toBe(true);
      expect(config.blink.minInterval).toBe(2000);
      expect(config.blink.maxInterval).toBe(6000);
      expect(config.blink.duration).toBe(150);
      expect(config.blink.doubleBlinkChance).toBe(0.2);
      
      expect(config.breath.enabled).toBe(true);
      expect(config.breath.cycle).toBe(3500);
      
      expect(config.idle.enabled).toBe(true);
      expect(config.idle.swayCycle).toBe(5000);
    });

    it('应该能自定义配置', () => {
      controller.setLifeConfig({
        blink: { enabled: false, minInterval: 1000 },
        breath: { amplitude: 0.1 },
      });
      
      const config = controller.getLifeConfig();
      expect(config.blink.enabled).toBe(false);
      expect(config.blink.minInterval).toBe(1000);
      expect(config.blink.maxInterval).toBe(6000); // 未修改的值保持不变
      expect(config.breath.amplitude).toBe(0.1);
    });

    it('应该能单独控制眨眼', () => {
      controller.setBlinkEnabled(false);
      const config = controller.getLifeConfig();
      expect(config.blink.enabled).toBe(false);
    });

    it('应该能单独控制呼吸', () => {
      controller.setBreathEnabled(false);
      const config = controller.getLifeConfig();
      expect(config.breath.enabled).toBe(false);
    });

    it('应该能单独控制待机微动作', () => {
      controller.setIdleSwayEnabled(false);
      const config = controller.getLifeConfig();
      expect(config.idle.enabled).toBe(false);
    });

    it('应该能手动触发眨眼', () => {
      // 不应该抛出错误
      controller.triggerBlink();
    });

    it('眨眼间隔应该在配置范围内', () => {
      const config = controller.getLifeConfig();
      const minInterval = config.blink.minInterval;
      const maxInterval = config.blink.maxInterval;
      
      expect(minInterval).toBeLessThan(maxInterval);
      expect(minInterval).toBeGreaterThan(0);
    });
  });

  describe('口型同步', () => {
    beforeEach(() => {
      const mockModel = createMockModel();
      controller.bind(mockModel as any);
    });

    it('应该能设置嘴巴张开程度', () => {
      controller.setMouthOpenY(0.5);
      
      const blend = controller.getCurrentBlend();
      expect(blend.mouthOpen).toBe(0.5);
    });

    it('值应该被 clamp 到 0-1 范围', () => {
      controller.setMouthOpenY(-1);
      expect(controller.getCurrentBlend().mouthOpen).toBe(0);
      
      controller.setMouthOpenY(2);
      expect(controller.getCurrentBlend().mouthOpen).toBe(1);
    });

    it('未绑定模型时不应该抛出错误', () => {
      const newController = new AvatarController();
      newController.setMouthOpenY(0.5);
      newController.destroy();
    });
  });

  describe('动作播放', () => {
    let mockModel: any;
    
    beforeEach(() => {
      mockModel = createMockModel();
      controller.bind(mockModel);
    });

    it('应该能播放动作', async () => {
      await controller.playMotion('idle', 0);
      expect(mockModel.motion).toHaveBeenCalledWith('idle', 0);
    });

    it('应该能播放 idle 动作', () => {
      controller.playIdleMotion();
      expect(mockModel.motion).toHaveBeenCalled();
    });

    it('应该能播放挥手动作', () => {
      controller.playWaveMotion();
      // 默认模型没有 goodbye 动作，应该 fallback 到 tap_body
      expect(mockModel.motion).toHaveBeenCalledWith('tap_body', undefined);
    });

    it('不存在的动作组应该被跳过', async () => {
      await controller.playMotion('nonexistent');
      // motion 应该没有被调用（因为动作组不存在）
      expect(mockModel.motion).not.toHaveBeenCalledWith('nonexistent', undefined);
    });
  });

  describe('视线追踪', () => {
    let mockModel: any;
    
    beforeEach(() => {
      mockModel = createMockModel();
      controller.bind(mockModel);
    });

    it('应该能让角色看向某个位置', () => {
      controller.lookAt(100, 200);
      expect(mockModel.focus).toHaveBeenCalledWith(100, 200);
    });

    it('应该能让角色看向中心', () => {
      controller.lookAtCenter();
      expect(mockModel.focus).toHaveBeenCalledWith(0, 0);
    });
  });

  describe('高级系统集成', () => {
    beforeEach(() => {
      const mockModel = createMockModel();
      controller.bind(mockModel as any);
    });

    it('应该能初始化高级系统', () => {
      // 调用应该不会抛出错误
      controller.initAdvancedSystems();
    });

    it('应该能启用/禁用 Viseme 系统', () => {
      // 不应该抛出错误
      controller.setVisemeEnabled(false);
      controller.setVisemeEnabled(true);
    });

    it('应该能启用/禁用微表情系统', () => {
      // 不应该抛出错误
      controller.setMicroExpressionEnabled(false);
      controller.setMicroExpressionEnabled(true);
    });

    it('应该能启用/禁用物理系统', () => {
      // 不应该抛出错误
      controller.setPhysicsEnabled(false);
      controller.setPhysicsEnabled(true);
    });

    it('应该能使用 Viseme 播放语音口型', () => {
      // 不应该抛出错误
      controller.speakWithViseme('你好', 1000);
    });

    it('应该能设置单个 Viseme', () => {
      // 不应该抛出错误
      controller.setViseme('aa');
    });

    it('应该能触发微表情反应', () => {
      // 不应该抛出错误
      controller.triggerMicroReaction('surprise_light');
    });

    it('应该能基于文本分析触发微表情', () => {
      // 不应该抛出错误
      controller.analyzeTextForMicroExpression('真的吗?!');
    });

    it('应该能同步情绪到所有系统', () => {
      // 不应该抛出错误
      controller.syncEmotionToSystems('happy');
    });
  });

  describe('物理系统控制', () => {
    beforeEach(() => {
      const mockModel = createMockModel();
      controller.bind(mockModel as any);
      controller.initAdvancedSystems();
    });

    it('应该能设置风力', () => {
      // 不应该抛出错误
      controller.setWind(true, 45);
      controller.setWind(false);
    });

    it('应该能更新头部位置', () => {
      // 不应该抛出错误
      controller.updateHeadPositionForPhysics(10, 20);
    });

    it('应该能设置说话状态', () => {
      // 不应该抛出错误
      controller.setSpeakingForPhysics(true, 0.8);
      controller.setSpeakingForPhysics(false);
    });
  });

  describe('动作队列系统', () => {
    beforeEach(() => {
      const mockModel = createMockModel();
      controller.bind(mockModel as any);
      controller.initAdvancedSystems();
    });

    it('应该能使用队列播放动作', () => {
      // 不应该抛出错误
      controller.queueMotion('idle', { priority: 'gesture', fadeIn: 200 });
    });

    it('应该能播放手势', () => {
      // 不应该抛出错误
      controller.playGesture('wave');
    });

    it('应该能播放反应动作', () => {
      // 不应该抛出错误
      controller.playReaction('nod');
    });

    it('应该能启用/禁用动作队列', () => {
      controller.setMotionQueueEnabled(false);
      // 不应该抛出错误
    });
  });

  describe('缓动函数', () => {
    // 通过表情过渡间接测试缓动函数
    beforeEach(() => {
      const mockModel = createMockModel();
      controller.bind(mockModel as any);
    });

    it('表情过渡应该使用缓动函数', async () => {
      await controller.setExpression('happy', { 
        transition: { duration: 1000, easing: 'easeInOut' } 
      });
      
      // 在过渡中间检查
      vi.advanceTimersByTime(500);
      
      const blend = controller.getCurrentBlend();
      // 在过渡中，mouthSmile 应该在 0 和目标值之间
      expect(blend.mouthSmile).toBeGreaterThanOrEqual(0);
    });
  });

  describe('销毁和清理', () => {
    it('应该正确清理所有资源', () => {
      const mockModel = createMockModel();
      controller.bind(mockModel as any);
      controller.initAdvancedSystems();
      
      // 设置一些定时器
      controller.setExpression('happy', { duration: 5000 });
      
      // 销毁应该不抛出错误
      controller.destroy();
      
      // 验证可用表情列表被清空
      expect(controller.getAvailableExpressions()).toEqual([]);
      expect(controller.getAvailableMotions()).toEqual([]);
    });

    it('销毁后应该能安全调用方法', () => {
      controller.destroy();
      
      // 不应该抛出错误
      controller.setExpression('happy');
      controller.setMouthOpenY(0.5);
    });
  });

  describe('边界情况', () => {
    it('应该处理空表情列表的模型', () => {
      const mockModel = {
        internalModel: {
          coreModel: { _model: { parameters: { ids: [], values: [] } } },
          motionManager: {
            expressionManager: { definitions: [] },
            definitions: {},
          },
        },
        expression: vi.fn(),
        motion: vi.fn(),
        focus: vi.fn(),
      };
      
      controller.bind(mockModel as any);
      expect(controller.getAvailableExpressions()).toEqual([]);
      expect(controller.getAvailableMotions()).toEqual([]);
    });

    it('应该处理 null internalModel', () => {
      const mockModel = {
        internalModel: null,
        expression: vi.fn(),
        motion: vi.fn(),
        focus: vi.fn(),
      };
      
      controller.bind(mockModel as any);
      // 不应该抛出错误
      controller.setMouthOpenY(0.5);
    });

    it('应该处理 undefined coreModel', () => {
      const mockModel = {
        internalModel: {
          coreModel: undefined,
          motionManager: {},
        },
        expression: vi.fn(),
        motion: vi.fn(),
        focus: vi.fn(),
      };
      
      controller.bind(mockModel as any);
      controller.setMouthOpenY(0.5);
    });
  });

  describe('表情混合参数', () => {
    beforeEach(() => {
      const mockModel = createMockModel();
      controller.bind(mockModel as any);
    });

    it('所有表情都应该有混合参数定义', async () => {
      const expressions = controller.getSupportedExpressions();
      
      for (const expr of expressions) {
        // 设置每个表情，不应该抛出错误
        await controller.setExpressionImmediate(expr);
        const blend = controller.getCurrentBlend();
        expect(blend).toBeDefined();
      }
    });

    it('neutral 表情的混合参数应该是中性值', async () => {
      await controller.setExpressionImmediate('neutral');
      const blend = controller.getCurrentBlend();
      
      expect(blend.eyeOpenL).toBe(1);
      expect(blend.eyeOpenR).toBe(1);
      expect(blend.eyeSmileL).toBe(0);
      expect(blend.mouthSmile).toBe(0);
      expect(blend.cheek).toBe(0);
    });

    it('happy 表情应该有笑眼和嘴角上扬', async () => {
      await controller.setExpressionImmediate('happy');
      const blend = controller.getCurrentBlend();
      
      expect(blend.eyeSmileL).toBeGreaterThan(0);
      expect(blend.eyeSmileR).toBeGreaterThan(0);
      expect(blend.mouthSmile).toBeGreaterThan(0);
    });

    it('sad 表情应该有下垂的嘴角', async () => {
      await controller.setExpressionImmediate('sad');
      const blend = controller.getCurrentBlend();
      
      expect(blend.mouthSmile).toBeLessThan(0);
    });

    it('embarrassed 表情应该有脸红', async () => {
      await controller.setExpressionImmediate('embarrassed');
      const blend = controller.getCurrentBlend();
      
      expect(blend.cheek).toBeGreaterThan(0);
    });
  });

  describe('表情持续时间', () => {
    beforeEach(() => {
      const mockModel = createMockModel();
      controller.bind(mockModel as any);
    });

    it('neutral 表情应该是永久的', async () => {
      await controller.setExpression('neutral');
      vi.advanceTimersByTime(10000);
      
      expect(controller.getCurrentExpression()).toBe('neutral');
    });

    it('surprised 表情持续时间应该较短', async () => {
      await controller.setExpression('surprised');
      
      // 等待过渡完成
      vi.advanceTimersByTime(400);
      expect(controller.getCurrentExpression()).toBe('surprised');
      
      // surprised 默认持续 2000ms，然后衰减过渡 500ms
      vi.advanceTimersByTime(2500);
      
      expect(controller.getCurrentExpression()).toBe('neutral');
    });

    it('自定义持续时间应该覆盖默认值', async () => {
      await controller.setExpression('surprised', { duration: 5000 });
      
      // 等待过渡完成
      vi.advanceTimersByTime(400);
      
      // 还没到 5000ms，不应该衰减
      vi.advanceTimersByTime(2000);
      expect(controller.getCurrentExpression()).toBe('surprised');
      
      // 超过 5000ms + 过渡时间
      vi.advanceTimersByTime(3500);
      expect(controller.getCurrentExpression()).toBe('neutral');
    });

    it('duration=0 应该是永久', async () => {
      await controller.setExpression('happy', { duration: 0 });
      
      vi.advanceTimersByTime(100000);
      expect(controller.getCurrentExpression()).toBe('happy');
    });
  });

  describe('Cubism 版本兼容性', () => {
    it('Cubism 2 模型应该使用 setParamFloat', () => {
      const mockModel = createMockModel(2);
      controller.bind(mockModel as any);
      
      controller.setMouthOpenY(0.5);
      
      const coreModel = mockModel.internalModel.coreModel;
      expect(coreModel.setParamFloat).toHaveBeenCalled();
    });

    it('Cubism 3/4 模型应该使用 parameters.values', () => {
      const mockModel = createMockModel(3);
      controller.bind(mockModel as any);
      
      controller.setMouthOpenY(0.5);
      
      const model = mockModel.internalModel.coreModel._model;
      const idx = model.parameters.ids.indexOf('ParamMouthOpenY');
      expect(model.parameters.values[idx]).toBe(0.5);
    });
  });
});
