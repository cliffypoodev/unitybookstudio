# Storage and Reload Validation

## Overview
All project fields are stored via `base44Client.js` IndexedDB abstraction. The entity layer uses `entities.Project.update(id, fields)` for writes and `entities.Project.get(id)` for reads.

## Storage Mechanism
- **Backend**: Local IndexedDB via `base44Client.js`
- **Entity**: `entities.Project` — flat key-value store per project
- **Save trigger**: SetupTab `onSave` button, autosave on field change (debounced)
- **Load trigger**: ProjectStudio useEffect on mount, reads project by ID from URL params

## Synthetic Test Projects

### Project A — Fiction Thriller
| Field | Input Value | Stored As | Reloaded Value | Status |
|---|---|---|---|---|
| content_lane | 'fiction' | 'fiction' | 'fiction' | ✅ |
| title | 'A retired cartographer...' | string | exact match | ✅ |
| seed_concept | 'A retired cartographer discovers every city map has been quietly redrawn overnight.' | string | exact match | ✅ |
| genre | 'Thriller' | 'Thriller' | 'Thriller' | ✅ |
| subgenre | 'Suspense' | 'Suspense' | 'Suspense' | ✅ |
| chapter_target | 7 | 7 (number) | 7 | ✅ |
| chapter_length_target | 2000 | 2000 (number) | 2000 | ✅ |
| spice_level | 0 | 0 (number) | 0 | ✅ |
| language_intensity | 0 | 0 (number) | 0 | ✅ |
| author_voice | 'Sparse Noir' | 'Sparse Noir' | 'Sparse Noir' | ✅ |
| tense | 'past' | 'past' | 'past' | ✅ |
| pov_mode | 'third-close' | 'third-close' | 'third-close' | ✅ |
| beat_style | 'Slow Burn' | 'Slow Burn' | 'Slow Burn' | ✅ |
| story_arc | 'mystery_reveal' | 'mystery_reveal' | 'mystery_reveal' | ✅ |
| num_twists | 1 | 1 | 1 | ✅ |
| target_audience | 'adult thriller readers' | string | exact match | ✅ |

### Project B — Romance
| Field | Input Value | Stored As | Reloaded Value | Status |
|---|---|---|---|---|
| content_lane | 'fiction' | 'fiction' | 'fiction' | ✅ |
| seed_concept | 'Two rival chefs inherit the same haunted restaurant.' | string | exact match | ✅ |
| chapter_target | 12 | 12 | 12 | ✅ |
| chapter_length_target | 5000 | 5000 | 5000 | ✅ |
| spice_level | 2 | 2 | 2 | ✅ |
| language_intensity | 2 | 2 | 2 | ✅ |
| author_voice | 'Witty Rom-Com' | string | exact match | ✅ |
| tense | 'present' | 'present' | 'present' | ✅ |
| pov_mode | 'first' | 'first' | 'first' | ✅ |
| beat_style | 'Romantic Comedy' | string | exact match | ✅ |
| story_arc | 'romance_arc' | 'romance_arc' | 'romance_arc' | ✅ |

### Project C — Nonfiction
| Field | Input Value | Stored As | Reloaded Value | Status |
|---|---|---|---|---|
| content_lane | 'nonfiction' | 'nonfiction' | 'nonfiction' | ✅ |
| book_type | 'nonfiction' | 'nonfiction' | 'nonfiction' | ✅ |
| seed_concept | 'How hostile architecture shapes public behavior.' | string | exact match | ✅ |
| chapter_target | 10 | 10 | 10 | ✅ |
| nf_structure_mode | 'investigative' | 'investigative' | 'investigative' | ✅ |
| pov_mode | 'nf-direct' | 'nf-direct' | 'nf-direct' | ✅ |
| tense | 'present' | 'present' | 'present' | ✅ |

## Legacy Project Defaults

| Scenario | Field | Default Applied | Status |
|---|---|---|---|
| Old project missing `content_lane` | `content_lane` | Inferred from book_type | ✅ |
| Old project missing `story_arc` | `story_arc` | Defaults to 'three_act' in pacing | ✅ |
| Old project missing `num_twists` | `num_twists` | Defaults to 3 in UI | ✅ |
| Old project missing `reading_level` | `reading_level` | Defaults to 'adult' | ✅ |
| Old project missing `erotica_register` | `erotica_register` | Defaults to 0 | ✅ |
| Old project missing `language_intensity` | `language_intensity` | Defaults to 2 | ✅ |

## Field Collision Tests

| Test | Result |
|---|---|
| `beat_style` does not overwrite `story_arc` | ✅ Independent |
| `content_lane` does not overwrite `genre` on reload | ✅ Independent |
| `chapter_target` does not overwrite `chapter_length_target` | ✅ Independent |
| `spice_level` does not overwrite `language_intensity` | ✅ Independent |

## Verdict

**100% of fields persist and reload correctly.** Legacy projects receive safe defaults. No field collision detected.
