// BAAI/bge-m3 에서 한국어·영어 밖 문자의 토큰만 뺀 int8 이식본(사전 250,002 → 91,471).
// 한·영 문장의 벡터는 원본과 같다(Transformers.js 기준 코사인 ≥ 0.99999). 만든 방법과
// 검증은 저장소의 모델 카드에 있다. 다른 언어를 지원하려면 원본에서 그 문자의 토큰을
// 다시 골라 새 파일을 올린다.
export const EMBEDDING_MODEL_REPO = 'Hoon03/subnota-bge-m3-koen-int8-onnx';
export const EMBEDDING_MODEL_REVISION = '3b2aa404f867251423f68c5c51b23d91688ab97b';
export const EMBEDDING_MODEL_DTYPE = 'q8';
export const EMBEDDING_MODEL_WEIGHTS = 'onnx/model_quantized.onnx';
export const EMBEDDING_MODEL_BYTES = 406_126_989;
export const EMBEDDING_MODEL_SHA256 =
  '1d2146b78742f6801528e971a2b4cd03f42d675d66d705c4e15fa34307f781c4';
/** 예전 검색 모델. 새 모델을 받아 검증한 뒤 지운다(업데이트로 남은 570MB). */
export const RETIRED_EMBEDDING_MODEL_REPOS = ['Xenova/bge-m3'] as const;
export const TOPIC_MODEL_REPO = 'Hoon03/subnota-ax-encoder-int8-onnx';
export const TOPIC_MODEL_REVISION = 'ce7ce9a158b28352fed762f86aab028385bc5f23';
export const TOPIC_MODEL_WEIGHTS = 'onnx/model_quantized.onnx';
export const TOPIC_MODEL_BYTES = 188_885_598;
export const TOPIC_MODEL_SHA256 =
  'fb18f550c6fd5194819a6c5fd8e1e318bc6524019543803b07fc4b5f131ee9c0';
export const TOPIC_MODEL_FILES = [
  { name: 'LICENSE', bytes: 11_358, sha256: 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30' },
  { name: 'config.json', bytes: 1_233, sha256: '9570c7f7318946d60d36db63ec7e7eac60db13176e3a62f54d45f93790838836' },
  { name: 'tokenizer.json', bytes: 1_087_185, sha256: 'ef9bebca9c6529bdefa19909059e07dfdfd7c2f8afeefbf4d230a784a3847d64' },
  { name: 'tokenizer_config.json', bytes: 6_946, sha256: '0a89e5ad9d547926c7f0170920cfb1ddae0b3b40f0784a5af5288d89a31d8252' },
  { name: 'special_tokens_map.json', bytes: 969, sha256: 'b2e1eb3be501860648066506fbb9b207b84d378b72f0177f72ff2deeadf1ff71' },
] as const;
export const TOPIC_MODEL_TOTAL_BYTES = TOPIC_MODEL_BYTES + TOPIC_MODEL_FILES.reduce((sum, file) => sum + file.bytes, 0);
export const EMBEDDING_REQUIRED_DISK_BYTES = EMBEDDING_MODEL_BYTES + TOPIC_MODEL_TOTAL_BYTES + 200_000_000;
export const TOPIC_MODEL_ID = 'skt/A.X-Encoder-base@9708f9c:onnx-int8-fb18f550:tpl1:stop1';
export const EMBEDDING_VECTOR_DIMENSIONS = 1024;
// bge-m3는 cls 풀링 + 접두사 없는 모델이다. 풀링을 틀리면 에러 없이 품질만
// 떨어지므로 모델 ID에 넣어 벡터 공간을 식별한다.
const EMBEDDING_MODEL_POOLING = 'cls';
// 로컬 인덱스 무효화 판정에 쓰므로 실제 모델·엔진·양자화·풀링에서 값을 만든다.
// 이 값이 바뀌면 기존 로컬 벡터는 버리고 다시 색인해야 한다.
//
// 전처리 버전도 들어간다 — `lib/chunkText.ts`의 정규화 규칙이 바뀌면 같은
// 본문이 다른 벡터가 되므로 옛 벡터와 섞이면 안 된다. 규칙을 고칠 때마다
// 숫자를 올려라. 채점(중심화·CSLS)은 저장된 벡터 위에서 계산만 하므로
// 여기 넣지 않는다 — 넣으면 채점을 손볼 때마다 전체 재색인이 돈다.
const EMBEDDING_NORMALIZATION_VERSION = 'norm1';
export const EMBEDDING_MODEL_ID =
  `${EMBEDDING_MODEL_REPO}@${EMBEDDING_MODEL_REVISION}:onnx-${EMBEDDING_MODEL_DTYPE}` +
  `:${EMBEDDING_MODEL_POOLING}:${EMBEDDING_NORMALIZATION_VERSION}`;
