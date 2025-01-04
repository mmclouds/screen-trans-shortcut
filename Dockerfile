# 使用 Node.js 官方镜像作为基础镜像
FROM node:18-slim

# 添加构建参数
ARG VOLC_ACCESS_KEY
ARG VOLC_SECRET_KEY

# 设置环境变量
ENV VOLC_ACCESS_KEY=${VOLC_ACCESS_KEY}
ENV VOLC_SECRET_KEY=${VOLC_SECRET_KEY}
ENV PORT=3000
ENV NODE_ENV=production

# 安装必要的系统依赖
RUN apt-get update && apt-get install -y \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装项目依赖
RUN npm install

# 复制项目文件
COPY . .

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["node", "ImagesTrans.js"] 