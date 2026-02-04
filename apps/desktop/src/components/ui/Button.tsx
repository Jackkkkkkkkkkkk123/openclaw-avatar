// 按钮组件 - 使用 Kobalte
import { Button as KobalteButton } from '@kobalte/core/button';
import { JSX, splitProps } from 'solid-js';
import './Button.css';

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  fullWidth?: boolean;
}

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ['variant', 'size', 'active', 'fullWidth', 'class', 'children']);
  
  const classes = () => [
    'ui-button',
    `ui-button--${local.variant || 'default'}`,
    `ui-button--${local.size || 'md'}`,
    local.active && 'ui-button--active',
    local.fullWidth && 'ui-button--full',
    local.class,
  ].filter(Boolean).join(' ');
  
  return (
    <KobalteButton class={classes()} {...rest}>
      {local.children}
    </KobalteButton>
  );
}
