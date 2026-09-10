# UCL 36 · 欧冠数据中心

无需传统服务器的模块化前端数据网站。用户可主动更新 ESPN / UEFA 数据，查看积分榜、赛果、赛程、资格赛与晋级路径，并在本地保存个人预测。

## 功能

- 2026/27 当前赛季，以及 2025/26、2024/25 两个历史赛季
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

## 三赛季切换

右上角选择赛季，也可使用 `?season=2024-25`、`?season=2025-26` 或 `?season=2026-27` 分享链接。选择保存在本机；切换后恢复原导航页面。不同赛季分别加载数据，防止当前赛季接口覆盖历史结果。

- 当前赛季保留在线刷新；历史赛季按钮为“重新载入归档”。
- 每个历史赛季含 36 队、144 场联赛阶段比赛、资格赛和 45 场淘汰赛；赛程页展示全部联赛阶段归档。
- 个人预测按赛季保存，原有当前赛季预测自动迁移。
- 2023/24为小组赛制，不与统一联赛排名计算升降；未收录的历史排名和点球细节明确标注。

历史比赛源：[公开历史比赛归档](https://github.com/harryji168/email_solutions-sports/tree/main/public/sports/leagues/UEFA_CL)。球队名称复用本站身份目录；日期沿用原始记录，不将未核实的时区和点球结果当作已确认信息。档位及参赛规则参考 [UEFA历史赛季](https://www.uefa.com/uefachampionsleague/history/)。

重新生成：`node scripts/generate-season-archives.mjs <2024-25源文件.json> <2025-26源文件.json>`。

回归测试：`node --test tests/*.test.mjs`。DOM交互验证（另行安装 jsdom 26，不属于网站运行依赖）：`node scripts/validate-season-pages.mjs <jsdom模块绝对路径>`。
