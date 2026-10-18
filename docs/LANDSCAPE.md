# 同类项目调研

项目设计参考了以下开源产品的公开能力边界。OpsMind AI 没有 Fork 或复制它们的源代码，
而是围绕企业事故指挥流程独立实现。

| 项目 | 主要优势 | 对 OpsMind 的启发 |
| --- | --- | --- |
| [OpenSRE](https://github.com/Tracer-Cloud/opensre) | SRE Agent 和告警接入 | 将事故调查拆成多步骤工作流 |
| [Aurora](https://github.com/Arvo-AI/aurora) | Agentic 事故管理与 RCA | 显式故障假设和多数据源关联 |
| [Langfuse](https://github.com/langfuse/langfuse) | LLM 追踪与评测 | 模型元数据和评测优先 |
| [MaxKB](https://github.com/1Panel-dev/MaxKB) | 企业 RAG 平台 | 文档版本和检索分离 |
| [Bisheng](https://github.com/dataelement/bisheng) | 企业 LLM 运维平台 | 评测、观测和治理一体化 |

## 差异定位

OpsMind AI 的核心不是“通用 AI 应用搭建平台”，而是事故指挥工作台：

```text
事故 -> 证据 -> 故障假设 -> 受控处置 -> 人工审批 -> 审计
```

主要差异：

- 面向事故响应而不是通用聊天。
- AI 结论必须关联证据。
- 审批策略由后端确定性执行。
- 人工和 AI 操作都有审计记录。
- 具备离线可重复的评测集。
- 没有模型 API Key 也能演示完整流程。
- 在接入真实基础设施执行前保留清晰的模拟边界。
