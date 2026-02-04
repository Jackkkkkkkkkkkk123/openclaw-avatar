/**
 * DynamicLightingSystem - 动态光照系统
 * 
 * SOTA Round 41 - 真实的动态光照效果
 * 
 * 功能：
 * 1. 多光源管理 - 环境光/主光/补光/边缘光
 * 2. 情绪联动光照 - 情绪自动调整光照颜色和强度
 * 3. 时间氛围 - 昼夜循环光照变化
 * 4. 天气效果 - 阴天/雨天/晴天不同光照
 * 5. 动态阴影 - CSS filter 实现的实时阴影
 * 6. 高光/辉光 - Bloom 效果增强
 * 7. 体积光 - God Ray 效果
 */

import type { Expression } from './AvatarController';

// ============= 类型定义 =============

/**
 * 光源类型
 */
export type LightType = 
  | 'ambient'      // 环境光 - 整体基础照明
  | 'key'          // 主光 - 主要方向光
  | 'fill'         // 补光 - 填充阴影区域
  | 'rim'          // 边缘光 - 轮廓高光
  | 'accent'       // 点缀光 - 特效光源
  | 'volumetric';  // 体积光 - God Ray 效果

/**
 * 单个光源配置
 */
export interface LightSource {
  id: string;
  type: LightType;
  color: string;           // CSS 颜色值
  intensity: number;       // 0-2 (支持 HDR)
  position: {
    x: number;             // -100 到 100 (相对屏幕中心)
    y: number;             // -100 到 100
    z: number;             // 0 到 100 (深度)
  };
  size: number;            // 光源大小/扩散范围
  falloff: number;         // 衰减系数 (0-1)
  castShadow: boolean;     // 是否投射阴影
  animated: boolean;       // 是否有动画
  animation?: {
    type: 'pulse' | 'flicker' | 'sway' | 'rotate';
    speed: number;         // 0-2
    amplitude: number;     // 0-1
    phase?: number;        // 相位偏移
  };
}

/**
 * 阴影配置
 */
export interface ShadowConfig {
  enabled: boolean;
  color: string;
  blur: number;            // 模糊程度 (px)
  offset: { x: number; y: number };
  opacity: number;         // 0-1
  direction: number;       // 角度 (度)
}

/**
 * 辉光配置
 */
export interface BloomConfig {
  enabled: boolean;
  threshold: number;       // 亮度阈值 (0-1)
  intensity: number;       // 强度 (0-2)
  radius: number;          // 扩散半径 (px)
  color?: string;          // 可选着色
}

/**
 * 体积光配置
 */
export interface VolumetricConfig {
  enabled: boolean;
  color: string;
  intensity: number;       // 0-1
  angle: number;           // 光线角度 (度)
  decay: number;           // 衰减 (0-1)
  density: number;         // 密度 (0-1)
  rays: number;            // 光线数量
}

/**
 * 完整光照场景配置
 */
export interface LightingScene {
  name: string;
  lights: LightSource[];
  shadow: ShadowConfig;
  bloom: BloomConfig;
  volumetric: VolumetricConfig;
  ambientColor: string;    // 全局环境色
  exposure: number;        // 曝光 (0.5-2)
  contrast: number;        // 对比度 (0.5-2)
  saturation: number;      // 饱和度 (0-2)
}

/**
 * 时间氛围类型
 */
export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' | 'midnight';

/**
 * 天气类型
 */
export type Weather = 'clear' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'foggy';

/**
 * 光照状态
 */
export interface LightingState {
  currentScene: string;
  lights: LightSource[];
  shadow: ShadowConfig;
  bloom: BloomConfig;
  volumetric: VolumetricConfig;
  exposure: number;
  contrast: number;
  saturation: number;
  cssFilters: string;
  transitionProgress: number;  // 0-1 过渡进度
}

// ============= 预设光照场景 =============

/**
 * 情绪光照预设
 */
const EMOTION_LIGHTING: Record<Expression, Partial<LightingScene>> = {
  neutral: {
    lights: [
      { id: 'key', type: 'key', color: '#e0e8f0', intensity: 0.8, position: { x: 30, y: -30, z: 50 }, size: 200, falloff: 0.5, castShadow: true, animated: false },
      { id: 'fill', type: 'fill', color: '#39c5bb', intensity: 0.3, position: { x: -40, y: 20, z: 30 }, size: 300, falloff: 0.7, castShadow: false, animated: false },
      { id: 'rim', type: 'rim', color: '#ffffff', intensity: 0.2, position: { x: -50, y: -20, z: 80 }, size: 150, falloff: 0.3, castShadow: false, animated: false },
    ],
    shadow: { enabled: true, color: '#0a1520', blur: 20, offset: { x: 5, y: 8 }, opacity: 0.3, direction: 135 },
    bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 10 },
    volumetric: { enabled: false, color: '#ffffff', intensity: 0, angle: 45, decay: 0.95, density: 0.3, rays: 0 },
    ambientColor: '#1a2a3a',
    exposure: 1.0,
    contrast: 1.0,
    saturation: 1.0,
  },
  
  happy: {
    lights: [
      { id: 'key', type: 'key', color: '#fff5e6', intensity: 1.2, position: { x: 20, y: -40, z: 60 }, size: 250, falloff: 0.4, castShadow: true, animated: true, animation: { type: 'pulse', speed: 0.5, amplitude: 0.1 } },
      { id: 'fill', type: 'fill', color: '#ffb6c1', intensity: 0.5, position: { x: -30, y: 10, z: 40 }, size: 350, falloff: 0.6, castShadow: false, animated: false },
      { id: 'rim', type: 'rim', color: '#ffd700', intensity: 0.4, position: { x: -60, y: -30, z: 90 }, size: 180, falloff: 0.3, castShadow: false, animated: true, animation: { type: 'pulse', speed: 0.8, amplitude: 0.15 } },
      { id: 'accent', type: 'accent', color: '#ff69b4', intensity: 0.3, position: { x: 50, y: 40, z: 20 }, size: 100, falloff: 0.8, castShadow: false, animated: true, animation: { type: 'sway', speed: 1, amplitude: 0.2 } },
    ],
    shadow: { enabled: true, color: '#2d1a35', blur: 15, offset: { x: 3, y: 6 }, opacity: 0.25, direction: 120 },
    bloom: { enabled: true, threshold: 0.6, intensity: 0.5, radius: 20, color: '#fff5e6' },
    volumetric: { enabled: true, color: '#ffd700', intensity: 0.3, angle: 30, decay: 0.9, density: 0.2, rays: 5 },
    ambientColor: '#2d1a35',
    exposure: 1.15,
    contrast: 1.05,
    saturation: 1.2,
  },
  
  sad: {
    lights: [
      { id: 'key', type: 'key', color: '#8090a0', intensity: 0.5, position: { x: 0, y: -20, z: 40 }, size: 300, falloff: 0.6, castShadow: true, animated: false },
      { id: 'fill', type: 'fill', color: '#4a5a7a', intensity: 0.2, position: { x: -30, y: 30, z: 25 }, size: 400, falloff: 0.8, castShadow: false, animated: false },
    ],
    shadow: { enabled: true, color: '#0a0a15', blur: 30, offset: { x: 0, y: 10 }, opacity: 0.5, direction: 180 },
    bloom: { enabled: false, threshold: 0.9, intensity: 0.1, radius: 5 },
    volumetric: { enabled: false, color: '#5a6a8a', intensity: 0, angle: 0, decay: 0.98, density: 0.1, rays: 0 },
    ambientColor: '#1a1a2e',
    exposure: 0.85,
    contrast: 0.95,
    saturation: 0.7,
  },
  
  surprised: {
    lights: [
      { id: 'key', type: 'key', color: '#e0f0ff', intensity: 1.4, position: { x: 0, y: -50, z: 70 }, size: 200, falloff: 0.3, castShadow: true, animated: true, animation: { type: 'flicker', speed: 2, amplitude: 0.3 } },
      { id: 'fill', type: 'fill', color: '#00bfff', intensity: 0.6, position: { x: -40, y: 0, z: 35 }, size: 300, falloff: 0.5, castShadow: false, animated: false },
      { id: 'rim', type: 'rim', color: '#ffffff', intensity: 0.5, position: { x: 0, y: -60, z: 100 }, size: 100, falloff: 0.2, castShadow: false, animated: true, animation: { type: 'pulse', speed: 1.5, amplitude: 0.2 } },
    ],
    shadow: { enabled: true, color: '#0a1530', blur: 10, offset: { x: 0, y: 5 }, opacity: 0.35, direction: 180 },
    bloom: { enabled: true, threshold: 0.5, intensity: 0.7, radius: 25, color: '#e0f0ff' },
    volumetric: { enabled: true, color: '#ffffff', intensity: 0.5, angle: 0, decay: 0.85, density: 0.4, rays: 8 },
    ambientColor: '#1a2540',
    exposure: 1.25,
    contrast: 1.15,
    saturation: 1.1,
  },
  
  angry: {
    lights: [
      { id: 'key', type: 'key', color: '#ff4040', intensity: 1.0, position: { x: 30, y: -30, z: 50 }, size: 180, falloff: 0.4, castShadow: true, animated: true, animation: { type: 'flicker', speed: 3, amplitude: 0.2 } },
      { id: 'fill', type: 'fill', color: '#800000', intensity: 0.4, position: { x: -40, y: 20, z: 30 }, size: 250, falloff: 0.6, castShadow: false, animated: false },
      { id: 'accent', type: 'accent', color: '#ff6600', intensity: 0.5, position: { x: 0, y: 50, z: 20 }, size: 150, falloff: 0.7, castShadow: false, animated: true, animation: { type: 'pulse', speed: 2, amplitude: 0.3 } },
    ],
    shadow: { enabled: true, color: '#200000', blur: 15, offset: { x: 8, y: 8 }, opacity: 0.6, direction: 135 },
    bloom: { enabled: true, threshold: 0.4, intensity: 0.6, radius: 15, color: '#ff4040' },
    volumetric: { enabled: false, color: '#ff0000', intensity: 0, angle: 45, decay: 0.9, density: 0.3, rays: 0 },
    ambientColor: '#1a0505',
    exposure: 1.1,
    contrast: 1.2,
    saturation: 1.3,
  },
  
  fear: {
    lights: [
      { id: 'key', type: 'key', color: '#606080', intensity: 0.4, position: { x: 0, y: 0, z: 30 }, size: 400, falloff: 0.7, castShadow: true, animated: true, animation: { type: 'flicker', speed: 4, amplitude: 0.4 } },
      { id: 'accent', type: 'accent', color: '#400060', intensity: 0.3, position: { x: -50, y: -50, z: 20 }, size: 200, falloff: 0.8, castShadow: false, animated: true, animation: { type: 'sway', speed: 0.5, amplitude: 0.5 } },
    ],
    shadow: { enabled: true, color: '#000010', blur: 40, offset: { x: -5, y: 15 }, opacity: 0.7, direction: 200 },
    bloom: { enabled: false, threshold: 0.95, intensity: 0.1, radius: 5 },
    volumetric: { enabled: false, color: '#400060', intensity: 0, angle: 0, decay: 0.99, density: 0.05, rays: 0 },
    ambientColor: '#0a0510',
    exposure: 0.7,
    contrast: 1.1,
    saturation: 0.6,
  },
  
  disgusted: {
    lights: [
      { id: 'key', type: 'key', color: '#80a060', intensity: 0.6, position: { x: 20, y: -30, z: 45 }, size: 220, falloff: 0.5, castShadow: true, animated: false },
      { id: 'fill', type: 'fill', color: '#405030', intensity: 0.3, position: { x: -35, y: 15, z: 30 }, size: 280, falloff: 0.65, castShadow: false, animated: false },
    ],
    shadow: { enabled: true, color: '#101508', blur: 25, offset: { x: 4, y: 7 }, opacity: 0.4, direction: 140 },
    bloom: { enabled: false, threshold: 0.85, intensity: 0.2, radius: 8 },
    volumetric: { enabled: false, color: '#80a060', intensity: 0, angle: 0, decay: 0.95, density: 0.2, rays: 0 },
    ambientColor: '#151a10',
    exposure: 0.9,
    contrast: 1.05,
    saturation: 0.85,
  },
  
  excited: {
    lights: [
      { id: 'key', type: 'key', color: '#ffee00', intensity: 1.5, position: { x: 10, y: -45, z: 65 }, size: 280, falloff: 0.35, castShadow: true, animated: true, animation: { type: 'pulse', speed: 1.2, amplitude: 0.2 } },
      { id: 'fill', type: 'fill', color: '#ff6600', intensity: 0.6, position: { x: -45, y: 5, z: 40 }, size: 320, falloff: 0.55, castShadow: false, animated: true, animation: { type: 'sway', speed: 1.5, amplitude: 0.15 } },
      { id: 'rim', type: 'rim', color: '#ffffff', intensity: 0.5, position: { x: 60, y: -20, z: 85 }, size: 160, falloff: 0.25, castShadow: false, animated: true, animation: { type: 'pulse', speed: 1, amplitude: 0.25 } },
      { id: 'accent', type: 'accent', color: '#ff00ff', intensity: 0.4, position: { x: -60, y: 50, z: 25 }, size: 120, falloff: 0.75, castShadow: false, animated: true, animation: { type: 'rotate', speed: 2, amplitude: 0.3 } },
    ],
    shadow: { enabled: true, color: '#2a1500', blur: 12, offset: { x: 2, y: 4 }, opacity: 0.2, direction: 110 },
    bloom: { enabled: true, threshold: 0.45, intensity: 0.8, radius: 30, color: '#ffee00' },
    volumetric: { enabled: true, color: '#ffee00', intensity: 0.5, angle: 20, decay: 0.85, density: 0.35, rays: 10 },
    ambientColor: '#2a1a05',
    exposure: 1.3,
    contrast: 1.1,
    saturation: 1.4,
  },
  
  proud: {
    lights: [
      { id: 'key', type: 'key', color: '#ffd700', intensity: 1.1, position: { x: 25, y: -35, z: 55 }, size: 240, falloff: 0.45, castShadow: true, animated: true, animation: { type: 'pulse', speed: 0.3, amplitude: 0.08 } },
      { id: 'fill', type: 'fill', color: '#8b4513', intensity: 0.35, position: { x: -38, y: 12, z: 35 }, size: 310, falloff: 0.6, castShadow: false, animated: false },
      { id: 'rim', type: 'rim', color: '#fffacd', intensity: 0.35, position: { x: -55, y: -25, z: 88 }, size: 170, falloff: 0.28, castShadow: false, animated: false },
    ],
    shadow: { enabled: true, color: '#1a1000', blur: 18, offset: { x: 6, y: 9 }, opacity: 0.32, direction: 130 },
    bloom: { enabled: true, threshold: 0.55, intensity: 0.45, radius: 18, color: '#ffd700' },
    volumetric: { enabled: true, color: '#ffd700', intensity: 0.25, angle: 35, decay: 0.92, density: 0.25, rays: 4 },
    ambientColor: '#1a1505',
    exposure: 1.1,
    contrast: 1.08,
    saturation: 1.15,
  },
  
  loving: {
    lights: [
      { id: 'key', type: 'key', color: '#ffb6c1', intensity: 1.0, position: { x: 15, y: -38, z: 52 }, size: 260, falloff: 0.42, castShadow: true, animated: true, animation: { type: 'pulse', speed: 0.6, amplitude: 0.12 } },
      { id: 'fill', type: 'fill', color: '#ff69b4', intensity: 0.45, position: { x: -42, y: 8, z: 38 }, size: 340, falloff: 0.58, castShadow: false, animated: true, animation: { type: 'pulse', speed: 0.6, amplitude: 0.1, phase: Math.PI } },
      { id: 'rim', type: 'rim', color: '#ffffff', intensity: 0.3, position: { x: -48, y: -22, z: 82 }, size: 155, falloff: 0.32, castShadow: false, animated: false },
      { id: 'accent', type: 'accent', color: '#ff1493', intensity: 0.35, position: { x: 55, y: 45, z: 22 }, size: 110, falloff: 0.78, castShadow: false, animated: true, animation: { type: 'sway', speed: 0.8, amplitude: 0.25 } },
    ],
    shadow: { enabled: true, color: '#200515', blur: 16, offset: { x: 4, y: 7 }, opacity: 0.28, direction: 125 },
    bloom: { enabled: true, threshold: 0.5, intensity: 0.55, radius: 22, color: '#ffb6c1' },
    volumetric: { enabled: true, color: '#ff69b4', intensity: 0.35, angle: 25, decay: 0.88, density: 0.28, rays: 6 },
    ambientColor: '#1a0a12',
    exposure: 1.08,
    contrast: 1.02,
    saturation: 1.25,
  },
  
  grateful: {
    lights: [
      { id: 'key', type: 'key', color: '#e8d8c0', intensity: 0.95, position: { x: 22, y: -32, z: 48 }, size: 230, falloff: 0.48, castShadow: true, animated: false },
      { id: 'fill', type: 'fill', color: '#87ceeb', intensity: 0.38, position: { x: -36, y: 18, z: 32 }, size: 290, falloff: 0.62, castShadow: false, animated: false },
      { id: 'rim', type: 'rim', color: '#fffaf0', intensity: 0.28, position: { x: -52, y: -18, z: 78 }, size: 148, falloff: 0.35, castShadow: false, animated: false },
    ],
    shadow: { enabled: true, color: '#0a1015', blur: 22, offset: { x: 5, y: 8 }, opacity: 0.3, direction: 138 },
    bloom: { enabled: true, threshold: 0.65, intensity: 0.35, radius: 14, color: '#e8d8c0' },
    volumetric: { enabled: false, color: '#ffffff', intensity: 0, angle: 0, decay: 0.95, density: 0, rays: 0 },
    ambientColor: '#151a1e',
    exposure: 1.02,
    contrast: 1.0,
    saturation: 1.05,
  },
  
  hopeful: {
    lights: [
      { id: 'key', type: 'key', color: '#87ceeb', intensity: 1.05, position: { x: 18, y: -42, z: 58 }, size: 270, falloff: 0.4, castShadow: true, animated: true, animation: { type: 'pulse', speed: 0.4, amplitude: 0.1 } },
      { id: 'fill', type: 'fill', color: '#98fb98', intensity: 0.4, position: { x: -40, y: 15, z: 35 }, size: 320, falloff: 0.58, castShadow: false, animated: false },
      { id: 'rim', type: 'rim', color: '#ffffff', intensity: 0.38, position: { x: 50, y: -30, z: 85 }, size: 165, falloff: 0.3, castShadow: false, animated: true, animation: { type: 'pulse', speed: 0.5, amplitude: 0.12 } },
    ],
    shadow: { enabled: true, color: '#081015', blur: 18, offset: { x: 4, y: 6 }, opacity: 0.25, direction: 130 },
    bloom: { enabled: true, threshold: 0.55, intensity: 0.5, radius: 20, color: '#87ceeb' },
    volumetric: { enabled: true, color: '#87ceeb', intensity: 0.35, angle: 15, decay: 0.9, density: 0.3, rays: 6 },
    ambientColor: '#0a151a',
    exposure: 1.12,
    contrast: 1.05,
    saturation: 1.1,
  },
  
  amused: {
    lights: [
      { id: 'key', type: 'key', color: '#ffe4b5', intensity: 1.0, position: { x: 28, y: -35, z: 50 }, size: 235, falloff: 0.45, castShadow: true, animated: true, animation: { type: 'sway', speed: 0.8, amplitude: 0.1 } },
      { id: 'fill', type: 'fill', color: '#dda0dd', intensity: 0.42, position: { x: -38, y: 12, z: 33 }, size: 305, falloff: 0.6, castShadow: false, animated: false },
      { id: 'accent', type: 'accent', color: '#00ced1', intensity: 0.3, position: { x: 48, y: 38, z: 25 }, size: 95, falloff: 0.75, castShadow: false, animated: true, animation: { type: 'pulse', speed: 1.2, amplitude: 0.2 } },
    ],
    shadow: { enabled: true, color: '#151010', blur: 17, offset: { x: 5, y: 7 }, opacity: 0.28, direction: 128 },
    bloom: { enabled: true, threshold: 0.6, intensity: 0.42, radius: 16, color: '#ffe4b5' },
    volumetric: { enabled: false, color: '#ffffff', intensity: 0, angle: 0, decay: 0.95, density: 0, rays: 0 },
    ambientColor: '#18151a',
    exposure: 1.05,
    contrast: 1.03,
    saturation: 1.12,
  },
  
  relieved: {
    lights: [
      { id: 'key', type: 'key', color: '#b0e0e6', intensity: 0.9, position: { x: 20, y: -30, z: 45 }, size: 280, falloff: 0.5, castShadow: true, animated: false },
      { id: 'fill', type: 'fill', color: '#98fb98', intensity: 0.35, position: { x: -35, y: 20, z: 30 }, size: 340, falloff: 0.65, castShadow: false, animated: false },
    ],
    shadow: { enabled: true, color: '#081210', blur: 25, offset: { x: 3, y: 6 }, opacity: 0.25, direction: 140 },
    bloom: { enabled: true, threshold: 0.7, intensity: 0.3, radius: 12 },
    volumetric: { enabled: false, color: '#b0e0e6', intensity: 0, angle: 0, decay: 0.95, density: 0, rays: 0 },
    ambientColor: '#0a1512',
    exposure: 1.0,
    contrast: 0.98,
    saturation: 1.0,
  },
  
  anxious: {
    lights: [
      { id: 'key', type: 'key', color: '#708090', intensity: 0.55, position: { x: 10, y: -25, z: 38 }, size: 250, falloff: 0.55, castShadow: true, animated: true, animation: { type: 'flicker', speed: 2.5, amplitude: 0.25 } },
      { id: 'accent', type: 'accent', color: '#4a4a6a', intensity: 0.3, position: { x: -45, y: 35, z: 22 }, size: 180, falloff: 0.7, castShadow: false, animated: true, animation: { type: 'sway', speed: 1.5, amplitude: 0.35 } },
    ],
    shadow: { enabled: true, color: '#050510', blur: 35, offset: { x: -3, y: 12 }, opacity: 0.55, direction: 190 },
    bloom: { enabled: false, threshold: 0.9, intensity: 0.15, radius: 6 },
    volumetric: { enabled: false, color: '#708090', intensity: 0, angle: 0, decay: 0.98, density: 0.1, rays: 0 },
    ambientColor: '#0a0a12',
    exposure: 0.8,
    contrast: 1.08,
    saturation: 0.75,
  },
  
  embarrassed: {
    lights: [
      { id: 'key', type: 'key', color: '#ffc0cb', intensity: 0.85, position: { x: 18, y: -32, z: 48 }, size: 240, falloff: 0.48, castShadow: true, animated: false },
      { id: 'fill', type: 'fill', color: '#ffb6c1', intensity: 0.4, position: { x: -38, y: 15, z: 32 }, size: 300, falloff: 0.6, castShadow: false, animated: true, animation: { type: 'pulse', speed: 0.8, amplitude: 0.15 } },
    ],
    shadow: { enabled: true, color: '#150810', blur: 20, offset: { x: 4, y: 7 }, opacity: 0.32, direction: 135 },
    bloom: { enabled: true, threshold: 0.6, intensity: 0.4, radius: 15, color: '#ffc0cb' },
    volumetric: { enabled: false, color: '#ffc0cb', intensity: 0, angle: 0, decay: 0.95, density: 0, rays: 0 },
    ambientColor: '#150a10',
    exposure: 1.0,
    contrast: 1.0,
    saturation: 1.15,
  },
  
  confused: {
    lights: [
      { id: 'key', type: 'key', color: '#b0b0c0', intensity: 0.7, position: { x: 5, y: -28, z: 42 }, size: 260, falloff: 0.52, castShadow: true, animated: true, animation: { type: 'sway', speed: 0.6, amplitude: 0.15 } },
      { id: 'fill', type: 'fill', color: '#8888a0', intensity: 0.32, position: { x: -32, y: 18, z: 28 }, size: 320, falloff: 0.65, castShadow: false, animated: false },
    ],
    shadow: { enabled: true, color: '#080810', blur: 28, offset: { x: 2, y: 8 }, opacity: 0.38, direction: 165 },
    bloom: { enabled: false, threshold: 0.8, intensity: 0.2, radius: 8 },
    volumetric: { enabled: false, color: '#b0b0c0', intensity: 0, angle: 0, decay: 0.95, density: 0, rays: 0 },
    ambientColor: '#10101a',
    exposure: 0.92,
    contrast: 1.02,
    saturation: 0.88,
  },
  
  bored: {
    lights: [
      { id: 'key', type: 'key', color: '#a0a0a0', intensity: 0.6, position: { x: 0, y: -22, z: 38 }, size: 300, falloff: 0.58, castShadow: true, animated: false },
      { id: 'fill', type: 'fill', color: '#808080', intensity: 0.25, position: { x: -30, y: 22, z: 25 }, size: 350, falloff: 0.7, castShadow: false, animated: false },
    ],
    shadow: { enabled: true, color: '#080808', blur: 30, offset: { x: 0, y: 8 }, opacity: 0.35, direction: 180 },
    bloom: { enabled: false, threshold: 0.9, intensity: 0.1, radius: 5 },
    volumetric: { enabled: false, color: '#a0a0a0', intensity: 0, angle: 0, decay: 0.98, density: 0, rays: 0 },
    ambientColor: '#121212',
    exposure: 0.88,
    contrast: 0.95,
    saturation: 0.7,
  },
  
  disappointed: {
    lights: [
      { id: 'key', type: 'key', color: '#9090a0', intensity: 0.55, position: { x: -5, y: -25, z: 40 }, size: 280, falloff: 0.55, castShadow: true, animated: false },
      { id: 'fill', type: 'fill', color: '#607080', intensity: 0.28, position: { x: -35, y: 25, z: 28 }, size: 330, falloff: 0.68, castShadow: false, animated: false },
    ],
    shadow: { enabled: true, color: '#050508', blur: 32, offset: { x: -2, y: 10 }, opacity: 0.45, direction: 175 },
    bloom: { enabled: false, threshold: 0.88, intensity: 0.12, radius: 6 },
    volumetric: { enabled: false, color: '#9090a0', intensity: 0, angle: 0, decay: 0.97, density: 0, rays: 0 },
    ambientColor: '#0a0a10',
    exposure: 0.82,
    contrast: 0.98,
    saturation: 0.72,
  },
  
  lonely: {
    lights: [
      { id: 'key', type: 'key', color: '#6080a0', intensity: 0.45, position: { x: 0, y: -18, z: 35 }, size: 320, falloff: 0.62, castShadow: true, animated: false },
    ],
    shadow: { enabled: true, color: '#000510', blur: 40, offset: { x: 0, y: 15 }, opacity: 0.55, direction: 180 },
    bloom: { enabled: false, threshold: 0.92, intensity: 0.08, radius: 4 },
    volumetric: { enabled: false, color: '#6080a0', intensity: 0, angle: 0, decay: 0.99, density: 0.05, rays: 0 },
    ambientColor: '#05080a',
    exposure: 0.75,
    contrast: 1.0,
    saturation: 0.6,
  },
  
  thinking: {
    lights: [
      { id: 'key', type: 'key', color: '#c0d0e0', intensity: 0.75, position: { x: 15, y: -35, z: 50 }, size: 250, falloff: 0.48, castShadow: true, animated: true, animation: { type: 'pulse', speed: 0.25, amplitude: 0.08 } },
      { id: 'fill', type: 'fill', color: '#8090b0', intensity: 0.35, position: { x: -40, y: 10, z: 32 }, size: 310, falloff: 0.6, castShadow: false, animated: false },
      { id: 'accent', type: 'accent', color: '#a0c0e0', intensity: 0.25, position: { x: 45, y: -50, z: 40 }, size: 80, falloff: 0.75, castShadow: false, animated: true, animation: { type: 'pulse', speed: 0.5, amplitude: 0.2 } },
    ],
    shadow: { enabled: true, color: '#05080c', blur: 22, offset: { x: 5, y: 8 }, opacity: 0.35, direction: 135 },
    bloom: { enabled: true, threshold: 0.7, intensity: 0.25, radius: 10, color: '#c0d0e0' },
    volumetric: { enabled: false, color: '#c0d0e0', intensity: 0, angle: 0, decay: 0.95, density: 0, rays: 0 },
    ambientColor: '#0a0c12',
    exposure: 0.95,
    contrast: 1.02,
    saturation: 0.9,
  },
  
  curious: {
    lights: [
      { id: 'key', type: 'key', color: '#e0e8ff', intensity: 0.9, position: { x: 25, y: -38, z: 55 }, size: 230, falloff: 0.45, castShadow: true, animated: true, animation: { type: 'sway', speed: 0.5, amplitude: 0.12 } },
      { id: 'fill', type: 'fill', color: '#a0b8d0', intensity: 0.4, position: { x: -35, y: 15, z: 35 }, size: 295, falloff: 0.58, castShadow: false, animated: false },
      { id: 'rim', type: 'rim', color: '#ffffff', intensity: 0.32, position: { x: -50, y: -25, z: 80 }, size: 145, falloff: 0.32, castShadow: false, animated: false },
    ],
    shadow: { enabled: true, color: '#080a10', blur: 18, offset: { x: 6, y: 7 }, opacity: 0.3, direction: 130 },
    bloom: { enabled: true, threshold: 0.62, intensity: 0.38, radius: 14, color: '#e0e8ff' },
    volumetric: { enabled: false, color: '#e0e8ff', intensity: 0, angle: 0, decay: 0.95, density: 0, rays: 0 },
    ambientColor: '#0c0e15',
    exposure: 1.02,
    contrast: 1.05,
    saturation: 1.02,
  },
  
  determined: {
    lights: [
      { id: 'key', type: 'key', color: '#f0e8d8', intensity: 1.1, position: { x: 30, y: -40, z: 58 }, size: 220, falloff: 0.4, castShadow: true, animated: false },
      { id: 'fill', type: 'fill', color: '#c09060', intensity: 0.4, position: { x: -42, y: 8, z: 35 }, size: 280, falloff: 0.55, castShadow: false, animated: false },
      { id: 'rim', type: 'rim', color: '#ffffff', intensity: 0.4, position: { x: -55, y: -30, z: 85 }, size: 160, falloff: 0.28, castShadow: false, animated: true, animation: { type: 'pulse', speed: 0.3, amplitude: 0.1 } },
    ],
    shadow: { enabled: true, color: '#0c0a08', blur: 15, offset: { x: 7, y: 9 }, opacity: 0.35, direction: 125 },
    bloom: { enabled: true, threshold: 0.55, intensity: 0.45, radius: 16, color: '#f0e8d8' },
    volumetric: { enabled: true, color: '#f0e8d8', intensity: 0.3, angle: 30, decay: 0.9, density: 0.25, rays: 5 },
    ambientColor: '#12100a',
    exposure: 1.1,
    contrast: 1.1,
    saturation: 1.08,
  },
  
  playful: {
    lights: [
      { id: 'key', type: 'key', color: '#ffe0f0', intensity: 1.05, position: { x: 22, y: -35, z: 52 }, size: 245, falloff: 0.44, castShadow: true, animated: true, animation: { type: 'sway', speed: 1, amplitude: 0.15 } },
      { id: 'fill', type: 'fill', color: '#a0e0ff', intensity: 0.45, position: { x: -38, y: 12, z: 36 }, size: 310, falloff: 0.58, castShadow: false, animated: true, animation: { type: 'sway', speed: 0.8, amplitude: 0.12, phase: Math.PI / 2 } },
      { id: 'accent', type: 'accent', color: '#ffff00', intensity: 0.35, position: { x: 50, y: 40, z: 22 }, size: 100, falloff: 0.75, castShadow: false, animated: true, animation: { type: 'rotate', speed: 1.5, amplitude: 0.25 } },
    ],
    shadow: { enabled: true, color: '#100a12', blur: 14, offset: { x: 4, y: 6 }, opacity: 0.25, direction: 125 },
    bloom: { enabled: true, threshold: 0.52, intensity: 0.55, radius: 20, color: '#ffe0f0' },
    volumetric: { enabled: false, color: '#ffe0f0', intensity: 0, angle: 0, decay: 0.95, density: 0, rays: 0 },
    ambientColor: '#150a15',
    exposure: 1.08,
    contrast: 1.05,
    saturation: 1.25,
  },
};

/**
 * 时间氛围光照调整
 */
const TIME_LIGHTING_MODIFIERS: Record<TimeOfDay, Partial<LightingScene>> = {
  dawn: {
    ambientColor: '#1a1520',
    exposure: 0.9,
    saturation: 1.1,
    lights: [
      { id: 'sun', type: 'key', color: '#ff9060', intensity: 0.6, position: { x: 80, y: 0, z: 60 }, size: 400, falloff: 0.4, castShadow: true, animated: false },
    ],
  },
  morning: {
    ambientColor: '#f0f5ff',
    exposure: 1.1,
    saturation: 1.05,
    lights: [
      { id: 'sun', type: 'key', color: '#fff8e0', intensity: 1.0, position: { x: 60, y: -40, z: 70 }, size: 350, falloff: 0.35, castShadow: true, animated: false },
    ],
  },
  afternoon: {
    ambientColor: '#fff8f0',
    exposure: 1.15,
    saturation: 1.0,
    lights: [
      { id: 'sun', type: 'key', color: '#ffffff', intensity: 1.2, position: { x: 20, y: -60, z: 80 }, size: 300, falloff: 0.3, castShadow: true, animated: false },
    ],
  },
  evening: {
    ambientColor: '#201815',
    exposure: 0.95,
    saturation: 1.15,
    lights: [
      { id: 'sun', type: 'key', color: '#ff6040', intensity: 0.8, position: { x: -70, y: -10, z: 55 }, size: 450, falloff: 0.45, castShadow: true, animated: false },
    ],
  },
  night: {
    ambientColor: '#0a0a15',
    exposure: 0.7,
    saturation: 0.85,
    lights: [
      { id: 'moon', type: 'key', color: '#a0b0c0', intensity: 0.4, position: { x: -50, y: -50, z: 60 }, size: 500, falloff: 0.5, castShadow: true, animated: false },
    ],
  },
  midnight: {
    ambientColor: '#050508',
    exposure: 0.5,
    saturation: 0.7,
    lights: [
      { id: 'moon', type: 'key', color: '#8090a0', intensity: 0.25, position: { x: 0, y: -70, z: 50 }, size: 600, falloff: 0.6, castShadow: true, animated: false },
    ],
  },
};

/**
 * 天气光照调整
 */
const WEATHER_LIGHTING_MODIFIERS: Record<Weather, Partial<LightingScene>> = {
  clear: {
    exposure: 1.1,
    contrast: 1.05,
    saturation: 1.1,
  },
  cloudy: {
    exposure: 0.9,
    contrast: 0.95,
    saturation: 0.9,
    shadow: { enabled: true, color: '#808080', blur: 40, offset: { x: 0, y: 5 }, opacity: 0.2, direction: 180 },
  },
  rainy: {
    exposure: 0.75,
    contrast: 1.0,
    saturation: 0.8,
    ambientColor: '#1a1a20',
    shadow: { enabled: true, color: '#000020', blur: 50, offset: { x: -5, y: 10 }, opacity: 0.4, direction: 200 },
  },
  stormy: {
    exposure: 0.6,
    contrast: 1.15,
    saturation: 0.7,
    ambientColor: '#101018',
    lights: [
      { id: 'lightning', type: 'accent', color: '#ffffff', intensity: 0, position: { x: 0, y: -80, z: 100 }, size: 800, falloff: 0.1, castShadow: true, animated: true, animation: { type: 'flicker', speed: 5, amplitude: 1.5 } },
    ],
  },
  snowy: {
    exposure: 1.05,
    contrast: 0.9,
    saturation: 0.85,
    ambientColor: '#e0e5f0',
  },
  foggy: {
    exposure: 0.85,
    contrast: 0.8,
    saturation: 0.75,
    ambientColor: '#c0c0c5',
    bloom: { enabled: true, threshold: 0.3, intensity: 0.4, radius: 50 },
  },
};

// ============= 动态光照系统类 =============

/**
 * 动态光照系统
 */
export class DynamicLightingSystem {
  private state: LightingState;
  private animationFrame: number | null = null;
  private lastUpdateTime: number = 0;
  private transitionFrom: LightingScene | null = null;
  private transitionTo: LightingScene | null = null;
  private transitionStartTime: number = 0;
  private transitionDuration: number = 800;
  private subscribers: Set<(state: LightingState) => void> = new Set();
  
  private currentEmotion: Expression = 'neutral';
  private currentTimeOfDay: TimeOfDay = 'afternoon';
  private currentWeather: Weather = 'clear';
  
  constructor() {
    this.state = this.createInitialState();
  }
  
  private createInitialState(): LightingState {
    const scene = this.buildScene('neutral', 'afternoon', 'clear');
    return {
      currentScene: 'neutral',
      lights: scene.lights,
      shadow: scene.shadow,
      bloom: scene.bloom,
      volumetric: scene.volumetric,
      exposure: scene.exposure,
      contrast: scene.contrast,
      saturation: scene.saturation,
      cssFilters: this.buildCSSFilters(scene),
      transitionProgress: 1,
    };
  }
  
  /**
   * 构建完整光照场景
   */
  private buildScene(emotion: Expression, time: TimeOfDay, weather: Weather): LightingScene {
    const baseScene = EMOTION_LIGHTING[emotion] || EMOTION_LIGHTING.neutral;
    const timeModifier = TIME_LIGHTING_MODIFIERS[time] || {};
    const weatherModifier = WEATHER_LIGHTING_MODIFIERS[weather] || {};
    
    // 合并光源
    const lights = [
      ...(baseScene.lights || []),
      ...(timeModifier.lights || []),
      ...(weatherModifier.lights || []),
    ];
    
    // 合并其他属性
    return {
      name: `${emotion}_${time}_${weather}`,
      lights,
      shadow: { ...baseScene.shadow!, ...weatherModifier.shadow },
      bloom: { ...baseScene.bloom!, ...weatherModifier.bloom },
      volumetric: baseScene.volumetric!,
      ambientColor: weatherModifier.ambientColor || timeModifier.ambientColor || baseScene.ambientColor || '#1a2a3a',
      exposure: (baseScene.exposure || 1) * (timeModifier.exposure || 1) * (weatherModifier.exposure || 1),
      contrast: (baseScene.contrast || 1) * (timeModifier.contrast || 1) * (weatherModifier.contrast || 1),
      saturation: (baseScene.saturation || 1) * (timeModifier.saturation || 1) * (weatherModifier.saturation || 1),
    };
  }
  
  /**
   * 生成 CSS filters 字符串
   */
  private buildCSSFilters(scene: LightingScene): string {
    const filters: string[] = [];
    
    // 曝光 (用 brightness 模拟)
    if (scene.exposure !== 1) {
      filters.push(`brightness(${scene.exposure})`);
    }
    
    // 对比度
    if (scene.contrast !== 1) {
      filters.push(`contrast(${scene.contrast})`);
    }
    
    // 饱和度
    if (scene.saturation !== 1) {
      filters.push(`saturate(${scene.saturation})`);
    }
    
    return filters.length > 0 ? filters.join(' ') : 'none';
  }
  
  /**
   * 设置情绪
   */
  setEmotion(emotion: Expression): void {
    if (this.currentEmotion === emotion) return;
    this.currentEmotion = emotion;
    this.startTransition();
  }
  
  /**
   * 设置时间氛围
   */
  setTimeOfDay(time: TimeOfDay): void {
    if (this.currentTimeOfDay === time) return;
    this.currentTimeOfDay = time;
    this.startTransition();
  }
  
  /**
   * 设置天气
   */
  setWeather(weather: Weather): void {
    if (this.currentWeather === weather) return;
    this.currentWeather = weather;
    this.startTransition();
  }
  
  /**
   * 开始过渡动画
   */
  private startTransition(): void {
    this.transitionFrom = this.buildScene(this.currentEmotion, this.currentTimeOfDay, this.currentWeather);
    this.transitionTo = this.buildScene(this.currentEmotion, this.currentTimeOfDay, this.currentWeather);
    this.transitionStartTime = performance.now();
    this.state.transitionProgress = 0;
    
    // 直接应用新场景 (简化版，后续可添加插值)
    this.applyScene(this.transitionTo);
  }
  
  /**
   * 应用光照场景
   */
  private applyScene(scene: LightingScene): void {
    this.state = {
      currentScene: scene.name,
      lights: scene.lights,
      shadow: scene.shadow,
      bloom: scene.bloom,
      volumetric: scene.volumetric,
      exposure: scene.exposure,
      contrast: scene.contrast,
      saturation: scene.saturation,
      cssFilters: this.buildCSSFilters(scene),
      transitionProgress: 1,
    };
    this.notifySubscribers();
  }
  
  /**
   * 启动动画循环
   */
  start(): void {
    if (this.animationFrame !== null) return;
    this.lastUpdateTime = performance.now();
    this.animate();
  }
  
  /**
   * 停止动画循环
   */
  stop(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }
  
  /**
   * 动画循环
   */
  private animate = (): void => {
    const now = performance.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;
    
    // 更新光源动画
    let updated = false;
    for (const light of this.state.lights) {
      if (light.animated && light.animation) {
        updated = true;
        this.updateLightAnimation(light, now, deltaTime);
      }
    }
    
    if (updated) {
      this.notifySubscribers();
    }
    
    this.animationFrame = requestAnimationFrame(this.animate);
  };
  
  /**
   * 更新单个光源动画
   */
  private updateLightAnimation(light: LightSource, now: number, _deltaTime: number): void {
    if (!light.animation) return;
    
    const { type, speed, amplitude, phase = 0 } = light.animation;
    const time = now / 1000 * speed + phase;
    
    switch (type) {
      case 'pulse': {
        const pulseFactor = Math.sin(time * Math.PI * 2) * amplitude;
        light.intensity = Math.max(0, light.intensity * (1 + pulseFactor));
        break;
      }
      case 'flicker': {
        const flicker = (Math.random() - 0.5) * 2 * amplitude;
        light.intensity = Math.max(0, light.intensity * (1 + flicker));
        break;
      }
      case 'sway': {
        const swayX = Math.sin(time * Math.PI * 2) * amplitude * 20;
        const swayY = Math.cos(time * Math.PI * 1.5) * amplitude * 10;
        light.position.x += swayX;
        light.position.y += swayY;
        break;
      }
      case 'rotate': {
        const angle = time * Math.PI * 2;
        const radius = amplitude * 30;
        light.position.x = Math.cos(angle) * radius;
        light.position.y = Math.sin(angle) * radius;
        break;
      }
    }
  }
  
  /**
   * 订阅状态变化
   */
  subscribe(callback: (state: LightingState) => void): () => void {
    this.subscribers.add(callback);
    callback(this.state);
    return () => this.subscribers.delete(callback);
  }
  
  /**
   * 通知订阅者
   */
  private notifySubscribers(): void {
    for (const callback of this.subscribers) {
      callback(this.state);
    }
  }
  
  /**
   * 获取当前状态
   */
  getState(): LightingState {
    return { ...this.state };
  }
  
  /**
   * 获取光照 CSS 变量
   */
  getCSSVariables(): Record<string, string> {
    const vars: Record<string, string> = {};
    
    // 主光源颜色和位置
    const keyLight = this.state.lights.find(l => l.type === 'key');
    if (keyLight) {
      vars['--light-key-color'] = keyLight.color;
      vars['--light-key-intensity'] = String(keyLight.intensity);
      vars['--light-key-x'] = `${keyLight.position.x + 50}%`;
      vars['--light-key-y'] = `${keyLight.position.y + 50}%`;
      vars['--light-key-size'] = `${keyLight.size}px`;
    }
    
    // 补光
    const fillLight = this.state.lights.find(l => l.type === 'fill');
    if (fillLight) {
      vars['--light-fill-color'] = fillLight.color;
      vars['--light-fill-intensity'] = String(fillLight.intensity);
    }
    
    // 边缘光
    const rimLight = this.state.lights.find(l => l.type === 'rim');
    if (rimLight) {
      vars['--light-rim-color'] = rimLight.color;
      vars['--light-rim-intensity'] = String(rimLight.intensity);
    }
    
    // 阴影
    if (this.state.shadow.enabled) {
      vars['--shadow-color'] = this.state.shadow.color;
      vars['--shadow-blur'] = `${this.state.shadow.blur}px`;
      vars['--shadow-offset-x'] = `${this.state.shadow.offset.x}px`;
      vars['--shadow-offset-y'] = `${this.state.shadow.offset.y}px`;
      vars['--shadow-opacity'] = String(this.state.shadow.opacity);
    }
    
    // 辉光
    if (this.state.bloom.enabled) {
      vars['--bloom-intensity'] = String(this.state.bloom.intensity);
      vars['--bloom-radius'] = `${this.state.bloom.radius}px`;
      if (this.state.bloom.color) {
        vars['--bloom-color'] = this.state.bloom.color;
      }
    }
    
    // 曝光/对比度/饱和度
    vars['--exposure'] = String(this.state.exposure);
    vars['--contrast'] = String(this.state.contrast);
    vars['--saturation'] = String(this.state.saturation);
    vars['--filters'] = this.state.cssFilters;
    
    return vars;
  }
  
  /**
   * 生成光源渲染数据
   */
  getLightRenderData(): Array<{
    id: string;
    type: LightType;
    color: string;
    intensity: number;
    x: number;
    y: number;
    size: number;
    blur: number;
  }> {
    return this.state.lights.map(light => ({
      id: light.id,
      type: light.type,
      color: light.color,
      intensity: light.intensity,
      x: light.position.x + 50, // 转换为 0-100 范围
      y: light.position.y + 50,
      size: light.size,
      blur: light.size * light.falloff,
    }));
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    this.stop();
    this.subscribers.clear();
  }
}

// ============= 单例和便捷函数 =============

let instance: DynamicLightingSystem | null = null;

/**
 * 获取动态光照系统单例
 */
export function getDynamicLightingSystem(): DynamicLightingSystem {
  if (!instance) {
    instance = new DynamicLightingSystem();
  }
  return instance;
}

/**
 * 设置光照情绪
 */
export function setLightingEmotion(emotion: Expression): void {
  getDynamicLightingSystem().setEmotion(emotion);
}

/**
 * 设置时间氛围
 */
export function setLightingTimeOfDay(time: TimeOfDay): void {
  getDynamicLightingSystem().setTimeOfDay(time);
}

/**
 * 设置天气光照
 */
export function setLightingWeather(weather: Weather): void {
  getDynamicLightingSystem().setWeather(weather);
}
