/* 回复模板库种子数据 v0.2.0
 * - 种子模板 is_seed=1，可删、可从 POST /api/reply-templates/reseed 重建
 * - 正文一字不改（多语种原文），只做占位符替换：价格→{{price}} 交期→{{lead_time}} 人名→{{buyer_name}}
 * - 红线：{{price}} / {{lead_time}} 为空时 render 返回 400，不许复制发出
 */
import db, { now } from './db.js';

export const SEED_TEMPLATES = [
  // ---------- 跟进 nudge（通用三段式：叫出名字→给一条图片上看不到的信息→只问两个低门槛问题）----------
  {
    lang: 'EN', scene: 'nudge', source_buyer: 'seed-nudge',
    title: '英文-跟进：通用三段式',
    note_zh: '买家 3 天以上没回时用：点名+给一条图上看不到的定制信息+只问两个问题',
    body: `Hi {{buyer_name}}, just following up — did you see my message about the {{product}}?

One detail the photos don't show: we can make it in other colors and adjust it to your measurements.

Would you like me to: 1) send you fabric photos? 2) work out a quotation for {{quantity}} pieces?

Best regards,
Yingzi`,
  },
  {
    lang: 'ES', scene: 'nudge', source_buyer: 'seed-nudge',
    title: '西语-跟进：通用三段式',
    note_zh: '买家 3 天以上没回时用：点名+给一条图上看不到的定制信息+只问两个问题',
    body: `Hola {{buyer_name}}, solo quería saber si viste mi mensaje sobre {{product}}.

Un detalle que no se ve en las fotos: podemos hacerlo en otros colores y ajustarlo a tus medidas.

¿Te gustaría que: 1) te envíe fotos de las telas? 2) te prepare una cotización para {{quantity}} piezas?

Saludos cordiales,
Yingzi`,
  },
  {
    lang: 'PT', scene: 'nudge', source_buyer: 'seed-nudge',
    title: '葡语-跟进：通用三段式',
    note_zh: '买家 3 天以上没回时用：点名+给一条图上看不到的定制信息+只问两个问题',
    body: `Olá {{buyer_name}}, só passando para saber se você viu minha mensagem sobre {{product}}.

Um detalhe que não aparece nas fotos: podemos fazer em outras cores e ajustar às suas medidas.

Você gostaria que eu: 1) enviasse fotos dos tecidos? 2) preparasse um orçamento para {{quantity}} peças?

Atenciosamente,
Yingzi`,
  },
  {
    lang: 'FR', scene: 'nudge', source_buyer: 'seed-nudge',
    title: '法语-跟进：通用三段式',
    note_zh: '买家 3 天以上没回时用：点名+给一条图上看不到的定制信息+只问两个问题',
    body: `Bonjour {{buyer_name}}, je me permets de revenir vers vous au sujet de {{product}}.

Un détail que les photos ne montrent pas : nous pouvons le réaliser dans d'autres coloris et l'ajuster à vos mesures.

Souhaitez-vous que : 1) je vous envoie des photos des tissus ? 2) je vous prépare un devis pour {{quantity}} pièces ?

Cordialement,
Yingzi`,
  },
  {
    lang: 'AR', scene: 'nudge', source_buyer: 'seed-nudge',
    title: '阿语-跟进：通用三段式',
    note_zh: '买家 3 天以上没回时用：点名+给一条图上看不到的定制信息+只问两个问题',
    body: `مرحباً {{buyer_name}}، أردت فقط التأكد أنك رأيت رسالتي عن {{product}}.

تفصيل لا يظهر في الصور: يمكننا تنفيذه بألوان أخرى وتعديله حسب مقاساتك.

هل تريدين أن: 1) أرسل لك صور الأقمشة؟ 2) أجهز لك عرض سعر لـ {{quantity}} قطع؟

مع تحياتي،
Yingzi`,
  },
  // ---------- 以下为从买家档案提取的现成草稿（定稿版，正文一字不改，仅占位符替换）----------
  {
    lang: 'EN', scene: 'first', source_buyer: 'joel-salamon',
    title: '英文-首回：自有设计稿客户四问（身份/数量/预算/交期）',
    note_zh: '买家发来自有设计图求报价时用：先问清身份、数量、预算、交期再谈能不能做，预算和数量是诚意试金石',
    body: `Hi {{buyer_name}},

Thank you for sharing your designs — they're beautiful! Yes, we support full customization of your own styles.

To prepare an accurate quotation, could you please let me know:

1. Are these designs for your own brand or boutique?
2. How many pieces would you like for each style — 1 piece, or more?
3. What is your target budget per piece?
4. When do you need them delivered?

Looking forward to working with you!

Best regards,
Yingzi`,
  },
  {
    lang: 'EN', scene: 'ask', source_buyer: 'joel-salamon',
    title: '英文-追问：样品四问（款式/预算/交期/尺码）',
    note_zh: '买家确认要做样品后用：款式、样品预算、交期、尺码一次问齐；"样品费可抵大货款"是留客钩子',
    body: `Hi {{buyer_name}},

That's wonderful — we'd love to support your brand!

For the samples, could you please confirm:

1. Which style(s) would you like — the pearl gown, the sculptural gown, or both?
2. What is your target budget per sample piece?
3. When do you need the samples delivered?
4. Could you share the measurements or size specs for the samples?

Our sample lead time is normally {{lead_time}} depending on complexity. The sample fee can be deducted from your bulk order when you proceed.

Looking forward to your confirmation!

Best regards,
Yingzi`,
  },
  {
    lang: 'EN', scene: 'quote', source_buyer: 'joel-salamon',
    title: '英文-报价：三款婚纱样品报价',
    note_zh: '多款样品一起报价时用。注意：三款价格各不相同，{{price}}渲染后三行同价，发出前务必手动改第2、3款的实际价格；附"先做一件"+样品费抵扣话术',
    body: `Hi {{buyer_name}},

Thank you! Here are my sample quotations:

1. Silver beaded gown: {{price}} / piece
2. Ivory sculptural gown: {{price}} / piece
3. Ivory pearl gown: {{price}} / piece

Sample lead time is {{lead_time}} per piece (the beaded styles take longer due to hand beadwork).

Two suggestions from my experience:
- I recommend starting with **1 style** as the first sample, so we can perfect the fit and details before moving to the others.
- The sample fee will be **fully deducted** from your bulk order when you proceed.

Prices are based on fabrics similar to the photos — please let me know if you have specific fabric requirements. Also, could you share the measurements and your target delivery date?

Looking forward to your decision!

Best regards,
Yingzi`,
  },
  {
    lang: 'EN', scene: 'ask', source_buyer: 'marlen-kell-rosario',
    title: '英文-追问：订单已下后客户要求换面料',
    note_zh: '客户下单后要求换面料/改方案时用：先说没问题再说代价（重新订面料可能延长交期），请客户确认后执行；顺带催税号地址',
    body: `Good morning!

No problem at all — we can change to solid navy blue fabric.

Just to let you know: I already ordered the navy blue plaid fabric for your suit as we discussed, so switching to solid means re-ordering the fabric, which may add a few days to the delivery time.

Please confirm you'd like to go ahead with the solid navy blue, and I'll arrange it right away.

Also, I'm still waiting for your CPF, phone number and detailed shipping address for the delivery to Brazil.

Best regards,
Yingzi`,
  },
  {
    lang: 'EN', scene: 'ask', source_buyer: 'marlen-kell-rosario',
    title: '英文-追问：巴西订单发货前确认（税号/税费/对账）',
    note_zh: '巴西订单发货前用：收齐电话+详细地址，谈妥进口税由谁付，并与订单金额对账（175 vs 110 差额）',
    body: `Perfect, thank you!

Confirmed — solid navy blue fabric. I'll arrange it right away.

I have your CPF. Could you also send me your phone number and full shipping address (street, number, city, state, postal code)?

One more thing to confirm before delivery: the import tax in Brazil (customs + state tax, collected on delivery) — will you take care of it on your side? Also, in your order the total was USD 175 while the suit is USD 110 — is the USD 65 difference the shipping fee?

Once I have your address, production starts right away.

Best regards,
Yingzi`,
  },
  {
    lang: 'EN', scene: 'ask', source_buyer: 'marlen-kell-rosario',
    title: '英文-追问：巴西订单索要税号地址',
    note_zh: '巴西订单生产后发货前用：索要CPF税号+电话+地址，并提前告知进口税到付',
    body: `Hi {{buyer_name}},

Your suit is now in production. To ship it to Brazil by express courier, Brazilian customs requires your tax ID — could you please send me:

1. Your **CPF number**
2. Your **phone number**
3. Your **full delivery address**

One more thing: Brazil charges import tax on incoming parcels (about 35% customs duty plus state tax), collected by the courier on delivery. Please confirm you're fine with paying this when it arrives.

Once I have your CPF and address, I'll ship it out right away.

Best regards,
Yingzi`,
  },
  {
    lang: 'EN', scene: 'quote', source_buyer: 'andrei-octavian-grigore',
    title: '英文-报价：Super 150 羊毛真丝燕尾服（起报价格）',
    note_zh: '高端面料燕尾服询盘用：先报起报价格{{price}}占位，问清数量/颜色/尺码/交期；运费关税另计',
    body: `Hi {{buyer_name}},

Thank you for your inquiry! Yes, we can make a Super 150 wool/silk tuxedo — with satin peak/shawl lapels, satin-covered buttons, and the satin stripe along the trousers.

To give you an accurate quote, could you please confirm:

1. Quantity — 1 piece?
2. Color — classic black, or another color?
3. Your measurements (chest, waist, height, etc.) — I can send you a measurement guide if needed.
4. When do you need it?

Our Super 150 wool/silk custom tuxedos start from {{price}} per piece. DHL express shipping to the US and any import duty will be confirmed separately.

Looking forward to your details!

Best regards,
Yingzi`,
  },
  {
    lang: 'EN', scene: 'first', source_buyer: 'andrei-octavian-grigore',
    title: '英文-首回：请买家明确要哪款产品',
    note_zh: '询盘没说要哪款时用：请买家发款名/截图/链接，并介绍定制服务',
    body: `Hi,

Thank you for your inquiry! To give you an accurate price and details, could you please let me know which product you're interested in — for example the style name, or a screenshot/link from our shop?

We specialize in custom evening dresses and men's suits, with OEM/ODM service available. Samples can be arranged on request.

Looking forward to hearing from you.

Best regards,
Yingzi
Guangzhou Yingzi Fashion Co., Ltd.`,
  },
  {
    lang: 'EN', scene: 'ask', source_buyer: 'sodari-ajay',
    title: '英文-追问：三件套西装询盘（颜色/尺码/样衣还是批量）',
    note_zh: '男士西装询盘用：颜色、尺码/量体数据、1件是样衣还是批量开头',
    body: `Hi {{buyer_name}},

Thank you for your inquiry about the men's Italian style slim fit 3-piece business suit set.

Could you please confirm: 1. Which color do you prefer? 2. What size do you need (or your measurements — chest, waist, height)? 3. Is this 1 piece a sample, or the start of a larger order?

Once I have these details I can quote you accurately.

Best regards,
Yingzi`,
  },
  {
    lang: 'ES', scene: 'ask', source_buyer: 'jasmina-gonsalez',
    title: '西语-追问：西装询盘（款式/尺码数量/交期）',
    note_zh: '西语西装询盘用：款式（请发图）、尺码数量、交期',
    body: `Hola {{buyer_name}},

Gracias por su consulta. ¿Podría indicarme: 1. ¿Qué modelo de traje le interesa (una foto o enlace nos ayudaría mucho)? 2. ¿Qué talla necesita y cuántas piezas? 3. ¿Para cuándo lo necesita?

Con estos datos le preparo una cotización precisa.

Saludos cordiales,
Yingzi`,
  },
  {
    lang: 'EN', scene: 'ask', source_buyer: 'furaha-mawamba',
    title: '英文-追问：给了尺码但没说要哪款',
    note_zh: '买家只给了尺码没说款式时用：请确认款式（发图）+数量',
    body: `Hi {{buyer_name}},

Thanks for sharing your sizes ({{size}}). Could you please let me know: 1. Which suit style are you interested in? (A photo or link would help a lot) 2. How many pieces would you like?

Once confirmed, I'll quote you right away.

Best regards,
Yingzi`,
  },
  {
    lang: 'EN', scene: 'quote', source_buyer: 'cael-joyce',
    title: '英文-报价：刺绣燕尾服样衣（量体+翻领+运费）',
    note_zh: '定制刺绣燕尾服询盘用：要量体数据、翻领偏好、国家邮编核算运费；样衣价{{price}}、制作期{{lead_time}}均为占位，须用户填实价',
    body: `Hi {{buyer_name}},

Thank you for your inquiry and the reference photo! We can make this custom men's black slim-fit tuxedo (jacket + pants) with white lace/floral embroidery appliqué — exactly the look in your photo.

To prepare an accurate quotation, could you please provide:
1. Your measurements: height, chest, waist, hips, shoulder width, sleeve length, and trouser length (or your usual suit size)
2. Lapel preference: peak lapel or notch lapel?
3. Your country and postal code, so I can quote shipping

For reference, the sample price for this embroidered tuxedo is {{price}} (to be confirmed), with {{lead_time}} production time. We specialize in custom men's suits with OEM/ODM service.

Looking forward to hearing from you.

Best regards,
Yingzi
Guangzhou Yingzi Fashion Co., Ltd.`,
  },
  {
    lang: 'FR', scene: 'ask', source_buyer: 'kubilay-ceribas',
    title: '法语-追问：请明确是哪款夹克',
    note_zh: '法语询盘只说"夹克"没指明款式时用：一句话请买家明确款式颜色尺码数量',
    body: `Bonjour, merci pour votre message ! Pourriez-vous me préciser de quelle veste il s'agit (modèle, couleur, taille, quantité) ? Ainsi je pourrai vous répondre avec précision. Cordialement, Yingzi`,
  },
  {
    lang: 'EN', scene: 'first', source_buyer: 'cinare-osmanli',
    title: '英文-首回：只说了Hi的询盘（产品/尺码/数量）',
    note_zh: '询盘只有问好没实质内容时用：产品、尺码、数量三问',
    body: `Hi {{buyer_name}},

Thank you for reaching out! Could you let me know which product you are interested in, your size and the quantity you need? I'll get back to you with a quotation shortly.

Best regards,
Yingzi
Guangzhou Yingzi Fashion Co., Ltd.`,
  },
  {
    lang: 'AR', scene: 'ask', source_buyer: 'alqhtany-alqhtany',
    title: '阿语-追问：鱼尾缎面晚礼服（颜色/尺码/样衣还是试单）',
    note_zh: '阿语晚礼服询盘用：颜色、尺码、2件是样衣还是试单；附工厂定制能力介绍',
    body: `السلام عليكم ورحمة الله،

شكراً جزيلاً لاهتمامكم بفستان السهرة الساتان ذو الكتف الواحد بتصميم ذيل السمكة (One Shoulder Ruched Pleated Mermaid Evening Gown).

لتقديم عرض سعر دقيق لكم، هل يمكنكم تأكيد ما يلي:
1. اللون / الألوان المطلوبة
2. المقاسات المطلوبة (US / EU / UK)
3. هل القطعتان للعينة أم لطلب تجريبي؟

نحن مصنع متخصص في فساتين السهرة، وندعم التخصيص OEM/ODM (اللون، القماش، المقاسات، الملصقات الخاصة).

في انتظار ردكم الكريم.`,
  },
  {
    lang: 'EN', scene: 'ask', source_buyer: 'alqhtany-alqhtany',
    title: '英文-追问：鱼尾缎面晚礼服（颜色/尺码/样衣还是试单）',
    note_zh: '晚礼服询盘用（阿语版的英文对照）：颜色、尺码、2件是样衣还是试单',
    body: `Hello,

Thank you for your interest in our One Shoulder Ruched Pleated Mermaid Satin Evening Gown.

To prepare an accurate quotation, could you please confirm:
1. Preferred color(s)
2. Sizes needed (US / EU / UK)
3. Are the 2 pieces for samples or a trial order?

We are a specialized evening-dress manufacturer and support OEM/ODM customization (color, fabric, sizing, private labels).

Looking forward to your reply.

Best regards,
**Yingzi**
Guangzhou Yingzi Fashion Co., Ltd.`,
  },
  {
    lang: 'EN', scene: 'ask', source_buyer: 'alexandra-crawford',
    title: '英文-追问：金属缎面美人鱼晚礼服询盘',
    note_zh: '金属缎面晚礼服询盘用：颜色、尺码、样衣还是试单；样衣交期{{lead_time}}占位',
    body: `Hi {{buyer_name}},

Thanks for reaching out about our Custom Elegant Metallic Satin Mermaid Evening Dress (Strapless, Deep V).

To give you an accurate quote, could you please confirm:
1. Preferred color(s) of the metallic satin
2. Sizes needed (US / EU / UK)
3. Are the 2 pieces for samples or a trial order?

We're a specialized evening-dress manufacturer offering OEM/ODM customization (colors, fabrics, sizing, private labels). Sample lead time is typically {{lead_time}} depending on complexity.

Happy to send fabric swatch photos or more details on request.

Best regards,
**Yingzi**
Guangzhou Yingzi Fashion Co., Ltd.`,
  },
  {
    lang: 'DE', scene: 'ask', source_buyer: 'suse-liebesuse',
    title: '德语-追问：蕾丝网纱晚礼裙（颜色/尺码/数量）',
    note_zh: '德语晚礼裙询盘用：颜色、尺码、大概数量；附定制服务介绍',
    body: `Guten Tag,

vielen Dank für Ihre Anfrage zu unserem Abendkleid aus Spitze und Tüll (Spaghettiträger, V-Ausschnitt, A-Linie, bodenlang).

Gerne erstellen wir Ihnen ein Angebot. Könnten Sie uns bitte mitteilen:

1. Welche Farbe wünschen Sie?
2. Welche Größen benötigen Sie?
3. Wie viele Stück möchten Sie ungefähr bestellen?

Wir bieten Maßanfertigung (OEM/ODM) an – Farbe, Größe und Details können individuell angepasst werden.

Mit freundlichen Grüßen
Yingzi
Guangzhou Yingzi Fashion Co., Ltd.`,
  },
  {
    lang: 'PT', scene: 'first', source_buyer: 'mercedes-silvasantos',
    title: '葡语-首回：挂脖钉珠裙（后背做法转定制卖点）',
    note_zh: '买家问产品细节但无照片时用：把"可定制"变成卖点（后背可敞开/拉链），顺手问数量和交期',
    body: `Olá, obrigada pela sua mensagem!

Este vestido é feito sob medida — as costas podem ser abertas (com amarração no pescoço, no estilo halter clássico) ou fechadas com zíper invisível. Qual estilo você prefere?

Estou separando mais fotos do modelo e te envio ainda hoje.

Para eu te passar o orçamento certinho: quantas peças você precisa e para quando?

Atenciosamente,
Yingzi`,
  },
  {
    lang: 'AR', scene: 'quote', source_buyer: 'ly-ly',
    title: '阿语-报价：粉色裙价格区间（按数量定价）',
    note_zh: '阿语客户问价时用：先报公开价格区间{{price}}占位，让客户报数量和国家再给实价含运费',
    body: `أهلاً بك! أنا Yingzi، سأتواصل معك بنفسي من الآن.

الفستان الوردي (3D floral tulle A-line): السعر **{{price}}** دولار أمريكي للقطعة، حسب الكمية.

كم قطعة تريدين؟ وإلى أي بلد سيكون الشحن؟ سأعطيك السعر الدقيق مع الشحن فوراً.

مع تحياتي،
Yingzi`,
  },
  {
    lang: 'EN', scene: 'first', source_buyer: 'rose-benjamin',
    title: '英文-首回：发产品图询盘的三段式开场白',
    note_zh: '买家发产品图询盘时的标准开场：叫出名字→给一条图上看不到的信息→只问两个问题（颜色、数量+交期）。中间产品描述句按实际产品替换',
    body: `Hi {{buyer_name}}, thanks for your interest in this dress!

This square-neck satin mermaid gown is one of our most requested styles — the wide straps and built-in bra give great support for evening wear. We can also make it in other colors and adjust the length to your needs.

Could you let me know: 1) Which color do you prefer? 2) How many pieces do you need, and when do you need them?

I'll work out an accurate quotation for you right away.

Best regards,
Yingzi`,
  },
  {
    lang: 'FR', scene: 'quote', source_buyer: 'jean-malanda',
    title: '法语-报价：刺绣燕尾服样衣（尺码/运费）',
    note_zh: '法语刺绣燕尾服询盘用：要尺码数量、国家邮编；样衣价{{price}}、交期{{lead_time}}均为占位，"价格交期待确认"',
    body: `Bonjour,

Merci pour votre message ! Nous pouvons réaliser ce smoking noir avec broderie florale dorée.

Pour préparer un devis précis, pourriez-vous me préciser :
1. Votre taille (ou vos mesures) et la quantité souhaitée
2. Votre pays et code postal, pour chiffrer la livraison

À titre indicatif, pour ce modèle le prix de l'échantillon est de {{price}}, délai de production {{lead_time}} — prix et délai à confirmer.

Cordialement,
Yingzi`,
  },
];

const LANGS = ['EN', 'ES', 'PT', 'FR', 'DE', 'AR'];
const SCENES = ['first', 'ask', 'quote', 'nudge'];
export { LANGS, SCENES };

export function seedReplyTemplates() {
  const n = db.prepare('SELECT COUNT(*) AS c FROM reply_templates').get().c;
  if (n > 0) return 0;
  const ins = db.prepare(
    `INSERT INTO reply_templates (lang,scene,title,body,note_zh,source_buyer,is_seed,created_at,updated_at)
     VALUES (?,?,?,?,?,?,1,?,?)`
  );
  const t = now();
  const tx = db.transaction(() => {
    for (const s of SEED_TEMPLATES) {
      ins.run(s.lang, s.scene, s.title, s.body, s.note_zh || '', s.source_buyer || '', t, t);
    }
  });
  tx();
  return SEED_TEMPLATES.length;
}
