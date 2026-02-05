// 这是 AvatarSystem.ts 的 sendMessage 方法修复版本

/**
 * 发送消息 - 修复版（支持独立session）
 */
async sendMessage(text: string): Promise<boolean> {
  // 🎯 修复：使用配置中的sessionKey，确保独立session
  const sessionKey = this.config.sessionKey || 'agent:main:avatar';
  
  console.log(`[AvatarSystem] 发送消息到session: ${sessionKey}`);
  console.log(`[AvatarSystem] 消息内容: ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`);
  
  try {
    if (this.useBridge && this.bridgeConnector.getStatus() === 'connected') {
      // 注意：如果bridgeConnector也需要支持sessionKey，需要更新其接口
      return await this.bridgeConnector.sendMessage(text);
    }
    
    // 🎯 关键修复：传递sessionKey参数
    return await this.connector.sendMessage(text, { 
      sessionKey,
      // 可选：添加其他配置
      thinkingLevel: 'low',  // Avatar专用思维级别
      model: undefined  // 使用默认模型
    });
  } catch (error) {
    console.error('[AvatarSystem] 发送消息失败:', error);
    return false;
  }
}

/**
 * 切换Session - 新增功能
 */
async switchSession(newSessionKey: string): Promise<void> {
  console.log(`[AvatarSystem] 切换session: ${this.config.sessionKey} -> ${newSessionKey}`);
  
  // 更新配置
  this.config.sessionKey = newSessionKey;
  
  // 如果需要重新连接，可以在这里处理
  // this.connector.disconnect();
  // await this.connector.connect();
  
  console.log(`[AvatarSystem] Session切换完成: ${newSessionKey}`);
}

/**
 * 获取当前Session状态
 */
getCurrentSessionInfo(): { sessionKey: string; status: string } {
  return {
    sessionKey: this.config.sessionKey || 'agent:main:avatar',
    status: this.connector.getStatus()
  };
}