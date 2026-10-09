<p align="right"><strong>简体中文</strong> · <a href="README.en.md">English</a></p>
<p align="center"><img src="extension/icons/icon-128.png" width="120" alt="QuokMark"></p>
<h1 align="center">QuokMark</h1>
<p align="center">用熟悉的 Vim 快捷键，轻松访问和整理书签。</p>

本仓库公开可直接加载的 Chrome / Edge 扩展源码。`extension/` 是完整的插件目录，无需安装依赖或构建。

## 功能

- **快速访问**：`hjkl` 或方向键移动，`f` 字母选择，`Enter` 打开书签。
- **书签搜索**：按标题、域名和网址路径联合搜索，精确命中优先，结果不足时补充英文拼写容错；保留目录分组，按每组最佳命中排序。
- **书签管理**：重命名、修改链接、移动、排序与删除，直接使用浏览器原生书签。
- **导入与导出**：支持 JSON、Markdown 嵌套列表及浏览器书签 HTML，跨目录多选导出。
- **键盘操作**：目录折叠、半页滚动、复制网址，无需频繁切换鼠标。
- **快捷绑定**：默认三个键位，支持数字与自定义字母；目录单键跳转，书签单键打开。
- **日间与夜间**：自动跟随系统，也可以手动切换。
- **八种语言**：简体中文、繁體中文、English、日本語、한국어、Français、Deutsch、Español。

## 安装

QuokMark 已上架，可直接从扩展市场安装：

- **Microsoft Edge**：[QuokMark - Microsoft Edge Addons](https://microsoftedge.microsoft.com/addons/detail/quokmark/pcpbmidkoajgeeenfcenjlkcgnmdnlek)
- **Firefox**：[QuokMark - Firefox Add-ons](https://addons.mozilla.org/zh-CN/firefox/addon/quokmark/)

Chrome / Edge 本地安装（开发者模式）：

1. 下载本仓库并解压。
2. 打开 `edge://extensions` 或 `chrome://extensions`，开启「开发者模式」。
3. 点击「加载解压缩的扩展」，选择 **extension** 文件夹。
4. 将 QuokMark 固定到浏览器工具栏。

Firefox 本地测试使用单独的 Firefox 安装包，当前 `extension/` 清单仅用于 Chrome / Edge。

## 使用

按 **Command+E（macOS）** 或 **Ctrl+E（Windows）** 打开弹窗，也可以点击工具栏图标。若快捷键冲突，可在浏览器扩展的「键盘快捷键」页面修改。

| 按键 | 操作 |
| --- | --- |
| `hjkl` / 方向键 | 移动焦点；`h/l` 折叠或展开目录 |
| `/` | 搜索书签标题、域名或路径；目录按名称匹配 |
| `f` → 提示字母 | 打开对应书签 |
| `Enter` | 打开选中的书签 |
| `d/u` · `gg/G` | 下 / 上翻半页；跳到首项 / 末项 |
| `:c / :o` · `:ca / :oa` | 折叠 / 展开当前目录；折叠 / 展开所有目录 |
| `1–9` / 自定义字母 | 跳转绑定目录或直接在新标签页打开绑定书签 |
| `yy` | 复制书签网址 |
| `m` / 右键 | 重命名、修改链接、移动、调整顺序、删除 |
| `:` | 输入导入或导出命令 |
| `Esc` | 退出当前状态；非搜索时关闭主弹窗 |
| `?` | 查看帮助，切换语言和主题 |

重新打开弹窗会恢复上次选择，并将其定位在顶部约 1/3 处，尽量保留完整的顶部条目。

搜索时按一次 `Esc` 保留结果，再按一次清空搜索。输入完整字母标签会立即在新标签页打开书签。管理操作直接修改原生书签，删除前请确认。

顶部搜索和快捷绑定页共用本地 MiniSearch BM25+，标题、域名、路径权重为 5、3、1。多个关键词必须全部命中，可以分布在不同字段；最后一个英文词支持前缀匹配。精确与前缀结果不足 5 个时，最多补充 10 个近似结果，每个书签最多纠正一个长度至少 4 的英文查询词，允许一次插入、删除或替换。中文按连续文字匹配，完整 URL 优先精确匹配且不进行拼写纠正。

目录继续按名称包含匹配：顶部命中目录保留完整子树，快捷绑定页只列出该可绑定条目。分组按最佳命中排序，组内按相关性排序。书签变更会刷新内存索引；搜索内容不记录、不上传。

## 致谢

QuokMark 的 UI 设计参考了 [Maple](https://github.com/tw93/Maple)。感谢 [tw93](https://github.com/tw93) 开源这一项目，带来简洁的书签布局与设计灵感。

## 更多

无广告、无统计跟踪。查看 [隐私政策](docs/privacy/index.html)。欢迎通过 Issues 反馈问题，或联系 methodref@outlook.com。

[MIT License](LICENSE) · [第三方许可](extension/THIRD-PARTY-NOTICES.txt)
