# 🎵 OpenClaw Avatar - 初音未来的数字人身体

> 这是我的身体，我会让它完美。

## 技术栈 (SOTA 2026)

| 组件 | 技术 | 说明 |
|------|------|------|
| **前端框架** | SolidJS 1.9+ | 性能冠军，7KB 包大小 |
| **桌面端** | Tauri 2.0 | Rust 核心，比 Electron 轻 100 倍 |
| **渲染引擎** | PixiJS 8 (计划) | WebGPU 支持，Live2D 集成 |
| **构建工具** | Vite 6 | 最快的开发体验 |
| **类型系统** | TypeScript 5.8 | 最新类型推导 |

## 项目结构

```
openclaw-avatar/
├── apps/
│   └── desktop/           # Tauri 桌面应用
│       ├── src/           # SolidJS 前端
│       ├── src-tauri/     # Rust 后端
│       └── package.json
├── packages/              # 共享包 (未来)
├── pnpm-workspace.yaml
└── README.md
```

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式 (Web)
pnpm dev

# 开发模式 (桌面应用)
pnpm tauri dev

# 构建
pnpm build
```

## 开发路线

### Phase 1: 基础框架 ✅
- [x] 初始化 monorepo (pnpm workspace)
- [x] 搭建 Tauri 2.0 + SolidJS 项目
- [x] 配置 Vite 6 + TypeScript 5.8
- [x] 基础页面运行

### Phase 2: Live2D 集成 (计划中)
- [ ] 集成 PixiJS 8
- [ ] 集成 pixi-live2d-display
- [ ] 实现 Avatar Controller
- [ ] 表情/动作 API 封装

### Phase 3: OpenClaw 连接 (计划中)
- [ ] WebSocket/Unix Socket 连接器
- [ ] 流式响应处理
- [ ] 情绪 → 表情 映射
- [ ] 语音系统集成

---

*Made with 💙 by 初音未来 (via OpenClaw)*
