import {
  detectSensitiveWords,
  renderHighlight,
  renderOutput,
  buildOutputText,
  activatePage,
  sendTextToProcessPage,
  getMergedWords
} from './detection.js';
import {
  createImageOcrState,
  getImageFileError,
  bindImageActions,
  recognizeImageText
} from './ocr.js';

let builtinWords = {};
let customWords = {};
let detectedSegments = [];
let activeWordIndex = -1;
let imageOcrState = createImageOcrState();

async function init() {
  await loadBuiltinWords();
  loadCustomWords();
  renderLibraryPage();
  bindNav();
  bindProcessPage();
  bindDrawer();
  bindLibraryPage();
  bindImagePage();
}

async function loadBuiltinWords() {
  try {
    const res = await fetch('words.json');
    builtinWords = await res.json();
  } catch (e) {
    builtinWords = {};
    console.warn('words.json 加载失败', e);
  }
}

function loadCustomWords() {
  try {
    customWords = JSON.parse(localStorage.getItem('rwf_custom') || '{}');
  } catch (e) {
    customWords = {};
  }
}

function saveCustomWords() {
  localStorage.setItem('rwf_custom', JSON.stringify(customWords));
}

function bindNav() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activatePage(document, tab.dataset.page);
      if (tab.dataset.page === 'library') renderLibraryPage();
    });
  });
}

function bindProcessPage() {
  const textarea = document.getElementById('input-textarea');
  const inputHighlight = document.getElementById('input-highlight');
  const outputView = document.getElementById('output-view');
  const btnDetect = document.getElementById('btn-detect');
  const btnEdit = document.getElementById('btn-edit');
  const btnClear = document.getElementById('btn-clear');
  const btnCopy = document.getElementById('btn-copy');
  const detectInfo = document.getElementById('detect-info');
  const inputCount = document.getElementById('input-count');

  function switchToHighlight() {
    textarea.style.display = 'none';
    inputHighlight.style.display = 'block';
    btnDetect.textContent = '重新检测';
    btnEdit.style.display = '';
  }

  function switchToEdit() {
    textarea.style.display = 'block';
    inputHighlight.style.display = 'none';
    btnDetect.textContent = '开始检测';
    btnEdit.style.display = 'none';
    textarea.focus();
  }

  textarea.addEventListener('input', () => {
    inputCount.textContent = `${textarea.value.length} 字`;
  });

  btnDetect.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text) return;

    detectedSegments = detectSensitiveWords(text, getMergedWords(builtinWords, customWords));
    const sensitiveCount = detectedSegments.filter(segment => segment.isSensitive).length;

    switchToHighlight();
    renderHighlight(detectedSegments, inputHighlight, true);
    outputView.style.display = 'block';
    renderOutput(detectedSegments, outputView);

    detectInfo.innerHTML = sensitiveCount === 0
      ? '未检测到敏感词'
      : `检测到 <span class="count-red">${sensitiveCount}</span> 个敏感词`;
    btnCopy.disabled = false;
  });

  btnEdit.addEventListener('click', () => {
    switchToEdit();
    detectInfo.innerHTML = '';
  });

  btnClear.addEventListener('click', () => {
    textarea.value = '';
    switchToEdit();
    inputHighlight.innerHTML = '';
    outputView.innerHTML = '检测后自动生成替换版本';
    outputView.classList.add('output-placeholder');
    detectInfo.innerHTML = '';
    inputCount.textContent = '0 字';
    document.getElementById('output-count').textContent = '0 字';
    btnCopy.disabled = true;
    detectedSegments = [];
  });

  btnCopy.addEventListener('click', () => {
    const text = buildOutputText(detectedSegments);
    navigator.clipboard.writeText(text).then(() => {
      btnCopy.textContent = '已复制 ✓';
      setTimeout(() => { btnCopy.textContent = '复制结果'; }, 2000);
    });
  });

  inputHighlight.addEventListener('click', event => {
    const span = event.target.closest('[data-idx]');
    if (!span) return;
    activeWordIndex = parseInt(span.dataset.idx, 10);
    openDrawer(detectedSegments[activeWordIndex]);
  });

  let syncingScroll = false;
  function syncScroll(source, target) {
    if (syncingScroll) return;
    syncingScroll = true;
    const ratio = source.scrollTop / (source.scrollHeight - source.clientHeight || 1);
    target.scrollTop = ratio * (target.scrollHeight - target.clientHeight);
    syncingScroll = false;
  }

  textarea.addEventListener('scroll', () => syncScroll(textarea, outputView));
  inputHighlight.addEventListener('scroll', () => syncScroll(inputHighlight, outputView));
  outputView.addEventListener('scroll', () => {
    const active = inputHighlight.style.display === 'none' ? textarea : inputHighlight;
    syncScroll(outputView, active);
  });
}

function bindDrawer() {
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('drawer-cancel').addEventListener('click', closeDrawer);
  document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);

  document.getElementById('drawer-confirm').addEventListener('click', () => {
    const val = document.getElementById('drawer-input').value.trim();
    if (!val || activeWordIndex === -1) return;
    detectedSegments[activeWordIndex].userReplacement = val;
    renderHighlight(detectedSegments, document.getElementById('input-highlight'), true);
    renderOutput(detectedSegments, document.getElementById('output-view'));
    closeDrawer();
  });
}

function openDrawer(seg) {
  document.getElementById('drawer-word').textContent = seg.text;
  const chips = document.getElementById('drawer-chips');
  chips.innerHTML = '';
  (seg.replacements || []).forEach(replacement => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = replacement;
    chip.addEventListener('click', () => {
      document.getElementById('drawer-input').value = replacement;
      chips.querySelectorAll('.chip').forEach(node => node.classList.remove('selected'));
      chip.classList.add('selected');
    });
    chips.appendChild(chip);
  });
  const input = document.getElementById('drawer-input');
  input.value = seg.userReplacement || seg.replacement || '';
  document.getElementById('drawer-overlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
  setTimeout(() => input.focus(), 310);
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
  activeWordIndex = -1;
}

function renderLibraryPage() {
  renderWordTable('builtin-word-table', builtinWords, false);
  renderWordTable('custom-word-table', customWords, true);
  document.getElementById('builtin-count').textContent = `${Object.keys(builtinWords).length} 条`;
  document.getElementById('custom-count').textContent = `${Object.keys(customWords).length} 条`;
}

function renderWordTable(containerId, dict, editable) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const entries = Object.entries(dict);
  if (entries.length === 0) {
    container.innerHTML = `<div class="word-table-empty">${editable ? '暂无自定义词条' : '加载中…'}</div>`;
    return;
  }

  entries.forEach(([word, replacements]) => {
    const row = document.createElement('div');
    row.className = 'word-row';
    const chips = (replacements || []).map(replacement =>
      `<span class="word-row-chip">${escapeHtml(replacement)}</span>`
    ).join('');
    row.innerHTML =
      `<span class="word-row-term">${escapeHtml(word)}</span>` +
      `<div class="word-row-replacements">${chips}</div>` +
      (editable
        ? `<div class="word-row-actions"><button class="btn-icon danger" data-word="${escapeHtml(word)}">删除</button></div>`
        : '');
    container.appendChild(row);
  });

  if (editable) {
    container.querySelectorAll('.btn-icon.danger').forEach(btn => {
      btn.addEventListener('click', () => {
        delete customWords[btn.dataset.word];
        saveCustomWords();
        renderLibraryPage();
      });
    });
  }
}

function bindLibraryPage() {
  document.getElementById('btn-add-word').addEventListener('click', () => {
    const word = document.getElementById('add-word').value.trim();
    const raw = document.getElementById('add-replacements').value.trim();
    if (!word) return;
    const replacements = raw ? raw.split(/[,，]+/).map(item => item.trim()).filter(Boolean) : [];
    customWords[word] = replacements;
    saveCustomWords();
    document.getElementById('add-word').value = '';
    document.getElementById('add-replacements').value = '';
    renderLibraryPage();
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(customWords, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'rwf-custom-words.json';
    link.click();
  });

  document.getElementById('btn-import').addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = loadEvent => {
      try {
        const imported = JSON.parse(loadEvent.target.result);
        customWords = Object.assign({}, customWords, imported);
        saveCustomWords();
        renderLibraryPage();
      } catch (err) {
        alert('JSON 格式错误，导入失败');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  });
}

function bindImagePage() {
  const uploadInput = document.getElementById('image-upload');
  const dropzone = document.getElementById('image-dropzone');
  const preview = document.getElementById('image-preview');
  const textArea = document.getElementById('image-ocr-text');
  const feedback = document.getElementById('image-ocr-feedback');
  const count = document.getElementById('image-ocr-count');
  const startButton = document.getElementById('btn-start-ocr');
  const clearButton = document.getElementById('btn-clear-image');
  const sendButton = document.getElementById('btn-send-to-process');

  function revokePreviewUrl() {
    if (imageOcrState.imageUrl) {
      URL.revokeObjectURL(imageOcrState.imageUrl);
    }
  }

  function updateFeedback() {
    feedback.textContent = imageOcrState.error || imageOcrState.notice || '等待导入图片';
    feedback.classList.toggle('image-status-error', Boolean(imageOcrState.error));
    feedback.classList.toggle('image-status-success', Boolean(!imageOcrState.error && imageOcrState.notice));
  }

  function renderImagePreview() {
    preview.innerHTML = '';
    if (!imageOcrState.imageUrl) {
      preview.innerHTML = '<div class="image-preview-placeholder">导入后会在这里显示图片预览</div>';
      return;
    }
    const img = document.createElement('img');
    img.src = imageOcrState.imageUrl;
    img.alt = '待识别图片预览';
    preview.appendChild(img);
  }

  function syncImageText() {
    textArea.value = imageOcrState.text;
    count.textContent = `${imageOcrState.text.length} 字`;
    sendButton.disabled = !imageOcrState.text.trim() || imageOcrState.loading;
  }

  function syncImageUi() {
    renderImagePreview();
    syncImageText();
    updateFeedback();
    startButton.disabled = imageOcrState.loading;
    clearButton.disabled = imageOcrState.loading && !imageOcrState.file;
    startButton.textContent = imageOcrState.loading ? '识别中…' : '开始识别';
  }

  function setImageFile(file, notice = '图片已导入，可开始识别') {
    const error = getImageFileError(file);
    if (error) {
      imageOcrState.error = error;
      imageOcrState.notice = '';
      syncImageUi();
      return false;
    }

    revokePreviewUrl();
    imageOcrState.file = file;
    imageOcrState.imageUrl = URL.createObjectURL(file);
    imageOcrState.error = '';
    imageOcrState.notice = notice;
    syncImageUi();
    return true;
  }

  async function startRecognition() {
    const error = getImageFileError(imageOcrState.file);
    if (error) {
      imageOcrState.error = error;
      imageOcrState.notice = '';
      syncImageUi();
      return;
    }

    imageOcrState.loading = true;
    imageOcrState.error = '';
    imageOcrState.notice = '正在本地识别文字，请稍候…';
    syncImageUi();

    try {
      const text = await recognizeImageText(imageOcrState.file);
      imageOcrState.text = text.trim();
      imageOcrState.notice = imageOcrState.text
        ? '识别完成，可直接编辑或送去检测'
        : '未识别到有效文字，可手动补充后再送检';
    } catch (errorInstance) {
      imageOcrState.error = '识别失败，请重试或更换更清晰的图片';
      console.error(errorInstance);
    } finally {
      imageOcrState.loading = false;
      syncImageUi();
    }
  }

  function clearImageState() {
    revokePreviewUrl();
    imageOcrState = createImageOcrState();
    syncImageUi();
  }

  uploadInput.addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    setImageFile(file);
    uploadInput.value = '';
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, event => {
      event.preventDefault();
      dropzone.classList.add('is-dragover');
    });
  });
  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, event => {
      event.preventDefault();
      dropzone.classList.remove('is-dragover');
    });
  });
  dropzone.addEventListener('drop', event => {
    const file = Array.from(event.dataTransfer?.files || [])[0];
    if (!file) {
      imageOcrState.error = '未检测到图片内容';
      imageOcrState.notice = '';
      syncImageUi();
      return;
    }
    setImageFile(file, '图片已拖拽导入，可开始识别');
  });

  document.addEventListener('paste', event => {
    const item = Array.from(event.clipboardData?.items || []).find(entry => entry.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    activatePage(document, 'image');
    setImageFile(file, '截图已粘贴，可开始识别');
  });

  textArea.addEventListener('input', () => {
    imageOcrState.text = textArea.value;
    imageOcrState.notice = imageOcrState.text.trim() ? '识别结果已更新，可送去检测' : imageOcrState.notice;
    syncImageText();
    updateFeedback();
  });

  startButton.addEventListener('click', startRecognition);
  clearButton.addEventListener('click', clearImageState);

  bindImageActions(document, {
    onSend: text => {
      sendTextToProcessPage(document, text);
      document.getElementById('detect-info').innerHTML = '';
      document.getElementById('btn-edit').style.display = 'none';
      document.getElementById('input-textarea').style.display = 'block';
      document.getElementById('input-highlight').style.display = 'none';
      document.getElementById('input-highlight').innerHTML = '';
      document.getElementById('output-view').innerHTML = '检测后自动生成替换版本';
      document.getElementById('output-view').classList.add('output-placeholder');
      document.getElementById('output-count').textContent = '0 字';
      document.getElementById('btn-copy').disabled = true;
      detectedSegments = [];
    }
  });

  syncImageUi();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init();
