/* 服装管理平台 MVP 前端：vanilla JS + hash 路由，手机端优先 */
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
  if (parts[0] === '' ) return viewList();
  if (parts[0] === 'new') return viewNew();
  if (parts[0] === 'g' && parts[1] && !parts[2]) return viewDetail(parts[1]);
  if (parts[0] === 'g' && parts[2] === 'sample') return viewSampleEdit(parts[1]);
  if (parts[0] === 'g' && parts[2] === 'version') return viewNewVersion(parts[1]);
  if (parts[0] === 'q' && parts[1]) return viewQuote(parts[1]);
  if (parts[0] === 'tpl' && parts[1] === 'new') return viewTplForm();
  if (parts[0] === 'tpl' && parts[2] === 'edit') return viewTplForm(parts[1]);
  if (parts[0] === 'tpl' && parts[1]) return viewTplList(parts[1]);
  if (parts[0] === 'tpl') return viewTplList();
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
const TPL_LANG = { EN: '英文', ES: '西语', PT: '葡语', FR: '法语', DE: '德语', AR: '阿语' };
const TPL_SCENE = { first: '首回', ask: '追问', quote: '报价', nudge: '跟进' };
const SCENE_ORDER = ['first', 'ask', 'quote', 'nudge'];
const VAR_TYPES = ['text', 'number', 'date'];
const VAR_TYPE_ZH = { text: '文本', number: '数字', date: '日期' };
let tplQuery = '';

/* ---------- 列表：QA 模式（Q 场景句 + A 中文首句预览），点卡开弹窗 ---------- */
let tplCurrentIds = [];
let tplModalKeyHandler = null;
const tplLangKey = (id) => 'tpl_lang_' + id;
const tplLastLangFor = (id, avail) => {
  const last = localStorage.getItem(tplLangKey(id));
  if (last && avail.includes(last)) return last;
  return avail.includes('EN') ? 'EN' : avail[0];
};
const clearModalKey = () => {
  if (tplModalKeyHandler) { document.removeEventListener('keydown', tplModalKeyHandler); tplModalKeyHandler = null; }
};
// A 预览：中文对照首句，变量替换为【中文名】
const aPreview = (t) => {
  const first = (t.gloss_zh || '').split('\n').find((l) => l.trim()) || '';
  if (!first) return '';
  const varMap = {};
  (t.vars || []).forEach((v) => { varMap[v.name] = '【' + (v.label_zh || v.name) + '】'; });
  return first.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => varMap[k] || '');
};
let tplLastList = []; // 最近一次列表数据，供弹窗骨架屏显示真实标题
let snippetCache = null; // 落款片段只拉一次（前端不改片段，缓存安全）
let tplModalSeq = 0; // 弹窗序号：关闭/切换时作废在途请求
const getSnippets = async () => {
if (!snippetCache) snippetCache = await api('/api/snippets').catch(() => []);
return snippetCache;
};

async function viewTplList(openId) {
setNav('tpl');
clearModalKey();
// 列表已在 DOM（开/关弹窗、点上一条下一条时）：不重拉列表、不重绘，直接开弹窗或清弹窗
if (document.getElementById('t-list')) {
if (openId) openTplModal(openId);
else { const r = document.getElementById('tpl-modal-root'); if (r) r.innerHTML = '';}
return;
}
app.innerHTML = `${topbar('回复模板库')}
<div class="page" style="padding-top:10px">
<input id="t-q" class="searchbar" placeholder="搜索：标题 / 正文 / 使用说明" value="${esc(tplQuery)}" autocomplete="off">
<button class="btn ghost" id="t-new">+ 新增模板</button>
<div id="t-list" class="mt8"><div class="empty">加载中…</div></div>
</div>
<div id="tpl-modal-root"></div>`;
$('#t-new').onclick = () => location.hash = '#/tpl/new';
const rowHtml = (t) => {
    if (!tplCurrentIds.includes(t.id)) tplCurrentIds.push(t.id); // 常用+分组重复展示，导航列表去重

const q = t.note_zh || t.title;
const a = aPreview(t);
return `
<div class="card tappable qa-card" data-id="${t.id}">
<div class="qa-line"><span class="qa-mark q">Q</span><span class="qa-qtext">${esc(q)}</span></div>
${a? `<div class="qa-line"><span class="qa-mark a">A</span><span class="qa-atext">${esc(a)}</span></div>`: ''}
<div class="rowline mt4"><span class="muted" style="font-size:11px">${t.langs.join(' · ')}</span>
${t.usage_count > 0? `<span class="muted" style="font-size:11px;margin-left:auto">用过${t.usage_count}</span>`: ''}</div>
</div>`;
};
const draw = (list) => {
tplLastList = list;
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
el.querySelectorAll('.card').forEach((c) => c.onclick = () => location.hash = '#/tpl/' + c.dataset.id);
};
let timer = null;
const load = async () => {
try { draw(await api('/api/reply-templates' + (tplQuery.trim()? '?q=' + encodeURIComponent(tplQuery.trim()): '')));}
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

/* ---------- 弹窗：骨架屏秒开 + 并行取数 + 上滑动画 ---------- */
async function openTplModal(id) {
const root = $('#tpl-modal-root');
if (!root) return;
clearModalKey();
const seq = ++tplModalSeq;
const hint = (tplLastList || []).find((t) => t.id === id);
const close = () => { tplModalSeq++; if (location.hash!== '#/tpl') location.hash = '#/tpl';};
const bindClose = () => { const b = $('#m-close'); if (b) b.onclick = close;};
// 骨架屏：同步画壳，点下即有反馈，不等网络
const skeleton = `
<div class="modal-head">
<span class="modal-title">${hint? esc(hint.title): '加载中…'}</span>
<button class="modal-x" id="m-close" aria-label="关闭">×</button>
</div>
<div class="modal-body"><div class="skel-box"></div><div class="skel-line"></div><div class="skel-line" style="width:60%"></div></div>`;
const sheet = root.querySelector('#m-sheet');
if (!sheet) {
// 首次打开：建壳并播上滑动画
root.innerHTML = `<div class="modal-backdrop" id="m-bg"><div class="modal-sheet" id="m-sheet">${skeleton}</div></div>`;
$('#m-bg').onclick = (e) => { if (e.target.id === 'm-bg') close();};
} else {
// 上一条/下一条切换：复用壳，只换骨架，不重播动画
sheet.innerHTML = skeleton;
}
bindClose();
tplModalKeyHandler = (e) => { if (e.key === 'Escape') close();};
document.addEventListener('keydown', tplModalKeyHandler);
// 详情 + 片段并行拉（原先串行两次请求）
let t, snippets;
try {
[t, snippets] = await Promise.all([api('/api/reply-templates/' + id), getSnippets()]);
} catch (e) {
if (seq!== tplModalSeq) return;
root.innerHTML = ''; toast(e.message); location.hash = '#/tpl'; return;
}
if (seq!== tplModalSeq) return; // 期间已关闭或已切到另一条
if (!document.getElementById('tpl-modal-root')) return;
if (!t.locales.length) {
root.innerHTML = '';
toast('该模板没有任何语言版本，请编辑补充');
location.hash = '#/tpl/' + t.id + '/edit';
return;
}
const avail = t.locales.map((l) => l.lang);
const state = { lang: tplLastLangFor(t.id, avail), view: 'orig', slots: {}};
const idx = () => tplCurrentIds.indexOf(t.id);
const go = (delta) => {
const i = idx() + delta;
if (i < 0 || i >= tplCurrentIds.length) return;
const nid = tplCurrentIds[i];
// 换地址但不进 history、不触发路由重绘列表；返回键仍回到列表
history.replaceState(null, '', '#/tpl/' + nid);
openTplModal(nid);
};
const expandLocal = (body, lang) =>
body.replace(/\{\{\s*snippet:([a-z_]+)\s*\}\}/g, (_, k) => {
const s = snippets.find((x) => x.key === k && x.lang === lang)
|| snippets.find((x) => x.key === k && x.lang === 'EN');
return s? s.body: '';
});
const locOf = () => t.locales.find((l) => l.lang === state.lang) || t.locales[0];
const missing = () => (t.vars || [])
.filter((v) => v.required &&!String(state.slots[v.name] || '').trim());
// 话术框 HTML：已填值高亮，未填显示
const boxHTML = () => {
const raw = state.view === 'zh'? (t.gloss_zh || ''): locOf().body;
const expanded = expandLocal(raw, state.view === 'zh'? 'EN': locOf().lang);
return expanded.split(/(\{\{\s*[a-z_]+\s*\}\})/g).map((p) => {
const m = p.match(/^\{\{\s*([a-z_]+)\s*\}\}$/);
if (!m) return esc(p);
const v = (t.vars || []).find((x) => x.name === m[1]);
const val = state.slots[m[1]];
if (val) return `<mark class="slotval">${esc(val)}</mark>`;
return `<span class="slotempty"></span>`;
}).join('');
};

// 填内容：只换 sheet 内部，不重建 backdrop、不重播动画
$('#m-sheet').innerHTML = `
<div class="modal-head">
<span class="modal-title">${esc(locOf().title)}</span>
<button class="modal-x" id="m-close" aria-label="关闭">×</button>
</div>
<div class="modal-body">
${t.note_zh? `<div class="muted" style="font-size:12px">${esc(t.note_zh)}</div>`: ''}
${(t.vars || []).length? `<div class="mt8" id="m-slots">${t.vars.map((v) => `
<label class="fl" style="margin-top:8px">${esc(v.label_zh || v.name)}${v.required? ' <span style="color:var(--danger)">*</span>': ''}
<span class="muted" style="font-weight:400"> · ${VAR_TYPE_ZH[v.type] || '文本'}</span></label>
${v.type === 'date'
? `<input type="date" data-slot="${esc(v.name)}" value="${esc(state.slots[v.name] || '')}">`
: `<input data-slot="${esc(v.name)}" value="${esc(state.slots[v.name] || '')}"
${v.type === 'number'? 'inputmode="decimal"': ''}
placeholder="${v.sample? '如：' + esc(v.sample): '填写' + esc(v.label_zh || v.name)}">`
}`).join('')}</div>`: ''}
<div class="talkbox" id="m-box"></div>
<div class="modal-controls">
<div class="ctrlrow">
<select id="m-lang">${avail.map((l) =>
`<option value="${l}" ${l === state.lang? 'selected': ''}>${l} ${TPL_LANG[l]}</option>`).join('')}</select>
<button class="btn ghost" id="m-flip"></button>
</div>
<button class="btn" id="m-copy"></button>
<div class="miss" id="m-miss"></div>
<div class="muted" style="text-align:center;font-size:11px">红线：必填项没填时不许复制发出 · 中文对照仅供理解</div>
</div>
<div class="btnrow mt8">
<button class="btn ghost" id="m-prev" ${idx() <= 0? 'disabled': ''}>← 上一条</button>
<button class="btn ghost" id="m-next" ${idx() >= tplCurrentIds.length - 1? 'disabled': ''}>下一条 →</button>
<button class="btn ghost" id="m-edit">编辑</button>
</div>
</div>`;

const refresh = () => {
$('#m-box').innerHTML = boxHTML();
const m = missing();
const zhView = state.view === 'zh';
$('#m-flip').textContent = zhView? '看原文': '看中文对照';
const copyBtn = $('#m-copy');
copyBtn.textContent = zhView? '中文对照不可复制': `复制${TPL_LANG[state.lang]}文本`;
copyBtn.classList.toggle('dim', zhView || m.length > 0);
$('#m-miss').textContent = zhView? '当前是中文对照，切回原文再复制'
: (m.length? '还差：' + m.map((v) => v.label_zh || v.name).join('、'): '');
$('#m-sheet').querySelector('.modal-title').textContent = locOf().title;
};
bindClose();
root.querySelectorAll('[data-slot]').forEach((i) => {
i.oninput = () => { state.slots[i.dataset.slot] = i.value; refresh();};
});
$('#m-lang').onchange = (e) => {
state.lang = e.target.value;
localStorage.setItem(tplLangKey(t.id), state.lang);
refresh();
};
$('#m-flip').onclick = () => { state.view = state.view === 'orig'? 'zh': 'orig'; refresh();};
$('#m-copy').onclick = async () => {
if (state.view === 'zh') return toast('中文对照仅供理解，切回原文再复制');
const m = missing();
if (m.length) return toast(`红线：${m.map((v) => v.label_zh || v.name).join('、')}不能为空，填好再复制`);
try {
const r = await api(`/api/reply-templates/${t.id}/render`, {
method: 'POST', body: JSON.stringify({ lang: state.lang, slots: state.slots}),
});
await navigator.clipboard.writeText(r.text);
api(`/api/reply-templates/${t.id}/use`, { method: 'POST'}).catch(() => {});
toast('已复制，去阿里消息中心粘贴');
} catch (e) { toast(e.message);}
};
$('#m-prev').onclick = () => go(-1);
$('#m-next').onclick = () => go(1);
$('#m-edit').onclick = () => location.hash = '#/tpl/' + t.id + '/edit';
refresh();
}

/* ---------- 编辑页：语言标签页 + 变量管理 + 片段插入 ---------- */
async function viewTplForm(id) {
  const isEdit = !!id;
  setNav('tpl');
  let t = null;
  if (isEdit) {
    try { t = await api('/api/reply-templates/' + id); }
    catch (e) { app.innerHTML = `${topbar('出错', '#/tpl')}<div class="page"><div class="empty">${esc(e.message)}</div></div>`; return; }
  }
  const state = {
    scene: t ? t.scene : 'first',
    category: t ? t.category : '通用',
    note_zh: t ? t.note_zh : '',
    gloss_zh: t ? (t.gloss_zh || '') : '',
    source_buyer: t ? t.source_buyer : '',
    locales: t ? t.locales.map((l) => ({ ...l })) : [{ lang: 'EN', title: '', body: '' }],
    vars: t ? t.vars.map((v) => ({ ...v })) : [],
    activeLang: t ? (t.locales[0] || {}).lang || 'EN' : 'EN',
  };
  const scanVars = () => {
    const found = [];
    state.locales.forEach((l) => {
      const re = /\{\{\s*([a-z_]+)\s*\}\}/g; let m;
      while ((m = re.exec(l.body))) if (!found.includes(m[1])) found.push(m[1]);
    });
    found.forEach((name) => {
      if (!state.vars.some((v) => v.name === name)) {
        state.vars.push({ name, type: name === 'price' || name === 'quantity' ? 'number' : 'text',
          required: name === 'price' || name === 'lead_time' ? 1 : 0, label_zh: name, sample: '' });
      }
    });
    state.vars = state.vars.filter((v) => found.includes(v.name));
  };

  const paint = () => {
    const loc = state.locales.find((l) => l.lang === state.activeLang) || state.locales[0];
    const langs = Object.keys(TPL_LANG);
    app.innerHTML = `${topbar(isEdit ? '编辑模板' : '新增模板', isEdit ? '#/tpl/' + id : '#/tpl')}
    <div class="page"><div class="card">
      <div class="frow">
        <div class="grow"><label class="fl" style="margin-top:0">场景</label>
          <select id="f-scene">${Object.entries(TPL_SCENE).map(([k, v]) =>
            `<option value="${k}" ${state.scene === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="grow"><label class="fl" style="margin-top:0">分类</label>
          <input id="f-cat" value="${esc(state.category)}" placeholder="如：通用/西装/晚礼服"></div>
      </div>
      <label class="fl">语言版本</label>
      <div class="seg" id="f-tabs">${langs.map((l) => {
        const has = state.locales.some((x) => x.lang === l);
        return `<button class="chip ${l === state.activeLang ? 'on' : ''} ${has ? '' : 'dash'}" data-lang="${l}">${has ? l : '+ ' + l}</button>`;
      }).join('')}</div>
      <label class="fl">标题（${loc.lang}）</label>
      <input id="f-title" value="${esc(loc.title)}" placeholder="如：追问：发货前确认">
      <label class="fl">正文（${loc.lang}）</label>
      <div class="seg" style="margin-top:0" id="f-insert">
        <button class="chip" data-ins="{{snippet:signature}}">+ 落款片段</button>
        ${state.vars.map((v) => `<button class="chip" data-ins="{{${esc(v.name)}}}">+ ${esc(v.name)}</button>`).join('')}
      </div>
      <textarea id="f-body" style="min-height:180px" placeholder="正文，填空位用 {{变量名}}，落款用 {{snippet:signature}}">${esc(loc.body)}</textarea>
      <div class="btnrow mt8">
        <button class="btn ghost" id="f-scan">从正文扫描变量</button>
        ${state.locales.length > 1 ? `<button class="btn danger" id="f-dellang">删${loc.lang}版本</button>` : ''}
      </div>
      <label class="fl">变量管理（${state.vars.length} 个）</label>
      <div id="f-vars">${state.vars.map((v, i) => `
        <div class="varrow">
          <div class="rowline"><code style="font-weight:700">{{${esc(v.name)}}}</code>
            <label style="font-size:12px;display:flex;align-items:center;gap:4px">
              <input type="checkbox" data-vi="${i}" data-k="required" ${v.required ? 'checked' : ''} style="width:auto"> 必填</label>
            <button class="chip" data-vdel="${i}">删除</button></div>
          <div class="frow mt4">
            <div class="grow"><input data-vi="${i}" data-k="label_zh" value="${esc(v.label_zh)}" placeholder="中文名"></div>
            <div class="grow"><select data-vi="${i}" data-k="type">${VAR_TYPES.map((tp) =>
              `<option value="${tp}" ${v.type === tp ? 'selected' : ''}>${VAR_TYPE_ZH[tp]}</option>`).join('')}</select></div>
          </div>
          <input class="mt4" data-vi="${i}" data-k="sample" value="${esc(v.sample)}" placeholder="示例值（输入框提示用），如 175">
        </div>`).join('') || '<div class="muted">暂无变量，点"从正文扫描变量"</div>'}
      </div>
      <label class="fl">使用说明（什么时候用）</label>
      <input id="f-note" value="${esc(state.note_zh)}" placeholder="一句话中文说明">
      <label class="fl">中文对照 <span class="muted" style="font-weight:400">· 预览一显示，仅供理解不发送；变量用 {{变量名}} 原样保留</span></label>
      <textarea id="f-gloss" style="min-height:120px" placeholder="这条模板发出去是什么意思，用中文写一遍">${esc(state.gloss_zh)}</textarea>
      <label class="fl">来源（可选）</label>
      <input id="f-src" value="${esc(state.source_buyer)}" placeholder="如 marlen-kell-rosario">
    </div>
    <button class="btn" id="f-save">${isEdit ? '保存修改' : '创建模板'}</button>
    ${isEdit ? '<div style="height:8px"></div><button class="btn danger" id="f-del">删除整个模板</button>' : ''}</div>`;

    const syncLoc = () => {
      const l = state.locales.find((x) => x.lang === state.activeLang);
      if (l) { l.title = $('#f-title').value.trim(); l.body = $('#f-body').value; }
    };
    app.querySelectorAll('#f-tabs .chip').forEach((b) => {
      b.onclick = () => {
        syncLoc();
        const l = b.dataset.lang;
        if (!state.locales.some((x) => x.lang === l)) {
          const en = state.locales.find((x) => x.lang === 'EN');
          state.locales.push({ lang: l, title: '', body: en ? en.body : '' });
        }
        state.activeLang = l;
        paint();
      };
    });
    app.querySelectorAll('#f-insert .chip').forEach((b) => {
      b.onclick = () => {
        const ta = $('#f-body');
        const s = ta.selectionStart || 0, e = ta.selectionEnd || 0;
        ta.value = ta.value.slice(0, s) + b.dataset.ins + ta.value.slice(e);
        ta.focus();
      };
    });
    $('#f-scan').onclick = () => { syncLoc(); scanVars(); paint(); toast(`已扫描出 ${state.vars.length} 个变量`); };
    const delLang = $('#f-dellang');
    if (delLang) delLang.onclick = () => {
      if (!confirm(`删除 ${state.activeLang} 语言版本？`)) return;
      state.locales = state.locales.filter((x) => x.lang !== state.activeLang);
      state.activeLang = state.locales[0].lang;
      paint();
    };
    app.querySelectorAll('[data-vi]').forEach((el) => {
      el.oninput = el.onchange = () => {
        const v = state.vars[+el.dataset.vi];
        if (!v) return;
        v[el.dataset.k] = el.type === 'checkbox' ? (el.checked ? 1 : 0) : el.value;
      };
    });
    app.querySelectorAll('[data-vdel]').forEach((b) => {
      b.onclick = () => { state.vars.splice(+b.dataset.vdel, 1); syncLoc(); paint(); };
    });
    ['f-scene', 'f-cat', 'f-note', 'f-gloss', 'f-src'].forEach((fid) => {
      $('#' + fid).oninput = (e) => {
        if (fid === 'f-scene') state.scene = e.target.value;
        else if (fid === 'f-cat') state.category = e.target.value;
        else if (fid === 'f-note') state.note_zh = e.target.value;
        else if (fid === 'f-gloss') state.gloss_zh = e.target.value;
        else state.source_buyer = e.target.value;
      };
    });
    $('#f-save').onclick = async () => {
      syncLoc();
      const locales = state.locales.filter((l) => l.body.trim());
      if (!locales.length) return toast('至少保留一个有正文的语言版本');
      if (locales.some((l) => !l.title.trim())) return toast('每个语言版本都要填标题');
      const body = { scene: state.scene, category: state.category.trim() || '通用',
        note_zh: state.note_zh.trim(), gloss_zh: state.gloss_zh.trim(),
        source_buyer: state.source_buyer.trim(), locales, vars: state.vars };
      try {
        if (isEdit) { await api('/api/reply-templates/' + id, { method: 'PUT', body: JSON.stringify(body) }); toast('已保存'); }
        else { const r = await api('/api/reply-templates', { method: 'POST', body: JSON.stringify(body) }); id = r.id; toast('已创建'); }
        location.hash = '#/tpl/' + id;
      } catch (e) { toast(e.message); }
    };
    const delBtn = $('#f-del');
    if (delBtn) delBtn.onclick = async () => {
      if (!confirm('确定删除整个模板（含全部语言版本）？')) return;
      try { await api('/api/reply-templates/' + id, { method: 'DELETE' }); toast('已删除'); location.hash = '#/tpl'; }
      catch (e) { toast(e.message); }
    };
  };
  if (!isEdit) scanVars();
  paint();
}

/* ---------------- 占位 ---------------- */
function viewStub(title, desc) {
  const map = { '设计台': 'design', '样衣台': 'sample', '制版台': 'pattern' };
  setNav(map[title]);
  app.innerHTML = `${topbar(title)}<div class="page"><div class="empty">${esc(desc)}<br><br>当前 MVP 只做样衣台，<br>从左侧导航切到「样衣台」开始用。</div></div>`;
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
  // 移动端默认收起为抽屉
  if (window.matchMedia('(max-width:768px)').matches) root.classList.remove('sidebar-open');
  (async () => {
  try { CFG = await api('/api/config'); } catch (e) { app.innerHTML = `<div class="empty">后端连接失败：${esc(e.message)}<br>请确认 server 已启动（npm start）</div>`; return; }
  route();
  })();
})();
