#!/usr/bin/env python3
"""话术库 v2.1（reply-library-v2.1.md）→ seedTemplatesV4.js

- #1–72：真实询盘，逐条转为单语言模板（无变量，正文即定稿回复；gloss_zh 为中文翻译）
- #73–94：由 22 模板转换，映射回原 key，v2.1 优化文案 + 恢复 {{变量}} 位
- 用法：python3 server/scripts/build-seed-v4.js
"""
import re
import json

MD = '/home/hatch/workspace/garment-mgmt/server/src/data/reply-library-v2.1.md'
OUT = '/home/hatch/workspace/garment-mgmt/server/src/seedTemplatesV4.js'

# ---------- 1. 解析 md ----------
def parse_md():
    src = open(MD, encoding='utf-8').read()
    secs = re.split(r'\n## ', src)
    items = []
    for s in secs[1:]:
        title = s.split('\n', 1)[0].strip()
        for m in re.finditer(
            r'^\*\*(\d+(?:=\d+)?)\.\s*(.*?)\s*\[([A-Z]{2})\][^*]*\*\*\n(.*?)(?=^\*\*\d|\Z)',
            s, flags=re.M | re.S,
        ):
            num, buyer, lang, reply = m.groups()
            buyer = re.sub(r'\s*[（(][^）)]*[）)]\s*$', '', buyer).strip()
            items.append({'num': num, 'buyer': buyer, 'lang': lang,
                          'reply': reply.strip(), 'section': title})
    return items

# ---------- 2. #1–72 的 scene 映射 ----------
SCENE_MAP = {
    '颜色 / 面料类': 'ask',
    '问价类（统一：不编价格，转单独报价）': 'quote',
    'MOQ / 1件类': 'ask',
    '定制类': 'ask',
    '运输 / 交期类': 'ask',
    '付款类': 'ask',
    '信任 / 照片 / 目录类': 'ask',
    '综合 / 首回类': 'first',
}

# ---------- 3. #73–94：原 key + 变量恢复替换 ----------
# 每条：原模板 key，[(v2.1 原文片段 → 恢复变量后)]，变量定义
V73_94 = {
    '73': {'key': 'nudge-3step', 'reps': [
        ('did you see my message about the evening gown?',
         'did you see my message about the {{product}}?'),
        ('a quotation for 10 pieces?', 'a quotation for {{quantity}} pieces?'),
    ], 'vars': [('product', 'text', 0, '产品'), ('quantity', 'number', 0, '数量')]},
    '74': {'key': 'first-design-4q', 'reps': [], 'vars': []},
    '75': {'key': 'ask-sample-4q', 'reps': [
        ('for the beaded gown samples', 'for the {{product}} samples'),
        ('Sample lead time is 25–30 business days', 'Sample lead time is {{lead_time}}'),
    ], 'vars': [('product', 'text', 0, '产品'), ('lead_time', 'text', 1, '交期')]},
    '76': {'key': 'quote-multi-sample', 'reps': [
        ('pearl beaded gown $950/piece', '{{product}} ${{price}}/piece'),
        ('25–30 business days per piece', '{{lead_time}} per piece'),
    ], 'vars': [('product', 'text', 0, '产品'), ('price', 'number', 1, '价格'),
                ('lead_time', 'text', 1, '交期')]},
    '77': {'key': 'ask-change-fabric', 'reps': [
        ('we can switch your suit to solid navy', 'we can switch your {{product}} to solid navy'),
        ('detailed shipping address for Brazil.', 'detailed shipping address for {{country}}.'),
    ], 'vars': [('product', 'text', 0, '产品'), ('country', 'text', 0, '国家')]},
    '78': {'key': 'ask-preship-confirm', 'reps': [
        ('Confirmed — navy suit,', 'Confirmed — {{product}},'),
        ('Brazil import tax is collected on delivery',
         '{{country}} import tax is collected on delivery'),
    ], 'vars': [('product', 'text', 0, '产品'), ('country', 'text', 0, '国家')]},
    '79': {'key': 'ask-taxid-address', 'reps': [
        ('Your suit is in production.', 'Your {{product}} is in production.'),
        ('For express shipping to Brazil,', 'For express shipping to {{country}},'),
        ('Note: Brazil import tax is collected', 'Note: {{country}} import tax is collected'),
    ], 'vars': [('product', 'text', 0, '产品'), ('country', 'text', 0, '国家')]},
    '80': {'key': 'quote-tuxedo-fabric', 'reps': [
        ('It starts from $1100/piece.', 'It starts from ${{price}}/piece.'),
        ('DHL shipping to the US and import duty', 'DHL shipping to {{country}} and import duty'),
    ], 'vars': [('price', 'number', 1, '价格'), ('country', 'text', 0, '国家')]},
    '81': {'key': 'first-which-product', 'reps': [], 'vars': []},
    '82': {'key': 'ask-suit-3piece', 'reps': [], 'vars': []},
    '83': {'key': 'ask-suit-es', 'reps': [], 'vars': []},
    '84': {'key': 'ask-size-no-style', 'reps': [
        ('(trousers 38 / jacket 54)', '({{size}})'),
    ], 'vars': [('size', 'text', 0, '尺码')]},
    '85': {'key': 'quote-tuxedo-sample', 'reps': [
        ('Reference: sample $1200, 30 business days production.',
         'Reference: sample ${{price}}, {{lead_time}} production.'),
    ], 'vars': [('price', 'number', 1, '价格'), ('lead_time', 'text', 1, '交期')]},
    '86': {'key': 'ask-which-jacket', 'reps': [], 'vars': []},
    '87': {'key': 'first-hi-only', 'reps': [], 'vars': []},
    '88': {'key': 'ask-mermaid-gown', 'reps': [], 'vars': []},
    '89': {'key': 'ask-metallic-mermaid', 'reps': [
        ('Sample lead time typically 20–25 business days.',
         'Sample lead time typically {{lead_time}}.'),
    ], 'vars': [('lead_time', 'text', 1, '交期')]},
    '90': {'key': 'ask-lace-gown-de', 'reps': [], 'vars': []},
    '91': {'key': 'first-halter-custom', 'reps': [], 'vars': []},
    '92': {'key': 'quote-dress-ar', 'reps': [
        ('الفستان الوردي: 215 دولار', '{{product}}: {{price}} دولار'),
    ], 'vars': [('product', 'text', 0, '产品'), ('price', 'number', 1, '价格')]},
    '93': {'key': 'first-pic-inquiry', 'reps': [], 'vars': []},
    '94': {'key': 'quote-tuxedo-fr', 'reps': [
        ('échantillon 1200 $, 30 jours ouvrés',
         'échantillon {{price}} $, {{lead_time}}'),
    ], 'vars': [('price', 'number', 1, '价格'), ('lead_time', 'text', 1, '交期')]},
}

# 原 22 模板的 scene / category / note_zh（v2.1 优化不改变用途）
ORIG_META = {
    'nudge-3step': ('nudge', '通用', '买家3天以上没回时用：点名+给一条图上看不到的定制信息+只问两个问题'),
    'first-design-4q': ('first', '通用', '买家发来自有设计图求报价时用：先问清身份、数量、预算、交期再谈能不能做'),
    'ask-sample-4q': ('ask', '通用', '买家确认要做样品后用：款式、样品预算、交期、尺码一次问齐'),
    'quote-multi-sample': ('quote', '通用', '多款样品一起报价时用：逐行填实价再发出'),
    'ask-change-fabric': ('ask', '通用', '客户下单后要求换面料/改方案时用：先说没问题再说代价，请客户确认后执行'),
    'ask-preship-confirm': ('ask', '通用', '发货前最终确认用：收齐电话+详细地址，谈妥进口税由谁付'),
    'ask-taxid-address': ('ask', '通用', '发往有清关税号要求的国家时用：索要税号+电话+地址，并提前告知进口税到付'),
    'quote-tuxedo-fabric': ('quote', '西装', '高端面料西装/燕尾服询盘用：先报起报价格占位，问清数量/颜色/尺码/交期'),
    'first-which-product': ('first', '通用', '询盘没说要哪款时用：请买家发款名/截图/链接，并介绍定制服务'),
    'ask-suit-3piece': ('ask', '西装', '男士西装询盘用：颜色、尺码/量体数据、1件是样衣还是批量开头'),
    'ask-suit-es': ('ask', '西装', '西语西装询盘用：款式（请发图）、尺码数量、交期'),
    'ask-size-no-style': ('ask', '西装', '买家只给了尺码没说款式时用：请确认款式（发图）+数量'),
    'quote-tuxedo-sample': ('quote', '西装', '定制西装/燕尾服询盘用：要量体数据、翻领偏好、国家邮编核算运费'),
    'ask-which-jacket': ('ask', '通用', '询盘只说品类没指明款式时用：请买家明确款式颜色尺码数量'),
    'first-hi-only': ('first', '通用', '询盘只有问好没实质内容时用：产品、尺码、数量三问'),
    'ask-mermaid-gown': ('ask', '晚礼服', '晚礼服询盘用：颜色、尺码、样衣还是试单'),
    'ask-metallic-mermaid': ('ask', '晚礼服', '晚礼服询盘用：颜色、尺码、样衣还是试单；样衣交期占位须填实'),
    'ask-lace-gown-de': ('ask', '晚礼服', '德语晚礼裙询盘用：颜色、尺码、大概数量'),
    'first-halter-custom': ('first', '晚礼服', '买家问产品细节但无照片时用'),
    'quote-dress-ar': ('quote', '晚礼服', '阿语客户问价时用：先报公开价格区间占位，让客户报数量和国家再给实价含运费'),
    'first-pic-inquiry': ('first', '通用', '买家发产品图询盘时的标准开场'),
    'quote-tuxedo-fr': ('quote', '西装', '法语西装/燕尾服询盘用：要尺码数量、国家邮编；样衣价、交期均为占位'),
}

# ---------- 4. 中文对照 gloss_zh（v2.1 定稿回复的忠实翻译；变量位与正文一致） ----------
GLOSS = {
'1': '您好！感谢咨询。我们可以做很多颜色——可以给您发色卡照片。面料方面，我们可以采购缎面、蕾丝、网纱、雪纺、丝绒、绉布和西装毛料。您喜欢哪种颜色和面料呢？',
'2': '您好！我们有色卡册，您可以从色卡里选色，也可以直接发我色号。要我给您发色卡照片吗？',
'3': '您好！可以的，除了藏青格纹，我们还可以做其他颜色——藏青纯色、黑色、灰色等。我可以给您发色卡照片。您喜欢哪种颜色？',
'4': '您好！有的——我马上在消息中心给您发深灰色的照片。',
'8': '您好！鼠尾草绿没问题——我们支持定制颜色。您想要几件？',
'17': '您好！我们可以配缎面、蕾丝、网纱、雪纺、丝绒、绉布和羊毛西装面料。您喜欢哪种颜色和面料？',
'28': '您好！酒红色可以做。您想要几件？',
'32': '您好！我们可以采购缎面、蕾丝、网纱、雪纺、丝绒、绉布、羊毛混纺西装面料等。您喜欢哪种面料？',
'39': '您好！我们可以采购缎面、蕾丝、薄纱、雪纺、丝绒、绉布和羊毛西装面料。您喜欢哪种颜色和面料？',
'53': '您好！羊毛含量取决于所选面料——我们可以采购不同羊毛含量的面料。您想要多少含量的？',
'54': '您好！有的，我们可以采购真正的羊毛面料（比如 Super 120s–150s）。请告诉我您想要的数量。',
'7': '您好！我们的价格看数量——量大单价更优惠。您大概要几件？我帮您核算最优惠的价格。',
'13': '您好！样品价格看款式复杂程度——我给您报这款的准确价格。下大货时样品费全额抵扣货款。',
'14': '您好！价格看产品、数量和面料——请告诉我您要几件，我给您报准确价格。',
'33': '您好！可以的，我们能用 Super 150 面料做羊毛/真丝燕尾服。价格看您的数量、尺码和细节——能发我这些信息吗？我给您报准确价格。',
'34': '您好！我马上给您报 1 套的价格——请发我您的尺码和国家/邮编，我把运费一起核算进去。',
'37': '您好！1 套西装可以按定制样单做。价格看面料、您的尺码和定制要求——能发我您的量体数据吗？我报准确价格，您再决定。',
'38': '您好！理解您觉得价格偏高。我们的西装是按您量体定制的——价格包含单独制版、优质面料和手工制作，不是大货流水线。数量多单价确实能下来。我可以按您的数量再核一个最优惠的价格。',
'44': '您好！一件可以，按定制样单做。价格看面料、您的尺码和工艺细节：能发我您的量体数据吗？我给您做准确报价。',
'46': '您好！gala 晚会要 1 件没问题。我们是定制工作室，每件按订单制作——我可以先发您类似成品的实拍图，发货前也会拍照给您验货。请发我您的尺码和国家/邮编，我报价格和运费。',
'50': '您好！请告诉我您要的数量，我给您报准确价格。',
'55': '您好！100% 羊毛可以做——这是高档面料。请告诉我数量、面料细节和制作要求，我给您做准确报价。',
'57': '您好！可以先订 1 件验看质量。请确认您在澳大利亚的邮编，我报单件+运费的价格。',
'63': '您好！没问题——请把相关的款式发我（照片或截图），我给您算总价。',
'70': '您好！我们按美元报价，您可以按实时汇率换算成肯尼亚先令。可以的，我们能发肯尼亚，走 DHL/FedEx。请确认数量和您在内罗毕的邮编，我报产品+运费的价格。',
'9': '您好！起订量看款式：现有款 1 件起；按您的设计做——先做样品，大货单款 10 件起；婚礼/团单 5 件起。',
'10': '您好！可以只订 1 件——我们按定制样单给您做。',
'11': '您好！样品就是先做 1 件，让您在大货前确认版型、面料和质量。下大货时样品费全额抵扣。我们先从 1 件样品开始？',
'12': '您好！没错——您可以买 1 件按样单下单。',
'19': '您好！1 件可以，按定制样单做。',
'21=47': '您好！谢谢——黑色、XS、1 件没问题。因为是单件定制，能再发我您的量体数据吗（或确认 XS 合身），还有您的国家和邮编，我核算运费。我给您准备准确报价。',
'30': '您好！我们没有免费样品——样品费和运费由买家承担。好消息是：下大货时样品费全额抵扣货款。',
'45': '您好！可以订一件，按定制样单做。',
'62': '您好！样品运费由买家预付——样品不接受到付。',
'66': '您好！谢谢——发孟加拉 1 件没问题。请确认您的邮编，我报单件+到孟加拉运费的价格。',
'69': '您好！是的，我们 1 件起卖。您需要几件？',
'71': '您好！2 件没问题。请确认您在内罗毕的邮编，我核算含运费的总价。',
'24': '您好！是的，我们支持定制。您想定制哪方面——颜色、尺码、面料，还是 logo/唛头？',
'25': '您好！可以——请发我您的款式图或工艺单，我们评估后给您报价。是哪类款式呢？',
'41': '您好！感谢详细的需求和参考图——是的，我们可以做这款定制黑色燕尾服，白色蕾丝/花卉刺绣贴花从裤侧一直延伸到上衣。为了给您准备报价，能否发我：1）您的量体数据（或常穿的西装尺码）；2）翻领偏好——戗驳领还是平驳领；3）数量和交期？我也可以发您类似成品的照片。',
'58': '您好！可以——按肩带款、鼠尾草绿色做。请确认一下数量。',
'61': '您好！是的，我们可以在面料上印 logo（也可以刺绣）。您想要多少数量？',
'67': '您好！感谢联系。是的——我们接 1 件的订单，也可以发到您在国内的采购代理仓库。每件按您的要求（面料、款式、数量）单独计价。建议先从样品开始确认质量——能发我您的首批设计稿吗？',
'72': '您好！是的，我们支持定制。您想定制哪方面——颜色、尺码、面料、logo/唛头？多跟我说说。',
'15': '您好！到以色列的运费按重量和地址核算。请告诉我您的邮编，我帮您算运费。',
'18': '您好！样品：10–20 个工作日（刺绣钉珠款 20–30 天）；大货：样品确认后 15–25 个工作日。',
'27': '您好！运费按重量和目的地核算。您要几件？我马上给您报到 San Pedro Garza García 66274 的运费。',
'40': '您好！是的，我们送法国——走 DHL、FedEx 或 UPS。我们的服装是在中国广州的定制工作室按订单制作的。能告诉我您的邮编吗？我帮您算运费。',
'59': '您好！我们接受阿里信保、银行转账（T/T）和西联汇款——在阿里上通过信保全额支付。交期：样品 10–20 个工作日（刺绣款 20–30 天），大货 15–25 个工作日。',
'60': '您好！样品 10–20 个工作日（刺绣款 20–30 天）；样品确认后大货 15–25 个工作日。您什么时候要？',
'5': '您好！很简单：1）和我确认尺码、数量和定制要求；2）我在阿里上建单；3）您通过信保安全付款；4）我们开始生产。',
'29': '您好！我们接受阿里信保、银行转账（T/T）和西联汇款。在阿里上订单通过信保全额结算，保障买卖双方。',
'6': '您好！问得好——准确的量体很重要。请看下面的量体指南——标明了皮尺具体放哪里：',
'16': '您好！我们是定制工作室：每件都按订单制作，不是现货。我发您类似成品的实拍图，发货前也会拍照拍视频给您验货。',
'23': '您好！这条裙子的后背可以定制——可以做露背款（挂脖系带式），也可以做隐形拉链闭合款。您喜欢哪种？',
'31': '您好！我们主要在阿里消息中心沟通——产品照片和细节我都可以发您。您想了解这款的哪方面？',
'42': '您好！当然——我发您类似成品西装的照片，您可以看蕾丝工艺的质量。我在消息中心发您。',
'43': '您好！问得好。我们的创始人是 15 年经验的制版师，亲自把关每一件的版型和终检。我们按真实量体裁剪，细节手工完成。我也发您成品照片，您自己看。',
'49': '您好！可以的，我给您发产品目录，含款式、面料和起订量。我就在这里发您。',
'52': '您好！我们在阿里消息中心沟通——目录和产品照片都可以发您。您在找哪类女装裙子？',
'56': '您好！没错——我们按订单制作，所以这款没有现货。您确认订单后开始生产。好消息是：1 件就可以起做。要我给您准备报价吗？',
'68': '您好！可以——我发您产品目录，还有我们定制成品的实拍照片和视频。我们定制工作室的优势就是定制本身：每件按您的量体和要求制作，不是现货。告诉我您看中哪款，我们按您的要求做。我马上发您资料。',
'20': '您好！感谢关注——您需要几件，有定制想法吗？我给您准备明细和报价。',
'22': '您好！感谢关注——您想要多少数量？我给您准备明细和报价。',
'26': '您好！谢谢——祖母绿、XL、1 件，没问题。因为是单件定制，能确认一下您的量体数据，还有您的国家+邮编吗？这样我给您报含运费的准确价格。',
'35=36': '您好！是的，图上的西装我们可以做。为了准确报价，能否告诉我：1）您喜欢的颜色；2）您的尺码或量体数据；3）数量？期待合作！',
'48': '您好！一件可以订——顺便祝新婚快乐！是的，我们也做男士西装。伴郎团一共几位？我可以给您报团单价。',
'51': '您好，欢迎！您在找哪类产品、要多少数量？我们 1 件起做全定制。',
'64': '您好！我们的西装和裙子都是按订单定制的——按您量体裁剪，不是现货。1 件就可以起做。',
'65': '您好！下单很简单：1）发我您的尺码、数量和定制要求；2）我报准确价格；3）我们做样品并发照片给您确认；4）确认后大货生产，发货前拍照拍视频。我们开始吗？',
# #73–94（变量位已恢复，中文与正文变量一致）
'73': '您好，跟进一下——您看到我之前发的关于{{product}}的消息了吗？\n\n照片上看不出的一个细节：这款我们可以做其他颜色，还能按您的尺码调整。\n\n您看要不要我：1）给您发面料照片？2）给{{quantity}}件做个报价？',
'74': '您好！设计稿很漂亮——是的，我们支持按您自己的款式全定制。\n\n为了准确报价：1）是您自己的品牌/精品店用吗？2）每个款要几件？3）单件目标预算多少？4）什么时候要货？',
'75': '您好！太好了——关于{{product}}的样品，能否确认：1）单件目标预算？2）交期？3）量体数据或尺码规格？\n\n样品交期{{lead_time}}；下大货时样品费可抵扣货款。',
'76': '您好！样品报价：{{product}} ${{price}}/件，{{lead_time}}/件（手工钉珠耗时更长）。\n\n我的建议：先做 1 个款把版型做准，再做其他款——下大货时样品费全额抵扣。能发我量体数据和目标交期吗？',
'77': '早上好！没问题——您的{{product}}可以换成藏青纯色面料。\n\n说明一下：原来的面料我已经下单了，重新订面料可能会多几天。请确认换面料，并发我您的电话+发往{{country}}的详细收货地址。',
'78': '好的，谢谢！已确认——{{product}}，我马上安排。\n\n请发我您的电话和完整地址（街道、门牌、城市、州、邮编）。还有一件事：{{country}}进口税到付——您那边负责，对吗？',
'79': '您好！您的{{product}}正在生产中。发往{{country}}走快递，清关需要您的税号——请发我：1）税号；2）电话；3）完整收货地址。\n\n说明：{{country}}进口税由快递到付代收。',
'80': '您好！是的，我们可以用 Super 150 面料做羊毛/真丝燕尾服，配缎面戗驳领/青果领。${{price}}/件起。\n\n请确认：数量、颜色、您的量体数据、交期。发往{{country}}的 DHL 运费和进口关税另计。',
'81': '您好！我们是定制服装工作室——晚礼服、男士西装 1 件起定制。\n\n能发我您喜欢的款式照片或链接吗？我马上给您准确价格和明细。',
'82': '您好！感谢关注男士意式修身三件套西装。\n\n请确认颜色、您的尺码（或量体数据），以及这 1 件是打样还是大货的开头？',
'83': '您好！感谢咨询。请告诉我尺码、要几件、什么时候要？有了这些我给您做准确报价。',
'84': '您好！感谢分享尺码（{{size}}）。确认一下——这是您看中的那套西装的尺码吗？要几件？',
'85': '您好！感谢参考图——是的，这款定制黑色燕尾服配白色蕾丝贴花我们可以做。\n\n准确报价需要：1）您的量体数据；2）翻领偏好（戗驳领还是平驳领）；3）您的国家和邮编（核算运费）。参考：样衣 ${{price}}，制作期{{lead_time}}。',
'86': '您好，感谢留言！能发我您喜欢的那件夹克/上衣的照片或链接吗，加上颜色、尺码和数量？',
'87': '您好！我们是定制服装工作室——晚礼服、男士西装 1 件起定制。能发我您喜欢的款式照片或链接，加上您的尺码和数量吗？',
'88': '您好！感谢关注缎面单肩鱼尾晚礼服。\n\n准确报价需要：1）想要的颜色；2）尺码（美码/欧码/英码）；3）这 2 件是打样还是试单？我们是定制服装工作室——每件按您的要求制作。',
'89': '您好！感谢咨询我们的金属缎面鱼尾裙。\n\n请确认：1）想要的颜色；2）尺码（美码/欧码/英码）；3）这 2 件是打样还是试单？我们是定制工作室——每件按您的要求制作。样品交期一般{{lead_time}}。',
'90': '您好！感谢咨询我们的蕾丝网纱晚礼服。\n\n报价需要：1）想要什么颜色？2）要哪些尺码？3）大概几件？我们提供量体定制。',
'91': '您好，感谢留言！这条裙子是量体定制的——后背可以做露背款（挂脖系带），也可以做隐形拉链。您喜欢哪种？\n\n报价需要：几件、什么时候要？',
'92': '您好！{{product}}：{{price}}美元/件，看数量。\n\n您要几件？发往哪个国家？我给您报含运费的准确价格。',
'93': '您好！感谢关注这条裙子——这款缎面鱼尾裙是我们最受欢迎的款式之一，也有其他颜色。\n\n您喜欢哪种颜色？要几件？什么时候要？',
'94': '您好，感谢留言！这款黑色金绣燕尾服我们可以做。\n\n准确报价需要：1）您的尺码（或量体数据）和数量；2）您的国家和邮编。参考：样衣 {{price}} 美元，交期{{lead_time}}——待确认。',
}

# ---------- 5. 生成 seedTemplatesV4.js ----------
SNIPPETS = [
    {'key': 'signature', 'lang': 'EN', 'title_zh': '落款-英文', 'body': 'Best regards,\nYingzi'},
    {'key': 'signature', 'lang': 'ES', 'title_zh': '落款-西语', 'body': 'Saludos cordiales,\nYingzi'},
    {'key': 'signature', 'lang': 'PT', 'title_zh': '落款-葡语', 'body': 'Atenciosamente,\nYingzi'},
    {'key': 'signature', 'lang': 'FR', 'title_zh': '落款-法语', 'body': 'Cordialement,\nYingzi'},
    {'key': 'signature', 'lang': 'DE', 'title_zh': '落款-德语', 'body': 'Mit freundlichen Grüßen,\nYingzi'},
    {'key': 'signature', 'lang': 'AR', 'title_zh': '落款-阿语', 'body': 'مع تحياتي،\nYingzi'},
    {'key': 'signature', 'lang': 'ZH', 'title_zh': '落款-中文', 'body': '祝好，\nYingzi'},
]

def js_str(s):
    return json.dumps(s, ensure_ascii=False)

def main():
    items = parse_md()
    assert len(items) == 92, f'解析出 {len(items)} 条，期望 92'
    assert set(GLOSS.keys()) == set(i['num'] for i in items), 'GLOSS 编号与解析编号不一致'

    templates = []
    seq = 0
    for it in items:
        num = it['num']
        if num in V73_94:
            # --- #73–94：映射回原模板 ---
            cfg = V73_94[num]
            body = it['reply']
            for old, new in cfg['reps']:
                assert body.count(old) == 1, f'#{num} 替换片段未精确命中1次: {old[:40]}'
                body = body.replace(old, new)
            # 校验：正文变量与 vars 一致
            body_vars = sorted(set(re.findall(r'\{\{\s*([a-z_]+)\s*\}\}', body)))
            cfg_vars = sorted(v[0] for v in cfg['vars'])
            assert body_vars == cfg_vars, f'#{num} 变量不一致: 正文{body_vars} vs 配置{cfg_vars}'
            gloss_vars = sorted(set(re.findall(r'\{\{\s*([a-z_]+)\s*\}\}', GLOSS[num])))
            assert gloss_vars == cfg_vars, f'#{num} 中文变量不一致: {gloss_vars} vs {cfg_vars}'
            scene, category, note = ORIG_META[cfg['key']]
            templates.append({
                'key': cfg['key'], 'scene': scene, 'category': category,
                'note_zh': note, 'gloss_zh': GLOSS[num],
                'source_buyer': f'v2.1-#{num}',
                'vars': [{'name': n, 'type': t, 'required': r, 'label_zh': l}
                         for n, t, r, l in cfg['vars']],
                'locales': [{'lang': it['lang'], 'title': it['buyer'][:120],
                             'body': body}],
            })
        else:
            # --- #1–72：真实询盘，直转模板 ---
            seq += 1
            scene = SCENE_MAP.get(it['section'])
            assert scene, f'#{num} 节无 scene 映射: {it["section"]}'
            note = f'v2.1 #{num}｜{it["section"].split("（")[0]}｜{it["buyer"][:60]}'
            templates.append({
                'key': f'v21-{seq:03d}', 'scene': scene, 'category': '通用',
                'note_zh': note, 'gloss_zh': GLOSS[num],
                'source_buyer': f'v2.1-#{num}',
                'vars': [],
                'locales': [{'lang': it['lang'], 'title': it['buyer'][:120],
                             'body': it['reply']}],
            })

    assert len(templates) == 92, f'生成 {len(templates)} 条'
    keys = [t['key'] for t in templates]
    assert len(set(keys)) == 92, 'key 重复'

    # 写 JS（字符串全部用 JSON 转义，避免模板字符串 ${ 误解析）
    out = []
    out.append('/* 回复模板库种子数据 v4（话术库 v2.1 全量）\n'
               ' * 由 server/src/data/reply-library-v2.1.md 生成：\n'
               ' * - #1–72：70 条真实询盘 → 单语言模板（无变量，正文即定稿回复）\n'
               ' * - #73–94：22 条 → 映射回原 key，v2.1 优化文案 + 恢复 {{变量}} 位\n'
               ' * 生成器：server/scripts/build-seed-v4.py（修改 md 后重跑）\n'
               ' * 变量规则：price / lead_time 出现即 required:1（业务红线）\n'
               ' */\n')
    out.append('export const SNIPPETS = [')
    for s in SNIPPETS:
        out.append(f"  {{ key: {js_str(s['key'])}, lang: {js_str(s['lang'])}, "
                   f"title_zh: {js_str(s['title_zh'])}, body: {js_str(s['body'])} }},")
    out.append('];\n')
    out.append('export const TEMPLATES = [')
    for t in templates:
        out.append('  {')
        out.append(f"    key: {js_str(t['key'])},")
        out.append(f"    scene: {js_str(t['scene'])},")
        out.append(f"    category: {js_str(t['category'])},")
        out.append(f"    note_zh: {js_str(t['note_zh'])},")
        out.append(f"    gloss_zh: {js_str(t['gloss_zh'])},")
        out.append(f"    source_buyer: {js_str(t['source_buyer'])},")
        out.append('    vars: [')
        for v in t['vars']:
            out.append(f"      {{ name: {js_str(v['name'])}, type: {js_str(v['type'])}, "
                       f"required: {v['required']}, label_zh: {js_str(v['label_zh'])}, sample: '' }},")
        out.append('    ],')
        out.append('    locales: [')
        for l in t['locales']:
            out.append(f"      {{ lang: {js_str(l['lang'])}, title: {js_str(l['title'])}, "
                       f"body: {js_str(l['body'])} }},")
        out.append('    ],')
        out.append('  },')
    out.append('];\n')
    open(OUT, 'w', encoding='utf-8').write('\n'.join(out))
    print(f'OK: {len(templates)} 条模板 → {OUT}')
    # 统计
    from collections import Counter
    print('scene 分布:', dict(Counter(t['scene'] for t in templates)))
    print('语种分布:', dict(Counter(t['locales'][0]['lang'] for t in templates)))
    print('有变量模板:', sum(1 for t in templates if t['vars']))

if __name__ == '__main__':
    main()
