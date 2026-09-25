"""Reproduce Subnota's unofficial A.X-Encoder-base ONNX int8 conversion.

Install torch, transformers, onnx and onnxruntime in a Python environment.
Download skt/A.X-Encoder-base at revision
9708f9c404ace91efd25c06fac2d73413616f4ef into a local directory, then run:

  python export-ax-encoder.py --model-dir /path/to/original --output /path/to/onnx

The original model is by SK Telecom under Apache-2.0. This script does not
train or fine-tune it. Re-exported binary hashes may differ across tool versions.
"""

import argparse
from pathlib import Path

import torch
from onnxruntime.quantization import QuantType, quantize_dynamic
from transformers import AutoModelForMaskedLM, AutoTokenizer


class LogitsOnly(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, input_ids, attention_mask):
        return self.model(input_ids=input_ids, attention_mask=attention_mask).logits


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    fp32 = args.output / 'model_fp32.onnx'
    int8 = args.output / 'model_quantized.onnx'

    tokenizer = AutoTokenizer.from_pretrained(args.model_dir)
    model = AutoModelForMaskedLM.from_pretrained(
        args.model_dir,
        dtype=torch.float32,
        attn_implementation='eager',
        reference_compile=False,
    ).eval()
    inputs = tokenizer('수영장에 가기 전에 준비물을 챙겼다.', return_tensors='pt')
    torch.onnx.export(
        LogitsOnly(model),
        (inputs['input_ids'], inputs['attention_mask']),
        str(fp32),
        input_names=['input_ids', 'attention_mask'],
        output_names=['logits'],
        dynamic_axes={
            'input_ids': {0: 'batch', 1: 'seq'},
            'attention_mask': {0: 'batch', 1: 'seq'},
            'logits': {0: 'batch', 1: 'seq'},
        },
        opset_version=17,
        dynamo=False,
    )
    quantize_dynamic(
        str(fp32), str(int8),
        weight_type=QuantType.QInt8,
        op_types_to_quantize=['MatMul', 'Gather'],
    )
    print(int8, int8.stat().st_size)


if __name__ == '__main__':
    main()
