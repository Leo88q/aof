import type { StorybookConfig } from '@storybook/react-vite';
const config: StorybookConfig = {
  framework: { name: '@storybook/react-vite', options: {} },
  stories: ['../src/ui/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
  ],
  staticDirs: ['../public'],
  docs: { autodocs: 'tag' },
  core: { disableTelemetry: true },
};
export default config;
