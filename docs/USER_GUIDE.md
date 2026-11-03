# TakeLab user guide / 使用指南

## Import and organize / 导入与分组

Drag videos onto the workbench or use Import videos. Files go into the current shot unless “Group shots from filenames” is checked. `scene01_take_01.mp4`, `scene01-v02.mp4` and `scene01_seed123_model.mp4` group under `scene01`; `scene_01.mp4` keeps its full stem. A matching name, byte size and modification time is treated as a duplicate.

拖拽或多选导入默认进入当前镜头。可勾选根据文件名分组。通过顶部镜头目录旁的加号新增镜头，点击镜头标题修改名称；在版本详情底部把单个版本移动到其他镜头。空镜头可删除。移除版本不改变你的原始文件，但会删除该版本在工作区中的素材副本及记录。

## Compare and align / 比较与对齐

The current page's longest offset-adjusted take defines the timeline. A start offset of 2 seconds means review time 0 corresponds to source time 2. Shorter takes hold their final frame. Changing page, shot, grid or filter pauses playback; changing the layout/filter resets the review position. Clicking a take makes its inspector and audio controls active. All videos begin muted; only the selected take can be heard.

Records start closed. Use **Details** to open or hide the record panel without restarting the players. The **Selected / Review decision** shortcut reveals the winner and its decision at the current review time, scrolling the source into view when needed. Selecting a preview leaves a hidden panel closed; its letter button opens the inspector. **Add marker** or **M** opens the panel and focuses the note. In short desktop windows, scroll the preview area or switch to 1/4 view rather than squeezing all nine videos into tiny strips.

记录默认收起。点击 **详情** 可展开或收起，播放实例会保留。点击 **已选版本 / 查看选片依据** 可在当前评审时刻定位选定素材与依据，并将视频滚动到可见位置。收起后点画面只切换当前版本；点画面下方字母可打开详情。**添加标记** 或 **M** 会展开面板并定位到输入框。窗口较矮时可滚动对比区，或切换单屏／四宫格。

标记时间始终相对于源视频，和起始偏移无关。例如偏移为 2 秒，评审时间 1 秒添加的标记记录为素材时间 3 秒。调整偏移不会改变旧标记；偏移之前的标记无法在当前对比区间回看，请先减小偏移。

**Overview precision:** select a review FPS (12/24/25/30/50/60) to define the nominal stepping interval and timecode. HTML video seeking and comparison recording are not frame locked. Use **Inspect frames** for actual source-frame navigation, and your editor and original sources for final mastering.

### Inspect source frames / 检查源帧

Select a take and open **Inspect frames**. Choose a second take or choose **Single source** in Source B. Both views wait for decoding before accepting a screenshot; rapid seeks discard obsolete results. The arrows step the active source's actual frame sequence. The partner shows its last frame at or before the offset-adjusted review time. At different frame rates, different PTS values are expected. Clicking a picture sets the center for linked 100/200/400% zoom. Inspection is silent; the paused overview remains underneath.

**Align action:** find the same event independently in A and B, set both anchors, name the event and apply. Review time zero now corresponds to those two original moments. This changes start offsets, not playback speed or the motion itself. **Undo alignment** restores the previous offsets during the current inspection session. Editing a numerical offset later clears its inconsistent anchor; screenshots retain their original source times. Matching an action is your judgment, not an automatic model result.

**Save frame evidence:** choose the source, write an observation and save. The PNG always contains the complete decoded display-oriented frame, even while zoomed. It is stored atomically with its marker, source PTS, track, frame sequence index, source SHA-256 and PNG SHA-256. A current winner's decision automatically receives the new reference; without a winner, link the marker later in **Decision**. **Decision & record** returns to the rationale and generation records. The marker thumbnail opens the verified PNG; **Inspect original frame** reopens its actual source time, including times before the current review offset.

选择版本后打开 **检查源帧**。用 **对齐动作** 分别设置同一事件的两个锚点；使用方向键查看真实源帧，放大后填写观察并 **保存源帧证据**。截图始终保存完整画面。已有选定成片时，新证据自动关联到本镜头的依据；否则可稍后在 **选片依据** 勾选。**选片依据与记录** 返回理由和提示词。早于当前偏移的截图标记也可直接回看原帧。

The first implementation supports SDR and browser-decodable MP4/WebM/Matroska, at most two sources of 2 GiB / 60,000 video packets / 4096×2160 pixels each (portrait supported). Unusual nonzero starting timelines, duplicate PTS, unsupported codecs and HDR are rejected explicitly. Use **Inspect A only** if the partner is missing or unsupported, or return to native overview playback. No file conversion or paid API is involved. Large-file hashing and decoder initialization may take time; closing inspection terminates its workers. Individual commands time out after 60 seconds for opening / 15 seconds for a frame.

## Decide and annotate / 评选与标记

Each take starts unreviewed. Shortlist, reject and winner buttons toggle their verdict back to unreviewed when clicked again. Choosing a new winner demotes the previous winner in that shot to the shortlist. Moving a winner into a shot that already has one also demotes the moved take, preserving one winner per shot.

盲选会打乱顺序并隐藏身份信息，评选结果仍关联原来的文件。切换盲选不会清除制作记录。来源揭晓后可查看和复制提示词；盲选不能消除画面内水印或你自己写入标记的身份线索。

Press M to pause and write a marker. Choose Issue, Good moment or Note, then save. Ctrl/⌘ + Enter also saves it. Markers appear on the selected take's timeline and in its inspector. Use the timestamp to seek back or the × button to remove a marker.

Open **Decision** after choosing a winner. Write why it was chosen and check supporting moments from any candidate in the shot, including rejected takes. A timestamp reveals that candidate even if filtered out and seeks to its source-relative observation. **Open winner record** returns to the chosen take's recipe. Reports and ZIPs retain the winner, reason, evidence IDs and generation records together. Replacing the winner clears the old reason; removing/moving evidence unlinks it. The record is editable and is not an immutable approval history.

选定后打开 **选片依据**，填写理由并勾选支持它的时间点。可以引用淘汰版本的穿帮，或成片的亮点；缺少理由或证据会显示“依据尚未完整”。盲选期间隐藏这份文字记录，避免先前写入的来源信息影响判断。淘汰只改变状态标签，不会调暗素材画面。

## Keep the recipe / 留下制作方法

Prompt, model/source, seed, negative prompt, settings and cost are optional. Unknown costs remain blank rather than becoming zero; all recorded costs are interpreted as USD. Reference images are stored locally and included in project backups even if source-video inclusion is off. Preview a reference by clicking its thumbnail.

建议只记录能复用的关键信息：提示词、实际使用的参考图、种子、重要参数，以及这条素材为什么入选。首版不自动读取生成平台元数据，也不联网查询成本。

## Save, backup and switch / 保存、备份与切换

“Saved on this device” means the latest record was committed to IndexedDB. A save error is shown explicitly: export a backup before closing. Local data belongs to the exact browser and origin; changing from `127.0.0.1` to `localhost`, or changing port, opens a separate workspace.

The project menu can open a ZIP, load the demo or create a new project. These replace the active workspace after confirmation when it contains takes. Export first if you need to keep it. Full backup restore replaces records and blobs in one IndexedDB transaction; a failed transaction keeps the old workspace intact.

只导出记录的 ZIP 不包含视频，但始终包含参考图和证据截图；恢复后仍能看截图，检查相邻原帧则需重新关联视频。名称、大小、时长或分辨率不符会拒绝关联。已有源帧证据或动作锚点的素材还会检查 SHA-256；从未创建过这两类记录的旧素材仍只有元数据检查。不同素材应作为新版本导入。旧版 TakeLab 能打开 schema-1 文件，但重新导出可能丢弃新增证据字段，请使用当前版本恢复。

Standalone Markdown exports include relative PNG links; share the extracted ZIP folder to keep those links usable. Source and image hashes detect changed bytes against the saved record, not a maliciously rewritten record or a cryptographic proof of authorship. Back up originals as well as the ZIP.

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
