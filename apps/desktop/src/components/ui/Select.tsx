// Select 组件 - 使用 Kobalte
import { Select as KobalteSelect } from '@kobalte/core/select';
import { Show, splitProps } from 'solid-js';
import './Select.css';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps<T = string> {
  label?: string;
  placeholder?: string;
  options: SelectOption<T>[];
  value?: T;
  onValueChange?: (value: T) => void;
  disabled?: boolean;
  class?: string;
}

export function Select<T extends string = string>(props: SelectProps<T>) {
  const [local] = splitProps(props, [
    'label', 'placeholder', 'options', 'value', 'onValueChange', 'disabled', 'class'
  ]);
  
  return (
    <KobalteSelect<SelectOption<T>>
      class={`ui-select ${local.class || ''}`}
      options={local.options}
      optionValue="value"
      optionTextValue="label"
      optionDisabled="disabled"
      value={local.options.find(o => o.value === local.value)}
      onChange={(opt) => opt && local.onValueChange?.(opt.value)}
      placeholder={local.placeholder || '请选择...'}
      disabled={local.disabled}
      itemComponent={props => (
        <KobalteSelect.Item item={props.item} class="ui-select__item">
          <KobalteSelect.ItemLabel class="ui-select__item-label">
            {props.item.rawValue.label}
          </KobalteSelect.ItemLabel>
          <Show when={props.item.rawValue.description}>
            <span class="ui-select__item-desc">{props.item.rawValue.description}</span>
          </Show>
          <KobalteSelect.ItemIndicator class="ui-select__item-indicator">
            ✓
          </KobalteSelect.ItemIndicator>
        </KobalteSelect.Item>
      )}
    >
      <Show when={local.label}>
        <KobalteSelect.Label class="ui-select__label">{local.label}</KobalteSelect.Label>
      </Show>
      
      <KobalteSelect.Trigger class="ui-select__trigger">
        <KobalteSelect.Value<SelectOption<T>> class="ui-select__value">
          {state => state.selectedOption()?.label || local.placeholder}
        </KobalteSelect.Value>
        <KobalteSelect.Icon class="ui-select__icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </KobalteSelect.Icon>
      </KobalteSelect.Trigger>
      
      <KobalteSelect.Portal>
        <KobalteSelect.Content class="ui-select__content">
          <KobalteSelect.Listbox class="ui-select__listbox" />
        </KobalteSelect.Content>
      </KobalteSelect.Portal>
    </KobalteSelect>
  );
}
