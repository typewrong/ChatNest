/**
 * ChatNest 弹出窗口脚本
 * 负责展示对话列表和处理用户交互
 */

// 立即输出加载日志，确认脚本已加载
console.log('============ ChatNest 弹出窗口脚本加载 ============');

// 在页面上显示调试信息的函数 - 修改为仅输出到控制台
const showDebugInfo = (message, isError = false) => {
  // 移除在页面上显示调试信息的代码，仅保留控制台输出
  // 同时输出到控制台
  if (isError) {
    console.error(message);
  } else {
    console.log(message);
  }
};

// 禁用调试模式
const enableDebugMode = () => {
  // 在生产环境中不启用调试模式
  return;
};

// 当前选中的平台
let currentPlatform = 'all';
// 当前搜索关键词
let searchKeyword = '';
// 对话列表数据
let conversations = [];

// 输出页面环境信息
showDebugInfo(`页面环境检查 - URL: ${window.location.href}`);
showDebugInfo(`扩展ID: ${chrome.runtime.id}`);

// 格式化日期
const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 渲染对话列表
const renderConversationList = (conversations) => {
  try {
    const listElement = document.getElementById('conversation-list');
    if (!listElement) {
      return;
    }
    
    // 过滤对话列表
    const filteredConversations = conversations.filter(conversation => {
      // 确保对话对象有效
      if (!conversation || typeof conversation !== 'object') {
        return false;
      }
      
      try {
        // 平台过滤
        const platformMatch = currentPlatform === 'all' || conversation.platform === currentPlatform;
        
        // 关键词搜索
        const keywordMatch = searchKeyword === '' || 
          (conversation.title && conversation.title.toLowerCase().includes(searchKeyword.toLowerCase()));
        
        return platformMatch && keywordMatch;
      } catch (filterError) {
        return false;
      }
    });
    
    // 清空列表
    listElement.innerHTML = '';
    
    // 如果没有对话，显示空状态
    if (filteredConversations.length === 0) {
      listElement.innerHTML = `
        <div class="empty-state">
          <p>暂无对话记录</p>
        </div>
      `;
      return;
    }
    
    // 渲染对话列表
    filteredConversations.forEach((conversation, index) => {
      try {
        const itemElement = document.createElement('div');
        itemElement.className = 'conversation-item';
        
        // 如果是临时对话，添加特殊样式
        if (conversation.isTemporary) {
          itemElement.classList.add('temporary');
        }
        
        itemElement.dataset.id = conversation.id;
        itemElement.dataset.url = conversation.url || '';
        
        // 平台标识样式
        const platformClass = conversation.platform === 'deepseek' ? 'deepseek' : 'doubao';
        const platformName = conversation.platform === 'deepseek' ? 'DeepSeek' : '豆包';
        
        // 确保标题有效
        const title = conversation.title || '未命名对话';
        const timestamp = conversation.timestamp || Date.now();
        
        // 添加导出按钮
        itemElement.innerHTML = `
          <div class="conversation-title">${title}</div>
          <div class="conversation-meta">
            <span class="platform-badge ${platformClass}">${platformName}</span>
            <span class="conversation-date">${formatDate(timestamp)}</span>
            <button class="export-button" title="导出对话">导出</button>
          </div>
        `;
        
        // 点击对话项打开原始对话页面
        itemElement.addEventListener('click', (e) => {
          // 如果点击的是导出按钮，则不打开对话页面
          if (e.target.classList.contains('export-button')) {
            return;
          }
          
          if (conversation.url) {
            chrome.tabs.create({ url: conversation.url });
          } else {
            alert('无法打开此对话，URL不可用');
          }
        });
        
        // 为导出按钮添加点击事件
        const exportButton = itemElement.querySelector('.export-button');
        if (exportButton) {
          exportButton.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            exportSingleConversation(conversation);
          });
        }
        
        listElement.appendChild(itemElement);
      } catch (renderItemError) {
        console.error(`渲染对话项失败:`, renderItemError);
      }
    });
  } catch (renderError) {
    console.error('渲染对话列表失败:', renderError);
    
    // 尝试恢复显示
    try {
      const listElement = document.getElementById('conversation-list');
      if (listElement) {
        listElement.innerHTML = `
          <div class="empty-state error-state">
            <p>渲染对话列表时出错</p>
            <p>错误信息: ${renderError.message}</p>
          </div>
        `;
      }
    } catch (recoveryError) {
      console.error('恢复显示失败:', recoveryError);
    }
  }
};

// 从chrome.storage.local加载临时保存的对话
const loadTemporaryConversations = () => {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(null, (items) => {
        if (chrome.runtime.lastError) {
          console.error('获取临时对话失败:', chrome.runtime.lastError);
          resolve([]);
          return;
        }
        
        const tempConversations = [];
        const tempKeys = Object.keys(items).filter(key => key.startsWith('chatnest_temp_'));
        
        tempKeys.forEach(key => {
          try {
            const conversationData = items[key];
            
            // 为临时对话添加标记
            conversationData.isTemporary = true;
            tempConversations.push({
              id: conversationData.id,
              platform: conversationData.platform,
              title: conversationData.title || '未命名对话',
              timestamp: conversationData.timestamp,
              url: conversationData.url,
              isTemporary: true
            });
          } catch (parseError) {
            console.error('处理临时对话数据失败:', parseError);
          }
        });
        
        resolve(tempConversations);
      });
    } catch (error) {
      console.error('加载临时对话失败:', error);
      resolve([]);
    }
  });
};

// 恢复临时对话
const recoverTemporaryConversation = (tempConversation) => {
  return new Promise((resolve, reject) => {
    try {
      // 从chrome.storage.local中获取完整的对话数据
      const key = `chatnest_temp_${tempConversation.id}`;
      
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`获取临时对话失败: ${chrome.runtime.lastError.message}`));
          return;
        }
        
        const parsedData = result[key];
        
        if (!parsedData) {
          reject(new Error(`找不到临时对话数据: ${tempConversation.id}`));
          return;
        }
        
        // 发送保存请求，使用安全的消息发送方式
        sendMessageSafely(
          { 
            type: 'SAVE_CONVERSATION', 
            conversation: parsedData 
          },
          response => {
            if (response && response.success) {
              // 删除chrome.storage.local中的临时数据
              chrome.storage.local.remove(key, () => {
                if (chrome.runtime.lastError) {
                  console.error(`删除临时对话数据失败: ${chrome.runtime.lastError.message}`);
                }
              });
              resolve();
            } else {
              const error = response ? response.error : '未知错误';
              reject(new Error(error));
            }
          }
        );
      });
    } catch (error) {
      reject(error);
    }
  });
};

// 安全地发送消息的包装函数
const sendMessageSafely = (message, callback) => {
  try {
    // 检查扩展是否有效
    if (!chrome || !chrome.runtime) {
      console.error('扩展上下文无效，无法发送消息');
      if (callback) {
        callback({ success: false, error: 'Extension context invalidated' });
      }
      return;
    }
    
    // 尝试发送消息
    chrome.runtime.sendMessage(message, (response) => {
      // 检查runtime错误
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

// 加载对话列表 - 使用安全的消息发送方式
const loadConversations = async () => {
  // 显示加载状态
  document.getElementById('conversation-list').innerHTML = `
    <div class="loading-state">
      <p>加载中...</p>
    </div>
  `;
  
  try {
    // 先加载临时对话
    const tempConversations = await loadTemporaryConversations();
    
    // 使用安全的方式获取对话元数据
    sendMessageSafely(
      { type: 'GET_CONVERSATION_INDEX' },
      response => {
        try {
          if (response && response.success) {
            // 合并临时对话和持久化对话
            const validData = Array.isArray(response.data) ? response.data : [];
            conversations = [...tempConversations, ...validData];
            
            if (conversations.length > 0) {
              // 渲染对话列表
              renderConversationList(conversations);
            } else {
              // 如果没有对话（包括临时对话），显示空状态
              document.getElementById('conversation-list').innerHTML = `
                <div class="empty-state">
                  <p>暂无对话记录</p>
                  <p>在豆包或DeepSeek进行对话后将自动保存</p>
                </div>
              `;
            }
            
            if (tempConversations.length > 0) {
              const recoverBanner = document.createElement('div');
              recoverBanner.className = 'recover-banner';
              recoverBanner.innerHTML = `
                <p>发现${tempConversations.length}条未保存的对话。</p>
                <button id="recover-all-button">全部恢复</button>
              `;
              
              const container = document.querySelector('.container');
              if (container) {
                container.prepend(recoverBanner);
                
                // 添加恢复按钮点击事件
                const recoverButton = document.getElementById('recover-all-button');
                if (recoverButton) {
                  recoverButton.addEventListener('click', async () => {
                    try {
                      // 禁用按钮，显示恢复中
                      recoverButton.disabled = true;
                      recoverButton.textContent = '恢复中...';
                      
                      // 逐个恢复临时对话
                      for (const tempConv of tempConversations) {
                        try {
                          await recoverTemporaryConversation(tempConv);
                        } catch (e) {
                          console.error('恢复临时对话失败:', e);
                        }
                      }
                      
                      // 重新加载对话列表
                      loadConversations();
                    } catch (error) {
                      console.error('批量恢复临时对话失败:', error);
                      alert('部分对话恢复失败，请稍后再试');
                    }
                  });
                }
              }
            }
          } else {
            // 只显示临时对话
            if (tempConversations.length > 0) {
              conversations = tempConversations;
              renderConversationList(conversations);
              
              // 显示无法连接后台的错误
              const errorBanner = document.createElement('div');
              errorBanner.className = 'error-banner';
              errorBanner.innerHTML = `
                <p>无法连接到扩展后台，只显示临时保存的对话。</p>
                <p>请尝试重新加载扩展。</p>
                <button id="reload-extension-error" class="action-button">重新加载扩展</button>
              `;
              
              const container = document.querySelector('.container');
              if (container) {
                container.prepend(errorBanner);
                
                // 添加重新加载扩展按钮
                const reloadButton = document.getElementById('reload-extension-error');
                if (reloadButton) {
                  reloadButton.addEventListener('click', () => {
                    chrome.runtime.reload();
                  });
                }
              }
            } else {
              // 显示错误状态
              document.getElementById('conversation-list').innerHTML = `
                <div class="empty-state error-state">
                  <p>加载对话列表失败</p>
                  <p>请尝试重新加载扩展</p>
                  <button id="reload-extension" class="action-button">重新加载扩展</button>
                </div>
              `;
              
              // 添加重新加载扩展按钮
              const reloadButton = document.getElementById('reload-extension');
              if (reloadButton) {
                reloadButton.addEventListener('click', () => {
                  chrome.runtime.reload();
                });
              }
            }
          }
        } catch (renderError) {
          console.error('处理或渲染对话数据时出错:', renderError);
          document.getElementById('conversation-list').innerHTML = `
            <div class="empty-state error-state">
              <p>处理对话数据时出错</p>
              <p>错误信息: ${renderError.message}</p>
              <button id="reload-extension-render" class="action-button">重新加载扩展</button>
            </div>
          `;
          
          // 添加重新加载扩展按钮
          document.getElementById('reload-extension-render')?.addEventListener('click', () => {
            chrome.runtime.reload();
          });
        }
      }
    );
  } catch (error) {
    console.error('加载对话失败:', error);
    document.getElementById('conversation-list').innerHTML = `
      <div class="empty-state error-state">
        <p>加载对话列表时发生错误</p>
        <p>错误信息: ${error.message}</p>
        <button id="reload-extension-error" class="action-button">重新加载扩展</button>
      </div>
    `;
    
    // 添加重新加载扩展按钮
    document.getElementById('reload-extension-error')?.addEventListener('click', () => {
      chrome.runtime.reload();
    });
  }
};

// 修改单个对话导出函数
const exportSingleConversation = async (conversation) => {
  try {
    // 从background获取完整对话 - 使用Promise包装sendMessageSafely
    const fullConversation = await new Promise((resolve, reject) => {
      sendMessageSafely(
        { action: 'getConversation', id: conversation.id },
        (response) => {
          if (!response || !response.success) {
            reject(new Error(response ? response.error : '获取对话失败'));
          } else {
            resolve(response.conversation);
          }
        }
      );
    });
    
    // 获取Markdown内容 - 使用Promise包装sendMessageSafely
    const markdown = await new Promise((resolve, reject) => {
      sendMessageSafely(
        { action: 'conversationToMarkdown', conversation: fullConversation },
        (response) => {
          if (!response || !response.success) {
            reject(new Error(response ? response.error : '生成Markdown失败'));
          } else {
            resolve(response.markdown);
          }
        }
      );
    });
    
    // 创建blob对象
    const blob = new Blob([markdown], { type: 'text/markdown' });
    
    // 文件名处理：避免非法字符
    const title = fullConversation.title || '未命名对话';
    const fileName = `${title.replace(/[<>:"/\\|?*]/g, '_')}_${fullConversation.id.substring(0, 8)}.md`;
    
    // 使用Chrome下载API导出
    chrome.downloads.download({
      url: URL.createObjectURL(blob),
      filename: `ChatNest/${fileName}`,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error(`导出失败: ${chrome.runtime.lastError.message}`);
        alert(`导出失败: ${chrome.runtime.lastError.message}`);
      } else {
        console.log('对话导出成功');
      }
    });
  } catch (error) {
    console.error('导出单个对话失败:', error);
    alert('导出失败: ' + error.message);
  }
};

// 导出多个对话（原有的导出功能，重命名为exportMultipleConversations）
const exportMultipleConversations = async () => {
  try {
    showDebugInfo('准备直接导出所有对话...');
    
    // 首先确保我们有最新的对话数据
    showDebugInfo('获取最新对话数据...');
    
    try {
      const response = await new Promise((resolve, reject) => {
        sendMessageSafely(
          { type: 'GET_CONVERSATION_INDEX' },
          response => {
            if (!response || !response.success) {
              reject(new Error('获取对话索引失败'));
              return;
            }
            resolve(response);
          }
        );
      });
      
      if (response && response.success) {
        showDebugInfo(`成功获取到 ${response.data.length} 个对话索引`);
        conversations = response.data;
      } else {
        showDebugInfo('获取对话索引失败，使用当前缓存的数据', true);
      }
    } catch (error) {
      showDebugInfo(`获取对话索引出错: ${error.message}`, true);
    }
    
    // 获取当前过滤后的对话列表
    const filteredConversations = conversations.filter(conversation => {
      const platformMatch = currentPlatform === 'all' || conversation.platform === currentPlatform;
      const keywordMatch = searchKeyword === '' || 
        (conversation.title && conversation.title.toLowerCase().includes(searchKeyword.toLowerCase()));
      return platformMatch && keywordMatch;
    });
    
    if (filteredConversations.length === 0) {
      showDebugInfo('没有可导出的对话', true);
      // 不显示警告，直接返回
      return;
    }
    
    showDebugInfo(`准备直接导出 ${filteredConversations.length} 个对话`);
    
    // 自动决定导出方式，多个对话自动使用ZIP，单个对话直接导出
    if (filteredConversations.length > 1) {
      // 直接批量导出成ZIP，无需确认
      // 使用已加载的JSZip库
      if (typeof JSZip === 'undefined') {
        showDebugInfo('找不到JSZip库，请确保页面已正确加载JSZip', true);
        console.error('导出失败: 找不到JSZip库');
        return;
      }
      
      const zip = new JSZip();
      const folder = zip.folder("ChatNest");
      
      // 获取每个对话的Markdown内容
      let completed = 0;
      const total = filteredConversations.length;
      
      for (const conv of filteredConversations) {
        try {
          // 从background获取完整对话
          const conversation = await new Promise((resolve, reject) => {
            sendMessageSafely(
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
            sendMessageSafely(
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
          const title = conversation.title || '未命名对话';
          const fileName = `${title.replace(/[<>:"/\\|?*]/g, '_')}_${conversation.id.substring(0, 8)}.md`;
          
          // 添加到ZIP
          folder.file(fileName, markdown);
          
          // 更新进度
          completed++;
          showDebugInfo(`已处理 ${completed}/${total} 个对话`);
        } catch (error) {
          console.error(`处理对话 ${conv.id} 时出错:`, error);
          // 继续处理其他对话
        }
      }
      
      // 生成ZIP文件并下载
      showDebugInfo('正在生成ZIP文件...');
      const content = await zip.generateAsync({ type: 'blob' });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      
      chrome.downloads.download({
        url: URL.createObjectURL(content),
        filename: `ChatNest_Export_${timestamp}.zip`,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error(`ZIP导出失败: ${chrome.runtime.lastError.message}`);
          // 不显示导出失败提示，只在控制台输出错误
        } else {
          showDebugInfo('ZIP导出成功');
          // 不显示成功提示对话框
        }
      });
    } else if (filteredConversations.length === 1) {
      // 只有一个对话，直接导出
      await exportSingleConversation(filteredConversations[0]);
    }
  } catch (error) {
    console.error('导出对话失败:', error);
    // 不显示错误对话框，只在控制台输出错误
  }
};

// 将原有的exportConversations重命名为exportMultipleConversations，保持代码不变
const exportConversations = exportMultipleConversations;

// 删除对话
const deleteConversation = (id) => {
  if (confirm('确定要删除此对话吗？此操作无法撤销。')) {
    sendMessageSafely(
      { type: 'DELETE_CONVERSATION', id },
      response => {
        if (response && response.success) {
          // 从本地数组中删除
          conversations = conversations.filter(conv => conv.id !== id);
          renderConversationList(conversations);
        } else {
          console.error('删除对话失败:', response ? response.error : '未知错误');
          alert('删除对话失败');
        }
      }
    );
  }
};

// 初始化事件监听
const initEventListeners = () => {
  showDebugInfo('初始化事件监听...');
  
  // 平台切换标签
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      currentPlatform = button.dataset.platform;
      showDebugInfo(`切换平台: ${currentPlatform}`);
      document.querySelectorAll('.tab-button').forEach(b => {
        b.classList.remove('active');
      });
      button.classList.add('active');
      renderConversationList(conversations);
    });
  });
  
  // 搜索框
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchKeyword = searchInput.value.trim();
      showDebugInfo(`搜索关键词: ${searchKeyword}`);
      renderConversationList(conversations);
    });
  }
  
  // 导出按钮
  const exportButton = document.getElementById('export-button');
  if (exportButton) {
    exportButton.addEventListener('click', exportConversations);
  }
  
  // 设置按钮
  const settingsButton = document.getElementById('settings-button');
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
  
  // 自动提取开关
  const autoExtractToggle = document.getElementById('auto-extract-toggle');
  if (autoExtractToggle) {
    // 获取当前设置状态
    chrome.storage.sync.get('autoExtractEnabled', (result) => {
      // 如果设置不存在，默认为true（开启）
      const enabled = result.autoExtractEnabled !== undefined ? result.autoExtractEnabled : true;
      autoExtractToggle.checked = enabled;
      showDebugInfo(`自动提取对话功能状态: ${enabled ? '开启' : '关闭'}`);
    });
    
    // 监听开关变化
    autoExtractToggle.addEventListener('change', () => {
      const enabled = autoExtractToggle.checked;
      
      // 保存设置
      chrome.storage.sync.set({ autoExtractEnabled: enabled }, () => {
        // 通知内容脚本更新设置
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.url && (tab.url.includes('deepseek.com') || tab.url.includes('doubao.com'))) {
              try {
                chrome.tabs.sendMessage(tab.id, { 
                  type: 'UPDATE_AUTO_EXTRACT', 
                  enabled: enabled 
                });
              } catch (error) {
                console.error(`通知标签页 ${tab.id} 失败: ${error.message}`);
              }
            }
          });
        });
      });
    });
  }
};

// 移除CSS路径调试信息
function addCssPathDebug() {
  // 禁用此功能
  return;
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  showDebugInfo('文档加载完成，开始初始化...');
  
  // 加载对话列表
  loadConversations();
  
  // 初始化事件监听
  initEventListeners();
  
  // 不添加CSS路径调试信息
  // addCssPathDebug();
  
  showDebugInfo('初始化完成');
});