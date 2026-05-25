# MemoApp Landing

Next.js landing page for MemoApp.

## Local Development

```sh
corepack pnpm install
corepack pnpm dev
```

Open `http://localhost:3000`.

## Vercel

Set the Vercel project root directory to `web`.

- Install command: `corepack pnpm install`
- Build command: `corepack pnpm build`
- Output directory: Next.js default

Configure platform download links in Vercel:

```text
NEXT_PUBLIC_MACOS_DOWNLOAD_URL=
NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL=
NEXT_PUBLIC_IOS_DOWNLOAD_URL=
```

Use the official App Store and Microsoft Store badge assets if you replace the custom buttons with store badges.
