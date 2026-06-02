# Product

## Register

product

## Users

个人用户（开发者自己）。使用场景：
- 在手机上通过 iOS 快捷指令（双击手机背面）截图翻译屏幕内容
- 在手机或桌面端回顾翻译历史、查看词汇和语法笔记
- 核心诉求：快速翻译 + 持续积累语言知识

## Product Purpose

基于 iOS 快捷指令和火山引擎图片翻译 API 的屏幕翻译工具。解决的核心问题：
1. 在任意 App 内即时翻译屏幕内容（无需切换 App）
2. 翻译结果持久化保存，可随时回顾
3. AI 自动提取生词和语法点，将翻译行为转化为语言学习

## Brand Personality

简洁专业。干净、专注、高效。像一个安静的工具——不喧宾夺主，内容优先，UI 只是框架。

- 情绪目标：让人感到可靠、清晰、不费脑
- 更像 Notion / Linear 的工具感，而非 Duolingo 的活泼感
- 不需要" delight "式的趣味点缀，品质来自克制

## Anti-references

- 花哨 SaaS landing page 风格：大渐变背景、hero metrics、gradient text、装饰性的 glassmorphism
- 过度圆角（卡片 >16px border-radius）
- 多余动画和装饰元素
- Google Material Design 的浮夸阴影层级

## Design Principles

1. **内容优先** — 翻译图片和文本是核心，UI 只是安静的容器
2. **移动优先** — 主要在手机上使用，触控友好（≥44px），桌面端作为增强
3. **安静高效** — 每个元素都有存在的理由，去掉一切装饰性的东西
4. **一致性** — Web 和移动端体验统一，不因屏幕尺寸而妥协功能

## Accessibility & Inclusion

- WCAG 2.1 AA 基准
- 移动端触控目标 ≥44px（已实现）
- iOS 输入框防缩放（font-size: 16px，已实现）
- 支持系统 reduced motion
