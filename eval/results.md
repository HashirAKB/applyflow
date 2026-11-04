# Matching eval results

196 labelled form questions (178 answerable, 18 with no canonical question). Confidence threshold 0.75.

- Accuracy: top prediction equals the label (no prediction counts as "none").
- Precision at threshold: of the fields that would be filled automatically, the share mapped to the right question.
- Coverage: share of answerable questions filled automatically.
- Ask rate: share of all questions sent to the user.

The mock LLM is a deterministic concept lexicon, not a real model (see src/llm/mock.ts). Its row shows the pipeline handling LLM output, not real-model accuracy.

| Pipeline | Accuracy | Precision at threshold | Coverage | Ask rate |
| --- | --- | --- | --- | --- |
| Rules only | 90.8% | 99.4% | 90.4% | 17.3% |
| Rules + fuzzy | 85.2% | 99.4% | 91.0% | 16.8% |
| Rules + fuzzy + mock LLM | 89.8% | 98.2% | 93.3% | 13.8% |

Wrong automatic fills, Rules only:

- What is your dietary preference for the onsite lunch? -> work_mode (expected none, rule 0.95)

Wrong automatic fills, Rules + fuzzy:

- What is your dietary preference for the onsite lunch? -> work_mode (expected none, rule 0.95)

Wrong automatic fills, Rules + fuzzy + mock LLM:

- Share a link to something you built -> linkedin (expected none, llm 0.85)
- Are you currently enrolled in a degree program? -> highest_education (expected none, llm 0.85)
- What is your dietary preference for the onsite lunch? -> work_mode (expected none, rule 0.95)

