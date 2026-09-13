import type { Preview } from '@storybook/react';
import '../src/ui/fonts';
import '../src/ui/tokens.css';
import '../src/ui/base.css';
import '../src/ui/demos/Foundation.css';
import '../src/ui/demos/TokenDemo.css';
import '../src/ui/reduced-motion.css';
const preview: Preview = {
  decorators: [
    (Story) => (
      <div className="aof-ui aof-story-stage" lang="ru"><Story /></div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },
    controls: { expanded: true },
    viewport: {
      viewports: {
        compact:  { name: 'Compact · 320px',  styles: { width: '320px',  height: '740px'  } },
        tablet:   { name: 'Tablet · 768px',   styles: { width: '768px',  height: '1024px' } },
        desktop:  { name: 'Desktop · 1440px', styles: { width: '1440px', height: '900px'  } },
      },
    },
  },
};
export default preview;
