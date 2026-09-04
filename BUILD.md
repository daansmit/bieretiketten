# Building & deploying Bieretiketten

This app runs for **one user on his Windows laptop**. We build on macOS. The first
install goes over via USB stick; after that, updates arrive through the in-app
"check for updates" button (see [Releasing an update](#releasing-an-update)).

## Build the Windows installer

```sh
npm install     # first time only
npm run dist:win
```

- `npm run dist:win` = `electron-vite build` + `electron-builder --win`.
- The `--win` flag is baked into the script because it's **required** when building on a
  Mac — without it, electron-builder defaults to Mac targets and you won't get a Windows build.
- Output lands in `dist/`. The file to ship is the installer:

  ```
  dist/Bieretiketten Setup <version>.exe
  ```

  (NSIS installer, architecture **x64** — see `build.win` / `build.nsis` in `package.json`.
  It's a one-click installer: double-clicking installs to the user's AppData and creates
  desktop + start-menu shortcuts. No unzipping.)

> **Heads up (Mac terminal):** if you build from a Claude Code / VS Code terminal you may
> hit `Cannot read properties of undefined (reading 'isPackaged')` or a silent failure —
> the environment sets `ELECTRON_RUN_AS_NODE=1`, which breaks Electron. Prefix commands
> with `unset ELECTRON_RUN_AS_NODE`.

## First install on the laptop (USB)

1. Copy `dist/Bieretiketten Setup <version>.exe` to a USB stick.
2. On his Windows laptop, double-click it. It installs and launches automatically.

## Releasing an update (in-app auto-update)

The app uses `electron-updater`, which checks the **GitHub Releases** of
`daansmit/bieretiketten`. For the in-app button to detect an update, the release must
contain the installer **and** the `latest.yml` metadata file — `electron-builder --publish`
uploads both. Do **not** create the release by hand in the GitHub UI (it would omit
`latest.yml`).

1. **Bump `version`** in `package.json` (e.g. `1.0.2` → `1.0.3`). The updater only offers
   an update when the release version is *higher* than what's installed.
2. **Commit and push `main`** *before* publishing. This matters: GitHub creates the
   `vX.Y.Z` git tag at the moment the draft is published, pointing at the tip of `main`
   on the remote. If you haven't pushed yet, the tag lands on the *previous* commit and
   you'll have to force-move it. So: `git commit … && git push origin main`.
3. **Build + publish** in one command:

   ```sh
   GH_TOKEN=<token> npm run build && npx electron-builder --win --publish always
   ```

   This creates a **draft** GitHub release for the version with `Bieretiketten Setup
   <version>.exe`, `latest.yml`, and the blockmap attached.
4. **Publish the draft** — in the GitHub Releases UI, or `gh release edit vX.Y.Z --draft=false`.
   Because `main` is already pushed, the tag lands on the right commit. Once public, the
   laptop's "check for updates" button will find it, download, and install.

### GitHub token

`GH_TOKEN` can be a fine-grained personal access token scoped to **only** the
`bieretiketten` repo with:

- **Contents: Read and write** (GitHub files Releases under Contents)
- **Metadata: Read-only** (auto-selected)

Nothing else is needed. Keep the token out of git (use a gitignored `.env` or your shell
profile). Alternatively `GH_TOKEN=$(gh auth token)` reuses the `gh` CLI login.

## Notes

- **x64, not arm64.** An early build was ARM64; we use x64 because that's what his laptop
  needs. If you ever see an `arm64-win` artifact, that's the wrong one.
- Building the Mac version (for local testing) is just `npm run dist` (no flag).
