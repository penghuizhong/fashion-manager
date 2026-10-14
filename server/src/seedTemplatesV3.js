/* 回复模板库种子数据 v3（结构化）
 * 由 v2 的 27 条硬编码全文提炼而来：
 * - SNIPPETS：6 条共享落款片段（key='signature' × 6 语种）
 * - TEMPLATES：23 个逻辑模板（1 个跟进三段式 × 5 语言变体 + 22 个买家草稿提炼的通用模板）
 * 规则：
 * - 外语正文一字不改：只做"具体词→变量"替换 + 末尾落款→{{snippet:signature}}
 * - price / lead_time 只要出现就 required:1（业务红线）
 * - 变量名只允许：buyer_name/product/price/lead_time/quantity/country/size/color
 */

export const SNIPPETS = [
  { key: 'signature', lang: 'EN', title_zh: '落款-英文', body: 'Best regards,\nYingzi' },
  { key: 'signature', lang: 'ES', title_zh: '落款-西语', body: 'Saludos cordiales,\nYingzi' },
  { key: 'signature', lang: 'PT', title_zh: '落款-葡语', body: 'Atenciosamente,\nYingzi' },
  { key: 'signature', lang: 'FR', title_zh: '落款-法语', body: 'Cordialement,\nYingzi' },
  { key: 'signature', lang: 'DE', title_zh: '落款-德语', body: 'Mit freundlichen Grüßen,\nYingzi' },
  { key: 'signature', lang: 'AR', title_zh: '落款-阿语', body: 'مع تحياتي،\nYingzi' },
];

export const TEMPLATES = [
  {
    key: 'nudge-3step',
    scene: 'nudge',
    category: '通用',
    note_zh: '买家3天以上没回时用：点名+给一条图上看不到的定制信息+只问两个问题',
    gloss_zh: `{{buyer_name}}您好，跟进一下——您看到我之前发的关于{{product}}的消息了吗？

照片上看不出的一个细节：这款我们可以做其他颜色，还能按您的尺码调整。

您看要不要我：1）给您发面料照片？2）给{{quantity}}件做个报价？

{{snippet:signature}}`,
    source_buyer: 'seed-nudge',
    vars: [
      { name: 'buyer_name', type: 'text', required: 0, label_zh: '买家名', sample: 'Marlen' },
      { name: 'product', type: 'text', required: 0, label_zh: '产品', sample: 'evening gown' },
      { name: 'quantity', type: 'number', required: 0, label_zh: '数量', sample: '10' },
    ],
    locales: [
      { lang: 'EN', title: '跟进：通用三段式', body: `Hi {{buyer_name}}, just following up — did you see my message about the {{product}}?

One detail the photos don't show: we can make it in other colors and adjust it to your measurements.

Would you like me to: 1) send you fabric photos? 2) work out a quotation for {{quantity}} pieces?

{{snippet:signature}}` },
      { lang: 'ES', title: '跟进：通用三段式', body: `Hola {{buyer_name}}, solo quería saber si viste mi mensaje sobre {{product}}.

Un detalle que no se ve en las fotos: podemos hacerlo en otros colores y ajustarlo a tus medidas.

¿Te gustaría que: 1) te envíe fotos de las telas? 2) te prepare una cotización para {{quantity}} piezas?

{{snippet:signature}}` },
      { lang: 'PT', title: '跟进：通用三段式', body: `Olá {{buyer_name}}, só passando para saber se você viu minha mensagem sobre {{product}}.

Um detalhe que não aparece nas fotos: podemos fazer em outras cores e ajustar às suas medidas.

Você gostaria que eu: 1) enviasse fotos dos tecidos? 2) preparasse um orçamento para {{quantity}} peças?

{{snippet:signature}}` },
      { lang: 'FR', title: '跟进：通用三段式', body: `Bonjour {{buyer_name}}, je me permets de revenir vers vous au sujet de {{product}}.

Un détail que les photos ne montrent pas : nous pouvons le réaliser dans d'autres coloris et l'ajuster à vos mesures.

Souhaitez-vous que : 1) je vous envoie des photos des tissus ? 2) je vous prépare un devis pour {{quantity}} pièces ?

{{snippet:signature}}` },
      { lang: 'AR', title: '跟进：通用三段式', body: `مرحباً {{buyer_name}}، أردت فقط التأكد أنك رأيت رسالتي عن {{product}}.

تفصيل لا يظهر في الصور: يمكننا تنفيذه بألوان أخرى وتعديله حسب مقاساتك.

هل تريدين أن: 1) أرسل لك صور الأقمشة؟ 2) أجهز لك عرض سعر لـ {{quantity}} قطع؟

{{snippet:signature}}` },
    ],
  },
  {
    key: 'first-design-4q',
    scene: 'first',
    category: '通用',
    note_zh: '买家发来自有设计图求报价时用：先问清身份、数量、预算、交期再谈能不能做，预算和数量是诚意试金石',
    gloss_zh: `{{buyer_name}}您好，

感谢您分享设计稿——很漂亮！是的，我们支持按您自己的款式全定制。

为了给您报个准确的价格，能否请您告诉我：

1. 这些设计是您自己品牌/精品店用的吗？
2. 每个款想要几件——1件，还是更多？
3. 您的单件目标预算是多少？
4. 您希望什么时候交货？

期待与您合作！

{{snippet:signature}}`,
    source_buyer: 'joel-salamon',
    vars: [
      { name: 'buyer_name', type: 'text', required: 0, label_zh: '买家名', sample: 'Marlen' },
    ],
    locales: [
      { lang: 'EN', title: '首回：自有设计稿客户四问（身份/数量/预算/交期）', body: `Hi {{buyer_name}},

Thank you for sharing your designs — they're beautiful! Yes, we support full customization of your own styles.

To prepare an accurate quotation, could you please let me know:

1. Are these designs for your own brand or boutique?
2. How many pieces would you like for each style — 1 piece, or more?
3. What is your target budget per piece?
4. When do you need them delivered?

Looking forward to working with you!

{{snippet:signature}}` },
    ],
  },
  {
    key: 'ask-sample-4q',
    scene: 'ask',
    category: '通用',
    note_zh: '买家确认要做样品后用：款式、样品预算、交期、尺码一次问齐；"样品费可抵大货款"是留客钩子',
    gloss_zh: `{{buyer_name}}您好，

太好了——我们很乐意为您的品牌服务！

关于样衣，能否请您确认：

1. 想要哪个款——{{product}}？
2. 样衣单件的目标预算是多少？
3. 样衣什么时候要交货？
4. 能否提供样衣的量体数据或尺码规格？

我们的样衣交期一般是{{lead_time}}（看工艺复杂程度）。下大货时样衣费可以抵扣货款。

等您确认！

{{snippet:signature}}`,
    source_buyer: 'joel-salamon',
    vars: [
      { name: 'buyer_name', type: 'text', required: 0, label_zh: '买家名', sample: 'Marlen' },
      { name: 'product', type: 'text', required: 0, label_zh: '产品', sample: 'pearl gown' },
      { name: 'lead_time', type: 'text', required: 1, label_zh: '交期', sample: '25-30 days' },
    ],
    locales: [
      { lang: 'EN', title: '追问：样品四问（款式/预算/交期/尺码）', body: `Hi {{buyer_name}},

That's wonderful — we'd love to support your brand!

For the samples, could you please confirm:

1. Which style(s) would you like — {{product}}?
2. What is your target budget per sample piece?
3. When do you need the samples delivered?
4. Could you share the measurements or size specs for the samples?

Our sample lead time is normally {{lead_time}} depending on complexity. The sample fee can be deducted from your bulk order when you proceed.

Looking forward to your confirmation!

{{snippet:signature}}` },
    ],
  },
  {
    key: 'quote-multi-sample',
    scene: 'quote',
    category: '婚纱',
    note_zh: '多款样品一起报价时用：复制第1行改产品名和价格，各款价格不同、逐行填实价再发出；附"先做一件"+样品费抵扣话术',
    gloss_zh: `{{buyer_name}}您好，

谢谢！样衣报价如下：

1. {{product}}：{{price}} / 件

样衣交期每件{{lead_time}}（钉珠款因为是手工钉珠，时间会长一些）。

凭我的经验给您两点建议：
- 建议先做**1个款**的样衣，把版型和细节做到位，再做其他款。
- 下大货时样衣费**全额抵扣**货款。

价格是按接近照片的面料估的——如果您对面料有具体要求请告诉我。另外，能否提供量体数据和您的目标交货日期？

等您的决定！

{{snippet:signature}}`,
    source_buyer: 'joel-salamon',
    vars: [
      { name: 'buyer_name', type: 'text', required: 0, label_zh: '买家名', sample: 'Marlen' },
      { name: 'product', type: 'text', required: 0, label_zh: '产品', sample: 'beaded gown' },
      { name: 'price', type: 'number', required: 1, label_zh: '价格', sample: '950' },
      { name: 'lead_time', type: 'text', required: 1, label_zh: '交期', sample: '25-30 days' },
    ],
    locales: [
      { lang: 'EN', title: '报价：多款样品报价（逐行改价）', body: `Hi {{buyer_name}},

Thank you! Here are my sample quotations:

1. {{product}}: {{price}} / piece

Sample lead time is {{lead_time}} per piece (the beaded styles take longer due to hand beadwork).

Two suggestions from my experience:
- I recommend starting with **1 style** as the first sample, so we can perfect the fit and details before moving to the others.
- The sample fee will be **fully deducted** from your bulk order when you proceed.

Prices are based on fabrics similar to the photos — please let me know if you have specific fabric requirements. Also, could you share the measurements and your target delivery date?

Looking forward to your decision!

{{snippet:signature}}` },
    ],
  },
  {
    key: 'ask-change-fabric',
    scene: 'ask',
    category: '订单跟进',
    note_zh: '客户下单后要求换面料/改方案时用：先说没问题再说代价（重订面料可能延长交期），请客户确认后执行；顺带补齐电话地址',
    gloss_zh: `早上好！

没问题——您的{{product}}可以换面料。

跟您说明一下：之前按咱们谈好的，我已经把{{product}}的面料订了，现在换的话要重新订面料，交期可能会延长几天。

请您确认一下是否确定要换，确认后我马上安排。

另外，寄往{{country}}的快递，还缺您的电话号码和详细收货地址，麻烦发我一下。

{{snippet:signature}}`,
    source_buyer: 'marlen-kell-rosario',
    vars: [
      { name: 'product', type: 'text', required: 0, label_zh: '产品', sample: 'suit' },
      { name: 'country', type: 'text', required: 0, label_zh: '国家', sample: 'Brazil' },
    ],
    locales: [
      { lang: 'EN', title: '追问：下单后换面料（重订+交期预警）', body: `Good morning!

No problem at all — we can change the fabric for your {{product}}.

Just to let you know: I already ordered the fabric for your {{product}} as we discussed, so switching means re-ordering the fabric, which may add a few days to the delivery time.

Please confirm you'd like to go ahead with the change, and I'll arrange it right away.

Also, I'm still waiting for your phone number and detailed shipping address for the delivery to {{country}}.

{{snippet:signature}}` },
    ],
  },
  {
    key: 'ask-preship-confirm',
    scene: 'ask',
    category: '订单跟进',
    note_zh: '发货前最终确认用：收齐电话+详细地址，谈妥进口税由谁付；如需对账手动加一句金额确认',
    gloss_zh: `好的，谢谢！

已确认——{{product}}，我马上安排。

另外麻烦您发一下电话号码和完整收货地址（街道、门牌号、城市、州、邮编）。

发货前还有一件事要跟您确认：{{country}}的进口税（海关税+州税，派送时收取）——您那边方便到付自理吗？

收到地址后我就马上开工生产。

{{snippet:signature}}`,
    source_buyer: 'marlen-kell-rosario',
    vars: [
      { name: 'product', type: 'text', required: 0, label_zh: '产品', sample: 'suit' },
      { name: 'country', type: 'text', required: 0, label_zh: '国家', sample: 'Brazil' },
    ],
    locales: [
      { lang: 'EN', title: '追问：发货前确认（地址/进口税）', body: `Perfect, thank you!

Confirmed — {{product}}. I'll arrange it right away.

Could you also send me your phone number and full shipping address (street, number, city, state, postal code)?

One more thing to confirm before delivery: the import tax in {{country}} (customs + state tax, collected on delivery) — will you take care of it on your side?

Once I have your address, production starts right away.

{{snippet:signature}}` },
    ],
  },
  {
    key: 'ask-taxid-address',
    scene: 'ask',
    category: '订单跟进',
    note_zh: '发往有清关税号要求的国家时用：索要税号+电话+地址，并提前告知进口税到付',
    gloss_zh: `{{buyer_name}}您好，

您的{{product}}已经在生产了。要快递寄到{{country}}，海关需要您的税号——麻烦您发我一下：

1. 您的**税号**
2. 您的**电话号码**
3. 您的**完整收货地址**

另外：{{country}}对入境包裹收进口税，由快递派送时代收。请您确认到付时方便支付。

收到您的税号和地址后，我马上发货。

{{snippet:signature}}`,
    source_buyer: 'marlen-kell-rosario',
    vars: [
      { name: 'buyer_name', type: 'text', required: 0, label_zh: '买家名', sample: 'Marlen' },
      { name: 'product', type: 'text', required: 0, label_zh: '产品', sample: 'suit' },
      { name: 'country', type: 'text', required: 0, label_zh: '国家', sample: 'Brazil' },
    ],
    locales: [
      { lang: 'EN', title: '追问：索要税号+地址（清关用）', body: `Hi {{buyer_name}},

Your {{product}} is now in production. To ship it to {{country}} by express courier, customs requires your tax ID — could you please send me:

1. Your **tax ID**
2. Your **phone number**
3. Your **full delivery address**

One more thing: {{country}} charges import tax on incoming parcels, collected by the courier on delivery. Please confirm you're fine with paying this when it arrives.

Once I have your tax ID and address, I'll ship it out right away.

{{snippet:signature}}` },
    ],
  },
  {
    key: 'quote-tuxedo-fabric',
    scene: 'quote',
    category: '西装',
    note_zh: '高端面料西装/燕尾服询盘用：先报起报价格占位，问清数量/颜色/尺码/交期；运费关税另计',
    gloss_zh: `{{buyer_name}}您好，

感谢您的询盘！是的，我们可以做{{product}}——缎面枪驳领/青果领、缎面包扣、裤侧缎条都能做。

为了给您报个准确的价格，能否请您确认：

1. 数量——1件？
2. 颜色——经典黑，还是其他颜色？
3. 您的量体数据（胸围、腰围、身高等）——需要的话我可以发您一份量体指南。
4. 您什么时候要？

我们定制的{{product}}单件{{price}}起。DHL快递到{{country}}的运费和进口关税另行确认。

等您的详细信息！

{{snippet:signature}}`,
    source_buyer: 'andrei-octavian-grigore',
    vars: [
      { name: 'buyer_name', type: 'text', required: 0, label_zh: '买家名', sample: 'Andrei' },
      { name: 'product', type: 'text', required: 0, label_zh: '产品', sample: 'Super 150 wool/silk tuxedo' },
      { name: 'price', type: 'number', required: 1, label_zh: '价格', sample: '1100' },
      { name: 'country', type: 'text', required: 0, label_zh: '国家', sample: 'US' },
    ],
    locales: [
      { lang: 'EN', title: '报价：高端面料燕尾服（起报价格）', body: `Hi {{buyer_name}},

Thank you for your inquiry! Yes, we can make a {{product}} — with satin peak/shawl lapels, satin-covered buttons, and the satin stripe along the trousers.

To give you an accurate quote, could you please confirm:

1. Quantity — 1 piece?
2. Color — classic black, or another color?
3. Your measurements (chest, waist, height, etc.) — I can send you a measurement guide if needed.
4. When do you need it?

Our custom {{product}} starts from {{price}} per piece. DHL express shipping to {{country}} and any import duty will be confirmed separately.

Looking forward to your details!

{{snippet:signature}}` },
    ],
  },
  {
    key: 'first-which-product',
    scene: 'first',
    category: '通用',
    note_zh: '询盘没说要哪款时用：请买家发款名/截图/链接，并介绍定制服务',
    gloss_zh: `您好，

感谢您的询盘！为了给您报准确的价格和细节，能否请您告诉我您看中了哪款产品——比如款名，或者我们店铺的截图/链接？

我们专做定制晚礼服和男士西装，支持OEM/ODM服务。如需样衣可以安排。

期待您的回复。

{{snippet:signature}}
Guangzhou Yingzi Fashion Co., Ltd.`,
    source_buyer: 'andrei-octavian-grigore',
    vars: [],
    locales: [
      { lang: 'EN', title: '首回：请买家明确要哪款产品', body: `Hi,

Thank you for your inquiry! To give you an accurate price and details, could you please let me know which product you're interested in — for example the style name, or a screenshot/link from our shop?

We specialize in custom evening dresses and men's suits, with OEM/ODM service available. Samples can be arranged on request.

Looking forward to hearing from you.

{{snippet:signature}}
Guangzhou Yingzi Fashion Co., Ltd.` },
    ],
  },
  {
    key: 'ask-suit-3piece',
    scene: 'ask',
    category: '西装',
    note_zh: '男士西装询盘用：颜色、尺码/量体数据、1件是样衣还是批量开头',
    gloss_zh: `{{buyer_name}}您好，

感谢您咨询{{product}}。

能否请您确认：1. 想要什么颜色？2. 需要什么尺码（或您的量体数据——胸围、腰围、身高）？3. 这1件是做样衣，还是大货的开始？

有了这些信息我就能给您准确报价了。

{{snippet:signature}}`,
    source_buyer: 'sodari-ajay',
    vars: [
      { name: 'buyer_name', type: 'text', required: 0, label_zh: '买家名', sample: 'Ajay' },
      { name: 'product', type: 'text', required: 0, label_zh: '产品', sample: "men's 3-piece suit" },
    ],
    locales: [
      { lang: 'EN', title: '追问：西装询盘（颜色/尺码/样衣或批量）', body: `Hi {{buyer_name}},

Thank you for your inquiry about the {{product}}.

Could you please confirm: 1. Which color do you prefer? 2. What size do you need (or your measurements — chest, waist, height)? 3. Is this 1 piece a sample, or the start of a larger order?

Once I have these details I can quote you accurately.

{{snippet:signature}}` },
    ],
  },
  {
    key: 'ask-suit-es',
    scene: 'ask',
    category: '西装',
    note_zh: '西语西装询盘用：款式（请发图）、尺码数量、交期',
    gloss_zh: `{{buyer_name}}您好，

感谢您的咨询。能否请您告诉我：1. 您看中了哪款西装（发张照片或链接会很有帮助）？2. 需要什么尺码、几件？3. 什么时候要？

有了这些信息，我就能给您做一份准确的报价。

{{snippet:signature}}`,
    source_buyer: 'jasmina-gonsalez',
    vars: [
      { name: 'buyer_name', type: 'text', required: 0, label_zh: '买家名', sample: 'Jasmina' },
    ],
    locales: [
      { lang: 'ES', title: '追问：西装询盘（款式/尺码数量/交期）', body: `Hola {{buyer_name}},

Gracias por su consulta. ¿Podría indicarme: 1. ¿Qué modelo de traje le interesa (una foto o enlace nos ayudaría mucho)? 2. ¿Qué talla necesita y cuántas piezas? 3. ¿Para cuándo lo necesita?

Con estos datos le preparo una cotización precisa.

{{snippet:signature}}` },
    ],
  },
  {
    key: 'ask-size-no-style',
    scene: 'ask',
    category: '通用',
    note_zh: '买家只给了尺码没说款式时用：请确认款式（发图）+数量',
    gloss_zh: `{{buyer_name}}您好，

感谢您提供尺码（{{size}}）。能否请您告诉我：1. 您看中了哪款西装？（发张照片或链接会很有帮助）2. 想要几件？

确认后我马上给您报价。

{{snippet:signature}}`,
    source_buyer: 'furaha-mawamba',
    vars: [
      { name: 'buyer_name', type: 'text', required: 0, label_zh: '买家名', sample: 'Furaha' },
      { name: 'size', type: 'text', required: 0, label_zh: '尺码', sample: '54' },
    ],
    locales: [
      { lang: 'EN', title: '追问：给了尺码但没说款式', body: `Hi {{buyer_name}},

Thanks for sharing your sizes ({{size}}). Could you please let me know: 1. Which suit style are you interested in? (A photo or link would help a lot) 2. How many pieces would you like?

Once confirmed, I'll quote you right away.

{{snippet:signature}}` },
    ],
  },
  {
    key: 'quote-tuxedo-sample',
    scene: 'quote',
    category: '西装',
    note_zh: '定制西装/燕尾服询盘用：要量体数据、翻领偏好、国家邮编核算运费；样衣价、制作期均为占位，须填实价',
    gloss_zh: `{{buyer_name}}您好，

感谢您的询盘和参考图！这款{{product}}我们可以做。

为了给您报个准确的价格，能否请您提供：
1. 您的量体数据：身高、胸围、腰围、臀围、肩宽、袖长、裤长（或您平时穿的西装尺码）
2. 翻领偏好：枪驳领还是平驳领？
3. 您的国家和邮编，我好核算运费

参考一下，这款{{product}}的样衣价是{{price}}（待确认），制作期{{lead_time}}。我们专做男士西装定制，支持OEM/ODM服务。

期待您的回复。

{{snippet:signature}}
Guangzhou Yingzi Fashion Co., Ltd.`,
    source_buyer: 'cael-joyce',
    vars: [
      { name: 'buyer_name', type: 'text', required: 0, label_zh: '买家名', sample: 'Cael' },
      { name: 'product', type: 'text', required: 0, label_zh: '产品', sample: 'custom black tuxedo with embroidery appliqué' },
      { name: 'price', type: 'number', required: 1, label_zh: '价格', sample: '1200' },
      { name: 'lead_time', type: 'text', required: 1, label_zh: '交期', sample: '30 days' },
    ],
    locales: [
      { lang: 'EN', title: '报价：定制燕尾服样衣（量体+运费）', body: `Hi {{buyer_name}},

Thank you for your inquiry and the reference photo! We can make this {{product}}.

To prepare an accurate quotation, could you please provide:
1. Your measurements: height, chest, waist, hips, shoulder width, sleeve length, and trouser length (or your usual suit size)
2. Lapel preference: peak lapel or notch lapel?
3. Your country and postal code, so I can quote shipping

For reference, the sample price for this {{product}} is {{price}} (to be confirmed), with {{lead_time}} production time. We specialize in custom men's suits with OEM/ODM service.

Looking forward to hearing from you.

{{snippet:signature}}
Guangzhou Yingzi Fashion Co., Ltd.` },
    ],
  },
  {
    key: 'ask-which-jacket',
    scene: 'ask',
    category: '通用',
    note_zh: '询盘只说品类没指明款式时用：一句话请买家明确款式颜色尺码数量',
    gloss_zh: `您好，感谢您的留言！能否请您明确一下是哪款夹克（款式、颜色、尺码、数量）？这样我才能给您准确答复。

{{snippet:signature}}`,
    source_buyer: 'kubilay-ceribas',
    vars: [],
    locales: [
      { lang: 'FR', title: '追问：请明确是哪款（款式/颜色/尺码/数量）', body: `Bonjour, merci pour votre message ! Pourriez-vous me préciser de quelle veste il s'agit (modèle, couleur, taille, quantité) ? Ainsi je pourrai vous répondre avec précision.

{{snippet:signature}}` },
    ],
  },
  {
    key: 'first-hi-only',
    scene: 'first',
    category: '通用',
    note_zh: '询盘只有问好没实质内容时用：产品、尺码、数量三问',
    gloss_zh: `{{buyer_name}}您好，

感谢您的联系！能否请您告诉我您看中了哪款产品、您的尺码和需要的数量？我稍后就给您报价。

{{snippet:signature}}
Guangzhou Yingzi Fashion Co., Ltd.`,
    source_buyer: 'cinare-osmanli',
    vars: [
      { name: 'buyer_name', type: 'text', required: 0, label_zh: '买家名', sample: 'Kelly' },
    ],
    locales: [
      { lang: 'EN', title: '首回：只有问好的询盘（产品/尺码/数量）', body: `Hi {{buyer_name}},

Thank you for reaching out! Could you let me know which product you are interested in, your size and the quantity you need? I'll get back to you with a quotation shortly.

{{snippet:signature}}
Guangzhou Yingzi Fashion Co., Ltd.` },
    ],
  },
  {
    key: 'ask-mermaid-gown',
    scene: 'ask',
    category: '晚礼服',
    note_zh: '晚礼服询盘用：颜色、尺码、样衣还是试单；附工厂定制能力介绍',
    gloss_zh: `您好，

感谢您对我们的{{product}}感兴趣。

为了给您做一份准确的报价，能否请您确认：
1. 想要的颜色
2. 需要的尺码（美码/欧码/英码）
3. 这{{quantity}}件是做样衣还是试单？

我们是专业的晚礼服工厂，支持OEM/ODM定制（颜色、面料、尺码、私人唛头）。

期待您的回复。

{{snippet:signature}}
Guangzhou Yingzi Fashion Co., Ltd.`,
    source_buyer: 'alqhtany-alqhtany',
    vars: [
      { name: 'product', type: 'text', required: 0, label_zh: '产品', sample: 'mermaid evening gown' },
      { name: 'quantity', type: 'number', required: 0, label_zh: '数量', sample: '2' },
    ],
    locales: [
      { lang: 'AR', title: '追问：晚礼服询盘（颜色/尺码/样衣或试单）', body: `السلام عليكم ورحمة الله،

شكراً جزيلاً لاهتمامكم بفستان السهرة الساتان ذو الكتف الواحد بتصميم ذيل السمكة ({{product}}).

لتقديم عرض سعر دقيق لكم، هل يمكنكم تأكيد ما يلي:
1. اللون / الألوان المطلوبة
2. المقاسات المطلوبة (US / EU / UK)
3. هل {{quantity}} للعينة أم لطلب تجريبي؟

نحن مصنع متخصص في فساتين السهرة، وندعم التخصيص OEM/ODM (اللون، القماش، المقاسات، الملصقات الخاصة).

في انتظار ردكم الكريم.

{{snippet:signature}}` },
      { lang: 'EN', title: '追问：晚礼服询盘（颜色/尺码/样衣或试单）', body: `Hello,

Thank you for your interest in our {{product}}.

To prepare an accurate quotation, could you please confirm:
1. Preferred color(s)
2. Sizes needed (US / EU / UK)
3. Are the {{quantity}} pieces for samples or a trial order?

We are a specialized evening-dress manufacturer and support OEM/ODM customization (color, fabric, sizing, private labels).

Looking forward to your reply.

{{snippet:signature}}
Guangzhou Yingzi Fashion Co., Ltd.` },
    ],
  },
  {
    key: 'ask-metallic-mermaid',
    scene: 'ask',
    category: '晚礼服',
    note_zh: '晚礼服询盘用：颜色、尺码、样衣还是试单；样衣交期占位须填实',
    gloss_zh: `{{buyer_name}}您好，

感谢您咨询我们的{{product}}。

为了给您准确报价，能否请您确认：
1. 金属缎面想要什么颜色
2. 需要的尺码（美码/欧码/英码）
3. 这{{quantity}}件是做样衣还是试单？

我们是专业的晚礼服工厂，提供OEM/ODM定制（颜色、面料、尺码、私人唛头）。样衣交期一般{{lead_time}}（看工艺复杂程度）。

如需面料色卡照片或更多细节，随时告诉我。

{{snippet:signature}}
Guangzhou Yingzi Fashion Co., Ltd.`,
    source_buyer: 'alexandra-crawford',
    vars: [
      { name: 'buyer_name', type: 'text', required: 0, label_zh: '买家名', sample: 'Alexandra' },
      { name: 'product', type: 'text', required: 0, label_zh: '产品', sample: 'metallic satin mermaid dress' },
      { name: 'quantity', type: 'number', required: 0, label_zh: '数量', sample: '2' },
      { name: 'lead_time', type: 'text', required: 1, label_zh: '交期', sample: '20-25 days' },
    ],
    locales: [
      { lang: 'EN', title: '追问：金属缎面晚礼服询盘', body: `Hi {{buyer_name}},

Thanks for reaching out about our {{product}}.

To give you an accurate quote, could you please confirm:
1. Preferred color(s) of the metallic satin
2. Sizes needed (US / EU / UK)
3. Are the {{quantity}} pieces for samples or a trial order?

We're a specialized evening-dress manufacturer offering OEM/ODM customization (colors, fabrics, sizing, private labels). Sample lead time is typically {{lead_time}} depending on complexity.

Happy to send fabric swatch photos or more details on request.

{{snippet:signature}}
Guangzhou Yingzi Fashion Co., Ltd.` },
    ],
  },
  {
    key: 'ask-lace-gown-de',
    scene: 'ask',
    category: '晚礼服',
    note_zh: '德语晚礼裙询盘用：颜色、尺码、大概数量；附定制服务介绍',
    gloss_zh: `您好，

感谢您咨询我们的{{product}}。

我们很乐意给您报价。能否请您告诉我们：

1. 想要什么颜色？
2. 需要哪些尺码？
3. 大概想订几件？

我们提供量身定制（OEM/ODM）——颜色、尺码和细节都可以按您的要求调整。

{{snippet:signature}}
Guangzhou Yingzi Fashion Co., Ltd.`,
    source_buyer: 'suse-liebesuse',
    vars: [
      { name: 'product', type: 'text', required: 0, label_zh: '产品', sample: 'Abendkleid aus Spitze und Tüll' },
    ],
    locales: [
      { lang: 'DE', title: '追问：蕾丝网纱晚礼裙（颜色/尺码/数量）', body: `Guten Tag,

vielen Dank für Ihre Anfrage zu unserem {{product}}.

Gerne erstellen wir Ihnen ein Angebot. Könnten Sie uns bitte mitteilen:

1. Welche Farbe wünschen Sie?
2. Welche Größen benötigen Sie?
3. Wie viele Stück möchten Sie ungefähr bestellen?

Wir bieten Maßanfertigung (OEM/ODM) an – Farbe, Größe und Details können individuell angepasst werden.

{{snippet:signature}}
Guangzhou Yingzi Fashion Co., Ltd.` },
    ],
  },
  {
    key: 'first-halter-custom',
    scene: 'first',
    category: '晚礼服',
    note_zh: '买家问产品细节但无照片时用：把"可定制"变成卖点（如后背可敞开/拉链），顺手问数量和交期',
    gloss_zh: `您好，感谢您的留言！

这条裙子是量身定制的——后背可以做敞开式（挂脖系带，经典挂脖款）或隐形拉链闭合。您更喜欢哪种？

我正在整理这款的更多照片，今天就发给您。

为了给您报个准确的价格：您需要几件、什么时候要？

{{snippet:signature}}`,
    source_buyer: 'mercedes-silvasantos',
    vars: [],
    locales: [
      { lang: 'PT', title: '首回：挂脖钉珠裙（后背做法转定制卖点）', body: `Olá, obrigada pela sua mensagem!

Este vestido é feito sob medida — as costas podem ser abertas (com amarração no pescoço, no estilo halter clássico) ou fechadas com zíper invisível. Qual estilo você prefere?

Estou separando mais fotos do modelo e te envio ainda hoje.

Para eu te passar o orçamento certinho: quantas peças você precisa e para quando?

{{snippet:signature}}` },
    ],
  },
  {
    key: 'quote-dress-ar',
    scene: 'quote',
    category: '晚礼服',
    note_zh: '阿语客户问价时用：先报公开价格区间占位，让客户报数量和国家再给实价含运费',
    gloss_zh: `您好！我是Yingzi，从现在起由我本人亲自跟您对接。

{{product}}：价格是**{{price}}**美元/件，具体看数量。

您想要几件？发往哪个国家？我马上给您报含运费的准确价格。

{{snippet:signature}}`,
    source_buyer: 'ly-ly',
    vars: [
      { name: 'product', type: 'text', required: 0, label_zh: '产品', sample: 'فستان وردي' },
      { name: 'price', type: 'number', required: 1, label_zh: '价格', sample: '215' },
    ],
    locales: [
      { lang: 'AR', title: '报价：连衣裙价格区间（按数量定价）', body: `أهلاً بك! أنا Yingzi، سأتواصل معك بنفسي من الآن.

{{product}}: السعر **{{price}}** دولار أمريكي للقطعة، حسب الكمية.

كم قطعة تريدين؟ وإلى أي بلد سيكون الشحن؟ سأعطيك السعر الدقيق مع الشحن فوراً.

{{snippet:signature}}` },
    ],
  },
  {
    key: 'first-pic-inquiry',
    scene: 'first',
    category: '通用',
    note_zh: '买家发产品图询盘时的标准开场：叫出名字→给一条图上看不到的信息→只问两个问题（颜色、数量+交期）；{{product}}填产品名+一句卖点',
    gloss_zh: `{{buyer_name}}您好，感谢您对这条裙子感兴趣！

这款{{product}}是我们最受欢迎的款式之一。我们还可以做其他颜色，并按您的需要调整长度。

能否请您告诉我：1）想要什么颜色？2）需要几件、什么时候要？

我马上给您核算准确的报价。

{{snippet:signature}}`,
    source_buyer: 'rose-benjamin',
    vars: [
      { name: 'buyer_name', type: 'text', required: 0, label_zh: '买家名', sample: 'Rose' },
      { name: 'product', type: 'text', required: 0, label_zh: '产品', sample: 'satin mermaid gown' },
    ],
    locales: [
      { lang: 'EN', title: '首回：发产品图询盘的三段式开场白', body: `Hi {{buyer_name}}, thanks for your interest in this dress!

This {{product}} is one of our most requested styles. We can also make it in other colors and adjust the length to your needs.

Could you let me know: 1) Which color do you prefer? 2) How many pieces do you need, and when do you need them?

I'll work out an accurate quotation for you right away.

{{snippet:signature}}` },
    ],
  },
  {
    key: 'quote-tuxedo-fr',
    scene: 'quote',
    category: '西装',
    note_zh: '法语西装/燕尾服询盘用：要尺码数量、国家邮编；样衣价、交期均为占位，发出前填实',
    gloss_zh: `您好，

感谢您的留言！这款{{product}}我们可以做。

为了给您做一份准确的报价，能否请您明确：
1. 您的尺码（或量体数据）和想要的数量
2. 您的国家和邮编，我好核算运费

参考一下，这款的样衣价是{{price}}，制作期{{lead_time}}——价格和交期待确认。

{{snippet:signature}}`,
    source_buyer: 'jean-malanda',
    vars: [
      { name: 'product', type: 'text', required: 0, label_zh: '产品', sample: 'smoking noir à broderie dorée' },
      { name: 'price', type: 'number', required: 1, label_zh: '价格', sample: '1200' },
      { name: 'lead_time', type: 'text', required: 1, label_zh: '交期', sample: '30 jours' },
    ],
    locales: [
      { lang: 'FR', title: '报价：刺绣燕尾服样衣', body: `Bonjour,

Merci pour votre message ! Nous pouvons réaliser ce {{product}}.

Pour préparer un devis précis, pourriez-vous me préciser :
1. Votre taille (ou vos mesures) et la quantité souhaitée
2. Votre pays et code postal, pour chiffrer la livraison

À titre indicatif, pour ce modèle le prix de l'échantillon est de {{price}}, délai de production {{lead_time}} — prix et délai à confirmer.

{{snippet:signature}}` },
    ],
  },
];
