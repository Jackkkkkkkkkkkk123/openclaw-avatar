// Switch 组件 - 使用 Kobalte
import { Switch as KobalteSwitch } from '@kobalte/core/switch';
import { splitProps, Show } from 'solid-js';
import './Switch.css';

export interface SwitchProps {
  label?: string;
  description?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  class?: string;
}

export function Switch(props: SwitchProps) {
  const [local] = splitProps(props, [
    'label', 'description', 'checked', 'onCheckedChange', 'disabled', 'class'
  ]);
  
  return (
    <KobalteSwitch
      class={`ui-switch ${local.class || ''}`}
      checked={local.checked}
      onChange={local.onCheckedChange}
      disabled={local.disabled}
    >
      <div class="ui-switch__main">
        <Show when={local.label}>
          <div class="ui-switch__text">
            <KobalteSwitch.Label class="ui-switch__label">
              {local.label}
            </KobalteSwitch.Label>
            <Show when={local.description}>
              <KobalteSwitch.Description class="ui-switch__description">
                {local.description}
              </KobalteSwitch.Description>
            </Show>
          </div>
        </Show>
        
        <KobalteSwitch.Input class="ui-switch__input" />
        <KobalteSwitch.Control class="ui-switch__control">
          <KobalteSwitch.Thumb class="ui-switch__thumb" />
        </KobalteSwitch.Control>
      </div>
    </KobalteSwitch>
  );
}
