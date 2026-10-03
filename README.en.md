<p align="right"><a href="README.md">简体中文</a> · <strong>English</strong></p>
<p align="center"><img src="extension/icons/icon-128.png" width="120" alt="QuokMark"></p>
<h1 align="center">QuokMark</h1>
<p align="center">Browse and organize bookmarks with familiar Vim shortcuts.</p>

This repository contains the directly loadable Chrome / Edge extension source. `extension/` is the complete extension directory; no dependency installation or build is needed.

## Features

- **Quick access:** navigate with `hjkl` or arrows, select with `f` hints, and open with `Enter`.
- **Name search:** find bookmarks and folders, with results grouped by folder.
- **Bookmark management:** rename, edit URLs, move, reorder and delete native browser bookmarks.
- **Import and export:** JSON, nested Markdown lists and browser bookmark HTML; export multiple folders across parents.
- **Keyboard controls:** fold folders, scroll half a page, and copy URLs.
- **Shortcut bindings:** three initial slots, with numbers and custom letters; jump to folders or open bookmarks with one key.
- **Light and dark themes:** follow the system or choose manually.
- **Eight languages:** 简体中文, 繁體中文, English, 日本語, 한국어, Français, Deutsch, Español.

## Install

1. Download and extract this repository.
2. Open `edge://extensions` or `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the **extension** folder.
4. Pin QuokMark to the browser toolbar.

- [QuokMark - Microsoft Edge Addons](https://microsoftedge.microsoft.com/addons/detail/quokmark/pcpbmidkoajgeeenfcenjlkcgnmdnlek) 

- [QuokMark FireFox](https://addons.mozilla.org/zh-CN/firefox/addon/quokmark/)



## Usage

Press **Command+E (macOS)** or **Ctrl+E (Windows)**, or click the toolbar icon. If the shortcut is occupied, change it on the browser's extension keyboard shortcuts page.

| Keys | Action |
| --- | --- |
| `hjkl` / arrows | Move focus; `h/l` collapse or expand a folder |
| `/` | Search bookmark or folder names |
| `f` → hint letters | Open the matching bookmark |
| `Enter` | Open the selected bookmark |
| `d/u` · `gg/G` | Scroll down / up half a page; jump to first / last item |
| `:c / :o` · `:ca / :oa` | Collapse / expand the current folder; collapse / expand all folders |
| `1–9` / custom letter | Jump to a bound folder or open a bound bookmark in a new tab |
| `yy` | Copy the bookmark URL |
| `m` / right-click | Rename, edit URL, move, reorder or delete |
| `:` | Enter import or export commands |
| `Esc` | Exit the current mode; close the popup when not searching |
| `?` | View help and change language or theme |

Reopening the popup restores your last selection near the upper third of the list, keeping the first visible item whole where possible.

During search, Esc keeps the results; press it again to clear them. A complete hint label opens the bookmark immediately in a new tab. Edits affect native bookmarks directly—check before confirming deletion.

## Thanks

QuokMark's UI design draws on [Maple](https://github.com/tw93/Maple). Thank you to [tw93](https://github.com/tw93) for open-sourcing the project and inspiring its simple bookmark layout and visual design.

## More

No ads or analytics. Read the [privacy policy](docs/privacy/index.html). Share feedback through Issues or contact methodref@outlook.com.

[MIT License](LICENSE) · [Third-party notices](extension/THIRD-PARTY-NOTICES.txt)
