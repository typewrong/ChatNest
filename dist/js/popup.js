console.log("============ ChatNest 弹出窗口脚本加载 ============");const i=(s,e=!1)=>{e?console.error(s):console.log(s)};let u="all",p="",d=[];i(`页面环境检查 - URL: ${window.location.href}`);i(`扩展ID: ${chrome.runtime.id}`);const $=s=>new Date(s).toLocaleDateString("zh-CN",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}),y=s=>{try{const e=document.getElementById("conversation-list");if(!e)return;const r=s.filter(t=>{if(!t||typeof t!="object")return!1;try{const n=u==="all"||t.platform===u,o=p===""||t.title&&t.title.toLowerCase().includes(p.toLowerCase());return n&&o}catch{return!1}});if(e.innerHTML="",r.length===0){e.innerHTML=`
        <div class="empty-state">
          <p>暂无对话记录</p>
        </div>
      `;return}r.forEach((t,n)=>{try{const o=document.createElement("div");o.className="conversation-item",t.isTemporary&&o.classList.add("temporary"),o.dataset.id=t.id,o.dataset.url=t.url||"";const a=t.platform==="deepseek"?"deepseek":"doubao",l=t.platform==="deepseek"?"DeepSeek":"豆包",c=t.title||"未命名对话",f=t.timestamp||Date.now();o.innerHTML=`
          <div class="conversation-title">${c}</div>
          <div class="conversation-meta">
            <span class="platform-badge ${a}">${l}</span>
            <span class="conversation-date">${$(f)}</span>
            <button class="export-button" title="导出对话">导出</button>
          </div>
        `,o.addEventListener("click",h=>{h.target.classList.contains("export-button")||(t.url?chrome.tabs.create({url:t.url}):alert("无法打开此对话，URL不可用"))});const v=o.querySelector(".export-button");v&&v.addEventListener("click",h=>{h.stopPropagation(),L(t)}),e.appendChild(o)}catch(o){console.error("渲染对话项失败:",o)}})}catch(e){console.error("渲染对话列表失败:",e);try{const r=document.getElementById("conversation-list");r&&(r.innerHTML=`
          <div class="empty-state error-state">
            <p>渲染对话列表时出错</p>
            <p>错误信息: ${e.message}</p>
          </div>
        `)}catch(r){console.error("恢复显示失败:",r)}}},C=()=>new Promise((s,e)=>{try{chrome.storage.local.get(null,r=>{if(chrome.runtime.lastError){console.error("获取临时对话失败:",chrome.runtime.lastError),s([]);return}const t=[];Object.keys(r).filter(o=>o.startsWith("chatnest_temp_")).forEach(o=>{try{const a=r[o];a.isTemporary=!0,t.push({id:a.id,platform:a.platform,title:a.title||"未命名对话",timestamp:a.timestamp,url:a.url,isTemporary:!0})}catch(a){console.error("处理临时对话数据失败:",a)}}),s(t)})}catch(r){console.error("加载临时对话失败:",r),s([])}}),I=s=>new Promise((e,r)=>{try{const t=`chatnest_temp_${s.id}`;chrome.storage.local.get(t,n=>{if(chrome.runtime.lastError){r(new Error(`获取临时对话失败: ${chrome.runtime.lastError.message}`));return}const o=n[t];if(!o){r(new Error(`找不到临时对话数据: ${s.id}`));return}m({type:"SAVE_CONVERSATION",conversation:o},a=>{if(a&&a.success)chrome.storage.local.remove(t,()=>{chrome.runtime.lastError&&console.error(`删除临时对话数据失败: ${chrome.runtime.lastError.message}`)}),e();else{const l=a?a.error:"未知错误";r(new Error(l))}})})}catch(t){r(t)}}),m=(s,e)=>{try{if(!chrome||!chrome.runtime){console.error("扩展上下文无效，无法发送消息"),e&&e({success:!1,error:"Extension context invalidated"});return}chrome.runtime.sendMessage(s,r=>{if(chrome.runtime.lastError){console.error("消息发送错误:",chrome.runtime.lastError.message),e&&e({success:!1,error:chrome.runtime.lastError.message});return}e&&e(r)})}catch(r){console.error("发送消息时出错:",r.message),e&&e({success:!1,error:r.message})}},b=async()=>{var s;document.getElementById("conversation-list").innerHTML=`
    <div class="loading-state">
      <p>加载中...</p>
    </div>
  `;try{const e=await C();m({type:"GET_CONVERSATION_INDEX"},r=>{var t;try{if(r&&r.success){const n=Array.isArray(r.data)?r.data:[];if(d=[...e,...n],d.length>0?y(d):document.getElementById("conversation-list").innerHTML=`
                <div class="empty-state">
                  <p>暂无对话记录</p>
                  <p>在豆包或DeepSeek进行对话后将自动保存</p>
                </div>
              `,e.length>0){const o=document.createElement("div");o.className="recover-banner",o.innerHTML=`
                <p>发现${e.length}条未保存的对话。</p>
                <button id="recover-all-button">全部恢复</button>
              `;const a=document.querySelector(".container");if(a){a.prepend(o);const l=document.getElementById("recover-all-button");l&&l.addEventListener("click",async()=>{try{l.disabled=!0,l.textContent="恢复中...";for(const c of e)try{await I(c)}catch(f){console.error("恢复临时对话失败:",f)}b()}catch(c){console.error("批量恢复临时对话失败:",c),alert("部分对话恢复失败，请稍后再试")}})}}}else if(e.length>0){d=e,y(d);const n=document.createElement("div");n.className="error-banner",n.innerHTML=`
                <p>无法连接到扩展后台，只显示临时保存的对话。</p>
                <p>请尝试重新加载扩展。</p>
                <button id="reload-extension-error" class="action-button">重新加载扩展</button>
              `;const o=document.querySelector(".container");if(o){o.prepend(n);const a=document.getElementById("reload-extension-error");a&&a.addEventListener("click",()=>{chrome.runtime.reload()})}}else{document.getElementById("conversation-list").innerHTML=`
                <div class="empty-state error-state">
                  <p>加载对话列表失败</p>
                  <p>请尝试重新加载扩展</p>
                  <button id="reload-extension" class="action-button">重新加载扩展</button>
                </div>
              `;const n=document.getElementById("reload-extension");n&&n.addEventListener("click",()=>{chrome.runtime.reload()})}}catch(n){console.error("处理或渲染对话数据时出错:",n),document.getElementById("conversation-list").innerHTML=`
            <div class="empty-state error-state">
              <p>处理对话数据时出错</p>
              <p>错误信息: ${n.message}</p>
              <button id="reload-extension-render" class="action-button">重新加载扩展</button>
            </div>
          `,(t=document.getElementById("reload-extension-render"))==null||t.addEventListener("click",()=>{chrome.runtime.reload()})}})}catch(e){console.error("加载对话失败:",e),document.getElementById("conversation-list").innerHTML=`
      <div class="empty-state error-state">
        <p>加载对话列表时发生错误</p>
        <p>错误信息: ${e.message}</p>
        <button id="reload-extension-error" class="action-button">重新加载扩展</button>
      </div>
    `,(s=document.getElementById("reload-extension-error"))==null||s.addEventListener("click",()=>{chrome.runtime.reload()})}},L=async s=>{try{const e=await new Promise((a,l)=>{m({action:"getConversation",id:s.id},c=>{!c||!c.success?l(new Error(c?c.error:"获取对话失败")):a(c.conversation)})}),r=await new Promise((a,l)=>{m({action:"conversationToMarkdown",conversation:e},c=>{!c||!c.success?l(new Error(c?c.error:"生成Markdown失败")):a(c.markdown)})}),t=new Blob([r],{type:"text/markdown"}),o=`${(e.title||"未命名对话").replace(/[<>:"/\\|?*]/g,"_")}_${e.id.substring(0,8)}.md`;chrome.downloads.download({url:URL.createObjectURL(t),filename:`ChatNest/${o}`,saveAs:!1},a=>{chrome.runtime.lastError?(console.error(`导出失败: ${chrome.runtime.lastError.message}`),alert(`导出失败: ${chrome.runtime.lastError.message}`)):console.log("对话导出成功")})}catch(e){console.error("导出单个对话失败:",e),alert("导出失败: "+e.message)}},x=async()=>{try{i("准备直接导出所有对话..."),i("获取最新对话数据...");try{const e=await new Promise((r,t)=>{m({type:"GET_CONVERSATION_INDEX"},n=>{if(!n||!n.success){t(new Error("获取对话索引失败"));return}r(n)})});e&&e.success?(i(`成功获取到 ${e.data.length} 个对话索引`),d=e.data):i("获取对话索引失败，使用当前缓存的数据",!0)}catch(e){i(`获取对话索引出错: ${e.message}`,!0)}const s=d.filter(e=>{const r=u==="all"||e.platform===u,t=p===""||e.title&&e.title.toLowerCase().includes(p.toLowerCase());return r&&t});if(s.length===0){i("没有可导出的对话",!0);return}if(i(`准备直接导出 ${s.length} 个对话`),s.length>1){if(typeof JSZip>"u"){i("找不到JSZip库，请确保页面已正确加载JSZip",!0),console.error("导出失败: 找不到JSZip库");return}const e=new JSZip,r=e.folder("ChatNest");let t=0;const n=s.length;for(const l of s)try{const c=await new Promise((w,g)=>{m({action:"getConversation",id:l.id},E=>{chrome.runtime.lastError?g(chrome.runtime.lastError):E.error?g(new Error(E.error)):w(E.conversation)})}),f=await new Promise((w,g)=>{m({action:"conversationToMarkdown",conversation:c},E=>{chrome.runtime.lastError?g(chrome.runtime.lastError):w(E.markdown)})}),h=`${(c.title||"未命名对话").replace(/[<>:"/\\|?*]/g,"_")}_${c.id.substring(0,8)}.md`;r.file(h,f),t++,i(`已处理 ${t}/${n} 个对话`)}catch(c){console.error(`处理对话 ${l.id} 时出错:`,c)}i("正在生成ZIP文件...");const o=await e.generateAsync({type:"blob"}),a=new Date().toISOString().replace(/[:.]/g,"-").substring(0,19);chrome.downloads.download({url:URL.createObjectURL(o),filename:`ChatNest_Export_${a}.zip`,saveAs:!0},l=>{chrome.runtime.lastError?console.error(`ZIP导出失败: ${chrome.runtime.lastError.message}`):i("ZIP导出成功")})}else s.length===1&&await L(s[0])}catch(s){console.error("导出对话失败:",s)}},T=x,B=()=>{i("初始化事件监听..."),document.querySelectorAll(".tab-button").forEach(n=>{n.addEventListener("click",()=>{u=n.dataset.platform,i(`切换平台: ${u}`),document.querySelectorAll(".tab-button").forEach(o=>{o.classList.remove("active")}),n.classList.add("active"),y(d)})});const s=document.getElementById("search-input");s&&s.addEventListener("input",()=>{p=s.value.trim(),i(`搜索关键词: ${p}`),y(d)});const e=document.getElementById("export-button");e&&e.addEventListener("click",T);const r=document.getElementById("settings-button");r&&r.addEventListener("click",()=>{chrome.runtime.openOptionsPage()});const t=document.getElementById("auto-extract-toggle");t&&(chrome.storage.sync.get("autoExtractEnabled",n=>{const o=n.autoExtractEnabled!==void 0?n.autoExtractEnabled:!0;t.checked=o,i(`自动提取对话功能状态: ${o?"开启":"关闭"}`)}),t.addEventListener("change",()=>{const n=t.checked;chrome.storage.sync.set({autoExtractEnabled:n},()=>{chrome.tabs.query({},o=>{o.forEach(a=>{if(a.url&&(a.url.includes("deepseek.com")||a.url.includes("doubao.com")))try{chrome.tabs.sendMessage(a.id,{type:"UPDATE_AUTO_EXTRACT",enabled:n})}catch(l){console.error(`通知标签页 ${a.id} 失败: ${l.message}`)}})})})}))};document.addEventListener("DOMContentLoaded",()=>{i("文档加载完成，开始初始化..."),b(),B(),i("初始化完成")});
