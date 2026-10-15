/* 回复模板库种子数据 v4（话术库 v2.1 全量）
 * 由 server/src/data/reply-library-v2.1.md 生成：
 * - #1–72：70 条真实询盘 → 单语言模板（无变量，正文即定稿回复）
 * - #73–94：22 条 → 映射回原 key，v2.1 优化文案 + 恢复 {{变量}} 位
 * 生成器：server/scripts/build-seed-v4.py（修改 md 后重跑）
 * 变量规则：price / lead_time 出现即 required:1（业务红线）
 */

export const SNIPPETS = [
  { key: "signature", lang: "EN", title_zh: "落款-英文", body: "Best regards,\nYingzi" },
  { key: "signature", lang: "ES", title_zh: "落款-西语", body: "Saludos cordiales,\nYingzi" },
  { key: "signature", lang: "PT", title_zh: "落款-葡语", body: "Atenciosamente,\nYingzi" },
  { key: "signature", lang: "FR", title_zh: "落款-法语", body: "Cordialement,\nYingzi" },
  { key: "signature", lang: "DE", title_zh: "落款-德语", body: "Mit freundlichen Grüßen,\nYingzi" },
  { key: "signature", lang: "AR", title_zh: "落款-阿语", body: "مع تحياتي،\nYingzi" },
  { key: "signature", lang: "ZH", title_zh: "落款-中文", body: "祝好，\nYingzi" },
];

export const TEMPLATES = [
  {
    key: "ASK-001",
    scene: "ask",
    category: "通用",
    note_zh: "颜色 / 面料类｜Which colors are available? And what is the fabric material?",
    gloss_zh: "您好！感谢咨询。我们可以做很多颜色——可以给您发色卡照片。面料方面，我们可以采购缎面、蕾丝、网纱、雪纺、丝绒、绉布和西装毛料。您喜欢哪种颜色和面料呢？",
    source_buyer: "v2.1-#1",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Which colors are available? And what is the fabric material?", body: "Hi! Thanks for asking. We can make it in many colors — I can send you our color swatch photos. For fabric, we can source satin, lace, tulle, chiffon, velvet, crepe and wool suiting. Which color and fabric do you prefer?" },
    ],
  },
  {
    key: "ASK-002",
    scene: "ask",
    category: "通用",
    note_zh: "颜色 / 面料类｜What are the colors?",
    gloss_zh: "您好！我们有色卡册，您可以从色卡里选色，也可以直接发我色号。要我给您发色卡照片吗？",
    source_buyer: "v2.1-#2",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "What are the colors?", body: "Hi! We have color swatch books — you can pick from our swatches or send your color code. Shall I send you the swatch photos?" },
    ],
  },
  {
    key: "ASK-003",
    scene: "ask",
    category: "通用",
    note_zh: "颜色 / 面料类｜The one in the ad is Navy Blue Plaid; what are the other col",
    gloss_zh: "您好！可以的，除了藏青格纹，我们还可以做其他颜色——藏青纯色、黑色、灰色等。我可以给您发色卡照片。您喜欢哪种颜色？",
    source_buyer: "v2.1-#3",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "The one in the ad is Navy Blue Plaid; what are the other colors?", body: "Hi! Yes, besides Navy Blue Plaid we can make it in other colors — solid navy, black, gray and more. I can send you swatch photos. Which color do you prefer?" },
    ],
  },
  {
    key: "ASK-004",
    scene: "ask",
    category: "通用",
    note_zh: "颜色 / 面料类｜Do you have any photos of the dark gray?",
    gloss_zh: "您好！有的——我马上在消息中心给您发深灰色的照片。",
    source_buyer: "v2.1-#4",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Do you have any photos of the dark gray?", body: "Hi! Yes — I'll send you the dark gray photos here in the message center right away." },
    ],
  },
  {
    key: "ASK-005",
    scene: "ask",
    category: "通用",
    note_zh: "颜色 / 面料类｜Can i customize the color for sage green?",
    gloss_zh: "您好！鼠尾草绿没问题——我们支持定制颜色。您想要几件？",
    source_buyer: "v2.1-#8",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Can i customize the color for sage green?", body: "Hi! Yes, sage green is no problem — we support custom colors. How many pieces would you like?" },
    ],
  },
  {
    key: "ASK-006",
    scene: "ask",
    category: "通用",
    note_zh: "颜色 / 面料类｜из какой ткани",
    gloss_zh: "您好！我们可以配缎面、蕾丝、网纱、雪纺、丝绒、绉布和羊毛西装面料。您喜欢哪种颜色和面料？",
    source_buyer: "v2.1-#17",
    vars: [
    ],
    locales: [
      { lang: "RU", title: "из какой ткани", body: "Здравствуйте! Мы можем подобрать сатин, кружево, тюль, шифон, бархат, креп и шерстяные костюмные ткани. Какой цвет и ткань вы предпочитаете?" },
    ],
  },
  {
    key: "ASK-007",
    scene: "ask",
    category: "通用",
    note_zh: "颜色 / 面料类｜can i have this one in a red wine color?",
    gloss_zh: "您好！酒红色可以做。您想要几件？",
    source_buyer: "v2.1-#28",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "can i have this one in a red wine color?", body: "Hi! Yes, red wine color is available. How many pieces would you like?" },
    ],
  },
  {
    key: "ASK-008",
    scene: "ask",
    category: "通用",
    note_zh: "颜色 / 面料类｜Hello. What materials do you have?",
    gloss_zh: "您好！我们可以采购缎面、蕾丝、网纱、雪纺、丝绒、绉布、羊毛混纺西装面料等。您喜欢哪种面料？",
    source_buyer: "v2.1-#32",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Hello. What materials do you have?", body: "Hi! We can source satin, lace, tulle, chiffon, velvet, crepe, wool-blend suiting and more. Which fabric do you prefer?" },
    ],
  },
  {
    key: "ASK-009",
    scene: "ask",
    category: "通用",
    note_zh: "颜色 / 面料类｜disponible. la matiere",
    gloss_zh: "您好！我们可以采购缎面、蕾丝、薄纱、雪纺、丝绒、绉布和羊毛西装面料。您喜欢哪种颜色和面料？",
    source_buyer: "v2.1-#39",
    vars: [
    ],
    locales: [
      { lang: "FR", title: "disponible. la matiere", body: "Bonjour ! Nous pouvons sourcer du satin, de la dentelle, du tulle, du chiffon, du velours, du crêpe et des tissus tailleur en laine. Quelle couleur et quel tissu préférez-vous ?" },
    ],
  },
  {
    key: "ASK-010",
    scene: "ask",
    category: "通用",
    note_zh: "颜色 / 面料类｜Combien de pour cent la laine?",
    gloss_zh: "您好！羊毛含量取决于所选面料——我们可以采购不同羊毛含量的面料。您想要多少含量的？",
    source_buyer: "v2.1-#53",
    vars: [
    ],
    locales: [
      { lang: "FR", title: "Combien de pour cent la laine?", body: "Bonjour ! Le pourcentage de laine dépend du tissu choisi — nous pouvons sourcer des tissus avec différents pourcentages de laine. Quel pourcentage recherchez-vous ?" },
    ],
  },
  {
    key: "ASK-011",
    scene: "ask",
    category: "通用",
    note_zh: "颜色 / 面料类｜Ya pas de vrai laine?",
    gloss_zh: "您好！有的，我们可以采购真正的羊毛面料（比如 Super 120s–150s）。请告诉我您想要的数量。",
    source_buyer: "v2.1-#54",
    vars: [
    ],
    locales: [
      { lang: "FR", title: "Ya pas de vrai laine?", body: "Bonjour ! Si, nous pouvons sourcer de vrais tissus en laine (par exemple Super 120s–150s). N'hésitez pas à me dire la quantité souhaitée.\n\n---" },
    ],
  },
  {
    key: "QUOTE-001",
    scene: "quote",
    category: "通用",
    note_zh: "问价类｜what is the discount ?",
    gloss_zh: "您好！我们的价格看数量——量大单价更优惠。您大概要几件？我帮您核算最优惠的价格。",
    source_buyer: "v2.1-#7",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "what is the discount ?", body: "Hi! Our pricing depends on quantity — larger quantities get a better unit price. How many pieces are you considering? I'll work out the best price for you." },
    ],
  },
  {
    key: "QUOTE-002",
    scene: "quote",
    category: "通用",
    note_zh: "问价类｜How much will it cost if i buy a sample?",
    gloss_zh: "您好！样品价格看款式复杂程度——我给您报这款的准确价格。下大货时样品费全额抵扣货款。",
    source_buyer: "v2.1-#13",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "How much will it cost if i buy a sample?", body: "Hi! The sample price depends on the design's complexity — I'll quote it exactly for this style. The sample fee is fully deducted from your bulk order when you proceed." },
    ],
  },
  {
    key: "QUOTE-003",
    scene: "quote",
    category: "通用",
    note_zh: "问价类｜السعر شكد",
    gloss_zh: "您好！价格看产品、数量和面料——请告诉我您要几件，我给您报准确价格。",
    source_buyer: "v2.1-#14",
    vars: [
    ],
    locales: [
      { lang: "AR", title: "السعر شكد", body: "أهلاً بك! السعر يعتمد على المنتج والكمية والقماش — أخبرني كم قطعة تريد، وسأجهز لك السعر الدقيق." },
    ],
  },
  {
    key: "QUOTE-004",
    scene: "quote",
    category: "通用",
    note_zh: "问价类｜How much would a wool/silk tuxedo cost? Super 150?",
    gloss_zh: "您好！可以的，我们能用 Super 150 面料做羊毛/真丝燕尾服。价格看您的数量、尺码和细节——能发我这些信息吗？我给您报准确价格。",
    source_buyer: "v2.1-#33",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "How much would a wool/silk tuxedo cost? Super 150?", body: "Hi! Yes, we can make a wool/silk tuxedo in Super 150 fabric. The price depends on your quantity, measurements and details — could you share those? I'll quote you exactly." },
    ],
  },
  {
    key: "QUOTE-005",
    scene: "quote",
    category: "通用",
    note_zh: "问价类｜1 set How much",
    gloss_zh: "您好！我马上给您报 1 套的价格——请发我您的尺码和国家/邮编，我把运费一起核算进去。",
    source_buyer: "v2.1-#34",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "1 set How much", body: "Hi! I'll quote 1 set for you right away — could you share your size and country/postal code so I include shipping?" },
    ],
  },
  {
    key: "QUOTE-006",
    scene: "quote",
    category: "通用",
    note_zh: "问价类｜I want to buy one suit. Please tell me the price, and if it ",
    gloss_zh: "您好！1 套西装可以按定制样单做。价格看面料、您的尺码和定制要求——能发我您的量体数据吗？我报准确价格，您再决定。",
    source_buyer: "v2.1-#37",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "I want to buy one suit. Please tell me the price, and if it suits me, I will place an order", body: "Hi! Yes, 1 suit is fine as a custom sample order. The price depends on the fabric, your size and any customization — could you share your measurements? I'll quote you exactly, and you can decide after." },
    ],
  },
  {
    key: "QUOTE-007",
    scene: "quote",
    category: "通用",
    note_zh: "问价类｜The price of the suit I want to buy is listed as $63.31 each",
    gloss_zh: "您好！理解您觉得价格偏高。我们的西装是按您量体定制的——价格包含单独制版、优质面料和手工制作，不是大货流水线。数量多单价确实能下来。我可以按您的数量再核一个最优惠的价格。",
    source_buyer: "v2.1-#38",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "The price of the suit I want to buy is listed as $63.31 each, on the condition of purchasing two pieces. The price of th", body: "Hi! I understand the price feels high. Our suits are custom-made to your measurements — the price reflects individual pattern-making, quality fabric and hand finishing, not mass production. Larger quantities do bring the unit price down. I can re-check the best price for your quantity." },
    ],
  },
  {
    key: "QUOTE-008",
    scene: "quote",
    category: "通用",
    note_zh: "问价类｜Ce costume coûte combien? une pièce",
    gloss_zh: "您好！一件可以，按定制样单做。价格看面料、您的尺码和工艺细节：能发我您的量体数据吗？我给您做准确报价。",
    source_buyer: "v2.1-#44",
    vars: [
    ],
    locales: [
      { lang: "FR", title: "Ce costume coûte combien? une pièce", body: "Bonjour ! Oui, une seule pièce est possible — en commande d'échantillon sur mesure. Le prix dépend du tissu, de votre taille et des finitions : pourriez-vous me préciser vos mesures ? Je vous ferai un devis exact." },
    ],
  },
  {
    key: "QUOTE-009",
    scene: "quote",
    category: "通用",
    note_zh: "问价类｜how much 1 pc only need for gala night, can you send mo pict",
    gloss_zh: "您好！gala 晚会要 1 件没问题。我们是定制工作室，每件按订单制作——我可以先发您类似成品的实拍图，发货前也会拍照给您验货。请发我您的尺码和国家/邮编，我报价格和运费。",
    source_buyer: "v2.1-#46",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "how much 1 pc only need for gala night, can you send mo picture model for actual item?", body: "Hi! Yes, 1 piece for your gala night is fine. As a custom studio, we make each piece to order — I'll send you real photos of similar completed work, and before we ship your piece, photos for your checking. And your size and country/postal code, so I can quote the price and shipping." },
    ],
  },
  {
    key: "QUOTE-010",
    scene: "quote",
    category: "通用",
    note_zh: "问价类｜شلون سعره",
    gloss_zh: "您好！请告诉我您要的数量，我给您报准确价格。",
    source_buyer: "v2.1-#50",
    vars: [
    ],
    locales: [
      { lang: "AR", title: "شلون سعره", body: "أهلاً بك! أخبرني عن الكمية المطلوبة وسأعطيك السعر الدقيق." },
    ],
  },
  {
    key: "QUOTE-011",
    scene: "quote",
    category: "通用",
    note_zh: "问价类｜Oui ça me reviendrait à combien du 100 pour 100",
    gloss_zh: "您好！100% 羊毛可以做——这是高档面料。请告诉我数量、面料细节和制作要求，我给您做准确报价。",
    source_buyer: "v2.1-#55",
    vars: [
    ],
    locales: [
      { lang: "FR", title: "Oui ça me reviendrait à combien du 100 pour 100", body: "Bonjour ! Le 100 % laine est possible — c'est un tissu premium. Merci de me préciser la quantité, les détails du tissu et vos exigences de confection — je vous ferai un devis exact." },
    ],
  },
  {
    key: "QUOTE-012",
    scene: "quote",
    category: "通用",
    note_zh: "问价类｜And can you do 1piece to buy first and check? If yes, how mu",
    gloss_zh: "您好！可以先订 1 件验看质量。请确认您在澳大利亚的邮编，我报单件+运费的价格。",
    source_buyer: "v2.1-#57",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "And can you do 1piece to buy first and check? If yes, how much including shipping to Australia", body: "Hi! Yes, you can order 1 piece first to check the quality. Could you confirm your postal code in Australia? I'll quote the piece plus shipping." },
    ],
  },
  {
    key: "QUOTE-013",
    scene: "quote",
    category: "通用",
    note_zh: "问价类｜si je veux deux pièces de chacune tout ferais combien ?",
    gloss_zh: "您好！没问题——请把相关的款式发我（照片或截图），我给您算总价。",
    source_buyer: "v2.1-#63",
    vars: [
    ],
    locales: [
      { lang: "FR", title: "si je veux deux pièces de chacune tout ferais combien ?", body: "Bonjour ! Avec plaisir — envoyez-moi les modèles concernés (photos ou captures d'écran) et je vous chiffrerai le total." },
    ],
  },
  {
    key: "QUOTE-014",
    scene: "quote",
    category: "通用",
    note_zh: "问价类｜how much is this in Kenyan shillings and are you able to del",
    gloss_zh: "您好！我们按美元报价，您可以按实时汇率换算成肯尼亚先令。可以的，我们能发肯尼亚，走 DHL/FedEx。请确认数量和您在内罗毕的邮编，我报产品+运费的价格。",
    source_buyer: "v2.1-#70",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "how much is this in Kenyan shillings and are you able to deliver directly to kenya?", body: "Hi! We quote in USD — you can convert to Kenyan shillings at the current rate. And yes, we can deliver to Kenya via DHL/FedEx. Could you confirm the quantity and your postal code in Nairobi? I'll quote product plus shipping.\n\n---" },
    ],
  },
  {
    key: "ASK-012",
    scene: "ask",
    category: "通用",
    note_zh: "MOQ / 1件类｜what is the minimum quantity for mass purchase ?",
    gloss_zh: "您好！起订量看款式：现有款 1 件起；按您的设计做——先做样品，大货单款 10 件起；婚礼/团单 5 件起。",
    source_buyer: "v2.1-#9",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "what is the minimum quantity for mass purchase ?", body: "Hi! Our MOQ depends on the style: existing styles from 1 piece; your own design — sample first, then bulk from 10 pieces per style; wedding/group orders from 5 pieces." },
    ],
  },
  {
    key: "ASK-013",
    scene: "ask",
    category: "通用",
    note_zh: "MOQ / 1件类｜Can i order 1 pc only?",
    gloss_zh: "您好！可以只订 1 件——我们按定制样单给您做。",
    source_buyer: "v2.1-#10",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Can i order 1 pc only?", body: "Hi! Yes, you can order just 1 piece — we make it as a custom sample order." },
    ],
  },
  {
    key: "ASK-014",
    scene: "ask",
    category: "通用",
    note_zh: "MOQ / 1件类｜What do you mean by one sample?",
    gloss_zh: "您好！样品就是先做 1 件，让您在大货前确认版型、面料和质量。下大货时样品费全额抵扣。我们先从 1 件样品开始？",
    source_buyer: "v2.1-#11",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "What do you mean by one sample?", body: "Hi! A sample means we make 1 piece first so you can check the fit, fabric and quality before a bigger order. The sample fee is fully deducted from your bulk order when you proceed. Shall we start with a sample?" },
    ],
  },
  {
    key: "ASK-015",
    scene: "ask",
    category: "通用",
    note_zh: "MOQ / 1件类｜I can purchase sample item so i can buy 1 pc only?",
    gloss_zh: "您好！没错——您可以买 1 件按样单下单。",
    source_buyer: "v2.1-#12",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "I can purchase sample item so i can buy 1 pc only?", body: "Hi! Yes, exactly — you can purchase 1 piece as a sample order." },
    ],
  },
  {
    key: "ASK-016",
    scene: "ask",
    category: "通用",
    note_zh: "MOQ / 1件类｜Can i order for 1pcs?",
    gloss_zh: "您好！1 件可以，按定制样单做。",
    source_buyer: "v2.1-#19",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Can i order for 1pcs?", body: "Hi! Yes, 1 piece is fine — as a custom sample order." },
    ],
  },
  {
    key: "ASK-017",
    scene: "ask",
    category: "通用",
    note_zh: "MOQ / 1件类｜Color: Black; Size: Xs; Quantity: 1.0;",
    gloss_zh: "您好！谢谢——黑色、XS、1 件没问题。因为是单件定制，能再发我您的量体数据吗（或确认 XS 合身），还有您的国家和邮编，我核算运费。我给您准备准确报价。",
    source_buyer: "v2.1-#21=47",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Color: Black; Size: Xs; Quantity: 1.0;", body: "Hi! Thanks — black, XS, 1 piece is fine. Since it's a single custom piece, could you also share your measurements (or confirm XS works for you), plus your country and postal code so I can quote shipping? I'll prepare your exact quotation." },
    ],
  },
  {
    key: "ASK-018",
    scene: "ask",
    category: "通用",
    note_zh: "MOQ / 1件类｜Free Samples??",
    gloss_zh: "您好！我们没有免费样品——样品费和运费由买家承担。好消息是：下大货时样品费全额抵扣货款。",
    source_buyer: "v2.1-#30",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Free Samples??", body: "Hi! We don't offer free samples — the sample fee and freight are paid by the buyer. The good news: the sample fee is fully deducted from your bulk order when you proceed." },
    ],
  },
  {
    key: "ASK-019",
    scene: "ask",
    category: "通用",
    note_zh: "MOQ / 1件类｜On peut avoir une pièce",
    gloss_zh: "您好！可以订一件，按定制样单做。",
    source_buyer: "v2.1-#45",
    vars: [
    ],
    locales: [
      { lang: "FR", title: "On peut avoir une pièce", body: "Bonjour ! Oui, vous pouvez commander une seule pièce — en commande d'échantillon sur mesure." },
    ],
  },
  {
    key: "ASK-020",
    scene: "ask",
    category: "通用",
    note_zh: "MOQ / 1件类｜Peut-on envoyer des échantillons en port dû ?",
    gloss_zh: "您好！样品运费由买家预付——样品不接受到付。",
    source_buyer: "v2.1-#62",
    vars: [
    ],
    locales: [
      { lang: "FR", title: "Peut-on envoyer des échantillons en port dû ?", body: "Bonjour ! Non, le fret des échantillons est prépayé par l'acheteur — nous n'acceptons pas l'envoi en port dû pour les échantillons." },
    ],
  },
  {
    key: "ASK-021",
    scene: "ask",
    category: "通用",
    note_zh: "MOQ / 1件类｜i want this. from Bangladesh, 1 pcs",
    gloss_zh: "您好！谢谢——发孟加拉 1 件没问题。请确认您的邮编，我报单件+到孟加拉运费的价格。",
    source_buyer: "v2.1-#66",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "i want this. from Bangladesh, 1 pcs", body: "Hi! Thanks — 1 piece to Bangladesh is fine. Could you confirm your postal code? I'll quote the piece plus shipping to Bangladesh." },
    ],
  },
  {
    key: "ASK-022",
    scene: "ask",
    category: "通用",
    note_zh: "MOQ / 1件类｜no vende solo una pieza?",
    gloss_zh: "您好！是的，我们 1 件起卖。您需要几件？",
    source_buyer: "v2.1-#69",
    vars: [
    ],
    locales: [
      { lang: "ES", title: "no vende solo una pieza?", body: "¡Hola! Sí, vendemos desde 1 pieza. ¿Cuántas piezas necesitas?" },
    ],
  },
  {
    key: "ASK-023",
    scene: "ask",
    category: "通用",
    note_zh: "MOQ / 1件类｜okay. how about 2 pieces? my address is Nairobi CBD",
    gloss_zh: "您好！2 件没问题。请确认您在内罗毕的邮编，我核算含运费的总价。",
    source_buyer: "v2.1-#71",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "okay. how about 2 pieces? my address is Nairobi CBD", body: "Hi! 2 pieces is fine. Could you confirm your postal code in Nairobi? I'll work out the total including shipping.\n\n---" },
    ],
  },
  {
    key: "ASK-024",
    scene: "ask",
    category: "通用",
    note_zh: "定制类｜hello, do u a cept customizable",
    gloss_zh: "您好！是的，我们支持定制。您想定制哪方面——颜色、尺码、面料，还是 logo/唛头？",
    source_buyer: "v2.1-#24",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "hello, do u a cept customizable", body: "Hi! Yes, we support customization. What would you like to customize — color, size, fabric, or logo/labels?" },
    ],
  },
  {
    key: "ASK-025",
    scene: "ask",
    category: "通用",
    note_zh: "定制类｜my own styles, can u customizable?",
    gloss_zh: "您好！可以——请发我您的款式图或工艺单，我们评估后给您报价。是哪类款式呢？",
    source_buyer: "v2.1-#25",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "my own styles, can u customizable?", body: "Hi! Yes — please share your design pictures or tech pack, and we'll check and quote for you. What kind of styles are they?" },
    ],
  },
  {
    key: "ASK-026",
    scene: "ask",
    category: "通用",
    note_zh: "定制类｜Custom black tuxedo with white lace appliqué for prom",
    gloss_zh: "您好！感谢详细的需求和参考图——是的，我们可以做这款定制黑色燕尾服，白色蕾丝/花卉刺绣贴花从裤侧一直延伸到上衣。为了给您准备报价，能否发我：1）您的量体数据（或常穿的西装尺码）；2）翻领偏好——戗驳领还是平驳领；3）数量和交期？我也可以发您类似成品的照片。",
    source_buyer: "v2.1-#41",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Custom black tuxedo with white lace appliqué for prom", body: "Hi! Thank you for the detailed brief and the reference photo — yes, we can make this custom black tuxedo with white lace/floral embroidery appliqué down the pant sides and on the jacket. To prepare your quotation, could you share: 1) your measurements (or usual suit size), 2) lapel preference — peaked or notch, 3) quantity and when you need it? I can also send photos of similar completed work." },
    ],
  },
  {
    key: "ASK-027",
    scene: "ask",
    category: "通用",
    note_zh: "定制类｜Lo quisiera igual pero las tiras en los hombros y color verd",
    gloss_zh: "您好！可以——按肩带款、鼠尾草绿色做。请确认一下数量。",
    source_buyer: "v2.1-#58",
    vars: [
    ],
    locales: [
      { lang: "ES", title: "Lo quisiera igual pero las tiras en los hombros y color verde salvia ??? Se puede", body: "¡Hola! Sí, se puede — con tiras en los hombros y en color verde salvia. Confírmame la cantidad, por favor." },
    ],
  },
  {
    key: "ASK-028",
    scene: "ask",
    category: "通用",
    note_zh: "定制类｜Pouvez-vous imprimer un logo sur du tissu ?",
    gloss_zh: "您好！是的，我们可以在面料上印 logo（也可以刺绣）。您想要多少数量？",
    source_buyer: "v2.1-#61",
    vars: [
    ],
    locales: [
      { lang: "FR", title: "Pouvez-vous imprimer un logo sur du tissu ?", body: "Bonjour ! Oui, nous pouvons imprimer un logo sur le tissu (et aussi le broder). En quelle quantité souhaitez-vous cela ?" },
    ],
  },
  {
    key: "ASK-029",
    scene: "ask",
    category: "通用",
    note_zh: "定制类｜Launching minimalist brand, NO MOQ 1 piece, ship to agent wa",
    gloss_zh: "您好！感谢联系。是的——我们接 1 件的订单，也可以发到您在国内的采购代理仓库。每件按您的要求（面料、款式、数量）单独计价。建议先从样品开始确认质量——能发我您的首批设计稿吗？",
    source_buyer: "v2.1-#67",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Launching minimalist brand, NO MOQ 1 piece, ship to agent warehouse in China", body: "Hi! Thank you for reaching out. Yes — we accept 1-piece orders, and we can ship to your sourcing agent's warehouse in China. Each piece is custom-made and priced per your specs (fabric, design, quantity). I'd suggest starting with samples to confirm quality — could you share your first designs?" },
    ],
  },
  {
    key: "ASK-030",
    scene: "ask",
    category: "通用",
    note_zh: "定制类｜Hello, can you customize it here?",
    gloss_zh: "您好！是的，我们支持定制。您想定制哪方面——颜色、尺码、面料、logo/唛头？多跟我说说。",
    source_buyer: "v2.1-#72",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Hello, can you customize it here?", body: "Hi! Yes, we support customization. What would you like to customize — color, size, fabric, logo/labels? Tell me more.\n\n---" },
    ],
  },
  {
    key: "ASK-031",
    scene: "ask",
    category: "通用",
    note_zh: "运输 / 交期类｜и сколько стоит доставка в Израиль",
    gloss_zh: "您好！到以色列的运费按重量和地址核算。请告诉我您的邮编，我帮您算运费。",
    source_buyer: "v2.1-#15",
    vars: [
    ],
    locales: [
      { lang: "RU", title: "и сколько стоит доставка в Израиль", body: "Здравствуйте! Стоимость доставки в Израиль рассчитывается по весу и адресу. Подскажите ваш почтовый индекс? Я рассчитаю доставку." },
    ],
  },
  {
    key: "ASK-032",
    scene: "ask",
    category: "通用",
    note_zh: "运输 / 交期类｜сколько времени займёт",
    gloss_zh: "您好！样品：10–20 个工作日（刺绣钉珠款 20–30 天）；大货：样品确认后 15–25 个工作日。",
    source_buyer: "v2.1-#18",
    vars: [
    ],
    locales: [
      { lang: "RU", title: "сколько времени займёт", body: "Здравствуйте! Образец: 10–20 рабочих дней (20–30 для вышивки и бисера); производство: 15–25 рабочих дней после утверждения образца." },
    ],
  },
  {
    key: "ASK-033",
    scene: "ask",
    category: "通用",
    note_zh: "运输 / 交期类｜Cuánto es el costo de envío a San Pedro Garza García, Nuevo ",
    gloss_zh: "您好！运费按重量和目的地核算。您要几件？我马上给您报到 San Pedro Garza García 66274 的运费。",
    source_buyer: "v2.1-#27",
    vars: [
    ],
    locales: [
      { lang: "ES", title: "Cuánto es el costo de envío a San Pedro Garza García, Nuevo León México 66274", body: "¡Hola! El envío se calcula por peso y destino. ¿Cuántas piezas? Te lo cotizo a San Pedro Garza García 66274 enseguida." },
    ],
  },
  {
    key: "ASK-034",
    scene: "ask",
    category: "通用",
    note_zh: "运输 / 交期类｜livre en france. dou vien le produit",
    gloss_zh: "您好！是的，我们送法国——走 DHL、FedEx 或 UPS。我们的服装是在中国广州的定制工作室按订单制作的。能告诉我您的邮编吗？我帮您算运费。",
    source_buyer: "v2.1-#40",
    vars: [
    ],
    locales: [
      { lang: "FR", title: "livre en france. dou vien le produit", body: "Bonjour ! Oui, nous livrons en France — par DHL, FedEx ou UPS. Nos vêtements sont confectionnés sur commande dans notre studio de couture à Guangzhou, en Chine. Pourriez-vous m'indiquer votre code postal ? Je chiffrerai la livraison." },
    ],
  },
  {
    key: "ASK-035",
    scene: "ask",
    category: "通用",
    note_zh: "运输 / 交期类｜Como hago para el pago y cuánto demorarian en hecerlo???",
    gloss_zh: "您好！我们接受阿里信保、银行转账（T/T）和西联汇款——在阿里上通过信保全额支付。交期：样品 10–20 个工作日（刺绣款 20–30 天），大货 15–25 个工作日。",
    source_buyer: "v2.1-#59",
    vars: [
    ],
    locales: [
      { lang: "ES", title: "Como hago para el pago y cuánto demorarian en hecerlo???", body: "¡Hola! Aceptamos Alibaba Trade Assurance, transferencia bancaria (T/T) y Western Union — en Alibaba el pago es total mediante Trade Assurance. Tiempos: muestra 10–20 días hábiles (20–30 para bordado), producción 15–25 días hábiles." },
    ],
  },
  {
    key: "ASK-036",
    scene: "ask",
    category: "通用",
    note_zh: "运输 / 交期类｜Está bien y en cuánto tiempo pueden tenerlo listo?",
    gloss_zh: "您好！样品 10–20 个工作日（刺绣款 20–30 天）；样品确认后大货 15–25 个工作日。您什么时候要？",
    source_buyer: "v2.1-#60",
    vars: [
    ],
    locales: [
      { lang: "ES", title: "Está bien y en cuánto tiempo pueden tenerlo listo?", body: "¡Hola! Muestra: 10–20 días hábiles (bordado 20–30); producción: 15–25 días hábiles tras aprobar la muestra. ¿Para cuándo lo necesitas?\n\n---" },
    ],
  },
  {
    key: "ASK-037",
    scene: "ask",
    category: "通用",
    note_zh: "付款类｜How can we finalize the purchase?",
    gloss_zh: "您好！很简单：1）和我确认尺码、数量和定制要求；2）我在阿里上建单；3）您通过信保安全付款；4）我们开始生产。",
    source_buyer: "v2.1-#5",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "How can we finalize the purchase?", body: "Hi! It's simple: 1) confirm the size, quantity and customization with me; 2) I'll create the order on Alibaba; 3) you pay securely through Trade Assurance; 4) we start production." },
    ],
  },
  {
    key: "ASK-038",
    scene: "ask",
    category: "通用",
    note_zh: "付款类｜comment je peux payer",
    gloss_zh: "您好！我们接受阿里信保、银行转账（T/T）和西联汇款。在阿里上订单通过信保全额结算，保障买卖双方。",
    source_buyer: "v2.1-#29",
    vars: [
    ],
    locales: [
      { lang: "FR", title: "comment je peux payer", body: "Bonjour ! Nous acceptons Alibaba Trade Assurance, le virement bancaire (T/T) et Western Union. Sur Alibaba, la commande est réglée en totalité via Trade Assurance, ce qui protège les deux parties.\n\n---" },
    ],
  },
  {
    key: "ASK-039",
    scene: "ask",
    category: "通用",
    note_zh: "信任 / 照片 / 目录类｜Measurement guide photo request",
    gloss_zh: "您好！问得好——准确的量体很重要。请看下面的量体指南——标明了皮尺具体放哪里：",
    source_buyer: "v2.1-#6",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Measurement guide photo request", body: "Hi! Good question — accurate measurements are important. Please see the measurement guide below — it shows exactly where to place the tape:" },
    ],
  },
  {
    key: "ASK-040",
    scene: "ask",
    category: "通用",
    note_zh: "信任 / 照片 / 目录类｜можно настоящее фото?",
    gloss_zh: "您好！我们是定制工作室：每件都按订单制作，不是现货。我发您类似成品的实拍图，发货前也会拍照拍视频给您验货。",
    source_buyer: "v2.1-#16",
    vars: [
    ],
    locales: [
      { lang: "RU", title: "можно настоящее фото?", body: "Здравствуйте! Мы — студия индивидуального пошива: каждое изделие шьём на заказ, а не берём со склада. Я отправлю вам настоящие фото похожих выполненных работ, а перед отправкой вашего заказа — фото и видео на проверку." },
    ],
  },
  {
    key: "ASK-041",
    scene: "ask",
    category: "通用",
    note_zh: "信任 / 照片 / 目录类｜como é as costas desse vestido?",
    gloss_zh: "您好！这条裙子的后背可以定制——可以做露背款（挂脖系带式），也可以做隐形拉链闭合款。您喜欢哪种？",
    source_buyer: "v2.1-#23",
    vars: [
    ],
    locales: [
      { lang: "PT", title: "como é as costas desse vestido?", body: "Olá! As costas desse vestido são personalizáveis — podem ser abertas (estilo halter com amarração no pescoço) ou fechadas com zíper invisível. Qual estilo você prefere?" },
    ],
  },
  {
    key: "ASK-042",
    scene: "ask",
    category: "通用",
    note_zh: "信任 / 照片 / 目录类｜Damn, what's your instagram account?",
    gloss_zh: "您好！我们主要在阿里消息中心沟通——产品照片和细节我都可以发您。您想了解这款的哪方面？",
    source_buyer: "v2.1-#31",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Damn, what's your instagram account?", body: "Hi! We mainly communicate through the Alibaba message center — I can share all product photos and details with you here. What would you like to know about this style?" },
    ],
  },
  {
    key: "ASK-043",
    scene: "ask",
    category: "通用",
    note_zh: "信任 / 照片 / 目录类｜can you send me photos of similar completed suits so I can s",
    gloss_zh: "您好！当然——我发您类似成品西装的照片，您可以看蕾丝工艺的质量。我在消息中心发您。",
    source_buyer: "v2.1-#42",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "can you send me photos of similar completed suits so I can see the quality of the lace work?", body: "Hi! Of course — I'll send you photos of similar completed suits so you can see the lace work quality. I'll send them here in the message center." },
    ],
  },
  {
    key: "ASK-044",
    scene: "ask",
    category: "通用",
    note_zh: "信任 / 照片 / 目录类｜how would u describe the quality of the suits",
    gloss_zh: "您好！问得好。我们的创始人是 15 年经验的制版师，亲自把关每一件的版型和终检。我们按真实量体裁剪，细节手工完成。我也发您成品照片，您自己看。",
    source_buyer: "v2.1-#43",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "how would u describe the quality of the suits", body: "Hi! Good question. Our founder is a pattern-maker with 15 years of experience who personally oversees the pattern and final quality check of every piece. We cut to real measurements and finish details by hand. I'll also send you photos of our finished work so you can judge for yourself." },
    ],
  },
  {
    key: "ASK-045",
    scene: "ask",
    category: "通用",
    note_zh: "信任 / 照片 / 目录类｜Si vous avez un catalogue ca serait top",
    gloss_zh: "您好！可以的，我给您发产品目录，含款式、面料和起订量。我就在这里发您。",
    source_buyer: "v2.1-#49",
    vars: [
    ],
    locales: [
      { lang: "FR", title: "Si vous avez un catalogue ca serait top", body: "Bonjour ! Oui, je peux vous envoyer notre catalogue avec les modèles, tissus et quantités minimales. Je vous l'envoie ici même." },
    ],
  },
  {
    key: "ASK-046",
    scene: "ask",
    category: "通用",
    note_zh: "信任 / 照片 / 目录类｜share website or WeChat QR code for woman dresses",
    gloss_zh: "您好！我们在阿里消息中心沟通——目录和产品照片都可以发您。您在找哪类女装裙子？",
    source_buyer: "v2.1-#52",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "share website or WeChat QR code for woman dresses", body: "Hi! We work through the Alibaba message center — I can send you our catalog and all product photos here. Which style of women's dresses are you looking for?" },
    ],
  },
  {
    key: "ASK-047",
    scene: "ask",
    category: "通用",
    note_zh: "信任 / 照片 / 目录类｜so that's mean you don't have it in stock?",
    gloss_zh: "您好！没错——我们按订单制作，所以这款没有现货。您确认订单后开始生产。好消息是：1 件就可以起做。要我给您准备报价吗？",
    source_buyer: "v2.1-#56",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "so that's mean you don't have it in stock?", body: "Hi! Correct — we make to order, so this style has no ready stock. Production starts after you confirm the order. The good news: you can start with just 1 piece. Shall I prepare your quotation?" },
    ],
  },
  {
    key: "ASK-048",
    scene: "ask",
    category: "通用",
    note_zh: "信任 / 照片 / 目录类｜Do you have a catalogue / videos / pictures of the real prod",
    gloss_zh: "您好！可以——我发您产品目录，还有我们定制成品的实拍照片和视频。我们定制工作室的优势就是定制本身：每件按您的量体和要求制作，不是现货。告诉我您看中哪款，我们按您的要求做。我马上发您资料。",
    source_buyer: "v2.1-#68",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Do you have a catalogue / videos / pictures of the real product", body: "Hi! Yes — I'll send you our catalog, plus real photos and videos of our completed custom work. Our strength as a custom studio is the customization itself: every piece is made to your measurements and requirements, not taken off a shelf. Tell me which style catches your eye, and we'll make it yours. I'll send the materials here right away.\n\n---" },
    ],
  },
  {
    key: "FIRST-001",
    scene: "first",
    category: "通用",
    note_zh: "综合 / 首回类｜Hi, I'm interested in your supply for this.",
    gloss_zh: "您好！感谢关注——您需要几件，有定制想法吗？我给您准备明细和报价。",
    source_buyer: "v2.1-#20",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Hi, I'm interested in your supply for this.", body: "Hi! Thanks for your interest — how many pieces do you need, and any customization in mind? I'll prepare the details and quotation for you." },
    ],
  },
  {
    key: "FIRST-002",
    scene: "first",
    category: "通用",
    note_zh: "综合 / 首回类｜Bonjour, je suis intéressé par votre offre pour ce produit.",
    gloss_zh: "您好！感谢关注——您想要多少数量？我给您准备明细和报价。",
    source_buyer: "v2.1-#22",
    vars: [
    ],
    locales: [
      { lang: "FR", title: "Bonjour, je suis intéressé par votre offre pour ce produit.", body: "Bonjour ! Merci pour votre intérêt — quelle quantité souhaitez-vous ? Je vous préparerai les détails et le devis." },
    ],
  },
  {
    key: "FIRST-003",
    scene: "first",
    category: "通用",
    note_zh: "综合 / 首回类｜Hola, estoy explorando opciones... Color: Verde esmeralda; T",
    gloss_zh: "您好！谢谢——祖母绿、XL、1 件，没问题。因为是单件定制，能确认一下您的量体数据，还有您的国家+邮编吗？这样我给您报含运费的准确价格。",
    source_buyer: "v2.1-#26",
    vars: [
    ],
    locales: [
      { lang: "ES", title: "Hola, estoy explorando opciones... Color: Verde esmeralda; Talla: XL; Cantidad: 1.0.", body: "¡Hola! Gracias — verde esmeralda, talla XL, 1 pieza, perfecto. Como es una pieza personalizada, ¿podrías confirmarme tus medidas y tu país + código postal? Así te preparo el precio exacto con el envío." },
    ],
  },
  {
    key: "FIRST-004",
    scene: "first",
    category: "通用",
    note_zh: "综合 / 首回类｜I want to buy the suit you see in the picture",
    gloss_zh: "您好！是的，图上的西装我们可以做。为了准确报价，能否告诉我：1）您喜欢的颜色；2）您的尺码或量体数据；3）数量？期待合作！",
    source_buyer: "v2.1-#35=36",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "I want to buy the suit you see in the picture", body: "Hi! Yes, we can make the suit in the picture. To quote you accurately, could you tell me: 1) your color preference, 2) your size or measurements, 3) quantity? Looking forward to it!" },
    ],
  },
  {
    key: "FIRST-005",
    scene: "first",
    category: "通用",
    note_zh: "综合 / 首回类｜Je peux juste commander une seule? C'est pour un mariage. Si",
    gloss_zh: "您好！一件可以订——顺便祝新婚快乐！是的，我们也做男士西装。伴郎团一共几位？我可以给您报团单价。",
    source_buyer: "v2.1-#48",
    vars: [
    ],
    locales: [
      { lang: "FR", title: "Je peux juste commander une seule? C'est pour un mariage. Si tu as des costumes pour homme aussi je vais en prendre un.", body: "Bonjour ! Oui, vous pouvez commander une seule pièce — et félicitations pour le mariage ! Oui, nous faisons aussi des costumes pour homme. Pour combien de personnes en avez-vous besoin ? Je peux vous proposer un tarif de groupe." },
    ],
  },
  {
    key: "FIRST-006",
    scene: "first",
    category: "通用",
    note_zh: "综合 / 首回类｜Bonjour, je recherche un nouveau fournisseur.",
    gloss_zh: "您好，欢迎！您在找哪类产品、要多少数量？我们 1 件起做全定制。",
    source_buyer: "v2.1-#51",
    vars: [
    ],
    locales: [
      { lang: "FR", title: "Bonjour, je recherche un nouveau fournisseur.", body: "Bonjour et bienvenue ! Que recherchez-vous comme produits et en quelles quantités ? Nous faisons du sur-mesure à partir d'une seule pièce." },
    ],
  },
  {
    key: "FIRST-007",
    scene: "first",
    category: "通用",
    note_zh: "综合 / 首回类｜Hi are the mens suit and women dresses available as pre-made",
    gloss_zh: "您好！我们的西装和裙子都是按订单定制的——按您量体裁剪，不是现货。1 件就可以起做。",
    source_buyer: "v2.1-#64",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Hi are the mens suit and women dresses available as pre-made or custom made?", body: "Hi! Our suits and dresses are custom-made to order — cut to your measurements, not pre-made. You can start from just 1 piece." },
    ],
  },
  {
    key: "FIRST-008",
    scene: "first",
    category: "通用",
    note_zh: "综合 / 首回类｜How to order custom suit for men and women dress?",
    gloss_zh: "您好！下单很简单：1）发我您的尺码、数量和定制要求；2）我报准确价格；3）我们做样品并发照片给您确认；4）确认后大货生产，发货前拍照拍视频。我们开始吗？",
    source_buyer: "v2.1-#65",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "How to order custom suit for men and women dress?", body: "Hi! Ordering is simple: 1) send your size, quantity and customization; 2) I quote you exactly; 3) we make a sample and send photos for your confirmation; 4) after approval, bulk production with photos/videos before shipment. Shall we start?\n\n---" },
    ],
  },
  {
    key: "NUDGE-001",
    scene: "nudge",
    category: "通用",
    note_zh: "买家3天以上没回时用：点名+给一条图上看不到的定制信息+只问两个问题",
    gloss_zh: "您好，跟进一下——您看到我之前发的关于{{product}}的消息了吗？\n\n照片上看不出的一个细节：这款我们可以做其他颜色，还能按您的尺码调整。\n\n您看要不要我：1）给您发面料照片？2）给{{quantity}}件做个报价？",
    source_buyer: "v2.1-#73",
    vars: [
      { name: "product", type: "text", required: 0, label_zh: "产品", sample: '' },
      { name: "quantity", type: "number", required: 0, label_zh: "数量", sample: '' },
    ],
    locales: [
      { lang: "EN", title: "(Follow-up) Buyer hasn't replied for 3 days", body: "Hi! Just following up — did you see my message about the {{product}}?\n\nOne detail the photos don't show: we can make it in other colors and adjust it to your measurements. Would you like fabric photos, or a quotation for {{quantity}} pieces?" },
    ],
  },
  {
    key: "FIRST-009",
    scene: "first",
    category: "通用",
    note_zh: "买家发来自有设计图求报价时用：先问清身份、数量、预算、交期再谈能不能做",
    gloss_zh: "您好！设计稿很漂亮——是的，我们支持按您自己的款式全定制。\n\n为了准确报价：1）是您自己的品牌/精品店用吗？2）每个款要几件？3）单件目标预算多少？4）什么时候要货？",
    source_buyer: "v2.1-#74",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Hi! I'm a designer and I have my own dress designs (3 styles). Can you make them? Please quote me.", body: "Hi! Beautiful designs — yes, we do full custom of your own styles.\n\nFor an accurate quote: 1) your own brand or boutique? 2) quantity per style? 3) target budget per piece? 4) when do you need them?" },
    ],
  },
  {
    key: "ASK-049",
    scene: "ask",
    category: "通用",
    note_zh: "买家确认要做样品后用：款式、样品预算、交期、尺码一次问齐",
    gloss_zh: "您好！太好了——关于{{product}}的样品，能否确认：1）单件目标预算？2）交期？3）量体数据或尺码规格？\n\n样品交期{{lead_time}}；下大货时样品费可抵扣货款。",
    source_buyer: "v2.1-#75",
    vars: [
      { name: "product", type: "text", required: 0, label_zh: "产品", sample: '' },
      { name: "lead_time", type: "text", required: 1, label_zh: "交期", sample: '' },
    ],
    locales: [
      { lang: "EN", title: "Great, let's proceed with samples for 2 of the designs.", body: "Hi! Wonderful — for the {{product}} samples, could you confirm: 1) target budget per piece? 2) delivery date? 3) measurements or size specs?\n\nSample lead time is {{lead_time}}; the sample fee is deducted from your bulk order." },
    ],
  },
  {
    key: "QUOTE-015",
    scene: "quote",
    category: "通用",
    note_zh: "多款样品一起报价时用：逐行填实价再发出",
    gloss_zh: "您好！样品报价：{{product}} ${{price}}/件，{{lead_time}}/件（手工钉珠耗时更长）。\n\n我的建议：先做 1 个款把版型做准，再做其他款——下大货时样品费全额抵扣。能发我量体数据和目标交期吗？",
    source_buyer: "v2.1-#76",
    vars: [
      { name: "product", type: "text", required: 0, label_zh: "产品", sample: '' },
      { name: "price", type: "number", required: 1, label_zh: "价格", sample: '' },
      { name: "lead_time", type: "text", required: 1, label_zh: "交期", sample: '' },
    ],
    locales: [
      { lang: "EN", title: "Please quote samples for all three designs.", body: "Hi! Sample quotation: {{product}} ${{price}}/piece, {{lead_time}} per piece (hand beadwork takes longer).\n\nMy suggestion: start with 1 style to perfect the fit, then the others — the sample fee is fully deducted from your bulk order. Could you share measurements and your target delivery date?" },
    ],
  },
  {
    key: "ASK-050",
    scene: "ask",
    category: "通用",
    note_zh: "客户下单后要求换面料/改方案时用：先说没问题再说代价，请客户确认后执行",
    gloss_zh: "早上好！没问题——您的{{product}}可以换成藏青纯色面料。\n\n说明一下：原来的面料我已经下单了，重新订面料可能会多几天。请确认换面料，并发我您的电话+发往{{country}}的详细收货地址。",
    source_buyer: "v2.1-#77",
    vars: [
      { name: "product", type: "text", required: 0, label_zh: "产品", sample: '' },
      { name: "country", type: "text", required: 0, label_zh: "国家", sample: '' },
    ],
    locales: [
      { lang: "EN", title: "Hi, can I change the fabric of my suit to solid navy instead?", body: "Good morning! No problem — we can switch your {{product}} to solid navy.\n\nNote: I already ordered the original fabric, so re-ordering may add a few days. Please confirm the change, and send me your phone number + detailed shipping address for {{country}}." },
    ],
  },
  {
    key: "ASK-051",
    scene: "ask",
    category: "通用",
    note_zh: "发货前最终确认用：收齐电话+详细地址，谈妥进口税由谁付",
    gloss_zh: "好的，谢谢！已确认——{{product}}，我马上安排。\n\n请发我您的电话和完整地址（街道、门牌、城市、州、邮编）。还有一件事：{{country}}进口税到付——您那边负责，对吗？",
    source_buyer: "v2.1-#78",
    vars: [
      { name: "product", type: "text", required: 0, label_zh: "产品", sample: '' },
      { name: "country", type: "text", required: 0, label_zh: "国家", sample: '' },
    ],
    locales: [
      { lang: "EN", title: "OK, confirmed. Please proceed.", body: "Perfect, thank you! Confirmed — {{product}}, I'll arrange it right away.\n\nPlease send your phone number and full address (street, number, city, state, postal code). One more thing: {{country}} import tax is collected on delivery — you'll take care of it on your side, correct?" },
    ],
  },
  {
    key: "ASK-052",
    scene: "ask",
    category: "通用",
    note_zh: "发往有清关税号要求的国家时用：索要税号+电话+地址，并提前告知进口税到付",
    gloss_zh: "您好！您的{{product}}正在生产中。发往{{country}}走快递，清关需要您的税号——请发我：1）税号；2）电话；3）完整收货地址。\n\n说明：{{country}}进口税由快递到付代收。",
    source_buyer: "v2.1-#79",
    vars: [
      { name: "product", type: "text", required: 0, label_zh: "产品", sample: '' },
      { name: "country", type: "text", required: 0, label_zh: "国家", sample: '' },
    ],
    locales: [
      { lang: "EN", title: "When will my order ship?", body: "Hi! Your {{product}} is in production. For express shipping to {{country}}, customs needs your tax ID — please send: 1) tax ID, 2) phone number, 3) full delivery address.\n\nNote: {{country}} import tax is collected by the courier on delivery." },
    ],
  },
  {
    key: "QUOTE-016",
    scene: "quote",
    category: "西装",
    note_zh: "高端面料西装/燕尾服询盘用：先报起报价格占位，问清数量/颜色/尺码/交期",
    gloss_zh: "您好！是的，我们可以用 Super 150 面料做羊毛/真丝燕尾服，配缎面戗驳领/青果领。${{price}}/件起。\n\n请确认：数量、颜色、您的量体数据、交期。发往{{country}}的 DHL 运费和进口关税另计。",
    source_buyer: "v2.1-#80",
    vars: [
      { name: "price", type: "number", required: 1, label_zh: "价格", sample: '' },
      { name: "country", type: "text", required: 0, label_zh: "国家", sample: '' },
    ],
    locales: [
      { lang: "EN", title: "How much would a wool/silk tuxedo cost? Super 150?", body: "Hi! Yes, we can make a Super 150 wool/silk tuxedo with satin peak/shawl lapels. It starts from ${{price}}/piece.\n\nCould you confirm: quantity, color, your measurements, and when you need it? DHL shipping to {{country}} and import duty quoted separately." },
    ],
  },
  {
    key: "FIRST-010",
    scene: "first",
    category: "通用",
    note_zh: "询盘没说要哪款时用：请买家发款名/截图/链接，并介绍定制服务",
    gloss_zh: "您好！我们是定制服装工作室——晚礼服、男士西装 1 件起定制。\n\n能发我您喜欢的款式照片或链接吗？我马上给您准确价格和明细。",
    source_buyer: "v2.1-#81",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "Hello, I'm looking for a new supplier.", body: "Hi! We're a custom clothing studio — custom evening dresses and men's suits from just 1 piece.\n\nCould you share a photo or link of the style you like? I'll send accurate pricing and details right away." },
    ],
  },
  {
    key: "ASK-053",
    scene: "ask",
    category: "西装",
    note_zh: "男士西装询盘用：颜色、尺码/量体数据、1件是样衣还是批量开头",
    gloss_zh: "您好！感谢关注男士意式修身三件套西装。\n\n请确认颜色、您的尺码（或量体数据），以及这 1 件是打样还是大货的开头？",
    source_buyer: "v2.1-#82",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "I want the men's Italian slim-fit 3-piece suit, 1 piece.", body: "Hi! Thanks for your interest in the men's Italian slim-fit 3-piece suit.\n\nCould you confirm the color, your size (or measurements), and whether this 1 piece is a sample or the start of a larger order?" },
    ],
  },
  {
    key: "ASK-054",
    scene: "ask",
    category: "西装",
    note_zh: "西语西装询盘用：款式（请发图）、尺码数量、交期",
    gloss_zh: "您好！感谢咨询。请告诉我尺码、要几件、什么时候要？有了这些我给您做准确报价。",
    source_buyer: "v2.1-#83",
    vars: [
    ],
    locales: [
      { lang: "ES", title: "Hola, me interesa un traje azul con dorado.", body: "¡Hola! Gracias por su consulta. ¿Podría indicarme la talla, cuántas piezas necesita y para cuándo? Con estos datos le preparo la cotización." },
    ],
  },
  {
    key: "ASK-055",
    scene: "ask",
    category: "西装",
    note_zh: "买家只给了尺码没说款式时用：请确认款式（发图）+数量",
    gloss_zh: "您好！感谢分享尺码（{{size}}）。确认一下——这是您看中的那套西装的尺码吗？要几件？",
    source_buyer: "v2.1-#84",
    vars: [
      { name: "size", type: "text", required: 0, label_zh: "尺码", sample: '' },
    ],
    locales: [
      { lang: "EN", title: "My sizes: trousers 38, jacket 54.", body: "Hi! Thanks for sharing your sizes ({{size}}). Just to confirm — is this for the suit you were viewing, and how many pieces?" },
    ],
  },
  {
    key: "QUOTE-017",
    scene: "quote",
    category: "西装",
    note_zh: "定制西装/燕尾服询盘用：要量体数据、翻领偏好、国家邮编核算运费",
    gloss_zh: "您好！感谢参考图——是的，这款定制黑色燕尾服配白色蕾丝贴花我们可以做。\n\n准确报价需要：1）您的量体数据；2）翻领偏好（戗驳领还是平驳领）；3）您的国家和邮编（核算运费）。参考：样衣 ${{price}}，制作期{{lead_time}}。",
    source_buyer: "v2.1-#85",
    vars: [
      { name: "price", type: "number", required: 1, label_zh: "价格", sample: '' },
      { name: "lead_time", type: "text", required: 1, label_zh: "交期", sample: '' },
    ],
    locales: [
      { lang: "EN", title: "I want a custom black slim tuxedo with white lace appliqué, here's a reference photo.", body: "Hi! Thanks for the reference photo — yes, we can make this custom black tuxedo with white lace appliqué.\n\nFor an accurate quote I need: 1) your measurements, 2) lapel preference (peak or notch)? 3) your country and postal code for shipping. Reference: sample ${{price}}, {{lead_time}} production." },
    ],
  },
  {
    key: "ASK-056",
    scene: "ask",
    category: "通用",
    note_zh: "询盘只说品类没指明款式时用：请买家明确款式颜色尺码数量",
    gloss_zh: "您好，感谢留言！能发我您喜欢的那件夹克/上衣的照片或链接吗，加上颜色、尺码和数量？",
    source_buyer: "v2.1-#86",
    vars: [
    ],
    locales: [
      { lang: "FR", title: "la veste", body: "Bonjour, merci pour votre message ! Pourriez-vous m'envoyer une photo ou un lien de la veste qui vous plaît, avec la couleur, la taille et la quantité ?" },
    ],
  },
  {
    key: "FIRST-011",
    scene: "first",
    category: "通用",
    note_zh: "询盘只有问好没实质内容时用：产品、尺码、数量三问",
    gloss_zh: "您好！我们是定制服装工作室——晚礼服、男士西装 1 件起定制。能发我您喜欢的款式照片或链接，加上您的尺码和数量吗？",
    source_buyer: "v2.1-#87",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "hello", body: "Hi! We're a custom clothing studio — evening dresses and men's suits from just 1 piece. Could you share a photo or link of the style you like, plus your size and quantity?" },
    ],
  },
  {
    key: "ASK-057",
    scene: "ask",
    category: "晚礼服",
    note_zh: "晚礼服询盘用：颜色、尺码、样衣还是试单",
    gloss_zh: "您好！感谢关注缎面单肩鱼尾晚礼服。\n\n准确报价需要：1）想要的颜色；2）尺码（美码/欧码/英码）；3）这 2 件是打样还是试单？我们是定制服装工作室——每件按您的要求制作。",
    source_buyer: "v2.1-#88",
    vars: [
    ],
    locales: [
      { lang: "AR", title: "مهتم بفستان السهرة الساتان بكتف واحد وذيل السمكة، أريد قطعتين", body: "السلام عليكم، شكراً لاهتمامكم بفستان السهرة الساتان بكتف واحد وذيل السمكة.\n\nلعرض سعر دقيق: 1. اللون المطلوب 2. المقاسات (US / EU / UK) 3. هل القطعتان عينة أم طلب تجريبي؟ نحن استوديو ملابس مخصص — كل قطعة تُصنع حسب مقاساتكم." },
    ],
  },
  {
    key: "ASK-058",
    scene: "ask",
    category: "晚礼服",
    note_zh: "晚礼服询盘用：颜色、尺码、样衣还是试单；样衣交期占位须填实",
    gloss_zh: "您好！感谢咨询我们的金属缎面鱼尾裙。\n\n请确认：1）想要的颜色；2）尺码（美码/欧码/英码）；3）这 2 件是打样还是试单？我们是定制工作室——每件按您的要求制作。样品交期一般{{lead_time}}。",
    source_buyer: "v2.1-#89",
    vars: [
      { name: "lead_time", type: "text", required: 1, label_zh: "交期", sample: '' },
    ],
    locales: [
      { lang: "EN", title: "I'm interested in the metallic satin mermaid strapless sweetheart dress, I want 2 pieces.", body: "Hi! Thanks for reaching out about our metallic satin mermaid dress.\n\nCould you confirm: 1) preferred color(s), 2) sizes (US/EU/UK), 3) are the 2 pieces samples or a trial order? We're a custom studio — every piece made to your requirements. Sample lead time typically {{lead_time}}." },
    ],
  },
  {
    key: "ASK-059",
    scene: "ask",
    category: "晚礼服",
    note_zh: "德语晚礼裙询盘用：颜色、尺码、大概数量",
    gloss_zh: "您好！感谢咨询我们的蕾丝网纱晚礼服。\n\n报价需要：1）想要什么颜色？2）要哪些尺码？3）大概几件？我们提供量体定制。",
    source_buyer: "v2.1-#90",
    vars: [
    ],
    locales: [
      { lang: "DE", title: "Guten Tag, ich interessiere mich für das Spitzen-Tüll-Abendkleid.", body: "Guten Tag, vielen Dank für Ihre Anfrage zu unserem Spitzen-Tüll-Abendkleid.\n\nFür ein Angebot: 1. Welche Farbe? 2. Welche Größen? 3. Wie viele Stück ungefähr? Wir bieten Maßanfertigung an." },
    ],
  },
  {
    key: "FIRST-012",
    scene: "first",
    category: "晚礼服",
    note_zh: "买家问产品细节但无照片时用",
    gloss_zh: "您好，感谢留言！这条裙子是量体定制的——后背可以做露背款（挂脖系带），也可以做隐形拉链。您喜欢哪种？\n\n报价需要：几件、什么时候要？",
    source_buyer: "v2.1-#91",
    vars: [
    ],
    locales: [
      { lang: "PT", title: "Olá, como é as costas desse vestido?", body: "Olá, obrigada pela mensagem! Este vestido é feito sob medida — as costas podem ser abertas (amarração no pescoço) ou fechadas com zíper invisível. Qual você prefere?\n\nPara o orçamento: quantas peças e para quando?" },
    ],
  },
  {
    key: "QUOTE-018",
    scene: "quote",
    category: "晚礼服",
    note_zh: "阿语客户问价时用：先报公开价格区间占位，让客户报数量和国家再给实价含运费",
    gloss_zh: "您好！{{product}}：{{price}}美元/件，看数量。\n\n您要几件？发往哪个国家？我给您报含运费的准确价格。",
    source_buyer: "v2.1-#92",
    vars: [
      { name: "product", type: "text", required: 0, label_zh: "产品", sample: '' },
      { name: "price", type: "number", required: 1, label_zh: "价格", sample: '' },
    ],
    locales: [
      { lang: "AR", title: "الفستان الوردي عجبني، بكم؟", body: "أهلاً بك! {{product}}: {{price}} دولار للقطعة حسب الكمية. كم قطعة تريدين وإلى أي بلد الشحن؟ سأعطيك السعر الدقيق مع الشحن." },
    ],
  },
  {
    key: "FIRST-013",
    scene: "first",
    category: "通用",
    note_zh: "买家发产品图询盘时的标准开场",
    gloss_zh: "您好！感谢关注这条裙子——这款缎面鱼尾裙是我们最受欢迎的款式之一，也有其他颜色。\n\n您喜欢哪种颜色？要几件？什么时候要？",
    source_buyer: "v2.1-#93",
    vars: [
    ],
    locales: [
      { lang: "EN", title: "[sends product photo] Hi, I'm interested in this dress.", body: "Hi! Thanks for your interest in this dress — this satin mermaid gown is one of our most requested styles, also available in other colors.\n\nWhich color do you prefer, how many pieces, and when do you need them?" },
    ],
  },
  {
    key: "QUOTE-019",
    scene: "quote",
    category: "西装",
    note_zh: "法语西装/燕尾服询盘用：要尺码数量、国家邮编；样衣价、交期均为占位",
    gloss_zh: "您好，感谢留言！这款黑色金绣燕尾服我们可以做。\n\n准确报价需要：1）您的尺码（或量体数据）和数量；2）您的国家和邮编。参考：样衣 {{price}} 美元，交期{{lead_time}}——待确认。",
    source_buyer: "v2.1-#94",
    vars: [
      { name: "price", type: "number", required: 1, label_zh: "价格", sample: '' },
      { name: "lead_time", type: "text", required: 1, label_zh: "交期", sample: '' },
    ],
    locales: [
      { lang: "FR", title: "Bonjour, je suis intéressé par le smoking noir à broderie dorée. Quel est le prix pour un échantillon ?", body: "Bonjour, merci pour votre message ! Nous pouvons réaliser ce smoking noir à broderie dorée.\n\nPour un devis précis : 1. Votre taille (ou mesures) et la quantité 2. Votre pays et code postal. À titre indicatif : échantillon {{price}} $, {{lead_time}} — à confirmer." },
    ],
  },
];
