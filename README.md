# 3D 幼儿互动识字卡 · GitHub Pages 部署包

本文件夹为**可直接部署到 GitHub Pages 的静态站点**，已去除全部外部 CDN 依赖，加载迅速、可离线运行核心功能。

## 目录结构

```
github-deploy/
├── index.html          # 主页：两个情境入口卡片
├── nature.html         # 情境一：自然元素（15 字）
├── zoo.html            # 情境二：动物王国（18 字）
├── app.css             # 共享样式（由 index/nature/zoo 引用）
├── data.js             # 共享数据（33 字卡片数据）
├── app.js              # 共享逻辑（语音/田字格/问答/懒加载等）
├── libs/               # 本地化依赖（已下载，非 CDN）
│   ├── three.min.js        # 3D 背景（仅桌面非低端设备空闲加载）
│   ├── hanzi-writer.min.js # 汉字笔顺
│   ├── confetti.min.js     # 通关彩带（首次通关才加载）
│   └── hanzi-data.js       # 33 字笔画数据（本地字典，零运行时请求）
├── *.jpg              # 背景图(2) + 33 张 poster 静图（已压缩）
├── *.mp4              # 33 段循环视频
└── .nojekyll          # 关闭 Jekyll 处理（保证 libs/ 等下划线路径不被忽略）
```

### 外部请求情况
运行时**零外部网络请求**：三个库与 33 个字数据全部本地化。three.js / HanziWriter / confetti 均按需懒加载。

## 部署步骤（GitHub Pages）

1. 将本文件夹 `github-deploy/` 内的**全部内容**复制到你的仓库根目录（或 `docs/` 目录）。
   - 若放到仓库根目录：仓库根直接是这些文件。
   - 若放到 `docs/`：GitHub Pages 设置里 Source 选 `main` 分支 + `/docs`。
2. 确保仓库根保留 `.nojekyll`（本包已含，请勿删除，否则 GitHub 会用 Jekyll 处理、`libs/` 等以 `_` 开头的路径可能被忽略）。
3. 在仓库 **Settings → Pages** 中：
   - Source 选 `Deploy from a branch`
   - Branch 选 `main`（或你的默认分支），目录选 `/ (root)` 或 `/docs`（取决于第 1 步）
4. 保存后等待 1–2 分钟，访问 `https://<用户名>.github.io/<仓库名>/` 即可。

> 注意：主页为 `index.html`，访问站点根路径即进入主页，再从主页进入自然/动物两个情境。

## 本地预览
```bash
cd github-deploy
python -m http.server 8000
# 浏览器打开 http://127.0.0.1:8000/
```
