// 日记功能的运行时配置。全部从 Vite 环境变量读取，缺省值兜底。
// 变量说明见项目根目录的 .env.example。

function env(key: string, fallback: string): string {
  const v = import.meta.env[key];
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

export const DIARY_CONFIG = {
  // 目标仓库，格式 owner/repo
  repo: env('VITE_DIARY_REPO', 'olinll/Mizuki-Content'),
  // 写入的分支
  branch: env('VITE_DIARY_BRANCH', 'master'),
  // 日记数据文件在仓库中的路径
  dataPath: env('VITE_DIARY_DATA_PATH', 'data/diary.ts'),
  // 图片在仓库中的存放目录
  imageDir: env('VITE_DIARY_IMAGE_DIR', 'images/diary'),
  // 写入 data/diary.ts 的图片 URL 前缀
  imageUrlPrefix: env('VITE_DIARY_IMAGE_URL_PREFIX', '/images/diary'),
  // 博客入口（可选，列表页头部的「查看博客」链接使用）
  blogUrl: env('VITE_DIARY_BLOG_URL', 'https://blog.olinl.com/diary/'),
} as const;

// 存储的图片 URL 形如 `/images/diary/foo.webp`。预览走 GitHub raw，保证读到的
// 永远是当前仓库的内容；博客域名拿到的是构建产物，发布前会滞后。
export function resolveImageUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith('/') ? url.slice(1) : url;
  return `https://raw.githubusercontent.com/${DIARY_CONFIG.repo}/${DIARY_CONFIG.branch}/${path}`;
}

export function getGithubToken(): string | undefined {
  const t = import.meta.env.VITE_GITHUB_TOKEN;
  return typeof t === 'string' && t.length > 0 ? t : undefined;
}

export function isDiaryEnabled(): boolean {
  return !!getGithubToken();
}
