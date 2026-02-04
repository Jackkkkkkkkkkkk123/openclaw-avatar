// Tabs 组件 - 使用 Kobalte
import { Tabs as KobalteTabs } from '@kobalte/core/tabs';
import { JSX, splitProps, For } from 'solid-js';
import './Tabs.css';

export interface TabItem {
  value: string;
  label: string;
  icon?: string;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  onValueChange?: (value: string) => void;
  children?: JSX.Element;
  class?: string;
}

export function Tabs(props: TabsProps) {
  const [local] = splitProps(props, ['items', 'value', 'onValueChange', 'children', 'class']);
  
  return (
    <KobalteTabs
      class={`ui-tabs ${local.class || ''}`}
      value={local.value}
      onChange={local.onValueChange}
    >
      <KobalteTabs.List class="ui-tabs__list">
        <For each={local.items}>
          {(item) => (
            <KobalteTabs.Trigger value={item.value} class="ui-tabs__trigger">
              {item.icon && <span class="ui-tabs__icon">{item.icon}</span>}
              <span>{item.label}</span>
            </KobalteTabs.Trigger>
          )}
        </For>
        <KobalteTabs.Indicator class="ui-tabs__indicator" />
      </KobalteTabs.List>
      
      {local.children}
    </KobalteTabs>
  );
}

// 导出 Content 组件
export const TabContent = KobalteTabs.Content;
