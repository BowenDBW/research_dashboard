#!/usr/bin/env python3
"""
Arxiv crawler test script — 从外部调用 Rust 爬虫模块进行手工测试
通过 subprocess 运行 `cargo run -- --crawl` 启动独立爬虫模式（不启动 Tauri GUI）

Usage:
    # 测试编译
    python3 scripts/test_crawler.py --build-only

    # 运行爬虫（完整爬取订阅分类）
    python3 scripts/test_crawler.py

    # 查看帮助
    python3 scripts/test_crawler.py --help
"""

import argparse
import os
import subprocess
import sys
import time

# 项目根目录
PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TAURI_DIR = os.path.join(PROJECT_DIR, "src-tauri")


def cmd_cargo_build():
    """验证 Rust 模块编译"""
    print("=" * 60)
    print("Step 1: 编译 Rust 项目（含 crawler 模块）")
    print("=" * 60)

    result = subprocess.run(
        ["cargo", "build"],
        cwd=TAURI_DIR,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print("[FAILED] 编译失败:")
        print(result.stderr)
        sys.exit(1)

    print("[OK] 编译成功")
    return True


def cmd_crawler_run(dry_run=False):
    """通过 cargo run -- --crawl 启动 Rust 爬虫"""
    cmd = ["cargo", "run", "--", "--crawl"]

    print("=" * 60)
    print("Step 2: 启动 Rust 爬虫 (CLI 模式)")
    print(f"命令: {' '.join(cmd)}")
    print(f"工作目录: {TAURI_DIR}")
    print("=" * 60)

    start_time = time.time()

    process = subprocess.Popen(
        cmd,
        cwd=TAURI_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )

    # 实时输出
    assert process.stdout is not None
    for line in process.stdout:
        print(line, end="", flush=True)

    process.wait()
    elapsed = time.time() - start_time

    assert process.stderr is not None
    stderr = process.stderr.read()

    if process.returncode == 0:
        print(f"\n[DONE] 爬取完成，耗时 {elapsed:.1f} 秒")
    else:
        print(f"\n[FAILED] 爬取失败 (exit code={process.returncode})")
        if stderr:
            print(stderr)


def main():
    parser = argparse.ArgumentParser(
        description="Test the Rust arxiv crawler module via CLI mode"
    )
    parser.add_argument(
        "--build-only",
        action="store_true",
        help="只验证编译，不实际运行爬虫",
    )
    parser.add_argument(
        "--no-build",
        action="store_true",
        help="跳过编译步骤，直接运行爬虫",
    )
    args = parser.parse_args()

    # 确保在项目目录中
    if not os.path.isfile(os.path.join(TAURI_DIR, "Cargo.toml")):
        print(f"[ERROR] 找不到 src-tauri/Cargo.toml，请确认在项目根目录运行")
        print(f"       当前目录: {PROJECT_DIR}")
        sys.exit(1)

    if not args.no_build:
        cmd_cargo_build()

    if not args.build_only:
        print()
        cmd_crawler_run(dry_run=False)

    print("\n提示: 如果要在 Tauri GUI 中调用爬虫，请启动应用后使用 Tauri invoke:")
    print("  invoke('crawler_start')  — 后台启动爬取")
    print("  invoke('crawler_status') — 查看进度")
    print("  invoke('crawler_stop')   — 停止爬取")


if __name__ == "__main__":
    main()