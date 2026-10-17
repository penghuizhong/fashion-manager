// 西装产品视觉工作流：独立产品档案 + 四类素材任务。复用现有 garments，不重复建设生图服务。
export function mountVisualWorkflow(app, { db, now }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS visual_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      garment_id INTEGER REFERENCES garments(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'mens-suit',
      color TEXT NOT NULL DEFAULT '',
      fit TEXT NOT NULL DEFAULT 'slim',
      pieces TEXT NOT NULL DEFAULT 'three-piece',
      lapel TEXT NOT NULL DEFAULT 'notch',
      buttons TEXT NOT NULL DEFAULT 'two',
      vent TEXT NOT NULL DEFAULT 'double',
      fabric_reference TEXT NOT NULL DEFAULT '',
      front_reference TEXT NOT NULL DEFAULT '',
      back_reference TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS visual_product_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES visual_products(id) ON DELETE CASCADE,
      view_key TEXT NOT NULL,
      title TEXT NOT NULL,
      brief TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','review','approved')),
      selected_image_id INTEGER REFERENCES design_images(id) ON DELETE SET NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(product_id, view_key)
    );
    CREATE TABLE IF NOT EXISTS visual_product_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES visual_products(id) ON DELETE CASCADE,
      version_num INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(product_id, version_num)
    );
    CREATE INDEX IF NOT EXISTS idx_visual_products_updated ON visual_products(updated_at);
    CREATE INDEX IF NOT EXISTS idx_visual_versions_product ON visual_product_versions(product_id, version_num);
    CREATE INDEX IF NOT EXISTS idx_visual_tasks_product ON visual_product_tasks(product_id);
  `);

  const views = [
    { key: 'model', title: '模特形象', brief: '海外目标客群、穿着场景、人物气质与完整正面造型。', prompt: 'Photorealistic premium menswear campaign, full-body male model wearing the exact suit described in the product brief, natural confident pose, clean luxury studio, realistic tailoring and fabric, accurate garment construction, no text, no watermark.' },
    { key: 'product', title: '产品全景', brief: '突出整套西装结构、廓形、搭配与正面/背面可读性。', prompt: 'Premium e-commerce product presentation of the exact mens suit in the product brief, full outfit clearly visible, neutral studio background, accurate lapel, buttons, vents, fit and matching pieces, realistic fabric texture, no text, no watermark.' },
    { key: 'craft', title: '面料与工艺细节', brief: '展示面料纹理、驳头、扣眼、口袋、里布和缝制细节。', prompt: 'Luxury tailoring macro detail board for the exact mens suit in the product brief, close-up fabric weave, lapel roll, buttonhole, buttons, pocket construction and lining, realistic craftsmanship, consistent fabric and color, no text, no watermark.' },
    { key: 'factory', title: '定制与工厂能力', brief: '展示量体、打版、裁剪、缝制或工作室工艺，避免虚构认证。', prompt: 'Authentic made-to-measure menswear atelier scene, skilled tailoring process, pattern cutting and careful hand-finishing, professional clean workshop, realistic tools and materials, premium documentary photography, no text, no watermark.' },
  ];
  const taskRows = (id) => db.prepare('SELECT * FROM visual_product_tasks WHERE product_id=? ORDER BY id').all(id);
  const productRow = (id) => {
    const product = db.prepare('SELECT * FROM visual_products WHERE id=?').get(id);
    return product ? { ...product, tasks: taskRows(id) } : null;
  };
  app.get('/api/visual-workflow/products', (req, res) => {
    const products = db.prepare(`SELECT p.*, g.style_no FROM visual_products p
      LEFT JOIN garments g ON g.id=p.garment_id ORDER BY p.updated_at DESC`).all();
    res.json(products.map((p) => ({ ...p, task_count: db.prepare('SELECT COUNT(*) AS n FROM visual_product_tasks WHERE product_id=?').get(p.id).n,
      approved_count: db.prepare("SELECT COUNT(*) AS n FROM visual_product_tasks WHERE product_id=? AND status='approved'").get(p.id).n })));
  });
  app.post('/api/visual-workflow/products', (req, res) => {
    const b = req.body || {};
    const title = String(b.title || '').trim().slice(0, 120);
    if (!title) return res.status(400).json({ error: '产品名称必填' });
    const garmentId = Number(b.garment_id) || null;
    if (garmentId && !db.prepare('SELECT id FROM garments WHERE id=?').get(garmentId)) return res.status(404).json({ error: '关联款号不存在' });
    const t = now();
    const id = db.transaction(() => {
      const result = db.prepare(`INSERT INTO visual_products
        (garment_id,title,category,color,fit,pieces,lapel,buttons,vent,fabric_reference,front_reference,back_reference,notes,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        garmentId, title, String(b.category || 'mens-suit').slice(0,40), String(b.color || '').slice(0,80),
        String(b.fit || 'slim').slice(0,40), String(b.pieces || 'three-piece').slice(0,40),
        String(b.lapel || 'notch').slice(0,40), String(b.buttons || 'two').slice(0,40), String(b.vent || 'double').slice(0,40),
        String(b.fabric_reference || '').slice(0,500), String(b.front_reference || '').slice(0,500),
        String(b.back_reference || '').slice(0,500), String(b.notes || '').slice(0,3000), t, t);
      const pid = result.lastInsertRowid;
      const insertTask = db.prepare('INSERT INTO visual_product_tasks (product_id,view_key,title,brief,prompt,status,updated_at) VALUES (?,?,?,?,?,\'todo\',?)');
      for (const v of views) insertTask.run(pid, v.key, v.title, v.brief, v.prompt, t);
      return pid;
    })();
    res.status(201).json(productRow(id));
  });
  app.get('/api/visual-workflow/products/:id', (req, res) => {
    const p = productRow(Number(req.params.id));
    if (!p) return res.status(404).json({ error: '视觉产品档案不存在' });
    res.json(p);
  });
  app.patch('/api/visual-workflow/products/:id', (req, res) => {
    const id = Number(req.params.id);
    const old = db.prepare('SELECT * FROM visual_products WHERE id=?').get(id);
    if (!old) return res.status(404).json({ error: '视觉产品档案不存在' });
    const b = req.body || {};
    const fields = ['title','category','color','fit','pieces','lapel','buttons','vent','fabric_reference','front_reference','back_reference','notes'];
    const limits = { title:120, category:40, color:80, fit:40, pieces:40, lapel:40, buttons:40, vent:40, fabric_reference:500, front_reference:500, back_reference:500, notes:3000 };
    const patch = Object.fromEntries(fields.filter(k => b[k] !== undefined).map(k => [k, String(b[k] ?? '').slice(0, limits[k])]));
    if (patch.title !== undefined && !patch.title.trim()) return res.status(400).json({ error: '产品名称不能为空' });
    if (b.garment_id !== undefined) {
      const gid = Number(b.garment_id) || null;
      if (gid && !db.prepare('SELECT id FROM garments WHERE id=?').get(gid)) return res.status(404).json({ error: '关联款号不存在' });
      patch.garment_id = gid;
    }
    const keys = Object.keys(patch);
    if (keys.length) {
      const sets = keys.map(k => `${k}=?`).concat('updated_at=?').join(',');
      db.prepare(`UPDATE visual_products SET ${sets} WHERE id=?`).run(...keys.map(k => patch[k]), now(), id);
    }
    res.json(productRow(id));
  });
  app.get('/api/visual-workflow/products/:id/versions', (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT id FROM visual_products WHERE id=?').get(id)) return res.status(404).json({ error: '视觉产品档案不存在' });
    const versions = db.prepare('SELECT id, product_id, version_num, note, created_at FROM visual_product_versions WHERE product_id=? ORDER BY version_num DESC').all(id);
    res.json(versions);
  });
  app.post('/api/visual-workflow/products/:id/versions', (req, res) => {
    const id = Number(req.params.id);
    const product = productRow(id);
    if (!product) return res.status(404).json({ error: '视觉产品档案不存在' });
    const t = now();
    const note = String((req.body || {}).note || '').trim().slice(0, 300);
    const result = db.transaction(() => {
      const max = db.prepare('SELECT MAX(version_num) AS n FROM visual_product_versions WHERE product_id=?').get(id).n || 0;
      const versionNum = max + 1;
      const saved = db.prepare('INSERT INTO visual_product_versions (product_id,version_num,note,snapshot_json,created_at) VALUES (?,?,?,?,?)')
        .run(id, versionNum, note, JSON.stringify(product), t);
      return { id: saved.lastInsertRowid, product_id: id, version_num: versionNum, note, created_at: t };
    })();
    res.status(201).json(result);
  });
  app.post('/api/visual-workflow/products/:id/versions/:versionId/restore', (req, res) => {
    const id = Number(req.params.id), versionId = Number(req.params.versionId);
    const version = db.prepare('SELECT * FROM visual_product_versions WHERE id=? AND product_id=?').get(versionId, id);
    if (!version) return res.status(404).json({ error: '版本记录不存在' });
    let snapshot;
    try { snapshot = JSON.parse(version.snapshot_json); } catch { return res.status(500).json({ error: '版本快照损坏' }); }
    if (!snapshot || !snapshot.title || !Array.isArray(snapshot.tasks)) return res.status(500).json({ error: '版本快照格式无效' });
    const t = now();
    db.transaction(() => {
      const fields = ['garment_id','title','category','color','fit','pieces','lapel','buttons','vent','fabric_reference','front_reference','back_reference','notes'];
      const sets = fields.map(k => k + '=?').concat('updated_at=?').join(',');
      db.prepare('UPDATE visual_products SET ' + sets + ' WHERE id=?').run(...fields.map(k => snapshot[k] ?? (k === 'garment_id' ? null : '')), t, id);
      for (const task of snapshot.tasks) {
        const imageId = task.selected_image_id && db.prepare("SELECT id FROM design_images WHERE id=? AND kind='generate'").get(task.selected_image_id)
          ? task.selected_image_id : null;
        db.prepare('UPDATE visual_product_tasks SET brief=?,prompt=?,status=?,selected_image_id=?,updated_at=? WHERE id=? AND product_id=?')
          .run(String(task.brief || ''), String(task.prompt || ''), ['todo','in_progress','review','approved'].includes(task.status) ? task.status : 'todo',
            imageId, t, Number(task.id), id);
      }
    })();
    res.json(productRow(id));
  });
  app.patch('/api/visual-workflow/tasks/:id', (req, res) => {
    const id = Number(req.params.id);
    const task = db.prepare('SELECT * FROM visual_product_tasks WHERE id=?').get(id);
    if (!task) return res.status(404).json({ error: '视觉任务不存在' });
    const b = req.body || {};
    const allowed = ['todo','in_progress','review','approved'];
    if (b.status !== undefined && !allowed.includes(b.status)) return res.status(400).json({ error: '任务状态无效' });
    const prompt = b.prompt === undefined ? task.prompt : String(b.prompt).slice(0, 6000);
    const brief = b.brief === undefined ? task.brief : String(b.brief).slice(0, 1000);
    const selected = b.selected_image_id === undefined ? task.selected_image_id : (Number(b.selected_image_id) || null);
    if (selected && !db.prepare("SELECT id FROM design_images WHERE id=? AND kind='generate'").get(selected)) return res.status(400).json({ error: '只能选择资产库中的生成图' });
    db.prepare('UPDATE visual_product_tasks SET prompt=?,brief=?,status=?,selected_image_id=?,updated_at=? WHERE id=?')
      .run(prompt, brief, b.status || task.status, selected, now(), id);
    db.prepare('UPDATE visual_products SET updated_at=? WHERE id=?').run(now(), task.product_id);
    res.json({ ok: true, task: db.prepare('SELECT * FROM visual_product_tasks WHERE id=?').get(id) });
  });
}
