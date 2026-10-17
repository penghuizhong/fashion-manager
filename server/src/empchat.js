// v0.16.0：员工简单聊天（soul + memory，不检索）路由模块：由 server/src/index.js 经 mountEmpChat 挂载
export function mountEmpChat(app, ctx) {
  const { db, J, now, DATA_DIR, aiMsgCheck, getAIConfig, getAdminConfig, logUsage, getServiceId } = ctx;
  // ============ v0.16.0：员工简单聊天（soul + memory，不检索） ============
  // 关思考参数（借鉴 SoulChat providers.js）：
  // OpenRouter 系中转认 reasoning.enabled=false；qwen 系再加 enable_thinking=false。
  // token-plan 这类自定义中转按 custom 处理：两个都发，哪个生效用哪个。
  function thinkingOffParams(model) {
    return {
      reasoning: { enabled: false },
      ...(/qwen/i.test(model || '') ? { enable_thinking: false } : {}),
    };
  }
  // 通用 chat completion（temperature 可调，默认 0.7）
  async function chatComplete(messages, model, maxTokens, opts = {}) {
    const cfg = getAIConfig();
    if (!model) throw new Error('未配置模型');
    if (!cfg.api_key) throw new Error('未配置 API Key');
    const url = cfg.base_url.replace(/\/+$/, '') + '/chat/completions';
    const body = {
      model, messages,
      temperature: opts.temperature !== undefined ? opts.temperature : 0.7,
      max_tokens: maxTokens || 800,
      ...thinkingOffParams(model),
    };
    if (opts.jsonMode) body.response_format = { type: 'json_object' };
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.api_key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d.error && d.error.message) || `模型服务返回 ${r.status}`);
    if (d.usage) logUsage(model, opts.usageTag || 'empChat', d.usage.prompt_tokens || 0, d.usage.completion_tokens || 0);
    return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
  }
  // 流式 chat completion（借鉴 SoulChat llm.js chatStream）：每收到 delta 调 onToken，返回完整文本
  async function chatCompleteStream(messages, model, maxTokens, onToken) {
    const cfg = getAIConfig();
    if (!model) throw new Error('未配置模型');
    if (!cfg.api_key) throw new Error('未配置 API Key');
    const url = cfg.base_url.replace(/\/+$/, '') + '/chat/completions';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.api_key}` },
      body: JSON.stringify({
        model, messages, temperature: 0.7, max_tokens: maxTokens || 800,
        stream: true, stream_options: { include_usage: true },
        ...thinkingOffParams(model),
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`模型服务返回 ${r.status}：${t.slice(0, 200)}`); }
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', full = '', usage = null, sawDone = false;
    const handleLine = (line) => {
      const t = line.trim();
      if (!t.startsWith('data:')) return;
      const data = t.slice(5).trim();
      if (data === '[DONE]') { sawDone = true; return; }
      if (!data) return;
      try {
        const json = JSON.parse(data);
        if (json.usage) usage = json.usage;
        const d = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
        if (d) { full += d; onToken(d); }
      } catch (e) { /* 忽略坏块 */ }
    };
    for (;;) {
      let readResult;
      try {
        readResult = await Promise.race([
          reader.read(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('STREAM_STALLED')), 25000)),
        ]);
      } catch (e) {
        // cancel() 本身返回 promise，必须接住，否则未处理 rejection 会拖垮进程
        try { await reader.cancel().catch(() => {}); } catch (e2) {}
        break;
      }
      const { done, value } = readResult;
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      lines.forEach(handleLine);
    }
    if (buf.trim()) handleLine(buf);
    if (usage) logUsage(model, 'empChat', usage.prompt_tokens || 0, usage.completion_tokens || 0);
    // 上游未正常结束（缺 [DONE]）视为中断，由调用方决定如何处理
    if (!sawDone) { const e = new Error('TRUNCATED'); e.partial = full; throw e; }
    return full;
  }
  // 员工模型解析：员工配置优先，回退全局
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
