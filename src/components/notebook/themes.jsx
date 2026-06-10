/* ══════════════════════ Notebook themes ══════════════════════
   12 cover-and-page directions. Each theme provides:
     cover:      gradient + overlays + stitching/ribbon/monogram colors
     pageStack:  the cream/tinted ring around the inner page
     page:       inner page bg, ruling, margin-line, ink color
     type:       heading + body font stacks
     accent:     a single accent used for phase dots, active states
*/

export const THEMES = {
  classic: {
    label: 'Classic Library',
    description: 'Warm leather · cream paper · Cormorant',
    cover: {
      gradient: 'radial-gradient(ellipse 70% 50% at 25% 15%, rgba(255,220,175,.22), transparent 55%), radial-gradient(ellipse 50% 35% at 85% 92%, rgba(25,12,4,.5), transparent 50%), linear-gradient(135deg, #8a6540 0%, #6e4d2e 50%, #4f3518 100%)',
      stitching: 'rgba(255,225,180,.32)',
      ribbon: 'linear-gradient(180deg, #c94a3e 0%, #a82a20 100%)',
      monogramColor: 'rgba(25,12,4,.55)',
      pattern: null,
    },
    pageStack: {
      background: 'linear-gradient(to right, rgba(120,85,45,.25), transparent 12%, transparent 88%, rgba(120,85,45,.25)), repeating-linear-gradient(to bottom, #fdf6e4 0px, #fdf6e4 3px, rgba(160,125,80,.5) 3px, rgba(160,125,80,.5) 3.6px, #f5ead1 3.6px, #f5ead1 6.6px)',
      ringShadow: '0 0 0 1px rgba(60,40,18,.45), 0 2px 6px rgba(35,24,12,.22) inset, 0 -1px 0 rgba(255,245,220,.7) inset, 1px 0 0 rgba(80,55,25,.3) inset, -1px 0 0 rgba(255,240,210,.5) inset',
    },
    page: {
      bg: '#fffdf5',
      innerBg: '#f5ecd8',
      ruling: 'rgba(80, 130, 170, 0.22)',
      margin: 'rgba(220, 80, 80, 0.35)',
      ink: '#2a2218',
      headerBorder: 'rgba(120,95,60,.12)',
      railBorder: 'rgba(120,95,60,.15)',
    },
    type: { heading: 'Cormorant Garamond, serif', body: 'Inter, sans-serif' },
    accent: '#b48a57',
    swatch: ['#8a6540', '#f5ecd8', '#c94a3e'],
  },

  gothic: {
    label: 'Gothic & Creepy',
    description: 'Black leather · candlelit page · gothic serif',
    cover: {
      gradient: 'radial-gradient(ellipse 70% 50% at 25% 15%, rgba(140,80,180,.12), transparent 55%), radial-gradient(ellipse 50% 35% at 85% 92%, rgba(0,0,0,.6), transparent 50%), linear-gradient(135deg, #1a0f14 0%, #0a0506 50%, #180a14 100%)',
      stitching: 'rgba(180,60,60,.4)',
      ribbon: 'linear-gradient(180deg, #8b0000 0%, #4a0000 100%)',
      monogramColor: 'rgba(180,60,60,.6)',
      pattern: 'radial-gradient(circle at 20% 30%, rgba(255,200,100,.04) 0%, transparent 18%), radial-gradient(circle at 78% 70%, rgba(180,60,60,.08) 0%, transparent 22%)',
    },
    pageStack: {
      background: 'linear-gradient(to right, rgba(20,10,15,.6), transparent 12%, transparent 88%, rgba(20,10,15,.6)), repeating-linear-gradient(to bottom, #3a2a32 0px, #3a2a32 3px, rgba(0,0,0,.5) 3px, rgba(0,0,0,.5) 3.6px, #2a1a22 3.6px, #2a1a22 6.6px)',
      ringShadow: '0 0 0 1px rgba(0,0,0,.7), 0 2px 6px rgba(0,0,0,.4) inset, 0 -1px 0 rgba(120,80,100,.3) inset, 1px 0 0 rgba(0,0,0,.5) inset, -1px 0 0 rgba(120,80,100,.2) inset',
    },
    page: {
      bg: '#1f1820',
      innerBg: '#2a2028',
      ruling: 'rgba(180, 60, 60, 0.18)',
      margin: 'rgba(200, 80, 80, 0.4)',
      ink: '#e8ddc8',
      headerBorder: 'rgba(180,60,60,.15)',
      railBorder: 'rgba(180,60,60,.12)',
    },
    type: { heading: 'Cormorant Garamond, serif', body: 'Cormorant Garamond, serif' },
    accent: '#b05050',
    swatch: ['#0a0506', '#2a2028', '#8b0000'],
  },

  stainedGlass: {
    label: 'Stained Glass',
    description: 'Cathedral glass · illuminated page · ornate',
    cover: {
      gradient: 'linear-gradient(135deg, #0a4a5e 0%, #1a3a54 50%, #0c2040 100%)',
      stitching: 'rgba(212,175,55,.45)',
      ribbon: 'linear-gradient(180deg, #8b1c3a 0%, #4a0c20 100%)',
      monogramColor: 'rgba(212,175,55,.75)',
      pattern: 'conic-gradient(from 45deg at 30% 40%, rgba(220,60,80,.22), rgba(60,180,200,.18), rgba(240,200,80,.22), rgba(60,100,180,.2), rgba(220,60,80,.22)), radial-gradient(circle at 70% 70%, rgba(240,200,80,.15) 0%, transparent 25%)',
    },
    pageStack: {
      background: 'linear-gradient(to right, rgba(100,80,50,.35), transparent 12%, transparent 88%, rgba(100,80,50,.35)), repeating-linear-gradient(to bottom, #f8efd8 0px, #f8efd8 3px, rgba(160,130,80,.4) 3px, rgba(160,130,80,.4) 3.6px, #f0e5c8 3.6px, #f0e5c8 6.6px)',
      ringShadow: '0 0 0 1px rgba(80,55,25,.55), 0 2px 6px rgba(35,24,12,.22) inset, 0 -1px 0 rgba(255,240,200,.6) inset, 1px 0 0 rgba(80,55,25,.3) inset, -1px 0 0 rgba(255,235,195,.4) inset',
    },
    page: {
      bg: '#faf4df',
      innerBg: '#f0e5c8',
      ruling: 'rgba(100, 80, 140, 0.2)',
      margin: 'rgba(180, 40, 60, 0.4)',
      ink: '#2a1a1f',
      headerBorder: 'rgba(100,60,40,.18)',
      railBorder: 'rgba(100,60,40,.18)',
    },
    type: { heading: 'Cinzel, serif', body: 'EB Garamond, serif' },
    accent: '#8b1c3a',
    swatch: ['#0a4a5e', '#faf4df', '#d4af37'],
  },

  botanical: {
    label: 'Flowery Botanical',
    description: 'Pressed flowers · cream paper · script',
    cover: {
      gradient: 'radial-gradient(ellipse 60% 40% at 30% 20%, rgba(255,220,230,.35), transparent 55%), radial-gradient(ellipse 40% 30% at 75% 80%, rgba(180,200,150,.25), transparent 50%), linear-gradient(160deg, #f0e0cc 0%, #e8d5b8 50%, #d8c0a0 100%)',
      stitching: 'rgba(140,100,80,.3)',
      ribbon: 'linear-gradient(180deg, #c87a8f 0%, #9a4a60 100%)',
      monogramColor: 'rgba(120,80,60,.55)',
      pattern: 'radial-gradient(circle at 15% 20%, rgba(200,120,140,.18) 0%, transparent 8%), radial-gradient(circle at 85% 15%, rgba(160,180,120,.2) 0%, transparent 10%), radial-gradient(circle at 10% 85%, rgba(180,140,100,.15) 0%, transparent 9%), radial-gradient(circle at 90% 80%, rgba(220,160,140,.2) 0%, transparent 11%)',
    },
    pageStack: {
      background: 'linear-gradient(to right, rgba(180,140,100,.22), transparent 12%, transparent 88%, rgba(180,140,100,.22)), repeating-linear-gradient(to bottom, #fbf5e8 0px, #fbf5e8 3px, rgba(180,150,110,.35) 3px, rgba(180,150,110,.35) 3.6px, #f3ecd8 3.6px, #f3ecd8 6.6px)',
      ringShadow: '0 0 0 1px rgba(140,100,70,.4), 0 2px 6px rgba(100,70,50,.15) inset, 0 -1px 0 rgba(255,250,235,.7) inset, 1px 0 0 rgba(140,100,70,.2) inset, -1px 0 0 rgba(255,250,235,.5) inset',
    },
    page: {
      bg: '#fdf9ee',
      innerBg: '#f5ecd8',
      ruling: 'rgba(160, 130, 100, 0.22)',
      margin: 'rgba(200, 120, 140, 0.4)',
      ink: '#3a2a1e',
      headerBorder: 'rgba(140,100,70,.18)',
      railBorder: 'rgba(140,100,70,.18)',
    },
    type: { heading: 'Pinyon Script, cursive', body: 'Cormorant Garamond, serif' },
    accent: '#c87a8f',
    swatch: ['#e8d5b8', '#fdf9ee', '#c87a8f'],
  },

  denim: {
    label: 'Denim & Patchwork',
    description: 'Denim and leather patches · muslin page',
    cover: {
      gradient: 'linear-gradient(120deg, #3a5a7a 0%, #2a4a6a 30%, #8b5a3c 30%, #6a4028 60%, #4a6a8a 60%, #3a5a7a 100%)',
      stitching: 'rgba(240,200,120,.5)',
      ribbon: 'linear-gradient(180deg, #c49a5a 0%, #8a6a30 100%)',
      monogramColor: 'rgba(240,200,120,.65)',
      pattern: 'repeating-linear-gradient(45deg, transparent 0, transparent 2px, rgba(0,0,0,.1) 2px, rgba(0,0,0,.1) 3px), repeating-linear-gradient(-45deg, transparent 0, transparent 2px, rgba(255,255,255,.06) 2px, rgba(255,255,255,.06) 3px)',
    },
    pageStack: {
      background: 'linear-gradient(to right, rgba(140,115,85,.3), transparent 12%, transparent 88%, rgba(140,115,85,.3)), repeating-linear-gradient(to bottom, #f5ecd8 0px, #f5ecd8 3px, rgba(170,145,110,.45) 3px, rgba(170,145,110,.45) 3.6px, #ebe0c4 3.6px, #ebe0c4 6.6px)',
      ringShadow: '0 0 0 1px rgba(80,60,40,.5), 0 2px 6px rgba(35,24,12,.2) inset, 0 -1px 0 rgba(255,245,220,.6) inset, 1px 0 0 rgba(80,55,25,.3) inset, -1px 0 0 rgba(255,240,210,.4) inset',
    },
    page: {
      bg: '#faf3e0',
      innerBg: '#ede2c4',
      ruling: 'rgba(120, 130, 160, 0.22)',
      margin: 'rgba(200, 100, 80, 0.35)',
      ink: '#2a2a2a',
      headerBorder: 'rgba(80,80,120,.15)',
      railBorder: 'rgba(80,80,120,.15)',
    },
    type: { heading: 'Caveat, cursive', body: 'Inter, sans-serif' },
    accent: '#3a5a7a',
    swatch: ['#3a5a7a', '#8b5a3c', '#c49a5a'],
  },

  nautical: {
    label: 'Nautical & Map',
    description: 'Navy leather · aged parchment · compass',
    cover: {
      gradient: 'radial-gradient(ellipse 60% 40% at 25% 20%, rgba(180,200,240,.18), transparent 55%), radial-gradient(ellipse 50% 35% at 85% 90%, rgba(5,15,35,.6), transparent 50%), linear-gradient(135deg, #1a3558 0%, #0f2040 50%, #08152e 100%)',
      stitching: 'rgba(212,175,55,.4)',
      ribbon: 'linear-gradient(180deg, #c49a4a 0%, #8a6a30 100%)',
      monogramColor: 'rgba(212,175,55,.7)',
      pattern: null,
    },
    pageStack: {
      background: 'linear-gradient(to right, rgba(120,85,45,.3), transparent 12%, transparent 88%, rgba(120,85,45,.3)), repeating-linear-gradient(to bottom, #efe0b8 0px, #efe0b8 3px, rgba(160,125,80,.5) 3px, rgba(160,125,80,.5) 3.6px, #e5d5a8 3.6px, #e5d5a8 6.6px)',
      ringShadow: '0 0 0 1px rgba(60,40,18,.5), 0 2px 6px rgba(35,24,12,.22) inset, 0 -1px 0 rgba(255,240,200,.6) inset, 1px 0 0 rgba(80,55,25,.3) inset, -1px 0 0 rgba(255,240,200,.4) inset',
    },
    page: {
      bg: '#f5e9c5',
      innerBg: '#e8d9a8',
      ruling: 'rgba(140, 100, 50, 0.25)',
      margin: 'rgba(180, 80, 40, 0.4)',
      ink: '#2a1a0e',
      headerBorder: 'rgba(140,100,50,.22)',
      railBorder: 'rgba(140,100,50,.18)',
    },
    type: { heading: 'IM Fell English, serif', body: 'EB Garamond, serif' },
    accent: '#d4af37',
    swatch: ['#0f2040', '#f5e9c5', '#d4af37'],
  },

  alchemy: {
    label: 'Ancient Scroll',
    description: 'Aged tan leather · crinkled parchment',
    cover: {
      gradient: 'radial-gradient(ellipse 70% 50% at 30% 25%, rgba(230,190,130,.4), transparent 55%), radial-gradient(ellipse 50% 35% at 80% 85%, rgba(60,35,15,.45), transparent 50%), linear-gradient(135deg, #c49660 0%, #9a6d3c 50%, #6a4a24 100%)',
      stitching: 'rgba(255,225,170,.4)',
      ribbon: 'linear-gradient(180deg, #8a5a28 0%, #5a3a18 100%)',
      monogramColor: 'rgba(50,30,10,.7)',
      pattern: 'radial-gradient(circle at 50% 50%, transparent 18%, rgba(60,35,15,.1) 18.5%, transparent 19.5%), radial-gradient(circle at 50% 50%, transparent 23%, rgba(60,35,15,.08) 23.5%, transparent 24.5%)',
    },
    pageStack: {
      background: 'linear-gradient(to right, rgba(140,90,45,.35), transparent 12%, transparent 88%, rgba(140,90,45,.35)), repeating-linear-gradient(to bottom, #ebd9a8 0px, #ebd9a8 3px, rgba(170,120,65,.5) 3px, rgba(170,120,65,.5) 3.6px, #dfcc98 3.6px, #dfcc98 6.6px)',
      ringShadow: '0 0 0 1px rgba(60,35,15,.55), 0 2px 6px rgba(60,35,15,.25) inset, 0 -1px 0 rgba(255,235,195,.5) inset, 1px 0 0 rgba(60,35,15,.3) inset, -1px 0 0 rgba(255,235,195,.35) inset',
    },
    page: {
      bg: '#efdea8',
      innerBg: '#ddc890',
      ruling: 'rgba(120, 70, 30, 0.2)',
      margin: 'rgba(160, 70, 30, 0.4)',
      ink: '#2a1808',
      headerBorder: 'rgba(120,70,30,.22)',
      railBorder: 'rgba(120,70,30,.18)',
    },
    type: { heading: 'IM Fell English, serif', body: 'IM Fell English, serif' },
    accent: '#9a6d3c',
    swatch: ['#9a6d3c', '#efdea8', '#5a3a18'],
  },

  cosmic: {
    label: 'Cosmic Galaxy',
    description: 'Deep space cover · starfield page',
    cover: {
      gradient: 'radial-gradient(ellipse 55% 35% at 30% 25%, rgba(180,140,220,.3), transparent 55%), radial-gradient(ellipse 40% 25% at 75% 70%, rgba(80,100,220,.35), transparent 50%), radial-gradient(ellipse 30% 20% at 85% 30%, rgba(220,100,180,.2), transparent 50%), linear-gradient(135deg, #1a0a2e 0%, #0a0520 50%, #15052a 100%)',
      stitching: 'rgba(200,180,240,.35)',
      ribbon: 'linear-gradient(180deg, #9d5ad8 0%, #4a1e8a 100%)',
      monogramColor: 'rgba(200,180,240,.7)',
      pattern: 'radial-gradient(1.5px 1.5px at 12% 18%, white, transparent), radial-gradient(1px 1px at 28% 42%, white, transparent), radial-gradient(1.2px 1.2px at 54% 28%, white, transparent), radial-gradient(0.8px 0.8px at 72% 62%, white, transparent), radial-gradient(1.5px 1.5px at 86% 22%, white, transparent), radial-gradient(1px 1px at 92% 78%, white, transparent)',
    },
    pageStack: {
      background: 'linear-gradient(to right, rgba(40,25,60,.6), transparent 12%, transparent 88%, rgba(40,25,60,.6)), repeating-linear-gradient(to bottom, #2a1f48 0px, #2a1f48 3px, rgba(10,5,20,.6) 3px, rgba(10,5,20,.6) 3.6px, #1f1538 3.6px, #1f1538 6.6px)',
      ringShadow: '0 0 0 1px rgba(0,0,10,.7), 0 2px 6px rgba(0,0,10,.4) inset, 0 -1px 0 rgba(160,140,220,.3) inset, 1px 0 0 rgba(0,0,10,.5) inset, -1px 0 0 rgba(160,140,220,.2) inset',
    },
    page: {
      bg: '#14102a',
      innerBg: '#1a1530',
      ruling: 'rgba(180, 160, 240, 0.14)',
      margin: 'rgba(220, 130, 210, 0.35)',
      ink: '#e4dff5',
      headerBorder: 'rgba(180,160,240,.15)',
      railBorder: 'rgba(180,160,240,.1)',
    },
    type: { heading: 'Space Grotesk, sans-serif', body: 'Inter, sans-serif' },
    accent: '#9d5ad8',
    swatch: ['#0a0520', '#14102a', '#9d5ad8'],
  },

  steampunk: {
    label: 'Steampunk',
    description: 'Brass & copper · sepia paper · industrial',
    cover: {
      gradient: 'radial-gradient(ellipse 60% 40% at 25% 25%, rgba(240,200,120,.3), transparent 55%), radial-gradient(ellipse 45% 35% at 80% 85%, rgba(60,30,10,.55), transparent 50%), linear-gradient(135deg, #7a4e22 0%, #5a3812 50%, #3a240c 100%)',
      stitching: 'rgba(255,210,140,.35)',
      ribbon: 'linear-gradient(180deg, #9a6520 0%, #5a3812 100%)',
      monogramColor: 'rgba(255,210,140,.65)',
      pattern: 'radial-gradient(circle at 15% 80%, transparent 28px, rgba(200,150,80,.15) 29px, rgba(200,150,80,.15) 32px, transparent 33px), radial-gradient(circle at 15% 80%, transparent 14px, rgba(200,150,80,.2) 15px, rgba(200,150,80,.2) 17px, transparent 18px), radial-gradient(circle at 85% 15%, transparent 20px, rgba(200,150,80,.18) 21px, rgba(200,150,80,.18) 23px, transparent 24px)',
    },
    pageStack: {
      background: 'linear-gradient(to right, rgba(140,95,45,.35), transparent 12%, transparent 88%, rgba(140,95,45,.35)), repeating-linear-gradient(to bottom, #ead7a8 0px, #ead7a8 3px, rgba(170,125,70,.5) 3px, rgba(170,125,70,.5) 3.6px, #ddc890 3.6px, #ddc890 6.6px)',
      ringShadow: '0 0 0 1px rgba(60,40,15,.55), 0 2px 6px rgba(60,40,15,.22) inset, 0 -1px 0 rgba(255,235,195,.55) inset, 1px 0 0 rgba(60,40,15,.3) inset, -1px 0 0 rgba(255,235,195,.35) inset',
    },
    page: {
      bg: '#eedcab',
      innerBg: '#dfc890',
      ruling: 'rgba(140, 100, 50, 0.3)',
      margin: 'rgba(180, 100, 50, 0.42)',
      ink: '#2a1a08',
      headerBorder: 'rgba(140,100,50,.22)',
      railBorder: 'rgba(140,100,50,.18)',
    },
    type: { heading: 'IM Fell English, serif', body: 'Inter, sans-serif' },
    accent: '#b8832a',
    swatch: ['#5a3812', '#eedcab', '#b8832a'],
  },

  street: {
    label: 'Urban Street Art',
    description: 'Concrete & spray paint · crisp white page',
    cover: {
      gradient: 'linear-gradient(135deg, #3a3833 0%, #242220 50%, #0f0e0d 100%)',
      stitching: 'rgba(240,80,60,.4)',
      ribbon: 'linear-gradient(180deg, #f05030 0%, #b02010 100%)',
      monogramColor: 'rgba(240,240,240,.85)',
      pattern: 'radial-gradient(ellipse 30% 20% at 75% 25%, rgba(240,80,60,.3), transparent 60%), radial-gradient(ellipse 25% 18% at 20% 70%, rgba(100,200,240,.22), transparent 60%), radial-gradient(ellipse 20% 15% at 60% 60%, rgba(240,200,60,.18), transparent 60%)',
    },
    pageStack: {
      background: 'linear-gradient(to right, rgba(100,100,100,.3), transparent 12%, transparent 88%, rgba(100,100,100,.3)), repeating-linear-gradient(to bottom, #ffffff 0px, #ffffff 3px, rgba(150,150,150,.45) 3px, rgba(150,150,150,.45) 3.6px, #f0f0f0 3.6px, #f0f0f0 6.6px)',
      ringShadow: '0 0 0 1px rgba(40,40,40,.5), 0 2px 6px rgba(0,0,0,.18) inset, 0 -1px 0 rgba(255,255,255,.8) inset, 1px 0 0 rgba(40,40,40,.2) inset, -1px 0 0 rgba(255,255,255,.6) inset',
    },
    page: {
      bg: '#ffffff',
      innerBg: '#f4f4f3',
      ruling: 'rgba(100, 100, 100, 0.18)',
      margin: 'rgba(240, 80, 60, 0.5)',
      ink: '#111111',
      headerBorder: 'rgba(40,40,40,.15)',
      railBorder: 'rgba(40,40,40,.12)',
    },
    type: { heading: 'Archivo Black, sans-serif', body: 'Inter, sans-serif' },
    accent: '#f05030',
    swatch: ['#0f0e0d', '#ffffff', '#f05030'],
  },

  minimal: {
    label: 'Minimalist Modern',
    description: 'Off-white cover · clean white page',
    cover: {
      gradient: 'linear-gradient(135deg, #ebe8e2 0%, #d4d0c8 50%, #b8b4ac 100%)',
      stitching: 'rgba(100,95,85,.25)',
      ribbon: 'linear-gradient(180deg, #444 0%, #111 100%)',
      monogramColor: 'rgba(40,40,40,.55)',
      pattern: null,
    },
    pageStack: {
      background: 'linear-gradient(to right, rgba(180,180,180,.35), transparent 12%, transparent 88%, rgba(180,180,180,.35)), repeating-linear-gradient(to bottom, #ffffff 0px, #ffffff 3px, rgba(180,180,180,.35) 3px, rgba(180,180,180,.35) 3.6px, #f6f6f5 3.6px, #f6f6f5 6.6px)',
      ringShadow: '0 0 0 1px rgba(120,115,105,.45), 0 2px 6px rgba(0,0,0,.08) inset, 0 -1px 0 rgba(255,255,255,.7) inset, 1px 0 0 rgba(120,115,105,.2) inset, -1px 0 0 rgba(255,255,255,.5) inset',
    },
    page: {
      bg: '#ffffff',
      innerBg: '#f6f6f5',
      ruling: 'rgba(120, 120, 120, 0.14)',
      margin: 'rgba(120, 120, 120, 0.25)',
      ink: '#1a1a1a',
      headerBorder: 'rgba(120,115,105,.18)',
      railBorder: 'rgba(120,115,105,.12)',
    },
    type: { heading: 'Inter, sans-serif', body: 'Inter, sans-serif' },
    accent: '#1a1a1a',
    swatch: ['#ebe8e2', '#ffffff', '#1a1a1a'],
  },

  fantasy: {
    label: 'Art Nouveau Fantasy',
    description: 'Emerald green · gold scrollwork',
    cover: {
      gradient: 'radial-gradient(ellipse 60% 40% at 30% 20%, rgba(180,220,190,.2), transparent 55%), radial-gradient(ellipse 45% 35% at 80% 85%, rgba(10,30,20,.55), transparent 50%), linear-gradient(135deg, #1f4a3a 0%, #163528 50%, #0d2018 100%)',
      stitching: 'rgba(212,175,55,.45)',
      ribbon: 'linear-gradient(180deg, #d4af37 0%, #8a6e1a 100%)',
      monogramColor: 'rgba(212,175,55,.8)',
      pattern: 'radial-gradient(circle at 50% 20%, transparent 48px, rgba(212,175,55,.18) 49px, rgba(212,175,55,.18) 51px, transparent 52px), radial-gradient(circle at 50% 20%, transparent 58px, rgba(212,175,55,.14) 59px, rgba(212,175,55,.14) 61px, transparent 62px), radial-gradient(ellipse 30% 15% at 50% 80%, rgba(212,175,55,.15), transparent 70%)',
    },
    pageStack: {
      background: 'linear-gradient(to right, rgba(120,85,45,.3), transparent 12%, transparent 88%, rgba(120,85,45,.3)), repeating-linear-gradient(to bottom, #f8efd6 0px, #f8efd6 3px, rgba(160,125,80,.45) 3px, rgba(160,125,80,.45) 3.6px, #efe3c2 3.6px, #efe3c2 6.6px)',
      ringShadow: '0 0 0 1px rgba(60,40,18,.5), 0 2px 6px rgba(35,24,12,.2) inset, 0 -1px 0 rgba(255,245,215,.6) inset, 1px 0 0 rgba(80,55,25,.3) inset, -1px 0 0 rgba(255,245,215,.4) inset',
    },
    page: {
      bg: '#fcf5dd',
      innerBg: '#efe3c2',
      ruling: 'rgba(100, 140, 100, 0.22)',
      margin: 'rgba(160, 120, 50, 0.4)',
      ink: '#1c2a1e',
      headerBorder: 'rgba(100,140,100,.2)',
      railBorder: 'rgba(100,140,100,.18)',
    },
    type: { heading: 'Italianno, cursive', body: 'EB Garamond, serif' },
    accent: '#d4af37',
    swatch: ['#163528', '#fcf5dd', '#d4af37'],
  },
};

export const THEME_IDS = Object.keys(THEMES);