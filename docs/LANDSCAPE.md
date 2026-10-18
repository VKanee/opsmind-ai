# Landscape Review

The project direction was informed by the strengths and product boundaries of
several open-source systems reviewed on 2026-10-18.

| Project | Primary strength | Pattern used in OpsMind design |
| --- | --- | --- |
| [OpenSRE](https://github.com/Tracer-Cloud/opensre) | SRE agents and alert integrations | investigation as a multi-step operational workflow |
| [Aurora](https://github.com/Arvo-AI/aurora) | agentic incident management and RCA | explicit hypotheses and provider integrations |
| [Langfuse](https://github.com/langfuse/langfuse) | LLM tracing and evaluation | model metadata and evaluation as a first-class concern |
| [MaxKB](https://github.com/1Panel-dev/MaxKB) | enterprise RAG and agent platform | versioned knowledge sources and retrieval separation |
| [Bisheng](https://github.com/dataelement/bisheng) | enterprise LLM operations | evaluation, observability, and governance in one platform |

OpsMind AI is not a fork of these projects and does not copy their source code.
It is an independent product implementation centered on the incident commander's
workflow: evidence -> hypothesis -> controlled action -> human decision ->
audit.

## Differentiation

The combination below is the intended product position:

- incident-native rather than a generic chatbot;
- evidence citations in every investigation;
- deterministic approval policy outside the model;
- append-only audit across AI and human actions;
- a deterministic offline evaluation suite;
- a useful local demo without a paid model API key;
- an explicit simulation boundary before infrastructure execution.
