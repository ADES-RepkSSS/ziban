# 文档素材

- `social-preview.png`：GitHub 仓库 Social preview（1280×640），上传到 Settings → General → Social preview。
- `study.png`、`library.png`、`helper.png`、`welcome.png`、`complete.png`：README/文档用截图，来自 v0.1 实验版。
- `helper-explain.png`：完整“讲一讲”长截图，供文档引用。

这些截图和配图与项目内容一样按 **CC BY-SA 4.0** 分发，见 [content/LICENSE.md](../../content/LICENSE.md)。

重新生成：

```bash
pnpm screenshot
python tools/make_github_assets.py
```
