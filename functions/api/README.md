# Functions API

`ucl-qualification-live.js` 通过 `/api/ucl-qualification-live` 读取 UEFA 官方资格赛页面，规范球队名称并返回附加赛赛果。官方页面临时不可用时，接口会返回最后一次人工核对的赛果并标记 `stale: true`。
