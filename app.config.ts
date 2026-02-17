import { defineConfig } from '@solidjs/start/config';

export default defineConfig({
  server: {
    preset: 'node-server',
    port: 3000,
  },
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/styles/variables.scss" as *;',
        },
      },
    },
  },
});
