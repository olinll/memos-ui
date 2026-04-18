FROM node:20-alpine AS builder

WORKDIR /app

# Vite 的 VITE_* 环境变量是编译期内联的。要让日记等功能在镜像里生效，
# 必须在 build 时通过 --build-arg 传进来（compose 用 build.args）。
ARG VITE_GITHUB_TOKEN=""
ARG VITE_DIARY_REPO=""
ARG VITE_DIARY_BRANCH=""
ARG VITE_DIARY_DATA_PATH=""
ARG VITE_DIARY_IMAGE_DIR=""
ARG VITE_DIARY_IMAGE_URL_PREFIX=""
ARG VITE_DIARY_BLOG_URL=""
ENV VITE_GITHUB_TOKEN=$VITE_GITHUB_TOKEN \
    VITE_DIARY_REPO=$VITE_DIARY_REPO \
    VITE_DIARY_BRANCH=$VITE_DIARY_BRANCH \
    VITE_DIARY_DATA_PATH=$VITE_DIARY_DATA_PATH \
    VITE_DIARY_IMAGE_DIR=$VITE_DIARY_IMAGE_DIR \
    VITE_DIARY_IMAGE_URL_PREFIX=$VITE_DIARY_IMAGE_URL_PREFIX \
    VITE_DIARY_BLOG_URL=$VITE_DIARY_BLOG_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf.template

COPY docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

CMD ["/docker-entrypoint.sh"]
