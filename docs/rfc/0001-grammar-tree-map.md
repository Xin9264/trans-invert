# RFC 0001 — 语法树状地图（Grammar Tree Map）

| 字段       | 内容                                            |
| ---------- | ----------------------------------------------- |
| 状态       | Accepted                                        |
| 作者       | wangxin                                         |
| 创建日期   | 2026-05-02                                      |
| 影响模块   | backend (新 router + service)、frontend (新 page) |
| 依赖前置   | 已完成的结构化错误标签（`Correction.category/severity/source`） |
| 不兼容老数据 | 是（项目数据全部为测试数据，无需回填）            |

---

## 1. 背景与动机

当前 `evaluate_answer.j2` 已经会让 AI 在每次评估时输出结构化错误：

- `category`：23 个受控词表项，分四大类（grammar.* / lexis.* / discourse.* / mechanics.*）
- `severity`：minor / major / critical
- `source`：L1_transfer / overgeneralization / intralingual / performance_slip（Corder 1967 分类）

这些数据现在**只用于一次性展示**：评估完成后渲染在 Practice 页面下方，然后随历史记录沉到 SQLite，再没有第二次出口。

学习者真正需要的是一个**纵向视图**：练了 N 篇之后，回答「我哪里弱」「最近哪类错变多了」「哪些点已经稳定不犯了」。这正是「语法地图」要解决的问题。

本 RFC 设计一个**树状语法地图**：

- **横向**：英语语法体系的客观结构（写死 syllabus）
- **纵向**：用户错误数据按节点聚合，形成动态掌握度
- **交互**：树状可折叠展开，节点颜色反映掌握度，点击节点展示具体错误样例

---

## 2. 目标与非目标

### 2.1 目标

1. 用户能在一个页面看到自己所有错误按语法体系分类的全貌。
2. 节点颜色一眼区分掌握度（绿/黄/红/灰）。
3. 点击叶子节点能下钻到具体错误样例，带回原始练习记录链接。
4. 整个聚合过程**无需后台 worker**，请求时实时计算（数据量级最多几千条记录，SQLite 单次查询毫秒级）。
5. 对现有的评估、练习、历史模块**零侵入**——只新增 router 和前端 page。

### 2.2 非目标（Out of Scope）

- ❌ 老数据回填（项目明确无此需求）
- ❌ 力导向图 / 知识图谱 / 思维导图等其他可视化形态（本 RFC 只做树状）
- ❌ 间隔复习（SRS）调度——已有 `next_review_at`/`ease_factor` 字段，但与本 RFC 解耦
- ❌ 错误地图的 LLM agent 自动归类——评估时已经分类，不需要再跑一次
- ❌ 听力 / 语音 / YouTube 模块（独立 RFC）
- ❌ 多用户、权限、分享

---

## 3. 设计概览

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend: /grammar-map                                      │
│  ┌──────────────────────┐    ┌──────────────────────────┐   │
│  │  TreeView (左侧)      │ →  │  NodeDetail (右侧)         │   │
│  │  - 可折叠              │    │  - 错误样例列表             │   │
│  │  - 颜色编码            │    │  - 趋势小图                │   │
│  │  - 计数 badge          │    │  - 跳转练习记录链接          │   │
│  └──────────────────────┘    └──────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────┘
                              │ GET /api/grammar-map
                              │ GET /api/grammar-map/nodes/{id}/examples
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: app/routers/grammar_map.py                         │
│   ├─ syllabus.py         (静态体系树定义)                     │
│   └─ grammar_map_service (聚合逻辑)                           │
│                              │                               │
│                              ▼                               │
│  Data sources (read-only):                                   │
│   - practice_history (in-memory + SQLite)                    │
│   - 每条记录的 ai_evaluation.corrections[]                    │
└─────────────────────────────────────────────────────────────┘
```

**核心思路：双层数据模型**

1. **Syllabus（体系层，静态）**：英语语法的客观结构，写死在代码里。这是树的"骨架"。
2. **MasteryStats（掌握度层，动态）**：从 `practice_history` 聚合出每个 syllabus 节点的统计。这是树的"血肉"。

两层在 API 响应里合并成一棵带统计的树返回给前端。

---

## 4. 数据模型

### 4.1 Syllabus（语法体系树，静态）

新增文件：`backend/app/data/grammar_syllabus.py`

```python
# 树节点：每一项要么是叶子（带 leaf_categories），要么是分支（带 children）
SYLLABUS_TREE: SyllabusNode = {
    "id": "root",
    "label": "English Grammar",
    "children": [
        {
            "id": "grammar",
            "label": "语法",
            "children": [
                {
                    "id": "grammar.morphology",
                    "label": "形态",
                    "children": [
                        {
                            "id": "grammar.article",
                            "label": "冠词",
                            "leaf_categories": ["grammar.article"],
                            "tip": "中文无冠词，最易遗漏 a/an/the",
                        },
                        {
                            "id": "grammar.number",
                            "label": "单复数",
                            "leaf_categories": ["grammar.number"],
                        },
                        {
                            "id": "grammar.agreement",
                            "label": "主谓一致",
                            "leaf_categories": ["grammar.agreement"],
                        },
                    ],
                },
                {
                    "id": "grammar.tense_aspect",
                    "label": "时态与体",
                    "children": [
                        {
                            "id": "grammar.tense",
                            "label": "时态",
                            "leaf_categories": ["grammar.tense"],
                        },
                        {
                            "id": "grammar.aspect",
                            "label": "体（进行/完成）",
                            "leaf_categories": ["grammar.aspect"],
                        },
                    ],
                },
                {
                    "id": "grammar.syntax",
                    "label": "句法",
                    "children": [
                        {
                            "id": "grammar.voice",
                            "label": "语态",
                            "leaf_categories": ["grammar.voice"],
                        },
                        {
                            "id": "grammar.mood",
                            "label": "语气",
                            "leaf_categories": ["grammar.mood"],
                        },
                        {
                            "id": "grammar.preposition",
                            "label": "介词",
                            "leaf_categories": ["grammar.preposition"],
                        },
                        {
                            "id": "grammar.conjunction",
                            "label": "连词与从句",
                            "leaf_categories": ["grammar.conjunction"],
                        },
                        {
                            "id": "grammar.word_order",
                            "label": "语序",
                            "leaf_categories": ["grammar.word_order"],
                        },
                        {
                            "id": "grammar.nonfinite",
                            "label": "非谓语动词",
                            "leaf_categories": ["grammar.nonfinite"],
                        },
                    ],
                },
                {
                    "id": "grammar.other",
                    "label": "其他语法",
                    "leaf_categories": ["grammar.other"],
                },
            ],
        },
        {
            "id": "lexis",
            "label": "词汇",
            "children": [
                {"id": "lexis.word_choice", "label": "选词", "leaf_categories": ["lexis.word_choice"]},
                {"id": "lexis.collocation", "label": "搭配", "leaf_categories": ["lexis.collocation"]},
                {"id": "lexis.register", "label": "语域", "leaf_categories": ["lexis.register"]},
                {"id": "lexis.semantic_prosody", "label": "语义韵", "leaf_categories": ["lexis.semantic_prosody"]},
                {"id": "lexis.derivation", "label": "构词", "leaf_categories": ["lexis.derivation"]},
            ],
        },
        {
            "id": "discourse",
            "label": "篇章",
            "children": [
                {"id": "discourse.cohesion", "label": "衔接", "leaf_categories": ["discourse.cohesion"]},
                {"id": "discourse.information_structure", "label": "信息结构", "leaf_categories": ["discourse.information_structure"]},
                {"id": "discourse.reference", "label": "指代照应", "leaf_categories": ["discourse.reference"]},
            ],
        },
        {
            "id": "mechanics",
            "label": "书写规范",
            "children": [
                {"id": "mechanics.spelling", "label": "拼写", "leaf_categories": ["mechanics.spelling"]},
                {"id": "mechanics.punctuation", "label": "标点", "leaf_categories": ["mechanics.punctuation"]},
                {"id": "mechanics.capitalization", "label": "大小写", "leaf_categories": ["mechanics.capitalization"]},
            ],
        },
    ],
}
```

**约束：**

- 每个叶子节点必须带 `leaf_categories`，值是 `evaluate_answer.j2` 受控词表里的精确字符串。
- 每个 `evaluate` 受控词表项有且仅有一个叶子节点引用它（启动时校验）。
- 分支节点的统计 = 子树所有叶子统计的累加。

### 4.2 MasteryStats（节点掌握度，运行时算出）

```python
class NodeStats(BaseModel):
    node_id: str            # syllabus 节点 id
    error_count: int        # 该节点累计错误数（critical+major+minor 之和）
    by_severity: dict[str, int]  # {"critical": 2, "major": 5, "minor": 8}
    by_source:   dict[str, int]  # {"L1_transfer": 9, "overgeneralization": 1, ...}
    last_error_at: str | None    # ISO timestamp，最近一次出错
    trend_7d: int           # 近 7 天错误数
    trend_30d: int          # 近 30 天错误数
    mastery: Literal["unseen", "weak", "warning", "stable"]
```

**`mastery` 计算规则**（v1，简单可调）：

```
unseen   : error_count == 0 AND 该节点对应的 category 从未出现过任何 correction（包括正确的）
weak     : error_count >= 5  OR  by_severity["critical"] >= 2  OR  trend_7d >= 3
warning  : 1 <= error_count < 5
stable   : 该节点近 30 次相关练习均无错误（保留给 v2，v1 暂以 unseen/warning/weak 为主）
```

> 注：v1 的 mastery 是**纯频次**模型，没有掌握度衰减、没有间隔复习权重。够用，先发出去看效果。

### 4.3 API 响应类型

```python
class GrammarMapNode(BaseModel):
    id: str
    label: str
    tip: str | None = None
    leaf_categories: list[str] | None = None  # 叶子才有
    children: list["GrammarMapNode"] = []
    stats: NodeStats

class GrammarMapResponse(BaseModel):
    generated_at: str
    total_practices: int     # 参与聚合的练习总数
    total_errors: int
    tree: GrammarMapNode     # 根节点
```

---

## 5. 后端设计

### 5.1 文件结构

```
backend/app/
├── data/
│   └── grammar_syllabus.py        # 静态体系树
├── routers/
│   └── grammar_map.py             # GET /api/grammar-map, /nodes/{id}/examples
├── services/
│   └── grammar_map_service.py     # 聚合逻辑
└── schemas/
    └── grammar_map.py             # Pydantic 模型
```

### 5.2 路由

#### `GET /api/grammar-map`

**Query 参数：**

| 参数      | 类型    | 默认 | 说明                                                  |
| --------- | ------- | ---- | ----------------------------------------------------- |
| `since`   | str     | None | ISO timestamp，只统计该时间之后的练习                 |
| `until`   | str     | None | ISO timestamp，只统计该时间之前的练习                 |
| `folder_id` | str   | None | 仅统计该文件夹下的材料对应的练习（可选，便于按主题切片） |

**响应：** `APIResponse<GrammarMapResponse>`

**实现要点：**

- 直接读 `practice_history`（已经在内存中），不走 SQL。
- 单次遍历：对每条记录 → 对每个 `correction` → 找到对应叶子节点 → 累加。
- 累加完成后递归向上汇总到分支节点。

#### `GET /api/grammar-map/nodes/{node_id}/examples`

返回某节点（含子树）下的具体错误样例。

**Query 参数：**

| 参数      | 类型 | 默认 | 说明                |
| --------- | ---- | ---- | ------------------- |
| `limit`   | int  | 20   | 最多返回多少条样例   |
| `severity` | str | None | 过滤特定严重程度    |
| `source`  | str  | None | 过滤特定错误来源    |

**响应：**

```python
class ErrorExample(BaseModel):
    history_id: str           # PracticeHistoryRecord.id，前端可链接到详情
    timestamp: str
    text_title: str
    correction: Correction    # 复用现有 schema
    user_input_snippet: str   # 用户原句（截取 correction.original 前后 50 字）

class NodeExamplesResponse(BaseModel):
    node_id: str
    total: int
    examples: list[ErrorExample]
```

**排序：** 默认按 `timestamp DESC`（最近的错误排前面）。

### 5.3 聚合算法（伪代码）

```python
def build_grammar_map(history: list[PracticeHistoryRecord], since=None, until=None) -> GrammarMapResponse:
    # 1. 建立 category → 叶子节点 id 的反向索引
    category_to_leaf: dict[str, str] = {}
    for leaf in iter_leaves(SYLLABUS_TREE):
        for cat in leaf["leaf_categories"]:
            category_to_leaf[cat] = leaf["id"]

    # 2. 初始化每个节点的空 stats
    stats_map: dict[str, NodeStats] = {
        node["id"]: empty_stats(node["id"])
        for node in iter_nodes(SYLLABUS_TREE)
    }

    # 3. 单次遍历历史记录
    now = datetime.now()
    practice_count = 0
    error_count = 0
    for record in history:
        if since and record.timestamp < since: continue
        if until and record.timestamp > until: continue
        practice_count += 1

        for corr in record.ai_evaluation.get("corrections", []):
            cat = corr.get("category")
            leaf_id = category_to_leaf.get(cat)
            if not leaf_id:
                continue  # AI 偶发瞎写，归到 grammar.other 已由 normalize_corrections 处理
            error_count += 1
            stat = stats_map[leaf_id]
            stat.error_count += 1
            stat.by_severity[corr["severity"]] += 1
            stat.by_source[corr["source"]] += 1
            stat.last_error_at = max(stat.last_error_at, record.timestamp)
            if days_between(record.timestamp, now) <= 7:
                stat.trend_7d += 1
            if days_between(record.timestamp, now) <= 30:
                stat.trend_30d += 1

    # 4. 自底向上累加到分支节点
    rollup_stats(SYLLABUS_TREE, stats_map)

    # 5. 计算每个节点的 mastery 等级
    for stat in stats_map.values():
        stat.mastery = compute_mastery(stat)

    # 6. 用 stats 装饰静态树，返回
    return GrammarMapResponse(
        generated_at=now.isoformat(),
        total_practices=practice_count,
        total_errors=error_count,
        tree=decorate(SYLLABUS_TREE, stats_map),
    )
```

**复杂度：** O(N × M)，N = 历史记录数，M = 每条记录平均错误数（一般 < 10）。100 条记录的项目下，单次响应 < 5ms。

### 5.4 启动时校验

服务器启动时（`grammar_map_service` 模块导入时）做一次自检：

- 遍历 `SYLLABUS_TREE` 的所有叶子，收集 `leaf_categories`
- 与 `routers/texts.py` 里的 `ALLOWED_CATEGORIES` 比较
- 若有 category 没被任何叶子覆盖，或被多个叶子重复覆盖，**直接 raise 启动失败**

这是关键的一致性保证：词表升级时强制双方同步。

---

## 6. 前端设计

### 6.1 路由

新增 `frontend/src/pages/GrammarMap.tsx`，挂在 `/grammar-map`。在主导航加入口。

### 6.2 布局

桌面双栏，移动单栏（点节点切到详情视图）：

```
┌──────────────────────────────────────────────────────┐
│  [English Grammar]                                    │
│  ├─ 🟡 语法 (28)                                       │
│  │   ├─ 🔴 形态 (15)                                   │
│  │   │   ├─ 🔴 冠词 (12)        ← 选中                  │
│  │   │   ├─ 🟡 单复数 (3)                              │
│  │   │   └─ ⚪ 主谓一致 (0)                            │
│  │   ├─ 🟡 时态与体 (8)                                │
│  │   │   ├─ ...                                       │
│  │   └─ 🟢 句法 (5)                                    │
│  │       └─ ...                                       │
│  ├─ 🟡 词汇 (10)                                       │
│  ├─ 🟢 篇章 (2)                                        │
│  └─ ⚪ 书写规范 (0)                                    │
└──────────────────────────────────────────────────────┘
```

颜色：

| mastery | 颜色  | 含义                                    |
| ------- | ----- | --------------------------------------- |
| weak    | 🔴 红 | 频繁出错或有 critical                   |
| warning | 🟡 黄 | 偶尔出错                                |
| stable  | 🟢 绿 | 长期未犯（v2）                          |
| unseen  | ⚪ 灰 | 该范畴还没碰到（练习中没出现过相关错误） |

### 6.3 组件拆分

```
GrammarMap.tsx (page)
├── GrammarMapToolbar          时间范围筛选、文件夹过滤
├── GrammarTree                左侧树（可折叠、键盘导航）
│   └── GrammarTreeNode        单节点：缩进 + 颜色点 + label + count badge
└── NodeDetailPanel            右侧详情
    ├── NodeStatsCard          错误总数、severity 分布饼图、source 分布
    ├── TrendSparkline         近 30 天错误趋势小图
    └── ExampleList            错误样例列表，可链接到 History 详情
```

### 6.4 实现要点

- **不引第三方树库**：用纯 TSX + 递归组件 + Tailwind，避免 react-arborist / rc-tree 这种依赖。受控词表只有 23 项，树深度最多 4 层，自己写 < 100 行。
- **状态：** 选中节点 id 用 URL query (`?node=grammar.article`)，便于刷新和分享链接。
- **trend 小图：** 直接用 SVG `<polyline>`，不引 chart 库。
- **API 调用：** 复用 `src/utils/api.ts`，添加 `apiGrammarMap()` 和 `apiGrammarMapExamples(nodeId)`。
- **缓存：** 在 Zustand store 里缓存最近一次响应，5 分钟内复用；提交新练习后失效。

---

## 7. 实现步骤

按增量交付的顺序，每步可独立 PR：

1. **Schema + Syllabus 静态树**
   - `backend/app/schemas/grammar_map.py`
   - `backend/app/data/grammar_syllabus.py`
   - 启动校验：syllabus 叶子 vs `ALLOWED_CATEGORIES` 一致性
2. **聚合服务**
   - `backend/app/services/grammar_map_service.py` 实现 `build_grammar_map` 和 `get_node_examples`
   - 单元测试：构造 mock history → 验证统计正确性
3. **API 路由**
   - `backend/app/routers/grammar_map.py` 注册到 `main.py`
   - 手动用 `curl` / Swagger 验证
4. **前端页面骨架**
   - `GrammarMap.tsx` + 路由 + 主导航入口
   - `apiGrammarMap` / `apiGrammarMapExamples` in `api.ts`
5. **前端树组件**
   - `GrammarTree` + `GrammarTreeNode`，颜色 + 折叠
6. **前端详情面板**
   - `NodeDetailPanel` + `ExampleList` + 链接回 History
7. **趋势小图 + 工具栏**
   - `TrendSparkline` + 时间筛选

每一步完成后整个功能仍可工作，只是覆盖度递增。

---

## 8. 测试计划

### 8.1 后端

**`backend/tests/test_grammar_map_service.py`**（新建）：

- `test_syllabus_covers_all_categories` — 启动校验：每个 `ALLOWED_CATEGORIES` 项有且仅有一个叶子。
- `test_empty_history_returns_unseen_tree` — 没有练习时，所有节点 mastery=unseen，error_count=0。
- `test_single_correction_propagates_to_root` — 一条 grammar.article 错误 → 叶子 +1 → grammar.morphology +1 → grammar +1 → root +1。
- `test_severity_distribution` — 同一节点不同严重度的错误分别累计。
- `test_trend_window` — 8 天前的错误不计入 trend_7d，但计入 trend_30d。
- `test_mastery_thresholds` — 5 条错误 → weak；2 条 critical → weak；3 条 minor → warning。
- `test_node_examples_pagination_and_filter` — limit、severity 过滤生效。

### 8.2 前端

不写单元测试（项目当前没有前端测试基建），手动验收清单：

- [ ] 空历史时打开页面，整棵树灰色，无报错
- [ ] 提交 1 次有错的练习后回到地图，对应叶子和所有祖先节点变色
- [ ] 点击叶子节点，右侧出现样例
- [ ] 点击样例链接能跳到 History 对应记录
- [ ] 折叠/展开状态在切换节点后保持
- [ ] URL 带 `?node=xxx` 直接打开能定位

---

## 9. 风险与权衡

| 风险                                       | 影响                       | 应对                                                  |
| ------------------------------------------ | -------------------------- | ----------------------------------------------------- |
| AI 输出的 category 偶尔不在受控词表        | 错误归到 `grammar.other`，统计偏移 | 已由 `normalize_corrections` 兜底；启动校验保证 syllabus 端一致 |
| 受控词表未来扩充                           | 老的练习数据 category 不在树中 | 加新叶子时同步加 `leaf_categories`；启动校验会立即报错 |
| 内存历史与 SQLite 不同步                  | 实时聚合可能错过未保存的记录 | 已有 `save_data()` 在每次提交后调用；本 RFC 直接读内存即可 |
| 大量历史下递归遍历慢                      | 响应时间                   | 单用户场景 < 10000 条，10ms 内可解；真到瓶颈再加 LRU 缓存 |
| mastery 阈值不准                          | 颜色判断不直观             | v1 阈值简单透明，发完看实际数据再调；以后可做成可配置 |

---

## 10. 后续工作（不在本 RFC 范围）

记录但不实施：

- **R-002**：基于错误地图的 SRS——`weak` 节点优先排队复习，复用 `next_review_at` 字段
- **R-003**：错误样例的"对照练习"—— 从 `weak` 节点反向出题，让 AI 生成针对性的小段英文
- **R-004**：错误来源（source）单独视图 —— 把 `L1_transfer` 占比拉出来做一个"母语干扰画像"
- **R-005**：听力模块（YouTube 导入）—— 独立 RFC
- **R-006**：syllabus 节点对应学习资源链接（English Grammar in Use 章节、Cambridge Dictionary 词条）

---

## 11. 决策记录

- **为什么不做后台 worker？** 数据量级低，请求时实时算更简单、更新更及时、没有缓存一致性问题。
- **为什么不引 react-flow / d3？** 树状视图用纯递归 TSX 一百行就够；引图库只为这一个页面太重。
- **为什么 syllabus 写死在代码里而不是 JSON？** 写死在 Python 里能直接用 IDE 跳转 + 类型检查；改动频率低，不需要运行时配置。
- **为什么 v1 不做 stable（绿）状态？** stable 需要"该范畴长期无错"的判断，依赖于"练习中是否触发该范畴"这个隐含信号，比较复杂。先发 unseen/warning/weak 三态。

---

## 12. 评审记录

- 2026-05-02：syllabus 分组层级、mastery 阈值初始值、RFC 编号与目录约定（`docs/rfc/`）均已确认接受。明确不做"导出地图为图片"功能。
