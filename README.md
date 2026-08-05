# Font Enhancement (Roboto Flex & Segoe UI Variable)

一个 Violentmonkey / Tampermonkey 用户脚本:在任意网站上,把常用西文字体替换为显示效果更好的可变字体,并为缺失中文字体支持的网站自动追加思源黑体 fallback。

- **@namespace** `rayy.font-enhance`
- **@match** `http://*/*` `https://*/*`
- **@run-at** `document-start`
- **@grant** `none`(无任何特权 API)

---

## 功能

### 1. Roboto → Roboto Flex

| 原字体栈 | 替换结果 |
|---|---|
| `Roboto, sans-serif` | `"Roboto Flex", Roboto, sans-serif` |
| `"Roboto", "Noto Sans SC", ...` | `"Roboto Flex", Roboto, "Noto Sans SC", ...` |
| `sans-serif` | `"Roboto Flex", sans-serif` |
| `sans-serif, Arial` | `"Roboto Flex", Arial` |
| `"YouTube Noto", Roboto, Arial, ...`(播放器/字幕) | `"YouTube Noto", "Roboto Flex", Roboto, Arial, ...` |

- 只处理**栈首**为 Roboto、裸 `sans-serif` 或 `YouTube Noto` 的情况;`Inter, Roboto, sans-serif` 这类**显式字体选择被尊重**,不替换。
- YouTube 播放器(含**字幕**,字幕继承播放器字体栈)的栈首是 `YouTube Noto`。Roboto Flex 插入到 **Roboto 前面**(取代其 fallback 角色):`YouTube Noto` 保持最高优先级(它是 YouTube 私有加载的字体,未来若获得完整字形会自动优先),Roboto Flex 承接原本落到 Roboto 的文字,Roboto/Arial 继续作兜底。
- 原 Roboto 保留在第二位作 fallback,网络/字体加载失败也不丢原字体。
- 本机已安装 Roboto Flex 时**零网络请求**;未安装则自动从 Google Fonts 懒加载。

### 2. Inter → Inter Display(≥ 24px)

| 场景 | 结果 |
|---|---|
| `Inter, sans-serif`(14px) | 不动(尊重站点) |
| `Inter, sans-serif`(28px) | `"Inter Display", Inter, sans-serif` |

- 阈值 `INTER_DISPLAY_THRESHOLD_PX = 24`(微软 type ramp 中 Display 档起点),可配置。
- 栈中所有 Inter 命中项都会替换(不限位置);`Inter Tight` 等变体不碰。
- 本机已安装 Inter Display,同样零网络请求。

### 3. Segoe UI → Segoe UI Variable(Windows 11)

| 原字体 | 结果 |
|---|---|
| `Segoe UI` | `"Segoe UI Variable Text"`(或 Display) |
| `Segoe UI Light` | `"Segoe UI Variable Text"` + `font-weight: 300` |
| `Segoe UI Semilight` | + `font-weight: 350` |
| `Segoe UI Semibold` | + `font-weight: 600` |
| `Segoe UI Bold` | + `font-weight: 700` |
| `Segoe UI Black` | **不替换**(可变字体 wght 上限 700,保留静态字体) |
| `Segoe UI Variable`(裸名) | 自动修正为 Text/Display 实例名 |

- **字号分流**:≥ `SEGOE_DISPLAY_THRESHOLD_PX`(20px)用 `Segoe UI Variable Display`,否则 `Text`,与 Windows type ramp 一致。
- **运行时探测**:`Segoe UI Variable Display` 在 Firefox(DirectWrite)中不可解析(实测会静默 fallback 到 Segoe UI),脚本用 `document.fonts.check()` 探测当前浏览器,不可用时大字号自动回退 Text。
- 原字体保留为 fallback。

### 4. CJK fallback(中文字体兜底)

所有**不含中文字体**的 font stack 末尾追加:

```
"Noto Sans SC", "Source Han Sans SC"
```

- 已含雅黑 / 苹方 / 思源 / Noto / 宋体 等中文字体的栈**不追加**,尊重站点选择。
- 按用户偏好追加在**栈尾**;注意:含 `sans-serif` 等 generic 的栈,浏览器自己的回退序列(Windows 上中文即雅黑)会优先,末尾字体可能轮不到;无 generic 的栈一定生效。
- 字体名在 `CJK_FALLBACK_FAMILIES` 中可改。

---

## 安装 / 更新

1. Firefox / Chrome 安装 [Violentmonkey](https://violentmonkey.pro/) 扩展。
2. 将 `Font Enhancement (Roboto Flex & Segoe UI Variable).user.js` 拖入浏览器窗口,确认安装。
3. 更新时直接重新拖入同名文件,版本号更高会自动覆盖;建议先删除旧版避免重复替换。

## 配置(脚本头部)

```js
const ENABLED = {
    robotoFlex: true,     // Roboto → Roboto Flex
    interDisplay: true,   // Inter → Inter Display (≥24px)
    segoeVariable: true,  // Segoe UI → Segoe UI Variable
    cjkFallback: true     // 追加 Noto Sans SC / Source Han Sans SC
};

const SEGOE_DISPLAY_THRESHOLD_PX = 20;   // Segoe Text/Display 分流点
const INTER_DISPLAY_THRESHOLD_PX = 24;   // Inter Display 触发字号
const CJK_FALLBACK_FAMILIES = ['"Noto Sans SC"', '"Source Han Sans SC"'];
```

## 排除区域

以下区域**不会被修改**:

- 代码:`code` `pre` `kbd` `samp` `var`、`script` `style` `template` `noscript`
- 编辑器:`.CodeMirror` `.cm-editor` `.monaco-editor` `.ace_editor`
- 代码高亮:`.highlight` `.hljs` `.prism`
- 数学:`.katex` `math` `mjx-container` `.MathJax`
- SVG / 图表:`svg` `canvas` `.recharts-wrapper` `.echarts-for-react` `.highcharts-container` `.plotly` `.vega-embed` `.mermaid`
- 图标字体:`.material-icons` `.material-symbols-*` `.fa` `.fas` `.far` `.fal` `.fab`
- 可编辑区域:`contenteditable`
- **手动排除**:给任意元素加属性 `data-no-roboto-flex` 或 `data-no-segoe-variable`,其子树整体跳过。

## 工作原理(简述)

1. `document-start` 注入;`DOMContentLoaded` 时用显式栈遍历(剪枝排除区、跟随 open shadow root)找出所有含文本的元素,每个元素只读一次 `getComputedStyle`。
2. 字体栈字符串 → 转换结果的 `Map` 缓存(FIFO 256 条),同栈同字号只解析一次。
3. `MutationObserver` 监听 `childList` + `characterData` + `class/style` 变化,**微任务**批处理 + 去重叠(渲染前完成替换,动态元素如 YouTube 字幕首帧即正确字体、无闪烁);观察 `document` 级别,`<body>` 被替换也不失效。
4. 3s / 8s 各一次幂等延迟重扫,兜底晚渲染页面(SPA / Firefox + ShadyDOM 漏批次场景)。
5. 表单控件(`input` / `textarea` / `select`)特殊处理——其文本(含 **placeholder**)不是 DOM 文本节点,控件自身会被评估,并注入 `[data-fen-processed]::placeholder { font-family: inherit !important; }` 让 placeholder 跟随控件字体。

## 已知限制

- **内联 `!important` 冻结**:被处理的元素,站点之后用普通样式改字体是改不动的(脚本的强制契约)。
- **iframe**:userscript 默认不注入 iframe 内容。
- **closed shadow DOM**:无法访问,不覆盖。
- **`::before` / `::after` 伪元素文本**:不直接处理,跟随宿主元素字体。
- **Segoe UI Variable** 仅在 Windows 11 存在;Windows 10 上替换后自然 fallback 回 Segoe UI。

## 版本历史

| 版本 | 内容 |
|---|---|
| 1.0.0 | 合并 Roboto Flex 与 Segoe UI Variable 两个脚本为单脚本(一次扫描、一个 observer、字符串缓存) |
| 1.1.0 | Segoe 字号分流:≥20px 用 Variable Display;修复 Display 名在 Firefox 无效的 regression(运行时探测回退 Text) |
| 1.2.0 | 新增 Inter → Inter Display(≥24px);字体加载重构为配置数组(本机已装则零请求) |
| 1.2.1 | `Segoe UI Variable Display` 运行时 `document.fonts.check()` 探测,不可用回退 Text |
| 1.3.0 | 新增 CJK fallback(Noto Sans SC / Source Han Sans SC) |
| 1.3.1 | CJK fallback 改为追加到栈尾(用户偏好) |
| 1.3.2 | 修复 placeholder / 表单控件文本未替换(input/textarea/select 特殊处理) |
| 1.3.3 | 3s/8s 幂等延迟重扫,兜底晚渲染与 observer 漏批次(YouTube subscribe 按钮场景) |
| 1.3.4 | YouTube 播放器/字幕栈(`YouTube Noto` 开头)支持,字幕字体同步替换 |
| 1.3.5 | YouTube 栈中 Roboto Flex 改为插到 Roboto 前面(不抢 `YouTube Noto` 优先级) |
| 1.3.6 | observer 批处理 rAF 改为微任务:动态元素(YouTube 字幕)首帧即用替换后字体,消除闪烁 |

## 开发 / 测试

```bash
# 语法检查
node --check "Font Enhancement (Roboto Flex & Segoe UI Variable).user.js"

# jsdom 集成测试(覆盖各转换、权重、字号分流、剪枝、动态插入、稳定性)
npm install jsdom
node test/vm_tests.js
```
