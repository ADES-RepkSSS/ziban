# 文档素材

- `social-preview.png`：GitHub 仓库 Social preview（1280×640），上传到 Settings → General → Social preview。
- `home.png`：桌面版首页（看屏幕是第一个大入口，下面配图列出工具）。
- `../../apps/web/public/features/*.svg`：首页工具特征图，项目自绘，随内容按 CC BY-SA 4.0 分发。
- `study.png`、`library.png`、`helper.png`、`welcome.png`、`complete.png`：README/文档用截图，来自 v0.1 实验版。
- `helper-explain.png`：完整“讲一讲”长截图，供文档引用。
- `desktop-lookup.png`：桌面版光标取词小窗（800×1034，来自 `desktop:ui-smoke`）。

这些截图和配图与项目内容一样按 **CC BY-SA 4.0** 分发，见 [content/LICENSE.md](../../content/LICENSE.md)。

重新生成：

```bash
pnpm screenshot
python tools/make_github_assets.py
```
