/**
 * ChatNest - DeepSeek平台内容提取器
 * 负责从DeepSeek聊天页面提取对话内容
 */

(() => {
  // 确保主内容脚本已加载
  if (!window.ChatNest) {
    console.error('ChatNest主内容脚本未加载');
    return;
  }

  // 防抖函数
  const debounce = (func, wait) => {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  };

  // 提取对话标题
  const extractTitle = () => {
    // 尝试多种可能的选择器定位标题元素
    const selectors = [
      // 可能的标题选择器
      '.chat-title',
      'h1.title',
      '.conversation-header h1',
      '.header-title',
      // 以对话ID为基础的标题（如果没有明确标题）
      'h1',
      'title'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    // 如果无法找到标题，从URL中提取ID作为标题
    const urlParts = window.location.pathname.split('/');
    const idFromUrl = urlParts[urlParts.length - 1];
    
    return idFromUrl ? `DeepSeek对话 ${idFromUrl}` : '未命名对话';
  };

  // 提取对话内容
  const extractConversation = () => {
    // 尝试多种可能的选择器定位对话元素
    const messageSelectors = [
      // 可能的消息容器选择器
      '.message-container',
      '.chat-message',
      '.message-item',
      '.conversation-message',
      '.message'
    ];

    let messageElements = [];
    
    // 尝试找到消息元素
    for (const selector of messageSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements && elements.length > 0) {
        messageElements = elements;
        break;
      }
    }
    
    const messages = [];
    
    // 提取消息
    messageElements.forEach(element => {
      // 尝试多种方式确定消息类型
      let isUser = false;
      
      // 通过类名判断
      if (element.classList.contains('user-message') || 
          element.classList.contains('user') || 
          element.classList.contains('human')) {
        isUser = true;
      }
      
      // 通过数据属性判断
      if (element.getAttribute('data-role') === 'user' || 
          element.getAttribute('data-sender') === 'user') {
        isUser = true;
      }
      
      // 通过子元素判断（如头像或标签）
      const userIndicator = element.querySelector('.user-avatar, .user-indicator, .human-avatar');
      if (userIndicator) {
        isUser = true;
      }
      
      // 提取消息内容（尝试多个可能的选择器）
      const contentSelectors = [
        '.message-content',
        '.content',
        '.text',
        '.message-text',
        'p'
      ];
      
      let content = '';
      
      for (const selector of contentSelectors) {
        const contentElement = element.querySelector(selector);
        if (contentElement && contentElement.textContent.trim()) {
          content = contentElement.textContent.trim();
          break;
        }
      }
      
      // 如果没有通过选择器找到内容，尝试直接获取元素文本
      if (!content) {
        content = element.textContent.trim();
      }
      
      // 只有当有内容时才添加消息
      if (content) {
        messages.push({
          role: isUser ? 'user' : 'assistant',
          content: content
        });
      }
    });
    
    return messages;
  };

  // 创建对话记录对象
  const createConversationObject = () => {
    const platform = window.ChatNest.determinePlatform();
    const id = window.ChatNest.getConversationIdFromUrl();
    const title = extractTitle();
    const messages = extractConversation();
    
    // 只有当有消息时才创建对话对象
    if (messages.length === 0) {
      throw new Error('未找到对话内容');
    }
    
    return {
      id,
      platform,
      title,
      url: window.location.href,
      timestamp: Date.now(),
      messages
    };
  };

  // 保存当前对话
  const saveCurrentConversation = async () => {
    try {
      // 首先检查自动提取对话功能是否启用
      const autoExtractEnabled = await window.ChatNest.getAutoExtractEnabled();
      if (!autoExtractEnabled) {
        console.log('自动提取对话功能已关闭，跳过提取');
        return;
      }
      
      const conversation = createConversationObject();
      await window.ChatNest.saveConversation(conversation);
      console.log('DeepSeek对话已保存:', conversation.title);
    } catch (error) {
      console.error('保存DeepSeek对话失败:', error);
    }
  };

  // 使用防抖的保存函数
  const debouncedSave = debounce(saveCurrentConversation, 1000);

  // 监听页面变化
  const observePageChanges = () => {
    // 首先检查自动提取对话功能是否启用
    window.ChatNest.getAutoExtractEnabled().then(autoExtractEnabled => {
      if (!autoExtractEnabled) {
        console.log('自动提取对话功能已关闭，不进行页面监听');
        return;
      }
      
      // 更新选择器以匹配DeepSeek网站的DOM结构
      const containerSelectors = [
        '.chat-container',
        '.conversation-container',
        '.messages-container',
        '.conversation-messages',
        '[class*="chat"]',
        '[class*="message"]',
        'main',
        '#__next',
        'body'  // 如果找不到特定容器，监听整个body
      ];
      
      let chatContainer = null;
      
      // 尝试找到聊天容器
      for (const selector of containerSelectors) {
        const container = document.querySelector(selector);
        if (container) {
          chatContainer = container;
          break;
        }
      }
      
      if (!chatContainer) {
        console.error('无法找到聊天容器');
        return;
      }
      
      // 使用MutationObserver监听页面变化
      const observer = new MutationObserver(mutations => {
        // 当页面内容变化时，使用防抖函数延迟保存
        debouncedSave();
      });
      
      // 监听容器变化
      observer.observe(chatContainer, { 
        childList: true, 
        subtree: true,
        characterData: true
      });
      
      console.log('已开始监听页面变化');
    });
  };

  // 初始化
  const init = () => {
    console.log('ChatNest DeepSeek提取器已加载');
    
    // 获取并显示自动提取状态
    window.ChatNest.getAutoExtractEnabled().then(enabled => {
      const statusText = enabled ? '已启用' : '已禁用';
      console.log(`DeepSeek提取器（自动提取${statusText}）`);
    });
    
    // 页面加载完成后立即开始执行
    const startExtractor = async () => {
      // 检查自动提取是否启用
      const autoExtractEnabled = await window.ChatNest.getAutoExtractEnabled();
      if (!autoExtractEnabled) {
        console.log('自动提取对话功能已关闭，不启动提取器');
        return;
      }
      
      // 延迟一小段时间，确保DOM已加载
      setTimeout(() => {
        try {
          console.log('立即尝试保存对话...');
          saveCurrentConversation();
        } catch (error) {
          console.warn('初次保存失败，可能页面尚未完全加载', error);
        }
        
        // 设置更长的延迟再次尝试
        setTimeout(() => {
          console.log('再次尝试保存对话...');
          saveCurrentConversation();
          observePageChanges();
        }, 3000);
      }, 1000);
    };
    
    // 页面加载完成后立即开始执行
    if (document.readyState === 'complete') {
      startExtractor();
    } else {
      window.addEventListener('load', startExtractor);
    }
  };

  // 启动提取器
  init();
})(); 