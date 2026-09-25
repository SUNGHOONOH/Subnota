export const EMBEDDING_MODEL_REPO = 'Xenova/bge-m3';
export const EMBEDDING_MODEL_REVISION = '4de13258303883538bd53b696b452bf8099f0858';
export const EMBEDDING_MODEL_DTYPE = 'q8';
export const EMBEDDING_MODEL_WEIGHTS = 'onnx/model_quantized.onnx';
export const EMBEDDING_MODEL_BYTES = 569_694_530;
export const EMBEDDING_MODEL_SHA256 =
  '0826f8c1ab9edf1801db86c61919d4d108e8bfc0b809ec823ad366882ff0b77d';
export const EMBEDDING_REQUIRED_DISK_BYTES = EMBEDDING_MODEL_BYTES + 200_000_000;
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
