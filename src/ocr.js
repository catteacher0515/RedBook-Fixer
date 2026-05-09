const TESSERACT_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/tesseract.min.js';

function loadTesseractGlobal() {
  if (globalThis.Tesseract?.createWorker) {
    return Promise.resolve(globalThis.Tesseract);
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-tesseract-cdn="true"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(globalThis.Tesseract), { once: true });
      existing.addEventListener('error', () => reject(new Error('Tesseract CDN 加载失败')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = TESSERACT_SCRIPT_URL;
    script.async = true;
    script.dataset.tesseractCdn = 'true';
    script.onload = () => {
      if (globalThis.Tesseract?.createWorker) {
        resolve(globalThis.Tesseract);
      } else {
        reject(new Error('Tesseract 全局对象不可用'));
      }
    };
    script.onerror = () => reject(new Error('Tesseract CDN 加载失败'));
    document.head.appendChild(script);
  });
}

export function createImageOcrState() {
  return {
    file: null,
    imageUrl: '',
    text: '',
    loading: false,
    error: '',
    notice: ''
  };
}

export function getImageFileError(file) {
  if (!file) return '请先导入图片';
  if (!file.type || !file.type.startsWith('image/')) return '仅支持图片文件';
  return '';
}

export function bindImageActions(document, { onSend }) {
  const sendButton = document.getElementById('btn-send-to-process');
  const textArea = document.getElementById('image-ocr-text');
  const feedback = document.getElementById('image-ocr-feedback');

  sendButton.addEventListener('click', () => {
    const text = textArea.value.trim();
    if (!text) {
      feedback.textContent = '请先识别或输入文字';
      feedback.classList.add('image-status-error');
      return;
    }
    feedback.classList.remove('image-status-error');
    onSend(text);
  });
}

export function normalizeOcrText(text) {
  const collapseHanSpacing = (line) => {
    let current = line.replace(/[ \t]+/g, ' ');
    let previous;
    do {
      previous = current;
      current = current
        .replace(/([一-龥])\s+([一-龥])/g, '$1$2')
        .replace(/([一-龥])\s+([，。！？；：、）】》])/g, '$1$2')
        .replace(/([（【《])\s+([一-龥])/g, '$1$2');
    } while (current !== previous);
    return current.trim();
  };

  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(collapseHanSpacing)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function recognizeImageText(file) {
  const { createWorker } = await loadTesseractGlobal();
  const worker = await createWorker('chi_sim+eng');
  try {
    const result = await worker.recognize(file);
    return normalizeOcrText(result.data.text || '');
  } finally {
    await worker.terminate();
  }
}
