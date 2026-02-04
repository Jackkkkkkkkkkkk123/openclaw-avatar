/* @refresh reload */
import { render } from "solid-js/web";
import App from "./App";
import { serviceWorkerManager } from "./lib/ServiceWorkerManager";

// 渲染应用
render(() => <App />, document.getElementById("root") as HTMLElement);

// 注册 Service Worker (仅生产环境)
if (import.meta.env.PROD) {
  serviceWorkerManager.register().then((success) => {
    if (success) {
      console.log('[App] PWA Service Worker 已注册');
      
      // 监听更新
      serviceWorkerManager.onStateChange((state) => {
        if (state.updateAvailable) {
          console.log('[App] 新版本可用，刷新页面以更新');
        }
      });
    }
  });
}
