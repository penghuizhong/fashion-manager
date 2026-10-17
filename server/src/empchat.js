// v0.16.0：员工简单聊天（soul + memory，不检索）路由模块：由 server/src/index.js 经 mountEmpChat 挂载
export function mountEmpChat(app, ctx) {
  const { db, J, now, DATA_DIR, aiMsgCheck, aiRateLimit, chatComplete, chatCompleteStream, thinkingOffParams, getAIConfig, getAdminConfig, logUsage, getServiceId } = ctx;
  // ============ v0.16.0：员工简单聊天（soul + memory，不检索） ============
  // 关思考参数（借鉴 SoulChat providers.js）：
  // OpenRouter 系中转认 reasoning.enabled=false；qwen 系再加 enable_thinking=false。
  // token-plan 这类自定义中转按 custom 处理：两个都发，哪个生效用哪个。
  function empModels(svc) {
    const cfg = getAIConfig();
    const mcfg = svc ? JSON.parse(svc.model_config_json || '{}') : {};
    return {
      chat: mcfg.chat_model || cfg.chat_model,
      backend: mcfg.backend_model || cfg.backend_model || cfg.chat_model,
    };
  }
  // 组装上下文：soul + 摘要 + 全部记忆 + 最近20轮
  function buildChatContext(svc) {
    const parts = [];
    const soul = (svc.soul || '').trim();
    parts.push(soul || `你是${svc.name}，一家服装定制工作室的AI员工。用中文简洁、专业、友好地回复客户。`);
    const mems = db.prepare('SELECT content FROM employee_memories WHERE service_id=? ORDER BY id ASC').all(svc.id);
    if (mems.length) parts.push('[已知信息]\n' + mems.map((m) => `- ${m.content}`).join('\n'));
    if (svc.summary) parts.push('[此前对话摘要]\n' + svc.summary);
    return parts.join('\n\n');
  }
  // 简单对话（SSE 流式）：不检索，直接由 chat_model 回复，逐 token 推送
  app.post('/api/ai/chat', aiRateLimit, aiMsgCheck, async (req, res) => {
    const { service_id, message, regenerate } = req.body || {};
    const sid = Number(service_id) || 0;
    const msg = String(message || '').trim();
    if (!(sid > 0) || !msg) return res.status(400).json({ error: '参数错误' });
    const svc = db.prepare('SELECT * FROM ai_services WHERE id=?').get(sid);
    if (!svc) return res.status(404).json({ error: '员工不存在' });
    const models = empModels(svc);
    if (!models.chat) return res.status(400).json({ error: '未配置对话模型' });
    const upto = Number(svc.summary_upto_id) || 0;
    const hist = db.prepare('SELECT role, content FROM chat_messages WHERE service_id=? AND id>? ORDER BY id DESC LIMIT 40').all(sid, upto).reverse();
    const messages = [{ role: 'system', content: buildChatContext(svc) }];
    hist.forEach((m) => messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
    messages.push({ role: 'user', content: msg });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    const send = (obj) => { try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch (e) {} };
    // 重新生成时不重复存档用户消息
    if (!regenerate) db.prepare('INSERT INTO chat_messages (service_id, role, content, meta_json) VALUES (?,?,?,?)').run(sid, 'user', msg.slice(0, 8000), '{}');
    let full = '';
    try {
      full = await chatCompleteStream(messages, models.chat, 800, (tok) => send({ token: tok }));
      if (!full.trim()) throw new Error('模型返回为空');
      db.prepare('INSERT INTO chat_messages (service_id, role, content, meta_json) VALUES (?,?,?,?)').run(sid, 'ai', full.slice(0, 8000), '{}');
      send({ done: true });
      res.end();
      // 后台异步：大总管分析 → 按需记忆 → 按需摘要（不阻塞回复）
      setImmediate(() => orchestrateRound(sid, msg, full).catch(() => {}));
    } catch (e) {
      // 上游中断：保存已生成的部分，并告诉前端可重试
      const partial = full.trim() ? full : (e.partial || '');
      if (partial.trim()) db.prepare('INSERT INTO chat_messages (service_id, role, content, meta_json) VALUES (?,?,?,?)').run(sid, 'ai', partial.slice(0, 8000), '{}');
      send({ error: e.message === 'TRUNCATED' ? '模型输出中断（上游连接断开），可重新生成' : e.message });
      res.end();
    }
  });
  // 会话大总管：每轮分析用户意图，只看最近一轮（token 成本最小），决定是否记忆
  async function orchestrateRound(sid, userMsg, aiReply) {
    const svc = db.prepare('SELECT * FROM ai_services WHERE id=?').get(sid);
    if (!svc) return;
    const models = empModels(svc);
    if (!models.backend) return;
    const sys = `你是对话分析助手。分析下面这轮对话，只输出 JSON，不要输出其他文字。
  格式：{"intent":"一句话意图","need_memory":true/false,"memory_brief":"需要记住的一句话摘要（need_memory为false时为空字符串）","tags":[],"kb_query":""}
  记忆边界（need_memory=true 必须同时满足以下全部）：
  1. 是长期有用的事实：客户姓名/国家/联系方式、尺码/款式/颜色/预算/交期偏好、承诺的跟进事项、已确认的关键信息
  2. 不是寒暄问候、闲聊、一次性问答
  3. 不含密码、支付等敏感信息`;
    let o = null;
    try {
      const raw = await chatComplete(
        [{ role: 'system', content: sys }, { role: 'user', content: `用户：${userMsg}\nAI：${aiReply}` }],
        models.backend, 200, { temperature: 0.1, jsonMode: true, usageTag: 'orchestrator' }
      );
      try { o = JSON.parse(raw); } catch (e) { const m = /\{[\s\S]*\}/.exec(raw); if (m) o = JSON.parse(m[0]); }
    } catch (e) { return; }
    if (!o) return;
    if (o.need_memory && o.memory_brief) {
      try { await extractMemory(svc, String(o.memory_brief), userMsg, aiReply); } catch (e) {}
    }
    try { await maybeSummarize(svc); } catch (e) {}
  }
  // 记忆提取：带已有记忆去重，无事可记返回空数组
  async function extractMemory(svc, brief, userMsg, aiReply) {
    const models = empModels(svc);
    const existing = db.prepare('SELECT content FROM employee_memories WHERE service_id=? ORDER BY id DESC LIMIT 50').all(svc.id);
    const sys = `你是记忆整理助手。根据对话提炼 1-3 条长期记忆，只输出 JSON 数组，不要输出其他文字。
  规则：
  - 每条是一句完整的话，包含主体（如"客户张三偏好藏青色西装"）
  - "已有记忆"中已有的不重复记；冲突的以新的为准（输出更新后的一条）
  - 无事可记输出 []
  格式：[{"content":"..."}]
  已有记忆：
  ${existing.map((m) => `- ${m.content}`).join('\n') || '(无)'}`;
    let arr = null;
    try {
      const raw = await chatComplete(
        [{ role: 'system', content: sys }, { role: 'user', content: `记忆摘要：${brief}\n对话：\n用户：${userMsg}\nAI：${aiReply}` }],
        models.backend, 300, { temperature: 0.1, jsonMode: true, usageTag: 'memoryExtract' }
      );
      try { arr = JSON.parse(raw); } catch (e) { const m = /\[[\s\S]*\]/.exec(raw); if (m) arr = JSON.parse(m[0]); }
    } catch (e) { return; }
    if (!Array.isArray(arr)) return;
    const ins = db.prepare('INSERT INTO employee_memories (service_id, content) VALUES (?,?)');
    arr.slice(0, 3).forEach((it) => {
      const c = String((it && it.content) || '').trim().slice(0, 500);
      if (c) ins.run(svc.id, c);
    });
  }
  // 自动摘要：未摘要消息超 40 条时，把最旧 30 条并入摘要
  async function maybeSummarize(svc) {
    const models = empModels(svc);
    if (!models.backend) return;
    const upto = Number(svc.summary_upto_id) || 0;
    const count = db.prepare('SELECT COUNT(*) as n FROM chat_messages WHERE service_id=? AND id>?').get(svc.id, upto).n;
    if (count <= 40) return;
    const batch = db.prepare('SELECT id, role, content FROM chat_messages WHERE service_id=? AND id>? ORDER BY id ASC LIMIT 30').all(svc.id, upto);
    if (!batch.length) return;
    const sys = '你是对话摘要助手。把下面的对话压缩成一段摘要，保留关键事实（人名、偏好、承诺事项、结论），200字以内，只输出摘要正文。';
    const conv = batch.map((m) => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`).join('\n');
    const part = await chatComplete(
      [{ role: 'system', content: sys }, { role: 'user', content: (svc.summary ? '已有摘要：' + svc.summary + '\n\n新增对话：\n' : '') + conv }],
      models.backend, 500, { temperature: 0.3, usageTag: 'summarize' }
    );
    db.prepare(`UPDATE ai_services SET summary=?, summary_upto_id=?, updated_at=datetime('now','localtime') WHERE id=?`)
      .run(part.trim(), batch[batch.length - 1].id, svc.id);
  }
  // 记忆管理 CRUD
  app.get('/api/admin/emp-memories', (req, res) => {
    const sid = Number(req.query.service_id) || 0;
    res.json(db.prepare('SELECT id, content, created_at FROM employee_memories WHERE service_id=? ORDER BY id DESC').all(sid));
  });
  app.put('/api/admin/emp-memories/:id', (req, res) => {
    const c = String((req.body && req.body.content) || '').trim();
    if (!c) return res.status(400).json({ error: '内容必填' });
    db.prepare('UPDATE employee_memories SET content=? WHERE id=?').run(c.slice(0, 500), Number(req.params.id));
    res.json({ ok: true });
  });
  app.delete('/api/admin/emp-memories/:id', (req, res) => {
    db.prepare('DELETE FROM employee_memories WHERE id=?').run(Number(req.params.id));
    res.json({ ok: true });
  });
  app.delete('/api/admin/ai-services/:id/summary', (req, res) => {
    db.prepare(`UPDATE ai_services SET summary='', summary_upto_id=0 WHERE id=?`).run(Number(req.params.id));
    res.json({ ok: true });
  });

}
