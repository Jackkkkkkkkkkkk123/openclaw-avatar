// 输入框组件 - 使用 Kobalte
import { TextField as KobalteTextField } from '@kobalte/core/text-field';
import { splitProps, Show } from 'solid-js';
import './TextField.css';

export interface TextFieldProps {
  label?: string;
  description?: string;
  error?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'email' | 'url';
  disabled?: boolean;
  required?: boolean;
  class?: string;
}

export function TextField(props: TextFieldProps) {
  const [local] = splitProps(props, [
    'label', 'description', 'error', 'value', 'onValueChange',
    'placeholder', 'type', 'disabled', 'required', 'class'
  ]);
  
  return (
    <KobalteTextField
      class={`ui-textfield ${local.class || ''}`}
      value={local.value}
      onChange={local.onValueChange}
      validationState={local.error ? 'invalid' : 'valid'}
      disabled={local.disabled}
      required={local.required}
    >
      <Show when={local.label}>
        <KobalteTextField.Label class="ui-textfield__label">
          {local.label}
          <Show when={local.required}>
            <span class="ui-textfield__required">*</span>
          </Show>
        </KobalteTextField.Label>
      </Show>
      
      <KobalteTextField.Input
        class="ui-textfield__input"
        type={local.type || 'text'}
        placeholder={local.placeholder}
      />
      
      <Show when={local.description && !local.error}>
        <KobalteTextField.Description class="ui-textfield__description">
          {local.description}
        </KobalteTextField.Description>
      </Show>
      
      <Show when={local.error}>
        <KobalteTextField.ErrorMessage class="ui-textfield__error">
          {local.error}
        </KobalteTextField.ErrorMessage>
      </Show>
    </KobalteTextField>
  );
}
