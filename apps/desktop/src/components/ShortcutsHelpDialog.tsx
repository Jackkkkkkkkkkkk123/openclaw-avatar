/**
 * ShortcutsHelpDialog - 快捷键帮助对话框
 */

import { Component, For, createSignal, Show } from 'solid-js';
import { Dialog, Button } from './ui';
import { keyboardShortcuts, formatShortcut, type ShortcutAction } from '../lib/KeyboardShortcuts';
import './ShortcutsHelpDialog.css';

interface ShortcutsHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// 快捷键分组
const SHORTCUT_GROUPS = [
  {
    name: '界面控制',
    ids: ['toggle-chat', 'toggle-settings', 'toggle-theme', 'toggle-fullscreen', 'escape', 'help'],
  },
  {
    name: '表情切换',
    ids: ['expression-happy', 'expression-sad', 'expression-surprised', 'expression-neutral'],
  },
  {
    name: '输入与通信',
    ids: ['toggle-voice', 'focus-input', 'send-message', 'clear-chat'],
  },
  {
    name: '高级功能',
    ids: ['toggle-tracking'],
  },
];

export const ShortcutsHelpDialog: Component<ShortcutsHelpDialogProps> = (props) => {
  const [activeGroup, setActiveGroup] = createSignal(0);
  
  const getAllShortcuts = () => {
    // 获取默认快捷键定义
    return keyboardShortcuts.constructor.getDefaults?.() ?? [];
  };
  
  const getGroupShortcuts = (groupIds: string[]) => {
    const all = getAllShortcuts();
    return all.filter(s => groupIds.includes(s.id));
  };
  
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="shortcuts-dialog-overlay" />
        <Dialog.Content class="shortcuts-dialog-content">
          <Dialog.Title class="shortcuts-dialog-title">
            ⌨️ 键盘快捷键
          </Dialog.Title>
          
          <Dialog.Description class="shortcuts-dialog-description">
            使用快捷键快速操作 Avatar
          </Dialog.Description>
          
          <div class="shortcuts-container">
            {/* 分组标签 */}
            <div class="shortcuts-tabs">
              <For each={SHORTCUT_GROUPS}>
                {(group, index) => (
                  <button
                    class="shortcuts-tab"
                    classList={{ active: activeGroup() === index() }}
                    onClick={() => setActiveGroup(index())}
                  >
                    {group.name}
                  </button>
                )}
              </For>
            </div>
            
            {/* 快捷键列表 */}
            <div class="shortcuts-list">
              <For each={getGroupShortcuts(SHORTCUT_GROUPS[activeGroup()].ids)}>
                {(shortcut) => (
                  <div class="shortcut-item">
                    <div class="shortcut-info">
                      <span class="shortcut-name">{shortcut.name}</span>
                      <span class="shortcut-desc">{shortcut.description}</span>
                    </div>
                    <div class="shortcut-keys">
                      <kbd>{formatShortcut(shortcut.keys)}</kbd>
                    </div>
                  </div>
                )}
              </For>
              
              <Show when={getGroupShortcuts(SHORTCUT_GROUPS[activeGroup()].ids).length === 0}>
                <div class="shortcut-empty">暂无快捷键</div>
              </Show>
            </div>
          </div>
          
          <div class="shortcuts-footer">
            <span class="shortcuts-tip">
              💡 提示: 按 <kbd>Ctrl</kbd>+<kbd>/</kbd> 随时打开此帮助
            </span>
            <Button onClick={() => props.onOpenChange(false)}>
              关闭
            </Button>
          </div>
          
          <Dialog.CloseButton class="shortcuts-dialog-close">
            ×
          </Dialog.CloseButton>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default ShortcutsHelpDialog;
