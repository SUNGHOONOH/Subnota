import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { TOPIC_MODEL_REPO, TOPIC_MODEL_REVISION } from '../local-embedding-config';
import { createLocalEmbeddingRuntime } from '../local-embedding-runtime';

// Optional real-model check: SUBNOTA_AX_MODEL_DIR points at the local export
// harness with model/*.json and onnx/model_int8.onnx. CI runs the mock tests.
const source = process.env.SUBNOTA_AX_MODEL_DIR;
const modelSource = source ?? '';

describe.skipIf(!source)('A.X real ONNX runtime', () => {
  it('extracts topic words from a Korean sentence in the index session', async () => {
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'subnota-ax-runtime-'));
    const model = path.join(cache, TOPIC_MODEL_REPO, TOPIC_MODEL_REVISION);
    fs.mkdirSync(path.join(model, 'onnx'), { recursive: true });
    for (const name of ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json']) {
      fs.symlinkSync(path.join(modelSource, 'model', name), path.join(model, name));
    }
    fs.symlinkSync(path.join(modelSource, 'onnx', 'model_int8.onnx'), path.join(model, 'onnx', 'model_quantized.onnx'));
    const runtime = createLocalEmbeddingRuntime(cache);
    try {
      const [words] = await runtime.topics(['어금니가 시려서 찬물 마시기가 힘들다']);
      expect(words.length).toBeGreaterThan(0);
      expect(words.length).toBeLessThanOrEqual(8);
      expect(words.every(word => /^(?:[가-힣]{2,}|[A-Za-z]{3,})$/.test(word))).toBe(true);
    } finally {
      await runtime.releaseAll();
      fs.rmSync(cache, { recursive: true, force: true });
    }
  });
});
