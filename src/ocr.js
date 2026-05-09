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

export async function recognizeImageText(file) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('chi_sim+eng');
  try {
    const result = await worker.recognize(file);
    return result.data.text || '';
  } finally {
    await worker.terminate();
  }
}
