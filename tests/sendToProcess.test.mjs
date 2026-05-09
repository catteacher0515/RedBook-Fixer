import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { sendTextToProcessPage } from '../src/detection.js';

test('sendTextToProcessPage fills the process textarea, updates count, and activates process page', () => {
  const dom = new JSDOM(`
    <div class="nav-tab" data-page="process"></div>
    <div class="nav-tab active" data-page="image"></div>
    <div class="page active" id="page-image"></div>
    <div class="page" id="page-process"></div>
    <textarea id="input-textarea"></textarea>
    <span id="input-count">0 字</span>
  `);

  sendTextToProcessPage(dom.window.document, '识别出的文字');

  assert.equal(dom.window.document.getElementById('input-textarea').value, '识别出的文字');
  assert.equal(dom.window.document.getElementById('input-count').textContent, '6 字');
  assert.equal(dom.window.document.querySelector('.nav-tab[data-page="process"]').classList.contains('active'), true);
  assert.equal(dom.window.document.getElementById('page-process').classList.contains('active'), true);
});
