// 设置对话框组件
import { createSignal, Show } from 'solid-js';
import { Dialog, TextField, Select, Switch, Button, Tabs, TabContent } from './ui';
import { config, updateConfig, AVAILABLE_MODELS } from '../stores/configStore';
import { setTheme, type ThemeMode } from '../stores/themeStore';
import './SettingsDialog.css';

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  onConnect: () => void;
  onDisconnect: () => void;
  onModelChange?: (path: string, name: string) => void;
}

export function SettingsDialog(props: SettingsDialogProps) {
  const [activeTab, setActiveTab] = createSignal('connection');
  
  // 本地状态（编辑中）
  const [gatewayUrl, setGatewayUrl] = createSignal(config().gatewayUrl);
  const [fishApiKey, setFishApiKey] = createSignal(config().fishApiKey);
  
  // 保存连接设置
  function saveConnectionSettings() {
    updateConfig({
      gatewayUrl: gatewayUrl(),
      fishApiKey: fishApiKey(),
    });
  }
  
  // 主题选项
  const themeOptions = [
    { value: 'dark' as ThemeMode, label: '🌙 深色模式' },
    { value: 'light' as ThemeMode, label: '☀️ 浅色模式' },
    { value: 'system' as ThemeMode, label: '💻 跟随系统' },
  ];
  
  // 模型选项
  const modelOptions = AVAILABLE_MODELS.map(m => ({
    value: m.path,
    label: m.name,
    description: m.description,
  }));
  
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="⚙️ 设置"
      size="md"
    >
      <Tabs
        items={[
          { value: 'connection', label: '连接', icon: '🔗' },
          { value: 'appearance', label: '外观', icon: '🎨' },
          { value: 'model', label: '模型', icon: '👤' },
        ]}
        value={activeTab()}
        onValueChange={setActiveTab}
      >
        {/* 连接设置 */}
        <TabContent value="connection" class="settings-tab">
          <div class="settings-section">
            <h4>OpenClaw Gateway</h4>
            
            <TextField
              label="Gateway URL"
              value={gatewayUrl()}
              onValueChange={setGatewayUrl}
              placeholder="ws://localhost:3939/ws"
              description="OpenClaw Gateway 的 WebSocket 地址"
            />
            
            <div class="settings-row">
              <div class={`connection-status connection-status--${props.connectionStatus}`}>
                <span class="status-dot"></span>
                <span>
                  {props.connectionStatus === 'connected' ? '已连接' :
                   props.connectionStatus === 'connecting' ? '连接中...' :
                   props.connectionStatus === 'error' ? '连接错误' : '未连接'}
                </span>
              </div>
              
              <Show when={props.connectionStatus === 'connected'}>
                <Button variant="danger" size="sm" onClick={() => {
                  saveConnectionSettings();
                  props.onDisconnect();
                }}>
                  断开
                </Button>
              </Show>
              
              <Show when={props.connectionStatus !== 'connected' && props.connectionStatus !== 'connecting'}>
                <Button variant="primary" size="sm" onClick={() => {
                  saveConnectionSettings();
                  props.onConnect();
                }}>
                  连接
                </Button>
              </Show>
            </div>
          </div>
          
          <div class="settings-section">
            <h4>Fish Audio TTS</h4>
            
            <TextField
              label="API Key"
              type="password"
              value={fishApiKey()}
              onValueChange={setFishApiKey}
              placeholder="输入 Fish Audio API Key"
              description="用于语音合成，获取地址: fish.audio"
            />
            
            <Button 
              variant="default" 
              size="sm"
              onClick={saveConnectionSettings}
            >
              保存 API Key
            </Button>
          </div>
        </TabContent>
        
        {/* 外观设置 */}
        <TabContent value="appearance" class="settings-tab">
          <div class="settings-section">
            <h4>主题</h4>
            
            <Select
              label="颜色模式"
              options={themeOptions}
              value={config().theme}
              onValueChange={(value) => setTheme(value as ThemeMode)}
            />
          </div>
          
          <div class="settings-section">
            <h4>聊天面板</h4>
            
            <Switch
              label="显示聊天面板"
              description="在主界面显示聊天窗口"
              checked={config().showChat}
              onCheckedChange={(checked) => updateConfig({ showChat: checked })}
            />
            
            <Select
              label="面板位置"
              options={[
                { value: 'right', label: '右侧' },
                { value: 'left', label: '左侧' },
              ]}
              value={config().chatPosition}
              onValueChange={(value) => updateConfig({ chatPosition: value as 'left' | 'right' })}
            />
          </div>
          
          <div class="settings-section">
            <h4>控制面板</h4>
            
            <Switch
              label="展开控制面板"
              description="默认展开表情和动作控制"
              checked={config().controlsExpanded}
              onCheckedChange={(checked) => updateConfig({ controlsExpanded: checked })}
            />
          </div>
        </TabContent>
        
        {/* 模型设置 */}
        <TabContent value="model" class="settings-tab">
          <div class="settings-section">
            <h4>Live2D 模型</h4>
            
            <Select
              label="当前模型"
              options={modelOptions}
              value={config().modelPath}
              onValueChange={(path) => {
                const model = AVAILABLE_MODELS.find(m => m.path === path);
                if (model) {
                  updateConfig({ modelPath: model.path, modelName: model.name });
                  props.onModelChange?.(model.path, model.name);
                }
              }}
            />
            
            <p class="settings-hint">
              💡 更多模型即将推出，包括初音未来专属模型！
            </p>
          </div>
          
          <div class="settings-section">
            <h4>模型信息</h4>
            <div class="model-info">
              <div class="model-info__item">
                <span class="model-info__label">名称</span>
                <span class="model-info__value">{config().modelName}</span>
              </div>
              <div class="model-info__item">
                <span class="model-info__label">路径</span>
                <span class="model-info__value code">{config().modelPath}</span>
              </div>
            </div>
          </div>
        </TabContent>
      </Tabs>
    </Dialog>
  );
}
