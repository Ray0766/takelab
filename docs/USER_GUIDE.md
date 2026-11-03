# TakeLab user guide / 使用指南

## Import and organize / 导入与分组

Drag videos onto the workbench or use Import videos. Files go into the current shot unless “Group shots from filenames” is checked. `scene01_take_01.mp4`, `scene01-v02.mp4` and `scene01_seed123_model.mp4` group under `scene01`; `scene_01.mp4` keeps its full stem. A matching name, byte size and modification time is treated as a duplicate.

拖拽或多选导入默认进入当前镜头。可勾选根据文件名分组。通过左侧加号新增镜头，点击镜头标题修改名称；在版本详情底部把单个版本移动到其他镜头。空镜头可删除。移除版本不改变你的原始文件，但会删除该版本在工作区中的素材副本及记录。

## Compare and align / 比较与对齐

The current page's longest offset-adjusted take defines the timeline. A start offset of 2 seconds means review time 0 corresponds to source time 2. Shorter takes hold their final frame. Changing page, shot, grid or filter pauses playback; changing the layout/filter resets the review position. Clicking a take makes its inspector and audio controls active. All videos begin muted; only the selected take can be heard.

标记时间始终相对于源视频，和起始偏移无关。例如偏移为 2 秒，评审时间 1 秒添加的标记记录为素材时间 3 秒。调整偏移不会改变旧标记；偏移之前的标记无法在当前对比区间回看，请先减小偏移。

**Frame precision:** select a review FPS (12/24/25/30/50/60) to define the stepping interval and timecode. This is a nominal review timebase. HTML video seeking is not frame-exact, and TakeLab does not extract a source frame index. Comparison recording is real time and can lose frames under heavy decoding/encoding load. Use your editor and original sources for final mastering.

## Decide and annotate / 评选与标记

Each take starts unreviewed. Shortlist, reject and winner buttons toggle their verdict back to unreviewed when clicked again. Choosing a new winner demotes the previous winner in that shot to the shortlist. Moving a winner into a shot that already has one also demotes the moved take, preserving one winner per shot.

盲选会打乱顺序并隐藏身份信息，评选结果仍关联原来的文件。切换盲选不会清除制作记录。来源揭晓后可查看和复制提示词；盲选不能消除画面内水印或你自己写入标记的身份线索。

Press M to pause and write a marker. Choose Issue, Good moment or Note, then save. Ctrl/⌘ + Enter also saves it. Markers appear on the selected take's timeline and in its inspector. Use the timestamp to seek back or the × button to remove a marker.

## Keep the recipe / 留下制作方法

Prompt, model/source, seed, negative prompt, settings and cost are optional. Unknown costs remain blank rather than becoming zero; all recorded costs are interpreted as USD. Reference images are stored locally and included in project backups even if source-video inclusion is off. Preview a reference by clicking its thumbnail.

建议只记录能复用的关键信息：提示词、实际使用的参考图、种子、重要参数，以及这条素材为什么入选。首版不自动读取生成平台元数据，也不联网查询成本。

## Save, backup and switch / 保存、备份与切换

“Saved on this device” means the latest record was committed to IndexedDB. A save error is shown explicitly: export a backup before closing. Local data belongs to the exact browser and origin; changing from `127.0.0.1` to `localhost`, or changing port, opens a separate workspace.

The project menu can open a ZIP, load the demo or create a new project. These replace the active workspace after confirmation when it contains takes. Export first if you need to keep it. Full backup restore replaces records and blobs in one IndexedDB transaction; a failed transaction keeps the old workspace intact.

只导出记录的 ZIP 不包含视频，恢复后卡片会显示“重新关联视频”。选择原视频即可保留评选、提示词与标记；若文件名或时长不同会再次提示，超过新视频时长的标记将被移除。

## Troubleshooting / 故障处理

| Symptom                | Next step                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Unsupported codec      | Try an H.264 MP4 or VP9 WebM copy. Renaming the extension does not change the codec.           |
| Playback stalls        | Use 1/4 view, pause other video apps, or create lower-resolution proxies externally.           |
| Workspace looks empty  | Check browser/profile, hostname and port; restore a saved ZIP if site data was removed.        |
| Save failed            | Free disk space or export a backup. Never treat browser storage as your only copy.             |
| Missing source         | Relink the original from the card or inspector. Metadata-only backups intentionally need this. |
| Export canceled        | Keep the page visible. Cancellation releases recording players and restores the review grid.   |
| Archive too large      | Uncheck “Include original videos” and copy originals separately.                               |
| Record export disabled | Reveal identities first; production records contain identifying metadata.                      |

## Shortcuts / 快捷键

| Key            | Action                                   |
| -------------- | ---------------------------------------- |
| Space          | Play/pause visible takes / 播放暂停      |
| ← / →          | Step backward/forward / 前后步进         |
| 1–9            | Select a visible take / 选择当前页版本   |
| S              | Toggle shortlist / 入围                  |
| X              | Toggle rejection / 淘汰                  |
| W              | Toggle the shot's winner / 最终选定      |
| M              | Pause and focus marker editor / 添加标记 |
| Ctrl/⌘ + Enter | Save marker / 保存标记                   |

Global shortcuts are inactive while typing into a field, while a dialog is open, or during an import/export operation.
