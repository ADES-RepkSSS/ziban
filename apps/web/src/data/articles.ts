import type { RiskNote } from '@ziban/core';

export interface ArticleSentence {
  text: string;
  /** 人工写的一句话解释；不自动生成，避免对老人编造意思。 */
  plain: string;
}

export interface Article {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  imageAlt: string;
  sentences: ArticleSentence[];
  summary: string[];
  risk?: RiskNote;
  note?: string;
}

export const articles: Article[] = [
  {
    id: 'hospital-notice',
    title: '医院看病通知',
    subtitle: '贴在医院大厅的牌子',
    image: './images/hospital.svg',
    imageAlt: '一栋白色的医院大楼，门口有红十字',
    sentences: [
      { text: '请先到一楼大厅挂号。', plain: '先在一楼拿号。' },
      { text: '然后到二楼三号诊室看病。', plain: '拿完号，去二楼找三号房间的医生。' },
      { text: '缴费请到一楼窗口。', plain: '看完病，去一楼交钱。' },
      { text: '取药请到药房。', plain: '交完钱，去药房拿药。' },
    ],
    summary: ['先在一楼挂号。', '去二楼三号诊室看病。', '在一楼交钱，再去药房拿药。'],
    note: '实验版自带示例，用来看懂医院里最常见的流程。',
  },
  {
    id: 'bank-sms',
    title: '一条银行短信',
    subtitle: '陌生人发来的，要小心',
    image: './images/bank.svg',
    imageAlt: '一栋有柱子的银行大楼',
    sentences: [
      { text: '您的账户于今日收到转账一笔，金额五千元。', plain: '有人说你的卡里多了五千块。' },
      { text: '请点击链接核实，逾期将冻结账户。', plain: '他让你点开一个网址，不然就说你的钱不能用。' },
      { text: '这是骗人的。银行不会让你点链接。', plain: '不要点。银行不会这样发消息。' },
      { text: '不要转账，也不要给验证码。', plain: '钱不要转，手机上的数字也不要告诉别人。' },
    ],
    summary: [
      '有人说你收到五千块。',
      '他让你点链接，不然冻结账户。',
      '这是骗人的：不要点、不要转、不要给验证码。',
    ],
    risk: {
      level: 'danger',
      title: '先别急着按',
      advice: '这条短信是骗人的。不要点链接，不要转账，也不要给验证码。拿不准就打一一零。',
    },
    note: '这条短信是反面例子，专门用来看清骗子的话。',
  },
  {
    id: 'community-notice',
    title: '社区免费量血压',
    subtitle: '社区活动中心的通知',
    image: './images/community.svg',
    imageAlt: '社区活动中心，前面有两个人',
    sentences: [
      { text: '各位居民，本周六上午九点，在社区活动中心免费测量血压。', plain: '这个星期六早上九点，可以到社区免费量血压。' },
      { text: '请带上身份证。', plain: '去的时候要拿上身份证。' },
    ],
    summary: ['星期六早上九点。', '在社区活动中心。', '免费量血压，记得带身份证。'],
    note: '实验版自带示例，用来看懂社区通知。',
  },
  {
    id: 'phone-permission',
    title: '手机问你要不要给位置',
    subtitle: '微信弹出的提示',
    image: './images/phone-permission.svg',
    imageAlt: '手机屏幕上一个位置标记，旁边有一个问号',
    sentences: [
      { text: '微信需要获取您的位置信息，是否允许？', plain: '微信想问你在哪里。' },
      { text: '点允许，微信就能知道你在哪。', plain: '点允许，它就知道你在哪。' },
      { text: '不想给它知道，就点不允许。', plain: '不想给，就点不允许。' },
      { text: '不影响你给家人发消息。', plain: '不给位置，也能正常发消息。' },
    ],
    summary: ['微信想问你在哪里。', '不想给，就点不允许。', '不影响发消息。'],
    note: '实验版自带示例，用来看懂电脑和手机上的提示框。',
  },
];

export const articleById = new Map(articles.map((article) => [article.id, article]));
