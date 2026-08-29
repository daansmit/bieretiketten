# Building & deploying Bieretiketten

This app runs for **one user on his Windows laptop**. We build on macOS and transfer via USB stick.

## Build the Windows version (do this one)

```sh
npm install     # first time only
npm run dist:win
```

- `npm run dist:win` = `electron-vite build` + `electron-builder --win`.
- The `--win` flag is baked into the script because it's **required** when building on a
  Mac — without it, electron-builder defaults to Mac targets and you won't get a Windows build.
- Output lands in `dist/`. The file to ship is:

  ```
  dist/Bieretiketten-1.0.0-win.zip
  ```

  (This is a `zip` target, architecture **x64** — see `build.win` in `package.json`.)

## Deploy to the laptop

1. Copy `dist/Bieretiketten-1.0.0-win.zip` to a USB stick.
2. On his Windows laptop, unzip it.
3. Run `Bieretiketten.exe` from the unzipped folder.

## Notes

- **x64, not arm64.** An early build (`Bieretiketten-1.0.0-arm64-win.zip`) was ARM64;
  we switched to x64 in `package.json` because that's what his laptop needs. If you ever
  see an `arm64-win` zip, that's the wrong one.
- Bump the `version` in `package.json` before rebuilding so the filename reflects the new version.
- Building the Mac version (for local testing) is just `npm run dist` (no flag).
