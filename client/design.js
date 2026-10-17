/* 设计台 + 资产库前端（一期 MVP，v0.16.9）：app.js 路由调用 viewDesign/viewAssets */
/* ---------------- 设计台（一期 MVP，v0.16.9） ---------------- */
let DSG = null;
function dsgStopPoll() { if (DSG && DSG.timer) { clearInterval(DSG.timer); DSG.timer = null; } }
function fileToDataUrl(file) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
}
const DSG_STEPS = ['选款', '说改法', '看图选定', '存版次'];

async function viewDesign() {
  dsgStopPoll();
  setNav('design');
  DSG = {
    step: 1, timer: null, garments: [], garment: null, hist: [],
    basePath: '', desc: '', inspPick: null, inspId: null,
    params: { silhouette: '', color: '', fabric: '', details: '' },
    taskId: null, task: null, images: [], selectedId: null,
  };
  try { const pre = JSON.parse(sessionStorage.getItem('dsg_insp') || 'null'); sessionStorage.removeItem('dsg_insp'); if (pre && pre.id) { DSG.inspPick = pre; DSG.inspId = pre.id; DSG.basePath = pre.path; } } catch {}
  app.innerHTML = `${topbar('设计台')}
  <div class="page dsg-page">
    <div class="dsg-steps" id="dsg-steps"></div>
    <div class="dsg-cols" id="dsg-cols" data-step="1">
      <section class="dcol" data-col="a"><div id="dsg-a"></div></section>
      <section class="dcol" data-col="b"><div id="dsg-b"></div></section>
      <section class="dcol" data-col="c"><div id="dsg-c"></div></section>
    </div>
  </div>`;
  DSG.garments = await api('/api/garments').catch(() => []);
  if (DSG.inspPick && DSG.inspPick.garment_id) {
    DSG.garment = DSG.garments.find((g) => g.id === Number(DSG.inspPick.garment_id)) || null;
    if (DSG.garment) { await dsgLoadHist(); DSG.step = 2; }
  }
  dsgRenderAll();
}
function dsgSetStep(n) {
  DSG.step = n;
  const c = $('#dsg-cols'); if (c) c.dataset.step = String(n);
  dsgRenderSteps();
}
function dsgRenderSteps() {
  const el = $('#dsg-steps'); if (!el) return;
  el.innerHTML = DSG_STEPS.map((s, i) => {
    const n = i + 1;
    const cls = n < DSG.step ? 'done' : n === DSG.step ? 'on' : '';
    return `<span class="dst ${cls}"><i class="dot"></i>${s}</span>${n < 4 ? '<span class="dln"></span>' : ''}`;
  }).join('');
}
function dsgRenderAll() { dsgRenderSteps(); dsgRenderA(); dsgRenderB(); dsgRenderC(); }

/* A 列：选款 + 本款改款历史 */
function dsgRenderA() {
  const el = $('#dsg-a'); if (!el) return;
  el.innerHTML = `<div class="card"><div class="sechead" style="margin-top:0">选择款</div>
    ${DSG.garments.length ? DSG.garments.map((g) => `
      <button class="dsg-g ${DSG.garment && DSG.garment.id === g.id ? 'on' : ''}" data-g="${g.id}">
        <span class="style-no">${esc(g.style_no)}</span><span class="muted">${esc(g.name)}</span>
        ${g.latest_ver ? `<span class="badge dim">${esc(g.latest_ver)}</span>` : ''}
      </button>`).join('') : '<div class="empty">暂无款，先去样衣台建款</div>'}
    </div>
    ${DSG.garment ? `<div class="card"><div class="sechead" style="margin-top:0">改款历史</div>
      ${DSG.hist.length ? DSG.hist.map((t) => `
        <button class="dsg-h" data-t="${t.id}">
          ${t.sel_thumb || t.first_thumb ? `<img src="${esc(t.sel_thumb || t.first_thumb)}" loading="lazy">` : '<span class="dsg-hno"></span>'}
          <span class="grow"><span class="dsg-ht">${esc((t.desc_text || '').slice(0, 18)) || '灵感改款'}</span>
          <span class="muted">${esc(fmtDate(t.created_at))} · ${t.status === 'done' ? '已完成' : t.status === 'failed' ? '失败' : '生成中'} · ${t.img_count} 张</span></span>
        </button>`).join('') : '<div class="empty">暂无改款记录</div>'}
    </div>` : ''}`;
  el.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => dsgPickGarment(Number(b.dataset.g)));
  el.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => dsgOpenTask(Number(b.dataset.t)));
}
async function dsgPickGarment(id) {
  DSG.garment = DSG.garments.find((g) => g.id === id) || null;
  DSG.taskId = null; DSG.task = null; DSG.images = []; DSG.selectedId = null;
  await dsgLoadHist();
  dsgSetStep(2); dsgRenderA(); dsgRenderB(); dsgRenderC();
}
async function dsgLoadHist() {
  if (!DSG.garment) { DSG.hist = []; return; }
  DSG.hist = await api(`/api/garments/${DSG.garment.id}/design-history`).catch(() => []);
}
async function dsgOpenTask(tid) {
  dsgStopPoll();
  try {
    const d = await api(`/api/redesign/${tid}`);
    DSG.taskId = tid; DSG.task = d.task; DSG.images = d.images;
    DSG.selectedId = d.images.find((i) => i.selected) ? d.images.find((i) => i.selected).id : null;
    DSG.params = { ...(d.task.params || {}) };
    dsgSetStep(3); dsgRenderB(); dsgRenderC();
  } catch (e) { toast(e.message); }
}

/* B 列：画布（基准图 / 骨架屏 / 候选图 / 存版次） */
function dsgRenderB() {
  const el = $('#dsg-b'); if (!el) return;
  if (!DSG.garment) { el.innerHTML = '<div class="card"><div class="empty">先在左侧选择一款开始改款</div></div>'; return; }
  const t = DSG.task;
  let body = '';
  if (DSG.basePath) body += `<div class="dsg-base"><span class="muted">基准图</span><img src="${esc(DSG.basePath)}"></div>`;
  if (t && t.status === 'generating') {
    body += `<div class="cand-grid">${'<div class="skel"></div>'.repeat(3)}</div><div class="notice">生图约需 10–30 秒，可以先干别的，完成后会停在这里。</div>`;
  } else if (t && t.status === 'failed') {
    body += `<div class="card"><div class="miss">${esc(t.error || '生成失败')}</div>
      <button class="btn ghost" data-act="retry">重试</button></div>`;
  } else if (DSG.images.length) {
    body += `<div class="cand-grid">${DSG.images.map((im) => `
      <button class="cand ${DSG.selectedId === im.id ? 'on' : ''}" data-img="${im.id}">
        <img src="${esc(im.thumb_path || im.path)}" loading="lazy">
        ${DSG.selectedId === im.id ? '<span class="cand-pick">已选定</span>' : ''}
      </button>`).join('')}</div>`;
    if (DSG.selectedId) {
      body += `<div class="card"><label class="fl">版次备注</label>
        <input id="dsg-note" placeholder="如：A字廓形改款" value="${esc((t && t.desc_text || '').slice(0, 40))}">
        <div class="btnrow mt8"><button class="btn" data-act="savever">存为新版次</button></div>
        <div class="notice">效果预览图：部件级改款只是图像编辑，结构性改款必须重新制版。</div></div>`;
    } else {
      body += '<div class="muted mt8">点选一张候选图，再存为新版次</div>';
    }
  } else {
    body += '<div class="card"><div class="empty">在右侧描述改法并点击「生成候选图」</div></div>';
  }
  el.innerHTML = `<div class="card"><div class="sechead" style="margin-top:0">画布 · ${esc(DSG.garment.style_no)}</div>${body}</div>`;
  el.querySelectorAll('[data-img]').forEach((b) => b.onclick = () => { DSG.selectedId = Number(b.dataset.img); dsgSetStep(4); dsgRenderB(); });
  const retry = el.querySelector('[data-act="retry"]'); if (retry) retry.onclick = dsgRegen;
  const sv = el.querySelector('[data-act="savever"]'); if (sv) sv.onclick = dsgSaveVersion;
}
function dsgPoll() {
  dsgStopPoll();
  DSG.timer = setInterval(async () => {
    if (!DSG.taskId) return dsgStopPoll();
    try {
      const d = await api(`/api/redesign/${DSG.taskId}`);
      DSG.task = d.task; DSG.images = d.images;
      if (d.task.status !== 'generating') {
        dsgStopPoll();
        if (d.task.status === 'done' && d.task.params) DSG.params = { ...d.task.params };
        if (d.task.status === 'failed') toast('生成失败：' + (d.task.error || ''));
        else toast('候选图已生成');
      }
      dsgRenderB(); dsgRenderC();
    } catch (e) { dsgStopPoll(); toast(e.message); }
  }, 3000);
  window._dsgTimer = DSG.timer;
}

/* C 列：基准图 + 改法描述 + 参数 */
function dsgRenderC() {
  const el = $('#dsg-c'); if (!el) return;
  if (!DSG.garment) { el.innerHTML = ''; return; }
  const p = DSG.params;
  el.innerHTML = `<div class="card"><div class="sechead" style="margin-top:0">说改法</div>
    <label class="fl">基准图</label>
    <div class="rowline">
      ${DSG.basePath ? `<img class="dsg-bthumb" src="${esc(DSG.basePath)}">` : '<span class="muted">未选择</span>'}
      <label class="btn sm ghost" style="margin:0">上传<input type="file" id="dsg-file" accept="image/*" hidden></label>
    </div>
    ${DSG.inspPick ? `<div class="notice">灵感图：${esc(DSG.inspPick.note || '未命名')}</div>` : ''}
    <label class="fl">一句话描述改法</label>
    <textarea id="dsg-desc" placeholder="如：把廓形改成A字，颜色换成藏青">${esc(DSG.desc)}</textarea>
    <label class="fl">廓形</label><input id="dsg-p-silhouette" value="${esc(p.silhouette)}" placeholder="如：A字">
    <label class="fl">颜色</label><input id="dsg-p-color" value="${esc(p.color)}" placeholder="如：藏青">
    <label class="fl">面料</label><input id="dsg-p-fabric" value="${esc(p.fabric)}" placeholder="如：羊毛">
    <label class="fl">细节</label><input id="dsg-p-details" value="${esc(p.details)}" placeholder="如：加腰带">
    <div class="btnrow mt12"><button class="btn" data-act="gen">生成候选图</button></div>
    ${DSG.taskId ? '<div class="btnrow mt8"><button class="btn ghost" data-act="regen">用当前参数重新生成</button></div>' : ''}
  </div>`;
  el.querySelector('#dsg-desc').oninput = (e) => { DSG.desc = e.target.value; };
  for (const k of ['silhouette', 'color', 'fabric', 'details']) {
    el.querySelector(`#dsg-p-${k}`).oninput = (e) => { DSG.params[k] = e.target.value; };
  }
  el.querySelector('#dsg-file').onchange = async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try {
      const du = await fileToDataUrl(f);
      const d = await api('/api/design/upload', { method: 'POST', body: JSON.stringify({ dataUrl: du }) });
      DSG.basePath = d.path; DSG.inspId = null; DSG.inspPick = null;
      toast('基准图已上传'); dsgRenderB(); dsgRenderC();
    } catch (err) { toast(err.message); }
  };
  el.querySelector('[data-act="gen"]').onclick = dsgGenerate;
  const rg = el.querySelector('[data-act="regen"]'); if (rg) rg.onclick = dsgRegen;
}
async function dsgGenerate() {
  if (!DSG.garment) return toast('请先选择款');
  if (!DSG.desc.trim() && !DSG.inspId) return toast('请描述改法');
  try {
    const d = await api('/api/redesign', {
      method: 'POST',
      body: JSON.stringify({ garment_id: DSG.garment.id, base_path: DSG.basePath, insp_id: DSG.inspId, desc: DSG.desc.trim() }),
    });
    DSG.taskId = d.task_id; DSG.task = { status: 'generating' }; DSG.images = []; DSG.selectedId = null;
    dsgSetStep(3); dsgRenderB(); dsgPoll();
    toast('已开始生成，约需 10–30 秒');
  } catch (e) { toast(e.message); }
}
async function dsgRegen() {
  if (!DSG.taskId) return;
  try {
    await api(`/api/redesign/${DSG.taskId}/regenerate`, { method: 'POST', body: JSON.stringify({ params: DSG.params }) });
    DSG.task = { status: 'generating' }; DSG.images = []; DSG.selectedId = null;
    dsgSetStep(3); dsgRenderB(); dsgPoll();
    toast('重新生成中');
  } catch (e) { toast(e.message); }
}
async function dsgSaveVersion() {
  if (!DSG.taskId || !DSG.selectedId) return;
  const note = ($('#dsg-note') && $('#dsg-note').value || '').trim();
  try {
    const d = await api(`/api/redesign/${DSG.taskId}/select`, { method: 'POST', body: JSON.stringify({ image_id: DSG.selectedId, note }) });
    toast(`已存为新版次 ${d.ver}`);
    await dsgLoadHist();
    dsgSetStep(1); dsgRenderA(); dsgRenderB();
  } catch (e) { toast(e.message); }
}

/* ---------------- 资产库（v0.16.9） ---------------- */
let AST = null;
async function viewAssets() {
  setNav('assets');
  AST = { type: 'candidate', garment_id: '', garments: [], items: [] };
  app.innerHTML = `${topbar('资产库')}
  <div class="page"><div class="card" style="padding:10px">
    <div class="rowline">
      <div class="seg" style="margin:0">
        <button class="chip" data-t="candidate">设计候选图</button>
        <button class="chip" data-t="inspiration">灵感库</button>
      </div>
      <button class="btn sm ghost" id="ast-up" style="margin-left:auto">上传灵感图</button>
    </div>
    <div class="frow mt8" style="margin-bottom:0"><select id="ast-g"><option value="">全部款</option></select></div>
  </div><div id="ast-grid" class="asset-grid"></div></div>`;
  AST.garments = await api('/api/garments').catch(() => []);
  const gs = $('#ast-g');
  AST.garments.forEach((g) => { const o = document.createElement('option'); o.value = g.id; o.textContent = `${g.style_no} ${g.name}`; gs.appendChild(o); });
  gs.onchange = () => { AST.garment_id = gs.value; astLoad(); };
  app.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { AST.type = b.dataset.t; astPaintTabs(); astLoad(); });
  $('#ast-up').onclick = astUploadModal;
  astPaintTabs(); astLoad();
}
function astPaintTabs() {
  app.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === AST.type));
  $('#ast-up').style.display = AST.type === 'inspiration' ? '' : 'none';
}
async function astLoad() {
  const q = new URLSearchParams({ type: AST.type, ...(AST.garment_id ? { garment_id: AST.garment_id } : {}) });
  AST.items = await api(`/api/assets?${q}`).catch(() => []);
  const g = $('#ast-grid');
  g.innerHTML = AST.items.length ? AST.items.map((it, i) => `
    <button class="asset" data-i="${i}"><img src="${esc(it.thumb_path || it.path)}" loading="lazy">
    ${it.selected ? '<span class="cand-pick">已选定</span>' : ''}</button>`).join('')
    : '<div class="empty">暂无图片</div>';
  g.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => astDetail(AST.items[Number(b.dataset.i)]));
}
function astDetail(it) {
  const gname = (AST.garments.find((x) => String(x.id) === String(it.garment_id)) || {}).style_no || '';
  Modal.open({
    title: it.kind === 'candidate' ? '候选图' : '灵感图',
    body: `<img class="ast-big" src="${esc(it.path)}">
      <div class="muted mt4">${esc(gname)} · ${esc(fmtDate(it.created_at))}${it.source_url ? ` · <a href="${esc(it.source_url)}" target="_blank" rel="noopener">来源</a>` : ''}</div>
      <label class="fl">备注</label><textarea id="ast-note">${esc(it.note || '')}</textarea>
      <div class="modal-controls"><div class="ctrlrow">
        <button class="btn sm" id="ast-save">保存备注</button>
        ${it.kind === 'inspiration' ? '<button class="btn sm ghost" id="ast-redesign">以此新建改款</button>' : ''}
        <button class="btn sm danger" id="ast-del">删除</button>
      </div></div>`,
  });
  $('#ast-save').onclick = async () => {
    try { await api(`/api/assets/${it.kind}/${it.id}`, { method: 'PUT', body: JSON.stringify({ note: $('#ast-note').value }) }); toast('备注已保存'); Modal.clear(); astLoad(); }
    catch (e) { toast(e.message); }
  };
  $('#ast-del').onclick = () => Modal.confirm({
    title: '删除图片', body: '将同时删除文件和记录，不可恢复。', okText: '删除',
    onOk: async () => {
      try { await api(`/api/assets/${it.kind}/${it.id}`, { method: 'DELETE' }); toast('已删除'); Modal.clear(); astLoad(); }
      catch (e) { toast(e.message); }
    },
  });
  const rd = $('#ast-redesign');
  if (rd) rd.onclick = () => {
    sessionStorage.setItem('dsg_insp', JSON.stringify({ id: it.id, path: it.path, note: it.note, garment_id: it.garment_id }));
    Modal.clear(); location.hash = '#/design';
  };
}
function astUploadModal() {
  Modal.open({
    title: '上传灵感图',
    body: `<label class="fl">图片</label><input type="file" id="ast-file" accept="image/*">
      <label class="fl">备注</label><input id="ast-note2" placeholder="如：蕾丝花型参考">
      <label class="fl">来源链接（可选）</label><input id="ast-src" placeholder="https://">
      <label class="fl">关联款（可选）</label><select id="ast-g2"><option value="">不关联</option>
        ${AST.garments.map((g) => `<option value="${g.id}">${esc(g.style_no)} ${esc(g.name)}</option>`).join('')}</select>
      <div class="modal-controls"><button class="btn" id="ast-do">上传</button></div>`,
  });
  $('#ast-do').onclick = async () => {
    const f = $('#ast-file').files && $('#ast-file').files[0];
    if (!f) return toast('请先选择图片');
    try {
      const du = await fileToDataUrl(f);
      const up = await api('/api/design/upload', { method: 'POST', body: JSON.stringify({ dataUrl: du, kind: 'inspiration' }) });
      await api('/api/inspirations', {
        method: 'POST',
        body: JSON.stringify({ path: up.path, note: $('#ast-note2').value.trim(), source_url: $('#ast-src').value.trim(), garment_id: $('#ast-g2').value || null }),
      });
      toast('灵感图已入库'); Modal.clear(); astLoad();
    } catch (e) { toast(e.message); }
  };
}
