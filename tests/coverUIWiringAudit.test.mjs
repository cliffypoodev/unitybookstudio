/**
 * coverUIWiringAudit.test.mjs — Unit tests for uiWiringAudit.js
 *
 * Tests scanComponentForButtons, identifyPotentialNoopHandlers,
 * buildUIWiringChecklist, and createManualWiringAuditReport with
 * inline JSX source strings.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  scanComponentForButtons,
  identifyPotentialNoopHandlers,
  buildUIWiringChecklist,
  createManualWiringAuditReport,
} from '../src/lib/uiWiringAudit.js';

describe('uiWiringAudit — scanComponentForButtons', () => {
  // 1. Finds <Button onClick={handleFoo}>
  it('finds <Button onClick={handleFoo}>', () => {
    const src = `
      <div>
        <Button onClick={handleFoo}>Click me</Button>
      </div>
    `;
    const results = scanComponentForButtons(src);
    const btn = results.find((r) => r.handler === 'handleFoo');
    assert.ok(btn, 'should find handleFoo handler');
    assert.equal(btn.type, 'Button');
  });

  // 2. Finds <button onClick={() => setState(true)}>
  it('finds <button onClick={() => setState(true)}>', () => {
    const src = `
      <button onClick={() => setState(true)}>Toggle</button>
    `;
    const results = scanComponentForButtons(src);
    assert.ok(results.length >= 1, 'should find at least one control');
    const btn = results.find((r) => r.handler.includes('setState'));
    assert.ok(btn, 'should find setState handler');
  });

  // 3. Extracts id when present
  it('extracts id when present', () => {
    const src = `
      <Button id="save-btn" onClick={handleSave}>Save</Button>
    `;
    const results = scanComponentForButtons(src);
    const btn = results.find((r) => r.id === 'save-btn');
    assert.ok(btn, 'should extract id="save-btn"');
    assert.equal(btn.handler, 'handleSave');
  });

  // 10. Handles select onChange
  it('handles select onChange', () => {
    const src = `
      <select id="color-picker" onChange={e => setColor(e.target.value)}>
        <option value="red">Red</option>
        <option value="blue">Blue</option>
      </select>
    `;
    const results = scanComponentForButtons(src);
    const sel = results.find((r) => r.type === 'select');
    assert.ok(sel, 'should find select control');
    assert.equal(sel.id, 'color-picker');
    assert.ok(sel.handler.includes('setColor'), 'should capture setColor handler');
  });
});

describe('uiWiringAudit — identifyPotentialNoopHandlers', () => {
  // 4. Finds onClick={() => {}}
  it('finds onClick={() => {}}', () => {
    const src = `
      <Button onClick={() => {}}>Noop</Button>
    `;
    const results = identifyPotentialNoopHandlers(src);
    assert.ok(results.length >= 1, 'should find at least one noop');
    assert.ok(
      results.some((r) => r.pattern === '() => {}'),
      'should detect () => {} pattern'
    );
  });

  // 5. Finds // TODO comment near handler
  it('finds // TODO comment near handler', () => {
    const src = `
      // TODO: wire up the delete handler
      <Button onClick={handleDelete}>Delete</Button>
    `;
    const results = identifyPotentialNoopHandlers(src);
    assert.ok(results.length >= 1, 'should find at least one TODO');
    assert.ok(
      results.some((r) => r.pattern === '// TODO'),
      'should detect // TODO pattern'
    );
  });

  // 6. Returns empty for properly wired handlers
  it('returns empty for properly wired handlers', () => {
    const src = `
      <Button onClick={handleSave}>Save</Button>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <select onChange={e => setPipeline(e.target.value)}>
        <option>flux</option>
      </select>
    `;
    const results = identifyPotentialNoopHandlers(src);
    assert.equal(results.length, 0, 'should find no noops');
  });
});

describe('uiWiringAudit — buildUIWiringChecklist', () => {
  // 7. Returns correct totalControls count
  it('returns correct totalControls count', () => {
    const src = `
      <Button onClick={handleA}>A</Button>
      <Button onClick={handleB}>B</Button>
      <button onClick={handleC}>C</button>
    `;
    const checklist = buildUIWiringChecklist('TestComponent', src);
    assert.ok(checklist.totalControls >= 3, `Expected at least 3 controls, got ${checklist.totalControls}`);
    assert.equal(checklist.componentName, 'TestComponent');
  });

  // 8. Calculates wiredPercentage
  it('calculates wiredPercentage correctly with a noop', () => {
    const src = `
      <Button onClick={handleReal}>Real</Button>
      <Button onClick={() => {}}>Noop</Button>
    `;
    const checklist = buildUIWiringChecklist('MixedComponent', src);
    assert.equal(checklist.totalControls, 2);
    // One real handler, one noop → 50%
    assert.equal(checklist.wiredPercentage, 50);
  });
});

describe('uiWiringAudit — createManualWiringAuditReport', () => {
  // 9. Returns string containing 'Wiring Audit'
  it('returns string containing "Wiring Audit"', () => {
    const checklist = buildUIWiringChecklist('SomeComponent', `
      <Button onClick={handleFoo}>Foo</Button>
    `);
    const report = createManualWiringAuditReport(checklist);
    assert.ok(typeof report === 'string');
    assert.ok(report.includes('Wiring Audit'), 'should contain "Wiring Audit"');
    assert.ok(report.includes('SomeComponent'), 'should contain the component name');
  });
});
