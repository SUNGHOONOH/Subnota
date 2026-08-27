# Subnota Landing

Next.js landing page for Subnota.

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
NEXT_PUBLIC_DOWNLOAD_MAC_URL=
NEXT_PUBLIC_DOWNLOAD_WIN_URL=
```

The iOS app is not yet available, so it does not need a download URL.
