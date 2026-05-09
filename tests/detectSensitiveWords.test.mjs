import test from 'node:test';
import assert from 'node:assert/strict';
import { detectSensitiveWords, buildOutputText } from '../src/detection.js';

test('detectSensitiveWords marks longest matching sensitive words and returns default replacements', () => {
  const dict = {
    '最': ['zui'],
    '最好': ['很好'],
    '关注': ['关㊗️']
  };

  const segments = detectSensitiveWords('最好的内容值得关注', dict);

  assert.deepEqual(
    segments.map(segment => ({
      text: segment.text,
      isSensitive: segment.isSensitive,
      replacement: segment.replacement ?? null
    })),
    [
      { text: '最好', isSensitive: true, replacement: '很好' },
      { text: '的内容值得', isSensitive: false, replacement: null },
      { text: '关注', isSensitive: true, replacement: '关㊗️' }
    ]
  );

  assert.equal(buildOutputText(segments), '很好的内容值得关㊗️');
});
