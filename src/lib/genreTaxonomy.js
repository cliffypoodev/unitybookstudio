import { isNonfictionProject } from '@/lib/projectType'; // NFCLASS-6

export const CONTENT_LANES = [
  {
    value: 'fiction',
    label: 'Fiction',
    description: 'Original invented stories, novels, short fiction, anthologies, and series.',
    defaultBookType: 'fiction',
    defaultRightsMode: 'original',
  },
  {
    value: 'nonfiction',
    label: 'Nonfiction',
    description: 'True events, instruction, research, history, memoir, essays, training, and analysis.',
    defaultBookType: 'nonfiction',
    defaultRightsMode: 'original',
  },
  {
    value: 'erotica',
    label: 'Erotica',
    description: 'Adult romantic / erotic fiction concepts for consenting adult characters.',
    defaultBookType: 'fiction',
    defaultRightsMode: 'original',
  },
  {
    value: 'fanfiction',
    label: 'Fan Fiction',
    description: 'Noncommercial transformative stories using an existing fandom, canon, or universe.',
    defaultBookType: 'fiction',
    defaultRightsMode: 'fanfiction_noncommercial',
  },
];

export const RIGHTS_MODES = [
  {
    value: 'original',
    label: 'Original Work',
    description: 'Fully original IP intended for normal publishing workflows.',
  },
  {
    value: 'fanfiction_noncommercial',
    label: 'Fan Fiction / Noncommercial Transformative Work',
    description: 'Uses an existing fandom or copyrighted universe. Treat as noncommercial unless authorized.',
  },
  {
    value: 'public_domain_retelling',
    label: 'Public Domain / Retelling',
    description: 'Based on public-domain material, mythology, folklore, or expired-copyright works.',
  },
  {
    value: 'licensed_authorized',
    label: 'Licensed / Authorized',
    description: 'You have permission, license, or official authorization to use the source IP.',
  },
  {
    value: 'inspired_by_originalized',
    label: 'Inspired-By / Originalized',
    description: 'Inspired by familiar tropes but rewritten as original IP.',
  },
];

export const PROJECT_FORMATS_BY_LANE = {
  fiction: [
    { value: 'novel', label: 'Novel' },
    { value: 'novella', label: 'Novella' },
    { value: 'short_story', label: 'Short Story' },
    { value: 'anthology', label: 'Anthology / Story Collection' },
    { value: 'series', label: 'Series' },
  ],
  nonfiction: [
    { value: 'standalone_book', label: 'Standalone Book' },
    { value: 'anthology', label: 'Anthology / Essay Collection' },
    { value: 'series', label: 'Series' },
    { value: 'training_manual', label: 'Training Manual / Guide' },
    { value: 'course_curriculum', label: 'Course / Curriculum' },
    { value: 'case_study_collection', label: 'Case Study Collection' },
    { value: 'reference_book', label: 'Reference Book' },
    { value: 'workbook', label: 'Workbook / Guided Journal' },
  ],
  erotica: [
    { value: 'novel', label: 'Novel' },
    { value: 'novella', label: 'Novella' },
    { value: 'short_story', label: 'Short Story' },
    { value: 'anthology', label: 'Anthology / Collection' },
    { value: 'series', label: 'Series' },
  ],
  fanfiction: [
    { value: 'novel', label: 'Novel-Length Fanfic' },
    { value: 'novella', label: 'Novella' },
    { value: 'short_story', label: 'One-Shot / Short Fic' },
    { value: 'anthology', label: 'Fanfic Collection / Anthology' },
    { value: 'series', label: 'Series / Saga' },
    { value: 'missing_episode', label: 'Missing Episode' },
    { value: 'fix_it', label: 'Fix-It Fic' },
    { value: 'crossover', label: 'Crossover' },
  ],
};

export const GENRE_GROUPS_BY_LANE = {
  fiction: [
    {
      group: 'Commercial Fiction',
      options: [
        'Thriller',
        'Mystery',
        'Crime',
        'Horror',
        'Romance',
        'Fantasy',
        'Science Fiction',
        'Adventure',
        'Western',
        'Supernatural',
      ],
    },
    {
      group: 'Literary / Upmarket',
      options: [
        'Literary Fiction',
        'Historical Fiction',
        'Women’s Fiction',
        'Drama',
        'Coming-of-Age',
        'Family Saga',
        'Speculative Fiction',
      ],
    },
    {
      group: 'Tone / Style',
      options: [
        'Comedy',
        'Satire',
        'Satirical Fiction',
        'Noir',
        'Steampunk',
        'Solarpunk',
        'Dystopian',
        'Post-Apocalyptic',
      ],
    },
    {
      group: 'Age / Audience',
      options: [
        'Children',
        'Middle Grade',
        'Young Adult',
        'New Adult',
        'Faith-Based Fiction',
      ],
    },
    {
      group: 'Fiction Anthologies',
      options: [
        'Short Story Collection',
        'Themed Anthology',
        'Shared-World Anthology',
        'Linked Story Cycle',
        'Flash Fiction Collection',
        'Horror Collection',
        'Science Fiction Collection',
        'Fantasy Collection',
        'Mystery / Crime Collection',
        'Romance Collection',
        'Faith-Based Collection',
        'Humor Collection',
      ],
    },
  ],

  nonfiction: [
    {
      group: 'Investigative / Argument',
      options: [
        'Investigative',
        'Exposé',
        'Investigative Journalism',
        'Cultural Criticism',
        'Politics / Society',
        'Current Affairs',
        'Social Commentary',
      ],
    },
    {
      group: 'History / True Events',
      options: [
        'History',
        'True Crime',
        'Biography',
        'Memoir',
        'Autobiography',
        'Profile Collection',
        'Historical Case Collection',
      ],
    },
    {
      group: 'Instructional / Practical',
      options: [
        'Self-Help',
        'Personal Development',
        'Business',
        'Leadership',
        'Training / Instructional',
        'Education',
        'Reference',
        'How-To',
        'Workbook / Guided Journal',
      ],
    },
    {
      group: 'Specialty Nonfiction',
      options: [
        'Academic / Scholarly',
        'Science',
        'Technology',
        'Medicine',
        'Health & Wellness',
        'Caregiving / Human Services',
        'Religion / Theology',
        'Philosophy',
        'Travel',
        'Sports',
        'Entertainment',
        'Film',
        'Music',
        'Personal Finance',
      ],
    },
    {
      group: 'Nonfiction Anthologies',
      options: [
        'Essay Collection',
        'Article Collection',
        'Case Study Collection',
        'Interview Collection',
        'Academic Reader',
        'Reference Compilation',
        'Training Module Collection',
        'Reflection / Meditation Collection',
        'Field Guide',
      ],
    },
  ],

  erotica: [
    {
      group: 'Erotica / Erotic Romance',
      options: [
        'Erotica',
        'Erotic Romance',
        'Contemporary Erotica',
        'Dark Erotica',
        'Dark Romance',
        'Romantic Suspense',
        'Erotic Thriller',
      ],
    },
    {
      group: 'Speculative Erotica',
      options: [
        'Paranormal / Monster Romance',
        'Paranormal Erotica',
        'Fantasy Erotica',
        'Sci-Fi Erotica',
        'Alien / Sci-Fi Erotica',
        'Historical Erotica',
      ],
    },
    {
      group: 'Relationship / Trope Lane',
      options: [
        'LGBTQ+ Erotica',
        'Enemies to Lovers',
        'Forced Proximity',
        'Second Chance',
        'Age Gap',
        'Office / Workplace',
        'Billionaire / Power Fantasy',
        'Mafia / Dark Romance',
        'MC / Biker Romance',
        'Reverse Harem',
        'Menage / Polyamory',
        'Omegaverse',
      ],
    },
    {
      group: 'Erotica Collections',
      options: [
        'Erotica Anthology',
        'Erotic Short Story Collection',
        'Themed Erotica Collection',
        'Erotic Romance Series',
      ],
    },
  ],

  fanfiction: [
    {
      group: 'Fandom Source Type',
      options: [
        'TV / Streaming',
        'Film',
        'Book Series',
        'Comic / Graphic Novel',
        'Video Game',
        'Anime / Manga',
        'Tabletop / RPG',
        'Podcast / Audio Drama',
        'Crossover',
        'Mythology / Public Domain',
      ],
    },
    {
      group: 'Fanfic Mode',
      options: [
        'Canon-Compliant',
        'Canon Divergent',
        'Alternate Universe',
        'Crossover',
        'Fix-It Fic',
        'Missing Episode',
        'Next Generation / Legacy',
        'Original Character in Canon World',
        'Relationship / Ship Fic',
        'Ensemble Adventure',
        'Case-of-the-Week',
        'Monster-of-the-Week',
        'Slice of Life',
        'Crack / Comedy',
        'Dark AU',
        'Time Travel',
        'Multiverse',
        'What-If',
      ],
    },
    {
      group: 'Adult / Erotic Fanfic',
      options: [
        'Erotic Fanfiction',
        'Explicit Fanfiction',
        'Smut / Lemon',
        'Erotic Romance Fanfic',
        'Dark Erotic Fanfic',
        'Omegaverse / Adult Dynamics',
        'Monster / Paranormal Erotic Fanfic',
        'Poly / Reverse Harem Fanfic',
        'Kink / BDSM Fanfic',
      ],
    },
    {
      group: 'Underlying Story Genre',
      options: [
        'Science Fiction',
        'Fantasy',
        'Adventure',
        'Mystery',
        'Thriller',
        'Horror',
        'Romance',
        'Comedy',
        'Drama',
        'Military / Political',
        'Space Opera',
        'Supernatural',
      ],
    },
  ],
};

export const SUBGENRES_BY_GENRE = {
  Thriller: ['Suspense', 'Psychological Thriller', 'Conspiracy Thriller', 'Techno-Thriller', 'Political Thriller', 'Legal Thriller'],
  Mystery: ['Cozy Mystery', 'Police Procedural', 'Whodunit', 'Amateur Sleuth', 'Locked Room Mystery'],
  Crime: ['Noir', 'Heist', 'Organized Crime', 'Legal Thriller', 'Detective Fiction'],
  Horror: ['Cosmic Horror', 'Psychological Horror', 'Survival Horror', 'Body Horror', 'Gothic Horror', 'Industrial Horror', 'Folk Horror'],
  Romance: ['Contemporary Romance', 'Historical Romance', 'Paranormal Romance', 'Romantic Suspense', 'Romantic Comedy', 'Clean Romance', 'Dark Romance'],
  Fantasy: ['Epic Fantasy', 'Dark Fantasy', 'Urban Fantasy', 'Magical Realism', 'Fairy Tale Retelling', 'Portal Fantasy'],
  'Science Fiction': ['Space Opera', 'Cyberpunk', 'Dystopian', 'Post-Apocalyptic', 'Hard Sci-Fi', 'Military Sci-Fi', 'First Contact'],
  'Literary Fiction': ['Coming-of-Age', 'Family Drama', 'Psychological Drama', 'Experimental', 'Book Club Fiction'],
  'Historical Fiction': ['Alternate History', 'War Era', 'Historical Mystery', 'Biographical Fiction'],
  Comedy: ['Romantic Comedy', 'Dark Comedy', 'Comedic Fantasy', 'Comedic Sci-Fi', 'Caper', 'Absurdist Fiction', 'Parody'],
  'Faith-Based Fiction': ['Contemporary Faith', 'Biblical Fiction', 'Inspirational Romance', 'Redemption Story'],

  'Investigative': ['Institutional Abuse', 'Corporate Misconduct', 'Government Failure', 'Medical / Scientific', 'Financial'],
  'Exposé': ['Corporate Exposé', 'Political Exposé', 'Cultural Exposé', 'Industry Exposé'],
  'History': ['Political History', 'Military History', 'Cultural History', 'Social History', 'Medical History', 'Hidden History'],
  'Self-Help': ['Habits', 'Relationships', 'Mindset', 'Trauma Recovery', 'Creativity', 'Productivity'],
  'Training / Instructional': ['Caregiver Training', 'Compliance Training', 'Leadership Training', 'Workplace Training', 'Safety Training'],
  'Academic / Scholarly': ['Theory', 'Critical Studies', 'Textbook', 'Reader', 'Research Monograph'],
  'Caregiving / Human Services': ['Developmental Disabilities', 'DSP Training', 'Person-Centered Care', 'Documentation', 'Crisis Support'],

  Erotica: ['Contemporary Erotica', 'Dark Erotica', 'Romantic Suspense', 'Erotic Thriller'],
  'Erotic Romance': ['Contemporary', 'Dark Romance', 'Paranormal', 'Historical', 'LGBTQ+', 'Second Chance'],

  'Canon-Compliant': ['Missing Episode', 'Case-of-the-Week', 'Ensemble Adventure', 'Slice of Life'],
  'Canon Divergent': ['What-If', 'Fix-It Fic', 'Alternate Ending', 'Timeline Split'],
  'Alternate Universe': ['Modern AU', 'No Powers AU', 'College AU', 'Coffee Shop AU', 'Dark AU'],
  Crossover: ['Two-Fandom Crossover', 'Multiverse', 'Shared Mission', 'World Collision'],

  'TV / Streaming': ['Episode Expansion', 'Missing Scene', 'Post-Finale', 'Season Rewrite', 'Ensemble Arc'],
  Film: ['Sequel Fic', 'Prequel Fic', 'Missing Scene', 'Alternate Ending', 'Character Study'],
  'Book Series': ['Canon Expansion', 'POV Retelling', 'Next Generation', 'Alternate Ending', 'Missing Chapter'],
  'Video Game': ['Quest Expansion', 'Companion Romance', 'Post-Game', 'Route Rewrite', 'Player Character / OC'],
  'Anime / Manga': ['Canon Divergence', 'Arc Rewrite', 'School AU', 'Tournament Arc', 'Slow Burn Ship'],
  'Relationship / Ship Fic': ['Slow Burn', 'Established Relationship', 'Friends to Lovers', 'Enemies to Lovers', 'Angst with Payoff'],
  'Fix-It Fic': ['Death Fix-It', 'Ending Rewrite', 'Character Rescue', 'Redemption Arc', 'Timeline Repair'],
  'Missing Episode': ['Between Episodes', 'Unseen Mission', 'Quiet Aftermath', 'Character POV', 'Bottle Episode'],
  'Erotic Fanfiction': ['Slow Burn Explicit', 'Established Relationship', 'First Time', 'Forbidden Attraction', 'Angst / Comfort'],
  'Explicit Fanfiction': ['Plot With Explicit Scenes', 'High Heat Romance', 'Dark Adult Drama', 'Ship-Focused', 'Canon-Divergent Heat'],
  'Smut / Lemon': ['One-Shot', 'Plot With Smut', 'Established Ship', 'First Time', 'PWP With Character Voice'],
  'Omegaverse / Adult Dynamics': ['Alpha / Omega', 'Pack Politics', 'Bonding', 'Heat / Rut', 'Found Family'],
  'Kink / BDSM Fanfic': ['Negotiated Dynamic', 'Power Exchange', 'Aftercare-Focused', 'Club / Scene Setting', 'Trust-Building'],
};


// Genre-family fallback detail menus used by the Setup tab's cleaner cascading genre UI.
// These keep the stored pipeline fields simple: genre + subgenre + genre_group.
export const SUBGENRE_FALLBACKS_BY_GROUP = {
  fiction: {
    'Commercial Fiction': ['Psychological', 'Action-Driven', 'High Concept', 'Character-Driven', 'Dark / Gritty', 'Cinematic', 'Series-Friendly'],
    'Literary / Upmarket': ['Book Club', 'Historical', 'Psychological', 'Lyrical', 'Family / Relationship', 'Social Issue', 'Dual Timeline'],
    'Tone / Style': ['Dark Comedy', 'Absurdist', 'Noir', 'Pulp', 'Satirical', 'Stylized', 'Experimental'],
    'Age / Audience': ['Chapter Book', 'Middle Grade Adventure', 'Teen Drama', 'YA Fantasy', 'New Adult Romance', 'Inspirational'],
    'Fiction Anthologies': ['Linked Stories', 'Shared World', 'Theme-Based', 'Single-Author Collection', 'Multi-POV Cycle', 'Flash / Microfiction'],
  },
  nonfiction: {
    'Investigative / Argument': ['Institutional', 'Corporate', 'Government', 'Cultural', 'Medical / Scientific', 'Financial', 'Legal / Policy'],
    'History / True Events': ['Hidden History', 'War / Military', 'Medical History', 'Cultural History', 'Biography-Driven', 'Case-Based'],
    'Instructional / Practical': ['Step-by-Step', 'Training Guide', 'Field Manual', 'Workbook', 'Leadership', 'Compliance', 'Beginner-Friendly'],
    'Specialty Nonfiction': ['Research-Driven', 'Practical Guide', 'Narrative Nonfiction', 'Reference', 'Professional / Trade', 'Consumer-Friendly'],
    'Nonfiction Anthologies': ['Essay Collection', 'Case Studies', 'Interviews', 'Reflections', 'Field Guide Entries', 'Training Modules'],
  },
  erotica: {
    'Erotica / Erotic Romance': ['Contemporary', 'Dark', 'Romantic Suspense', 'Forbidden / Taboo-Adjacent', 'High Heat Romance', 'Character-Driven'],
    'Speculative Erotica': ['Paranormal', 'Monster', 'Alien / Sci-Fi', 'Fantasy Court', 'Historical', 'Urban Fantasy'],
    'Relationship / Trope Lane': ['Enemies to Lovers', 'Forced Proximity', 'Second Chance', 'Power Dynamic', 'Poly / RH', 'Omegaverse'],
    'Erotica Collections': ['Single-Author Collection', 'Themed Collection', 'Linked Couple Cycle', 'Shared Setting', 'High Heat Shorts'],
  },
  fanfiction: {
    'Fandom Source Type': ['Canon Cast', 'OC-Centered', 'Ensemble', 'Single POV', 'Multi-POV', 'Ship-Focused', 'Plot-Focused'],
    'Fanfic Mode': ['Canon-Compliant', 'Canon Divergent', 'Fix-It', 'Missing Scene', 'Episode Expansion', 'AU', 'Crossover', 'Crack Treated Seriously'],
    'Adult / Erotic Fanfic': ['Smut / Lemon', 'Slow Burn Explicit', 'Established Relationship', 'Enemies to Lovers', 'Power Dynamic', 'Omegaverse', 'Poly / RH', 'Kink-Aware'],
    'Underlying Story Genre': ['Adventure', 'Mystery Case', 'Romance Arc', 'Horror Arc', 'Political Intrigue', 'Space Opera', 'Comedy', 'Dark Drama'],
  },
};


export const GENRE_FAMILY_DESCRIPTIONS = {
  'Commercial Fiction': 'Fast, market-facing story categories built around momentum, suspense, emotion, or spectacle.',
  'Literary / Upmarket': 'Character-rich fiction with stronger prose texture, theme, emotional depth, or book-club appeal.',
  'Tone / Style': 'Use this when the main identity is voice, mood, attitude, or stylistic flavor rather than plot category.',
  'Age / Audience': 'Audience-first fiction categories such as children, middle grade, YA, new adult, or inspirational fiction.',
  'Fiction Anthologies': 'Collections of multiple stories, linked cycles, shared-world collections, or theme-based short fiction.',
  'Investigative / Argument': 'Nonfiction built around a thesis, exposé, investigation, critique, or public-interest argument.',
  'History / True Events': 'True-event nonfiction, biography, memoir, cultural history, crime, war, or case-driven history.',
  'Instructional / Practical': 'Teaching, training, self-improvement, business, how-to, workbook, and field-guide material.',
  'Specialty Nonfiction': 'Subject-matter nonfiction for professional, academic, scientific, spiritual, cultural, or niche audiences.',
  'Nonfiction Anthologies': 'Collections of essays, cases, interviews, reflections, modules, or reference entries.',
  'Erotica / Erotic Romance': 'Adult fiction where desire, intimacy, romantic/sexual tension, and emotional stakes drive the story.',
  'Speculative Erotica': 'Adult erotic fiction blended with fantasy, paranormal, monster, sci-fi, historical, or impossible-world elements.',
  'Relationship / Trope Lane': 'Erotic or romantic stories organized around a relationship dynamic, trope, power structure, or pairing shape.',
  'Erotica Collections': 'Anthologies, short collections, linked erotic cycles, or themed adult-story groupings.',
  'Fandom Source Type': 'Start here when you want the app to understand what kind of source material the fanfic is based on.',
  'Fanfic Mode': 'The main transformative move: canon-compliant, divergent, AU, crossover, missing episode, fix-it, and similar modes.',
  'Adult / Erotic Fanfic': 'Fanfiction that keeps fandom/canon awareness while enabling adult heat, explicit romance, or erotic dynamics.',
  'Underlying Story Genre': 'The non-fandom story engine underneath the fanfic: mystery, romance, horror, adventure, sci-fi, and so on.',
};

export const GENRE_DESCRIPTIONS = {
  Thriller: 'Danger, pressure, secrets, and escalating stakes drive the plot forward.',
  Mystery: 'A central question, crime, puzzle, or hidden truth structures the story.',
  Crime: 'Criminal activity, investigation, corruption, law, or underworld systems shape the conflict.',
  Horror: 'Fear, dread, threat, survival, monstrosity, or psychological terror drives the experience.',
  Romance: 'The central emotional engine is a relationship arc with romantic stakes.',
  Fantasy: 'Magic, mythic worlds, supernatural rules, quests, or invented realms shape the story.',
  'Science Fiction': 'Speculative technology, future society, space, science, systems, or altered reality drive the premise.',
  Adventure: 'External action, journeys, danger, discovery, and set-piece momentum lead the story.',
  Western: 'Frontier, lawlessness, moral codes, rugged landscapes, and survival define the world.',
  Supernatural: 'Ghosts, spirits, curses, demons, or paranormal forces operate inside an otherwise recognizable world.',
  'Literary Fiction': 'Character, language, interiority, theme, and emotional precision matter as much as plot.',
  'Historical Fiction': 'Invented characters or dramatized lives unfold inside a researched historical period.',
  'Women’s Fiction': 'Character-centered fiction focused on identity, relationships, life transitions, and emotional growth.',
  Drama: 'Serious interpersonal conflict, moral choices, and emotional consequences lead the story.',
  'Coming-of-Age': 'A young or changing protagonist crosses a major threshold into new self-understanding.',
  'Family Saga': 'Family history, inheritance, secrets, conflict, and generational consequences shape the plot.',
  'Speculative Fiction': 'Literary or commercial fiction with a what-if premise that bends reality, society, or rules.',
  Comedy: 'Humor, absurdity, timing, misbehavior, and escalation are central to the reader experience.',
  Satire: 'Uses comedy, exaggeration, and critique to expose cultural, political, or social stupidity.',
  'Satirical Fiction': 'A full fictional story built to mock, expose, or critique a system or worldview.',
  Noir: 'Dark, morally compromised fiction with cynicism, crime, secrets, and doomed atmosphere.',
  Steampunk: 'Retro-industrial speculative fiction, usually Victorian/Edwardian flavored with machines and alternate tech.',
  Solarpunk: 'Optimistic or reform-minded speculative fiction centered on sustainability, community, and better futures.',
  Dystopian: 'A broken, controlled, oppressive, or engineered society shapes the conflict.',
  'Post-Apocalyptic': 'Survival and rebuilding after collapse, catastrophe, plague, war, or environmental disaster.',
  Children: 'Simple, age-appropriate fiction for young readers, usually with clear emotional lessons.',
  'Middle Grade': 'Adventurous, accessible fiction for roughly 8–12 readers, usually without adult themes.',
  'Young Adult': 'Teen-centered fiction with identity, belonging, danger, romance, or coming-of-age stakes.',
  'New Adult': 'Older teen/college/early-adult fiction with independence, romance, identity, and life-transition stakes.',
  'Faith-Based Fiction': 'Fiction shaped by faith, moral struggle, redemption, inspiration, or spiritual worldview.',
  'Short Story Collection': 'Multiple standalone stories gathered under one author, theme, genre, or mood.',
  'Themed Anthology': 'Stories organized around one concept, prompt, event, theme, or emotional question.',
  'Shared-World Anthology': 'Different stories take place in the same invented world, town, timeline, or mythos.',
  'Linked Story Cycle': 'Separate stories that connect through recurring people, places, themes, or consequences.',
  'Flash Fiction Collection': 'Very short pieces built around compression, sharp turns, and concentrated impact.',
  'Horror Collection': 'A collection focused on dread, fear, monsters, hauntings, or unsettling premises.',
  'Science Fiction Collection': 'Multiple sci-fi stories exploring tech, futures, aliens, society, or speculative ideas.',
  'Fantasy Collection': 'Multiple fantasy stories using magic, myth, quests, folklore, or invented worlds.',
  'Mystery / Crime Collection': 'Stories centered on crimes, clues, secrets, criminals, investigators, or moral puzzles.',
  'Romance Collection': 'Multiple romance stories, couples, or relationship arcs under one theme or setting.',
  'Faith-Based Collection': 'Inspirational or spiritual stories gathered under a faith-centered theme.',
  'Humor Collection': 'A group of funny, satirical, absurd, or comic stories.',
  Investigative: 'A research-driven nonfiction project that uncovers patterns, systems, wrongdoing, or hidden history.',
  Exposé: 'A direct reveal of misconduct, corruption, hypocrisy, abuse, fraud, or institutional failure.',
  'Investigative Journalism': 'Reported nonfiction with source-based evidence, narrative scenes, and public-interest stakes.',
  'Cultural Criticism': 'Analysis of media, society, trends, design, behavior, power, or public meaning.',
  'Politics / Society': 'Nonfiction about institutions, law, civic life, ideology, policy, or public systems.',
  'Current Affairs': 'Timely nonfiction centered on modern events, disputes, trends, or policy debates.',
  'Social Commentary': 'Argumentative or reflective nonfiction about social behavior, culture, values, and power.',
  History: 'True past events, movements, people, places, eras, or forces explained with context.',
  'True Crime': 'Real crimes, investigations, victims, offenders, institutions, and consequences.',
  Biography: 'A nonfiction life story focused on one real person.',
  Memoir: 'A personal true story told from the author’s lived experience and reflection.',
  Autobiography: 'A full-life account written by the person who lived it.',
  'Profile Collection': 'Multiple short biographical or personality-driven portraits.',
  'Historical Case Collection': 'A set of historical incidents or case studies organized around a theme.',
  'Self-Help': 'Practical or reflective nonfiction designed to help readers change behavior, habits, or mindset.',
  'Personal Development': 'Growth-oriented nonfiction focused on identity, discipline, resilience, purpose, or improvement.',
  Business: 'Nonfiction about entrepreneurship, management, operations, marketing, money, or strategy.',
  Leadership: 'Guidance on leading teams, decisions, culture, responsibility, or organizational behavior.',
  'Training / Instructional': 'Structured teaching material for skills, compliance, professional practice, or repeatable workflows.',
  Education: 'Learning-focused nonfiction for schools, teachers, students, training, or curriculum.',
  Reference: 'Information organized for lookup, clarity, definitions, processes, or repeat use.',
  'How-To': 'Step-by-step guidance for doing a specific task or building a specific skill.',
  'Workbook / Guided Journal': 'Interactive nonfiction with prompts, exercises, reflection spaces, or guided practice.',
  'Academic / Scholarly': 'Research-heavy nonfiction written for expert, classroom, or scholarly use.',
  Science: 'Nonfiction explaining scientific knowledge, discoveries, controversies, or systems.',
  Technology: 'Nonfiction about tools, software, innovation, digital systems, AI, or technical change.',
  Medicine: 'Health, treatment, medical history, ethics, practice, or healthcare systems.',
  'Health & Wellness': 'Consumer-friendly nonfiction about wellbeing, health behavior, fitness, stress, or lifestyle.',
  'Caregiving / Human Services': 'Support work, disability services, care ethics, documentation, training, or human-service systems.',
  'Religion / Theology': 'Faith, scripture, religious institutions, theology, belief, or spiritual history.',
  Philosophy: 'Ideas, meaning, ethics, knowledge, logic, existence, or conceptual argument.',
  Travel: 'Places, journeys, cultural encounters, guides, or travel memoir.',
  Sports: 'Athletes, teams, competition, culture, training, or sports history.',
  Entertainment: 'Film, music, celebrity, media industries, or popular culture.',
  Film: 'Fanfic source type based on a movie or movie franchise.',
  Music: 'Nonfiction about musicians, songs, scenes, performance, industry, or cultural impact.',
  'Personal Finance': 'Money management, investing, debt, saving, budgeting, or financial behavior.',
  Erotica: 'Adult fiction where sexual tension and on-page intimacy are central to the premise.',
  'Erotic Romance': 'Romance where explicit intimacy is part of the emotional relationship arc.',
  'Contemporary Erotica': 'Modern-day adult erotic fiction with realistic settings and present-day relationship dynamics.',
  'Dark Erotica': 'Darker adult fiction with danger, obsession, moral risk, or shadowy emotional terrain.',
  'Dark Romance': 'Romance with morally grey characters, danger, obsession, trauma, or high emotional risk.',
  'Romantic Suspense': 'Romance blended with danger, pursuit, mystery, or threat.',
  'Erotic Thriller': 'Erotic tension combined with thriller pacing, danger, deception, or crime.',
  'Paranormal / Monster Romance': 'Romance or erotica involving monsters, supernatural beings, shifters, vampires, or nonhuman lovers.',
  'Paranormal Erotica': 'Explicit adult stories with supernatural beings, magic, haunting, or paranormal settings.',
  'Fantasy Erotica': 'Explicit adult fantasy with courts, magic, quests, creatures, or invented worlds.',
  'Sci-Fi Erotica': 'Explicit adult fiction with future tech, space, aliens, experiments, or speculative societies.',
  'Alien / Sci-Fi Erotica': 'Erotic sci-fi with alien cultures, first contact, space travel, or nonhuman dynamics.',
  'Historical Erotica': 'Erotica set in a past era with period rules, restrictions, and social risk.',
  'LGBTQ+ Erotica': 'Adult fiction centered on queer relationships, desire, romance, or identity.',
  'Enemies to Lovers': 'A relationship begins in conflict, rivalry, distrust, or opposition and turns intimate.',
  'Forced Proximity': 'Characters are stuck together by circumstance, space, danger, work, or obligation.',
  'Second Chance': 'Former lovers, friends, or partners get another shot after history, regret, or separation.',
  'Age Gap': 'A romance/erotic dynamic shaped by a meaningful adult age difference and life-stage tension.',
  'Office / Workplace': 'Relationship or erotic tension grows inside a workplace, hierarchy, or professional setting.',
  'Billionaire / Power Fantasy': 'High-status wealth, access, luxury, control, or social imbalance drives fantasy appeal.',
  'Mafia / Dark Romance': 'Organized-crime danger, loyalty, protection, power, and moral compromise shape the romance.',
  'MC / Biker Romance': 'Motorcycle-club culture, loyalty, danger, found family, and outlaw romance.',
  'Reverse Harem': 'One central character develops relationships with multiple partners.',
  'Menage / Polyamory': 'Multiple-partner romance/erotica with negotiated connection, desire, or relationship structure.',
  Omegaverse: 'A speculative relationship system using alpha/beta/omega dynamics, bonds, heats, packs, or social rules.',
  'Erotica Anthology': 'A collection of adult stories connected by heat level, theme, trope, or setting.',
  'Erotic Short Story Collection': 'Short explicit stories gathered by author, trope, kink, or relationship shape.',
  'Themed Erotica Collection': 'Adult stories grouped around one fantasy, setting, prompt, or recurring motif.',
  'Erotic Romance Series': 'A multi-book or multi-story erotic romance sequence with recurring world or relationship stakes.',
  'TV / Streaming': 'Fanfic based on a television or streaming series, season, episode, or ensemble.',
  'Book Series': 'Fanfic based on novels, book canon, written sagas, or literary worlds.',
  'Comic / Graphic Novel': 'Fanfic based on comics, superheroes, graphic novels, or illustrated canon.',
  'Video Game': 'Fanfic based on game worlds, quests, routes, playable characters, or companion arcs.',
  'Anime / Manga': 'Fanfic based on anime/manga canon, arcs, ships, school settings, or tournament structures.',
  'Tabletop / RPG': 'Fanfic based on roleplaying campaigns, tabletop worlds, parties, quests, or game lore.',
  'Podcast / Audio Drama': 'Fanfic based on audio storytelling, fictional podcasts, or serialized audio worlds.',
  'Mythology / Public Domain': 'Transformative fiction based on myths, folklore, legends, classics, or public-domain worlds.',
  'Canon-Compliant': 'Fits inside established canon without changing major events.',
  'Canon Divergent': 'Branches away from canon at a specific decision, event, death, reveal, or timeline point.',
  'Alternate Universe': 'Reimagines characters in a different setting, timeline, premise, or reality.',
  'Fix-It Fic': 'Repairs an ending, death, relationship, betrayal, or canon choice the writer wants changed.',
  'Missing Episode': 'Adds an unseen episode, mission, scene, downtime, or aftermath that canon skipped.',
  'Next Generation / Legacy': 'Focuses on descendants, successors, students, heirs, or the next era of the canon world.',
  'Original Character in Canon World': 'Places an original character into the established canon setting or cast orbit.',
  'Relationship / Ship Fic': 'Centers a romantic, emotional, erotic, or relational pairing/ship.',
  'Ensemble Adventure': 'Uses a broad cast working together through mission, quest, case, or group crisis.',
  'Case-of-the-Week': 'A self-contained mystery, mission, monster, client, or problem in episodic style.',
  'Monster-of-the-Week': 'A self-contained creature, threat, haunting, or supernatural case drives the episode-style plot.',
  'Slice of Life': 'Low-stakes scenes focused on daily life, relationships, humor, healing, or downtime.',
  'Crack / Comedy': 'Intentionally absurd, silly, high-concept, or chaotic fanfic played for laughs.',
  'Dark AU': 'A darker alternate-universe take with higher danger, moral pressure, trauma, or grim consequences.',
  'Time Travel': 'Characters move through time to change, repair, witness, or complicate canon.',
  Multiverse: 'Multiple timelines, worlds, versions, or realities collide or interact.',
  'What-If': 'Explores one altered premise: what if a key canon event happened differently?',
  'Erotic Fanfiction': 'Adult fanfic with explicit intimacy while preserving fandom voice, canon dynamics, or ship tension.',
  'Explicit Fanfiction': 'Fanfic that allows on-page adult content as part of the plot or relationship arc.',
  'Smut / Lemon': 'Direct, high-heat fanfic centered on adult intimacy, often shorter or ship-focused.',
  'Erotic Romance Fanfic': 'Fanfic where adult intimacy supports a real romance arc, not just standalone heat.',
  'Dark Erotic Fanfic': 'Adult fanfic with darker emotional stakes, danger, obsession, or morally grey dynamics.',
  'Omegaverse / Adult Dynamics': 'Adult fanfic using A/B/O or similar bonding, hierarchy, heat, pack, or social dynamics.',
  'Monster / Paranormal Erotic Fanfic': 'Adult fanfic involving supernatural, monstrous, paranormal, or nonhuman dynamics.',
  'Poly / Reverse Harem Fanfic': 'Fanfic centered on multiple-partner dynamics, found family, or group relationship structures.',
  'Kink / BDSM Fanfic': 'Fanfic with negotiated power, kink-aware dynamics, trust, boundaries, and aftercare.',
  'Military / Political': 'Fanfic driven by war, command, espionage, diplomacy, rebellion, or institutional power.',
  'Space Opera': 'Large-scale sci-fi adventure with factions, travel, politics, romance, or war across space.',
};

export const SUBGENRE_DESCRIPTIONS = {
  Suspense: 'Tension and uncertainty build gradually; the reader keeps waiting for the other shoe to drop.',
  'Psychological Thriller': 'Danger comes through identity, perception, memory, obsession, manipulation, or mental pressure.',
  'Conspiracy Thriller': 'Hidden organizations, cover-ups, secret agendas, or institutional deception drive the plot.',
  'Techno-Thriller': 'Technology, systems, weapons, cyber tools, engineering, or science shape the threat.',
  'Political Thriller': 'Government, elections, espionage, power, diplomacy, or public scandal drives the danger.',
  'Legal Thriller': 'Courtrooms, lawyers, investigations, evidence, and legal strategy create the tension.',
  'Cozy Mystery': 'Low-gore mystery with community charm, amateur sleuthing, and puzzle-solving.',
  'Police Procedural': 'Investigation follows law-enforcement process, evidence, interviews, and casework.',
  Whodunit: 'The pleasure is solving who committed the crime and how.',
  'Amateur Sleuth': 'A non-professional investigator gets pulled into solving the mystery.',
  'Locked Room Mystery': 'A seemingly impossible crime becomes the central puzzle.',
  Noir: 'Cynical, shadowy, morally compromised crime tone.',
  Heist: 'Planning, execution, betrayal, and consequences of a theft or operation.',
  'Organized Crime': 'Mafia, gangs, syndicates, corruption networks, or criminal families.',
  'Detective Fiction': 'A detective or investigator drives the case-solving structure.',
  'Cosmic Horror': 'Terror comes from vast, unknowable forces and human insignificance.',
  'Psychological Horror': 'Fear emerges from the mind, identity, obsession, isolation, or unreliable perception.',
  'Survival Horror': 'Characters fight to survive a hostile place, creature, system, or catastrophe.',
  'Body Horror': 'Fear centers on bodily transformation, violation, disease, mutation, or disgust.',
  'Gothic Horror': 'Atmospheric dread, secrets, decay, romance, old houses, or haunted inheritances.',
  'Industrial Horror': 'Factories, mines, machinery, laboratories, or work sites become frightening systems.',
  'Folk Horror': 'Rural belief, ritual, isolation, folklore, cults, or ancient practices drive dread.',
  Contemporary: 'Modern-day setting and current relationship norms.',
  'Contemporary Romance': 'Modern romantic relationship arc in a realistic setting.',
  'Historical Romance': 'Romance shaped by the customs, restrictions, and setting of a past era.',
  'Paranormal Romance': 'Romance involving supernatural beings, powers, curses, shifters, ghosts, or magic.',
  'Romantic Comedy': 'Romance with humor, banter, awkwardness, and comic timing.',
  'Clean Romance': 'Romance with little/no explicit sexual content and emphasis on emotional connection.',
  'Epic Fantasy': 'Large-scale fantasy with kingdoms, quests, magic systems, wars, or mythic stakes.',
  'Dark Fantasy': 'Fantasy with horror, grim morality, danger, curses, or bleak emotional terrain.',
  'Urban Fantasy': 'Magic or supernatural forces operating inside a modern city or contemporary world.',
  'Magical Realism': 'Realistic life touched by subtle, symbolic, or matter-of-fact impossible elements.',
  'Fairy Tale Retelling': 'A known tale is reworked with a new setting, POV, tone, or thematic angle.',
  'Portal Fantasy': 'Characters enter another world through a doorway, object, accident, spell, or threshold.',
  Cyberpunk: 'High tech, low life: corporations, hackers, surveillance, body mods, and neon systems.',
  'Hard Sci-Fi': 'Scientific plausibility, engineering, physics, or technical realism matters strongly.',
  'Military Sci-Fi': 'Space/future warfare, command structure, tactics, duty, and combat stakes.',
  'First Contact': 'Humans and alien intelligence meet, misunderstand, negotiate, or collide.',
  'Book Club': 'Accessible literary/upmarket fiction built for discussion, emotion, and theme.',
  Historical: 'Past-era framing, period conflict, or historical atmosphere.',
  Psychological: 'Interior pressure, motive, perception, shame, fear, or identity drives the story.',
  Lyrical: 'Language, rhythm, image, atmosphere, and emotional texture are foregrounded.',
  'Family / Relationship': 'Family bonds, marriage, friendship, caregiving, or intimate conflict lead the arc.',
  'Social Issue': 'A real cultural or social problem is central to the story.',
  'Dual Timeline': 'Two time periods mirror, reveal, or complicate each other.',
  'Dark Comedy': 'Funny material with bleakness, cruelty, danger, or moral discomfort underneath.',
  Absurdist: 'Illogical, surreal, exaggerated, or strange premises expose a deeper truth.',
  Pulp: 'Fast, heightened, sensational, colorful storytelling with bold genre pleasures.',
  Satirical: 'A detail lane for stories driven by ridicule and social critique.',
  Stylized: 'A strong voice, structure, aesthetic, or formal approach defines the story.',
  Experimental: 'Nontraditional structure, form, language, or point of view.',
  'Linked Stories': 'Standalone pieces connected by characters, setting, theme, or consequence.',
  'Shared World': 'Different stories occur in the same world, institution, town, or mythos.',
  'Theme-Based': 'All pieces respond to a single theme, question, or prompt.',
  'Single-Author Collection': 'One author’s stories collected under a consistent voice or theme.',
  'Multi-POV Cycle': 'A sequence told through multiple perspectives that build a larger whole.',
  'Flash / Microfiction': 'Very short pieces where compression and sharp endings matter.',
  Institutional: 'Focuses on systems, agencies, hospitals, schools, churches, corporations, or bureaucracies.',
  Corporate: 'Business misconduct, corporate systems, industry practices, or executive decisions.',
  Government: 'Public agencies, law, state power, policy, or official failure.',
  Cultural: 'Norms, media, design, language, social patterns, or public beliefs.',
  'Medical / Scientific': 'Medicine, research, labs, health systems, ethics, or scientific practice.',
  Financial: 'Money, markets, fraud, banks, debt, funds, or economic systems.',
  'Legal / Policy': 'Law, regulation, enforcement, rights, courts, or policy design.',
  'Step-by-Step': 'Organized as a practical sequence readers can follow.',
  'Training Guide': 'Designed for staff learning, onboarding, compliance, or role development.',
  'Field Manual': 'Practical, on-the-job reference for real-world situations.',
  Workbook: 'Contains exercises, prompts, checklists, or reader participation.',
  Compliance: 'Focused on meeting standards, rules, documentation, audits, or required practice.',
  'Beginner-Friendly': 'Assumes little prior knowledge and explains from the ground up.',
  'Narrative Nonfiction': 'True material told with scene, character, tension, and story movement.',
  'Professional / Trade': 'Written for practitioners, workers, managers, or a specific industry.',
  'Consumer-Friendly': 'Accessible to general readers without specialist background.',
  Paranormal: 'Supernatural beings, hauntings, magic, shifters, spirits, or curses.',
  Monster: 'Nonhuman or monstrous beings drive romance, fear, desire, or danger.',
  'Alien / Sci-Fi': 'Alien, futuristic, or speculative setting with adult or romantic dynamics.',
  'Fantasy Court': 'Royal courts, magical politics, forbidden desire, or fantasy power structures.',
  'High Heat Romance': 'Romance with frequent, explicit, on-page intimacy.',
  'Forbidden / Taboo-Adjacent': 'Desire is complicated by social risk, rules, power, secrecy, or boundaries; keep characters consenting adults.',
  'Character-Driven': 'Internal change, emotional conflict, and relationship consequences matter most.',
  'Power Dynamic': 'A relationship shaped by status, authority, dominance, submission, or negotiated imbalance.',
  'Poly / RH': 'Multiple partners, group romance, or reverse-harem-style relationship structure.',
  'Canon Cast': 'Uses the familiar established characters as the main cast.',
  'OC-Centered': 'An original character drives the story inside the canon world.',
  Ensemble: 'A group cast shares story weight, relationships, and plot functions.',
  'Single POV': 'Told tightly through one main character’s perspective.',
  'Multi-POV': 'Uses several viewpoint characters to cover wider emotional or plot scope.',
  'Ship-Focused': 'The central engine is a pairing or relationship dynamic.',
  'Plot-Focused': 'Adventure, case, mission, conflict, or external stakes drive the fanfic.',
  'Fix-It': 'Repairs, redirects, or undoes a canon event the writer wants changed.',
  'Missing Scene': 'Adds a skipped moment inside an existing canon episode, chapter, or event.',
  'Episode Expansion': 'Expands one canon episode, mission, chapter, or case into a fuller story.',
  AU: 'Alternate universe: same characters, different premise, setting, or timeline.',
  'Crack Treated Seriously': 'A ridiculous premise is written with sincere character logic and real consequences.',
  'Slow Burn Explicit': 'Relationship tension builds gradually before adult intimacy becomes explicit.',
  'Established Relationship': 'Characters are already together; conflict comes from pressure, intimacy, or consequences.',
  'First Time': 'Adult intimacy happens for the first time between these characters.',
  'Forbidden Attraction': 'Mutual desire conflicts with rules, danger, loyalty, secrecy, or social pressure.',
  'Angst / Comfort': 'Emotional pain, hurt, fear, or guilt is followed by care, reassurance, and intimacy.',
  'One-Shot': 'A single self-contained fanfic scene or short story.',
  'Plot With Smut': 'Explicit scenes are embedded in an actual story arc, not isolated heat.',
  'Established Ship': 'The chosen pairing is already known or already together.',
  'PWP With Character Voice': 'Primarily adult heat, but still written in the characters’ recognizable voices.',
  'Alpha / Omega': 'A/B/O dynamic centered on alpha/omega roles, attraction, bonds, and social rules.',
  'Pack Politics': 'Pack hierarchy, loyalty, alliances, and group obligations shape the story.',
  Bonding: 'A relationship bond, mate bond, magical link, or social tie drives intimacy and stakes.',
  'Heat / Rut': 'A/B/O biological-cycle trope for adult characters; use only with consent-safe framing.',
  'Found Family': 'Chosen-family bonds become as important as romance, survival, or plot stakes.',
  'Negotiated Dynamic': 'Power exchange or kink is explicitly discussed, chosen, and bounded by the characters.',
  'Power Exchange': 'Consensual dominance/submission or authority dynamics drive the erotic relationship.',
  'Aftercare-Focused': 'Care, reassurance, recovery, and emotional safety after intensity are central.',
  'Club / Scene Setting': 'Kink-aware story set around a club, scene, community, or negotiated environment.',
  'Trust-Building': 'The emotional arc centers on earning safety, boundaries, vulnerability, and trust.',
};

function humanizeOptionLabel(label = '') {
  return String(label)
    .replace(/[_/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getGenreFamilyDescription(family) {
  return GENRE_FAMILY_DESCRIPTIONS[family] || 'Broad bucket used to keep the setup screen organized before choosing the exact genre.';
}

export function getGenreDescription(genre) {
  if (!genre) return '';
  return GENRE_DESCRIPTIONS[genre] || `${humanizeOptionLabel(genre)} project type. Use this when that category best describes the story engine or nonfiction purpose.`;
}

export function getSubgenreDescription(subgenre) {
  if (!subgenre) return '';
  return SUBGENRE_DESCRIPTIONS[subgenre] || `${humanizeOptionLabel(subgenre)} detail lane. Use this to steer the project toward that more specific angle.`;
}

export const CANON_MODES = [
  { value: 'strict_canon', label: 'Strict Canon' },
  { value: 'canon_compliant', label: 'Canon-Compliant' },
  { value: 'canon_divergent', label: 'Canon Divergent' },
  { value: 'alternate_universe', label: 'Alternate Universe' },
  { value: 'crossover', label: 'Crossover' },
  { value: 'fix_it', label: 'Fix-It Fic' },
  { value: 'missing_episode', label: 'Missing Episode' },
  { value: 'next_generation', label: 'Next Generation / Legacy' },
  { value: 'oc_in_canon', label: 'Original Character in Canon World' },
];

export function getContentLane(value = {}) {
  if (value.content_lane) return value.content_lane;
  if (value.rights_mode === 'fanfiction_noncommercial') return 'fanfiction';
  if (isNonfictionProject(value)) return 'nonfiction';
  if (/erotic|erotica/i.test(value.genre || '')) return 'erotica';
  return 'fiction';
}

export function getBookTypeForLane(lane) {
  const found = CONTENT_LANES.find((item) => item.value === lane);
  return found?.defaultBookType || 'fiction';
}

export function getDefaultRightsModeForLane(lane) {
  const found = CONTENT_LANES.find((item) => item.value === lane);
  return found?.defaultRightsMode || 'original';
}

export function getProjectFormatsForLane(lane) {
  return PROJECT_FORMATS_BY_LANE[lane] || PROJECT_FORMATS_BY_LANE.fiction;
}

export function getGenreGroupsForLane(lane) {
  return GENRE_GROUPS_BY_LANE[lane] || GENRE_GROUPS_BY_LANE.fiction;
}



export function getGenreFamilyOptionsForLane(lane) {
  return getGenreGroupsForLane(lane).map((group) => ({
    value: group.group,
    label: group.group,
    count: group.options.length,
  }));
}

export function getGenreFamilyForGenre(lane, genre) {
  const groups = getGenreGroupsForLane(lane);
  const found = groups.find((group) => group.options.includes(genre));
  return found?.group || groups[0]?.group || '';
}

export function getGenreOptionsForFamily(lane, family) {
  const groups = getGenreGroupsForLane(lane);
  const selected = groups.find((group) => group.group === family) || groups[0];
  return selected?.options || [];
}

export function getSubgenreOptionsForSelection(lane, genre, family) {
  const direct = getSubgenresForGenre(genre);
  if (direct.length) return direct;
  const resolvedFamily = family || getGenreFamilyForGenre(lane, genre);
  return SUBGENRE_FALLBACKS_BY_GROUP?.[lane]?.[resolvedFamily] || [];
}

export function normalizeGenreSelectionForLane(lane, current = {}) {
  const familyOptions = getGenreFamilyOptionsForLane(lane);
  const currentGenre = current.genre || '';
  const preferredFamily = current.genre_group || getGenreFamilyForGenre(lane, currentGenre) || familyOptions[0]?.value || '';
  const family = familyOptions.some((item) => item.value === preferredFamily)
    ? preferredFamily
    : familyOptions[0]?.value || '';
  const genreOptions = getGenreOptionsForFamily(lane, family);
  const genre = genreOptions.includes(currentGenre) ? currentGenre : genreOptions[0] || '';
  const subgenreOptions = getSubgenreOptionsForSelection(lane, genre, family);
  const subgenre = subgenreOptions.includes(current.subgenre) ? current.subgenre : current.subgenre || '';

  return { family, genre, subgenre, familyOptions, genreOptions, subgenreOptions };
}

export function getFlatGenresForLane(lane) {
  const groups = getGenreGroupsForLane(lane);
  return Array.from(new Set(groups.flatMap((group) => group.options)));
}

export function getSubgenresForGenre(genre) {
  return SUBGENRES_BY_GENRE[genre] || [];
}

export function isAnthologyFormat(format) {
  return format === 'anthology';
}

export function getProjectTypeForFormat(bookType, format) {
  if (format === 'anthology') return 'anthology';
  return bookType || 'fiction';
}

export function isFanfictionLane(laneOrValues) {
  if (typeof laneOrValues === 'string') return laneOrValues === 'fanfiction';
  return getContentLane(laneOrValues) === 'fanfiction';
}

export function isEroticaLane(laneOrValues) {
  if (typeof laneOrValues === 'string') return laneOrValues === 'erotica';
  return getContentLane(laneOrValues) === 'erotica';
}

export function getCommercialUseAllowed(values = {}) {
  if (values.rights_mode === 'fanfiction_noncommercial') return false;
  return true;
}