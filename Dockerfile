# 构建阶段
FROM node:lts-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock* /app/

RUN yarn install --frozen-lockfile

COPY . /app

RUN yarn run build

# 运行阶段
FROM node:lts-alpine

WORKDIR /app

# 从构建阶段复制输出文件到运行容器
COPY --from=builder /app/.output /app

# 暴露容器运行时的端口
EXPOSE 3000

CMD ["node", "server/index.mjs"]