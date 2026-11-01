import fs from 'node:fs';

const rows = JSON.parse(fs.readFileSync('work/char-audit/cards-with-freq.json', 'utf8'));
const byId = new Map(rows.map((r) => [r.id, r]));
const out = [];
const log = (...a) => out.push(a.join(' '));

const FAMILIES = [
  {
    name: '假X',
    words: ['w_131', 'w_494', 'w_492', 'w_493', 'w_454', 'w_465'],
    keep: ['w_131', 'w_494', 'w_492', 'w_493', 'w_465'],
    remove: ['w_454'],
    reason:
      '四个“假+具体对象/职业”都是高频风险或骗局，不是换字练习：假币是现金场景的实物风险；假警察（公检法/安全账户）、假客服（退款/理赔/注销会员）、假医生（保健品/免费体检）是三类不同剧本，识别点不同。“假冒”是抽象的“拿假货当真的卖”，与“冒充”“虚假”重叠，冒字已由感冒/冒充覆盖，删；“虚假”保留，因为它是官方反诈话术（虚假信息/虚假中奖），描述信息而非人或物。当前没有假文件/假签证/假机票这类同结构低价值词。',
  },
  {
    name: '手机X',
    words: ['w_327', 'w_093', 'w_136'],
    keep: ['w_327', 'w_093'],
    remove: ['w_136'],
    reason:
      '手机是核心；手机银行是具体 App/渠道（与网上银行成对），保留。手机支付完全由“手机+支付”组合，两个字都已有卡，且扫码/付款码/支付已覆盖手机付款场景，属透明组合词，删。若更看重“手机支付”这一生活概念，可改为删“支付”留“手机支付”，二选一，不要两张都留。',
  },
  {
    name: '来电X',
    words: ['w_293', 'w_489', 'w_488', 'w_490'],
    keep: ['w_293', 'w_489', 'w_488', 'w_490'],
    remove: [],
    reason:
      '四个词是四种阅读场景，不是同义替换：来电是基本概念；未接来电是手机屏幕上天天出现的状态；境外来电是屏幕上直接给出的诈骗警示标签；来电显示是设置/账单里的功能名。来电显示看似最虚，但“显”在全表只此一处，且老人接电话前看屏幕判断“接不接”是真实动作，暂保留，列为低优先级观察项（若必须再砍，它是本族第一个候选）。',
  },
  {
    name: '银行X',
    words: ['c_yinhang', 'w_138', 'w_137', 'w_120', 'w_108', 'w_089'],
    keep: ['c_yinhang', 'w_138', 'w_137', 'w_108', 'w_089'],
    remove: ['w_120'],
    reason:
      '银行/银行卡是核心；网上银行与手机银行（手机X族）是两个渠道，骗局话术会分别提到，保留；开户行是转账单上的必填项，保留；网点是“银行在街上的办事点”，与银行不完全同义，保留但列为低优先级观察项。网银只是网上银行的缩写，网/银两字均已覆盖，删。',
  },
  {
    name: '洗衣X',
    words: ['w_278', 'w_243', 'w_241', 'w_242'],
    keep: ['w_278', 'w_243', 'w_241'],
    remove: ['w_242'],
    reason:
      '洗衣服是核心动作，洗衣机是家电，都保留。洗衣粉/洗衣液是同一商品的不同形态，只差一个字；“粉”在全表只由洗衣粉承担（面粉/粉丝类常用字），“液”已由输液承担，因此保留洗衣粉、删洗衣液。',
  },
  {
    name: '支付X',
    words: ['c_fukuan', 'w_135', 'w_133', 'w_134', 'c_saoma'],
    keep: ['c_fukuan', 'w_135', 'w_133', 'w_134', 'c_saoma'],
    remove: [],
    reason:
      '付款是口语动词；支付是屏幕/按钮上的词（立即支付），两种阅读场景不同，都保留；付款码/收款码是付款方与收款方的两个方向，骗局里都会出现，不能合并；扫码是动作。手机支付在手机X族删，支付密码在密码族保留。',
  },
  {
    name: '收费/收银',
    words: ['w_018', 'w_112', 'w_431', 'c_jiaofei'],
    keep: ['w_018', 'w_112', 'c_jiaofei'],
    remove: ['w_431'],
    reason:
      '收费处是医院交钱的窗口，收银台是商店交钱的台子，缴费是交水电/医院费用，三个场景不同，保留。收银与收银台同指“收钱找钱的地方”，单独作名词也不自然，删收银。',
  },
  {
    name: '存/取/汇',
    words: ['c_cunqian', 'w_078', 'w_082', 'w_326', 'c_quqian', 'w_079', 'w_003', 'w_348', 'w_144', 'w_086', 'w_102'],
    keep: ['c_cunqian', 'w_078', 'w_082', 'c_quqian', 'w_003', 'w_348', 'w_144', 'w_086', 'w_102'],
    remove: ['w_326', 'w_079'],
    reason:
      '存钱是动作，存款是名词（卡里还没取的钱），存折是实物本子，三个不同，保留。取钱/取款是同一动作的口语与柜台说法，款字已由存款/付款/汇款覆盖、取字已由取钱/取药/取号覆盖，删取款；取药/取号/取号机是不同对象，保留。汇款与转账是不同业务，保留；汇率是抽象但真实存在的换汇概念，保留观察。存储是手机空间，与内存重复，删。',
  },
  {
    name: '密码/验证码/卡号',
    words: ['c_mima', 'w_497', 'c_yanzhengma', 'w_496', 'w_107', 'w_498', 'w_110', 'w_111', 'w_373'],
    keep: ['c_mima', 'w_497', 'c_yanzhengma', 'w_107', 'w_498', 'w_110', 'w_111', 'w_373'],
    remove: ['w_496'],
    reason:
      '密码（银行卡取款）、支付密码（付款）、验证码（短信一次性码）是三种不同的秘密，反诈的核心是“哪个都不能告诉别人”，三张都必须留。卡号/身份证号是两类不同的敏感号码，保留。免密是开关概念，刷脸是支付动作，人脸识别是政务/银行身份核验，场景不同，保留。动态码与验证码同义（一会儿就变的一串数字），删动态码。',
  },
  {
    name: '票据/单据',
    words: ['w_124', 'w_145', 'w_114', 'w_104', 'w_487', 'w_163', 'w_199', 'w_200', 'w_173', 'w_172', 'w_201', 'w_178', 'w_202', 'w_002', 'w_017'],
    keep: ['w_145', 'w_114', 'w_487', 'w_163', 'w_199', 'w_200', 'w_173', 'w_172', 'w_201', 'w_178', 'w_202', 'w_002', 'w_017'],
    remove: ['w_124', 'w_104'],
    reason:
      '回单与凭条都是“办完事/机器打出来的纸条”，凭条更贴 ATM 场景，删回单。支票是个人生活极少用的对公工具，老人日常不接触，删。传票是公检法骗局的核心道具，必须保留（与车票同带“票”但毫无关系）。车票/买票/取票/退票/补票是出行不同步骤，检票与检票口是动作与地点，售票处是地点，都保留。报告单是检查结果、检查单是检查项目单，医院两个步骤，保留。',
  },
  {
    name: '证件/证明/身份',
    words: ['c_shenfenzheng', 'w_389', 'w_392', 'w_390', 'w_380', 'w_372', 'w_360', 'w_368', 'w_391', 'w_363', 'w_393', 'w_369', 'w_364', 'w_022', 'w_370'],
    keep: ['c_shenfenzheng', 'w_389', 'w_392', 'w_380', 'w_372', 'w_360', 'w_368', 'w_391', 'w_363', 'w_393', 'w_369', 'w_364', 'w_370'],
    remove: ['w_390', 'w_022'],
    reason:
      '身份证/证件/结婚证/房产证/居住证/残疾证/退休证/优待证是不同用途的证件，不能因都带“证”合并；换证是到期换新，与补办不同。老年证与老年卡同指老年优待凭证，社保卡已整合医保功能，故删老年证、医保卡，保留老年卡、社保卡；医保概念仍由 c_yibao 承担。注意：验证码、保证金虽含“证”字，但不是证件，不能并进此族。',
  },
  {
    name: '诊X',
    words: ['w_004', 'w_067', 'w_043', 'w_065', 'w_001', 'w_075', 'w_021', 'w_005', 'w_042', 'w_033', 'w_029'],
    keep: ['w_067', 'w_043', 'w_065', 'w_001', 'w_075', 'w_021', 'w_005', 'w_042', 'w_033', 'w_029'],
    remove: ['w_004'],
    reason:
      '门诊/急诊是科室与场景，必须保留；转诊是换医院，保留；就诊是医院标识用语（就诊须知/就诊流程），看病是口语，两种都需要，保留；候诊是候诊区/屏幕状态，保留。复诊与复查同义（看完病再来看），诊字由门诊/急诊/候诊/转诊覆盖、复字由复查覆盖，删复诊。导诊/陪诊/问诊是医院角色/服务词，价值较低但仍有真实场景，列为低优先级观察项，不本轮删。',
  },
  {
    name: '金X',
    words: ['w_127', 'w_126', 'w_025', 'w_421', 'w_478', 'w_105', 'w_115', 'w_365'],
    keep: ['w_126', 'w_025', 'w_421', 'w_478', 'w_115', 'w_365'],
    remove: ['w_127', 'w_105'],
    reason:
      '退休金与养老金同指每月领的养老钱；“退休”二字由退休证承担，“养老”只由养老金承担，且社保/银行通知多用养老金，删退休金。押金（住院先交）、定金（订货先交）、保证金（骗局里让你先交）语境完全不同，三个都保留，合并会让“交保证金”的警告失效。现金是核心。资金是抽象总称、不对应老人动作，删；公积金对已退休人群使用频率低，列为观察项。',
  },
  {
    name: '费用X',
    words: ['c_mianfei', 'w_024', 'w_141', 'w_140', 'w_142', 'w_101', 'w_139', 'w_289', 'w_291', 'w_407'],
    keep: ['c_mianfei', 'w_024', 'w_141', 'w_140', 'w_142', 'w_101', 'w_139', 'w_289', 'w_291', 'w_407'],
    remove: [],
    reason:
      '这一族同结构最明显，但每一项都是不同的钱：电/水/燃气是三张账单，自费是医保不报的部分，手续费/年费/话费/运费是不同场景的费用，欠费是状态。老人每月都要认这些账单，不能为了降频合并。年费价值最低（多数借记卡免年费），列为观察项。',
  },
  {
    name: '购物规格/库存',
    words: ['w_442', 'w_441', 'w_443', 'w_418', 'w_444', 'w_445', 'w_419'],
    keep: ['w_442', 'w_441', 'w_443', 'w_418', 'w_444', 'w_419'],
    remove: ['w_445'],
    reason:
      '尺寸是买衣服/家具要看的，规格/型号是商品标签信息，保留（型号/规格价值偏低，列观察项）。缺货是顾客要读的（想买的东西没了），保留；库存/补货是商家侧但仍会出现在页面/货架提示上，保留观察；上架是纯粹的商家动作（把货摆上架），老人不需要做也不需要读，删。',
  },
  {
    name: '家居动作（停电/切法）',
    words: ['w_265', 'w_262', 'w_229', 'w_227', 'w_228', 'w_277', 'w_247'],
    keep: ['w_265', 'w_229', 'w_277', 'w_247'],
    remove: ['w_262', 'w_227', 'w_228'],
    reason:
      '停电与断电同指突然没电，停电是通知/口语常用词，断字已由断网覆盖，删断电。切块/切片/切丝是同结构切法：块在全表只由切块承担（一块钱/方块等常用），片已由药片/照片/拍片覆盖，丝已由保险丝覆盖，故保留切块、删切片与切丝。收拾/整理近义，但“整”在全表只由整理承担，删了会丢字，暂保留，列观察项。',
  },
  {
    name: '出行站点',
    words: ['c_zhan', 'w_180', 'w_147', 'w_146', 'w_181', 'w_152', 'w_182', 'w_183', 'w_153', 'w_179', 'w_166', 'w_203'],
    keep: ['c_zhan', 'w_180', 'w_146', 'w_181', 'w_152', 'w_182', 'w_183', 'w_153', 'w_179', 'w_166', 'w_203'],
    remove: ['w_147'],
    reason:
      '站是单字基线卡，车站是词，二者是“字→词”的设计，不是重复；站牌是路边读的牌，站台是上下车的高台，到站/进站/出站/报站/过站是不同状态，候车/候车室是等待动作与地点，都保留。站点与车站同指公交停靠点，站点是地图/APP用语、老人日常说车站，删站点。',
  },
  {
    name: '账户记录',
    words: ['w_088', 'w_117', 'c_yue', 'w_095', 'w_096'],
    keep: ['w_117', 'c_yue', 'w_095', 'w_096'],
    remove: ['w_088'],
    reason:
      '流水与明细同指“卡里一笔一笔进出钱的记录”，明细更常出现在账单/APP，流水是银行行话，删流水。余额是核心；扣款是短信里出现的动作，代扣是授权自动扣，二者不同，保留。',
  },
  {
    name: '签字',
    words: ['w_357', 'w_397', 'w_420', 'w_356'],
    keep: ['w_357', 'w_420', 'w_356'],
    remove: ['w_397'],
    reason:
      '签字是柜台/表格上的动作（在这里签字），签收是收快递时签名表示收到，盖章是另一个动作，三个不同。签名与签字同义，名字已由户名/实名制/黑名单覆盖、签已由签字/签收/改签/价签/标签覆盖，删签名。',
  },
  {
    name: '返利/返现',
    words: ['w_456', 'w_476', 'w_455'],
    keep: ['w_456', 'w_455'],
    remove: ['w_476'],
    reason:
      '返利与返现同指“买了东西再退一点钱”，只差一个字；返利是“刷单返利”这一经典骗局的固定说法，返现是促销用语，安全场景保留返利、删返现。刷单是骗局动作，保留。',
  },
];

const REMOVE = [
  { id: 'w_120', reason: '网上银行的缩写；同场景已有“网上银行”，网/银两字均已覆盖，纯换形不增概念。', replaceWith: 'w_137', confidence: 'high' },
  { id: 'w_431', reason: '与“收银台”同指商店交钱的台子；单独作名词不自然，收/银两字已覆盖。', replaceWith: 'w_112', confidence: 'high' },
  { id: 'w_124', reason: '与“凭条”同指办完事/机器打出来的纸条；回/单两字已由回拨、床单等覆盖。', replaceWith: 'w_145', confidence: 'high' },
  { id: 'w_004', reason: '与“复查”同义（看完病再来看）；诊字由门诊/急诊/候诊/转诊覆盖，复字由复查覆盖。', replaceWith: 'w_067', confidence: 'high' },
  { id: 'w_022', reason: '与“社保卡”同指一张卡（社保卡已含医保功能）；医保概念由 c_yibao 承担，医/保/卡均已覆盖。', replaceWith: 'w_364', confidence: 'high' },
  { id: 'w_390', reason: '与“老年卡”同指老年优待凭证；证字由身份证/证件覆盖，老/年两字已覆盖。', replaceWith: 'w_370', confidence: 'high' },
  { id: 'w_088', reason: '与“明细”同指卡里一笔笔进出记录；流/水两字已由流量、水费覆盖。', replaceWith: 'w_117', confidence: 'high' },
  { id: 'w_262', reason: '与“停电”同指突然没电；断字由断网覆盖，电字已多处覆盖。', replaceWith: 'w_265', confidence: 'high' },
  { id: 'w_496', reason: '与“验证码”同义（一会儿就变的一串数字）；码字由密码/验证码/扫码覆盖。', replaceWith: 'c_yanzhengma', confidence: 'high' },
  { id: 'w_397', reason: '与“签字”同义（写下自己的名字）；名字由户名/实名制/黑名单覆盖，签字是柜台常用动作。', replaceWith: 'w_357', confidence: 'high' },
  { id: 'w_079', reason: '与“取钱”同指从银行/机器取钱；款字由存款/付款/汇款覆盖，取字由取钱/取药/取号覆盖。', replaceWith: 'c_quqian', confidence: 'high' },
  { id: 'w_136', reason: '“手机+支付”的透明组合，两个字均已有卡；手机付款场景已由扫码/付款码/支付覆盖。保留“支付”这一屏幕按钮词。', replaceWith: 'w_135', confidence: 'medium' },
  { id: 'w_476', reason: '与“返利”同指花完钱再退一点；返字由返利覆盖，利字由利息/利率覆盖；安全场景保留“刷单返利”的固定说法。', replaceWith: 'w_456', confidence: 'high' },
  { id: 'w_127', reason: '与“养老金”同指每月领的养老钱；退休二字由退休证覆盖，养老金是社保/银行通知用词。', replaceWith: 'w_126', confidence: 'medium' },
  { id: 'w_326', reason: '与“内存”同指手机存东西的空间；储字由储蓄卡覆盖，存字多处覆盖；内存是店员/设置里更常用的说法。', replaceWith: 'w_339', confidence: 'high' },
  { id: 'w_454', reason: '与“冒充”“虚假”语义重叠；冒字已由感冒/冒充覆盖，假的具体骗局由假币/假警察/假客服/假医生承担。', replaceWith: 'w_453', confidence: 'high' },
  { id: 'w_242', reason: '与“洗衣粉”是同一商品的不同形态；液字已由输液覆盖，粉字在全表只由洗衣粉承担。', replaceWith: 'w_241', confidence: 'high' },
  { id: 'w_227', reason: '与“切块/切丝”同结构切法；片字已由药片/照片/拍片覆盖；块字在全表只由切块承担，故保留切块。', replaceWith: 'w_229', confidence: 'high' },
  { id: 'w_228', reason: '同切片；丝字已由保险丝覆盖，切丝是三种切法里最低频的。', replaceWith: 'w_229', confidence: 'high' },
  { id: 'w_104', reason: '个人生活极少用的对公/大额工具，老人日常不接触；支字由支付/支付密码/透支覆盖，票字由车票/传票覆盖。', confidence: 'medium' },
  { id: 'w_147', reason: '与“车站”同指公交停靠点；站点是地图/APP用语，老人日常说车站；站字已多处覆盖。', replaceWith: 'w_180', confidence: 'high' },
  { id: 'w_445', reason: '商家动作（把新货摆上架），不是老人要做的动作；架字由货架/衣架覆盖，顾客侧保留“缺货”。', replaceWith: 'w_419', confidence: 'medium' },
  { id: 'w_105', reason: '抽象总称（一笔钱的总数），不对应老人动作；余额/存款/现金已覆盖具体概念；资字由工资/工资卡覆盖。', replaceWith: 'w_078', confidence: 'medium' },
];

const KEEP = [
  { id: 'c_fukuan', compare: ['w_135'], reason: '付款是口语动词，支付是屏幕/按钮上的词（立即支付）；两种阅读场景不同，不能因意思相近合并。' },
  { id: 'c_mima', compare: ['w_497', 'c_yanzhengma'], reason: '密码（银行卡取款）、支付密码（付款）、验证码（短信一次性码）是三种不同的秘密；反诈的核心是“哪个都不能给别人”，合并会抹掉关键区别。' },
  { id: 'w_133', compare: ['w_134'], reason: '付款码是付款方出示，收款码是收款方出示；两个方向都出现在骗局里（让你出示付款码 / 帮你收款），不能合并。' },
  { id: 'w_141', compare: ['w_140', 'w_142'], reason: '电费、水费、燃气费是三张不同的账单，老人每月都要认；同结构但不可合并。' },
  { id: 'w_084', compare: ['w_085'], reason: '定期与活期是两种存款规则（利息、取用限制不同）；老人做储蓄决定时要能分清，保留两张。' },
  { id: 'w_025', compare: ['w_421', 'w_478'], reason: '押金（住院先交）、定金（订货先交）、保证金（骗局里让你先交）语境完全不同；合并会让“交保证金”的警告失效。' },
  { id: 'w_002', compare: ['w_017'], reason: '报告单是检查结果，检查单是写着要做什么检查的单子；医院两个步骤，拿错就白跑。' },
  { id: 'c_shenfenzheng', compare: ['w_498'], reason: '身份证是卡片，身份证号是号码；号码是独立的诈骗目标（报出号码就可能被冒用），不能合并。' },
  { id: 'w_364', compare: ['w_138', 'w_370', 'w_394'], reason: '银行卡、社保卡、老年卡、门禁卡是不同用途的卡；都带“卡”字，但丢了哪张、去哪补都不一样。' },
  { id: 'w_487', compare: ['w_163'], reason: '传票是法院叫你去的纸，车票是坐车的票；同带“票”字但毫无关系，传票是公检法骗局的核心道具，必须保留。' },
  { id: 'w_488', compare: ['w_293', 'w_490', 'w_489'], reason: '来电是概念，未接来电是手机屏幕上的状态，境外来电是诈骗警示标签，来电显示是设置/账单里的功能名（“显”全表只此一处）；四种阅读场景，暂全保留，来电显示列为观察项。' },
  { id: 'w_093', compare: ['w_137'], reason: '手机银行是手机 App，网上银行是电脑网页；两个渠道，骗局话术会分别提到，保留。' },
  { id: 'w_059', compare: ['w_035', 'w_060', 'w_003', 'w_061'], reason: '吃药是动作、用药是医嘱说法、开药是医生写、取药是药房拿、买药是商店买；五个不同步骤，不是同义词。' },
  { id: 'w_043', compare: ['w_065'], reason: '就诊是医院标识用语（就诊须知/就诊流程），看病是口语；两种阅读场景都需要，保留。' },
  { id: 'w_188', compare: ['w_187'], reason: '列车是车站广播/屏幕用语，火车是日常说法；看站牌和听广播时用“列车”，保留两张。' },
  { id: 'w_111', compare: ['w_373'], reason: '刷脸是支付动作，人脸识别是政务/银行身份核验；场景不同，且都是骗局话术（“对着镜头眨眨眼”），保留。' },
  { id: 'w_109', compare: ['w_123', 'w_077'], reason: '小额免密、大额取现预约、单笔限额是三条不同的银行规则；数字大小相对，不能互相替代。' },
  { id: 'w_247', compare: ['w_277'], reason: '整理与收拾近义，但“整”在全表只由整理承担（整齐/完整类常用字）；删了会丢字，暂保留，列为观察项。' },
];

// ---- validate ----
const errors = [];
const familyRemove = new Set();
for (const f of FAMILIES) {
  for (const id of f.words) if (!byId.has(id)) errors.push(`family ${f.name}: missing word ${id}`);
  for (const id of f.keep) if (!f.words.includes(id)) errors.push(`family ${f.name}: keep ${id} not in words`);
  for (const id of f.remove) {
    if (!f.words.includes(id)) errors.push(`family ${f.name}: remove ${id} not in words`);
    if (f.keep.includes(id)) errors.push(`family ${f.name}: ${id} both keep and remove`);
    if (familyRemove.has(id)) errors.push(`remove ${id} in multiple families`);
    familyRemove.add(id);
  }
}
const removeIds = new Set();
for (const r of REMOVE) {
  if (!byId.has(r.id)) errors.push(`remove: missing ${r.id}`);
  if (removeIds.has(r.id)) errors.push(`remove: duplicate ${r.id}`);
  removeIds.add(r.id);
  if (!familyRemove.has(r.id)) errors.push(`remove ${r.id} not in any family remove`);
  if (r.replaceWith && !byId.has(r.replaceWith)) errors.push(`replaceWith missing ${r.replaceWith}`);
  if (r.replaceWith === r.id) errors.push(`replaceWith self ${r.id}`);
  if (KEEP.some((k) => k.id === r.id)) errors.push(`remove ${r.id} also in keep`);
}
for (const id of familyRemove) if (!removeIds.has(id)) errors.push(`family remove ${id} missing from REMOVE`);
for (const k of KEEP) {
  if (!byId.has(k.id)) errors.push(`keep: missing ${k.id}`);
  for (const c of k.compare) if (!byId.has(c)) errors.push(`keep compare missing ${c}`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

// ---- stats ----
const sceneBefore = {};
for (const r of rows) sceneBefore[r.scene] = (sceneBefore[r.scene] || 0) + 1;
const sceneAfter = { ...sceneBefore };
for (const r of REMOVE) sceneAfter[byId.get(r.id).scene] -= 1;
const distinctWords = new Set(FAMILIES.flatMap((f) => f.words));
const high = REMOVE.filter((r) => r.confidence === 'high').length;
const medium = REMOVE.length - high;

const outJson = {
  meta: {
    title: '字伴 550 词卡相似词/低学习价值词审计',
    date: '2026-10-28',
    sources: ['work/char-audit/cards-with-freq.json', 'work/char-audit/cards-by-scene.md', 'content/cards/level1.yaml', 'content/cards/level2.yaml'],
    totalCards: rows.length,
    families: FAMILIES.length,
    distinctWordsInFamilies: distinctWords.size,
    removeCount: REMOVE.length,
    remainingCards: rows.length - REMOVE.length,
    highConfidence: high,
    mediumConfidence: medium,
    sceneBefore,
    sceneAfter,
    note: '仅分析，未改动 content/。c_ 开头为 50 张基线卡，本计划不建议删任何 c_ 卡。若 550 张总数必须保持，需要 24 张补位卡；补位候选见 similarity-plan.md 第 7 节。',
  },
  families: FAMILIES.map((f) => ({
    name: f.name,
    words: f.words.map((id) => { const r = byId.get(id); return { id, text: r.text, scene: r.scene, level: r.level }; }),
    keep: f.keep,
    remove: f.remove,
    reason: f.reason,
  })),
  remove: REMOVE.map((r) => {
    const row = byId.get(r.id);
    const rep = r.replaceWith ? byId.get(r.replaceWith) : null;
    return {
      id: r.id,
      text: row.text,
      scene: row.scene,
      level: row.level,
      meaning: row.meaning,
      family: FAMILIES.find((f) => f.remove.includes(r.id)).name,
      reason: r.reason,
      replaceWith: rep ? { id: rep.id, text: rep.text } : null,
      confidence: r.confidence,
    };
  }),
  keep: KEEP.map((k) => {
    const row = byId.get(k.id);
    return {
      id: k.id,
      text: row.text,
      scene: row.scene,
      level: row.level,
      meaning: row.meaning,
      compareWith: k.compare.map((id) => ({ id, text: byId.get(id).text })),
      reason: k.reason,
    };
  }),
};

fs.writeFileSync('work/char-audit/similarity-plan.json', `${JSON.stringify(outJson, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ families: FAMILIES.length, distinctWords: distinctWords.size, remove: REMOVE.length, high, medium, sceneBefore, sceneAfter }, null, 2));
