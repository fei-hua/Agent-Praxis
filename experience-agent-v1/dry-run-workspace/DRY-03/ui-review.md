# DRY-03 UI/UX 审查报告

> 审查对象：`dry-run-workspace/DRY-03/ui.css`
> 审查范围：布局、视觉层级、间距一致性、交互、UI 越界风险
> 审查方：ui-reviewer subagent（只读审查，未修改任何文件）
> 前置约束：仅允许调整 margin/padding 的 px 值至 8 的倍数，类名与选择器结构不得修改。
> 说明：ui-reviewer 读取文件时升级尚未落盘（读到的是原始种子值），其审查基于升级目标值与原始值的对比。

## 升级映射（8pt 吸附）

| 选择器 | 升级前 | 升级后（已落盘） | 映射 |
| --- | --- | --- | --- |
| `.card` | `margin: 5px; padding: 7px;` | `margin: 8px; padding: 8px;` | 5→8、7→8 |
| `.button` | `margin: 13px 3px; padding: 21px 9px;` | `margin: 16px 8px; padding: 24px 8px;` | 13→16、3→8、21→24、9→8 |
| `.nav` | `margin: 2px; padding: 11px 15px;` | `margin: 8px; padding: 8px 16px;` | 2→8、11→8、15→16 |

升级后 12 个间距值全部为 8 的倍数（8/16/24），选择器与类名零改动。

## 布局审查

- 三个选择器构成小组件集（`.card` 容器、`.button` 可点击控件、`.nav` 导航条），职责未彻底分离，同为块级盒子。
- `.button` 的 `padding: 24px 8px` 是三者中唯一的纵向大内边距，方向正确（按钮需要高命中区）。
- `.nav` 的 `padding: 8px 16px`（横纵不对称）与 `.card` 的 8px 全对称形成两套节奏，建议明确"容器 = 全对称、条状 = 横向加倍"的规则。
- 关键缺失：无 `box-sizing: border-box`、无 `display`/`width` 规则，所有尺寸纯内容驱动，宽度不确定。

## 视觉层级审查

- 层级仍可辨：`card(8) < nav(8/16) < button(16/24)`，三层递进保留。
- 原种子中 `.card` margin 5 与 `.nav` margin 2 的 3px 差异吸附后归零（8 = 8），卡片与导航条的外间距完全同质，页面上的分组暗示丢失。
- `.button` 横向 margin 3→8 使按钮横排明显变疏。
- 层级几乎全由 padding 承担，紧邻排列时各组件"呼吸感"一致，需靠字号/边框/阴影另行区分。

## 间距一致性审查

- 双轴策略并存：`.button`（纵向 24 / 横向 8）与 `.nav`（纵向 8 / 横向 16）均为纵向小横向大或反之，而 `.card` 双轴相等——出现三种轴策略。
- 横向序列 8 / 8 / 16 与纵向 8 / 24 / 8 无共同节拍，无法用单一 spacing token 推导。
- 数值全部合规（皆为 8 的倍数，且无 0 < v < 4 需上取的情况），问题在语义一致性而非合规性。

## 交互审查

- 命中区：`.button` 仅靠 padding 撑开，无 `min-height`/`min-width`。横向 padding 8px 时约 44×40px，逼近但未稳定达到 44×44 触控标准。
- 状态反馈完全缺失：无 `:hover`、`:active`、`:focus-visible`、`:disabled`，无 `transition`，无 `cursor: pointer`。
- 无 `outline` 处理，键盘聚焦依赖 UA 默认，可能在自定义背景上不可见。

## UI 越界风险

- **风险：`.button` 横向 padding 仅 8px，长标签在窄容器内撑破父级或换行导致按钮高度跳变。** 触发条件：文案如"确认并继续提交"（约 84px）且视口 < 360px 或父容器定宽时。建议修复：在不改选择器结构的前提下为 `.button` 追加 `min-width: 88px`、`white-space: nowrap`、`box-sizing: border-box`。
- **风险：`.button` 命中区不足 44×44 的无障碍最小尺寸。** 触发条件：纵向总高约 40px（24px padding + 单行文字），触屏或运动能力受限用户操作时误触率上升。建议修复：为 `.button` 增加 `min-height: 48px`（8 的倍数）。
- **风险：`.nav` 无 `flex-wrap` 且 padding 收窄内容区，窄视口下导航项横向溢出或逐字换行撑高导航条。** 触发条件：视口 < 480px 或导航项增多时，出现文本截断、横向滚动条或高度突增，并与下方 `.card` 外间距叠加产生意外间隙。建议修复：`.nav` 设 `display: flex; flex-wrap: wrap; gap: 8px`，并避免依赖 margin 折叠。
- **风险：margin + padding 叠加且无 `box-sizing: border-box`，百分比宽度下产生横向溢出。** 触发条件：`.card` 在 `width: 100%` 或百分比宽度时左右各溢出 16px（margin 8 + padding 8），共 32px，触发水平滚动条。建议修复：全局设置 `box-sizing: border-box`。
- **风险：缺失 hover/active/focus-visible/disabled 与 `cursor: pointer`，用户无法判断可点击性且禁用态不可区分。** 触发条件：鼠标悬停与键盘 Tab 导航时无任何视觉反馈。建议修复：为 `.button` 追加状态伪类与 `cursor` 规则（仅追加伪类，类名与选择器结构不变）。

## 结论

- 8pt 数值合规性：**通过**。全部 margin/padding 为 8 的倍数，选择器与类名未改动，布局结构保持。
- 视觉层级：三层递进保留，但 `.card` 与 `.nav` 的外间距差异被吸附抹平，分组暗示丢失；层级现由 padding 单独承担。
- 间距语义：数值合规但缺少统一节拍与统一轴策略，建议收敛为单一 spacing token。
- 遗留问题（本次受"不改选择器结构"约束未处理，建议后续迭代）：缺 `box-sizing: border-box`、缺最小命中区（44×44 / min-height）、缺状态伪类与 `cursor`、缺导航换行策略。
