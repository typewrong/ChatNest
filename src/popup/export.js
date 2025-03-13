/**
 * ChatNest 导出页面脚本
 * 负责处理对话导出功能
 */

// 全局变量
let exportData = {
  conversations: [],
  platform: 'all',
  keyword: ''
};

// 设置进度条
const setProgress = (percent) => {
  const progressValue = document.getElementById('progress-value');
  const status = document.getElementById('status');
  
  progressValue.style.width = `${percent}%`;
  
  if (percent === 0) {
    status.textContent = '准备导出...';
  } else if (percent < 100) {
    status.textContent = `正在导出... ${percent}%`;
  } else {
    status.textContent = '导出完成';
  }
};

// 处理单个对话的导出
const handleExport = (id, title, markdown) => {
  try {
    // 创建blob对象
    const blob = new Blob([markdown], { type: 'text/markdown' });
    
    // 文件名处理：避免非法字符
    const fileName = `${title.replace(/[<>:"/\\|?*]/g, '_')}_${id.substring(0, 8)}.md`;
    
    // 使用Chrome下载API导出
    chrome.downloads.download({
      url: URL.createObjectURL(blob),
      filename: `ChatNest/${fileName}`,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('导出失败:', chrome.runtime.lastError);
        alert(`导出失败: ${chrome.runtime.lastError.message}`);
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error('导出过程中发生错误:', error);
    return { success: false, error };
  }
};

// 处理多个对话的批量导出
const handleBatchExport = async (conversations) => {
  // 创建ZIP文件
  try {
    // 检查是否有JSZip库
    if (typeof JSZip === 'undefined') {
      alert('需要JSZip库来批量导出！请确保已经加载。');
      return { success: false, error: new Error('JSZip库未加载') };
    }
    
    const zip = new JSZip();
    const folder = zip.folder("ChatNest");
    
    // 获取每个对话的Markdown内容
    let completed = 0;
    const total = conversations.length;
    
    for (const conv of conversations) {
      try {
        // 从background获取完整对话
        const conversation = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { action: 'getConversation', id: conv.id },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else if (response.error) {
                reject(new Error(response.error));
              } else {
                resolve(response.conversation);
              }
            }
          );
        });
        
        // 获取Markdown内容
        const markdown = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { action: 'conversationToMarkdown', conversation },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(response.markdown);
              }
            }
          );
        });
        
        // 文件名处理
        const fileName = `${conversation.title.replace(/[<>:"/\\|?*]/g, '_')}_${conversation.id.substring(0, 8)}.md`;
        
        // 添加到ZIP
        folder.file(fileName, markdown);
        
        // 更新进度
        completed++;
        const percent = Math.round((completed / total) * 100);
        setProgress(percent);
      } catch (error) {
        console.error(`处理对话 ${conv.id} 时出错:`, error);
        // 继续处理其他对话
      }
    }
    
    // 生成ZIP文件并下载
    const content = await zip.generateAsync({ type: 'blob' });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    
    chrome.downloads.download({
      url: URL.createObjectURL(content),
      filename: `ChatNest_Export_${timestamp}.zip`,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('ZIP导出失败:', chrome.runtime.lastError);
        alert(`ZIP导出失败: ${chrome.runtime.lastError.message}`);
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error('批量导出过程中发生错误:', error);
    setProgress(0);
    alert(`批量导出失败: ${error.message}`);
    return { success: false, error };
  }
};

// 处理所有对话的导出
const handleExportAll = async (exportedConversations) => {
  try {
    // 如果没有选中的对话，则提示用户
    if (exportedConversations.length === 0) {
      alert('没有可导出的对话！');
      return;
    }
    
    // 询问是否批量导出成ZIP
    if (exportedConversations.length > 1) {
      const useZip = confirm(`您选择了 ${exportedConversations.length} 个对话，是否批量导出为ZIP文件？\n\n点击"确定"进行批量导出\n点击"取消"将分别导出每个对话`);
      
      if (useZip) {
        return handleBatchExport(exportedConversations);
      }
    }
    
    // 单个导出
    setProgress(0);
    let completed = 0;
    const total = exportedConversations.length;
    
    const results = [];
    
    for (const conv of exportedConversations) {
      try {
        // 从background获取完整对话
        const conversation = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { action: 'getConversation', id: conv.id },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else if (response.error) {
                reject(new Error(response.error));
              } else {
                resolve(response.conversation);
              }
            }
          );
        });
        
        // 获取Markdown内容
        const markdown = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { action: 'conversationToMarkdown', conversation },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(response.markdown);
              }
            }
          );
        });
        
        // 执行导出
        const result = handleExport(conversation.id, conversation.title || '未命名对话', markdown);
        results.push(result);
        
        // 更新进度
        completed++;
        const percent = Math.round((completed / total) * 100);
        setProgress(percent);
      } catch (error) {
        console.error(`处理对话 ${conv.id} 时出错:`, error);
        results.push({ success: false, error });
      }
    }
    
    // 显示导出结果
    const succeeded = results.filter(r => r.success).length;
    
    if (succeeded === total) {
      alert(`全部 ${total} 个对话导出成功！`);
    } else {
      alert(`${succeeded} 个对话导出成功，${total - succeeded} 个失败。\n请查看控制台了解详细错误信息。`);
    }
    
    return { success: succeeded > 0, totalSuccess: succeeded, totalFailed: total - succeeded };
  } catch (error) {
    console.error('导出全部对话时发生错误:', error);
    setProgress(0);
    alert(`导出失败: ${error.message}`);
    return { success: false, error };
  }
};

// 渲染导出列表
const renderExportList = (exportedConversations) => {
  const listContainer = document.getElementById('export-list');
  listContainer.innerHTML = '';
  
  // 如果没有对话，显示提示
  if (exportedConversations.length === 0) {
    listContainer.innerHTML = '<div class="empty-list">没有符合条件的对话</div>';
    return;
  }
  
  // 按平台分组
  const groupedByPlatform = {};
  
  exportedConversations.forEach(conv => {
    if (!groupedByPlatform[conv.platform]) {
      groupedByPlatform[conv.platform] = [];
    }
    groupedByPlatform[conv.platform].push(conv);
  });
  
  // 为每个平台创建分组
  for (const platform in groupedByPlatform) {
    // 平台标题
    const platformTitle = document.createElement('div');
    platformTitle.className = 'platform-title';
    platformTitle.textContent = platform;
    listContainer.appendChild(platformTitle);
    
    // 对话列表
    const conversations = groupedByPlatform[platform];
    
    conversations.forEach(conv => {
      const item = document.createElement('div');
      item.className = 'export-item';
      
      // 标题部分
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = conv.title || '未命名对话';
      
      // 时间部分
      const time = document.createElement('div');
      time.className = 'time';
      time.textContent = new Date(conv.timestamp).toLocaleString();
      
      // 将标题和时间添加到项目中
      item.appendChild(title);
      item.appendChild(time);
      
      // 添加点击事件
      item.addEventListener('click', () => {
        // 从background获取完整对话
        chrome.runtime.sendMessage(
          { action: 'getConversation', id: conv.id },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('获取对话失败:', chrome.runtime.lastError);
              alert(`获取对话失败: ${chrome.runtime.lastError.message}`);
              return;
            }
            
            if (response.error) {
              console.error('获取对话失败:', response.error);
              alert(`获取对话失败: ${response.error}`);
              return;
            }
            
            // 获取Markdown内容
            chrome.runtime.sendMessage(
              { action: 'conversationToMarkdown', conversation: response.conversation },
              (markdownResponse) => {
                // 执行导出
                handleExport(conv.id, conv.title || '未命名对话', markdownResponse.markdown);
              }
            );
          }
        );
      });
      
      listContainer.appendChild(item);
    });
  }
};

// 获取对话列表
const fetchConversations = async () => {
  try {
    showDebugInfo('开始获取对话列表');
    const { platform, keyword } = exportData;
    showDebugInfo(`获取参数：平台=${platform}, 关键词=${keyword}`);
    
    // 更新DOM中的状态信息
    const statusMsg = document.getElementById('status-message');
    if (statusMsg) {
      statusMsg.textContent = '正在加载对话内容...';
    }
    
    // 显示加载状态
    document.getElementById('export-list').innerHTML = '<div class="loading">加载中...</div>';
    
    // 发送消息到背景脚本获取对话索引
    chrome.runtime.sendMessage(
      { 
        action: platform === 'all' ? 'getAllConversations' : 'getConversationsByPlatform', 
        platform 
      },
      (response) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          showDebugInfo(`获取对话列表失败: ${errorMsg}`, true);
          document.getElementById('export-list').innerHTML = `<div class="error">获取对话列表失败: ${errorMsg}</div>`;
          if (statusMsg) statusMsg.textContent = '加载失败，请返回重试';
          return;
        }
        
        showDebugInfo(`收到后台响应: ${JSON.stringify(response)}`);
        
        if (!response || response.error) {
          const errorMsg = response ? response.error : '未收到有效响应';
          showDebugInfo(`获取对话列表失败: ${errorMsg}`, true);
          document.getElementById('export-list').innerHTML = `<div class="error">获取对话列表失败: ${errorMsg}</div>`;
          if (statusMsg) statusMsg.textContent = '加载失败，请返回重试';
          return;
        }
        
        // 检查响应格式
        let conversations = [];
        if (response.conversations) {
          conversations = response.conversations;
        } else if (response.data) {
          conversations = response.data;
        } else if (Array.isArray(response)) {
          conversations = response;
        }
        
        showDebugInfo(`解析对话数据成功，共 ${conversations.length} 个对话`);
        
        // 过滤对话列表（如果有关键词）
        let filteredConversations = conversations;
        
        if (keyword) {
          const lowerKeyword = keyword.toLowerCase();
          filteredConversations = filteredConversations.filter(conv => 
            (conv.title && conv.title.toLowerCase().includes(lowerKeyword)) || 
            (conv.summary && conv.summary.toLowerCase().includes(lowerKeyword))
          );
          showDebugInfo(`关键词过滤后剩余 ${filteredConversations.length} 个对话`);
        }
        
        // 更新全局数据
        exportData.conversations = filteredConversations;
        
        // 更新状态消息
        if (statusMsg) {
          if (filteredConversations.length > 0) {
            statusMsg.textContent = `找到 ${filteredConversations.length} 个对话`;
          } else {
            statusMsg.textContent = '没有找到匹配的对话';
          }
        }
        
        // 渲染列表
        renderExportList(filteredConversations);
      }
    );
  } catch (error) {
    showDebugInfo(`获取对话列表时发生错误: ${error.message}`, true);
    document.getElementById('export-list').innerHTML = `<div class="error">获取对话列表失败: ${error.message}</div>`;
    const statusMsg = document.getElementById('status-message');
    if (statusMsg) statusMsg.textContent = '发生错误，请返回重试';
  }
};

// 添加调试信息功能
function showDebugInfo(message, isError = false) {
  console.log(`[导出页面] ${message}`);
  
  // 创建调试信息元素（如果不存在）
  if (!document.getElementById('debug-info')) {
    const debugInfo = document.createElement('div');
    debugInfo.id = 'debug-info';
    debugInfo.innerHTML = '<h3>调试信息</h3><div id="debug-content"></div>';
    document.body.appendChild(debugInfo);
  }
  
  // 显示调试区域
  document.getElementById('debug-info').style.display = 'block';
  
  // 添加消息
  const debugContent = document.getElementById('debug-content');
  const messageElement = document.createElement('p');
  messageElement.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
  
  if (isError) {
    messageElement.style.color = '#e74c3c';
  }
  
  debugContent.appendChild(messageElement);
  debugContent.scrollTop = debugContent.scrollHeight;
}

// 添加tabs.onMessage监听
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  showDebugInfo(`全局收到消息: ${JSON.stringify(message)}`);
  
  if (message.type === 'EXPORT_CONVERSATIONS') {
    showDebugInfo(`全局收到导出请求，对话数: ${message.data?.conversations?.length || 0}`);
    
    if (message.data && message.data.conversations) {
      exportData = message.data;
      renderExportList(exportData.conversations);
      sendResponse({ success: true });
    } else {
      showDebugInfo('收到的导出数据无效', true);
      sendResponse({ success: false, error: '无效数据' });
    }
    return true;
  }
});

// 初始化事件监听
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('导出页面初始化...');
    showDebugInfo('开始加载导出数据...');
    
    // 获取导出对话列表
    const conversations = await fetchConversations();
    showDebugInfo(`成功加载 ${conversations.length} 个对话`);
    
    // 设置平台筛选器
    initPlatformFilter(conversations);
    
    // 设置关键词搜索
    initKeywordFilter(conversations);
    
    // 导出所有按钮
    const exportAllButton = document.getElementById('export-all');
    if (exportAllButton) {
      exportAllButton.addEventListener('click', () => {
        showDebugInfo('开始批量导出所有对话...');
        
        // 应用当前筛选条件
        const filteredConversations = conversations.filter(conversation => {
          // 平台筛选
          if (currentPlatform !== 'all' && conversation.platform !== currentPlatform) {
            return false;
          }
          
          // 关键词筛选
          if (currentKeyword && !conversation.title.toLowerCase().includes(currentKeyword.toLowerCase())) {
            return false;
          }
          
          return true;
        });
        
        if (filteredConversations.length === 0) {
          showDebugInfo('没有符合条件的对话可导出', true);
          alert('没有符合条件的对话可导出');
          return;
        }
        
        showDebugInfo(`准备导出 ${filteredConversations.length} 个对话`);
        handleExportAll(filteredConversations);
      });
    }
    
    // 返回按钮
    // 注释掉返回按钮代码
    /* 
    const backButton = document.getElementById('back-button');
    if (backButton) {
      backButton.addEventListener('click', () => {
        window.close();
      });
    }
    */
    
    // 渲染导出列表
    updateStatus(`已加载 ${conversations.length} 个对话，可以开始导出`);
    renderExportList(conversations);
    showDebugInfo('导出页面初始化完成');
  } catch (error) {
    console.error('初始化导出页面失败:', error);
    showDebugInfo(`初始化导出页面失败: ${error.message}`, true);
    updateStatus(`加载失败: ${error.message}`, true);
  }
}); 