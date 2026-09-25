---
license: apache-2.0
base_model: skt/A.X-Encoder-base
tags:
  - onnx
  - quantized
  - korean
---

# A.X-Encoder-base — Subnota ONNX int8 conversion

This is an **unofficial conversion**, not a model created by Subnota or an
official SK Telecom release. The original model was developed by **SK Telecom
(SKT AI Model Lab)**: [skt/A.X-Encoder-base](https://huggingface.co/skt/A.X-Encoder-base),
revision `9708f9c404ace91efd25c06fac2d73413616f4ef`.

Subnota converted the original PyTorch masked-language model to ONNX (opset 17)
and dynamically quantized `MatMul` and `Gather` weights to signed int8. No
additional training or fine-tuning was performed. The conversion script is
published with the [Subnota desktop source](https://github.com/SUNGHOONOH/Subnota)
as `desktop/scripts/export-ax-encoder.py`.

The `onnx/model_quantized.onnx` file is 188,885,598 bytes and has SHA-256
`fb18f550c6fd5194819a6c5fd8e1e318bc6524019543803b07fc4b5f131ee9c0`.
The tokenizer and configuration files are copied unchanged from the original
revision. The original weights remain available from SKT's repository.

The original model is licensed under [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
A copy of that license is included in this repository as `LICENSE`. This
conversion is distributed under the same license. SK Telecom has not endorsed
this conversion or Subnota.
