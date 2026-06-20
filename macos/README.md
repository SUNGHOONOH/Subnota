# Subnota macOS

Subnota macOS Electron app built with Electron, React, and Tiptap.

This app is being migrated from the m-note Electron baseline into a separate macOS desktop workspace.

## Download

Subnota desktop releases must use a Subnota-owned GitHub release repo. Do not publish or auto-update from the upstream m-note release channel.

- **macOS install** — download the `.dmg` file
- **macOS native updates** — publish the generated `.zip` and `RELEASES.json` assets from the same release

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

Runs locally and publishes the current `package.json` version:

1. **Tests** — runs `pnpm test` unless `SKIP_TESTS=1`
2. **Build** — runs Electron Forge makers for DMG plus Squirrel.Mac ZIP/`RELEASES.json`
3. **Tag** — creates and pushes `vX.Y.Z`
4. **GitHub release** — uploads the DMG, ZIP, and `RELEASES.json`

If a release note is passed, it becomes the GitHub release body verbatim.

### Build DMG (local only)

```bash
pnpm run build:dmg
```

Builds the DMG without bumping the version or publishing. Useful for local testing.
