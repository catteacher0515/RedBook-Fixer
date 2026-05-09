export function detectSensitiveWords(text, dict) {
  const sortedWords = Object.keys(dict).sort((a, b) => b.length - a.length);
  const lowerText = text.toLowerCase();
  const matchMap = new Array(text.length).fill(null);

  for (const word of sortedWords) {
    const caseSensitive = /^[a-zA-Z]+$/.test(word) && word !== word.toUpperCase();
    const searchText = caseSensitive ? text : lowerText;
    const searchWord = caseSensitive ? word : word.toLowerCase();
    let pos = 0;

    while (pos < searchText.length) {
      const idx = searchText.indexOf(searchWord, pos);
      if (idx === -1) break;

      let covered = false;
      for (let i = idx; i < idx + word.length; i++) {
        if (matchMap[i]) {
          covered = true;
          break;
        }
      }

      if (!covered) {
        for (let i = idx; i < idx + word.length; i++) {
          matchMap[i] = { word, start: idx };
        }
      }

      pos = idx + 1;
    }
  }

  const segments = [];
  let i = 0;

  while (i < text.length) {
    if (matchMap[i] && matchMap[i].start === i) {
      const word = matchMap[i].word;
      const replacements = dict[word] || [];
      segments.push({
        text: text.slice(i, i + word.length),
        isSensitive: true,
        word,
        replacement: replacements[0] || null,
        replacements,
        userReplacement: null
      });
      i += word.length;
      continue;
    }

    if (matchMap[i]) {
      i++;
      continue;
    }

    let j = i;
    while (j < text.length && !matchMap[j]) j++;
    segments.push({ text: text.slice(i, j), isSensitive: false });
    i = j;
  }

  return segments;
}

export function buildOutputText(segments) {
  return segments.map(segment => {
    if (!segment.isSensitive) return segment.text;
    return segment.userReplacement ?? segment.replacement ?? segment.text;
  }).join('');
}

export function getMergedWords(builtinWords, customWords) {
  return Object.assign({}, builtinWords, customWords);
}

export function renderHighlight(segments, container, clickable) {
  container.innerHTML = '';
  segments.forEach((segment, idx) => {
    if (!segment.isSensitive) {
      container.appendChild(document.createTextNode(segment.text));
      return;
    }

    const span = document.createElement('span');
    const isReplaced = segment.userReplacement !== null;
    span.className = isReplaced ? 'word-green' : 'word-red';
    span.textContent = isReplaced ? segment.userReplacement : segment.text;
    if (clickable) {
      span.dataset.idx = idx;
      span.style.animationDelay = `${idx * 20}ms`;
    }
    container.appendChild(span);
  });
}

export function renderOutput(segments, container) {
  container.innerHTML = '';
  container.classList.remove('output-placeholder');
  segments.forEach(segment => {
    if (!segment.isSensitive) {
      container.appendChild(document.createTextNode(segment.text));
      return;
    }

    const span = document.createElement('span');
    const replacement = segment.userReplacement ?? segment.replacement;
    if (replacement) {
      span.className = 'word-green';
      span.textContent = replacement;
    } else {
      span.className = 'word-red';
      span.textContent = segment.text;
    }
    container.appendChild(span);
  });

  const outputCount = document.getElementById('output-count');
  if (outputCount) {
    outputCount.textContent = `${buildOutputText(segments).length} 字`;
  }
}

export function activatePage(document, pageName) {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.page === pageName);
  });

  document.querySelectorAll('.page').forEach(page => {
    page.classList.toggle('active', page.id === `page-${pageName}`);
  });
}

export function sendTextToProcessPage(document, text) {
  const textarea = document.getElementById('input-textarea');
  const inputCount = document.getElementById('input-count');

  textarea.value = text;
  inputCount.textContent = `${text.length} 字`;
  activatePage(document, 'process');
}
