# Third-party notices

TakeLab's own code and original procedural demo artwork use the repository's MIT license. Imported user media is not relicensed by the application.

Runtime libraries:

| Package                        | License | Project                                                              |
| ------------------------------ | ------- | -------------------------------------------------------------------- |
| React / React DOM / scheduler  | MIT     | [React](https://github.com/facebook/react)                           |
| lucide-react                   | ISC     | [Lucide](https://github.com/lucide-icons/lucide)                     |
| fflate                         | MIT     | [fflate](https://github.com/101arrowz/fflate)                        |
| @fix-webm-duration/fix, parser | MIT     | [fix-webm-duration](https://github.com/yusitnikov/fix-webm-duration) |
| tslib                          | 0BSD    | [tslib](https://github.com/microsoft/tslib)                          |

Exact dependency versions are locked in `package-lock.json`. `public/THIRD_PARTY_LICENSES.txt` includes the runtime license texts for static distributions and is regenerated before each build. The WebM duration packages omit license files in their npm tarballs; their upstream MIT license is preserved in `scripts/licenses/fix-webm-duration.txt` (upstream blob `755aa25107512b5889967746d75788e9ee2f0164`). Other texts are copied from the installed packages. Build/test tools retain their respective licenses. FFmpeg, Pillow and NumPy are only needed to regenerate demo assets and are not distributed inside the app.

All bundled `public/demo/orbit-*.mp4` clips are original algorithmic artwork made by `scripts/generate_demo.py`. Their model labels are fictional. No stock footage, generative-service output, external fonts or external photos are bundled.
