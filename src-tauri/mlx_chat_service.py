#!/usr/bin/env python3
"""
MLX Chat Service - Sidecar binary for Tauri app
Usage: mlx-chat-service --model <path> --messages <json> --max-tokens <int>

Model path must be a directory containing:
- config.json (model architecture)
- model weights (safetensors/mlx format)
"""

import argparse
import json
import sys
import os
from pathlib import Path
from mlx_lm import load, generate


def validate_model_path(model_path: str) -> Path:
    """Validate model path contains required files."""
    path = Path(model_path)

    if not path.exists():
        raise FileNotFoundError(
            f"Model path does not exist: {model_path}\n"
            f"Absolute path searched: {path.absolute()}"
        )

    if not path.is_dir():
        raise ValueError(
            f"Model path must be a directory, not a file: {model_path}\n"
            f"Absolute path: {path.absolute()}"
        )

    config_path = path / "config.json"
    if not config_path.exists():
        raise FileNotFoundError(
            f"Model directory missing config.json\n"
            f"Model path: {model_path}\n"
            f"Absolute path: {path.absolute()}\n"
            f"Looking for config.json at: {config_path.absolute()}\n"
            f"\n"
            f"A valid MLX model directory should contain:\n"
            f"  - config.json (model architecture config)\n"
            f"  - model weights files (.safetensors, weights.npz, etc.)\n"
            f"\n"
            f"Files found in directory:\n"
            f"  {list(path.iterdir()) if path.exists() else '(directory not found)'}\n"
            f"\n"
            f"You can convert HuggingFace models using: mlx_lm.convert --model <hf-model-name> --mlx-path <output-path>"
        )

    return path


def chat(model_path: str, messages: list, max_tokens: int = 2048) -> str:
    """
    使用 MLX 进行聊天对话。

    Args:
        model_path: 本地模型目录路径（包含 config.json 和权重文件）
        messages: 消息列表 [{"role": "user/assistant/system", "content": "..."}]
        max_tokens: 最大生成 token 数

    Returns:
        生成的响应文本
    """
    # Validate model path first
    validate_model_path(model_path)

    model, tokenizer = load(model_path)

    prompt = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )

    response = generate(
        model,
        tokenizer,
        prompt=prompt,
        max_tokens=max_tokens,
        verbose=False,
    )
    return response


def main():
    parser = argparse.ArgumentParser(
        description="MLX Chat Service",
        epilog="Example: mlx-chat-service --model /path/to/mlx-model --messages '[{\"role\":\"user\",\"content\":\"Hello\"}]'"
    )
    parser.add_argument("--model", required=True, help="Local model directory path (must contain config.json)")
    parser.add_argument("--messages", required=True, help="Messages JSON array")
    parser.add_argument("--max-tokens", type=int, default=2048, help="Max tokens to generate")

    args = parser.parse_args()

    # Parse messages JSON
    try:
        messages = json.loads(args.messages)
    except json.JSONDecodeError as e:
        print(f"Error parsing messages JSON: {e}", file=sys.stderr)
        sys.exit(1)

    # Validate messages format
    if not isinstance(messages, list):
        print("Messages must be a JSON array", file=sys.stderr)
        sys.exit(1)

    # Run chat
    try:
        response = chat(args.model, messages, args.max_tokens)
        print(response)
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error during generation: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()