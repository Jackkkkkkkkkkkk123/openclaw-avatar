import puppeteer from 'puppeteer';

async function testWebSocket() {
  console.log('🚀 Starting browser WebSocket test...');
  
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  // 监听控制台输出
  page.on('console', msg => {
    console.log('🌐', msg.text());
  });
  
  // 导航到测试页面
  await page.goto('http://localhost:1420/ws-test.html');
  await page.waitForSelector('button');
  
  console.log('📄 Page loaded, clicking Connect...');
  
  // 点击连接按钮
  await page.click('button');
  
  // 等待连接结果
  await page.waitForFunction(() => {
    const log = document.getElementById('log').textContent;
    return log.includes('SUCCESS') || log.includes('FAILED') || log.includes('Closed');
  }, { timeout: 10000 });
  
  // 获取日志
  const log = await page.$eval('#log', el => el.textContent);
  console.log('\n📋 Result:\n' + log);
  
  // 如果连接成功，发送测试消息
  if (log.includes('SUCCESS')) {
    console.log('\n📤 Sending test message...');
    await page.$$eval('button', btns => btns[1].click());
    
    // 等待响应
    await page.waitForFunction(() => {
      const log = document.getElementById('log').textContent;
      return log.includes('Agent:') || log.includes('🤖');
    }, { timeout: 30000 }).catch(() => {
      console.log('⏱️ Timeout waiting for agent response');
    });
    
    // 获取最终日志
    const finalLog = await page.$eval('#log', el => el.textContent);
    console.log('\n📋 Final Result:\n' + finalLog);
  }
  
  await browser.close();
  console.log('\n✅ Test complete');
}

testWebSocket().catch(console.error);
