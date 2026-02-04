// Dialog 组件 - 使用 Kobalte
import { Dialog as KobalteDialog } from '@kobalte/core/dialog';
import { JSX, splitProps, Show } from 'solid-js';
import './Dialog.css';

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  children?: JSX.Element;
  footer?: JSX.Element;
  size?: 'sm' | 'md' | 'lg';
}

export function Dialog(props: DialogProps) {
  const [local] = splitProps(props, [
    'open', 'onOpenChange', 'title', 'description', 'children', 'footer', 'size'
  ]);
  
  return (
    <KobalteDialog open={local.open} onOpenChange={local.onOpenChange}>
      <KobalteDialog.Portal>
        <KobalteDialog.Overlay class="ui-dialog__overlay" />
        <KobalteDialog.Content 
          class={`ui-dialog__content ui-dialog__content--${local.size || 'md'}`}
        >
          <Show when={local.title}>
            <KobalteDialog.Title class="ui-dialog__title">
              {local.title}
            </KobalteDialog.Title>
          </Show>
          
          <Show when={local.description}>
            <KobalteDialog.Description class="ui-dialog__description">
              {local.description}
            </KobalteDialog.Description>
          </Show>
          
          <div class="ui-dialog__body">
            {local.children}
          </div>
          
          <Show when={local.footer}>
            <div class="ui-dialog__footer">
              {local.footer}
            </div>
          </Show>
          
          <KobalteDialog.CloseButton class="ui-dialog__close">
            ✕
          </KobalteDialog.CloseButton>
        </KobalteDialog.Content>
      </KobalteDialog.Portal>
    </KobalteDialog>
  );
}

// 简便用法的 Trigger
export const DialogTrigger = KobalteDialog.Trigger;
