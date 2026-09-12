# 资产与许可清单

更新：2026-09-12。此清单不是给整个仓库授予新的开源许可证；发布/再分发时需保留各依赖自身许可。

| 项目 | 来源 / 权利边界 | 本仓库用法 |
| --- | --- | --- |
| 地标、人物、地形整形、植物、海鸥、摩天轮、云、水面 | 仓库程序生成的原创几何/着色表达 | 无下载的第三方 glTF、贴图库或人物肖像；真实建筑为艺术化参考，不声称测绘精确度 |
| 图标与字体 | UI 使用 lucide-react；当前布局文字由浏览器字体渲染 | Lucide 为 ISC；本阶段未新增字体下载或字体文件。图标许可随依赖保留；构建目录可保留框架已有 Geist 字体缓存，不属于本阶段新增素材 |
| favicon.svg | 仓库既有矢量图 | 保留现有资产，没有引入外部位图 |
| 环境声 | 仓库 Web Audio 合成噪声与振荡器 | 无网络录音、音乐或第三方采样；统一音量接入原有声音生命周期 |
| 梧桐山 elevation.json | Tilezen / Mapzen Terrain Tiles 派生高程，SRTM / GMTED2010 等美国政府公共领域数据 | 来源、哈希、采样及署名见 references.md；非官方导航地图 |
| 地点资料/地图/照片 | references.md 逐项列出 | 公开查看不代表图片可复制；仅参考事实和轮廓，不再分发网页照片/地图瓦片。无法确认的布局为艺术化推断 |
| Three.js 0.180.0（含 OrbitControls、后处理） | MIT，Copyright © 2010–2025 three.js authors | 本地 `node_modules/three/LICENSE`；统一 bloom 使用已安装 addons，无新增模型资产 |
| Rapier JS compat 0.20.0 | Apache-2.0，Dimforge / Sébastien Crozet | 本地依赖 package.json 声明；继续同一物理引擎，无第二套物理 |
| React / React DOM、其他 UI 与构建依赖 | 各 npm 包自身 LICENSE / package.json | 版本锁定见 pnpm-lock.yaml；本表不替代第三方完整许可证 |

高程署名：SRTM and GMTED2010 data courtesy of the U.S. Geological Survey. Global ETOPO1 terrain data: U.S. National Oceanic and Atmospheric Administration. Derived distribution: Tilezen / Mapzen Terrain Tiles. 修改后的微缩山体不代表数据提供方认可。

本阶段没有引入朋友姓名、真实肖像、私人录音或外部图片素材。后续若加入个人照片/音乐，应单独确认本人和涉及人物的使用授权，不因本项目公开而推定获得许可。
