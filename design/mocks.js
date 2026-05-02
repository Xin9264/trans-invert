/* Mock data + helpers shared by all pages */

const MOCK_FOLDERS = [
  { id: 'f-econ',  name: 'The Economist', count: 8 },
  { id: 'f-acad',  name: 'Academic Writing', count: 5,
    children: [
      { id: 'f-acad-essay', name: 'Argumentative Essays', count: 3 },
      { id: 'f-acad-abs',   name: 'Abstracts', count: 2 },
    ]
  },
  { id: 'f-lit',   name: 'Literature', count: 4 },
  { id: 'f-tech',  name: 'Tech Reading', count: 6 },
  { id: 'f-daily', name: 'Daily Drills', count: 12 },
];

const MOCK_TEXTS = [
  {
    id: 't1', folder_id: 'f-econ', num: '001',
    title: 'Why central banks misjudge inflation cycles',
    preview: 'Central banks have repeatedly underestimated the persistence of inflation, partly because their forecasting models lean too heavily on the assumption that expectations remain anchored…',
    difficulty: 4, wordCount: 412, lastOpened: '2026-04-29', score: 86, attempts: 3,
  },
  {
    id: 't2', folder_id: 'f-acad-essay', num: '002',
    title: 'On the social consequences of generative AI',
    preview: 'Whether generative systems amplify or attenuate inequality depends less on the technology itself than on the institutional scaffolding into which it is introduced…',
    difficulty: 5, wordCount: 598, lastOpened: '2026-04-30', score: 78, attempts: 2,
  },
  {
    id: 't3', folder_id: 'f-lit', num: '003',
    title: 'Excerpt — Mrs Dalloway, opening paragraph',
    preview: 'Mrs Dalloway said she would buy the flowers herself. For Lucy had her work cut out for her. The doors would be taken off their hinges; Rumpelmayer’s men were coming…',
    difficulty: 3, wordCount: 187, lastOpened: '2026-04-22', score: 91, attempts: 5,
  },
  {
    id: 't4', folder_id: 'f-tech', num: '004',
    title: 'Designing diff-based code review for monorepos',
    preview: 'A diff is a poor unit of meaning. The smallest unit a reviewer can reason about is rarely the line, often the function, and sometimes the entire change set…',
    difficulty: 4, wordCount: 356, lastOpened: '2026-04-27', score: 72, attempts: 1,
  },
  {
    id: 't5', folder_id: 'f-daily', num: '005',
    title: 'A short note on autumn light in the cloister',
    preview: 'The cloister gathers the late afternoon as a cup gathers wine — slowly, carefully, allowing the gold of the hour to settle along its edges…',
    difficulty: 2, wordCount: 142, lastOpened: '2026-04-31', score: 88, attempts: 4,
  },
  {
    id: 't6', folder_id: 'f-econ', num: '006',
    title: 'The quiet retreat of the global supply chain',
    preview: 'For three decades the world stitched itself together with containers; the unstitching, when it comes, will not be loud, but it will be expensive…',
    difficulty: 4, wordCount: 478, lastOpened: '2026-04-19', score: 81, attempts: 2,
  },
];

const MOCK_HISTORY = [
  { id:'h1', dateISO:'2026-05-02T08:42', title:'Why central banks misjudge inflation cycles', score:86, words:412, ok:true,
    preview:'…the persistence of inflation has surprised forecasters whose models presume well-anchored expectations.',
    feedback:'Strong control of subordinate clauses. Watch the article use before "expectations"; consider tightening the second sentence.' },
  { id:'h2', dateISO:'2026-05-01T22:17', title:'On the social consequences of generative AI', score:78, words:598, ok:true,
    preview:'Whether such systems widen or narrow inequality depends, I argue, on the institutions that surround them, not on the technology itself.',
    feedback:'Argument is clear. Some collocations drift — prefer "amplify inequality" to "make inequality bigger".' },
  { id:'h3', dateISO:'2026-04-30T19:03', title:'A short note on autumn light in the cloister', score:91, words:142, ok:true,
    preview:'The cloister collected the late afternoon the way a cup gathers wine, slowly and with care.',
    feedback:'Lovely rhythm. The metaphor lands; consider varying sentence length once more in the final clause.' },
  { id:'h4', dateISO:'2026-04-29T11:24', title:'Designing diff-based code review for monorepos', score:72, words:356, ok:false,
    preview:'A diff is not a useful unit of meaning. The smallest reviewable unit is rarely a line.',
    feedback:'Tense slips between past and present. Lock to one and reread aloud.' },
  { id:'h5', dateISO:'2026-04-28T08:15', title:'The quiet retreat of the global supply chain', score:81, words:478, ok:true,
    preview:'After thirty years of stitching, the unstitching of the global supply chain will be quiet but costly.',
    feedback:'Good register. Two prepositions could be tightened; otherwise excellent flow.' },
  { id:'h6', dateISO:'2026-04-27T17:48', title:'Excerpt — Mrs Dalloway, opening paragraph', score:88, words:187, ok:true,
    preview:'Mrs Dalloway said she would buy the flowers herself, for Lucy had her work cut out for her.',
    feedback:'Punctuation faithful to the source. Watch the comma before "for".' },
  { id:'h7', dateISO:'2026-04-26T09:02', title:'On the moral imagination of cities', score:64, words:520, ok:false,
    preview:'A city worth the name asks more of its inhabitants than mere cohabitation.',
    feedback:'Vocabulary range is narrower than the source. Try a few collocations from the difficult-words list.' },
];

// Practice mock — passage, sentence pairs, difficult words, AI feedback
const MOCK_PASSAGE = {
  id: 't1',
  title: 'Why central banks misjudge inflation cycles',
  difficulty: 4,
  wordCount: 412,
  lastOpened: '2026-04-29',
  source:
`Central banks have repeatedly underestimated the persistence of inflation. Their forecasting models lean too heavily on the assumption that expectations remain anchored, and that the public, taken as a whole, will eventually treat any disturbance as transitory.
But expectations are not weights on a balance sheet. They are sentiments, half-rational and easily disturbed, propagating through wages, prices, and the small private decisions households make when they reach for a basket of groceries.
The result is a peculiar asymmetry: when prices begin to rise, models capture only the visible portion of the wave; the undertow — habit, anticipation, the cautious hoarding of dollar bills — is missed almost entirely.`,
  zh:
`各国央行屡次低估通胀的顽固性。他们的预测模型过度依赖一个假设：预期会保持锚定，公众整体最终会把任何扰动视为暂时现象。
然而，预期并非资产负债表上的砝码。它们是半理性的情绪，极易被搅动，沿着工资、物价以及家庭面对一篮子日用品时所作的细微私人决定，向四面扩散。
结果出现一种奇特的不对称：当物价开始上行，模型只捕捉到表层的浪花；底下的暗流——习惯、预期、对手中每一张钞票的谨慎囤积——几乎被完全忽略。`,
  pairs: [
    { zh: '各国央行屡次低估通胀的顽固性。', en: 'Central banks have repeatedly underestimated the persistence of inflation.' },
    { zh: '他们的预测模型过度依赖一个假设：预期会保持锚定，公众整体最终会把任何扰动视为暂时现象。', en: 'Their forecasting models lean too heavily on the assumption that expectations remain anchored, and that the public, taken as a whole, will eventually treat any disturbance as transitory.' },
    { zh: '然而，预期并非资产负债表上的砝码。', en: 'But expectations are not weights on a balance sheet.' },
    { zh: '它们是半理性的情绪，极易被搅动，沿着工资、物价以及家庭面对一篮子日用品时所作的细微私人决定，向四面扩散。', en: 'They are sentiments, half-rational and easily disturbed, propagating through wages, prices, and the small private decisions households make when they reach for a basket of groceries.' },
    { zh: '结果出现一种奇特的不对称：当物价开始上行，模型只捕捉到表层的浪花；底下的暗流——习惯、预期、对手中每一张钞票的谨慎囤积——几乎被完全忽略。', en: 'The result is a peculiar asymmetry: when prices begin to rise, models capture only the visible portion of the wave; the undertow — habit, anticipation, the cautious hoarding of dollar bills — is missed almost entirely.' },
  ],
  difficultWords: [
    { word: 'persistence',     meaning: 'n. 持续；顽固存在的性质' },
    { word: 'anchored',        meaning: 'adj.（预期）锚定的；稳定不动的' },
    { word: 'transitory',      meaning: 'adj. 暂时的；过渡性的' },
    { word: 'propagating',     meaning: 'v. 传播；蔓延（propagate 的现在分词）' },
    { word: 'asymmetry',       meaning: 'n. 不对称；不均衡' },
    { word: 'undertow',        meaning: 'n. 暗流；潜在的牵引力' },
    { word: 'hoarding',        meaning: 'n. 囤积；窖藏' },
  ],
  // simulated AI feedback (returned after the user submits)
  feedback: {
    score: 84,
    overall: 'Your translation captures the argument with confidence; the second paragraph in particular preserves the original’s rhythm. Two areas to tighten: collocations around economic vocabulary, and the handling of the dash-led aside in the final sentence.',
    corrections: [
      { from: 'underestimate the staying power', to: 'underestimate the persistence', why: '"persistence" is the standard register here; "staying power" reads more colloquial than the source.' },
      { from: 'anchored to it',                   to: 'remain anchored',                why: 'In monetary-policy English, "expectations remain anchored" is idiomatic and intransitive.' },
      { from: 'and the public will see',          to: 'and that the public will treat',  why: 'Maintain parallelism with the preceding "that"-clause; "treat … as" is the natural verb here.' },
    ]
  }
};

// AI status for sidebar
const AI_STATUS = { ok: true, provider: 'DeepSeek V3', model: 'deepseek-chat', requestsToday: 42 };

window.MOCKS = { MOCK_FOLDERS, MOCK_TEXTS, MOCK_HISTORY, MOCK_PASSAGE, AI_STATUS };
