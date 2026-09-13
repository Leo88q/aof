import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { TokenDemo } from './TokenDemo';
const meta = {
  title: 'AOF/Foundation/TokenDemo', component: TokenDemo, tags: ['autodocs'],
  argTypes: {
    material: { control: 'inline-radio', options: ['parchment', 'oak'] },
  },
} satisfies Meta<typeof TokenDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Parchment: Story = {
  args: {
    material: 'parchment',
    title: 'Записи мастерской',
    description: 'Пергаментная карточка: русский заголовок, чернильный текст и медное крепление.',
  },
};
export const Oak: Story = {
  args: {
    material: 'oak',
    title: 'Урожай этого сезона',
    description: 'Дубовая табличка: тёплая фактура, читаемая надпись и сдержанная медная фурнитура.',
  },
};
export const Keyboard: Story = {
  args: { ...Parchment.args },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Проверено мастером' });
    button.focus();
    await expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard(' ');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  },
};
