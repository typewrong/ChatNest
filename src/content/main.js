/**
 * ChatNest 内容脚本主文件
 * 负责协调各平台特定的内容提取器
 */

// 生成唯一ID
const generateUniqueId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// 获取当前URL中的会话ID
const getConversationIdFromUrl = () => {
  const url = window.location.href;
  const hostname = window.location.hostname;
  
  // DeepSeek URL格式: https://chat.deepseek.com/a/chat/s/0a8a933f-b48d-448e-9584-4dc01c0f416b
  if (hostname.includes('deepseek.com')) {
    // 尝试提取UUID格式的ID
    const uuidMatch = url.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i);
    if (uuidMatch) {
      return 'deepseek_' + uuidMatch[1];
    }
    
    // 如果URL中有chat/s/后面的部分
    const pathMatch = url.match(/chat\/s\/([^/?#]+)/i);
    if (pathMatch) {
      return 'deepseek_' + pathMatch[1];
    }
  }
  
  // 豆包 URL格式: https://www.doubao.com/chat/1822636072395778
  if (hostname.includes('doubao.com')) {
    // 尝试提取数字ID
    const numericMatch = url.match(/chat\/(\d+)(?:[/?#]|$)/i);
    if (numericMatch) {
      return 'doubao_' + numericMatch[1];
    }
    
    // 尝试提取最后一段路径
    const pathMatch = url.match(/\/([^/?#]+)(?:[/?#]|$)/);
    if (pathMatch) {
      return 'doubao_' + pathMatch[1];
    }
  }
  
  // 如果无法匹配特定格式，使用完整URL的哈希作为ID
  return 'chat_' + btoa(url).replace(/[+/=]/g, '').substring(0, 16);
};

// 确定当前平台
const determinePlatform = () => {
  const hostname = window.location.hostname;
  
  if (hostname.includes('deepseek.com')) {
    return 'deepseek';
  } else if (hostname.includes('doubao.com')) {
    return 'doubao';
  }
  
  return 'unknown';
};

// 检查扩展是否处于有效状态，更健壮的实现
const isExtensionValid = () => {
  try {
    // 检查chrome.runtime对象及其ID是否存在
    if (!chrome || !chrome.runtime) {
      return false;
    }
    
    // 尝试访问chrome.runtime.id，如果扩展上下文无效会抛出异常
    const id = chrome.runtime.id;
    return !!id;
  } catch (e) {
    // 捕获"Extension context invalidated"和其他错误
    console.error('扩展上下文检查错误:', e.message);
    return false;
  }
};

// 安全地发送消息的包装函数
const sendMessageSafely = (message, callback) => {
  try {
    // 首先检查扩展是否有效
    if (!isExtensionValid()) {
      console.error('扩展上下文已失效，无法发送消息');
      if (callback) {
        callback({ success: false, error: 'Extension context invalidated' });
      }
      return;
    }
    
    // 尝试发送消息
    chrome.runtime.sendMessage(message, (response) => {
      // 检查chrome.runtime.lastError
      if (chrome.runtime.lastError) {
        console.error('消息发送错误:', chrome.runtime.lastError.message);
        if (callback) {
          callback({ success: false, error: chrome.runtime.lastError.message });
        }
        return;
      }
      
      // 正常回调
      if (callback) {
        callback(response);
      }
    });
  } catch (e) {
    console.error('发送消息时出错:', e.message);
    if (callback) {
      callback({ success: false, error: e.message });
    }
  }
};

// 修改saveConversation函数，使用sendMessageSafely
const saveConversation = (conversation) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('尝试保存对话到后台:', conversation.id);
      
      // 确保chrome.runtime对象存在且可用
      if (!isExtensionValid()) {
        console.error('Chrome runtime API不可用，可能是扩展上下文已失效');
        
        // 尝试使用chrome.storage.local进行临时存储
        try {
          const tempKey = `chatnest_temp_${conversation.id}`;
          chrome.storage.local.set({ [tempKey]: conversation }, () => {
            if (chrome.runtime.lastError) {
              console.error('使用chrome.storage.local保存失败:', chrome.runtime.lastError);
              reject(new Error('扩展上下文已失效且备用存储也失败'));
              return;
            }
            console.log('已将对话临时保存到chrome.storage.local:', tempKey);
            resolve({ success: true, message: '已临时保存' });
          });
        } catch (localErr) {
          console.error('备用存储也失败:', localErr);
          reject(new Error('扩展上下文已失效且备用存储也失败'));
        }
        return;
      }
      
      // 使用安全的消息发送方式
      sendMessageSafely(
        { type: 'SAVE_CONVERSATION', data: conversation },
        response => {
          // 处理响应
          if (!response) {
            console.error('保存失败: 未收到响应');
            reject(new Error('保存失败: 未收到响应'));
            return;
          }
          
          // 处理响应
          if (response.success === true) {
            console.log('对话保存成功:', conversation.id);
            resolve(response);
          } else if (response.received === true) {
            // 这是一个中间响应，保存操作仍在进行中
            console.log('保存请求已接收，等待完成...');
            // 使用延迟解析，允许后台有时间完成保存
            setTimeout(() => {
              resolve({ success: true, message: '请求已接收' });
            }, 500);
          } else {
            const errorMsg = response.error || '未知错误';
            console.error('保存失败:', errorMsg);
            reject(new Error(errorMsg));
          }
        }
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('saveConversation执行时出错:', errorMsg);
      reject(new Error(errorMsg));
    }
  });
};

// 获取自动提取设置状态
const getAutoExtractEnabled = async () => {
  try {
    // 默认开启自动提取
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      console.log('存储API不可用，使用默认设置（开启）');
      return true;
    }
    
    return new Promise((resolve) => {
      chrome.storage.sync.get('autoExtractEnabled', (result) => {
        // 如果设置不存在，默认为true（开启）
        const enabled = result.autoExtractEnabled !== undefined ? result.autoExtractEnabled : true;
        console.log('自动提取对话功能状态:', enabled ? '开启' : '关闭');
        resolve(enabled);
      });
    });
  } catch (error) {
    console.error('获取自动提取设置时出错:', error);
    // 发生错误时默认开启
    return true;
  }
};

// 设置自动提取状态
const setAutoExtractEnabled = async (enabled) => {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      console.error('存储API不可用，无法保存设置');
      return false;
    }
    
    return new Promise((resolve) => {
      chrome.storage.sync.set({ autoExtractEnabled: enabled }, () => {
        console.log('自动提取对话功能已' + (enabled ? '开启' : '关闭'));
        resolve(true);
      });
    });
  } catch (error) {
    console.error('保存自动提取设置时出错:', error);
    return false;
  }
};

// 添加调试模式标志
const debugMode = true;

// 导出函数供平台特定脚本使用
window.ChatNest = {
  generateUniqueId,
  getConversationIdFromUrl,
  determinePlatform,
  saveConversation,
  isExtensionValid,
  getAutoExtractEnabled,
  setAutoExtractEnabled,
  debugMode
};

// 添加调试信息
console.log('ChatNest内容脚本已加载');
console.log('当前平台:', determinePlatform());
console.log('对话ID:', getConversationIdFromUrl());

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_AUTO_EXTRACT') {
    console.log(`收到自动提取设置更新: ${message.enabled ? '开启' : '关闭'}`);
    // 更新设置
    setAutoExtractEnabled(message.enabled)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('更新自动提取设置失败:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // 返回true表示将异步发送响应
    return true;
  }
}); 