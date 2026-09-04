import { defineConfig } from 'vite';

const nativePageCaptureEnabled =
  process.env.SUBNOTA_MAS_BUILD !== '1' ||
  process.env.SUBNOTA_MAS_BROWSER_CAPTURE !== '0';

// https://vitejs.dev/config
export default defineConfig({
  define: {
    __SUBNOTA_NATIVE_PAGE_CAPTURE_ENABLED__: JSON.stringify(
      nativePageCaptureEnabled,
    ),
  },
});
