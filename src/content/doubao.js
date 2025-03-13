/**
 * ChatNest - 豆包平台内容提取器
 * 负责从豆包聊天页面提取对话内容
 */

(() => {
  // 确保主内容脚本已加载
  if (!window.ChatNest) {
    console.error('ChatNest主内容脚本未加载');
    return;
  }

  // 添加消息显示函数
  const showMessage = (message, type = 'info') => {
    console.log(`ChatNest消息(${type}):`, message);
    
    // 所有消息通知均不显示在页面上，仅保留控制台日志输出
    // 原代码已被移除，不再显示页面通知
  };

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
      '.conversation-title',
      '.chat-title',
      '.session-title',
      'h1.title',
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
    
    return idFromUrl ? `豆包对话 ${idFromUrl}` : '未命名对话';
  };

  // 提取对话内容
  const extractConversation = () => {
    try {
      console.log('开始提取豆包对话内容...');
      
      // 使用多个选择器匹配不同类型的消息容器
      const userContainers = document.querySelectorAll('.container-EC68Od.container-jPfT9u, [class*="container-EC68Od"][class*="container-jPfT9u"]');
      const aiContainers = document.querySelectorAll('.container-ZYIsnH.flow-markdown-body, [class*="container-ZYIsnH"][class*="flow-markdown-body"]');
      
      console.log('找到用户消息容器数量:', userContainers.length);
      console.log('找到AI助手消息容器数量:', aiContainers.length);
      
      // 如果两种容器都没找到，尝试备用选择器
      if (userContainers.length === 0 && aiContainers.length === 0) {
        // 尝试备用选择器
        const backupSelectors = [
          '.message-box-xy4dB8s',
          '[class*="message-box"]',
          '.message-item',
          '.chat-message',
          '.message-container'
        ];
        
        for (const selector of backupSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`使用备用选择器 ${selector} 找到 ${elements.length} 个元素`);
            return extractMessagesFromElements(elements);
          }
        }
        
        // 记录DOM结构以便调试
        console.log('当前页面主要DOM结构:');
        const chatContainer = document.querySelector('.chat-container, [class*="chat"], main, #app');
        console.log(chatContainer ? chatContainer.outerHTML.substring(0, 500) + '...' : 'No chat container found');
        
        throw new Error('未找到对话内容');
      }
      
      // 从两种容器中提取消息
      const userMessages = extractMessagesFromContainers(userContainers, true);
      const aiMessages = extractMessagesFromContainers(aiContainers, false);
      
      // 合并消息并按照DOM顺序排序
      return mergeAndSortMessages(userMessages, aiMessages);
    } catch (error) {
      console.error('提取豆包对话内容时出错:', error);
      throw error;
    }
  };
  
  // 从容器中提取消息
  const extractMessagesFromContainers = (containers, isUser) => {
    const messages = [];
    
    containers.forEach((container, index) => {
      // 添加调试日志
      console.log(`提取${isUser ? '用户' : 'AI'}消息 #${index+1}，容器:`, container);
      
      // 提取消息内容
      let contentElement;
      
      if (isUser) {
        // 用户消息内容提取
        contentElement = container.querySelector(
          '.message-content, [class*="message-content"], [class*="message-box-content"]'
        );
      } else {
        // AI消息内容提取 - 可能包含多个段落或不同格式
        contentElement = container;
      }
      
      let content = '';
      if (contentElement) {
        // 对于AI回复，保留简单格式（保留段落和列表）
        if (!isUser) {
          // 提取文本内容，保留基本结构
          console.log('开始提取AI格式化文本，容器内容预览:', contentElement.innerHTML.substring(0, 200) + '...');
          content = extractFormattedText(contentElement);
          console.log('提取到的AI回复内容:', content.substring(0, 200) + (content.length > 200 ? '...' : ''));
        } else {
          // 用户消息通常是纯文本
          content = contentElement.textContent.trim();
          console.log('提取到的用户消息内容:', content);
        }
      } else {
        // 如果没有找到指定的内容元素，尝试获取容器的文本
        content = container.textContent.trim();
      }
      
      // 只有当有内容时才添加消息
      if (content) {
        const position = getDOMPosition(container);
        messages.push({
          role: isUser ? 'user' : 'assistant',
          content: content,
          position: position // 用于后续排序
        });
      }
    });
    
    return messages;
  };
  
  // 提取格式化文本（保留基本格式如段落、列表等）
  const extractFormattedText = (element) => {
    // 改进的实现：确保捕获所有文本内容，不仅限于特定标签
    console.log('开始提取格式化文本，元素类型:', element.nodeName);

    // 方法1：首先尝试通过递归遍历所有文本节点来提取内容
    const extractAllTextNodes = (node, result = []) => {
      // 如果是文本节点，添加到结果中
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) result.push(text);
      } 
      // 如果是元素节点，检查是否为分隔元素（表示段落分隔）
      else if (node.nodeType === Node.ELEMENT_NODE) {
        // 某些元素自然形成段落分隔
        const isBlockElement = ['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].includes(node.nodeName);
        const isBr = node.nodeName === 'BR';
        
        // 遍历所有子节点
        for (const child of node.childNodes) {
          extractAllTextNodes(child, result);
        }
        
        // 在块级元素或<br>元素后添加额外的换行
        if (isBlockElement || isBr) {
          result.push(''); // 添加一个空字符串，会在join时形成额外的换行
        }
      }
      
      return result;
    };

    try {
      // 尝试从所有文本节点中提取内容
      const allTextParts = extractAllTextNodes(element);
      console.log('从文本节点提取的段落数量:', allTextParts.length);
      if (allTextParts.length > 0) {
        // 合并文本并格式化（移除多余的空行）
        const result = allTextParts.join('\n')
          .replace(/\n{3,}/g, '\n\n') // 将三个以上的换行替换为两个
          .trim();
        console.log('方法1提取结果(前100字符):', result.substring(0, 100) + '...');
        return result;
      }
    } catch (e) {
      console.error('提取所有文本节点时出错:', e);
      // 出错时回退到原始方法
    }
    
    // 方法2：作为备用，尝试通过特定元素提取
    try {
      // 获取所有段落和列表项，扩展选择器范围
      const paragraphs = element.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, blockquote, span, strong, em, b, i, a, code, pre');
      
      if (paragraphs.length > 0) {
        console.log('找到段落元素数量:', paragraphs.length);
        let content = '';
        paragraphs.forEach(p => {
          const text = p.textContent.trim();
          if (text) {
            content += text + '\n\n';
          }
        });
        
        const result = content.trim();
        console.log('方法2提取结果(前100字符):', result.substring(0, 100) + '...');
        return result;
      }
    } catch (e) {
      console.error('提取段落元素时出错:', e);
    }
    
    // 方法3：作为最后的手段，直接返回文本内容
    const finalResult = element.textContent.trim();
    console.log('方法3提取结果(前100字符):', finalResult.substring(0, 100) + '...');
    return finalResult;
  };
  
  // 获取元素在DOM中的位置（用于排序）
  const getDOMPosition = (element) => {
    // 遍历DOM树，找到元素的位置
    let position = 0;
    let current = element;
    
    while (current) {
      if (current.previousElementSibling) {
        current = current.previousElementSibling;
        position++;
      } else {
        current = current.parentElement;
      }
    }
    
    return position;
  };
  
  // 合并和排序消息
  const mergeAndSortMessages = (userMessages, aiMessages) => {
    // 合并两类消息
    const allMessages = [...userMessages, ...aiMessages];
    
    // 按照DOM位置排序（模拟对话顺序）
    allMessages.sort((a, b) => {
      return a.position - b.position;
    });
    
    // 移除position字段返回最终结果
    return allMessages.map(msg => {
      const { position, ...rest } = msg;
      return rest;
    });
  };
  
  // 从旧的元素结构中提取消息（备用方法）
  const extractMessagesFromElements = (elements) => {
    const messages = [];
    
    elements.forEach(element => {
      // 尝试多种方式确定消息类型
      let isUser = false;
      
      // 通过类名判断
      if (element.classList.contains('user-message') || 
          element.classList.contains('user') || 
          element.classList.contains('human') ||
          element.classList.contains('question') ||
          element.classList.toString().includes('reverse')) {
        isUser = true;
      }
      
      // 通过数据属性判断
      if (element.getAttribute('data-role') === 'user' || 
          element.getAttribute('data-sender') === 'user' ||
          element.getAttribute('data-type') === 'question') {
        isUser = true;
      }
      
      // 通过子元素判断（如头像或标签）
      const userIndicator = element.querySelector('.user-avatar, .user-indicator, .human-avatar, .question-indicator');
      if (userIndicator) {
        isUser = true;
      }
      
      // 提取消息内容
      const contentSelectors = [
        '.message-content',
        '[class*="message-content"]',
        '.content',
        '.text',
        '.message-text',
        '.markdown-body',
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
      
      // 检查扩展是否处于有效状态
      if (!window.ChatNest.isExtensionValid()) {
        console.error('扩展上下文已失效，无法保存对话');
        
        // 尝试使用chrome.storage.local临时保存
        try {
          const conversation = createConversationObject();
          const tempKey = `chatnest_temp_${conversation.id}`;
          chrome.storage.local.set({ [tempKey]: conversation }, () => {
            if (chrome.runtime.lastError) {
              console.error('使用chrome.storage.local保存失败:', chrome.runtime.lastError);
              return;
            }
            console.log('已将对话临时保存到chrome.storage.local:', tempKey);
          });
        } catch (localErr) {
          console.error('临时保存失败:', localErr);
        }
        return;
      }
      
      const conversation = createConversationObject();
      
      // 打印更详细的消息内容信息
      console.log(`准备保存对话 (${conversation.messages.length} 条消息):`, 
        conversation.messages.map(m => ({role: m.role, contentPreview: m.content.substring(0, 30)})));
      
      try {
        await window.ChatNest.saveConversation(conversation);
        console.log('豆包对话已保存:', conversation.title);
        // 不再显示成功消息到页面上，仅输出到控制台
      } catch (error) {
        // 处理错误，确保错误对象始终被正确处理
        const errorMessage = error instanceof Error ? error.message : 
                            (typeof error === 'string' ? error : '未知错误');
        
        console.error('保存豆包对话失败:', errorMessage);
        
        // 特殊处理 Extension context invalidated 错误
        if (errorMessage.includes('Extension context invalidated') || 
            errorMessage.includes('扩展上下文已失效')) {
          console.error('扩展上下文已失效，尝试使用备用方法保存');
          
          try {
            const tempKey = `chatnest_temp_${conversation.id}`;
            // 使用chrome.storage.local替代localStorage
            chrome.storage.local.set({ [tempKey]: conversation }, () => {
              if (chrome.runtime.lastError) {
                console.error('使用chrome.storage.local保存失败:', chrome.runtime.lastError);
                return;
              }
              console.log('已将对话临时保存到chrome.storage.local:', tempKey);
            });
          } catch (localErr) {
            console.error('临时保存也失败:', localErr);
          }
          
          // 错误提示已被移除，不再显示给用户
        }
      }
    } catch (error) {
      // 处理函数级别的错误
      const errorMessage = error instanceof Error ? error.message : 
                          (typeof error === 'string' ? error : '未知错误');
      console.error('保存对话过程中出错:', errorMessage);
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
      
      // 更新选择器以匹配豆包网站的DOM结构
      const containerSelectors = [
        // 首先尝试使用聊天容器选择器
        '.chat-container', 
        // 尝试使用各种消息容器的父元素
        '[class*="container-EC68Od"]',
        '[class*="container-ZYIsnH"]',
        '[class*="message-box"]',
        // 更广泛的选择器
        '[class*="chat"]',
        '[class*="message"]',
        '[class*="conversation"]',
        // 备用选择器
        'main',
        '#app',
        'body'  // 如果找不到特定容器，监听整个body
      ];
      
      let chatContainer = null;
      
      // 尝试找到聊天容器
      for (const selector of containerSelectors) {
        const container = document.querySelector(selector);
        if (container) {
          chatContainer = container;
          console.log(`使用选择器 "${selector}" 找到聊天容器`);
          break;
        }
      }
      
      if (!chatContainer) {
        console.error('无法找到聊天容器，将监听整个文档');
        chatContainer = document;
      }
      
      // 使用MutationObserver监听页面变化
      const observer = new MutationObserver(mutations => {
        // 当有变化时，检查是否有新的对话消息
        const hasNewMessages = mutations.some(mutation => {
          // 检查新增节点
          return Array.from(mutation.addedNodes).some(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // 检查是否是消息容器（用户或AI助手）
              return node.classList && (
                // 用户消息容器
                node.classList.contains('container-EC68Od') ||
                node.classList.contains('container-jPfT9u') ||
                // AI助手消息容器
                node.classList.contains('container-ZYIsnH') ||
                node.classList.contains('flow-markdown-body') ||
                // 其他可能的消息容器
                node.classList.contains('message-box-xy4dB8s') ||
                // 递归检查子元素
                node.querySelector(
                  '.container-EC68Od, .container-jPfT9u, .container-ZYIsnH, .flow-markdown-body, .message-box-xy4dB8s'
                )
              );
            }
            return false;
          });
        });
        
        // 如果检测到新消息，使用防抖函数延迟保存
        if (hasNewMessages) {
          console.log('检测到页面变化，可能有新消息');
          debouncedSave();
        } else {
          // 即使没有检测到确定的新消息，也定期尝试保存
          // 这是为了防止某些情况下无法检测到对话更新
          setTimeout(() => debouncedSave(), 5000);
        }
      });
      
      // 监听容器变化
      observer.observe(chatContainer, { 
        childList: true, 
        subtree: true,
        characterData: true,
        attributes: true
      });
      
      console.log('已开始监听页面变化');
      
      // 另外，定期尝试保存对话，确保不会遗漏
      setInterval(() => {
        console.log('定期保存对话...');
        saveCurrentConversation();
      }, 30000); // 每30秒保存一次
    });
  };

  // 初始化
  const init = () => {
    console.log('ChatNest 豆包提取器已加载');
    console.log('当前页面URL:', window.location.href);
    console.log('豆包对话ID:', window.ChatNest.getConversationIdFromUrl());
    
    // 获取并显示自动提取状态 - 仅在控制台输出，不在页面显示
    window.ChatNest.getAutoExtractEnabled().then(enabled => {
      const statusText = enabled ? '已启用' : '已禁用';
      console.log(`豆包提取器已加载（自动提取${statusText}）`);
    });
    
    // 移除调试指示器，不再在页面上显示提示
    
    // 页面加载完成后立即开始执行
    const startExtractor = async () => {
      // 检查自动提取是否启用
      const autoExtractEnabled = await window.ChatNest.getAutoExtractEnabled();
      if (!autoExtractEnabled) {
        console.log('自动提取对话功能已关闭，不启动提取器');
        return;
      }
      
      // 首先延迟一小段时间，确保DOM已加载
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
    
    // 页面加载完成后保存对话
    window.addEventListener('load', startExtractor);
    
    // 如果页面已加载完成，立即执行
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      console.log('页面已加载，立即开始提取...');
      startExtractor();
    }
  };

  // 启动提取器
  init();
})(); 