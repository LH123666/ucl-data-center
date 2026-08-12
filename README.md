# UCL 36 · 欧冠数据中心

无需传统服务器的模块化前端数据网站。用户可主动更新 ESPN / UEFA 数据，查看积分榜、赛果、赛程、资格赛与晋级路径，并在本地保存个人预测。

## 功能

- 2026/27 欧冠积分榜、赛果与未来赛程
- 一键更新数据及最后更新时间反馈
- 资格赛和淘汰赛晋级路径
- 比赛详情、历史交锋与球队赛季记录
- 最多五组个人预测（`localStorage`）
- 中英文球队名称与响应式界面

## 目录

```text
.
├─ index.html
├─ css/                   # 页面与组件样式
├─ js/
│  ├─ api/                # 后续新增数据源适配器
│  ├─ data/               # 静态及回退数据
│  ├─ services/           # 后续新增纯计算逻辑
│  ├─ ui/                 # 各页面界面模块
│  ├─ app.js              # 页面初始化
│  └─ data-manager.js     # 统一数据更新入口
└─ functions/api/         # 预留 Pages Functions
```

## 本地运行

项目没有依赖。建议使用静态服务器，避免 `file://` 的浏览器限制：

```powershell
python -m http.server 8080
```

访问 `http://localhost:8080`。

## 更新与部署

- 程序更新：修改代码 → 推送 GitHub → 部署平台自动发布。
- 足球数据更新：点击“更新数据” → 浏览器请求数据源 → 重新计算并渲染；无需重新部署。
- 当前不包含 DeepSeek、账户、云数据库或传统后端。
- 遇到跨域、密钥、缓存或数据库需求时，可在 `functions/api/` 增加 Cloudflare Pages Functions。

生产环境建议用 GitHub 管理源码并连接 Cloudflare Pages。

## 数据来源

数据来自 ESPN Scoreboard API，并参考 UEFA 官方赛程和规则。第三方数据字段可能变化，请以官方信息为准。
