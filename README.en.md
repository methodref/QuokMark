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
- **Light and dark themes:** follow the system or choose manually.
- **Eight languages:** 简体中文, 繁體中文, English, 日本語, 한국어, Français, Deutsch, Español.

## Install

1. Download and extract this repository.
2. Open `edge://extensions` or `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the **extension** folder.
4. Pin QuokMark to the browser toolbar.

Firefox desktop uses a separate Firefox package; the current `extension/` manifest is for Chrome / Edge. The Firefox edition is not yet listed on Firefox Add-ons.

## Usage

Press **Command+E (macOS)** or **Ctrl+E (Windows)**, or click the toolbar icon. If the shortcut is occupied, change it on the browser's extension keyboard shortcuts page.

| Keys | Action |
| --- | --- |
| `hjkl` / arrows | Move focus; `h/l` collapse or expand a folder |
| `/` | Search bookmark or folder names |
| `f` → hint letters | Open the matching bookmark |
| `Enter` | Open the selected bookmark |
| `d/u` · `gg/G` | Scroll down / up half a page; jump to first / last item |
| `zc/zo` · `zM/zR` | Close / open the current folder; close / open all folders |
| `yy` | Copy the bookmark URL |
| `m` / right-click | Rename, edit URL, move, reorder or delete |
| `:` | Enter import or export commands |
| `Esc` | Exit the current mode; close the popup when not searching |
| `?` | View help and change language or theme |

Reopening the popup restores your last selection near the upper third of the list, keeping the first visible item whole where possible.

During search, Esc keeps the results; press it again to clear them. A complete hint label opens the bookmark immediately in a new tab. Edits affect native bookmarks directly—check before confirming deletion.

## Reorder items

Select a bookmark or folder, press `m` (or right-click), and choose **Reorder…**. Select a reference item and choose **Before target** or **After target**. The position preview updates before you save. Only items of the same type in the same folder are listed; bookmarks and folders are ordered separately. Use **Move to…** for moving between folders.

| Keys | Action |
| --- | --- |
| `j/k` / up and down arrows | Select a reference item |
| `h/l` / left and right arrows | Place before / after the reference |
| `d/u` | Move down / up half a page |
| `gg/G` | Select the first / last reference |
| `Enter` / `Esc` | Save / cancel |

Mouse controls are also supported. Save is disabled when the position is unchanged.

## Import and export

From navigation mode, press `:`, type a command, then press `Enter`.

| Command | Action |
| --- | --- |
| `:r` / `:read` / `:import` | Import a file into a chosen folder |
| `:w` / `:write` / `:export` | Select folders and an export format |
| `:w json` | Preselect JSON |
| `:w md` | Preselect Markdown |
| `:w html` | Preselect browser bookmark HTML |

Export aliases also accept a format, such as `:export md`. `Tab` completes commands and formats, `Shift+Tab` cycles backwards, and `Esc` returns to navigation.

**Export:** check folders in the expandable tree. You can select folders across different parents; selecting a parent includes its descendants without exporting them twice. When selected folders share a name, the necessary source parent structure is preserved. Use `j/k` to navigate, `h/l` to collapse or expand, and `Space` to toggle selection. `Enter` moves to format selection, or to confirmation if you specified a format in the command. Use `j/k` to choose a format, then `Enter` to focus the confirmation button and `Enter` again to export. Export selects folders only; all their bookmarks and subfolders are included.

**Import:** choose a file and destination. The current folder is selected by default; a selected bookmark uses its parent folder. After reading the file, focus moves to the destination control. Use `j/k` to select and `Enter` to continue to duplicate handling or confirmation. Duplicates are checked only within the destination folder: bookmarks match by URL and folders by name. Choose once to skip all duplicates or replace all duplicates. New items are appended.

Replacing a duplicate folder deletes its entire existing contents and replaces them with the imported subtree, without merging. The warning lists the bookmark and subfolder counts to be deleted. Duplicate bookmarks have their names updated; replaced folders retain their positions and use the file's internal order. Each replacement creates the new subtree before deleting the old folder. If a batch is interrupted, completed operations may remain; inspect the bookmarks before retrying.

### File formats

**JSON** uses QuokMark's own schema. Firefox-specific JSON/JSONLZ4 backups are not supported.

```json
{"format":"quokmark-bookmarks","version":1,"items":[{"title":"Work","children":[{"title":"GitHub","url":"https://github.com/"}]}]}
```

**Markdown** uses nested lists: items without links are folders, and linked items are bookmarks. Folder names may be bold. Heading-based folder structures and children under bookmarks are not supported. You can edit an exported list and import it again.

```markdown
- **Work**
  - [GitHub](<https://github.com/>)
  - **References**
    - [MDN](<https://developer.mozilla.org/>)
```

**HTML** supports the bookmark exchange format exported by Chrome, Edge and Firefox, preserving names, URLs, folder hierarchy and order. It does not transfer favicons, timestamps, tags, keywords or special browser root identities. Firefox separators are omitted from exports; the HTML import preview reports ignored separators.

## Thanks

QuokMark's UI design draws on [Maple](https://github.com/tw93/Maple). Thank you to [tw93](https://github.com/tw93) for open-sourcing the project and inspiring its simple bookmark layout and visual design.

## More

No ads or analytics. Read the [privacy policy](docs/privacy/index.html). Share feedback through Issues or contact methodref@163.com.

[MIT License](LICENSE) · [Third-party notices](extension/THIRD-PARTY-NOTICES.txt)
