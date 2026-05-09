import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  createImageOcrState,
  getImageFileError,
  bindImageActions,
  normalizeOcrText
} from '../src/ocr.js';

test('createImageOcrState resets image OCR state to its empty defaults', () => {
  const state = createImageOcrState();

  assert.deepEqual(state, {
    file: null,
    imageUrl: '',
    text: '',
    loading: false,
    error: '',
    notice: ''
  });
});

test('getImageFileError rejects non-image files and allows image files', () => {
  assert.equal(getImageFileError(null), '请先导入图片');
  assert.equal(getImageFileError({ type: 'text/plain' }), '仅支持图片文件');
  assert.equal(getImageFileError({ type: 'image/png' }), '');
});

test('bindImageActions sends edited OCR text to the process page when send button is clicked', () => {
  const dom = new JSDOM(`
    <button class="nav-tab" data-page="process"></button>
    <button class="nav-tab active" data-page="image"></button>
    <div class="page" id="page-process"></div>
    <div class="page active" id="page-image"></div>
    <textarea id="input-textarea"></textarea>
    <span id="input-count">0 字</span>
    <textarea id="image-ocr-text">图片文字</textarea>
    <button id="btn-send-to-process"></button>
    <div id="image-ocr-feedback"></div>
  `);

  bindImageActions(dom.window.document, {
    onSend: text => {
      dom.window.document.getElementById('input-textarea').value = text;
      dom.window.document.getElementById('input-count').textContent = `${text.length} 字`;
      dom.window.document.querySelector('.nav-tab[data-page="process"]').classList.add('active');
      dom.window.document.getElementById('page-process').classList.add('active');
    }
  });

  dom.window.document.getElementById('btn-send-to-process').click();

  assert.equal(dom.window.document.getElementById('input-textarea').value, '图片文字');
});

test('normalizeOcrText removes unnecessary spaces between Chinese characters and punctuation', () => {
  const raw = `这 个
GitHub 项 目 ，
想 把 微 信 数据
这 成 你 的

本 地 资产

图 rz`;

  assert.equal(
    normalizeOcrText(raw),
    `这个
GitHub 项目，
想把微信数据
这成你的

本地资产

图 rz`
  );
});
