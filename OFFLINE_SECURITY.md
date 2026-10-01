# Loomwright offline and import safety

## What the import check does

Before reading TXT, DOCX, or PDF files, Loomwright performs small checks inside your browser on this device. It limits file size; checks the expected file type/signature; screens Word archives for macro/embedded/ActiveX parts, unsafe paths, excessive parts, and unusually large compressed content; and gives a warning when a PDF includes markers commonly associated with active PDF features. Macro-enabled or embedded-object Word files are stopped. PDF import extracts text only, disables scripting and WebAssembly, and does not import links, forms, or attachments.

All Word-produced, pasted, previously saved, and exported chapter markup is cleaned by a small allow-list before it is displayed or saved. Normal headings, paragraphs, emphasis, lists, and safe basic text formatting remain. Scripts, inline event instructions, images, links, forms, embedded pages, active SVG, and unsafe style values are removed. PDF and Word readers and their worker run from files inside this repository. A page policy blocks scripts, fonts, images, network connections, and workers from outside Loomwright (uploaded cover art is stored as a local data image).

## Important limit: this is not antivirus

These checks catch some unsafe or malformed file structures; they **cannot reliably detect every virus or exploit**. They do not compare files to a frequently updated malware database, and no browser-only checker should promise to. The app never sends imported writing to an online malware scanning service. Keep your device’s existing security updates enabled and, for a file you do not trust, scan it with your computer’s built-in security program before opening it in any app.

## Preparing offline use

Loomwright is an installable web app. It needs to be opened once from a secure website address while connected. Choose **Settings → Prepare offline** to save the app, fonts, import tools, icons, and PDF text resources in the browser cache. The button reports how many app files were saved. After that, use the same installed app or website address while offline. Manuscripts remain in the browser’s local project storage; installing the app does not upload them.

A published app needs a stable HTTPS website address for browser installation. Opening `index.html` as a bare file does not allow secure offline installation. The cache version is in `sw.js`; update that version and rebuild `offline-assets.json` when changing runtime assets.

## Shared browser projects

The local development server exposes a same-origin sync API on ports 8000 and 8001. It stores a revisioned project snapshot in the git-ignored `.loomwright-data` folder and keeps browser-local storage as a recovery copy. Both browser sessions must use one of those ports while connected to the same running Codespace. The server does not send manuscripts to a third-party cloud service. Keep the forwarded Codespace port private; anyone with access to the app can access its project store. A previous store snapshot is retained as `.loomwright-data/projects.json.bak`.

If the sync server is unavailable, Loomwright continues using that browser's local copy and shows a local-only status. Reconnect through either supported port to sync. Do not delete `.loomwright-data` if you need the shared server copy. For a backup outside the Codespace, export your writing from Finalise.

## Local libraries

| Component | Version bundled | Purpose | Licence notice |
|---|---:|---|---|
| Mammoth | 1.13.0 | Read Word `.docx` locally | `vendor/licenses/Mammoth-BSD-2-Clause.txt` |
| PDF.js | 6.3.289 | Extract PDF text locally | `vendor/licenses/PDFjs-Apache-2.0.txt` |
| DOMPurify | 3.4.16 | Clean editor HTML with an allow-list | Apache-2.0 and MPL-2.0 notices in `vendor/licenses/` |
| fflate | 0.8.3 | Inspect DOCX ZIP metadata without a server | `vendor/licenses/fflate-MIT.txt` |

No online malware service, AI API, analytics, or automatic upload is part of the import path.
