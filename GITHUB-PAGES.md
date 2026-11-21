# GitHub Pages 上“网页残缺”的排查

这套站的 3D 不是外部模型文件，而是 `sim/apps3d.js` 用 Canvas 实时画的；音乐在 `audio/nocturnal.mp3`。  
如果 3D 和音乐同时消失，最常见的原因不是代码坏了，而是 **GitHub Pages 没有拿到 `sim/` 和 `audio/` 两个文件夹**。

## 正确的仓库根目录

GitHub Pages 的站点根目录里必须直接看到：

```text
index.html
.nojekyll
sim/
  final.js
  apps3d.js
  motion.js
  audio.js
audio/
  nocturnal.mp3
```

注意：

- 不是只上传 `index.html`
- 不是上传 `dist.zip`
- 不是把 `dist` 文件夹原样放进去后打开 `/repo/`（那样 `index.html` 在 `/repo/dist/`）
- 不是放到 `docs/` 却把 Pages 源选成 `/ (root)`

## 最简单的修复步骤

1. 解压本地的 `dist.zip`
2. 打开仓库，进入 `main` 分支根目录
3. 上传 `dist` **里面的内容**：`index.html`、`.nojekyll`、`sim/`、`audio/`
4. 提交
5. 打开仓库 **Settings → Pages**
6. Source 选 `Deploy from a branch`，分支 `main`，文件夹 `/ (root)`
7. 等 1–2 分钟，打开 `https://<用户名>.github.io/<仓库名>/`
8. 强制刷新：`Ctrl + F5`，或开无痕窗口

如果使用 `/docs` 作为 Pages 目录，就把同样的文件放进 `docs/`，并在 Pages 里选 `/docs`。

## 30 秒判断问题在哪

打开浏览器开发者工具 `F12`，看 Console / Network：

```text
https://<用户名>.github.io/<仓库名>/sim/apps3d.js
https://<用户名>.github.io/<仓库名>/sim/final.js
https://<用户名>.github.io/<仓库名>/audio/nocturnal.mp3
```

- 两个 JS 404：`sim/` 没上传，或路径层级不对
- 只有 MP3 404：`audio/` 没上传，或文件名大小写不一致
- JS 200 但 3D 仍然空：把 Console 的红色报错发我
- 全部 200，但没有音乐：背景音乐不会自动播放；点右上角 `SOUND / READY`，或先点一下页面

## 文件名大小写

GitHub Pages 是 Linux 环境，区分大小写：

```text
audio/nocturnal.mp3   ✅
Audio/Nocturnal.mp3   ❌
sim/apps3d.js         ✅
Sim/apps3d.js         ❌
```

Windows 本地能打开，不代表 GitHub Pages 能找到。

## 不要上传的东西

- 不需要上传 `out/`（截图）
- 不需要上传 `design-demos/`（方向稿）
- 不需要上传 `dist.zip` 本身
- 不需要上传 `.mp3` 以外的临时音频

只上传 `index.html`、`.nojekyll`、`sim/`、`audio/` 就够了。
