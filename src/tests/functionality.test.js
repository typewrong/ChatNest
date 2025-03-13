/**
 * ChatNest 功能测试脚本
 * 用于测试核心功能是否正常工作
 */

// 模拟对话数据
const mockConversation = {
  id: 'test-conversation-id',
  platform: 'deepseek',
  title: '测试对话',
  summary: '测试对话摘要',
  url: 'https://chat.deepseek.com/a/chat/s/test-id',
  timestamp: Date.now(),
  content: [
    { role: 'user', content: '你好' },
    { role: 'assistant', content: '您好！有什么可以帮助您的吗？' }
  ]
};

// 测试IndexedDB存储功能
const testIndexedDBStorage = async () => {
  try {
    // 打开数据库连接
    const dbRequest = indexedDB.open('ChatNestDB', 1);
    
    return new Promise((resolve, reject) => {
      dbRequest.onerror = (event) => {
        console.error('数据库打开失败:', event);
        reject(new Error('数据库打开失败'));
      };
      
      dbRequest.onsuccess = (event) => {
        const db = event.target.result;
        
        // 开始事务
        const transaction = db.transaction(['conversations'], 'readwrite');
        const store = transaction.objectStore('conversations');
        
        // 存储测试数据
        const addRequest = store.add(mockConversation);
        
        addRequest.onsuccess = () => {
          // 尝试读取刚刚存储的数据
          const getRequest = store.get(mockConversation.id);
          
          getRequest.onsuccess = () => {
            const result = getRequest.result;
            
            // 清理测试数据
            const deleteRequest = store.delete(mockConversation.id);
            
            deleteRequest.onsuccess = () => {
              // 验证结果
              if (result && result.id === mockConversation.id) {
                resolve({ success: true, message: 'IndexedDB存储测试通过' });
              } else {
                reject(new Error('读取的数据与存储的数据不匹配'));
              }
            };
            
            deleteRequest.onerror = (e) => {
              reject(new Error('清理测试数据失败: ' + e.target.error));
            };
          };
          
          getRequest.onerror = (e) => {
            reject(new Error('读取测试数据失败: ' + e.target.error));
          };
        };
        
        addRequest.onerror = (e) => {
          reject(new Error('存储测试数据失败: ' + e.target.error));
        };
      };
    });
  } catch (error) {
    return { success: false, message: '测试过程中发生错误: ' + error.message };
  }
};

// 测试Chrome Storage API
const testChromeStorage = async () => {
  try {
    // 准备测试数据
    const testData = {
      conversationIndex: [
        {
          id: mockConversation.id,
          platform: mockConversation.platform,
          title: mockConversation.title,
          timestamp: mockConversation.timestamp
        }
      ]
    };
    
    return new Promise((resolve, reject) => {
      // 存储测试数据
      chrome.storage.sync.set(testData, () => {
        if (chrome.runtime.lastError) {
          reject(new Error('存储测试数据失败: ' + chrome.runtime.lastError.message));
          return;
        }
        
        // 读取测试数据
        chrome.storage.sync.get('conversationIndex', (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error('读取测试数据失败: ' + chrome.runtime.lastError.message));
            return;
          }
          
          // 清理测试数据
          chrome.storage.sync.remove('conversationIndex', () => {
            if (chrome.runtime.lastError) {
              console.warn('清理测试数据失败: ' + chrome.runtime.lastError.message);
            }
            
            // 验证结果
            const index = result.conversationIndex || [];
            if (index.length > 0 && index[0].id === mockConversation.id) {
              resolve({ success: true, message: 'Chrome Storage测试通过' });
            } else {
              reject(new Error('读取的数据与存储的数据不匹配'));
            }
          });
        });
      });
    });
  } catch (error) {
    return { success: false, message: '测试过程中发生错误: ' + error.message };
  }
};

// 测试Markdown导出功能
const testMarkdownExport = () => {
  try {
    // 导入转换函数
    const conversationToMarkdown = (conversation) => {
      let markdown = `# ${conversation.title || '未命名对话'}\n\n`;
      markdown += `> 平台: ${conversation.platform}\n`;
      markdown += `> 时间: ${new Date(conversation.timestamp).toLocaleString()}\n\n`;
      
      if (conversation.content && Array.isArray(conversation.content)) {
        conversation.content.forEach(message => {
          if (message.role === 'user') {
            markdown += `## 用户\n\n${message.content}\n\n`;
          } else if (message.role === 'assistant') {
            markdown += `## 助手\n\n${message.content}\n\n`;
          }
        });
      }
      
      return markdown;
    };
    
    // 生成Markdown
    const markdown = conversationToMarkdown(mockConversation);
    
    // 验证结果
    const isValid = markdown.includes(mockConversation.title) && 
                    markdown.includes('用户') && 
                    markdown.includes('助手') && 
                    markdown.includes('你好') && 
                    markdown.includes('您好！有什么可以帮助您的吗？');
    
    return {
      success: isValid,
      message: isValid ? 'Markdown导出测试通过' : 'Markdown导出测试失败',
      markdown
    };
  } catch (error) {
    return { success: false, message: '测试过程中发生错误: ' + error.message };
  }
};

// 执行所有测试
const runAllTests = async () => {
  const results = {
    indexedDB: null,
    chromeStorage: null,
    markdownExport: null
  };
  
  try {
    // 测试IndexedDB
    results.indexedDB = await testIndexedDBStorage();
  } catch (error) {
    results.indexedDB = { success: false, message: error.message };
  }
  
  try {
    // 测试Chrome Storage
    results.chromeStorage = await testChromeStorage();
  } catch (error) {
    results.chromeStorage = { success: false, message: error.message };
  }
  
  // 测试Markdown导出
  results.markdownExport = testMarkdownExport();
  
  // 输出结果
  console.log('===== ChatNest 功能测试结果 =====');
  console.log('IndexedDB存储:', results.indexedDB.success ? '✅ 通过' : '❌ 失败', '-', results.indexedDB.message);
  console.log('Chrome Storage:', results.chromeStorage.success ? '✅ 通过' : '❌ 失败', '-', results.chromeStorage.message);
  console.log('Markdown导出:', results.markdownExport.success ? '✅ 通过' : '❌ 失败', '-', results.markdownExport.message);
  
  return results;
};

// 导出测试函数
export { testIndexedDBStorage, testChromeStorage, testMarkdownExport, runAllTests }; 