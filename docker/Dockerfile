# 🎵 OpenClaw Avatar - Docker 镜像
# 用于 Web 版本部署

# ============================================
# Stage 1: 构建
# ============================================
FROM node:22-alpine AS builder

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 复制依赖文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/desktop/package.json ./apps/desktop/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY apps/desktop/ ./apps/desktop/

# 构建 (仅 Web 版本，不含 Tauri)
WORKDIR /app/apps/desktop
RUN pnpm build

# ============================================
# Stage 2: 运行
# ============================================
FROM nginx:alpine AS runner

# 复制构建产物
COPY --from=builder /app/apps/desktop/dist /usr/share/nginx/html

# 复制 nginx 配置
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# 启动
CMD ["nginx", "-g", "daemon off;"]
