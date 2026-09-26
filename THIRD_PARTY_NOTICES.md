# Third-party notices

Subnota uses the following embedding model artifacts. The model repositories and
their revisions are recorded here so the model source, license, and the exact
artifact used by each client remain auditable.

## Backend embedding model

- Model: `BAAI/bge-m3`
- Revision: `5617a9f61b028005a4858fdac845db406aefb181`
- License: MIT License
- Attribution: BAAI
- Usage: requested through the Hugging Face Inference API; model weights are not
  bundled with Subnota.
- Source: <https://huggingface.co/BAAI/bge-m3/tree/5617a9f61b028005a4858fdac845db406aefb181>
- License text: <https://opensource.org/license/mit/>

## Desktop local embedding model

- Original model: `BAAI/bge-m3` by BAAI
- Original revision: `5617a9f61b028005a4858fdac845db406aefb181`
- License: MIT License
- Original source: <https://huggingface.co/BAAI/bge-m3>
- Distributed artifact: <https://huggingface.co/Hoon03/subnota-bge-m3-koen-int8-onnx/tree/3b2aa404f867251423f68c5c51b23d91688ab97b>
- Modification: unofficial Subnota conversion. Tokens whose text contains a
  letter outside Hangul and ASCII were removed from the vocabulary (250,002 to
  91,471 tokens; kept embedding rows unchanged), then exported to ONNX and
  dynamically quantized to int8. No training was performed. Tokenizer and
  configuration files derive from `Xenova/bge-m3`
  (revision `4de13258303883538bd53b696b452bf8099f0858`, MIT License).
- Usage: downloaded to the user's local application data on first use; model
  weights are not bundled in the installer.
- License text: <https://opensource.org/license/mit/>

## Desktop local topic-word model

- Original model: `skt/A.X-Encoder-base` by SK Telecom (SKT AI Model Lab)
- Original revision: `9708f9c404ace91efd25c06fac2d73413616f4ef`
- License: Apache License 2.0
- Original source: <https://huggingface.co/skt/A.X-Encoder-base>
- Distributed artifact: <https://huggingface.co/Hoon03/subnota-ax-encoder-int8-onnx/tree/ce7ce9a158b28352fed762f86aab028385bc5f23>
- Change: Subnota made an **unofficial** ONNX opset-17 export of the original
  masked-language model and dynamically quantized its MatMul and Gather weights
  to signed int8. No further training or fine-tuning was performed. This is not
  an official SK Telecom release or endorsement.
- Usage: downloaded on request with the desktop embedding model; topic-word
  inference and subsequent search-vector calculation run on the user's device.
  Model weights are not bundled in the installer.
- License text: <https://www.apache.org/licenses/LICENSE-2.0> and the `LICENSE`
  file in the distributed model repository. The conversion script is
  `desktop/scripts/export-ax-encoder.py`.

The model repositories identify the license metadata above. If a model revision
changes, update this file and the corresponding model signature in the code
before releasing the change.
