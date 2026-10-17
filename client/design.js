// 设计台 v1：视觉设计工作台（聊天式生图）+ 资产库
// 由 client/app.js 经 route() 调用；依赖全局 api/esc/toast/Modal
const DSG = {
  sessions: [], cur: null, messages: [],
  models: [], model: '', clarity: 'medium', ratio: 'auto',
  attach: null, // {id, path}
};
const DSG_RATIO_LABEL = { auto: '自动', '1:1': '1:1 方形', '3:4': '3:4 竖版', '4:3': '4:3 横版', '16:9': '16:9 横版', '9:16': '9:16 竖版' };
const DSG_CLARITY_LABEL = { low: '低', medium: '中', high: '高' };
const dsgCost = (c) => (Number(c) > 0 ? `¥${Number(c).toFixed(2)}` : '未定价');

async function dsgLoadModels() {
  DSG.models = await api('/api/design/models').catch(() => []);
  if (!DSG.models.find((m) => m.model_id === DSG.model || String(m.id) === DSG.model)) DSG.model = '';
  if (!DSG.model && DSG.models.length) DSG.model = DSG.models[0].model_id;
}

// ---------- 会话列表 ----------
async function viewDesign() {
  await dsgLoadModels();
  const pre = sessionStorage.getItem('dsg_garment');
  if (pre) { sessionStorage.removeItem('dsg_garment'); }
  document.querySelector('.main').classList.remove('chat-mode');
  app.innerHTML = `
  <div class="page">
    <div class="page-head">
      <button class="iconbtn" data-menu aria-label="菜单"><svg class="ic" viewBox="0 0 24 24" width="20" height="20"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      <h1>设计台</h1>
      <button class="btn ghost sm" id="dsg-visual">西装视觉工作流</button>
      <button class="btn sm" id="dsg-new">新会话</button>
    </div>
    <div class="dsg-hint">视觉设计工作台：描述画面或传图，稳定产出主图、详情图等视觉物料。结构性改款必须重新制版。</div>
    <div id="dsg-sessions" class="list"></div>
  </div>`;
  document.getElementById('dsg-new').onclick = () => dsgNewSession(pre ? JSON.parse(pre) : null);
  document.getElementById('dsg-visual').onclick = () => viewVisualWorkflow();
  await dsgRenderSessions();
}
async function dsgRenderSessions() {
  DSG.sessions = await api('/api/design/sessions').catch(() => []);
  const el = document.getElementById('dsg-sessions');
  el.innerHTML = DSG.sessions.length ? DSG.sessions.map((s) => `
    <div class="card dsg-sess" data-id="${s.id}">
      <div class="dsg-sess-main">
        <div class="dsg-sess-title">${esc(s.title || '新的设计')}</div>
        <div class="muted small">${s.style_no ? `款 ${esc(s.style_no)} · ` : ''}${s.msg_count || 0} 条消息 · ${esc((s.updated_at || '').slice(0, 16))}</div>
      </div>
      <button class="iconbtn" data-del="${s.id}" aria-label="删除会话"><svg class="ic" viewBox="0 0 24 24" width="18" height="18"><path d="M4 7h16M9 7V5h6v2m-8 0l1 13h8l1-13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></button>
    </div>`).join('')
    : '<div class="empty">还没有设计会话，点右上角「新会话」开始。<br>也可以从款档案点「去设计台」带款发起。</div>';
  el.querySelectorAll('.dsg-sess-main').forEach((m) => { m.onclick = () => dsgOpenSession(Number(m.closest('.dsg-sess').dataset.id)); });
  el.querySelectorAll('[data-del]').forEach((b) => { b.onclick = (e) => {
    e.stopPropagation();
    Modal.confirm({ title: '删除会话', body: '删除该会话的全部消息和生成图吗？不可恢复。', okText: '删除', onOk: async () => {
      await api(`/api/design/sessions/${b.dataset.del}`, { method: 'DELETE' });
      toast('已删除'); dsgRenderSessions();
    }});
  }});
}
async function dsgNewSession(garment) {
  try {
    const r = await api('/api/design/sessions', { method: 'POST', body: JSON.stringify({ garment_id: garment ? garment.id : null }) });
    dsgOpenSession(r.id);
  } catch (e) { toast(e.message); }
}

// ---------- 聊天工作台 ----------
async function dsgOpenSession(sid) {
  DSG.cur = sid; DSG.attach = null;
  document.querySelector('.main').classList.add('chat-mode');
  app.innerHTML = `
  <div class="page dsg-chat-page">
    <div class="page-head">
      <button class="iconbtn" data-menu aria-label="菜单"><svg class="ic" viewBox="0 0 24 24" width="20" height="20"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      <button class="iconbtn" id="dsg-back" aria-label="返回"><svg class="ic" viewBox="0 0 24 24" width="20" height="20"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></button>
      <h1 id="dsg-title">设计台</h1>
    </div>
    <div class="dsg-controls">
      <select id="dsg-model" class="dsg-sel" aria-label="模型"></select>
      <select id="dsg-clarity" class="dsg-sel" aria-label="清晰度">
        ${Object.entries(DSG_CLARITY_LABEL).map(([k, v]) => `<option value="${k}"${DSG.clarity === k ? ' selected' : ''}>清晰度${v}</option>`).join('')}
      </select>
      <select id="dsg-ratio" class="dsg-sel" aria-label="比例">
        ${Object.entries(DSG_RATIO_LABEL).map(([k, v]) => `<option value="${k}"${DSG.ratio === k ? ' selected' : ''}>${v}</option>`).join('')}
      </select>
    </div>
    <div class="dsg-body" id="dsg-body"><div class="dsg-inner" id="dsg-inner"></div></div>
    <div class="dsg-foot">
      <div id="dsg-attach-preview" class="dsg-attach-preview" style="display:none"></div>
      <div class="chat-inputwrap">
        <input type="file" id="dsg-img" accept="image/*" style="display:none">
        <button class="chat-attach" id="dsg-attach" aria-label="上传图片"><svg class="ic" viewBox="0 0 24 24" width="20" height="20"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        <textarea id="dsg-input" rows="1" placeholder="描述画面…（可含比例词如竖版/3:4，会自动转成尺寸参数）"></textarea>
        <button class="chat-send" id="dsg-send" aria-label="发送"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></button>
      </div>
      <div class="chat-hint">自费生图：发送后直接生成，单价见上方模型选择</div>
    </div>
  </div>`;
  document.getElementById('dsg-back').onclick = () => viewDesign();
  const modelSel = document.getElementById('dsg-model');
  modelSel.innerHTML = DSG.models.length
    ? DSG.models.map((m) => `<option value="${esc(m.model_id)}"${DSG.model === m.model_id ? ' selected' : ''}>${esc(m.display_name || m.model_id)} · ${dsgCost(m.image_price)}${Number(m.image_price) > 0 ? '/张' : ''}</option>`).join('')
    : '<option value="">未上架 visual 模型</option>';
  modelSel.onchange = () => { DSG.model = modelSel.value; };
  document.getElementById('dsg-clarity').onchange = (e) => { DSG.clarity = e.target.value; };
  document.getElementById('dsg-ratio').onchange = (e) => { DSG.ratio = e.target.value; };
  const input = document.getElementById('dsg-input');
  const sendBtn = document.getElementById('dsg-send');
  sendBtn.onclick = dsgSend;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); dsgSend(); } });
  document.getElementById('dsg-attach').onclick = () => document.getElementById('dsg-img').click();
  document.getElementById('dsg-img').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    e.target.value = '';
    try {
      const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
      const up = await api('/api/design/upload', { method: 'POST', body: JSON.stringify({ dataUrl, session_id: DSG.cur }) });
      DSG.attach = { id: up.id, path: up.path };
      const pv = document.getElementById('dsg-attach-preview');
      pv.style.display = 'flex';
      pv.innerHTML = `<img src="${esc(up.path)}" alt="附件"><span>已传原图，发送=图生图</span><button class="iconbtn" id="dsg-attach-x" aria-label="移除"><svg class="ic" viewBox="0 0 24 24" width="16" height="16"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>`;
      document.getElementById('dsg-attach-x').onclick = () => { DSG.attach = null; pv.style.display = 'none'; pv.innerHTML = ''; };
    } catch (err) { toast(err.message); }
  };
  document.getElementById('dsg-inner').addEventListener('click', dsgMsgClick);
  await dsgLoadSession();
}
async function dsgLoadSession() {
  try {
    const d = await api(`/api/design/sessions/${DSG.cur}`);
    document.getElementById('dsg-title').textContent = d.session.style_no ? `${d.session.style_no} 设计` : (d.session.title || '设计台');
    DSG.messages = d.messages;
    dsgRenderMessages();
  } catch (e) { toast(e.message); viewDesign(); }
}
function dsgMetaLine(meta) {
  if (!meta || !meta.model) return '';
  return `<div class="dsg-meta">${esc(meta.model_name || meta.model)} · ${esc(meta.size || '')} · seed ${esc(String(meta.seed ?? ''))} · ${dsgCost(meta.cost)}</div>`;
}
function dsgRenderMessages() {
  const inner = document.getElementById('dsg-inner');
  if (!DSG.messages.length) {
    inner.innerHTML = `<div class="chat-empty"><h2>开始设计</h2><div>直接描述画面=文生图；先点 + 传原图再描述=图生图（改颜色、细节微调）。</div></div>`;
    return;
  }
  inner.innerHTML = DSG.messages.map((m) => {
    if (m.role === 'user') {
      const srcImg = m.image_id ? `<img class="dsg-srcimg" src="${esc(m.img_path || '')}" alt="原图">` : '';
      return `<div class="dsg-msg user"><div class="dsg-bubble">${srcImg}${m.text ? `<div>${esc(m.text)}</div>` : ''}</div></div>`;
    }
    const meta = m.meta || {};
    return `<div class="dsg-msg ai"><div class="dsg-bubble">
      ${m.image_id ? `<img class="dsg-img" data-full="${esc(m.img_path || '')}" src="${esc(m.img_thumb || m.img_path || '')}" alt="生成图">` : `<div class="muted">${esc(m.text || '（图片已删除）')}</div>`}
      ${dsgMetaLine(meta)}
      <div class="dsg-actions">
        <button class="btn ghost sm" data-regen="${m.id}">重新生成</button>
        <button class="btn ghost sm" data-delmsg="${m.id}">删除</button>
      </div>
    </div></div>`;
  }).join('');
  const body = document.getElementById('dsg-body');
  body.scrollTop = body.scrollHeight;
}
async function dsgMsgClick(e) {
  const img = e.target.closest('.dsg-img');
  if (img && img.dataset.full) {
    Modal.open({ title: '生成图', body: `<img src="${esc(img.dataset.full)}" style="width:100%;border-radius:12px" alt="生成图大图">` });
    return;
  }
  const regen = e.target.closest('[data-regen]');
  if (regen) {
    Modal.confirm({ title: '重新生成', body: '用相同参数换一个 seed 再生成一张吗？会产生新的费用。', okText: '重新生成', onOk: () => dsgRegenerate(Number(regen.dataset.regen)) });
    return;
  }
  const del = e.target.closest('[data-delmsg]');
  if (del) {
    Modal.confirm({ title: '删除消息', body: '删除这条消息吗？生成图会一并删除（文件+记录）。', okText: '删除', onOk: async () => {
      try { await api(`/api/design/messages/${del.dataset.delmsg}`, { method: 'DELETE' }); toast('已删除'); dsgLoadSession(); }
      catch (err) { toast(err.message); }
    }});
  }
}
async function dsgSend() {
  if (DSG.sending) return; // 防连点重复提交（一次只跑一张，省费用）
  const input = document.getElementById('dsg-input');
  const prompt = input.value.trim();
  if (!prompt && !DSG.attach) { toast('请输入描述或上传图片'); return; }
  if (!DSG.model) { toast('请先在管理设置里上架 visual 模型'); return; }
  DSG.sending = true;
  const sendBtn = document.getElementById('dsg-send');
  if (sendBtn) sendBtn.disabled = true;
  try {
    let prep;
    try {
      prep = await api('/api/design/prepare', { method: 'POST', body: JSON.stringify({
        prompt, image_id: DSG.attach ? DSG.attach.id : null,
        model_id: DSG.model, clarity: DSG.clarity, ratio: DSG.ratio,
      })});
    } catch (e) { toast(e.message); return; }
    // 2026-10-17 用户拍板：去掉二次确认，发送后直接生图（像正常聊天一样）
    input.value = '';
    const attachId = DSG.attach ? DSG.attach.id : null;
    DSG.attach = null;
    const pv = document.getElementById('dsg-attach-preview');
    if (pv) { pv.style.display = 'none'; pv.innerHTML = ''; }
    // 先行渲染用户消息 + 生成中占位
    DSG.messages.push({ id: 'tmp-u', role: 'user', text: prompt, image_id: attachId, img_path: prep.image_path });
    DSG.messages.push({ id: 'tmp-a', role: 'ai', text: '', image_id: null, meta: { model: prep.model_id, model_name: prep.model_name, size: prep.size, seed: prep.seed, cost: prep.cost, pending: true } });
    dsgRenderMessages();
    const inner = document.getElementById('dsg-inner');
    const pend = inner.lastElementChild;
    if (pend) pend.querySelector('.dsg-bubble').innerHTML = '<div class="dsg-generating"><span class="spin"></span>生成中…（最长约3分钟，可先干别的）</div>';
    try {
      await api('/api/design/generate', { method: 'POST', body: JSON.stringify({
        session_id: DSG.cur, prompt, image_id: attachId,
        model_id: DSG.model, clarity: DSG.clarity, ratio: DSG.ratio, seed: prep.seed,
      })});
      toast('已生成，记入资产库');
    } catch (e) { toast(e.message); }
    dsgLoadSession();
  } finally {
    DSG.sending = false;
    const sb = document.getElementById('dsg-send');
    if (sb) sb.disabled = false;
  }
}
async function dsgRegenerate(msgId) {
  DSG.messages.push({ id: 'tmp-r', role: 'ai', text: '', image_id: null, meta: { pending: true } });
  dsgRenderMessages();
  const inner = document.getElementById('dsg-inner');
  const pend = inner.lastElementChild;
  if (pend) pend.querySelector('.dsg-bubble').innerHTML = '<div class="dsg-generating"><span class="spin"></span>重新生成中…</div>';
  try {
    await api(`/api/design/messages/${msgId}/regenerate`, { method: 'POST' });
    toast('已生成，记入资产库');
  } catch (e) { toast(e.message); }
  dsgLoadSession();
}

// ---------- 资产库 ----------
const ASSETS = { list: [], kind: '', garment: '' };
async function viewAssets() {
  document.querySelector('.main').classList.remove('chat-mode');
  app.innerHTML = `
  <div class="page">
    <div class="page-head">
      <button class="iconbtn" data-menu aria-label="菜单"><svg class="ic" viewBox="0 0 24 24" width="20" height="20"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      <h1>资产库</h1>
    </div>
    <div class="dsg-controls">
      <select id="as-kind" class="dsg-sel">
        <option value="">全部类型</option>
        <option value="generate">生成图</option>
        <option value="upload">上传图</option>
      </select>
      <select id="as-garment" class="dsg-sel"><option value="">全部款</option></select>
    </div>
    <div id="as-grid" class="as-grid"></div>
  </div>`;
  document.getElementById('as-kind').onchange = (e) => { ASSETS.kind = e.target.value; asRender(); };
  document.getElementById('as-garment').onchange = (e) => { ASSETS.garment = e.target.value; asRender(); };
  await asLoad();
}
async function asLoad() {
  const q = new URLSearchParams();
  if (ASSETS.kind) q.set('kind', ASSETS.kind);
  if (ASSETS.garment) q.set('garment_id', ASSETS.garment);
  ASSETS.list = await api('/api/assets?' + q.toString()).catch(() => []);
  const gs = {};
  ASSETS.list.forEach((a) => { if (a.garment_id) gs[a.garment_id] = a.style_no || ('款' + a.garment_id); });
  const gsel = document.getElementById('as-garment');
  gsel.innerHTML = '<option value="">全部款</option>' + Object.entries(gs).map(([id, n]) =>
    `<option value="${id}"${ASSETS.garment === id ? ' selected' : ''}>${esc(n)}</option>`).join('');
  asRender();
}
function asRender() {
  const g = document.getElementById('as-grid');
  g.innerHTML = ASSETS.list.length ? ASSETS.list.map((a) => `
    <div class="as-card" data-id="${a.id}">
      <img loading="lazy" src="${esc(a.thumb_path || a.path)}" alt="资产图">
      <div class="as-meta">
        <div class="as-prompt">${esc((a.prompt || a.note || '').slice(0, 40) || (a.kind === 'upload' ? '上传图' : '生成图'))}</div>
        <div class="muted small">${esc(a.model || '')}${a.size ? ` · ${esc(a.size)}` : ''}</div>
      </div>
    </div>`).join('')
    : '<div class="empty">还没有图片资产。在设计台生成或上传图片后会自动记入这里。</div>';
  g.querySelectorAll('.as-card').forEach((c) => { c.onclick = () => asDetail(Number(c.dataset.id)); });
}
function asDetail(id) {
  const a = ASSETS.list.find((x) => x.id === id);
  if (!a) return;
  Modal.open({ title: '资产详情', body: `
    <img src="${esc(a.path)}" style="width:100%;border-radius:12px" alt="资产大图">
    <div class="frm-sec" style="margin-top:8px">
      <div class="frm-row"><span class="muted">类型</span><b>${a.kind === 'upload' ? '上传图' : '生成图'}</b></div>
      ${a.model ? `<div class="frm-row"><span class="muted">模型</span><b>${esc(a.model)}</b></div>` : ''}
      ${a.size ? `<div class="frm-row"><span class="muted">尺寸</span><b>${esc(a.size)}</b></div>` : ''}
      ${a.seed != null ? `<div class="frm-row"><span class="muted">seed</span><b>${esc(String(a.seed))}</b></div>` : ''}
      ${a.cost ? `<div class="frm-row"><span class="muted">费用</span><b>${dsgCost(a.cost)}</b></div>` : ''}
      ${a.prompt ? `<div class="frm-row"><span class="muted">描述</span><span>${esc(a.prompt)}</span></div>` : ''}
    </div>
    <label class="fl">备注</label>
    <textarea id="as-note" rows="2" placeholder="给这张图写点备注…">${esc(a.note || '')}</textarea>
    <div class="modal-foot">
      <button class="btn danger ghost" id="as-del">删除</button>
      <span style="flex:1"></span>
      <button class="btn ghost" id="as-cancel">关闭</button>
      <button class="btn" id="as-save">保存备注</button>
    </div>` });
  document.getElementById('as-cancel').onclick = () => Modal.close();
  document.getElementById('as-save').onclick = async () => {
    try {
      await api(`/api/assets/${id}`, { method: 'PUT', body: JSON.stringify({ note: document.getElementById('as-note').value }) });
      a.note = document.getElementById('as-note').value;
      toast('备注已保存'); Modal.close(); asRender();
    } catch (e) { toast(e.message); }
  };
  document.getElementById('as-del').onclick = () => {
    Modal.confirm({ title: '删除资产', body: '删除这张图片吗？文件和记录都会删，不可恢复。', okText: '删除', onOk: async () => {
      try {
        await api(`/api/assets/${id}`, { method: 'DELETE' });
        toast('已删除'); Modal.close();
        ASSETS.list = ASSETS.list.filter((x) => x.id !== id);
        asRender();
      } catch (e) { toast(e.message); }
    }});
  };
}


/* ---------- 西装产品视觉工作流（MVP） ---------- */
const VW = { products: [], current: null };
const VW_STATUS = { todo: '待开始', in_progress: '制作中', review: '待审核', approved: '已确认' };
async function viewVisualWorkflow(productId = null) {
  document.querySelector('.main').classList.remove('chat-mode');
  app.innerHTML = `
    <div class="page">
      <div class="page-head">
        <button class="iconbtn" data-menu aria-label="菜单"><svg class="ic" viewBox="0 0 24 24" width="20" height="20"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        <button class="iconbtn" id="vw-back" aria-label="返回设计台">‹</button>
        <h1>西装视觉工作流</h1>
        <button class="btn sm" id="vw-new">新建档案</button>
      </div>
      <div class="dsg-hint">每款西装独立管理产品特征与四类营销素材。这里先整理档案、提示词和审核状态；实际生成仍复用现有设计台。</div>
      <div id="vw-root"></div>
    </div>`;
  document.getElementById('vw-back').onclick = viewDesign;
  document.getElementById('vw-new').onclick = () => vwCreate();
  await vwLoad(productId);
}
async function vwLoad(productId = null) {
  const root = document.getElementById('vw-root');
  if (!root) return;
  try {
    VW.products = await api('/api/visual-workflow/products');
    if (productId) {
      VW.current = await api('/api/visual-workflow/products/' + productId);
      vwRenderDetail();
    } else {
      VW.current = null;
      root.innerHTML = VW.products.length ? `
        <div class="vw-grid">${VW.products.map(p => `
          <button class="card vw-product" data-vw-open="${p.id}">
            <div class="vw-product-top"><span class="muted small">${esc(p.style_no || '独立产品档案')}</span><span class="vw-progress">${p.approved_count || 0}/4 已确认</span></div>
            <h3>${esc(p.title)}</h3><p class="muted small">${esc(p.color || '颜色待定')} · ${esc(p.fit || '版型待定')} · ${esc(p.pieces || '套装待定')}</p>
            <div class="vw-progress-track"><span style="width:${Math.min(100, (p.approved_count || 0) * 25)}%"></span></div>
            <span class="muted small">编辑产品档案与素材任务 →</span>
          </button>`).join('')}</div>`
        : '<div class="empty">还没有视觉档案。先新建一款西装，系统会自动建立四类素材任务。</div>';
      root.querySelectorAll('[data-vw-open]').forEach(b => b.onclick = () => vwLoad(Number(b.dataset.vwOpen)));
    }
  } catch (e) { root.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
}
async function vwCreate() {
  const title = prompt('请输入产品名称，例如：黑色三件套婚礼西装');
  if (!title || !title.trim()) return;
  try {
    const p = await api('/api/visual-workflow/products', { method:'POST', body:JSON.stringify({ title: title.trim() }) });
    toast('已创建视觉档案'); await vwLoad(p.id);
  } catch (e) { toast(e.message); }
}
function vwRenderDetail() {
  const p = VW.current, root = document.getElementById('vw-root');
  if (!p || !root) return;
  root.innerHTML = `
    <div class="card vw-brief">
      <div class="vw-product-top"><div><div class="muted small">${esc(p.style_no || '独立产品档案')}</div><h2>${esc(p.title)}</h2></div><button class="btn sm" id="vw-save">保存档案</button></div>
      <div class="vw-fields">
        <label>产品名称<input id="vw-title" value="${esc(p.title)}" maxlength="120"></label>
        <label>主色<input id="vw-color" value="${esc(p.color)}" placeholder="如：黑色 / 深海军蓝"></label>
        <label>版型<select id="vw-fit">${[['slim','修身'],['regular','常规'],['relaxed','宽松']].map(([v,l])=>`<option value="${v}" ${p.fit===v?'selected':''}>${l}</option>`).join('')}</select></label>
        <label>套装组成<select id="vw-pieces">${[['two-piece','两件套'],['three-piece','三件套']].map(([v,l])=>`<option value="${v}" ${p.pieces===v?'selected':''}>${l}</option>`).join('')}</select></label>
        <label>驳头<select id="vw-lapel">${[['notch','平驳领'],['peak','戗驳领'],['shawl','青果领']].map(([v,l])=>`<option value="${v}" ${p.lapel===v?'selected':''}>${l}</option>`).join('')}</select></label>
        <label>扣型<select id="vw-buttons">${[['one','单扣'],['two','两粒扣'],['three','三粒扣']].map(([v,l])=>`<option value="${v}" ${p.buttons===v?'selected':''}>${l}</option>`).join('')}</select></label>
        <label>后开衩<select id="vw-vent">${[['single','单开衩'],['double','双开衩'],['none','不开衩']].map(([v,l])=>`<option value="${v}" ${p.vent===v?'selected':''}>${l}</option>`).join('')}</select></label>
        <label>面料参考<input id="vw-fabric" value="${esc(p.fabric_reference)}" placeholder="参考图 URL 或文件路径"></label>
        <label>正面参考<input id="vw-front" value="${esc(p.front_reference)}" placeholder="参考图 URL 或文件路径"></label>
        <label>背面参考<input id="vw-backref" value="${esc(p.back_reference)}" placeholder="参考图 URL 或文件路径"></label>
      </div>
      <label class="vw-notes-label">补充说明<textarea id="vw-notes" rows="3" placeholder="面料成分、纹样、不可改变的设计特征…">${esc(p.notes)}</textarea></label>
    </div>
    <h2 class="vw-section-title">四类营销素材</h2>
    <div class="vw-task-list">${p.tasks.map(t => `
      <section class="card vw-task">
        <div class="vw-task-head"><div><h3>${esc(t.title)}</h3><p class="muted small">${esc(t.brief)}</p></div><span class="vw-status" data-status="${t.status}">${VW_STATUS[t.status]}</span></div>
        <label>生成提示词<textarea rows="4" data-vw-prompt="${t.id}">${esc(t.prompt)}</textarea></label>
        <div class="vw-task-actions">
          <select data-vw-status="${t.id}">${Object.entries(VW_STATUS).map(([v,l])=>`<option value="${v}" ${t.status===v?'selected':''}>${l}</option>`).join('')}</select>
          <button class="btn ghost sm" data-vw-task-save="${t.id}">保存任务</button>
          <button class="btn sm" data-vw-to-design="${t.id}">去设计台生成</button>
        </div>
      </section>`).join('')}</div>`;
  document.getElementById('vw-save').onclick = async () => {
    const body = {
      title:document.getElementById('vw-title').value, color:document.getElementById('vw-color').value,
      fit:document.getElementById('vw-fit').value, pieces:document.getElementById('vw-pieces').value,
      lapel:document.getElementById('vw-lapel').value, buttons:document.getElementById('vw-buttons').value,
      vent:document.getElementById('vw-vent').value, fabric_reference:document.getElementById('vw-fabric').value,
      front_reference:document.getElementById('vw-front').value, back_reference:document.getElementById('vw-backref').value,
      notes:document.getElementById('vw-notes').value,
    };
    try { VW.current = await api('/api/visual-workflow/products/'+p.id,{method:'PATCH',body:JSON.stringify(body)}); toast('产品档案已保存'); vwRenderDetail(); }
    catch(e) { toast(e.message); }
  };
  root.querySelectorAll('[data-vw-task-save]').forEach(b => b.onclick = async () => {
    const id = Number(b.dataset.vwTaskSave);
    try {
      await api('/api/visual-workflow/tasks/'+id,{method:'PATCH',body:JSON.stringify({
        prompt:root.querySelector('[data-vw-prompt="'+id+'"]').value,
        status:root.querySelector('[data-vw-status="'+id+'"]').value,
      })});
      toast('任务已保存'); await vwLoad(p.id);
    } catch(e) { toast(e.message); }
  });
  root.querySelectorAll('[data-vw-to-design]').forEach(b => b.onclick = async () => {
    const id = Number(b.dataset.vwToDesign), task = p.tasks.find(t => t.id === id);
    try {
      sessionStorage.setItem('dsg_garment', JSON.stringify({ id:p.garment_id, visual_product_id:p.id, task_id:id, prompt:task.prompt, title:task.title }));
      await viewDesign();
      toast('请新建会话，将任务提示词复制到输入框后生成');
    } catch(e) { toast(e.message); }
  });
}
