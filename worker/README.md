# 下载统计 Worker

这个 Worker 为下载页提供两个能力：

- `POST /api/events`：记录匿名页面访问、下载点击和 GitHub 跳转。
- `GET /download`：记录下载点击后跳转到最新 `.plugin` 文件。

不会保存原始 IP、用户文档内容或完整 User-Agent。来源只保留域名，便于区分 GitHub、搜索引擎和推广渠道。

## 部署

需要安装 Cloudflare Wrangler，并登录 Cloudflare：

```bash
npm install -g wrangler
wrangler login
```

在 Cloudflare 创建 D1 数据库：

```bash
wrangler d1 create structured-writing-analytics
```

复制返回的 `database_id`，把 `wrangler.toml.example` 复制为 `wrangler.toml`，然后替换：

- `YOUR_GITHUB_USERNAME.github.io`
- `REPLACE_WITH_D1_DATABASE_ID`

初始化表结构：

```bash
wrangler d1 execute structured-writing-analytics --file=./schema.sql --remote
```

设置后台查询密钥并部署：

```bash
wrangler secret put ADMIN_TOKEN
wrangler deploy
```

部署成功后，将 Worker URL 填入 `site/config.js`：

```js
window.STRUCTURED_WRITING_CONFIG = {
  repository: "guishiru/structured-writing",
  releaseAssetName: "structured-writing.plugin",
  analyticsEndpoint: "https://你的-worker.workers.dev/api/events",
  downloadEndpoint: "https://你的-worker.workers.dev/download"
};
```

然后提交 `site/config.js`，GitHub Pages 工作流会自动重新部署下载页。

## 排除自己的行为

在你自己的浏览器打开一次：

```text
https://guishiru.github.io/structured-writing/?owner=1
```

页面会记住该浏览器为所有者模式，后续在这个浏览器中的页面访问和下载都不会记录。
要恢复统计，打开：

```text
https://guishiru.github.io/structured-writing/?owner=0
```

这只对当前浏览器有效；换设备或清除网站数据后需要重新设置。

## 查看汇总

```bash
curl https://你的-worker.workers.dev/api/summary \
  -H "Authorization: Bearer 你设置的_ADMIN_TOKEN"
```
