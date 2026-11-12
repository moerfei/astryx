---
description: 用 Astryx 设计系统构建或改造界面：先查权威组件 API，再套模板实现，交付前跑诊断与构建
argument-hint: "<界面需求，如：给设置页加一个删除账号的破坏性按钮，异步删除时显示加载态>"
---

加载 `astryx` 技能（本插件 `skills/astryx`），按它的规则完成：$ARGUMENTS

优先使用 astryx MCP 工具，不要凭记忆写组件 API：

1. **定性**：新建页面用 `astryx_build` 取模板建议；改现有组件用 `astryx_search` 定位。
2. **取权威文档**：`astryx_component` 读 props/变体/导入路径，`astryx_docs` 读主题、token、迁移等主题。
3. **实现**：遵循技能里的构建约定——子路径导入、token 替代裸色值、优先行为 props、自写键盘处理需过 IME。
4. **交付前**：`astryx_doctor` + 项目构建/类型检查，报告真实输出；改的是既有界面时按 `astryx docs is-my-code-good` 自查。

MCP 不可用时回退到 `astryx` CLI：项目内用本地版本；项目外用 `npx @astryxdesign/cli@0.7.14`。绝不裸跑 `npx astryx`。
