# Design Reference

这个目录是 **视觉设计原型**,不是生产代码。来源是 `feat/trans-invert-ui` 分支的 Claude Design 设计稿。

## 怎么看

直接用浏览器打开 `Trans-invert UI.html` 即可,所有 React/Babel/CSS 全部走 CDN,无需安装依赖、无需启动后端。

页面右下角有一个 **Tweaks 面板**,可以实时切换:
- 视觉方向:`paper` / `manuscript` / `print`
- 主题:`light` / `dark`
- 字体族:`serif` / `sans` / `mono`
- 字号 / 行高
- 强调色:`amber` / `indigo` / `ink` / `sage`

## 文件清单

| 文件 | 说明 |
|------|------|
| `Trans-invert UI.html` | 入口,加载所有 jsx 与 styles.css |
| `styles.css` | 1398 行手写 CSS,包含主题变量、布局、组件 |
| `mocks.js` | 假数据(folders / texts / history / passage / AI status) |
| `icons.jsx` | inline SVG 图标库(lucide 风格) |
| `layout.jsx` | Sidebar(文件夹树)+ Topbar(面包屑 + ⌘K 搜索) |
| `page-home.jsx` | 首页:Hero + Method strip + 材料网格(卡片/列表切换) |
| `page-history.jsx` | 历史页:Sparkline 趋势 + 时间线 + 过滤段控件 |
| `page-practice.jsx` | 练习页:3 种对照视图(双栏 / 句对 / 浮层) + 打字机结果页 |
| `tweaks-panel.jsx` | 右下浮动调试面板,运行时切换主题 |
| `scraps/` | 设计草图原始文件(.napkin) |

## 与生产代码的差距

- 设计稿用原生 React UMD + Babel standalone + 手写 CSS;生产代码是 Vite + Tailwind + react-router
- 设计稿走 `window.MOCKS`;生产代码走真实 API(`frontend/src/utils/api.ts`)
- 设计稿的 Sidebar / Topbar / 主题变量 / 3 种对照视图,生产代码当前都没有

## 落地建议

不要一次性替换。按这个顺序增量迁:

1. 把 `styles.css` 里 `:root` 的 CSS 变量挑出来,作为 design tokens 接进 Tailwind / `frontend/src/styles/index.css`
2. 重构 `Layout.tsx`:nav 改成 Sidebar + Topbar
3. `Home.tsx`:加 Hero + Method strip,卡片样式向设计稿对齐
4. `History.tsx`:加 Sparkline 与时间线布局
5. `Practice.tsx`:加 3 种对照视图与打字机结果
6. 收尾:icons 改用 lucide-react、字体接 Google Fonts、运行时主题切换(可选)
