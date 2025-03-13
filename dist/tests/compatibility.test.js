/**
 * ChatNest 兼容性测试脚本
 * 用于检查在不同浏览器平台上的兼容性
 */

// 获取当前浏览器信息
const getBrowserInfo = () => {
  const userAgent = navigator.userAgent;
  let browserName = "未知浏览器";
  let browserVersion = "";
  
  // 检测常见浏览器
  if (userAgent.indexOf("Chrome") > -1) {
    browserName = "Chrome";
    browserVersion = userAgent.match(/Chrome\/([0-9.]+)/)[1];
  } else if (userAgent.indexOf("Firefox") > -1) {
    browserName = "Firefox";
    browserVersion = userAgent.match(/Firefox\/([0-9.]+)/)[1];
  } else if (userAgent.indexOf("Safari") > -1 && userAgent.indexOf("Chrome") === -1) {
    browserName = "Safari";
    browserVersion = userAgent.match(/Version\/([0-9.]+)/)[1];
  } else if (userAgent.indexOf("Edge") > -1 || userAgent.indexOf("Edg") > -1) {
    browserName = "Edge";
    browserVersion = userAgent.match(/Edge\/([0-9.]+)/) || userAgent.match(/Edg\/([0-9.]+)/);
    browserVersion = browserVersion ? browserVersion[1] : "";
  } else if (userAgent.indexOf("Opera") > -1 || userAgent.indexOf("OPR") > -1) {
    browserName = "Opera";
    browserVersion = userAgent.match(/Opera\/([0-9.]+)/) || userAgent.match(/OPR\/([0-9.]+)/);
    browserVersion = browserVersion ? browserVersion[1] : "";
  }
  
  return {
    name: browserName,
    version: browserVersion,
    userAgent: userAgent,
    platform: navigator.platform
  };
};

// 检查API可用性
const checkAPIAvailability = () => {
  const apis = {
    chrome: {
      available: typeof chrome !== 'undefined',
      apis: {}
    },
    browser: {
      available: typeof browser !== 'undefined',
      apis: {}
    },
    indexedDB: {
      available: typeof indexedDB !== 'undefined'
    },
    localStorage: {
      available: typeof localStorage !== 'undefined'
    },
    sessionStorage: {
      available: typeof sessionStorage !== 'undefined'
    }
  };
  
  // 检查Chrome API
  if (apis.chrome.available) {
    apis.chrome.apis = {
      storage: typeof chrome.storage !== 'undefined',
      runtime: typeof chrome.runtime !== 'undefined',
      tabs: typeof chrome.tabs !== 'undefined',
      downloads: typeof chrome.downloads !== 'undefined'
    };
  }
  
  // 检查Browser API (Firefox)
  if (apis.browser.available) {
    apis.browser.apis = {
      storage: typeof browser.storage !== 'undefined',
      runtime: typeof browser.runtime !== 'undefined',
      tabs: typeof browser.tabs !== 'undefined',
      downloads: typeof browser.downloads !== 'undefined'
    };
  }
  
  return apis;
};

// 检查本地存储访问
const checkLocalStorageAccess = () => {
  try {
    // 测试localStorage
    localStorage.setItem('chatnest_test', 'test');
    const testValue = localStorage.getItem('chatnest_test');
    localStorage.removeItem('chatnest_test');
    
    return {
      success: testValue === 'test',
      error: testValue !== 'test' ? '读取值与写入值不匹配' : null
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// 检查IndexedDB访问
const checkIndexedDBAccess = () => {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('compatibility_test', 1);
      
      request.onerror = (event) => {
        resolve({
          success: false,
          error: `打开数据库失败: ${event.target.error}`
        });
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        try {
          // 创建测试存储
          const store = db.createObjectStore('test_store', { keyPath: 'id' });
          store.createIndex('test_index', 'name', { unique: false });
        } catch (error) {
          resolve({
            success: false,
            error: `创建存储失败: ${error.message}`
          });
        }
      };
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        
        // 测试写入
        try {
          const transaction = db.transaction(['test_store'], 'readwrite');
          const store = transaction.objectStore('test_store');
          
          const testObj = { id: 1, name: 'test' };
          const addRequest = store.add(testObj);
          
          addRequest.onerror = (event) => {
            resolve({
              success: false,
              error: `写入数据失败: ${event.target.error}`
            });
          };
          
          addRequest.onsuccess = () => {
            // 测试读取
            const getRequest = store.get(1);
            
            getRequest.onerror = (event) => {
              resolve({
                success: false,
                error: `读取数据失败: ${event.target.error}`
              });
            };
            
            getRequest.onsuccess = (event) => {
              const result = event.target.result;
              
              // 测试删除
              const deleteRequest = store.delete(1);
              
              deleteRequest.onerror = (event) => {
                resolve({
                  success: false,
                  error: `删除数据失败: ${event.target.error}`
                });
              };
              
              deleteRequest.onsuccess = () => {
                // 关闭并删除测试数据库
                db.close();
                const deleteDBRequest = indexedDB.deleteDatabase('compatibility_test');
                
                deleteDBRequest.onerror = () => {
                  resolve({
                    success: result && result.id === 1 && result.name === 'test',
                    error: '删除测试数据库失败，但数据操作成功'
                  });
                };
                
                deleteDBRequest.onsuccess = () => {
                  resolve({
                    success: result && result.id === 1 && result.name === 'test',
                    error: null
                  });
                };
              };
            };
          };
        } catch (error) {
          resolve({
            success: false,
            error: `事务操作失败: ${error.message}`
          });
        }
      };
    } catch (error) {
      resolve({
        success: false,
        error: `IndexedDB测试失败: ${error.message}`
      });
    }
  });
};

// 检查Chrome API访问
const checkChromeAPIAccess = () => {
  const results = {
    storage: { success: false, error: null },
    runtime: { success: false, error: null },
    tabs: { success: false, error: null },
    downloads: { success: false, error: null }
  };
  
  // 检查storage API
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    try {
      chrome.storage.sync.set({ 'test_key': 'test_value' }, () => {
        if (chrome.runtime.lastError) {
          results.storage = {
            success: false,
            error: chrome.runtime.lastError.message
          };
        } else {
          chrome.storage.sync.get('test_key', (result) => {
            if (chrome.runtime.lastError) {
              results.storage = {
                success: false,
                error: chrome.runtime.lastError.message
              };
            } else {
              results.storage = {
                success: result.test_key === 'test_value',
                error: null
              };
              
              // 清理测试数据
              chrome.storage.sync.remove('test_key');
            }
          });
        }
      });
    } catch (error) {
      results.storage = {
        success: false,
        error: error.message
      };
    }
  } else {
    results.storage = {
      success: false,
      error: 'storage API不可用'
    };
  }
  
  // 检查runtime API
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    try {
      results.runtime = {
        success: true,
        error: null
      };
    } catch (error) {
      results.runtime = {
        success: false,
        error: error.message
      };
    }
  } else {
    results.runtime = {
      success: false,
      error: 'runtime API不可用'
    };
  }
  
  // 检查tabs API
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    try {
      results.tabs = {
        success: true,
        error: null
      };
    } catch (error) {
      results.tabs = {
        success: false,
        error: error.message
      };
    }
  } else {
    results.tabs = {
      success: false,
      error: 'tabs API不可用'
    };
  }
  
  // 检查downloads API
  if (typeof chrome !== 'undefined' && chrome.downloads) {
    try {
      results.downloads = {
        success: true,
        error: null
      };
    } catch (error) {
      results.downloads = {
        success: false,
        error: error.message
      };
    }
  } else {
    results.downloads = {
      success: false,
      error: 'downloads API不可用'
    };
  }
  
  return results;
};

// 运行兼容性测试
const runCompatibilityTests = async () => {
  const results = {
    browserInfo: getBrowserInfo(),
    apiAvailability: checkAPIAvailability(),
    localStorage: checkLocalStorageAccess(),
    indexedDB: await checkIndexedDBAccess(),
    chromeAPI: checkChromeAPIAccess()
  };
  
  // 计算兼容性分数
  let compatibilityScore = 0;
  let totalTests = 0;
  
  // localStorage测试
  if (results.localStorage.success) compatibilityScore++;
  totalTests++;
  
  // indexedDB测试
  if (results.indexedDB.success) compatibilityScore++;
  totalTests++;
  
  // Chrome API测试
  for (const api in results.chromeAPI) {
    if (results.chromeAPI[api].success) compatibilityScore++;
    totalTests++;
  }
  
  results.compatibilityScore = {
    score: compatibilityScore,
    total: totalTests,
    percentage: Math.round((compatibilityScore / totalTests) * 100)
  };
  
  console.log('===== ChatNest 兼容性测试结果 =====');
  console.log(`浏览器: ${results.browserInfo.name} ${results.browserInfo.version} (${results.browserInfo.platform})`);
  console.log(`兼容性得分: ${results.compatibilityScore.score}/${results.compatibilityScore.total} (${results.compatibilityScore.percentage}%)`);
  
  return results;
};

// 导出测试函数
export { getBrowserInfo, checkAPIAvailability, checkLocalStorageAccess, checkIndexedDBAccess, checkChromeAPIAccess, runCompatibilityTests }; 