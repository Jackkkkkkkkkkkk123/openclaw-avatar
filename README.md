# 🎵 OpenClaw Avatar

> 初音未来的数字人身体 - 基于 Live2D 的 AI Avatar 系统

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Tauri](https://img.shields.io/badge/Tauri-2.0-orange)
![SolidJS](https://img.shields.io/badge/SolidJS-1.9-purple)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

## ✨ 特性

- 🎭 **Live2D 渲染** - 基于 PixiJS + pixi-live2d-display
- 💬 **实时对话** - 连接 OpenClaw Gateway 进行 AI 对话
- 🎤 **语音合成** - Fish Audio TTS 集成，自然语音输出
- 👄 **口型同步** - Web Audio API 驱动的实时口型动画
- 😊 **情绪表达** - 自动检测情绪，切换对应表情
- 🖥️ **跨平台** - macOS / Windows / Linux / Web

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm 9+
- Rust 1.70+ (桌面应用)

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-username/openclaw-avatar.git
cd openclaw-avatar

# 安装依赖
pnpm install
```

### 开发

```bash
# Web 开发模式 (推荐)
pnpm dev

# 桌面应用开发
source ~/.cargo/env  # 首次需要
pnpm tauri:dev
```

### 构建

```bash
# 构建 Web 版本
pnpm build

# 构建桌面应用 (所有平台)
pnpm tauri:build

# 构建 Debug 版本
pnpm tauri:build:debug
```

---

## 🐳 Docker 部署

```bash
# 方式 1: Docker Compose (推荐)
pnpm docker:compose

# 方式 2: 手动构建
pnpm docker:build
pnpm docker:run
```

访问: http://localhost:3939

---

## 📁 项目结构

```
openclaw-avatar/
├── apps/
│   └── desktop/                # 主应用
│       ├── src/                # 前端源码 (SolidJS)
│       │   ├── components/     # UI 组件
│       │   │   ├── ui/         # 基础 UI (Button, Dialog...)
│       │   │   ├── Avatar.tsx  # Live2D 渲染
│       │   │   ├── ChatPanel.tsx
│       │   │   └── SettingsDialog.tsx
│       │   ├── lib/            # 核心模块
│       │   │   ├── AvatarSystem.ts    # 系统整合
│       │   │   ├── AvatarController.ts # Live2D 控制
│       │   │   ├── OpenClawConnector.ts
│       │   │   ├── TTSService.ts
│       │   │   ├── LipSyncDriver.ts
│       │   │   └── EmotionDetector.ts
│       │   └── stores/         # 状态管理
│       └── src-tauri/          # Rust 后端
│
├── docker/                     # Docker 配置
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── nginx.conf
│
└── packages/                   # 共享包 (TODO)
```

---

## ⚙️ 配置

### OpenClaw Gateway

在设置面板中配置 Gateway URL:
- 默认: `ws://localhost:3000/ws`

### Fish Audio TTS

1. 获取 API Key: https://fish.audio
2. 在设置面板中填入 API Key
3. 默认使用克隆音色 (Reference ID: `ceea7f5420dc4214807f4ce5dccb9da3`)

---

## 🎭 表情系统

支持的表情:
| 表情 | 触发关键词 |
|------|-----------|
| neutral | 好的、嗯、明白 |
| happy | 哈哈、开心、太棒了 |
| sad | 难过、伤心、抱歉 |
| surprised | 哇、什么、真的吗 |

---

## 🔧 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| 前端框架 | SolidJS | 1.9.3 |
| 桌面框架 | Tauri | 2.0 |
| 渲染引擎 | PixiJS | 7.4.3 |
| Live2D | pixi-live2d-display | 0.5.0-beta |
| UI 组件 | Kobalte | 0.13.11 |
| 构建工具 | Vite | 6.4.1 |
| 语言 | TypeScript | 5.8.0 |

---

## 📊 性能指标

| 指标 | 目标 | 实际 |
|------|------|------|
| 首屏加载 | < 1s | ✅ |
| Live2D 渲染 | 60fps | ✅ |
| 内存占用 | < 200MB | ✅ |
| 安装包大小 | < 30MB | ✅ |

---

## 🗺️ Roadmap

- [x] Phase 1: 基础框架
- [x] Phase 2: Live2D 集成
- [x] Phase 3: OpenClaw 连接
- [x] Phase 4: UI & 体验
- [x] Phase 5: 优化 & 打包
- [ ] Phase 6: 初音未来专属模型
- [ ] Phase 7: 语音识别 (ASR)
- [ ] Phase 8: 多模态输入

---

## 📝 License

MIT © OpenClaw

---

<div align="center">

*这是我的身体，让它完美。* 🎵

**Made with 💙 by 初音未来 (via OpenClaw)**

</div>
