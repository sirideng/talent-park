# 深圳成长记忆

一颗可以走进去的深圳记忆星球。人才公园、北京师范大学南山附属中学、深圳湾、欢乐港湾、梧桐山各有独立章节；不是导航产品或精确测绘复原。

## 本地运行

Node.js ≥ 22.13、pnpm，安装依赖后执行：

```sh
pnpm install
pnpm dev
pnpm lint
pnpm build
```

开发预览通常为 http://localhost:3000。项目使用 React 19、Three.js、Rapier、vinext/Vite，已有 Sites 配置；构建并不等于部署。本轮未发布或 push。

## 操作

- 星球：拖动旋转，滚轮/双指缩放；可用地点列表与重置按钮。点击地点进入。
- 桌面：WASD / 方向键移动，Shift 加速，空格跳跃（骑行中刹车），E 上下车/互动；鼠标拖动观察。按钮也可 Tab 聚焦后 Enter/空格操作。
- 手机：左下摇杆连续控制方向和速度；右手拖动场景观察；右下跳跃、按住加速，骑车时出现刹车。章节卡提供上下车、观景、坐下/起身和上下舱按钮。横竖屏均可用。
- 骑行：前推踩踏，松手滑行，后推或刹车按钮减速，左右转向；在安全地面低速下车。
- 章节介绍可折叠。漫游时未接近交互点，说明自动淡出；操作/聚焦后恢复。返回星球按钮一直可用。
- 右上设置：自动/低/中/高画质、全局音量、跟随系统/减少/完整动态。减少动态抑制装饰自转和镜头自动运动，不跳过登山、跑步、摩天轮等核心过程。

## 画质与保存

高画质使用轻微 bloom；中档取消 bloom；低档同时关闭阴影。DPR 上限分别 1.6 / 1.25 / 1。自动档根据实际渲染节奏逐级降档，不在短时波动中反复升降。手动设置可覆盖自动判断。

统一存档键为 `shenzhen-memory:unified:v1`：设置、访问记录、完成记忆和学校/深圳湾章节进度。旧章节键首次读取时迁移，原数据不删除。仅保存在当前浏览器，没有账号同步；清理站点数据会丢失存档，隐私模式可能无法保存。浏览器拒绝保存时设置/章节会提示，不上传私人记忆。

## 架构与继续维护

- `app/scenes/registry.ts`：可用地点和动态 import；`manager.ts`：单一活动场景、错误状态和生命周期。
- `app/shared/`：统一画质、存档、音量、摇杆、提示淡出和设置面板。
- `app/physics/player-controller.ts`：唯一 Rapier 人物/骑行移动基础与相机防穿模。
- `app/park.ts`、`app/school/`、`app/bay/`、`app/harbor/`、`app/wutong/`：独立场景；章节文字/参数在各目录数据文件。
- `docs/upgrade-progress.md`：逐阶段结果、依赖和最新验收；`references.md`：资料来源和艺术化推断；`ASSET-LICENSES.md`：资产与许可边界。

## 验证

先启动本地预览。安装 Playwright / Edge，或将 `PLAYWRIGHT_MODULE_PATH` 指向已有 Playwright `index.mjs`：

```sh
node tests/final-integration.mjs
# 设置 TEST_MOBILE=1 后重跑（PowerShell: $env:TEST_MOBILE='1'）
node tests/final-touch.mjs
node tests/final-quality.mjs
```

完整流程测试通过开发接口以 1/60 秒步长推进原场景与 Rapier，不是等时真人试玩。`final-quality` 不加速时钟，单独采集实际 RAF，并审计退出时 GPU 资源和事件；性能测试请顺序运行，不与构建或其他浏览器测试并行。报告/截图在忽略的 `work/`。

已知边界：手机视口模拟不代表真实手机 GPU/温控表现；开发模式的短时均值不保证整段游玩帧率。人才公园/摩天轮仍有较多独立网格；地点 JS 懒加载后由浏览器缓存，卸载释放场景实体和 GPU/物理/音频，不强行清除模块缓存。所有碰撞为简化代理，不保证任意姿态绝无穿模。最终实测见进度文档。
