import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../WindbreakTemplate.stories.tsx'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  // The template builds on @island.is/map (file: dep, a sibling folder):
  // resolve it through the lib's own sources so Storybook/Vite pick up TSX
  // changes without a rebuild.
  viteFinal: (viteConfig) => {
    const resolve = viteConfig.resolve ?? {};
    resolve.alias = {
      ...(resolve.alias as Record<string, string> | undefined),
      '@island.is/map': require.resolve('../../../../map/src/index.ts'),
    };
    return viteConfig;
  },
};

export default config;
