import original from '../../../../../vite.config.ts';
import { mergeConfig } from 'vite';
export default async (env) => mergeConfig(await original(env), {
  plugins: [{
    name: 'mobile-verification-preserve-output',
    configResolved(config) {
      config.build.emptyOutDir = false;
      for (const environment of Object.values(config.environments)) {
        environment.build.emptyOutDir = false;
      }
    },
  }],
});



