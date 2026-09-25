# Third-party notices

Subnota uses the following embedding model artifacts. The model repositories and
their revisions are recorded here so the model source, license, and the exact
artifact used by each client remain auditable.

## Backend embedding model

- Model: `dragonkue/BGE-m3-ko`
- Revision: `7074d66aa46562342193ca4feb3d89bf9dad71b4`
- License: Apache License 2.0
- Attribution: `dragonkue`
- Base model attribution: `BAAI/bge-m3` (MIT License)
- Usage: requested through the Hugging Face Inference API; model weights are not
  bundled with Subnota.
- Source: <https://huggingface.co/dragonkue/BGE-m3-ko/tree/7074d66aa46562342193ca4feb3d89bf9dad71b4>
- Base model source: <https://huggingface.co/BAAI/bge-m3>
- License text: <https://www.apache.org/licenses/LICENSE-2.0>

## Desktop local embedding model

- Model: `Xenova/bge-m3`
- Revision: `4de13258303883538bd53b696b452bf8099f0858`
- Variant: `onnx/model_quantized.onnx` (`q8`)
- License: MIT License
- Attribution: `Xenova`
- Base model attribution: `BAAI/bge-m3` (MIT License)
- Usage: downloaded to the user's local application data on first use; model
  weights are not bundled in the installer.
- Source: <https://huggingface.co/Xenova/bge-m3/tree/4de13258303883538bd53b696b452bf8099f0858>
- Base model source: <https://huggingface.co/BAAI/bge-m3>
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
