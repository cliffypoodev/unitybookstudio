# Genre Rule Mapping Report

## Profile Resolution Table

| Input Genre/Type | Profile Key | Voice Block | Polisher Rules | Recast Eligible |
|---|---|---|---|---|
| fiction, fantasy, romance, horror, sci-fi, mystery | `fiction` | `FICTION_SIGNATURE_VOICE_BLOCK` | `POLISHER_FICTION_RULES` | Yes |
| subgenre: thriller, suspense, action | `thriller` | `THRILLER_SIGNATURE_VOICE_BLOCK` | `POLISHER_FICTION_RULES` | Yes |
| subgenre: literary, speculative, upmarket | `literary` | `LITERARY_SIGNATURE_VOICE_BLOCK` | `POLISHER_FICTION_RULES` | Yes |
| nonfiction, investigative, journalism, history, biography | `nonfiction` | `NONFICTION_AUTHORITY_BLOCK` | `POLISHER_NONFICTION_RULES` | Yes |
| training, manual, caregiving | `training_manual` | `TRAINING_MANUAL_CLARITY_BLOCK` | `POLISHER_TRAINING_RULES` | No |
| business, guide | `business_guide` | `BUSINESS_GUIDE_CLARITY_BLOCK` | `POLISHER_NONFICTION_RULES` | Yes |
| memoir, autobiography | `memoir` | `MEMOIR_VOICE_BLOCK` | `POLISHER_MEMOIR_RULES` | Yes |
| unknown / empty | `default` | `DEFAULT_ANTI_CHATBOT_BLOCK` | `POLISHER_NONFICTION_RULES` | No |

## Resolution Priority

```
subgenre > genre > book_type > project_type > default
```

The resolver checks fields in this order and returns the first match. If no field matches any known profile, the `default` profile is used with `recastEligible: false` as a conservative safety measure.
