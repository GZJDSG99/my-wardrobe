# Figma Make 设计来源说明

本小程序 UI 基底来自 Figma Make 社区作品：

- https://www.figma.com/make/OWWTwv81fZtOwkokyXg0ZY/
- 原始社区文件：https://www.figma.com/community/file/1655152426577065372

包含 shadcn/ui（MIT）与 Unsplash 图片素材。业务功能（今日采纳、streak、理由条、柜中/模板、护理与灵感入口等）在此视觉壳上叠加，见 `docs/superpowers/specs/2026-09-10-wechat-wardrobe-prd-design.md`。

## 云开发

- 环境 ID：`cloud1-4g0p7z3p8c0a5b52`
- 在 `app.js` 中 `wx.cloud.init`
- 衣物集合：`clothes`（需在云开发控制台手动创建，权限「仅创建者可读写」）
- 图片路径：云存储 `clothes/`
- 入库页：`pages/wardrobe/add`
- 选图接口：`chooseMedia`（若真机报未授权，请在接口权限中开通，并在隐私指引声明「选中的照片或视频文件」）

## 微信登录

- 云函数：`cloudfunctions/login`（返回 openid）
- 启动时静默登录；「我的」可手动「微信授权登录」
- 头像昵称走头像选择 + 昵称输入（微信规范，不再用 getUserProfile 一键弹窗）
- **必须在开发者工具中右键 `login` 云函数 → 上传并部署：云端安装依赖**


使用 [Open-Meteo](https://open-meteo.com/en/docs) Forecast + Geocoding：

- **无需 API Key**
- 地理编码：`https://geocoding-api.open-meteo.com/v1/search`
- 预报：`https://api.open-meteo.com/v1/forecast`（含 current + 7 日 daily）
- 城市默认：`app.globalData.cityQuery`（如 `Hangzhou`）
- 支持定位：天气页点「定位」→ 微信坐标 + Open-Meteo；可「切回杭州」
- 逆地理：`api.bigdatacloud.net`（取城市名，失败则显示「当前位置」）
- 开发者工具需勾选不校验合法域名，或配置 request 合法域名：
  - `https://api.open-meteo.com`
  - `https://geocoding-api.open-meteo.com`
  - `https://api.bigdatacloud.net`
- 真机需在小程序后台配置位置权限，并完成用户隐私保护指引