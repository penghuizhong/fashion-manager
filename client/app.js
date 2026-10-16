/* 服装管理平台前端：vanilla JS + hash 路由，手机端优先 */
const $ = (s, el) => (el || document).querySelector(s);
const app = $('#app'), nav = $('#sidenav'), root = $('#app-root');
let CFG = { categories: {}, seasons: {}, statusLabel: {} };
let detailCache = null, curVer = null, curTab = 'size';

const ICON = {
  back: '<svg class="ic" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  menu: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  plus: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  cam: '<svg class="ic" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  x: '<svg class="ic" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  check: '<svg class="ic" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
  search: '<svg class="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
};

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
}
async function api(path, opt = {}) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opt });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `请求失败 ${r.status}`);
  return d;
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }); } catch { return ''; } };

function topbar(title, backTo) {
  return `<div class="topbar"><button class="menu-btn" data-menu aria-label="导航">${ICON.menu}</button>${backTo ? `<button class="back" data-go="${backTo}">${ICON.back}</button>` : ''}<div class="title">${esc(title)}</div></div>`;
}
function setNav(active) {
  nav.querySelectorAll('.navitem').forEach(b => b.classList.toggle('on', b.dataset.nav === active));
}

/* ---------------- 路由 ---------------- */
function route() {
  const h = location.hash || '#/';
  const parts = h.slice(2).split('/');
  // 弹窗是纯 DOM（挂 body），路由切换页面时必须手动清掉；模板弹窗地址本身除外
  const isTplModal = parts[0] === 'tpl' && !!parts[1]; // '#/tpl/:id' / '#/tpl/:id/edit' / '#/tpl/new' 都是弹窗地址
  if (!isTplModal && tplModalId !== null) {
    tplModalId = null; tplModalMode = 'view'; tplModalPushed = false; Modal.clear();
  }
  if (parts[0] === '' ) return viewList();
  if (parts[0] === 'new') return viewNew();
  if (parts[0] === 'g' && parts[1] && !parts[2]) return viewDetail(parts[1]);
  if (parts[0] === 'g' && parts[2] === 'sample') return viewSampleEdit(parts[1]);
  if (parts[0] === 'g' && parts[2] === 'version') return viewNewVersion(parts[1]);
  if (parts[0] === 'q' && parts[1]) return viewQuote(parts[1]);
  if (parts[0] === 'tpl' && parts[1] === 'new') { if (!(tplModalId === 'new' && tplModalMode === 'edit')) openTplModal(null, 'edit'); return; }
  if (parts[0] === 'tpl' && parts[2] === 'edit') { const eid = Number(parts[1]); if (!(tplModalId === eid && tplModalMode === 'edit')) openTplModal(eid, 'edit'); return; }
  if (parts[0] === 'tpl' && parts[1]) return viewTplList(parts[1]);
  if (parts[0] === 'tpl') return viewTplList();
  if (parts[0] === 'ai') return viewAi();
  if (parts[0] === 'design') return viewStub('设计台', '二期：一键改款出图、设计灵感库、样衣参考尺寸。');
  if (parts[0] === 'pattern') return viewStub('制版台', '二期：制版工具、公式计算器、纸样库。');
  return viewList();
}
window.addEventListener('hashchange', route);
nav.querySelectorAll('.navitem').forEach(b => b.onclick = () => {
  if (window.matchMedia('(max-width:768px)').matches) root.classList.remove('sidebar-open');
  location.hash = b.dataset.nav === 'sample' ? '#/' : '#/' + b.dataset.nav;
});

/* ---------------- 样衣台：款列表 ---------------- */
async function viewList() {
  setNav('sample');
  app.innerHTML = `${topbar('样衣台')}
    <div class="searchbar">${ICON.search}<input id="q" placeholder="搜索款号 / 款名" autocomplete="off"></div>
    <div class="page" style="padding-top:8px"><div id="list"></div></div>
    <button class="fab" id="fab">${ICON.plus}</button>`;
  $('#fab').onclick = () => location.hash = '#/new';
  const render = async () => {
    const q = $('#q').value.trim();
    let list;
    try { list = await api('/api/garments?q=' + encodeURIComponent(q)); }
    catch (e) { $('#list').innerHTML = `<div class="empty">加载失败：${esc(e.message)}</div>`; return; }
    $('#list').innerHTML = list.length ? list.map(g => `
      <div class="card tappable" data-id="${g.id}">
        <div class="rowline"><span class="style-no">${esc(g.style_no)}${g.latest_ver ? '-' + esc(g.latest_ver) : ''}</span>
          <span class="badge">${esc(CFG.statusLabel[g.status] || g.status)}</span></div>
        <div class="muted mt4">${esc(g.name)}</div>
        <div class="muted">更新 ${fmtDate(g.sample_updated || g.updated_at)}</div>
      </div>`).join('')
      : `<div class="empty">还没有款，点右下角 + 新建第一款</div>`;
    $('#list').querySelectorAll('.card').forEach(c => c.onclick = () => location.hash = '#/g/' + c.dataset.id);
  };
  let deb; $('#q').oninput = () => { clearTimeout(deb); deb = setTimeout(render, 300); };
  render();
}

/* ---------------- 新建款 ---------------- */
function viewNew() {
  const cats = Object.entries(CFG.categories).map(([k, v]) => `<option value="${k}">${k} · ${v}</option>`).join('');
  const seas = Object.entries(CFG.seasons).map(([k, v]) => `<option value="${k}">${k} · ${v}</option>`).join('');
  app.innerHTML = `${topbar('新建款', '#/')}
    <div class="page">
      <div class="card">
        <label class="fl">款名</label>
        <input id="f-name" placeholder="如：V领蕾丝网纱A字长裙">
        <label class="fl">类别</label><select id="f-cat">${cats}</select>
        <label class="fl">季节</label><select id="f-season">${seas}</select>
        <label class="fl">款号（自动生成）</label>
        <div class="style-no" id="f-preview" style="font-size:18px">—</div>
        <div class="muted mt4">规则：年份2位 + 季节1位 + 类别2位 + 流水3位</div>
      </div>
      <button class="btn" id="f-save">创建（自动建 V1 版次）</button>
    </div>`;
  const preview = () => {
    const yy = String(new Date().getFullYear() % 100);
    $('#f-preview').textContent = `${yy}${$('#f-season').value}-${$('#f-cat').value}-···`;
  };
  $('#f-cat').onchange = preview; $('#f-season').onchange = preview; preview();
  $('#f-save').onclick = async () => {
    const name = $('#f-name').value.trim();
    if (!name) return toast('请填写款名');
    try {
      const r = await api('/api/garments', { method: 'POST',
        body: JSON.stringify({ name, category: $('#f-cat').value, season: $('#f-season').value }) });
      toast(`已创建 ${r.style_no}`);
      location.hash = '#/g/' + r.id;
    } catch (e) { toast(e.message); }
  };
}

/* ---------------- 款详情 ---------------- */
async function viewDetail(gid) {
  setNav('sample');
  app.innerHTML = `${topbar('加载中…', '#/')}<div class="page"><div class="empty">加载中…</div></div>`;
  let d;
  try { d = await api('/api/garments/' + gid); }
  catch (e) { app.innerHTML = `${topbar('出错', '#/')}<div class="page"><div class="empty">${esc(e.message)}</div></div>`; return; }
  detailCache = d;
  if (!curVer || !d.versions.find(v => v.id === curVer.id)) curVer = d.versions[d.versions.length - 1];
  renderDetail();
}
function renderDetail() {
  const { garment: g, versions, samples, quotations } = detailCache;
  const sample = samples.find(s => s.version_id === curVer.id);
  const quotes = quotations.filter(q => q.sample_id === (sample && sample.id));
  const flowIdx = ['draft', 'sampling', 'confirmed'].indexOf(g.status);
  const flow = ['draft', 'sampling', 'confirmed'].map((s, i) =>
    `${i ? '<span class="ln"></span>' : ''}<span class="st ${i <= flowIdx ? 'done' : ''}"><span class="dot ${i <= flowIdx ? 'on' : ''}"></span>${CFG.statusLabel[s]}</span>`
  ).join('');
  const nextLabel = { draft: '推进到样衣', sampling: '推进到已确认' }[g.status];
  const tabs = [['size', '尺寸'], ['mat', '面辅料'], ['craft', '工艺'], ['photo', '照片'], ['quote', '报价']];
  let body = '';
  if (curTab === 'size') body = sample.size_table.length ? sample.size_table.map(r =>
    `<div class="frow"><input value="${esc(r.part)}" disabled><input value="${esc(r.value)}" disabled style="max-width:110px"><span class="muted">cm</span></div>`).join('')
    : `<div class="empty">还没有尺寸，去「录入样衣」添加</div>`;
  if (curTab === 'mat') body = sample.materials.length ? sample.materials.map(m =>
    `<div class="card" style="margin-bottom:8px"><div class="rowline"><span class="grow"><b>${esc(m.name)}</b>${m.part ? ` · ${esc(m.part)}` : ''}</span></div>
     <div class="muted mt4">${m.usage_num ? `用量 ${esc(m.usage_num)}${esc(m.unit || '')}` : ''}${m.price ? ` · 单价 ¥${esc(m.price)}` : ''}${m.supplier ? ` · ${esc(m.supplier)}` : ''}</div></div>`).join('')
    : `<div class="empty">还没有面辅料，去「录入样衣」添加</div>`;
  if (curTab === 'craft') body =
    `<div class="card"><div class="muted">工艺描述</div><div class="mt4">${esc(sample.craft_desc) || '<span class="muted">未填写</span>'}</div></div>
     <div class="card"><div class="muted">批版意见 / 试穿记录</div><div class="mt4">${esc(sample.fitting_notes) || '<span class="muted">未填写</span>'}</div></div>`;
  if (curTab === 'photo') body = sample.photos.length
    ? `<div class="photogrid">${sample.photos.map(p => `<img class="photo" src="${esc(p)}" loading="lazy">`).join('')}</div>`
    : `<div class="empty">还没有照片，去「录入样衣」拍照上传</div>`;
  if (curTab === 'quote') body = quotes.length ? quotes.map(q =>
    `<div class="card tappable" data-q="${q.id}"><div class="rowline"><span class="grow"><b>¥${q.price}</b></span>
      <span class="badge ${q.status === 'draft' ? 'dim' : ''}">${{ draft: '草稿', sent: '已发送', accepted: '已成交' }[q.status]}</span></div>
      <div class="muted mt4">${esc(q.customer) || '未填客户'} · ${fmtDate(q.updated_at)}</div></div>`).join('')
    : `<div class="empty">还没有报价单</div>`;

  app.innerHTML = `${topbar(`${g.style_no}-${curVer.ver}`, '#/')}
  <div class="page" style="padding-top:10px">
    <div class="rowline"><span class="grow" style="font-weight:700">${esc(g.name)}</span>
      <span class="badge">${CFG.statusLabel[g.status]}</span></div>
    <div class="flow">${flow}</div>
    ${nextLabel ? `<button class="btn ghost" id="d-next">${nextLabel}</button>` : `<div class="muted" style="text-align:center">该款已确认归档</div>`}
    <div class="vers mt8">${versions.map(v =>
      `<button class="ver ${v.id === curVer.id ? 'on' : ''}" data-ver="${v.id}">${esc(v.ver)}</button>`).join('')}
      <button class="ver add" id="d-newver">+ 新版次</button></div>
    ${curVer.note ? `<div class="muted">改版说明：${esc(curVer.note)}</div>` : ''}
    <div class="btnrow mt8">
      <button class="btn" id="d-edit">录入样衣</button>
      <button class="btn ghost" id="d-quote">报价单</button>
    </div>
    <div class="tabs mt12">${tabs.map(([k, l]) => `<button class="tab ${curTab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
    <div id="d-body">${body}</div>
  </div>`;

  app.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => {
    curVer = versions.find(v => v.id === +b.dataset.ver); renderDetail();
  });
  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { curTab = b.dataset.tab; renderDetail(); });
  app.querySelectorAll('[data-q]').forEach(c => c.onclick = () => location.hash = '#/q/' + c.dataset.q);
  const nx = $('#d-next');
  if (nx) nx.onclick = async () => {
    const order = { draft: 'sampling', sampling: 'confirmed' };
    try { await api(`/api/garments/${g.id}`, { method: 'PATCH', body: JSON.stringify({ status: order[g.status] }) }); toast('状态已推进'); }
    catch (e) { toast(e.message); }
    detailCache = null; viewDetail(g.id);
  };
  $('#d-edit').onclick = () => location.hash = `#/g/${g.id}/sample`;
  $('#d-newver').onclick = () => location.hash = `#/g/${g.id}/version`;
  $('#d-quote').onclick = async () => {
    if (!sample) return toast('样衣不存在');
    if (quotes.length) { location.hash = '#/q/' + quotes[0].id; return; }
    try {
      const r = await api('/api/quotations', { method: 'POST',
        body: JSON.stringify({ sample_id: sample.id, terms: 'FOB 广州 · 生产 7–15 天 · 报价有效期 30 天' }) });
      location.hash = '#/q/' + r.id;
    } catch (e) { toast(e.message); }
  };
}

/* ---------------- 样衣录入 ---------------- */
async function viewSampleEdit(gid) {
  const d = await api('/api/garments/' + gid).catch(e => ({ _err: e.message }));
  if (d._err) { app.innerHTML = `${topbar('出错', '#/g/' + gid)}<div class="page"><div class="empty">${esc(d._err)}</div></div>`; return; }
  const ver = curVer && d.versions.find(v => v.id === curVer.id) || d.versions[d.versions.length - 1];
  const s = d.samples.find(x => x.version_id === ver.id);
  const sizeRows = s.size_table.map(r =>
    `<div class="frow"><input data-k="part" value="${esc(r.part)}" placeholder="部位，如胸围"><input data-k="value" value="${esc(r.value)}" placeholder="数值" style="max-width:100px" inputmode="decimal"><span class="muted">cm</span><button class="del" data-del>${ICON.x}</button></div>`).join('');
  const matRows = s.materials.map(m =>
    `<div class="card" style="margin-bottom:8px" data-mat>
      <div class="frow"><input data-k="name" value="${esc(m.name)}" placeholder="名称，如蕾丝网纱" class="grow"><button class="del" data-del>${ICON.x}</button></div>
      <div class="frow"><input data-k="part" value="${esc(m.part)}" placeholder="使用部位"><input data-k="usage_num" value="${esc(m.usage_num)}" placeholder="用量" inputmode="decimal" style="max-width:90px"><input data-k="unit" value="${esc(m.unit)}" placeholder="单位" style="max-width:70px"></div>
      <div class="frow"><input data-k="price" value="${esc(m.price)}" placeholder="单价 ¥" inputmode="decimal"><input data-k="supplier" value="${esc(m.supplier)}" placeholder="供应商"></div>
    </div>`).join('');
  app.innerHTML = `${topbar(`录入样衣 · ${d.garment.style_no}-${ver.ver}`, '#/g/' + gid)}
  <div class="page">
    <div class="card"><div style="font-weight:700;margin-bottom:6px">尺寸表（cm）</div>
      <div id="e-size">${sizeRows}</div>
      <button class="addline" id="e-addsize">+ 添加部位</button></div>
    <div class="card"><div style="font-weight:700;margin-bottom:6px">面辅料明细</div>
      <div id="e-mat">${matRows}</div>
      <button class="addline" id="e-addmat">+ 添加面辅料</button>
      <label class="fl">工费（¥）</label><input id="e-labor" inputmode="decimal" value="${esc(s.labor_cost || '')}" placeholder="样衣/大货工费"></div>
    <div class="card"><label class="fl" style="margin-top:0">工艺描述</label>
      <textarea id="e-craft" placeholder="缝制工艺、细节要求…">${esc(s.craft_desc)}</textarea>
      <label class="fl">批版意见 / 试穿记录</label>
      <textarea id="e-fit" placeholder="试穿反馈、改版意见…">${esc(s.fitting_notes)}</textarea></div>
    <div class="card"><div style="font-weight:700;margin-bottom:6px">样衣照片</div>
      <div class="photogrid" id="e-photos">${s.photos.map(p => `<img class="photo" src="${esc(p)}">`).join('')}</div>
      <button class="addline mt8" id="e-addphoto">${ICON.cam} 拍照 / 上传</button>
      <input type="file" id="e-file" accept="image/*" style="display:none"></div>
    <button class="btn" id="e-save">保存样衣</button>
  </div>`;

  const bindDel = (root) => root.querySelectorAll('[data-del]').forEach(b =>
    b.onclick = () => b.closest('.frow,[data-mat]').remove());
  bindDel(app);
  $('#e-addsize').onclick = () => {
    const div = document.createElement('div'); div.className = 'frow';
    div.innerHTML = `<input data-k="part" placeholder="部位，如胸围"><input data-k="value" placeholder="数值" style="max-width:100px" inputmode="decimal"><span class="muted">cm</span><button class="del" data-del>${ICON.x}</button>`;
    $('#e-size').appendChild(div); bindDel(div);
  };
  $('#e-addmat').onclick = () => {
    const div = document.createElement('div'); div.className = 'card'; div.style.marginBottom = '8px'; div.dataset.mat = '';
    div.innerHTML = `<div class="frow"><input data-k="name" placeholder="名称，如蕾丝网纱" class="grow"><button class="del" data-del>${ICON.x}</button></div>
      <div class="frow"><input data-k="part" placeholder="使用部位"><input data-k="usage_num" placeholder="用量" inputmode="decimal" style="max-width:90px"><input data-k="unit" placeholder="单位" style="max-width:70px"></div>
      <div class="frow"><input data-k="price" placeholder="单价 ¥" inputmode="decimal"><input data-k="supplier" placeholder="供应商"></div>`;
    $('#e-mat').appendChild(div); bindDel(div);
  };
  const photos = [...s.photos];
  $('#e-addphoto').onclick = () => $('#e-file').click();
  $('#e-file').onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    toast('上传中…');
    try {
      const dataUrl = await compressImage(f);
      const r = await api(`/api/samples/${s.id}/photos`, { method: 'POST', body: JSON.stringify({ dataUrl }) });
      photos.push(r.path);
      const img = document.createElement('img'); img.className = 'photo'; img.src = r.path;
      $('#e-photos').appendChild(img); toast('已上传');
    } catch (e) { toast(e.message); }
    ev.target.value = '';
  };
  $('#e-save').onclick = async () => {
    const size_table = [...$('#e-size').querySelectorAll('.frow')].map(r => ({
      part: r.querySelector('[data-k=part]').value.trim(), value: r.querySelector('[data-k=value]').value.trim() }));
    const materials = [...$('#e-mat').querySelectorAll('[data-mat]')].map(c => {
      const g = k => c.querySelector(`[data-k=${k}]`).value.trim(); return { name: g('name'), part: g('part'), usage_num: g('usage_num'), unit: g('unit'), price: g('price'), supplier: g('supplier') }; });
    try {
      await api(`/api/samples/${s.id}`, { method: 'PUT', body: JSON.stringify({
        size_table, materials, craft_desc: $('#e-craft').value, fitting_notes: $('#e-fit').value,
        labor_cost: $('#e-labor').value, photos }) });
      toast('已保存'); detailCache = null; location.hash = '#/g/' + gid;
    } catch (e) { toast(e.message); }
  };
}
function compressImage(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const max = 1280, sc = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.82));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => rej(new Error('图片读取失败'));
    img.src = URL.createObjectURL(file);
  });
}

/* ---------------- 新版次 ---------------- */
async function viewNewVersion(gid) {
  const d = await api('/api/garments/' + gid).catch(e => ({ _err: e.message }));
  if (d._err) { app.innerHTML = `${topbar('出错', '#/g/' + gid)}<div class="page"><div class="empty">${esc(d._err)}</div></div>`; return; }
  const vers = d.versions;
  const next = 'V' + (Math.max(...vers.map(v => v.ver_num)) + 1);
  app.innerHTML = `${topbar(`新版次 · ${d.garment.style_no}`, '#/g/' + gid)}
  <div class="page"><div class="card">
    <div class="rowline"><span class="muted">新版次</span><span class="style-no" style="font-size:18px">${next}</span></div>
    <label class="fl">改版说明</label>
    <textarea id="v-note" placeholder="如：V2 腰围收 2cm，领口加深"></textarea>
    <label class="fl">复制来源</label>
    <select id="v-copy">${vers.map(v => `<option value="${v.id}" ${v.id === curVer?.id ? 'selected' : ''}>${v.ver}（复制尺寸/面辅料/工艺/照片）</option>`).join('')}
    <option value="">不复制，从空开始</option></select>
  </div>
  <button class="btn" id="v-save">创建 ${next}</button></div>`;
  $('#v-save').onclick = async () => {
    try {
      const r = await api(`/api/garments/${gid}/versions`, { method: 'POST',
        body: JSON.stringify({ note: $('#v-note').value.trim(), copy_from: +$('#v-copy').value || null }) });
      toast(`已创建 ${r.ver}`); detailCache = null; curVer = { id: r.id };
      location.hash = '#/g/' + gid;
    } catch (e) { toast(e.message); }
  };
}

/* ---------------- 报价单 ---------------- */
async function viewQuote(qid) {
  let q;
  try { q = await api('/api/quotations/' + qid); }
  catch (e) { app.innerHTML = `${topbar('出错', '#/')}<div class="page"><div class="empty">${esc(e.message)}</div></div>`; return; }
  const rows = q.items.map(i =>
    `<div class="frow"><input data-k="label" value="${esc(i.label)}" class="grow"><input data-k="amount" value="${esc(i.amount)}" inputmode="decimal" style="max-width:110px"><button class="del" data-del>${ICON.x}</button></div>`).join('');
  app.innerHTML = `${topbar('报价单', '#/g/' + q.garment_id)}
  <div class="page">
    <div class="card"><div style="font-weight:700;margin-bottom:6px">成本明细</div>
      <div id="q-items">${rows}</div>
      <button class="addline" id="q-add">+ 添加一项</button>
      <div class="rowline mt8"><span class="muted grow">成本合计</span><b id="q-cost" class="style-no">¥0</b></div></div>
    <div class="card">
      <label class="fl" style="margin-top:0">客户</label><input id="q-cust" value="${esc(q.customer)}" placeholder="如 Suse LiebeSuse（德国）">
      <label class="fl">利润率 %</label><input id="q-margin" inputmode="decimal" value="${esc(q.margin)}">
      <div class="bigprice">¥ <span id="q-price" contenteditable="true" style="border-bottom:1px dashed var(--border);min-width:80px;display:inline-block">${esc(q.price)}</span></div>
      <div class="muted" style="text-align:center">最终报价可手动改（点数字直接改）</div>
      <label class="fl">条款</label><textarea id="q-terms">${esc(q.terms)}</textarea>
      <label class="fl">状态</label>
      <select id="q-status">${['draft', 'sent', 'accepted'].map(s => `<option value="${s}" ${q.status === s ? 'selected' : ''}>${{ draft: '草稿', sent: '已发送', accepted: '已成交' }[s]}</option>`).join('')}</select>
    </div>
    <div class="btnrow"><button class="btn ghost" id="q-copy">复制报价文本</button><button class="btn" id="q-save">保存</button></div>
    <div class="muted mt8" style="text-align:center">纪律：草稿先行，价格你定，确认后再发客户</div>
  </div>`;

  const recalc = () => {
    const items = [...$('#q-items').querySelectorAll('.frow')].map(r => ({
      label: r.querySelector('[data-k=label]').value.trim(), amount: +r.querySelector('[data-k=amount]').value || 0 }));
    const cost = items.reduce((a, x) => a + x.amount, 0);
    $('#q-cost').textContent = '¥' + (Math.round(cost * 100) / 100);
    return items;
  };
  const autoPrice = () => {
    const cost = +$('#q-cost').textContent.slice(1) || 0;
    const m = +$('#q-margin').value || 0;
    $('#q-price').textContent = Math.round(cost * (1 + m / 100) * 100) / 100;
  };
  $('#q-items').addEventListener('input', () => { recalc(); autoPrice(); });
  $('#q-items').addEventListener('click', e => { if (e.target.closest('[data-del]')) { e.target.closest('.frow').remove(); recalc(); autoPrice(); } });
  $('#q-add').onclick = () => {
    const div = document.createElement('div'); div.className = 'frow';
    div.innerHTML = `<input data-k="label" placeholder="项目" class="grow"><input data-k="amount" placeholder="¥" inputmode="decimal" style="max-width:110px"><button class="del" data-del>${ICON.x}</button>`;
    $('#q-items').appendChild(div);
  };
  $('#q-margin').oninput = autoPrice;
  recalc();
  $('#q-save').onclick = async () => {
    const items = recalc();
    try {
      await api('/api/quotations/' + qid, { method: 'PUT', body: JSON.stringify({
        customer: $('#q-cust').value.trim(), items, margin: +$('#q-margin').value || 0,
        price: +$('#q-price').textContent || 0, terms: $('#q-terms').value, status: $('#q-status').value }) });
      toast('已保存');
    } catch (e) { toast(e.message); }
  };
  $('#q-copy').onclick = async () => {
    try {
      const r = await api('/api/quotations/' + qid + '/text');
      await navigator.clipboard.writeText(r.text);
      toast('报价文本已复制，去阿里/微信粘贴');
    } catch (e) { toast('复制失败：' + e.message); }
  };
}

/* ---------------- 回复模板库 v0.3.0（逻辑模板 × 语言变体 × 类型化变量） ---------------- */
const TPL_SCENE = { first: '首回', ask: '追问', quote: '报价', nudge: '跟进' };
const SCENE_ORDER = ['first', 'ask', 'quote', 'nudge'];
const VAR_TYPES = ['text', 'number', 'date'];
const VAR_TYPE_ZH = { text: '文本', number: '数字', date: '日期' };
let tplQuery = '';
let tplTagFilter = '';
let tagCache = null;
async function loadTags(force) {
  if (tagCache && !force) return tagCache;
  tagCache = await api('/api/tags');
  return tagCache;
}
const TAG_GROUPS = ['款式', '轮廓', '领型', '袖型', '元素', '面料属性', '颜色', '话题'];

/* ---------- 列表：QA 模式（Q 场景句 + A 中文首句预览），点卡开弹窗 ---------- */
let tplCurrentIds = [];
// A 预览：中文对照首句，变量替换为【中文名】
const aPreview = (t) => {
  const first = (t.gloss_zh || '').split('\n').find((l) => l.trim()) || '';
  if (!first) return '';
  const varMap = {};
  (t.vars || []).forEach((v) => { varMap[v.name] = '【' + (v.label_zh || v.name) + '】'; });
  return first.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => varMap[k] || '');
};
/* ================= 全局弹窗组件（项目内所有弹窗统一用它） =================
* 用法：
* Modal.open({ title, body, onClose}) // 打开；若已打开则原地换内容，不重播动画
* Modal.setTitle(t) / Modal.setBody(html) // 更新
* Modal.close() // 用户关闭（触发 onClose）
* Modal.clear() // 静默关闭（不触发 onClose，供 popstate / 页面跳转用）
* Modal.isOpen()
* Modal.confirm({ title, body, okText, onOk}) // 确认框
* 样式：.modal-backdrop /.modal-sheet（styles.css 全局）
* 历史由调用方管理（pushState / popstate），组件只管 DOM + Esc + 点遮罩。
* 弹窗挂在 document.body（Portal 式），不受 app.innerHTML 重绘影响。
*/
const Modal = (() => {
let onCloseCb = null, beforeCloseCb = null, keyHandler = null;
const isOpen = () =>!!document.querySelector('#global-modal-root .modal-backdrop');
const rootEl = () => {
let r = document.getElementById('global-modal-root');
if (!r) { r = document.createElement('div'); r.id = 'global-modal-root'; document.body.appendChild(r);}
return r;
};
function open({ title = '', body = '', onClose = null, onBeforeClose = null} = {}) {
if (isOpen()) { setTitle(title); setBody(body); onCloseCb = onClose; beforeCloseCb = onBeforeClose; return; }
rootEl().innerHTML = `<div class="modal-backdrop" id="m-bg"><div class="modal-sheet" id="m-sheet">
<div class="modal-head"><span class="modal-title">${esc(title)}</span>
<button class="modal-x" id="m-close" aria-label="关闭">×</button></div>
<div class="modal-body" id="m-body">${body}</div></div></div>`;
onCloseCb = onClose; beforeCloseCb = onBeforeClose;
const b = document.getElementById('m-close');
if (b) b.onclick = close;
const bg = document.getElementById('m-bg');
if (bg) bg.onclick = (e) => { if (e.target.id === 'm-bg') close();};
if (keyHandler) document.removeEventListener('keydown', keyHandler);
keyHandler = (e) => { if (e.key === 'Escape') close();};
document.addEventListener('keydown', keyHandler);
}
function setTitle(t) { const el = document.querySelector('#m-sheet .modal-title'); if (el) el.textContent = t;}
function setBody(html) { const el = document.getElementById('m-body'); if (el) el.innerHTML = html;}
function close() {
// onBeforeClose 返回 false = 调用方接管关闭（如编辑态原地切回使用模式），不清壳
if (beforeCloseCb && beforeCloseCb() === false) return;
const cb = onCloseCb; clear(); if (cb) cb();}
function clear() {
const r = document.getElementById('global-modal-root');
if (r) r.innerHTML = '';
onCloseCb = null; beforeCloseCb = null;
if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null;}
}
function confirm({ title = '确认', body = '', okText = '确定', onOk = null} = {}) {
open({ title, body: `${body}<div class="modal-foot">
<button class="btn ghost" id="m-cancel">取消</button>
<button class="btn" id="m-ok">${esc(okText)}</button></div>`, onClose: null});
const ok = document.getElementById('m-ok');
if (ok) ok.onclick = () => { clear(); if (onOk) onOk();};
const cancel = document.getElementById('m-cancel');
if (cancel) cancel.onclick = () => clear();
}
return { open, setTitle, setBody, close, clear, isOpen, confirm};
})();

/* ---------- 列表：QA 模式（Q 场景句 + A 中文首句预览），点卡开纯弹窗 ---------- */
let tplLastList = []; // 列表数据（含各语言正文），弹窗直接取用，零请求
let snippetCache = []; // 落款片段，随列表一次返回
let tplModalId = null; // 当前弹窗的模板 id（number | 'new'），null = 未打开
let tplModalMode = 'view'; // 当前弹窗模式：'view' 使用 / 'edit' 编辑（同壳双模式）
let tplModalPushed = false;// 本次弹窗是否 push 过历史

// 模板弹窗历史同步：浏览器前进/后退时开/关弹窗（不走路由重绘）
function syncTplModalFromHistory() {
const h = location.hash || '#/';
const parts = h.slice(2).split('/');
if (parts[0] === 'tpl' && parts[1] === 'new') {
if (!(tplModalId === 'new' && tplModalMode === 'edit')) { tplModalPushed = true; openTplModal(null, 'edit'); }
} else if (parts[0] === 'tpl' && parts[1] && parts[2] === 'edit') {
const id = Number(parts[1]);
if (!(tplModalId === id && tplModalMode === 'edit')) { tplModalPushed = true; openTplModal(id, 'edit'); }
} else if (parts[0] === 'tpl' && parts[1]) {
const id = Number(parts[1]);
if (!(tplModalId === id && tplModalMode === 'view')) { tplModalPushed = true; openTplModal(id, 'view'); }
} else if (tplModalId !== null) {
tplModalPushed = false; tplModalId = null; tplModalMode = 'view'; Modal.clear();
}
}
window.addEventListener('popstate', syncTplModalFromHistory);

async function viewTplList(openId, force) {
setNav('tpl');
if (document.getElementById('t-list') && !force) {
if (openId && !(tplModalId === Number(openId) && tplModalMode === 'view')) openTplModal(Number(openId), 'view');
return;
}
app.innerHTML = `${topbar('回复模板库')}
<div class="page" style="padding-top:10px">
<input id="t-q" class="searchbar" placeholder="搜索：编号 / 标题 / 正文 / 使用说明" value="${esc(tplQuery)}" autocomplete="off">
<div class="rowline mt8" style="gap:8px">
<select id="t-tag" style="flex:1"><option value="">全部标签</option></select>
<button class="btn ghost" id="t-new">+ 新增模板</button>
</div>
<div id="t-list" class="mt8"><div class="empty">加载中…</div></div>
</div>`;
const tagSel = $('#t-tag');
loadTags().then((tags) => {
tagSel.innerHTML = '<option value="">全部标签</option>' + TAG_GROUPS.map((g) => {
const items = tags.filter((x) => x.grp === g);
if (!items.length) return '';
return `<optgroup label="${g}">${items.map((x) =>
`<option value="${esc(x.name)}" ${tplTagFilter === x.name ? 'selected' : ''}>${esc(x.name)}${x.used ? ` (${x.used})` : ''}</option>`).join('')}</optgroup>`;
}).join('');
}).catch(() => {});
tagSel.onchange = (e) => { tplTagFilter = e.target.value; load(); };
$('#t-new').onclick = () => {
history.pushState({ tplModal: 'new', tplMode: 'edit' }, '', '#/tpl/new');
tplModalPushed = true;
openTplModal(null, 'edit');
};
const rowHtml = (t) => {
if (!tplCurrentIds.includes(t.id)) tplCurrentIds.push(t.id); // 常用+分组重复展示，导航列表去重
const q = t.note_zh || t.title;
const a = aPreview(t);
const tagHtml = (t.tags && t.tags.length)? `<div class="rowline mt4" style="flex-wrap:wrap;gap:4px">${t.tags.map((g) =>
`<span class="tchip sm">${esc(g.name)}</span>`).join('')}</div>`: '';
return `
<div class="card tappable qa-card" data-id="${t.id}">
<div class="rowline" style="gap:6px;margin-bottom:6px"><span class="tchip">${esc(t.key)}</span>${t.usage_count > 0 ? `<span class="muted" style="font-size:11px;margin-left:auto">用过${t.usage_count}</span>` : ''}</div>
<div class="qa-line"><span class="qa-mark q">Q</span><span class="qa-qtext">${esc(q)}</span></div>
${a? `<div class="qa-line"><span class="qa-mark a">A</span><span class="qa-atext">${esc(a)}</span></div>`: ''}
${tagHtml}
</div>`;
};
const draw = (data) => {
tplLastList = data.templates || [];
snippetCache = data.snippets || [];
const list = tplLastList;
tplCurrentIds = [];
const el = $('#t-list');
if (!list.length) { el.innerHTML = `<div class="empty">没有符合的模板，换个关键词或新增一条</div>`; return;}
let h = '';
if (!tplQuery.trim()) {
const fav = list.filter((t) => t.usage_count > 0).slice(0, 5);
if (fav.length) h += `<div class="sechead">常用</div>` + fav.map(rowHtml).join('');
}
for (const sc of SCENE_ORDER) {
const g = list.filter((t) => t.scene === sc);
if (g.length) h += `<div class="sechead">${TPL_SCENE[sc]}</div>` + g.map(rowHtml).join('');
}
const rest = list.filter((t) =>!SCENE_ORDER.includes(t.scene));
if (rest.length) h += `<div class="sechead">其他</div>` + rest.map(rowHtml).join('');
el.innerHTML = h;
el.querySelectorAll('.card').forEach((c) => c.onclick = () => {
// 纯弹窗：pushState 只记地址（不触发 hashchange、不走路由重绘），同步开弹窗
const id = Number(c.dataset.id);
history.pushState({ tplModal: id}, '', '#/tpl/' + id);
tplModalPushed = true;
openTplModal(id);
});
};
let timer = null;
const load = async () => {
try {
const qs = [];
if (tplQuery.trim()) qs.push('q=' + encodeURIComponent(tplQuery.trim()));
if (tplTagFilter) qs.push('tag=' + encodeURIComponent(tplTagFilter));
draw(await api('/api/reply-templates' + (qs.length? '?' + qs.join('&'): '')));
}
catch (e) { $('#t-list').innerHTML = `<div class="empty">加载失败：${esc(e.message)}</div>`;}
};
$('#t-q').oninput = (e) => {
tplQuery = e.target.value;
clearTimeout(timer);
timer = setTimeout(load, 350);
};
await load();
if (openId) openTplModal(openId);
}

/* ---------- 模板弹窗：同步渲染（数据已在列表里，零等待） ---------- */
/* ---------- 话术卡弹窗：使用 / 编辑双模式（同壳复用，编辑不再是新弹窗 UI） ---------- */
async function openTplModal(id, mode = 'view', opts = {}) {
const isNew = id === null || id === undefined;
const isEdit = mode === 'edit';
// 保证列表页在弹窗底下（直链进入时）；opts.skipList 时不强制渲染（如从 AI 助手直接弹窗）
if (!opts.skipList && !document.getElementById('t-list')) await viewTplList();
let t = null;
if (!isNew) {
t = (tplLastList || []).find((x) => x.id === Number(id));
if (!t) {
try { t = await api('/api/reply-templates/' + id);}
catch (e) { toast('模板不存在'); history.replaceState(null, '', '#/tpl'); return;}
}
}
const tid = isNew? 'new': Number(t.id);
tplModalId = tid; tplModalMode = mode;

/* ---- 使用模式状态 ---- */
const viewState = { slots: {}};
/* ---- 编辑模式状态 ---- */
const editState = {
scene: t? t.scene: 'first',
category: t? t.category: '通用',
note_zh: t? t.note_zh: '',
gloss_zh: t? (t.gloss_zh || ''): '',
source_buyer: t? t.source_buyer: '',
vars: t? t.vars.map((v) => ({...v})): [],
tag_ids: [],
};
if (!isNew) {
try {
const cur = await api('/api/reply-templates/' + t.id + '/tags');
editState.tag_ids = cur.map((x) => x.id);
} catch (e) { /* 打标失败不阻塞编辑 */ }
}

/* ---- 使用模式 ---- */
const idx = () => tplCurrentIds.indexOf(t? t.id: -1);
const go = (delta) => {
const i = idx() + delta;
if (i < 0 || i >= tplCurrentIds.length) return;
const nid = tplCurrentIds[i];
// 换地址但不进 history、不触发路由；返回键仍回到列表
history.replaceState({ tplModal: nid}, '', '#/tpl/' + nid);
openTplModal(nid, 'view');
};
const expandLocal = (body, lang) =>
body.replace(/\{\{\s*snippet:([a-z_]+)\s*\}\}/g, (_, k) => {
const s = snippetCache.find((x) => x.key === k && x.lang === lang)
|| snippetCache.find((x) => x.key === k && x.lang === 'EN');
return s? s.body: '';
});
const missing = () => (t.vars || [])
.filter((v) => v.required &&!String(viewState.slots[v.name] || '').trim());
// 话术框 HTML：已填值高亮，未填显示
const boxHTML = () => {
const raw = t.gloss_zh || '（暂无中文对照，请到编辑页补充中文对照）';
const expanded = expandLocal(raw, 'ZH');
return expanded.split(/(\{\{\s*[a-z_]+\s*\}\})/g).map((p) => {
const m = p.match(/^\{\{\s*([a-z_]+)\s*\}\}$/);
if (!m) return esc(p);
const v = (t.vars || []).find((x) => x.name === m[1]);
const val = viewState.slots[m[1]];
if (val) return `<mark class="slotval">${esc(val)}</mark>`;
return `<span class="slotempty"></span>`;
}).join('');
};
const viewBodyHTML = () => `
${(t.vars || []).length? `<div class="mt8" id="m-slots">${t.vars.map((v) => `
<label class="fl" style="margin-top:8px">${esc(v.label_zh || v.name)}${v.required? ' <span style="color:var(--danger)">*</span>': ''}
<span class="muted" style="font-weight:400"> · ${VAR_TYPE_ZH[v.type] || '文本'}</span></label>
${v.type === 'date'
? `<input type="date" data-slot="${esc(v.name)}" value="${esc(viewState.slots[v.name] || '')}">`
: `<input data-slot="${esc(v.name)}" value="${esc(viewState.slots[v.name] || '')}"
${v.type === 'number'? 'inputmode="decimal"': ''}
placeholder="${v.sample? '如：' + esc(v.sample): '填写' + esc(v.label_zh || v.name)}">`
}`).join('')}</div>`: ''}
<div class="talkbox" id="m-box"></div>
<div class="modal-controls">
<button class="btn" id="m-copy"></button>
<div class="miss" id="m-miss"></div>
<div class="muted" style="text-align:center;font-size:11px">红线：必填项没填时不许复制 · 粘贴到阿里消息中心，平台自动翻译</div>
</div>
<div class="btnrow mt8">
<button class="btn ghost" id="m-prev" ${idx() <= 0? 'disabled': ''}>← 上一条</button>
<button class="btn ghost" id="m-next" ${idx() >= tplCurrentIds.length - 1? 'disabled': ''}>下一条 →</button>
<button class="btn ghost" id="m-edit">编辑</button>
</div>`;

/* ---- 编辑模式（复用使用模式的布局骨架：变量区→话术区→按钮区） ---- */
const scanVars = () => {
const found = [];
const re = /\{\{\s*([a-z_]+)\s*\}\}/g; let m;
while ((m = re.exec(editState.gloss_zh))) if (!found.includes(m[1])) found.push(m[1]);
found.forEach((name) => {
if (!editState.vars.some((v) => v.name === name)) {
editState.vars.push({ name, type: name === 'price' || name === 'quantity'? 'number': 'text',
required: name === 'price' || name === 'lead_time'? 1: 0, label_zh: name, sample: ''});
}
});
editState.vars = editState.vars.filter((v) => found.includes(v.name));
};
const editBodyHTML = () => `
<div class="mt8">
<div class="frow">
<div class="grow"><label class="fl" style="margin-top:0">场景</label>
<select id="f-scene">${Object.entries(TPL_SCENE).map(([k, v]) =>
`<option value="${k}" ${editState.scene === k? 'selected': ''}>${v}</option>`).join('')}</select></div>
<div class="grow"><label class="fl" style="margin-top:0">分类</label>
<input id="f-cat" value="${esc(editState.category)}" placeholder="如：通用/西装/晚礼服"></div>
</div>
<label class="fl">使用说明（什么时候用）</label>
<input id="f-note" value="${esc(editState.note_zh)}" placeholder="一句话中文说明">
<label class="fl">变量管理（${editState.vars.length} 个）</label>
<div id="f-vars">${editState.vars.map((v, i) => `
<div class="varrow">
<div class="rowline"><code style="font-weight:700">{{${esc(v.name)}}}</code>
<label style="font-size:12px;display:flex;align-items:center;gap:4px">
<input type="checkbox" data-vi="${i}" data-k="required" ${v.required? 'checked': ''} style="width:auto"> 必填</label>
<button class="chip" data-vdel="${i}">删除</button></div>
<div class="frow mt4">
<div class="grow"><input data-vi="${i}" data-k="label_zh" value="${esc(v.label_zh)}" placeholder="中文名"></div>
<div class="grow"><select data-vi="${i}" data-k="type">${VAR_TYPES.map((tp) =>
`<option value="${tp}" ${v.type === tp? 'selected': ''}>${VAR_TYPE_ZH[tp]}</option>`).join('')}</select></div>
</div>
<input class="mt4" data-vi="${i}" data-k="sample" value="${esc(v.sample)}" placeholder="示例值（输入框提示用），如 175">
</div>`).join('') || '<div class="muted">暂无变量，点"从话术扫描变量"</div>'}
</div>
<div class="btnrow mt8"><button class="btn ghost" id="f-scan">从话术扫描变量</button></div>
<label class="fl">中文话术</label>
<div class="seg" style="margin-top:0" id="f-insert">
<button class="chip" data-ins="{{snippet:signature}}">+ 落款片段</button>
${editState.vars.map((v) => `<button class="chip" data-ins="{{${esc(v.name)}}}">+ ${esc(v.name)}</button>`).join('')}
</div>
<textarea id="f-gloss" style="min-height:180px" placeholder="中文话术，填空位用 {{变量名}}，落款用 {{snippet:signature}}">${esc(editState.gloss_zh)}</textarea>
<label class="fl">来源（可选）</label>
<input id="f-src" value="${esc(editState.source_buyer)}" placeholder="如 marlen-kell-rosario">
<label class="fl">打标（只能选词表内的词，不许手写）</label>
<div id="f-tags"><div class="muted">标签加载中…</div></div>
<div class="btnrow mt8">
<button class="btn" id="f-save">${isNew? '创建模板': '保存修改'}</button>
<button class="btn ghost" id="f-cancel">取消</button>
</div>
${isNew? '': '<button class="btn danger mt8" id="f-del">删除整个模板</button>'}
</div>`;

/* ---- 渲染（同壳：Modal.open 已开时只换内容，不重播动画） ---- */
const title = () => isEdit? (isNew? '新增模板': '编辑模板'): (t.note_zh || t.title);
const bodyHTML = () => isEdit? editBodyHTML(): viewBodyHTML();
const onClose = () => {
const wasPushed = tplModalPushed;
tplModalId = null; tplModalMode = 'view'; tplModalPushed = false;
// push 进来的用 history.back() 回到上一级（编辑→使用，使用→列表）；直链进来的直接改地址
if (wasPushed) history.back();
else history.replaceState(null, '', '#/tpl');
};
// 关闭拦截：编辑态的 ×/Esc/点遮罩/取消 = 原地切回使用模式，不清壳（同壳复用）
const onBeforeClose = () => {
if (tplModalMode !== 'edit') return true; // 使用态：正常关闭
if (isNew) return true; // 新建无使用态：正常关闭（onClose 回列表）
const wasPushed = tplModalPushed;
if (wasPushed) history.back(); // popstate 原地切回使用模式
else { history.replaceState(null, '', '#/tpl/' + t.id); openTplModal(t.id, 'view'); }
return false; // 拦截关闭，壳留着
};
const mb = () => document.querySelector('#m-body');
const viewRefresh = () => {
const box = document.getElementById('m-box');
if (box) box.innerHTML = boxHTML();
const m = missing();
const copyBtn = document.getElementById('m-copy');
if (copyBtn) { copyBtn.textContent = '复制文本'; copyBtn.classList.toggle('dim', m.length > 0);}
const miss = document.getElementById('m-miss');
if (miss) miss.textContent = m.length? '还差：' + m.map((v) => v.label_zh || v.name).join('、'): '';
};
const bindView = () => {
mb().querySelectorAll('[data-slot]').forEach((i) => {
i.oninput = () => { viewState.slots[i.dataset.slot] = i.value; viewRefresh();};
});
const copyBtn = mb().querySelector('#m-copy');
if (copyBtn) copyBtn.onclick = async () => {
const m = missing();
if (m.length) return toast(`红线：${m.map((v) => v.label_zh || v.name).join('、')}不能为空，填好再复制`);
try {
const r = await api(`/api/reply-templates/${t.id}/render`, {
method: 'POST', body: JSON.stringify({ lang: 'ZH', slots: viewState.slots}),
});
await navigator.clipboard.writeText(r.text);
api(`/api/reply-templates/${t.id}/use`, { method: 'POST'}).catch(() => {});
toast('已复制，去阿里消息中心粘贴');
} catch (e) { toast(e.message);}
};
const prevBtn = mb().querySelector('#m-prev');
if (prevBtn) prevBtn.onclick = () => go(-1);
const nextBtn = mb().querySelector('#m-next');
if (nextBtn) nextBtn.onclick = () => go(1);
const editBtn = mb().querySelector('#m-edit');
if (editBtn) editBtn.onclick = () => {
history.pushState({ tplModal: t.id, tplMode: 'edit'}, '', '#/tpl/' + t.id + '/edit');
tplModalPushed = true;
openTplModal(t.id, 'edit');
};
viewRefresh();
};
const syncEditFromDOM = () => {
const g = (sel) => mb().querySelector(sel);
if (g('#f-scene')) editState.scene = g('#f-scene').value;
if (g('#f-cat')) editState.category = g('#f-cat').value;
if (g('#f-note')) editState.note_zh = g('#f-note').value;
if (g('#f-gloss')) editState.gloss_zh = g('#f-gloss').value;
if (g('#f-src')) editState.source_buyer = g('#f-src').value;
};
const bindEdit = () => {
const renderTagChecks = async () => {
const box = mb().querySelector('#f-tags');
if (!box) return;
try {
const tags = await loadTags();
box.innerHTML = TAG_GROUPS.map((g) => {
const items = tags.filter((x) => x.grp === g);
if (!items.length) return '';
return `<div class="mt8"><div class="muted" style="font-size:12px;margin-bottom:4px">${g}</div>
<div class="tagchecks">${items.map((x) =>
`<label class="tchip${editState.tag_ids.includes(x.id) ? ' on' : ''}"><input type="checkbox" data-tag="${x.id}" ${editState.tag_ids.includes(x.id) ? 'checked' : ''} style="display:none">${esc(x.name)}</label>`
).join('')}</div></div>`;
}).join('');
box.querySelectorAll('[data-tag]').forEach((cb) => {
cb.onchange = () => {
const id = Number(cb.dataset.tag);
const lbl = cb.closest('.tchip');
if (cb.checked) { if (!editState.tag_ids.includes(id)) editState.tag_ids.push(id); lbl.classList.add('on'); }
else { editState.tag_ids = editState.tag_ids.filter((x) => x !== id); lbl.classList.remove('on'); }
};
});
} catch (e) { box.innerHTML = `<div class="muted">标签加载失败：${esc(e.message)}</div>`; }
};
renderTagChecks();
mb().querySelectorAll('#f-insert.chip').forEach((b) => {
b.onclick = () => {
const ta = mb().querySelector('#f-gloss');
const s = ta.selectionStart || 0, e = ta.selectionEnd || 0;
ta.value = ta.value.slice(0, s) + b.dataset.ins + ta.value.slice(e);
ta.focus();
};
});
mb().querySelector('#f-scan').onclick = () => { syncEditFromDOM(); scanVars(); repaint(); toast(`已扫描出 ${editState.vars.length} 个变量`);};
mb().querySelectorAll('[data-vi]').forEach((el) => {
el.oninput = el.onchange = () => {
const v = editState.vars[+el.dataset.vi];
if (!v) return;
v[el.dataset.k] = el.type === 'checkbox'? (el.checked? 1: 0): el.value;
};
});
mb().querySelectorAll('[data-vdel]').forEach((b) => {
b.onclick = () => { editState.vars.splice(+b.dataset.vdel, 1); syncEditFromDOM(); repaint();};
});
['f-scene', 'f-cat', 'f-note', 'f-gloss', 'f-src'].forEach((fid) => {
const el = mb().querySelector('#' + fid);
if (el) el.oninput = (e) => {
if (fid === 'f-scene') editState.scene = e.target.value;
else if (fid === 'f-cat') editState.category = e.target.value;
else if (fid === 'f-note') editState.note_zh = e.target.value;
else if (fid === 'f-gloss') editState.gloss_zh = e.target.value;
else editState.source_buyer = e.target.value;
};
});
mb().querySelector('#f-save').onclick = async () => {
syncEditFromDOM();
if (!editState.gloss_zh.trim()) return toast('中文话术不能为空');
const body = { scene: editState.scene, category: editState.category.trim() || '通用',
note_zh: editState.note_zh.trim(), gloss_zh: editState.gloss_zh.trim(),
source_buyer: editState.source_buyer.trim(), vars: editState.vars};
try {
let savedId = t? t.id: null;
if (isNew) { const r = await api('/api/reply-templates', { method: 'POST', body: JSON.stringify(body)}); savedId = r.id; toast('已创建');}
else { await api('/api/reply-templates/' + t.id, { method: 'PUT', body: JSON.stringify(body)}); toast('已保存');}
if (savedId) await api('/api/reply-templates/' + savedId + '/tags', { method: 'PUT', body: JSON.stringify({ tag_ids: editState.tag_ids }) });
await viewTplList(null, true);
Modal.close();
} catch (e) { toast(e.message);}
};
mb().querySelector('#f-cancel').onclick = () => Modal.close();
const delBtn = mb().querySelector('#f-del');
if (delBtn) delBtn.onclick = () => {
syncEditFromDOM();
Modal.setTitle('删除模板');
Modal.setBody(`<div class="mt8"><p>确定删除整个模板？删除后无法恢复。</p>
<div class="btnrow mt8">
<button class="btn danger" id="f-del-ok">删除</button>
<button class="btn ghost" id="f-del-cancel">取消</button>
</div></div>`);
mb().querySelector('#f-del-ok').onclick = async () => {
try {
await api('/api/reply-templates/' + t.id, { method: 'DELETE'});
toast('已删除');
await viewTplList(null, true);
tplModalId = null; tplModalMode = 'view'; tplModalPushed = false;
history.replaceState(null, '', '#/tpl');
Modal.clear();
} catch (e) { toast(e.message);}
};
mb().querySelector('#f-del-cancel').onclick = () => { Modal.setTitle('编辑模板'); repaint();};
};
};
const repaint = () => { Modal.setBody(bodyHTML()); if (isEdit) bindEdit(); else bindView();};
Modal.open({ title: title(), body: bodyHTML(), onClose, onBeforeClose });
if (isEdit) bindEdit(); else bindView();
}

/* ---------------- 占位 ---------------- */
function viewStub(title, desc) {
  const map = { '设计台': 'design', '样衣台': 'sample', '制版台': 'pattern' };
  setNav(map[title]);
  app.innerHTML = `${topbar(title)}<div class="page"><div class="empty">${esc(desc)}<br><br>该模块即将上线，<br>从左侧导航切到「样衣台」开始用。</div></div>`;
}

/* ---------------- AI 客服（v0.8.0） ---------------- */
async function viewAi() {
  setNav('ai');
  app.innerHTML = `${topbar('AI 客服')}
  <div class="page">
    <div id="ai-warn"></div>
    <textarea id="ai-msg" rows="4" placeholder="粘贴买家消息，AI 从话术库选模板并填空"></textarea>
    <button class="btn" id="ai-go" style="width:100%;margin-top:8px">生成话术</button>
    <div id="ai-result" class="mt8"></div>
  </div>`;
  const warn = $('#ai-warn'), ta = $('#ai-msg'), go = $('#ai-go'), res = $('#ai-result');
  let hasKey = false;
  try { hasKey = !!(await api('/api/admin/config')).has_key; }
  catch (e) { warn.innerHTML = `<div class="miss">配置读取失败：${esc(e.message)}</div>`; }
  if (!hasKey) {
    warn.innerHTML = `<div class="card ai-warnbox"><div>请先配置模型服务，才能使用 AI 客服。</div><button class="btn ghost" id="ai-open-admin">去配置</button></div>`;
    go.disabled = true; go.classList.add('dim');
    const oa = $('#ai-open-admin');
    if (oa) oa.onclick = () => openAdminModal();
  }
  go.onclick = async () => {
    const message = ta.value.trim();
    if (!message) return toast('请先粘贴买家消息');
    go.disabled = true; res.innerHTML = '<div class="muted">AI 生成中…</div>';
    try {
      const d = await api('/api/ai/assist', { method: 'POST', body: JSON.stringify({ message }) });
      aiRenderOptions(d, message);
    } catch (e) { res.innerHTML = `<div class="miss">${esc(e.message)}</div>`; }
    finally { go.disabled = false; }
  };
}
/* Top-3 选项卡 */
function aiRenderOptions(d, message) {
  const res = $('#ai-result');
  const opts = d.options || [];
  if (!opts.length) { res.innerHTML = '<div class="miss">没有匹配的话术</div>'; return; }
  res.innerHTML = `<div class="muted" style="margin-bottom:8px">AI 推荐 ${opts.length} 条，点击选用：</div>` +
    opts.map((o, i) => `
    <div class="card tappable" data-tid="${o.template_id}" style="margin-bottom:8px">
      <div class="rowline" style="gap:6px;margin-bottom:4px">
        <span class="tchip">${esc(o.template_key)}</span>
        ${o.recommended ? '<span class="tchip hot">推荐</span>' : ''}
        <span class="muted" style="font-size:12px">${esc(o.note_zh || '')}</span>
      </div>
      <div style="font-size:13px;color:var(--muted)">${esc(o.preview)}</div>
    </div>`).join('');
  res.querySelectorAll('.card').forEach((c) => {
    c.onclick = async () => {
      const tid = Number(c.dataset.tid);
      const rank = Array.from(res.querySelectorAll('.card')).indexOf(c);
      res.innerHTML = '<div class="muted">加载话术…</div>';
      try {
        const r = await api('/api/ai/assist/select', { method: 'POST', body: JSON.stringify({ template_id: tid, message, rank }) });
        aiRenderResult(r);
      } catch (e) { res.innerHTML = `<div class="miss">${esc(e.message)}</div>`; }
    };
  });
}
function aiRenderResult(d) {
  const res = $('#ai-result');
  const miss = (d.missing && d.missing.length) ? d.missing : [];
  res.innerHTML = `
  <div class="card">
    <div class="muted">出处：${esc(d.template_key)} · ${esc(d.note_zh || '')}</div>
    <div class="talkbox mt8">${esc(d.filled_text)}</div>
    ${miss.length ? `<div class="miss">红线：${miss.map(esc).join('、')}未填写，填好才能复制</div>` : '<div class="miss"></div>'}
    <button class="btn" id="ai-copy" style="width:100%;margin-top:8px">复制话术</button>
    <button class="btn ghost" id="ai-edit-tpl" style="width:100%;margin-top:8px">编辑这条话术</button>
    <div class="muted" style="text-align:center;margin-top:6px">红线：必填项没填时不许复制 · 粘贴到阿里消息中心，平台自动翻译</div>
  </div>`;
  const cp = $('#ai-copy');
  if (cp) cp.onclick = async () => {
    if (miss.length) return toast(`红线：${miss.join('、')}不能为空，填好再复制`);
    try {
      await navigator.clipboard.writeText(d.filled_text);
      api(`/api/reply-templates/${d.template_id}/use`, { method: 'POST' }).catch(() => {});
      toast('已复制，去阿里消息中心粘贴');
    } catch (e) { toast('复制失败：' + e.message); }
  };
  const et = $('#ai-edit-tpl');
  if (et) et.onclick = () => openTplModal(d.template_id, 'edit', { skipList: true });
}

/* ---------------- 管理设置弹窗（全局 Modal + 横向滑动二级导航） ---------------- */
let adminTab = 'model';
function openAdminModal() {
  adminTab = 'model';
  Modal.open({ title: '管理设置', body: adminBodyHTML() });
  bindAdmin();
}
function adminBodyHTML() {
  return `<div class="admin-tabs">
    <button class="atab ${adminTab === 'model' ? 'on' : ''}" data-atab="model">模型服务</button>
    <button class="atab ${adminTab === 'tags' ? 'on' : ''}" data-atab="tags">标签词表</button>
    <button class="atab ${adminTab === 'tpl' ? 'on' : ''}" data-atab="tpl">模板台</button>
    <button class="atab ${adminTab === 'price' ? 'on' : ''}" data-atab="price">模型价格</button>
    <button class="atab ${adminTab === 'mgmt' ? 'on' : ''}" data-atab="mgmt">模型管理</button>
    <button class="atab ${adminTab === 'stats' ? 'on' : ''}" data-atab="stats">统计</button>
  </div><div id="admin-pane">${adminTab === 'model' ? adminModelHTML() : adminTab === 'tags' ? adminTagsHTML() : adminTab === 'price' ? adminPriceHTML() : adminTab === 'mgmt' ? '<div class="admin-mgmt"><div class="empty">加载中…</div></div>' : adminTab === 'stats' ? '<div class="admin-stats"><div class="empty">加载中…</div></div>' : '<div id="admin-tpl"><div class="empty">加载中…</div></div>'}</div>`;
}
function adminPriceHTML() {
  return `<div class="admin-price">
    <div class="frm-sec" style="font-weight:700">模型价格（USD / 1K tokens）</div>
    <div class="frm-hint">价格与实际调用数据关联，用量看板自动算成本</div>
    <div id="aprice-list"><div class="empty">加载中…</div></div>
    <div class="frm-row" style="margin-top:8px">
      <input id="aprice-model" placeholder="模型ID" class="grow2">
      <input id="aprice-in" type="number" step="0.0001" min="0" placeholder="输入价" style="width:80px">
      <input id="aprice-out" type="number" step="0.0001" min="0" placeholder="输出价" style="width:80px">
      <button class="btn sm" id="aprice-add">添加</button>
    </div>
    <div class="frm-sec" style="font-weight:700;margin-top:12px">用量看板</div>
    <div id="aprice-usage"><div class="empty">加载中…</div></div>
  </div>`;
}
function adminModelHTML() {
  return `<div id="admin-model-form">
    <label class="fl">API Key <span class="muted">（已设置时留空不覆盖）</span></label>
    <input type="password" id="adm-key" placeholder="未设置，请输入" autocomplete="off">
    <label class="fl">Base URL</label>
    <input id="adm-base" autocomplete="off">
    <div class="btnrow frm-row">
      <button class="btn ghost" id="adm-models">刷新模型列表</button>
      <button class="btn ghost" id="adm-test">测试连通性</button>
    </div>
    <div class="frm-hint" id="adm-models-msg"></div>
    <label class="fl">对话模型 <span class="muted">（话术选择用）</span></label>
    <select id="adm-chat"><option value="">请先刷新模型列表</option></select>
    <label class="fl">后台模型 <span class="muted">（关键词理解用，可选便宜快的）</span></label>
    <select id="adm-backend"><option value="">请先刷新模型列表</option></select>
    <div class="frm-sec" style="font-weight:700;margin-top:4px">视觉模型（识图）</div>
    <label class="fl">供应商</label>
    <select id="adm-vision-provider">
      <option value="openrouter">OpenRouter（默认）</option>
      <option value="custom">自定义</option>
    </select>
    <label class="fl">Vision API Key <span class="muted">（已设置时留空不覆盖）</span></label>
    <input id="adm-vision-key" type="password" autocomplete="off" placeholder="已设置（留空不修改）">
    <label class="fl">Vision Base URL</label>
    <input id="adm-vision-url" autocomplete="off" placeholder="如 https://openrouter.ai/api/v1">
    <div class="frm-row">
      <button class="btn ghost grow1" id="adm-vision-pull">拉取模型列表</button>
      <button class="btn ghost grow1" id="adm-vision-test">测试连通性</button>
    </div>
    <label class="fl">视觉模型</label>
    <select id="adm-vision"><option value="">请先拉取模型列表</option></select>
    <div class="frm-sec" style="font-weight:700;margin-top:4px">向量模型（Embedding）</div>
    <label class="fl">Embedding API Key <span class="muted">（已设置时留空不覆盖）</span></label>
    <input id="adm-emb-key" type="password" autocomplete="off" placeholder="已设置（留空不修改）">
    <label class="fl">Embedding Base URL</label>
    <input id="adm-emb-url" autocomplete="off" placeholder="如 https://dashscope.aliyuncs.com/compatible-mode/v1">
    <div class="frm-row">
      <button class="btn ghost grow1" id="adm-emb-pull">拉取模型列表</button>
      <button class="btn ghost grow1" id="adm-emb-test">测试连通性</button>
    </div>
    <label class="fl">向量模型</label>
    <select id="adm-emb"><option value="">请先拉取模型列表</option></select>
    <button class="btn frm-sec" id="adm-save">保存</button>
    <div class="miss" id="adm-msg"></div>
  </div>`;
}
let adminModelList = [];
async function adminLoadModels() {
  const msg = document.getElementById('adm-models-msg');
  const btn = document.getElementById('adm-models');
  if (msg) msg.textContent = '拉取中…';
  if (btn) btn.disabled = true;
  try {
    const r = await api('/api/admin/models');
    adminModelList = r.models || [];
    if (msg) msg.textContent = `共 ${adminModelList.length} 个可用模型`;
    const fill = (id, val) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '<option value="">不指定</option>' + adminModelList.map((m) =>
        `<option value="${esc(m)}" ${m === val ? 'selected' : ''}>${esc(m)}</option>`).join('');
    };
    const cfg = await api('/api/admin/config').catch(() => ({}));
    fill('adm-chat', cfg.chat_model || '');
    fill('adm-backend', cfg.backend_model || '');
    fill('adm-vision', cfg.vision_model || '');
  } catch (e) {
    if (msg) msg.textContent = '拉取失败：' + e.message;
  } finally {
    if (btn) btn.disabled = false;
  }
}
function adminTagsHTML() {
  return `<div id="admin-tags">
    <div class="frm-row">
      <input id="tag-new-name" placeholder="新标签名" class="grow2">
      <select id="tag-new-grp" class="grow1">${TAG_GROUPS.map((g) => `<option>${g}</option>`).join('')}</select>
      <button class="btn sm" id="tag-add">新增</button>
    </div>
    <div class="frm-hint">改名/删除/合并即时生效；删除标签会清除它的全部打标关联。</div>
    <div id="tag-list"><div class="empty">加载中…</div></div>
  </div>`;
}
async function adminTagsBind() {
  const box = document.getElementById('tag-list');
  if (!box) return;
  const draw = async () => {
    let tags;
    try { tags = await api('/api/tags'); tagCache = tags; }
    catch (e) { box.innerHTML = `<div class="empty">加载失败：${esc(e.message)}</div>`; return; }
    box.innerHTML = TAG_GROUPS.map((g) => {
      const items = tags.filter((x) => x.grp === g);
      if (!items.length) return '';
      return `<div class="mt8"><div class="muted" style="font-size:12px;margin-bottom:4px">${g}（${items.length}）</div>
      ${items.map((x) => `<div class="tagrow" data-id="${x.id}">
        <span class="tchip sm">${esc(x.name)}${x.used ? ` <span class="muted">×${x.used}</span>` : ''}</span>
        <span class="tagops">
          <button class="chip" data-act="rename">改名</button>
          <button class="chip" data-act="merge">合并</button>
          <button class="chip danger" data-act="del">删除</button>
        </span></div>`).join('')}</div>`;
    }).join('') || '<div class="empty">暂无标签</div>';
    box.querySelectorAll('.tagrow').forEach((row) => {
      const id = Number(row.dataset.id);
      const cur = tags.find((x) => x.id === id);
      row.querySelector('[data-act="rename"]').onclick = async () => {
        const name = prompt('改名：', cur.name);
        if (!name || !name.trim() || name.trim() === cur.name) return;
        try { await api('/api/tags/' + id, { method: 'PUT', body: JSON.stringify({ name: name.trim() }) }); toast('已改名'); draw(); }
        catch (e) { toast(e.message); }
      };
      row.querySelector('[data-act="del"]').onclick = async () => {
        if (!confirm(`删除标签「${cur.name}」？它的打标关联会一并清除。`)) return;
        try { await api('/api/tags/' + id, { method: 'DELETE' }); toast('已删除'); draw(); }
        catch (e) { toast(e.message); }
      };
      row.querySelector('[data-act="merge"]').onclick = async () => {
        const others = tags.filter((x) => x.id !== id && x.grp === cur.grp);
        if (!others.length) return toast('同组没有其他标签可合并');
        const name = prompt(`把「${cur.name}」合并到哪个标签？\n可选：` + others.map((x) => x.name).join('、'));
        if (!name) return;
        const to = others.find((x) => x.name === name.trim());
        if (!to) return toast('标签名不对，请照抄');
        try { await api('/api/tags/merge', { method: 'POST', body: JSON.stringify({ from_id: id, to_id: to.id }) }); toast(`已合并到「${to.name}」`); draw(); }
        catch (e) { toast(e.message); }
      };
    });
  };
  document.getElementById('tag-add').onclick = async () => {
    const name = document.getElementById('tag-new-name').value.trim();
    const grp = document.getElementById('tag-new-grp').value;
    if (!name) return toast('标签名不能为空');
    try {
      await api('/api/tags', { method: 'POST', body: JSON.stringify({ name, grp }) });
      document.getElementById('tag-new-name').value = '';
      toast('已新增'); draw();
    } catch (e) { toast(e.message); }
  };
  await draw();
}
/* 管理弹窗内的模板台 tab：精简列表，点击卡片直接编辑 */
async function adminTplBind() {
  const pane = document.getElementById('admin-tpl');
  if (!pane) return;
  pane.innerHTML = `
    <div class="frm-row">
      <input id="atpl-q" class="searchbar" placeholder="搜索：编号 / 标题 / 正文" autocomplete="off">
      <button class="btn sm" id="atpl-new">新增</button>
    </div>
    <div id="atpl-list"><div class="empty">加载中…</div></div>`;
  const listEl = document.getElementById('atpl-list');
  const qEl = document.getElementById('atpl-q');
  let timer = null;
  const load = async () => {
    const q = qEl.value.trim();
    try {
      const d = await api('/api/reply-templates' + (q ? '?q=' + encodeURIComponent(q) : ''));
      const list = d.templates || [];
      if (!list.length) { listEl.innerHTML = '<div class="empty">没有符合的模板</div>'; return; }
      listEl.innerHTML = list.map((t) => `
        <div class="card tappable" data-id="${t.id}" style="margin-bottom:8px">
          <div class="rowline" style="gap:6px;margin-bottom:4px">
            <span class="tchip">${esc(t.key)}</span>
            <span class="muted" style="font-size:12px">${esc(t.note_zh || t.title || '')}</span>
          </div>
          <div style="font-size:13px;color:var(--muted)">${esc((t.gloss_zh || '').slice(0, 60))}${(t.gloss_zh || '').length > 60 ? '…' : ''}</div>
        </div>`).join('');
      listEl.querySelectorAll('.card').forEach((c) => {
        c.onclick = () => openTplModal(Number(c.dataset.id), 'edit', { skipList: true });
      });
    } catch (e) {
      listEl.innerHTML = `<div class="empty">加载失败：${esc(e.message)}</div>`;
    }
  };
  qEl.oninput = () => { clearTimeout(timer); timer = setTimeout(load, 350); };
  document.getElementById('atpl-new').onclick = () => openTplModal(null, 'edit', { skipList: true });
  await load();
}
/* 任务26b: 模型价格 + 用量看板 */
async function adminPriceBind() {
  const body = document.querySelector('#m-body .admin-price');
  if (!body) return;
  const listEl = document.getElementById('aprice-list');
  const usageEl = document.getElementById('aprice-usage');
  const loadPrices = async () => {
    try {
      const prices = await api('/api/admin/model-prices');
      listEl.innerHTML = prices.map((pr) => `
        <div class="frm-row" style="align-items:center">
          <span style="flex:1;font-size:13px">${esc(pr.model_id)}</span>
          <input type="number" step="0.0001" min="0" data-pid="${esc(pr.model_id)}" data-field="input_price"
            value="${pr.input_price}" style="width:90px" placeholder="输入$/1K">
          <input type="number" step="0.0001" min="0" data-pid="${esc(pr.model_id)}" data-field="output_price"
            value="${pr.output_price}" style="width:90px" placeholder="输出$/1K">
        </div>`).join('') || '<div class="empty">暂无价格，点击下方添加</div>';
    } catch (e) { listEl.innerHTML = `<div class="empty">加载失败</div>`; }
  };
  const loadUsage = async () => {
    try {
      const u = await api('/api/admin/usage?days=30');
      usageEl.innerHTML = `
        <div class="frm-sec">近30天：${u.total.calls || 0} 次调用，$${Number(u.total.cost || 0).toFixed(4)}</div>` +
        (u.by_model || []).map((r) => `
        <div class="frm-row" style="font-size:13px">
          <span style="flex:1">${esc(r.model)}</span>
          <span class="muted">${r.calls}次 / $${Number(r.cost).toFixed(4)}</span>
        </div>`).join('');
    } catch (e) { usageEl.innerHTML = '<div class="empty">加载失败</div>'; }
  };
  document.getElementById('aprice-add').onclick = async () => {
    const mid = document.getElementById('aprice-model').value.trim();
    const inp = Number(document.getElementById('aprice-in').value) || 0;
    const out = Number(document.getElementById('aprice-out').value) || 0;
    if (!mid) return toast('请填模型ID');
    await api('/api/admin/model-prices', { method: 'PUT', body: JSON.stringify({ model_id: mid, input_price: inp, output_price: out }) });
    toast('已保存');
    loadPrices();
  };
  // 价格输入框失焦自动保存
  listEl.onchange = async (e) => {
    const el = e.target;
    if (!el.dataset.pid) return;
    const pid = el.dataset.pid;
    const row = listEl.querySelectorAll(`[data-pid="${CSS.escape(pid)}"]`);
    const inp = listEl.querySelector(`[data-pid="${CSS.escape(pid)}"][data-field="input_price"]`).value;
    const out = listEl.querySelector(`[data-pid="${CSS.escape(pid)}"][data-field="output_price"]`).value;
    await api('/api/admin/model-prices', { method: 'PUT', body: JSON.stringify({ model_id: pid, input_price: Number(inp) || 0, output_price: Number(out) || 0 }) });
  };
  await loadPrices();
  await loadUsage();
}
/* 模型管理 tab */
async function adminMgmtBind() {
  const wrap = document.querySelector('#m-body .admin-mgmt');
  if (!wrap) return;
  let cats = {};
  try {
    const d = await api('/api/admin/model-providers');
    cats = d.categories || {};
  } catch (e) {}
  const catKeys = Object.keys(cats);
  // 渲染分类 + 供应商配置 + 上架表单
  wrap.innerHTML = `
    <div class="frm-sec" style="font-weight:700">上架新模型</div>
    <label class="fl">模型 ID <span class="muted">（须与 OpenRouter 一致）</span></label>
    <div class="frm-row">
      <input id="mm-model-id" class="grow2" placeholder="如 openai/gpt-7-mini" autocomplete="off">
      <button class="btn ghost" id="mm-pull">拉取可用模型</button>
    </div>
    <div id="mm-pulled" style="margin-bottom:8px"></div>
    <label class="fl">显示名</label>
    <input id="mm-display" placeholder="留空则用模型 ID" autocomplete="off">
    <label class="fl">描述（可选）</label>
    <input id="mm-desc" placeholder="如：快速便宜，日常聊天首选" autocomplete="off">
    <div class="frm-row">
      <select id="mm-cat" class="grow1">
        ${catKeys.map((k) => `<option value="${k}">${cats[k].name}</option>`).join('')}
      </select>
      <select id="mm-sub" class="grow1"></select>
    </div>
    <div class="frm-row">
      <input id="mm-in" type="number" step="0.0001" min="0" placeholder="输入单价 /1M" class="grow1">
      <input id="mm-out" type="number" step="0.0001" min="0" placeholder="输出单价 /1M" class="grow1">
    </div>
    <div class="frm-row">
      <button class="btn ghost grow1" id="mm-test">连通测试</button>
      <button class="btn grow1" id="mm-add">上架</button>
    </div>
    <div class="frm-hint" id="mm-msg"></div>
    <div class="frm-sec" style="font-weight:700;margin-top:12px">分类供应商</div>
    <div id="mm-providers"></div>
    <div class="frm-sec" style="font-weight:700;margin-top:12px">已上架模型</div>
    <div id="mm-list"><div class="empty">加载中…</div></div>`;

  const catSel = document.getElementById('mm-cat');
  const subSel = document.getElementById('mm-sub');
  const updSub = () => {
    const subs = (cats[catSel.value] && cats[catSel.value].subs) || {};
    subSel.innerHTML = Object.entries(subs).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  };
  catSel.onchange = updSub; updSub();

  // 供应商配置
  const pvWrap = document.getElementById('mm-providers');
  const loadProviders = async () => {
    try {
      const d = await api('/api/admin/model-providers');
      pvWrap.innerHTML = Object.entries(d.categories || {}).map(([k, v]) => {
        const pv = (d.providers || {})[k] || {};
        const hasKey = (d.has_key || {})[k];
        return `<div class="card" style="margin-bottom:8px">
          <div style="font-weight:700;margin-bottom:6px">${v.name}</div>
          <div class="frm-row">
            <input data-pv="${k}" data-f="provider_name" placeholder="供应商名" value="${esc(pv.provider_name || '')}" class="grow1">
            <input data-pv="${k}" data-f="base_url" placeholder="Base URL" value="${esc(pv.base_url || '')}" class="grow2">
          </div>
          <div class="frm-row" style="margin-top:6px">
            <input data-pv="${k}" data-f="api_key" type="password" placeholder="${hasKey ? '已设置（留空不修改）' : 'API Key'}" class="grow2">
            <button class="btn ghost sm" data-pv-save="${k}">保存</button>
          </div>
        </div>`;
      }).join('');
      pvWrap.querySelectorAll('[data-pv-save]').forEach((b) => {
        b.onclick = async () => {
          const k = b.dataset.pvSave;
          const vals = {};
          pvWrap.querySelectorAll(`[data-pv="${k}"]`).forEach((inp) => { vals[inp.dataset.f] = inp.value.trim(); });
          await api(`/api/admin/model-providers/${k}`, { method: 'PUT', body: JSON.stringify(vals) });
          toast('已保存');
        };
      });
    } catch (e) { pvWrap.innerHTML = '<div class="empty">加载失败</div>'; }
  };

  // 模型列表
  const listEl = document.getElementById('mm-list');
  const loadModels = async () => {
    try {
      const models = await api('/api/admin/models');
      const byCat = {};
      models.forEach((m) => { (byCat[m.category] = byCat[m.category] || []).push(m); });
      listEl.innerHTML = Object.entries(cats).map(([k, v]) => {
        const ms = byCat[k] || [];
        if (!ms.length) return '';
        return `<div class="frm-sec" style="font-weight:700">${v.name}（${ms.length}）</div>` +
          ms.map((m) => `
          <div class="frm-row" style="align-items:center;font-size:13px">
            <span style="flex:1">${esc(m.display_name || m.model_id)}<br><span class="muted" style="font-size:11px">${esc(m.model_id)}</span></span>
            <span class="muted" style="font-size:11px">${esc((cats[k].subs || {})[m.subcategory] || m.subcategory)}</span>
            <button class="btn ghost sm" data-del="${m.id}">下架</button>
          </div>`).join('');
      }).join('') || '<div class="empty">暂无上架模型</div>';
      listEl.querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = async () => {
          if (!confirm('确定下架？')) return;
          await api(`/api/admin/models/${b.dataset.del}`, { method: 'DELETE' });
          loadModels();
        };
      });
    } catch (e) { listEl.innerHTML = '<div class="empty">加载失败</div>'; }
  };

  // 拉取可用模型
  document.getElementById('mm-pull').onclick = async () => {
    const msg = document.getElementById('mm-msg');
    const cat = catSel.value;
    msg.textContent = '拉取中…';
    try {
      const d = await api('/api/admin/models/pull', { method: 'POST', body: JSON.stringify({ category: cat }) });
      const box = document.getElementById('mm-pulled');
      box.innerHTML = `<select id="mm-picked" style="width:100%"><option value="">选择模型…</option>` +
        d.models.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('') + `</select>`;
      document.getElementById('mm-picked').onchange = (e) => {
        document.getElementById('mm-model-id').value = e.target.value;
      };
      msg.textContent = `拉取到 ${d.models.length} 个`;
    } catch (e) { msg.textContent = e.message; }
  };
  // 连通测试
  document.getElementById('mm-test').onclick = async () => {
    const msg = document.getElementById('mm-msg');
    const model_id = document.getElementById('mm-model-id').value.trim();
    if (!model_id) return toast('请先填模型 ID');
    msg.textContent = '测试中…';
    try {
      const d = await api('/api/admin/models/test', { method: 'POST', body: JSON.stringify({ model_id, category: catSel.value }) });
      msg.textContent = d.msg;
    } catch (e) { msg.textContent = e.message; }
  };
  // 上架
  document.getElementById('mm-add').onclick = async () => {
    const msg = document.getElementById('mm-msg');
    const body = {
      model_id: document.getElementById('mm-model-id').value.trim(),
      display_name: document.getElementById('mm-display').value.trim(),
      description: document.getElementById('mm-desc').value.trim(),
      category: catSel.value, subcategory: subSel.value,
      input_price: Number(document.getElementById('mm-in').value) || 0,
      output_price: Number(document.getElementById('mm-out').value) || 0,
    };
    if (!body.model_id) return toast('请填模型 ID');
    try {
      await api('/api/admin/models', { method: 'POST', body: JSON.stringify(body) });
      // 同步到 model_prices（价格关联）
      await api('/api/admin/model-prices', { method: 'PUT', body: JSON.stringify({ model_id: body.model_id, input_price: body.input_price, output_price: body.output_price }) });
      msg.textContent = '上架成功';
      toast('已上架');
      loadModels();
    } catch (e) { msg.textContent = e.message; }
  };

  await loadProviders();
  await loadModels();
}
/* 统计 tab */
async function adminStatsBind() {
  const wrap = document.querySelector('#m-body .admin-stats');
  if (!wrap) return;
  try {
    const d = await api('/api/admin/models/stats?days=30');
    const maxCalls = Math.max(...(d.by_model || []).map((m) => m.calls), 1);
    const epName = { llmUnderstand: '理解', top3ranking: '排序', slotExtract: '抽槽', faithfulness: '二检' };
    wrap.innerHTML = `
      <div class="frm-sec" style="font-weight:700">近30天总览：${d.total.calls} 次调用，$${Number(d.total.cost).toFixed(4)}</div>
      ${Object.entries(d.categories || {}).map(([k, v]) => {
        const c = (d.by_category || {})[k] || { calls: 0, cost: 0 };
        return `<div class="frm-row" style="font-size:13px"><span style="flex:1;font-weight:700">${v.name}</span><span class="muted">${c.calls}次 / $${Number(c.cost).toFixed(4)}</span></div>`;
      }).join('')}
      <div class="frm-sec" style="font-weight:700;margin-top:12px">模型分布</div>
      ${(d.by_model || []).map((m) => {
        const pct = Math.round((m.calls / maxCalls) * 100);
        const disp = m.display_name || m.model_id;
        const short = disp.length > 28 ? disp.slice(0, 28) + '…' : disp;
        return `<div style="margin-bottom:10px">
          <div class="frm-row" style="font-size:13px;align-items:center">
            <span style="flex:1">${esc(short)}</span>
            <span class="muted" style="font-size:12px">${m.calls}次 · $${Number(m.cost).toFixed(4)}</span>
          </div>
          <div style="height:6px;background:var(--surface2);border-radius:3px;margin:4px 0">
            <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:3px"></div>
          </div>
          <div class="muted" style="font-size:11px">${(m.by_endpoint || []).map((e) => `${epName[e.endpoint] || e.endpoint} ${e.calls}次`).join('　')}</div>
        </div>`;
      }).join('') || '<div class="empty">暂无数据</div>'}`;
  } catch (e) { wrap.innerHTML = `<div class="empty">加载失败：${esc(e.message)}</div>`; }
}
async function bindAdmin() {
  document.querySelectorAll('#m-body [data-atab]').forEach((b) => {
    b.onclick = () => { adminTab = b.dataset.atab; Modal.setBody(adminBodyHTML()); bindAdmin(); };
  });
  if (adminTab !== 'model') {
    if (adminTab === 'tags') { adminTagsBind(); return; }
    if (adminTab === 'tpl') { adminTplBind(); return; }
    if (adminTab === 'price') { adminPriceBind(); return; }
    if (adminTab === 'mgmt') { adminMgmtBind(); return; }
    if (adminTab === 'stats') { adminStatsBind(); return; }
    return;
  }
  try {
    const c = await api('/api/admin/config');
    const g = (id) => document.getElementById(id);
    if (g('adm-base')) g('adm-base').value = c.base_url || '';
    if (g('adm-emb-url')) g('adm-emb-url').value = c.embedding_base_url || '';
    if (g('adm-emb-key')) g('adm-emb-key').placeholder = c.has_embedding_key ? '已设置（留空不修改）' : '未设置，请输入';
    if (g('adm-vision-provider')) g('adm-vision-provider').value = c.vision_provider || 'openrouter';
    if (g('adm-vision-url')) g('adm-vision-url').value = c.vision_base_url || '';
    if (g('adm-vision-key')) g('adm-vision-key').placeholder = c.has_vision_key ? '已设置（留空不修改）' : '未设置，请输入';
    if (g('adm-key')) g('adm-key').placeholder = c.has_key ? '已设置（留空不修改）' : '未设置，请输入';
    // 下拉框：先填入当前值占位，点"刷新模型列表"后载入完整列表
    for (const [id, key] of [['adm-chat', 'chat_model'], ['adm-backend', 'backend_model'], ['adm-vision', 'vision_model'], ['adm-emb', 'embedding_model']]) {
      const sel = g(id);
      if (sel && c[key]) sel.innerHTML = `<option value="${esc(c[key])}" selected>${esc(c[key])}（当前）</option>`;
    }
  } catch (e) { /* 提交时再报错 */ }
  const modelsBtn = document.getElementById('adm-models');
  if (modelsBtn) modelsBtn.onclick = () => adminLoadModels();
  // 任务25: embedding 拉模型/测试
  const embPull = document.getElementById('adm-emb-pull');
  if (embPull) embPull.onclick = async () => {
    const msg = document.getElementById('adm-models-msg');
    const base_url = document.getElementById('adm-emb-url').value.trim();
    const api_key = document.getElementById('adm-emb-key').value.trim();
    if (msg) msg.textContent = '拉取中…';
    embPull.disabled = true;
    try {
      const d = await api('/api/admin/embedding/models', { method: 'POST', body: JSON.stringify({ base_url, api_key }) });
      const sel = document.getElementById('adm-emb');
      sel.innerHTML = d.models.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('') || '<option value="">无可用模型</option>';
      if (msg) msg.textContent = `拉取到 ${d.models.length} 个模型`;
    } catch (e) { if (msg) msg.textContent = e.message; }
    finally { embPull.disabled = false; }
  };
  const embTest = document.getElementById('adm-emb-test');
  if (embTest) embTest.onclick = async () => {
    const msg = document.getElementById('adm-models-msg');
    const base_url = document.getElementById('adm-emb-url').value.trim();
    const api_key = document.getElementById('adm-emb-key').value.trim();
    const model = document.getElementById('adm-emb').value;
    if (msg) msg.textContent = '测试中…';
    embTest.disabled = true;
    try {
      const d = await api('/api/admin/embedding/test', { method: 'POST', body: JSON.stringify({ base_url, api_key, model }) });
      if (msg) msg.textContent = d.msg;
    } catch (e) { if (msg) msg.textContent = e.message; }
    finally { embTest.disabled = false; }
  };
  // 任务24: vision 拉模型/测试
  const visPull = document.getElementById('adm-vision-pull');
  if (visPull) visPull.onclick = async () => {
    const msg = document.getElementById('adm-models-msg');
    const base_url = document.getElementById('adm-vision-url').value.trim();
    const api_key = document.getElementById('adm-vision-key').value.trim();
    if (msg) msg.textContent = '拉取中…';
    visPull.disabled = true;
    try {
      const d = await api('/api/admin/vision/models', { method: 'POST', body: JSON.stringify({ base_url, api_key }) });
      const sel = document.getElementById('adm-vision');
      sel.innerHTML = d.models.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('') || '<option value="">无可用模型</option>';
      if (msg) msg.textContent = `拉取到 ${d.models.length} 个模型`;
    } catch (e) { if (msg) msg.textContent = e.message; }
    finally { visPull.disabled = false; }
  };
  const visTest = document.getElementById('adm-vision-test');
  if (visTest) visTest.onclick = async () => {
    const msg = document.getElementById('adm-models-msg');
    const base_url = document.getElementById('adm-vision-url').value.trim();
    const api_key = document.getElementById('adm-vision-key').value.trim();
    const model = document.getElementById('adm-vision').value;
    if (msg) msg.textContent = '测试中…';
    visTest.disabled = true;
    try {
      const d = await api('/api/admin/vision/test', { method: 'POST', body: JSON.stringify({ base_url, api_key, model }) });
      if (msg) msg.textContent = d.msg;
    } catch (e) { if (msg) msg.textContent = e.message; }
    finally { visTest.disabled = false; }
  };
  const testBtn = document.getElementById('adm-test');
  if (testBtn) testBtn.onclick = async () => {
    const msg = document.getElementById('adm-models-msg');
    const model = document.getElementById('adm-chat').value;
    if (msg) msg.textContent = '测试中…';
    testBtn.disabled = true;
    try {
      const r = await api('/api/admin/test', { method: 'POST', body: JSON.stringify({ model }) });
      if (msg) { msg.style.color = '#16a34a'; msg.textContent = `连通正常（${r.model}）：${r.reply || '无返回'}`; }
    } catch (e) {
      if (msg) { msg.style.color = ''; msg.textContent = '测试失败：' + e.message; }
    } finally {
      testBtn.disabled = false;
      setTimeout(() => { if (msg) msg.style.color = ''; }, 5000);
    }
  };
  const save = document.getElementById('adm-save');
  if (save) save.onclick = async () => {
    const g = (id) => document.getElementById(id).value.trim();
    const msg = document.getElementById('adm-msg');
    save.disabled = true;
    try {
      await api('/api/admin/config', { method: 'PUT', body: JSON.stringify({
        api_key: g('adm-key'), base_url: g('adm-base'), chat_model: g('adm-chat'),
        backend_model: g('adm-backend'),
        embedding_base_url: g('adm-emb-url') && g('adm-emb-url').value.trim(),
        embedding_api_key: g('adm-emb-key') && g('adm-emb-key').value.trim(),
        embedding_model: g('adm-emb') && g('adm-emb').value,
        vision_provider: g('adm-vision-provider') && g('adm-vision-provider').value,
        vision_base_url: g('adm-vision-url') && g('adm-vision-url').value.trim(),
        vision_api_key: g('adm-vision-key') && g('adm-vision-key').value.trim(),
        vision_model: g('adm-vision') && g('adm-vision').value,
      }) });
      msg.style.color = '#16a34a'; msg.textContent = '已保存';
      const k = document.getElementById('adm-key');
      if (k) { k.value = ''; k.placeholder = '已设置（留空不修改）'; }
    } catch (e) { msg.style.color = ''; msg.textContent = e.message; }
    finally { save.disabled = false; }
  };
}

/* ---------------- 启动 ---------------- */
(function init() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (b) location.hash = b.dataset.go;
    if (e.target.closest('[data-menu]')) root.classList.add('sidebar-open');
  });
  $('#collapse-btn').onclick = () => root.classList.remove('sidebar-open');
  $('#expand-btn').onclick = () => root.classList.add('sidebar-open');
  $('#backdrop').onclick = () => root.classList.remove('sidebar-open');
  const ab = $('#admin-btn');
  if (ab) ab.onclick = () => openAdminModal();
  // 移动端默认收起为抽屉
  if (window.matchMedia('(max-width:768px)').matches) root.classList.remove('sidebar-open');
  (async () => {
  try { CFG = await api('/api/config'); } catch (e) { app.innerHTML = `<div class="empty">后端连接失败：${esc(e.message)}<br>请确认 server 已启动（npm start）</div>`; return; }
  const sv = document.getElementById('side-ver');
  if (sv && CFG.version) sv.textContent = 'v' + CFG.version;
  route();
  })();
})();
