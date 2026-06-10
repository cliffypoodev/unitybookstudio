/**
 * Cover Production System — Comprehensive Browser QA Test
 * 
 * Uses puppeteer-core to drive Chrome against the running dev server.
 * Saves screenshots and writes a detailed findings report.
 */

import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = __dirname; // screenshots go here
const APP = 'http://localhost:5173';

mkdirSync(OUT, { recursive: true });

const findings = [];
const screenshots = [];

function log(msg) {
  console.log(`[QA] ${msg}`);
  findings.push(msg);
}

function logScreenshot(name, desc) {
  screenshots.push({ name, desc });
  log(`📸 Screenshot: ${name} — ${desc}`);
}

async function safeScreenshot(page, name, desc) {
  const path = join(OUT, name);
  try {
    await page.screenshot({ path, fullPage: false });
    logScreenshot(name, desc);
  } catch (err) {
    log(`⚠️ Screenshot failed for ${name}: ${err.message}`);
  }
}

async function safeFullScreenshot(page, name, desc) {
  const path = join(OUT, name);
  try {
    await page.screenshot({ path, fullPage: true });
    logScreenshot(name, desc);
  } catch (err) {
    log(`⚠️ Full-page screenshot failed for ${name}: ${err.message}`);
  }
}

async function safeClick(page, selector, label) {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.click(selector);
    log(`✅ Clicked: ${label} (${selector})`);
    return true;
  } catch (err) {
    log(`❌ Could not click ${label} (${selector}): ${err.message}`);
    return false;
  }
}

async function safeFill(page, selector, value, label) {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.click(selector, { clickCount: 3 });
    await page.type(selector, value);
    log(`✅ Filled: ${label} = "${value}" (${selector})`);
    return true;
  } catch (err) {
    log(`❌ Could not fill ${label} (${selector}): ${err.message}`);
    return false;
  }
}

async function safeSelect(page, selector, value, label) {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.select(selector, value);
    log(`✅ Selected: ${label} = "${value}" (${selector})`);
    return true;
  } catch (err) {
    log(`❌ Could not select ${label} (${selector}): ${err.message}`);
    return false;
  }
}

async function checkExists(page, selector, label) {
  try {
    const el = await page.$(selector);
    if (el) {
      log(`✅ Found: ${label} (${selector})`);
      return true;
    } else {
      log(`❌ Not found: ${label} (${selector})`);
      return false;
    }
  } catch (err) {
    log(`❌ Error checking ${label} (${selector}): ${err.message}`);
    return false;
  }
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function clickByText(page, text, tag = 'button') {
  try {
    const found = await page.evaluate((text, tag) => {
      const elements = document.querySelectorAll(tag);
      for (const el of elements) {
        if (el.textContent?.includes(text)) {
          el.click();
          return true;
        }
      }
      return false;
    }, text, tag);
    if (found) {
      log(`✅ Clicked by text: "${text}" (${tag})`);
      return true;
    } else {
      log(`❌ Could not find element with text "${text}" (${tag})`);
      return false;
    }
  } catch (err) {
    log(`❌ Error clicking by text "${text}": ${err.message}`);
    return false;
  }
}

async function toggleCheckbox(page, selector, label) {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.click(selector);
    const checked = await page.$eval(selector, el => el.checked);
    log(`✅ Toggled: ${label} (now ${checked ? 'checked' : 'unchecked'})`);
    return true;
  } catch (err) {
    log(`❌ Could not toggle ${label} (${selector}): ${err.message}`);
    return false;
  }
}

// ─── Main Test Runner ───────────────────────────────────────────────

(async () => {
  log('═══════════════════════════════════════════════════════════');
  log('  Cover Production System — Browser QA Test');
  log('  Started: ' + new Date().toISOString());
  log('═══════════════════════════════════════════════════════════');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1440,900',
    ],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(10000);

  try {
    // ═══════════════════════════════════════════
    // STEP 1: Navigate to Dashboard & Open Project
    // ═══════════════════════════════════════════
    log('\n── STEP 1: Navigate to Dashboard & Open Project ──');

    await page.goto(APP, { waitUntil: 'networkidle2', timeout: 30000 });
    log('✅ Navigated to ' + APP);
    await wait(2000);
    await safeScreenshot(page, '01-dashboard.png', 'Dashboard / landing page');

    // Check for project list or cards
    const hasProjectCards = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="card"], [class*="project"], [class*="Card"]');
      const links = document.querySelectorAll('a[href*="/project"]');
      return { cardCount: cards.length, linkCount: links.length };
    });
    log(`Dashboard scan: ${hasProjectCards.cardCount} card-like elements, ${hasProjectCards.linkCount} project links`);

    // Try to find and click first project
    const projectClicked = await page.evaluate(() => {
      // Try project links first
      const links = document.querySelectorAll('a[href*="/project"]');
      if (links.length > 0) {
        links[0].click();
        return { method: 'link', text: links[0].textContent?.trim()?.slice(0, 50) };
      }

      // Try clickable cards/rows
      const rows = document.querySelectorAll('tr[class*="cursor"], div[class*="cursor-pointer"]');
      if (rows.length > 0) {
        rows[0].click();
        return { method: 'row', text: rows[0].textContent?.trim()?.slice(0, 50) };
      }

      // Try any table row
      const tableRows = document.querySelectorAll('tbody tr');
      if (tableRows.length > 0) {
        tableRows[0].click();
        return { method: 'table-row', text: tableRows[0].textContent?.trim()?.slice(0, 50) };
      }

      return null;
    });

    if (projectClicked) {
      log(`✅ Clicked project: ${projectClicked.method} — "${projectClicked.text}"`);
      await wait(3000);
    } else {
      log('⚠️ No project found to click. Trying direct URL navigation...');
      // Try navigating to a project URL directly
      await page.goto(APP + '/projects', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await wait(2000);
      
      // Try again 
      const retryClick = await page.evaluate(() => {
        const allClickable = document.querySelectorAll('a, button, tr, [role="button"], [class*="clickable"], [class*="cursor"]');
        for (const el of allClickable) {
          if (el.textContent?.length > 5 && el.textContent?.length < 200 && !el.textContent?.includes('Sign') && !el.textContent?.includes('Log')) {
            el.click();
            return el.textContent?.trim()?.slice(0, 50);
          }
        }
        return null;
      });
      if (retryClick) log(`✅ Retry clicked: "${retryClick}"`);
      else log('⚠️ Could not find any project to open');
      await wait(3000);
    }

    await safeScreenshot(page, '02-project-opened.png', 'After opening a project');

    // Look for the Cover tab
    log('\nLooking for Cover tab...');
    
    // Check what tabs exist
    const tabInfo = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const tabs = [];
      buttons.forEach(b => {
        const text = b.textContent?.trim();
        if (text && text.length < 40) tabs.push(text);
      });
      return tabs.filter(t => t.length > 1 && t.length < 30);
    });
    log(`Available buttons/tabs: ${tabInfo.slice(0, 20).join(' | ')}`);

    // Click Cover tab
    const coverClicked = await clickByText(page, 'Cover', 'button');
    if (!coverClicked) {
      // Try as link
      await clickByText(page, 'Cover', 'a');
    }
    await wait(2000);
    await safeScreenshot(page, '03-cover-tab.png', 'Cover tab opened');

    // ═══════════════════════════════════════════
    // STEP 2: Test Advanced Local Generation Panel
    // ═══════════════════════════════════════════
    log('\n── STEP 2: Advanced Local Generation Panel ──');

    // Click the Advanced Local Generation toggle
    const advToggle = await clickByText(page, 'Advanced Local Generation', 'button');
    if (!advToggle) {
      log('⚠️ Trying alternative selectors for Advanced panel toggle...');
      await safeClick(page, 'button:has(> span:has(.lucide-settings-2))', 'Settings toggle');
    }
    await wait(1000);
    await safeScreenshot(page, '04-advanced-panel-open.png', 'Advanced Local Generation panel expanded');

    // Check for elements in the panel
    log('\nChecking Advanced Local Generation elements:');
    await checkExists(page, '#comfy-url-input', 'ComfyUI URL field');
    await checkExists(page, '#test-comfy-connection', 'Test Connection button');
    await checkExists(page, '#model-pipeline-selector', 'Model Pipeline selector');
    await checkExists(page, '#genre-template-selector', 'Genre Template selector');
    await checkExists(page, '#size-preset-selector', 'Size Preset selector');
    await checkExists(page, '#typography-mode-selector', 'Typography Mode selector');
    await checkExists(page, '#lighting-field', 'Lighting field');
    await checkExists(page, '#palette-field', 'Palette field');
    await checkExists(page, '#auto-build-prompt', 'Auto-Build Prompt button');
    await checkExists(page, '#adv-positive-prompt', 'Positive Prompt textarea');
    await checkExists(page, '#adv-negative-prompt', 'Negative Prompt textarea');
    await checkExists(page, '#steps-field', 'Steps input');
    await checkExists(page, '#guidance-cfg-field', 'Guidance/CFG input');
    await checkExists(page, '#seed-field', 'Seed input');
    await checkExists(page, '#randomize-seed', 'Randomize Seed button');
    await checkExists(page, '#flux-checkpoint-name', 'Flux Checkpoint field');
    await checkExists(page, '#ponyxl-checkpoint-name', 'PonyXL Checkpoint field');
    await checkExists(page, '#generate-with-comfyui', 'Generate with ComfyUI button');

    // Switch model pipeline to PonyXL
    log('\nSwitching model pipeline to PonyXL...');
    await safeSelect(page, '#model-pipeline-selector', 'ponyxl', 'Model Pipeline → PonyXL');
    await wait(500);
    await safeScreenshot(page, '05-ponyxl-selected.png', 'PonyXL model selected');

    // Switch back to flux
    await safeSelect(page, '#model-pipeline-selector', 'flux', 'Model Pipeline → Flux');
    await wait(500);

    // Click Auto-Build Prompt
    log('\nClicking Auto-Build Prompt...');
    await safeClick(page, '#auto-build-prompt', 'Auto-Build Prompt');
    await wait(2000);
    await safeScreenshot(page, '06-prompt-built.png', 'After Auto-Build Prompt');

    // Check if prompt was populated
    const promptContent = await page.$eval('#adv-positive-prompt', el => el.value).catch(() => '');
    log(`Positive prompt length after Auto-Build: ${promptContent.length} chars`);
    if (promptContent.length > 10) {
      log(`✅ Prompt populated: "${promptContent.slice(0, 100)}..."`);
    } else {
      log('⚠️ Prompt may not have been populated (could require active project data)');
    }

    // Click Randomize Seed
    log('\nClicking Randomize Seed...');
    const seedBefore = await page.$eval('#seed-field', el => el.value).catch(() => 'unknown');
    await safeClick(page, '#randomize-seed', 'Randomize Seed');
    await wait(500);
    const seedAfter = await page.$eval('#seed-field', el => el.value).catch(() => 'unknown');
    log(`Seed: ${seedBefore} → ${seedAfter}`);
    await safeScreenshot(page, '07-seed-randomized.png', 'After seed randomization');

    // Click Test Connection
    log('\nClicking Test Connection...');
    await safeClick(page, '#test-comfy-connection', 'Test Connection');
    await wait(3000);
    await safeScreenshot(page, '08-connection-test.png', 'After Test Connection attempt');

    // Check connection status text
    const connectionStatus = await page.$eval('#test-comfy-connection', el => el.textContent?.trim()).catch(() => 'unknown');
    log(`Connection status: "${connectionStatus}"`);

    // ═══════════════════════════════════════════
    // STEP 3: Test Typography Compositor Panel
    // ═══════════════════════════════════════════
    log('\n── STEP 3: Typography Compositor Panel ──');

    // Scroll down first  
    await page.evaluate(() => window.scrollBy(0, 800));
    await wait(500);

    const typoToggled = await safeClick(page, '#typography-panel-toggle', 'Typography Compositor toggle');
    if (!typoToggled) {
      await clickByText(page, 'Typography Compositor', 'button');
    }
    await wait(1000);
    await safeScreenshot(page, '09-typography-panel.png', 'Typography Compositor panel expanded');

    // Fill typography fields
    await safeFill(page, '#typo-title', 'The Glass Room', 'Title');
    await safeFill(page, '#typo-author', 'Sarah Lin', 'Author');
    await safeFill(page, '#typo-subtitle', 'A Thriller', 'Subtitle');
    await safeFill(page, '#typo-series', 'Dark Files #3', 'Series');
    await safeFill(page, '#typo-tagline', 'Nothing is what it seems', 'Tagline');
    await safeScreenshot(page, '10-typography-filled.png', 'Typography fields filled in');

    // Change font family
    log('\nChanging font family...');
    const fontOptions = await page.$$eval('#typo-font-family option', opts => opts.map(o => o.value));
    log(`Available fonts: ${fontOptions.length} options`);
    if (fontOptions.length > 1) {
      await safeSelect(page, '#typo-font-family', fontOptions[1], `Font Family → ${fontOptions[1]}`);
    }

    // Toggle shadow
    await toggleCheckbox(page, '#typo-shadow-toggle', 'Text Shadow');
    
    // Toggle glow
    await toggleCheckbox(page, '#typo-glow-toggle', 'Glow');

    await safeScreenshot(page, '11-typography-styled.png', 'Typography with font/shadow/glow changes');

    // Click Preview Typography Overlay
    log('\nClicking Preview Typography Overlay...');
    await safeClick(page, '#preview-typography', 'Preview Typography Overlay');
    await wait(1500);
    await safeScreenshot(page, '12-typography-preview.png', 'Typography preview result');

    // Check preview output
    const previewText = await page.evaluate(() => {
      const previewDiv = document.querySelector('[class*="Preview"]');
      if (previewDiv) return previewDiv.textContent;
      // Look for the preview div with "Preview:" text
      const allDivs = document.querySelectorAll('div');
      for (const d of allDivs) {
        if (d.textContent?.startsWith('Preview:')) return d.textContent.slice(0, 200);
      }
      return null;
    });
    if (previewText) {
      log(`✅ Typography preview output: "${previewText.slice(0, 150)}"`);
    } else {
      log('⚠️ Typography preview output not detected (may need generated cover image)');
    }

    // ═══════════════════════════════════════════
    // STEP 4: Test Export Panel
    // ═══════════════════════════════════════════
    log('\n── STEP 4: Export Front Cover Panel ──');

    await page.evaluate(() => window.scrollBy(0, 600));
    await wait(500);

    const exportToggled = await safeClick(page, '#export-panel-toggle', 'Export Panel toggle');
    if (!exportToggled) {
      await clickByText(page, 'Export Front Cover', 'button');
    }
    await wait(1000);
    await safeScreenshot(page, '13-export-panel.png', 'Export Front Cover panel expanded');

    // Check for export elements
    await checkExists(page, '#export-preset-selector', 'Export Preset selector');
    await checkExists(page, '#export-format-selector', 'Export Format selector');
    await checkExists(page, '#export-cover-png', 'Export PNG button');
    await checkExists(page, '#export-cover-jpg', 'Export JPG button');

    // Change preset to paperback_6x9
    await safeSelect(page, '#export-preset-selector', 'paperback_6x9', 'Export Preset → paperback_6x9');
    await wait(500);
    await safeScreenshot(page, '14-export-preset-changed.png', 'Export preset changed to paperback_6x9');

    // ═══════════════════════════════════════════
    // STEP 5: Test Cover Variations Panel
    // ═══════════════════════════════════════════
    log('\n── STEP 5: Cover Variations Panel ──');

    await page.evaluate(() => window.scrollBy(0, 500));
    await wait(500);

    const variationsToggled = await safeClick(page, '#variations-panel-toggle', 'Variations Panel toggle');
    if (!variationsToggled) {
      await clickByText(page, 'Cover Variations', 'button');
    }
    await wait(1000);
    await safeScreenshot(page, '15-variations-panel.png', 'Cover Variations panel expanded');

    // Check for variation elements
    await checkExists(page, '#variation-name-input', 'Variation Name input');
    await checkExists(page, '#save-variation', 'Save Variation button');

    // Type a variation name
    await safeFill(page, '#variation-name-input', 'Test Variation', 'Variation Name');
    await safeScreenshot(page, '16-variation-named.png', 'Variation name filled in');

    // ═══════════════════════════════════════════
    // STEP 6: Series Consistency Lock Panel
    // ═══════════════════════════════════════════
    log('\n── STEP 6: Series Consistency Lock Panel ──');

    await page.evaluate(() => window.scrollBy(0, 500));
    await wait(500);

    const seriesToggled = await safeClick(page, '#series-lock-panel-toggle', 'Series Lock Panel toggle');
    if (!seriesToggled) {
      await clickByText(page, 'Series Consistency Lock', 'button');
    }
    await wait(1000);
    await safeScreenshot(page, '17-series-lock-panel.png', 'Series Consistency Lock panel expanded');

    // Check for series lock elements
    await checkExists(page, '#series-lock-enabled', 'Enable Series Lock checkbox');
    await checkExists(page, '#extract-series-signature', 'Extract from Active Cover button');
    await checkExists(page, '#apply-series-signature', 'Apply to Current Settings button');
    await checkExists(page, '#validate-series-consistency', 'Validate Consistency button');

    // Toggle Enable Series Lock
    await toggleCheckbox(page, '#series-lock-enabled', 'Enable Series Lock');
    await safeScreenshot(page, '18-series-lock-enabled.png', 'Series Lock enabled');

    // ═══════════════════════════════════════════
    // STEP 7: Test Generate with ComfyUI
    // ═══════════════════════════════════════════
    log('\n── STEP 7: Generate with ComfyUI ──');

    // Scroll back up to Advanced panel
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(500);
    await page.evaluate(() => {
      const advPanel = document.querySelector('#generate-with-comfyui');
      if (advPanel) advPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    await wait(1000);

    // Check if prompt is populated
    const currentPrompt = await page.$eval('#adv-positive-prompt', el => el.value).catch(() => '');
    if (currentPrompt.length < 10) {
      log('Prompt empty, attempting Auto-Build...');
      await safeClick(page, '#auto-build-prompt', 'Auto-Build Prompt (retry)');
      await wait(2000);
    }

    // Click Generate with ComfyUI
    const genBtn = await page.$('#generate-with-comfyui');
    const genDisabled = genBtn ? await page.$eval('#generate-with-comfyui', el => el.disabled) : true;
    log(`Generate button disabled: ${genDisabled}`);
    
    if (!genDisabled) {
      await safeClick(page, '#generate-with-comfyui', 'Generate with ComfyUI');
      await wait(5000);
      await safeScreenshot(page, '19-generation-started.png', 'Generation started (5s)');
      await wait(15000);
      await safeScreenshot(page, '20-generation-result.png', 'Generation result (20s total)');
    } else {
      log('⚠️ Generate button is disabled (prompt is empty or conditions not met)');
      await safeScreenshot(page, '19-generation-started.png', 'Generate button disabled state');
      // Copy the screenshot for 20 as well
      await safeScreenshot(page, '20-generation-result.png', 'No generation attempted (button disabled)');
    }

    // ═══════════════════════════════════════════
    // STEP 8: Full Cover Tab Screenshot
    // ═══════════════════════════════════════════
    log('\n── STEP 8: Full Cover Tab Screenshot ──');
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(500);
    await safeFullScreenshot(page, '21-full-cover-tab.png', 'Full cover tab (full page)');

    // ═══════════════════════════════════════════
    // STEP 9: Write Findings Report
    // ═══════════════════════════════════════════
    log('\n── STEP 9: Final Summary ──');

    // Gather page info
    const pageUrl = page.url();
    const pageTitle = await page.title();
    log(`Final page URL: ${pageUrl}`);
    log(`Final page title: ${pageTitle}`);

    // Check overall page state
    const pageState = await page.evaluate(() => {
      const bodyText = document.body.innerText?.length || 0;
      const forms = document.querySelectorAll('input, select, textarea, button').length;
      const images = document.querySelectorAll('img, canvas').length;
      return { bodyTextLength: bodyText, formElements: forms, mediaElements: images };
    });
    log(`Page state: ${pageState.bodyTextLength} chars text, ${pageState.formElements} form elements, ${pageState.mediaElements} images/canvases`);

    // Write the report
    const report = buildReport(findings, screenshots, pageState);
    writeFileSync(join(OUT, 'qa-findings.md'), report);
    log('✅ Report written to qa-findings.md');

  } catch (err) {
    log(`\n🔥 FATAL ERROR: ${err.message}`);
    log(err.stack);
    await safeScreenshot(page, 'error-state.png', 'State at time of fatal error');
  } finally {
    await browser.close();
    log('\n✅ Browser closed. QA test complete.');
  }
})();

function buildReport(findings, screenshots, pageState) {
  const now = new Date().toISOString();
  
  // Analyze results
  const passed = findings.filter(f => f.includes('✅')).length;
  const failed = findings.filter(f => f.includes('❌')).length;
  const warnings = findings.filter(f => f.includes('⚠️')).length;

  return `# Cover Production System — Browser QA Report

**Generated:** ${now}  
**App URL:** http://localhost:5173  
**Test Engine:** Puppeteer (headless Chrome)

---

## Summary

| Metric | Count |
|--------|-------|
| ✅ Passed | ${passed} |
| ❌ Failed | ${failed} |
| ⚠️ Warnings | ${warnings} |
| 📸 Screenshots | ${screenshots.length} |

**Page State:** ${pageState.bodyTextLength} chars rendered, ${pageState.formElements} interactive elements, ${pageState.mediaElements} media elements

---

## Screenshots Taken

| # | Filename | Description |
|---|----------|-------------|
${screenshots.map((s, i) => `| ${i + 1} | \`${s.name}\` | ${s.desc} |`).join('\n')}

---

## Detailed Findings

### STEP 1: Navigate to Dashboard & Open Project

${findings.filter(f => f.includes('STEP 1') || (findings.indexOf(f) > findings.indexOf('── STEP 1') && findings.indexOf(f) < findings.indexOf('── STEP 2'))).map(f => '- ' + f).join('\n') || 'See full log below.'}

### STEP 2: Advanced Local Generation Panel

Controls verified:
${findings.filter(f => f.includes('Found:') || f.includes('Not found:')).map(f => '- ' + f).join('\n')}

Interactions:
${findings.filter(f => (f.includes('Selected:') || f.includes('Clicked:') || f.includes('Seed:') || f.includes('Connection')) && !f.includes('typography') && !f.includes('Typography') && !f.includes('export') && !f.includes('Export') && !f.includes('variation') && !f.includes('Variation') && !f.includes('series') && !f.includes('Series')).map(f => '- ' + f).join('\n')}

### STEP 3: Typography Compositor Panel

${findings.filter(f => f.includes('Filled:') || f.includes('Toggled:') || f.includes('Typography') || f.includes('typography') || f.includes('font') || f.includes('Font')).map(f => '- ' + f).join('\n')}

### STEP 4: Export Front Cover Panel

${findings.filter(f => f.includes('Export') || f.includes('export')).map(f => '- ' + f).join('\n')}

### STEP 5: Cover Variations Panel

${findings.filter(f => f.includes('Variation') || f.includes('variation')).map(f => '- ' + f).join('\n')}

### STEP 6: Series Consistency Lock Panel

${findings.filter(f => f.includes('Series') || f.includes('series') || f.includes('Lock') || f.includes('Consistency') || f.includes('Extract') || f.includes('Apply') || f.includes('Validate')).map(f => '- ' + f).join('\n')}

### STEP 7: Generate with ComfyUI

${findings.filter(f => f.includes('Generate') || f.includes('generate') || f.includes('generation') || f.includes('Generation') || f.includes('prompt') || f.includes('Prompt')).map(f => '- ' + f).join('\n')}

---

## Full Log

\`\`\`
${findings.join('\n')}
\`\`\`

---

## Overall Assessment

The Cover Production System UI was tested against the following criteria:

1. **Panel Discovery** — All expected collapsible panels should be present and toggleable
2. **Control Presence** — All specified input fields, selectors, buttons, and checkboxes should exist in the DOM
3. **Interaction** — Controls should respond to clicks, selections, and text input
4. **Visual State** — Screenshots should show proper rendering and state changes
5. **Workflow** — The end-to-end flow from configuration to generation should be functional

**Result:** ${passed} checks passed, ${failed} failed, ${warnings} warnings out of ${passed + failed + warnings} total checks.

${failed === 0 ? '### ✅ All checks passed — UI appears functional and properly wired.' : `### ⚠️ ${failed} check(s) failed — see details above for specific issues.`}
`;
}
