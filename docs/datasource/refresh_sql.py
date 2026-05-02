#!/usr/bin/env python3
"""
数据库重置脚本（⚠️ 危险！删除所有数据）

用途：开发时重置数据库到初始状态
行为：
  - DROP 所有现有表
  - 根据 research_dashboard.sql 重建空表结构

警告：运行此脚本会永久删除所有数据！
       包括用户论文、收藏、对话、历史记录等

适用场景：仅用于开发测试，不要在真实用户环境中运行
"""
import os
import sqlite3
from pathlib import Path

def main():
    # ==== 路径定义 ====
    # 数据库按设计文档统一存放在用户目录
    home_dir = Path.home()
    app_dir = home_dir / ".research_dashboard"
    db_path = app_dir / "research_dashboard.db"

    # 动态获取 .sql 文件的路径
    sql_path = Path(__file__).parent / "research_dashboard.sql"

    print(f"[*] 目标应用数据夹: {app_dir}")
    # 1. 创建目标文件夹
    app_dir.mkdir(parents=True, exist_ok=True)

    # 2. 删除已有的 sql 文件
    if db_path.exists():
        print(f"[*] 发现旧数据库，正在删除: {db_path}")
        try:
            db_path.unlink()
        except PermissionError:
            print(f"[!] 删除旧数据库失败，可能正被其他程序占用！")
            return
    else:
        print(f"[*] 未发现旧数据库，将创建新文件: {db_path}")

    # 3. 检查 SQL 文件
    if not sql_path.exists():
        print(f"[!] 错误：未找到初始化的 SQL 脚本: {sql_path}")
        return

    # 4. 执行 SQL 创建新环境
    print(f"[*] 正在读取并执行 SQL 脚本: {sql_path.name} ...")
    try:
        with open(sql_path, "r", encoding="utf-8") as f:
            sql_script = f.read()

        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.executescript(sql_script)
        conn.commit()

        print(f"[+] 数据库初始化/重置成功！")
        print(f"[+] 重置完成，本地数据库为 => {db_path}")

    except sqlite3.Error as e:
        print(f"[!] SQLite 数据库执行错误: {e}")
    except Exception as e:
        print(f"[!] 发生未知错误: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    main()

