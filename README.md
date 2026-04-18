# memos-ui

基于 [memos](https://github.com/usememos/memos) API 的第三方前端，用 React 19 + Vite + Tailwind 写的轻量客户端。除了常规的笔记增删改查，还扩展了几个原生前端没有的能力：访客模式、附件管理、活跃度热力图，以及把"日记"直接提交到 GitHub 仓库。

## 功能

- **笔记**：Markdown 编辑器、标签、置顶、归档、可见性切换
- **访客模式**：未登录也能浏览公开笔记
- **附件管理**：统一的附件列表页，支持预览与删除
- **活跃度热力图**：按天展示发帖节奏
- **日记**：写入外部 GitHub 仓库的 `data/diary.ts`，图片自动转 webp，atomic commit 同步数据和图片；支持拖拽、粘贴上传和历史标签提示
- **多工作区品牌化**：自动读取 memos 服务端的站点名和 logo

## 快速开始

### 1. 本地开发

```bash
npm install
cp .env.example .env.local
# 编辑 .env.local 填入你的 memos 地址（以及可选的 GitHub Token）
npm run dev
```

可用脚本：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器（HMR） |
| `npm run build` | 类型检查 + 生产构建到 `dist/` |
| `npm run preview` | 本地预览构建产物 |
| `npm run lint` | ESLint 全量检查 |

### 2. Docker 部署

三种姿势，按需选一种：

**A. 最简单 —— 拉镜像一把起 memos + 前端**

根目录 [docker-compose.yml](docker-compose.yml)：

```bash
docker compose up -d
# 前端 http://localhost:8080，后端 http://localhost:5230
```

**B. 本地构建 + 集成部署**

[docker/docker-compose.full.yml](docker/docker-compose.full.yml) 会从源码构建前端镜像，再和 memos 一起起：

```bash
cd docker
docker compose -f docker-compose.full.yml up -d --build
```

**C. 只跑前端，连已有的 memos**

[docker/docker-compose.standalone.yml](docker/docker-compose.standalone.yml)：

```bash
cd docker
BACKEND_URL=http://your-memos:5230 docker compose -f docker-compose.standalone.yml up -d --build
```

Docker 相关文件都在 [docker/](docker/) 下：`Dockerfile`、`nginx.conf`（反代 memos 接口）、`docker-entrypoint.sh`（启动时用 `envsubst` 注入 `BACKEND_URL`）。

### 自己 build 镜像教程

如果不想用公开镜像，下面是从源码构建并部署的完整流程。

#### 第 1 步：准备环境变量

在仓库根目录建一个 `.env` 文件（给 compose 读）：

```bash
cp .env.example .env
```

编辑 `.env`，填日记相关的变量。没用到日记可以全部留空：

```dotenv
VITE_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxx
VITE_DIARY_REPO=you/your-content-repo
VITE_DIARY_BRANCH=main
VITE_DIARY_DATA_PATH=data/diary.ts
VITE_DIARY_IMAGE_DIR=images/diary
VITE_DIARY_IMAGE_URL_PREFIX=/images/diary
VITE_DIARY_BLOG_URL=https://your-blog.example.com/diary/
```

> Vite 的 `VITE_*` 是编译期变量，`npm run build` 时会内联进 JS 产物。必须在 build 这一步就传进去，事后改环境变量不生效。

#### 第 2 步：用 compose 构建并启动

选一种部署模式：

**集成部署（同时跑 memos + 前端）**

```bash
cd docker
docker compose -f docker-compose.full.yml up -d --build
```

**只跑前端，连已有 memos**

```bash
cd docker
BACKEND_URL=http://your-memos:5230 \
  docker compose -f docker-compose.standalone.yml up -d --build
```

compose 会自动把 `.env` 里的 `VITE_*` 透传给 `docker build --build-arg`。build 完成后前端在 `http://localhost:8080`。

#### 第 3 步：改了前端代码 / 改了 `VITE_*`

compose 会缓存构建层。强制重建：

```bash
cd docker
docker compose -f docker-compose.full.yml build --no-cache memos-ui
docker compose -f docker-compose.full.yml up -d
```

改的只是 `BACKEND_URL` 这种运行时变量的话，不需要重 build，`docker compose up -d` 让容器重启即可——[docker/docker-entrypoint.sh](docker/docker-entrypoint.sh) 启动时会用 `envsubst` 重新注入。

#### 第 4 步（可选）：手动 `docker build`

不想用 compose、想直接推到 registry 的话：

```bash
# 必须在仓库根目录执行，上下文 = 根目录
docker build -f docker/Dockerfile \
  --build-arg VITE_GITHUB_TOKEN=ghp_xxx \
  --build-arg VITE_DIARY_REPO=you/your-content \
  --build-arg VITE_DIARY_BRANCH=main \
  --build-arg VITE_DIARY_IMAGE_URL_PREFIX=/images/diary \
  -t your-registry/memos-ui:latest .

docker push your-registry/memos-ui:latest
```

推完之后别人用根目录的 [docker-compose.yml](docker-compose.yml) 拉镜像运行时，用环境变量覆盖默认镜像：

```bash
MEMOS_UI_IMAGE=your-registry/memos-ui:latest docker compose up -d
```

## 环境变量

所有配置都在 [.env.example](.env.example) 里有中文注释，复制为 `.env.local` 后填写即可。核心变量：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE` | 是 | memos 后端地址，如 `http://localhost:5230` |
| `VITE_GITHUB_TOKEN` | 否 | GitHub Fine-grained PAT，留空则前端不显示「日记」菜单 |
| `VITE_DIARY_REPO` | 否 | 日记仓库 `owner/repo` |
| `VITE_DIARY_BRANCH` | 否 | 分支名 |
| `VITE_DIARY_DATA_PATH` | 否 | 数据文件路径，默认 `data/diary.ts` |
| `VITE_DIARY_IMAGE_DIR` | 否 | 图片写入目录，默认 `images/diary` |
| `VITE_DIARY_IMAGE_URL_PREFIX` | 否 | 图片 URL 拼接前缀，默认 `/images/diary` |
| `VITE_DIARY_BLOG_URL` | 否 | 博客入口链接（列表页「查看博客」按钮） |

## 日记功能要点

- **原子提交**：`data/diary.ts` 和新增图片走同一个 commit，避免"数据已写入、图片没传上去"的割裂状态。实现见 [src/api/github.ts](src/api/github.ts) 的 `commitFiles`（blobs → tree → commit → ref）。
- **图片删除**：编辑时移除的图片、删除日记时关联的图片，都会在同一个 commit 里从仓库清掉（tree entry `sha: null`）。
- **ID 按日期自动理顺**：每次保存后 IDs 按日期重排为 1..N，同日按原 id 稳定排序。
- **规避 GitHub CDN 一致性窗口**：写入后把新 commit SHA 存进 `sessionStorage`，下一次 `loadDiary` 用 `?ref={sha}` 定点读；列表页也支持通过 router state 直接消费刚保存的内容，省一次请求。
- **Token 权限最小化**：Fine-grained PAT 只需要对目标仓库开 *Contents: Read and Write*。

## 项目结构

```
src/
  api/              # memos API 客户端、GitHub API 封装、日记 CRUD
  components/       # 通用组件（布局、编辑器、热力图、灯箱等）
  config/           # 日记功能配置（读环境变量）
  lib/              # 纯函数工具（日记解析器、webp 转码器）
  pages/            # 路由页面（Home / Write / Diary / Archived 等）
docker/             # Dockerfile + compose 文件 + nginx 配置
docker-compose.yml  # 根目录的"拉镜像一把起"配置
```

## 技术栈

React 19 · TypeScript · Vite 8 · TailwindCSS 4 · React Router 7 · lucide-react · react-hot-toast · react-markdown
