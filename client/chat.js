/* AI 员工聊天视图：从 app.js 拆分（v0.16.4，单文件超推送上限） */
async function viewAi() {
  setNav('ai');
  document.querySelector('.main').classList.add('chat-mode');
  if (!empList.length) { try { await loadEmps(); } catch (e) {} }
  const emp = empList.find((e) => e.id === curEmpId) || empList[0];
  if (!emp) {
    document.querySelector('.main').classList.remove('chat-mode');
    app.innerHTML = `<div class="page"><div class="empty">还没有 AI 员工，先去新建一个吧。<br><br><button class="btn" id="ai-empty-new">新建AI员工</button></div></div>`;
    document.getElementById('ai-empty-new').onclick = () => openEmpNewModal();
    return;
  }
  curEmpId = emp.id;
  app.innerHTML = `
  <div class="chat-wrap">
    <div class="chat-head">
      <button class="btn ghost sm" id="chat-menu" aria-label="导航" style="position:absolute;left:12px">
        <svg class="ic" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
      <span class="chat-title">${esc(emp.name)}</span>
      <button class="btn ghost sm chat-clear" id="chat-clear" aria-label="清空聊天记录" title="清空聊天记录">
        <svg class="ic" viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13"/></svg>
      </button>
      <button class="btn ghost sm chat-cfg" id="chat-config">配置</button>
    </div>
    <div class="chat-body" id="chat-body">
      <div class="chat-inner" id="chat-inner">
        <div class="chat-empty" id="chat-empty">
          <h2>有什么可以帮你？</h2>
          <div>粘贴买家消息，我来选话术；也可以发图片让我分析款式。</div>
        </div>
      </div>
    </div>
    <div class="chat-foot">
      <div class="chat-inputwrap">
        <input type="file" id="chat-img" accept="image/*" style="display:none">
        <button class="chat-attach" id="chat-attach" aria-label="上传图片">
          <svg class="ic" viewBox="0 0 24 24" width="20" height="20"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <textarea id="chat-input" rows="1" placeholder="输入买家消息…"></textarea>
        <button class="chat-send" id="chat-send" aria-label="发送" disabled>
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        </button>
      </div>
      <div class="chat-hint">AI 话术助手 · 内容仅供参考，发送前请核对</div>
    </div>
  </div>`;
  document.getElementById('chat-config').onclick = () => openEmpModal(curEmpId);
  document.getElementById('chat-clear').onclick = () => {
    Modal.confirm({
      title: '清空聊天记录',
      body: `确定清空「${esc(emp.name)}」的全部聊天记录吗？不可恢复。`,
      okText: '清空',
      onOk: async () => {
        try {
          await api(`/api/ai/chat/history?service_id=${curEmpId}`, { method: 'DELETE' });
          inner.innerHTML = `<div class="chat-empty" id="chat-empty"><h2>有什么可以帮你？</h2><div>粘贴买家消息，我来选话术；也可以发图片让我分析款式。</div></div>`;
          toast('已清空');
        } catch (e) { toast(e.message); }
      }
    });
  };
  document.getElementById('chat-menu').onclick = () => document.getElementById('app-root').classList.add('sidebar-open');
  const body = document.getElementById('chat-body');
  const inner = document.getElementById('chat-inner');
  // 代码块复制按钮（事件委托，历史消息和新消息通用）
  inner.addEventListener('click', (e) => {
    const btn = e.target.closest('.code-copy');
    if (!btn) return;
    const code = decodeURIComponent(btn.dataset.code || '');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => toast('已复制')).catch(() => toast('复制失败'));
    } else toast('当前环境不支持复制');
  });
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const imgInput = document.getElementById('chat-img');
  const emptyEl = () => document.getElementById('chat-empty');
  let lastKbHits = []; // 最近一次话术检索的知识库引用，随选中的话术一起存档

  const scrollBottom = () => { body.scrollTop = body.scrollHeight; };
  const hideEmpty = () => { const e = emptyEl(); if (e) e.remove(); };
  // 加载该员工独立聊天记录
  const saveMsg = (role, content, meta) => {
    api('/api/ai/chat/messages', { method: 'POST', body: JSON.stringify({ service_id: curEmpId, role, content, meta: meta || {} }) }).catch(() => {});
  };
  (async () => {
    try {
      const hist = await api(`/api/ai/chat/history?service_id=${curEmpId}`);
      if (hist.length) {
        hideEmpty();
        hist.forEach((m) => {
          const d = document.createElement('div');
          let meta = {};
          try { meta = JSON.parse(m.meta_json || '{}'); } catch (e) {}
          if (m.role === 'user') {
            d.className = 'cmsg user';
            d.innerHTML = (meta.kind === 'image' && meta.path)
              ? `<img class="cmsg-img" src="${esc(meta.path)}">`
              : `<div class="ububble">${esc(m.content)}</div>`;
          } else {
            d.className = 'cmsg ai';
            let bodyHtml = renderMd(m.content);
            // v0.15.2：历史里的话术选项卡片（静态展示，不可点）
            if (meta.kind === 'options' && meta.options && meta.options.length) {
              bodyHtml += `<div class="chat-opts static">` + meta.options.map((o) => `
                <div class="chat-opt">
                  <div class="k">${esc(o.template_key || '')}</div>
                  <div class="p">${esc(o.preview || '')}</div>
                </div>`).join('') + `</div>`;
            }
            let refs = '';
            const refParts = [];
            if (meta.template_key) refParts.push(`话术 ${esc(meta.template_key)}`);
            if (meta.kb_hits && meta.kb_hits.length) refParts.push(`知识库 ${meta.kb_hits.map((h) => esc(h.kb_name || '')).filter(Boolean).join('、')}`);
            if (refParts.length) refs = `<div class="cref">引用：${refParts.join(' · ')}</div>`;
            d.innerHTML = `<div class="atext">${bodyHtml}${refs}</div>`;
            d.querySelector('.atext').appendChild(makeAiActions(() => m.content, () => findPrevUserText(d)));
          }
          inner.appendChild(d);
        });
        scrollBottom();
      }
    } catch (e) {}
  })();
  // 每条 AI 回复下方的操作条：重新生成 / 复制
  const copyText = async (t) => {
    try { await navigator.clipboard.writeText(t); return; }
    catch (e) {}
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e2) {}
    ta.remove();
  };
  // 找到该 AI 气泡上一条用户消息的纯文本（用于重新生成）
  const findPrevUserText = (aiDiv) => {
    let el = aiDiv.previousElementSibling;
    while (el) {
      if (el.classList && el.classList.contains('user')) {
        const u = el.querySelector('.ububble');
        return u ? u.textContent : '';
      }
      el = el.previousElementSibling;
    }
    return '';
  };
  const makeAiActions = (getRaw, getUserMsg, hintMsg) => {
    const bar = document.createElement('div');
    bar.className = 'ai-actions';
    bar.innerHTML = (hintMsg ? `<span class="ai-hint">${esc(hintMsg)}</span>` : '') +
      `<button class="aact">重新生成</button><button class="aact">复制</button>`;
    const btns = bar.querySelectorAll('button');
    btns[0].onclick = () => {
      const um = (getUserMsg() || '').trim();
      if (!um) return;
      btns[0].disabled = true; btns[0].textContent = '生成中…';
      sendStreamMessage(um, true);
    };
    btns[1].onclick = async () => {
      await copyText(getRaw() || '');
      btns[1].textContent = '已复制';
      setTimeout(() => { btns[1].textContent = '复制'; }, 1500);
    };
    return bar;
  };
  const addUser = (html) => {
    hideEmpty();
    const d = document.createElement('div');
    d.className = 'cmsg user';
    d.innerHTML = `<div class="ububble">${html}</div>`;
    inner.appendChild(d); scrollBottom();
  };
  const addAi = (html) => {
    hideEmpty();
    const d = document.createElement('div');
    d.className = 'cmsg ai';
    d.innerHTML = `<div class="atext">${html}</div>`;
    inner.appendChild(d); scrollBottom();
    return d;
  };
  // 纯文本 AI 消息：走 Markdown 渲染，下方挂操作条
  const addAiText = (text) => {
    const d = addAi(renderMd(text));
    d.querySelector('.atext').appendChild(makeAiActions(() => text, () => findPrevUserText(d)));
    return d;
  };
  const addTyping = () => {
    hideEmpty();
    const d = document.createElement('div');
    d.className = 'cmsg ai';
    d.innerHTML = '<div class="atext"><span class="typing-dots"><span></span><span></span><span></span></span></div>';
    inner.appendChild(d); scrollBottom();
    return d;
  };
  // 流式 AI 气泡：先占位，token 到了逐字追加；完成/中断后下方挂操作条（重新生成/复制）
  const streamAi = (message) => {
    hideEmpty();
    const d = document.createElement('div');
    d.className = 'cmsg ai';
    d.innerHTML = '<div class="atext"><p></p></div>';
    inner.appendChild(d); scrollBottom();
    const p = d.querySelector('p');
    const atext = d.querySelector('.atext');
    let raw = '', barShown = false;
    const showBar = (hintMsg) => {
      if (barShown) return; barShown = true;
      atext.appendChild(makeAiActions(() => raw, () => message, hintMsg));
      scrollBottom();
    };
    return {
      append: (tok) => { raw += tok; p.innerHTML = renderMd(raw); scrollBottom(); },
      finish: () => { showBar(''); },
      error: (msg) => {
        p.innerHTML = raw ? renderMd(raw) : '';
        showBar(msg);
      },
    };
  };
  const updSend = () => { sendBtn.disabled = !input.value.trim(); };

  // 流式发送（可重试：isRetry 时不重复显示用户气泡，后端也不重复存档用户消息）
  const sendStreamMessage = async (message, isRetry) => {
    const st = streamAi(message);
    const ctrl = new AbortController();
    let gotToken = false;
    // 首 token 30 秒超时：模型迟迟不回就熔断
    const firstTokenTimer = setTimeout(() => { if (!gotToken) ctrl.abort(); }, 30000);
    try {
      const r = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: curEmpId, message, regenerate: !!isRetry }),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error(`请求失败 ${r.status}`);
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = '', finished = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const data = t.slice(5).trim();
          if (!data) continue;
          let o = null;
          try { o = JSON.parse(data); } catch (e) { continue; }
          if (o.token) {
            if (!gotToken) { gotToken = true; clearTimeout(firstTokenTimer); }
            st.append(o.token);
          }
          else if (o.error) { finished = true; throw new Error(o.error); }
          else if (o.done) { finished = true; st.finish(); }
        }
      }
      clearTimeout(firstTokenTimer);
      if (!gotToken) st.error('模型返回为空，请重试');
      else if (!finished) st.error('连接中断，回复未完成');
    } catch (e) {
      clearTimeout(firstTokenTimer);
      const timeout = (e.name === 'AbortError' && !gotToken);
      st.error(timeout ? '等待模型回复超时（30秒），请检查网络后重试' : (e.message || '网络异常，请重试'));
    }
  };

  const sendText = async () => {
    const message = input.value.trim();
    if (!message) return;
    input.value = ''; updSend(); input.style.height = 'auto';
    addUser(esc(message));
    // v0.16.0：话术检索开关开 → 老链路；关 → 简单对话（soul+memory）
    const cur = empList.find((e) => e.id === curEmpId) || emp;
    if (cur.tpl_retrieval) { saveMsg('user', message); return sendTextLegacy(message); }
    // v0.16.1 流式：先占位气泡，token 到了逐字显示，首字不再等整段生成
    sendStreamMessage(message, false);
  };
  // 话术检索链路（老链路，开关开启时用）
  const sendTextLegacy = async (message) => {
    const typing = addTyping();
    try {
      const d = await api('/api/ai/assist', {
        method: 'POST', body: JSON.stringify({ message, service_id: curEmpId }),
      });
      typing.remove();
      if (d.options && d.options.length) {
        const msgDiv = addAiText('找到以下话术，点击选择：');
        const opts = document.createElement('div');
        opts.className = 'chat-opts';
        opts.innerHTML = d.options.map((o, i) => `
          <button class="chat-opt" data-tid="${o.template_id}" data-rank="${i}">
            <div class="k">${esc(o.template_key)}${o.recommended ? ' · 推荐' : ''}</div>
            <div class="p">${esc(o.preview || '')}</div>
          </button>`).join('');
        msgDiv.querySelector('.atext').appendChild(opts);
        scrollBottom();
        opts.querySelectorAll('.chat-opt').forEach((el) => {
          el.onclick = () => selectTemplate(Number(el.dataset.tid), message, Number(el.dataset.rank));
        });
        // v0.15.2：话术选项也存档，历史记录里还原完整链条（用户消息→选项→选中回复）
        saveMsg('ai', '找到以下话术，点击选择：', {
          kind: 'options',
          message,
          options: d.options.map((o) => ({ template_id: o.template_id, template_key: o.template_key, preview: o.preview || '' })),
          kb_hits: (d.kb_hits || []).map((h) => ({ kb_name: h.kb_name || '', text: String(h.text || '').slice(0, 120) })),
        });
      } else {
        addAiText('没找到匹配的话术，换个说法试试。');
        saveMsg('ai', '没找到匹配的话术，换个说法试试。');
      }
      if (d.kb_hits && d.kb_hits.length) {
        lastKbHits = d.kb_hits;
        addAi(`<div style="font-size:13px;color:var(--muted)">知识库参考：<br>${d.kb_hits.map((h) => `· ${esc(h.kb_name)}：${esc(h.text.slice(0, 120))}…`).join('<br>')}</div>`);
      } else { lastKbHits = []; }
    } catch (e) {
      typing.remove();
      addAiText('出错了：' + e.message);
    }
  };
  const selectTemplate = async (tid, message, rank) => {
    const typing = addTyping();
    try {
      const r = await api('/api/ai/assist/select', {
        method: 'POST', body: JSON.stringify({ template_id: tid, message, rank, service_id: curEmpId }),
      });
      typing.remove();
      addAi(renderMd(r.text || '生成失败'));
      saveMsg('ai', r.text || '生成失败', {
        template_key: r.template_key || '',
        kb_hits: (lastKbHits || []).map((h) => ({ kb_name: h.kb_name || '', text: String(h.text || '').slice(0, 120) })),
      });
      lastKbHits = [];
      if (r.copy_blocked) addAi('<div style="font-size:13px;color:var(--muted)">该回复被护栏拦截，请检查后手动处理。</div>');
    } catch (e) {
      typing.remove();
      addAiText('出错了：' + e.message);
    }
  };

  document.getElementById('chat-attach').onclick = () => imgInput.click();
  imgInput.onchange = () => {
    const file = imgInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      addUser(`<img class="cmsg-img" src="${dataUrl}">`);
      // v0.15.1：图片存 uploads，聊天记录里只存路径（重开聊天可回看）
      api('/api/ai/chat/image', { method: 'POST', body: JSON.stringify({ service_id: curEmpId, dataUrl }) })
        .then((up) => saveMsg('user', '[图片]', { kind: 'image', path: up.path || '' }))
        .catch(() => saveMsg('user', '[图片]', { kind: 'image', path: '' }));
      const typing = addTyping();
      try {
        const d = await api('/api/ai/vision', {
          method: 'POST', body: JSON.stringify({ image: dataUrl, service_id: curEmpId }),
        });
        typing.remove();
        addAi(renderMd(d.text || '识图失败'));
        saveMsg('ai', d.text || '识图失败');
      } catch (err) {
        typing.remove();
        addAiText('识图出错：' + err.message);
      }
    };
    reader.readAsDataURL(file);
    imgInput.value = '';
  };

  sendBtn.onclick = sendText;
  input.oninput = () => {
    updSend();
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); }
  };
}

