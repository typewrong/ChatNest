/**
 * ChatNest 端到端测试脚本
 * 用于模拟用户操作流程
 */

// 模拟对话数据
const mockConversation = {
  id: 'test-e2e-id',
  platform: 'deepseek',
  title: 'E2E测试对话',
  summary: '这是一个端到端测试对话',
  url: 'https://chat.deepseek.com/a/chat/s/e2e-test',
  timestamp: Date.now(),
  content: [
    { role: 'user', content: '你能帮我测试ChatNest插件吗？' },
    { role: 'assistant', content: '当然可以！我很乐意帮助你测试ChatNest浏览器插件。这个插件看起来是用于收藏不同chatbot的对话记录的，非常实用。你需要我怎么帮你测试呢？' },
    { role: 'user', content: '请帮我验证导出功能是否正常工作' },
    { role: 'assistant', content: '我可以帮你验证ChatNest的导出功能。以下是测试步骤：\n\n1. 首先，确保已经收集了一些对话记录\n2. 点击导出按钮\n3. 选择导出格式（Markdown）\n4. 验证导出的文件内容是否完整\n\n以上步骤能够覆盖基本的导出功能测试。有什么特定的测试场景需要关注吗？' }
  ]
};

// 模拟用户点击事件
const simulateClick = (element) => {
  const event = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(event);
};

// 模拟用户输入
const simulateInput = (element, value) => {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
};

// 测试popup页面的基本功能
const testPopupPage = async () => {
  try {
    console.log('开始测试popup页面基本功能...');
    
    // 等待DOM加载
    if (document.readyState !== 'complete') {
      await new Promise(resolve => {
        window.addEventListener('load', resolve);
      });
    }
    
    // 检查页面标题
    const title = document.querySelector('h1');
    if (!title || title.textContent !== 'ChatNest') {
      throw new Error('页面标题不正确，期望是"ChatNest"');
    }
    
    // 检查平台筛选器
    const platformFilter = document.getElementById('platform-filter');
    if (!platformFilter) {
      throw new Error('未找到平台筛选器');
    }
    
    // 检查搜索框
    const searchInput = document.getElementById('search');
    if (!searchInput) {
      throw new Error('未找到搜索框');
    }
    
    // 检查对话列表容器
    const conversationList = document.getElementById('conversation-list');
    if (!conversationList) {
      throw new Error('未找到对话列表容器');
    }
    
    console.log('✅ popup页面基本功能测试通过');
    return { success: true, message: 'popup页面基本功能测试通过' };
  } catch (error) {
    console.error('popup页面测试失败:', error);
    return { success: false, message: error.message };
  }
};

// 测试数据加载和显示
const testDataLoading = async () => {
  try {
    console.log('开始测试数据加载和显示...');
    
    // 模拟数据加载
    // 首先检查是否存在模拟数据
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('ChatNestDB', 1);
      
      request.onerror = (event) => {
        reject(new Error('数据库打开失败'));
      };
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
    });
    
    // 添加模拟数据
    const transaction = db.transaction(['conversations'], 'readwrite');
    const store = transaction.objectStore('conversations');
    
    // 先删除可能存在的测试数据
    await new Promise((resolve, reject) => {
      const request = store.delete(mockConversation.id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('删除测试数据失败'));
    });
    
    // 添加新的测试数据
    await new Promise((resolve, reject) => {
      const request = store.add(mockConversation);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('添加测试数据失败'));
    });
    
    // 更新对话索引
    await new Promise((resolve, reject) => {
      chrome.storage.sync.get('conversationIndex', (data) => {
        if (chrome.runtime.lastError) {
          reject(new Error('获取对话索引失败'));
          return;
        }
        
        const index = data.conversationIndex || [];
        const newIndex = [...index.filter(i => i.id !== mockConversation.id), {
          id: mockConversation.id,
          platform: mockConversation.platform,
          title: mockConversation.title,
          timestamp: mockConversation.timestamp
        }];
        
        chrome.storage.sync.set({ conversationIndex: newIndex }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error('更新对话索引失败'));
          } else {
            resolve();
          }
        });
      });
    });
    
    // 刷新列表（模拟点击刷新按钮）
    const refreshButton = document.getElementById('refresh-btn');
    if (refreshButton) {
      simulateClick(refreshButton);
      
      // 等待数据加载
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 检查列表中是否包含测试数据
      const conversationList = document.getElementById('conversation-list');
      const items = conversationList.querySelectorAll('.conversation-item');
      let found = false;
      
      items.forEach(item => {
        if (item.dataset.id === mockConversation.id) {
          found = true;
        }
      });
      
      if (!found) {
        throw new Error('列表中未找到测试数据');
      }
    }
    
    console.log('✅ 数据加载和显示测试通过');
    return { success: true, message: '数据加载和显示测试通过' };
  } catch (error) {
    console.error('数据加载和显示测试失败:', error);
    return { success: false, message: error.message };
  }
};

// 测试导出功能
const testExportFunction = async () => {
  try {
    console.log('开始测试导出功能...');
    
    // 检查是否在popup页面
    if (!document.getElementById('conversation-list')) {
      throw new Error('不在popup页面，无法测试导出功能');
    }
    
    // 点击导出按钮
    const exportButton = document.querySelector('.export-button');
    if (!exportButton) {
      throw new Error('未找到导出按钮');
    }
    
    // 模拟点击导出按钮
    simulateClick(exportButton);
    
    // 等待导出页面加载
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 如果成功跳转到导出页面，应该能找到导出相关元素
    const exportAllButton = document.getElementById('export-all');
    if (!exportAllButton) {
      throw new Error('未成功跳转到导出页面');
    }
    
    // 筛选平台
    const platformFilter = document.getElementById('platform-filter');
    if (platformFilter) {
      platformFilter.value = 'deepseek';
      platformFilter.dispatchEvent(new Event('change'));
      
      // 等待筛选结果
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 检查列表中是否包含测试数据
    const exportList = document.getElementById('export-list');
    if (!exportList) {
      throw new Error('未找到导出列表');
    }
    
    const items = exportList.querySelectorAll('.export-item');
    let testItemFound = false;
    
    items.forEach(item => {
      const title = item.querySelector('.title');
      if (title && title.textContent === mockConversation.title) {
        testItemFound = true;
        
        // 模拟点击该项进行导出
        simulateClick(item);
      }
    });
    
    if (!testItemFound) {
      throw new Error('导出列表中未找到测试数据');
    }
    
    // 测试批量导出
    simulateClick(exportAllButton);
    
    console.log('✅ 导出功能测试通过');
    return { success: true, message: '导出功能测试通过' };
  } catch (error) {
    console.error('导出功能测试失败:', error);
    return { success: false, message: error.message };
  } finally {
    // 清理测试数据
    try {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('ChatNestDB', 1);
        
        request.onerror = (event) => {
          reject(new Error('数据库打开失败'));
        };
        
        request.onsuccess = (event) => {
          resolve(event.target.result);
        };
      });
      
      const transaction = db.transaction(['conversations'], 'readwrite');
      const store = transaction.objectStore('conversations');
      
      await new Promise((resolve) => {
        const request = store.delete(mockConversation.id);
        request.onsuccess = resolve;
        request.onerror = resolve; // 即使删除失败也继续
      });
      
      await new Promise((resolve) => {
        chrome.storage.sync.get('conversationIndex', (data) => {
          if (chrome.runtime.lastError || !data.conversationIndex) {
            resolve();
            return;
          }
          
          const newIndex = data.conversationIndex.filter(i => i.id !== mockConversation.id);
          
          chrome.storage.sync.set({ conversationIndex: newIndex }, resolve);
        });
      });
    } catch (e) {
      console.warn('清理测试数据时出错:', e);
    }
  }
};

// 运行所有端到端测试
const runAllE2ETests = async () => {
  const results = {
    popupPage: null,
    dataLoading: null,
    exportFunction: null
  };
  
  try {
    // 测试popup页面
    results.popupPage = await testPopupPage();
    
    // 测试数据加载
    if (results.popupPage.success) {
      results.dataLoading = await testDataLoading();
    }
    
    // 测试导出功能
    if (results.dataLoading && results.dataLoading.success) {
      results.exportFunction = await testExportFunction();
    }
    
    // 输出结果
    console.log('===== ChatNest 端到端测试结果 =====');
    console.log('Popup页面:', results.popupPage.success ? '✅ 通过' : '❌ 失败', '-', results.popupPage.message);
    console.log('数据加载:', results.dataLoading ? (results.dataLoading.success ? '✅ 通过' : '❌ 失败') : '⚠️ 未测试', '-', results.dataLoading ? results.dataLoading.message : '依赖的测试未通过');
    console.log('导出功能:', results.exportFunction ? (results.exportFunction.success ? '✅ 通过' : '❌ 失败') : '⚠️ 未测试', '-', results.exportFunction ? results.exportFunction.message : '依赖的测试未通过');
    
    return results;
  } catch (error) {
    console.error('端到端测试过程中发生错误:', error);
    return { error: error.message };
  }
};

// 导出测试函数
export { testPopupPage, testDataLoading, testExportFunction, runAllE2ETests }; 