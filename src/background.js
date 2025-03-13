/**
 * ChatNest 扩展的背景脚本
 * 负责管理IndexedDB、Chrome存储API和扩展生命周期
 */

// 初始化数据库
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ChatNestDB', 1);
    
    request.onerror = event => {
      console.error('数据库打开失败:', event);
      reject(event);
    };
    
    request.onsuccess = event => {
      console.log('数据库连接成功');
      resolve(event.target.result);
    };
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      
      // 创建对话记录存储
      if (!db.objectStoreNames.contains('conversations')) {
        const store = db.createObjectStore('conversations', { keyPath: 'id' });
        store.createIndex('platform', 'platform', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('创建对话记录存储成功');
      }
    };
  });
};

// 获取所有对话的元数据索引
const getConversationIndex = () => {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get('conversationIndex', (data) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      const index = data.conversationIndex || [];
      resolve(index);
    });
  });
};

// 更新对话元数据索引
const updateConversationIndex = (index) => {
  return new Promise((resolve, reject) => {
    // 确保索引数组不会超过Chrome Storage的限制
    // 通常每个项目最大为8KB，总存储空间为5MB
    const maxEntries = 100; // 设置一个合理的限制
    
    // 如果超出限制，保留最新的
    const trimmedIndex = index.length > maxEntries 
      ? index.slice(0, maxEntries) 
      : index;
    
    chrome.storage.sync.set({ conversationIndex: trimmedIndex }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      resolve();
    });
  });
};

// 获取单个对话详情
const getConversation = async (id) => {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['conversations'], 'readonly');
      const store = transaction.objectStore('conversations');
      
      const request = store.get(id);
      
      request.onsuccess = event => {
        const conversation = event.target.result;
        
        if (!conversation) {
          reject(new Error('对话不存在'));
          return;
        }
        
        resolve(conversation);
      };
      
      request.onerror = event => {
        reject(event);
      };
    });
  } catch (error) {
    console.error('获取对话失败:', error);
    throw error;
  }
};

// 获取所有对话数据
const getAllConversations = async () => {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['conversations'], 'readonly');
      const store = transaction.objectStore('conversations');
      
      const request = store.getAll();
      
      request.onsuccess = event => {
        const conversations = event.target.result;
        resolve(conversations);
      };
      
      request.onerror = event => {
        reject(event);
      };
    });
  } catch (error) {
    console.error('获取所有对话失败:', error);
    throw error;
  }
};

// 根据平台获取对话
const getConversationsByPlatform = async (platform) => {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['conversations'], 'readonly');
      const store = transaction.objectStore('conversations');
      const index = store.index('platform');
      
      const request = index.getAll(platform);
      
      request.onsuccess = event => {
        const conversations = event.target.result;
        resolve(conversations);
      };
      
      request.onerror = event => {
        reject(event);
      };
    });
  } catch (error) {
    console.error(`获取${platform}对话失败:`, error);
    throw error;
  }
};

// 更新对话
const updateConversation = async (conversation) => {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['conversations'], 'readwrite');
      const store = transaction.objectStore('conversations');
      
      // 先检查对话是否存在
      const checkRequest = store.get(conversation.id);
      
      checkRequest.onsuccess = event => {
        const existingConversation = event.target.result;
        
        if (!existingConversation) {
          reject(new Error('要更新的对话不存在'));
          return;
        }
        
        // 更新对话
        const updateRequest = store.put(conversation);
        
        updateRequest.onsuccess = () => {
          // 更新元数据索引
          getConversationIndex().then(index => {
            // 找到并更新元数据
            const metaIndex = index.findIndex(meta => meta.id === conversation.id);
            
            if (metaIndex !== -1) {
              // 更新元数据
              index[metaIndex] = {
                id: conversation.id,
                platform: conversation.platform,
                title: conversation.title,
                timestamp: conversation.timestamp,
                url: conversation.url
              };
              
              // 重新排序
              index.sort((a, b) => b.timestamp - a.timestamp);
              
              // 保存更新后的索引
              updateConversationIndex(index)
                .then(() => resolve())
                .catch(error => reject(error));
            } else {
              // 如果没找到对应的元数据，可能需要添加
              const newMeta = {
                id: conversation.id,
                platform: conversation.platform,
                title: conversation.title,
                timestamp: conversation.timestamp,
                url: conversation.url
              };
              
              index.push(newMeta);
              index.sort((a, b) => b.timestamp - a.timestamp);
              
              updateConversationIndex(index)
                .then(() => resolve())
                .catch(error => reject(error));
            }
          }).catch(error => reject(error));
        };
        
        updateRequest.onerror = event => {
          reject(event);
        };
      };
      
      checkRequest.onerror = event => {
        reject(event);
      };
    });
  } catch (error) {
    console.error('更新对话失败:', error);
    throw error;
  }
};

// 删除对话
const deleteConversation = async (id) => {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['conversations'], 'readwrite');
      const store = transaction.objectStore('conversations');
      
      const request = store.delete(id);
      
      request.onsuccess = () => {
        // 从元数据索引中移除
        getConversationIndex().then(index => {
          // 过滤掉要删除的对话
          const updatedIndex = index.filter(meta => meta.id !== id);
          
          // 保存更新后的索引
          updateConversationIndex(updatedIndex)
            .then(() => resolve())
            .catch(error => reject(error));
        }).catch(error => reject(error));
      };
      
      request.onerror = event => {
        reject(event);
      };
    });
  } catch (error) {
    console.error('删除对话失败:', error);
    throw error;
  }
};

// 将对话导出为Markdown格式
const conversationToMarkdown = (conversation) => {
  if (!conversation || !conversation.messages || !Array.isArray(conversation.messages)) {
    return '# 无效的对话数据';
  }
  
  let markdown = `# ${conversation.title || '未命名对话'}\n\n`;
  markdown += `- 平台: ${conversation.platform === 'deepseek' ? 'DeepSeek' : '豆包'}\n`;
  markdown += `- 时间: ${new Date(conversation.timestamp).toLocaleString('zh-CN')}\n`;
  markdown += `- 链接: ${conversation.url || '无链接'}\n\n`;
  markdown += `---\n\n`;
  
  // 添加对话内容
  conversation.messages.forEach(message => {
    const role = message.role === 'user' ? '**用户**' : '**AI**';
    markdown += `## ${role}\n\n${message.content}\n\n`;
  });
  
  return markdown;
};

// 导出对话列表为Markdown
const exportConversationsToMarkdown = async (conversationIds) => {
  try {
    const exportedConversations = [];
    
    // 获取每个对话的完整内容并转换为Markdown
    for (const id of conversationIds) {
      try {
        const conversation = await getConversation(id);
        const markdown = conversationToMarkdown(conversation);
        exportedConversations.push({
          id: conversation.id,
          title: conversation.title,
          markdown
        });
      } catch (error) {
        console.error(`导出对话${id}失败:`, error);
        // 继续处理其他对话
      }
    }
    
    return exportedConversations;
  } catch (error) {
    console.error('导出对话列表失败:', error);
    throw error;
  }
};

// 保存对话记录
const saveConversation = async (conversation) => {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['conversations'], 'readwrite');
      const store = transaction.objectStore('conversations');
      
      // 检查是否已存在相同ID的对话
      const getRequest = store.get(conversation.id);
      
      getRequest.onsuccess = event => {
        const existingConversation = event.target.result;
        
        // 如果已存在，就更新
        if (existingConversation) {
          // 更新现有对话
          const updateRequest = store.put(conversation);
          
          updateRequest.onsuccess = () => {
            // 更新元数据索引
            updateConversationMetadata(conversation, true)
              .then(() => resolve())
              .catch(error => reject(error));
          };
          
          updateRequest.onerror = event => {
            reject(event);
          };
        } else {
          // 添加新对话
          const addRequest = store.add(conversation);
          
          addRequest.onsuccess = () => {
            // 添加元数据索引
            updateConversationMetadata(conversation, false)
              .then(() => resolve())
              .catch(error => reject(error));
          };
          
          addRequest.onerror = event => {
            reject(event);
          };
        }
      };
      
      getRequest.onerror = event => {
        reject(event);
      };
    });
  } catch (error) {
    console.error('保存对话失败:', error);
    throw error;
  }
};

// 更新对话元数据
const updateConversationMetadata = async (conversation, isUpdate) => {
  try {
    console.log('开始更新对话元数据:', conversation.id);
    
    // 获取现有索引
    const index = await getConversationIndex();
    console.log('当前元数据索引长度:', index.length, '索引内容:', JSON.stringify(index));
    
    // 创建元数据对象
    const metaData = {
      id: conversation.id,
      platform: conversation.platform,
      title: conversation.title,
      timestamp: conversation.timestamp,
      url: conversation.url
    };
    
    // 判断是否是有效的元数据索引数组
    if (!Array.isArray(index)) {
      console.error('元数据索引不是数组，重置为空数组');
      const newIndex = [metaData];
      await updateConversationIndex(newIndex);
      console.log('元数据索引已重置并添加新元数据');
      return;
    }
    
    // 过滤掉索引中的无效元素
    let validIndex = index.filter(item => item && typeof item === 'object' && item.id);
    console.log('有效元数据数量:', validIndex.length);
    
    if (isUpdate) {
      // 更新现有元数据
      const metaIndex = validIndex.findIndex(meta => meta && meta.id === conversation.id);
      
      if (metaIndex !== -1) {
        validIndex[metaIndex] = metaData;
        console.log('更新现有元数据:', metaIndex);
      } else {
        // 如果找不到，添加新的
        validIndex.push(metaData);
        console.log('在更新模式下添加新元数据');
      }
    } else {
      // 添加新元数据
      // 检查是否已存在相同ID的元数据
      const existingIndex = validIndex.findIndex(meta => meta && meta.id === conversation.id);
      if (existingIndex !== -1) {
        // 如果已存在，更新它
        validIndex[existingIndex] = metaData;
        console.log('更新已存在的元数据:', existingIndex);
      } else {
        // 否则添加新的
        validIndex.push(metaData);
        console.log('添加新元数据');
      }
    }
    
    // 过滤空值和重复项
    const cleanedIndex = validIndex.filter((item, pos, arr) => {
      if (!item || !item.id) return false;
      return arr.findIndex(i => i && i.id === item.id) === pos;
    });
    
    // 按时间戳排序
    cleanedIndex.sort((a, b) => b.timestamp - a.timestamp);
    
    console.log('更新后的元数据索引长度:', cleanedIndex.length);
    
    // 确保每个元素都是有效的
    const finalIndex = cleanedIndex.map(item => ({
      id: item.id,
      platform: item.platform || 'unknown',
      title: item.title || '未命名对话',
      timestamp: item.timestamp || Date.now(),
      url: item.url || ''
    }));
    
    // 更新存储
    await updateConversationIndex(finalIndex);
    console.log('元数据更新成功');
  } catch (error) {
    console.error('更新对话元数据失败:', error);
    throw error;
  }
};

// 修改错误处理逻辑
const handleRuntimeError = (error, sender) => {
  console.error('运行时错误:', error);
  // 尝试记录错误到本地存储以便后续分析
  try {
    const errorLog = {
      timestamp: Date.now(),
      error: error.toString(),
      sender: sender ? sender.url : 'unknown'
    };
    
    let errorLogs = JSON.parse(localStorage.getItem('chatnest_error_logs') || '[]');
    errorLogs.push(errorLog);
    // 只保留最近50条错误日志
    if (errorLogs.length > 50) {
      errorLogs = errorLogs.slice(-50);
    }
    localStorage.setItem('chatnest_error_logs', JSON.stringify(errorLogs));
  } catch (e) {
    console.error('无法记录错误:', e);
  }
};

// 从localStorage恢复临时保存的对话
const recoverTemporaryConversations = async () => {
  try {
    console.log('检查是否有需要恢复的临时对话...');
    
    // 使用chrome.storage.local替代localStorage
    chrome.storage.local.get(null, async (items) => {
      const tempKeys = Object.keys(items).filter(key => key.startsWith('chatnest_temp_'));
      
      if (tempKeys.length === 0) {
        console.log('没有找到需要恢复的临时对话');
        return;
      }
      
      console.log(`找到${tempKeys.length}个临时保存的对话，尝试恢复...`);
      
      for (const key of tempKeys) {
        try {
          const conversation = items[key];
          
          // 保存到IndexedDB
          await saveConversation(conversation);
          console.log(`恢复对话成功: ${conversation.id}`);
          
          // 恢复成功后删除临时存储
          chrome.storage.local.remove(key, () => {
            console.log(`临时存储已删除: ${key}`);
          });
        } catch (recoverError) {
          console.error(`恢复对话失败 (${key}):`, recoverError);
        }
      }
    });
  } catch (error) {
    console.error('恢复临时对话过程中出错:', error);
  }
};

// 启动时尝试恢复临时会话
chrome.runtime.onStartup.addListener(() => {
  console.log('扩展启动，尝试恢复临时对话...');
  recoverTemporaryConversations();
});

// 安装或更新时也尝试恢复
chrome.runtime.onInstalled.addListener(() => {
  console.log('扩展已安装或更新，尝试恢复临时对话...');
  recoverTemporaryConversations();
});

// 调试日志函数
const debugLog = (message) => {
  const isDebug = true; // 设置为true开启调试日志
  if (isDebug) {
    console.log(`[ChatNest Background] ${message}`);
    
    // 保存日志到storage
    const now = new Date();
    const logEntry = `${now.toISOString()}: ${message}`;
    
    chrome.storage.local.get('debug_logs', (result) => {
      let logs = result.debug_logs || [];
      logs.push(logEntry);
      // 限制日志数量
      if (logs.length > 100) logs = logs.slice(-100);
      chrome.storage.local.set({ debug_logs: logs });
    });
  }
};

// 监听来自popup或content scripts的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debugLog(`收到消息: ${JSON.stringify(message)}`);
  
  // 对于 SAVE_CONVERSATION 消息，使用同步响应
  if (message.type === 'SAVE_CONVERSATION') {
    try {
      saveConversation(message.data);
      sendResponse({ success: true });
    } catch (error) {
      console.error('保存对话失败:', error);
      handleRuntimeError(error, sender);
      sendResponse({ success: false, error: error.message });
    }
    return false; // 同步响应
  }
  
  // 根据消息类型执行不同操作
  if (message.action === 'saveConversation') {
    try {
      saveConversation(message.conversation);
      sendResponse({ success: true });
    } catch (error) {
      console.error('保存对话失败:', error);
      handleRuntimeError(error, sender);
      sendResponse({ success: false, error: error.message });
    }
  }
  else if (message.action === 'getAllConversations') {
    debugLog('处理获取全部对话请求');
    getAllConversations()
      .then(conversations => {
        console.log('获取到全部对话:', conversations);
        sendResponse({ success: true, conversations });
      })
      .catch(error => {
        console.error('获取全部对话失败:', error);
        handleRuntimeError(error, sender);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 异步响应
  }
  else if (message.action === 'getConversationsByPlatform') {
    debugLog(`处理获取平台对话请求: ${message.platform}`);
    getConversationsByPlatform(message.platform)
      .then(conversations => {
        console.log('获取到平台对话:', conversations);
        sendResponse({ success: true, conversations });
      })
      .catch(error => {
        console.error(`获取平台对话失败: ${message.platform}`, error);
        handleRuntimeError(error, sender);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 异步响应
  }
  else if (message.action === 'getConversation') {
    const conversationId = message.id;
    
    if (!conversationId) {
      sendResponse({ success: false, error: '未提供对话ID' });
      return false;
    }
    
    getConversation(conversationId)
      .then(conversation => {
        console.log('获取到对话:', conversation);
        sendResponse({ success: true, conversation });
      })
      .catch(error => {
        console.error('获取对话失败:', error);
        handleRuntimeError(error, sender);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 异步响应
  }
  else if (message.action === 'deleteConversation') {
    const conversationId = message.id;
    
    if (!conversationId) {
      sendResponse({ success: false, error: '未提供对话ID' });
      return false;
    }
    
    deleteConversation(conversationId)
      .then(() => {
        console.log('删除对话成功:', conversationId);
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('删除对话失败:', error);
        handleRuntimeError(error, sender);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 异步响应
  }
  else if (message.action === 'conversationToMarkdown') {
    // 将对话转换为Markdown格式
    try {
      const markdown = conversationToMarkdown(message.conversation);
      sendResponse({ success: true, markdown });
    } catch (error) {
      console.error('转换为Markdown失败:', error);
      handleRuntimeError(error, sender);
      sendResponse({ success: false, error: error.message });
    }
  }
  else if (message.type === 'GET_CONVERSATION_INDEX') {
    debugLog('处理获取对话索引请求');
    getConversationIndex()
      .then(index => {
        console.log('获取到对话索引:', index);
        sendResponse({ success: true, data: index });
      })
      .catch(error => {
        console.error('获取对话索引失败:', error);
        handleRuntimeError(error, sender);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 异步响应
  }
  else if (message.type === 'EXPORT_CONVERSATIONS') {
    debugLog(`处理导出对话请求: ${message.data?.conversations?.length || 0}个对话`);
    exportConversationsToMarkdown(message.data?.conversations || [])
      .then(exported => {
        console.log('导出对话成功:', exported);
        sendResponse({ success: true, data: exported });
      })
      .catch(error => {
        console.error('导出对话失败:', error);
        handleRuntimeError(error, sender);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 异步响应
  }
  else {
    console.warn('未知消息类型:', message);
    sendResponse({ success: false, error: '未知消息类型' });
  }
  
  return true; // 默认为异步响应
}); 