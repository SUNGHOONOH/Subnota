# Subnota Desktop

Subnota desktop app built with Electron, React, and Tiptap.

This app is being migrated from the m-note Electron baseline into the Subnota desktop workspace.

## Download

Subnota desktop releases must use a Subnota-owned GitHub release repo. Do not publish or auto-update from the upstream m-note release channel.

- **Windows** — download the Squirrel `.exe` setup file

Windows currently checks GitHub releases for a newer Setup EXE and opens the download link. It does not use the macOS Squirrel.Mac `RELEASES.json` native updater path.

### Windows: SmartScreen warning

The Windows installer is not code-signed yet, so Windows SmartScreen may show a warning on first launch. To proceed:

1. Click **"More info"**
2. Click **"Run anyway"**

## Development

```bash
pnpm start
```

## Scripts

### Release

```bash
pnpm run release
# or with a custom release note:
pnpm run release -- "What's new in this release"
```

Runs locally on Windows and publishes the current `package.json` version:

1. **Tests** — runs `pnpm test` unless `SKIP_TESTS=1`
2. **Build** — runs the Electron Forge Squirrel maker through `scripts/build-exe.mjs`
3. **GitHub release** — uploads the generated setup `.exe`

If a release note is passed, it becomes the GitHub release body verbatim.

### Build EXE

```bash
pnpm run build:exe
```

Builds the Windows Squirrel installer without publishing. This must run on Windows unless `FORCE_WINDOWS_MAKE=1` is explicitly set in a configured cross-build environment.

## Platform Policy

Mini Subnota and web clipping/current-page capture are intentionally not implemented inside the Windows Electron app. They are reserved for a future Chrome extension that can send `subnota://capture` links or write into a shared local queue. Extension-created `MiniSubnota` category memos remain readable in the normal memo list.
