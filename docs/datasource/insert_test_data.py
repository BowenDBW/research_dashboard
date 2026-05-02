#!/usr/bin/env python3
"""
测试数据插入脚本（⚠️ 需配合 refresh_sql.py 使用）

用途：开发测试时快速填充假数据以便体验应用功能
行为：
  - 插入假论文、收藏、订阅、对话等数据
  - 不会删除数据，但会和真实数据混合（所以建议先运行 refresh_sql.py）

建议流程：
  1. python refresh_sql.py    # 删除所有表重建（危险）
  2. python import_venues.py  # 导入刊会分区数据（安全）
  3. python insert_test_data.py  # 插入测试假数据

警告：运行 refresh_sql.py 会删除所有用户数据！
       insert_test_data.py 本身不删除数据，但与真实数据混用会导致混乱

可重复运行：不建议，会导致数据重复
"""
import os
import sqlite3
import random
from datetime import datetime, timedelta
from pathlib import Path

def find_or_create_venue(cursor, name, venue_type='journal'):
    """查找或创建venue，返回venue_id"""
    cursor.execute("SELECT venue_id FROM venues WHERE name = ? LIMIT 1", (name,))
    result = cursor.fetchone()
    if result:
        return result[0]
    cursor.execute("INSERT INTO venues (name, venue_type) VALUES (?, ?)", (name, venue_type))
    return cursor.lastrowid

def main():
    # 数据库路径
    home_dir = Path.home()
    app_dir = home_dir / ".research_dashboard"
    db_path = app_dir / "research_dashboard.db"

    if not db_path.exists():
        print(f"[!] 数据库不存在: {db_path}")
        print(f"[!] 请先运行 refresh_sql.py 创建数据库")
        return

    print(f"[*] 连接数据库: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # ==========================================
    # 1. Papers (论文数据)
    # 注意：arxiv文章没有venue_id，venue_id应该是NULL
    # ==========================================
    papers_data = [
        ("Attention Is All You Need", "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.", "2017-06-12", "1706.03762", None, "https://arxiv.org/abs/1706.03762", "https://arxiv.org/pdf/1706.03762"),
        ("BERT: Pre-training of Deep Bidirectional Transformers", "We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers.", "2018-10-11", "1810.04805", None, "https://arxiv.org/abs/1810.04805", "https://arxiv.org/pdf/1810.04805"),
        ("GPT-4 Technical Report", "We report the development of GPT-4, a large-scale, multimodal model which can accept image and text inputs and produce text outputs.", "2023-03-14", "2303.08774", None, "https://arxiv.org/abs/2303.08774", "https://arxiv.org/pdf/2303.08774"),
        ("LoRA: Low-Rank Adaptation of Large Language Models", "We propose Low-Rank Adaptation, or LoRA, which freezes the pre-trained model weights and injects trainable rank decomposition matrices into each layer.", "2021-06-17", "2106.09685", None, "https://arxiv.org/abs/2106.09685", "https://arxiv.org/pdf/2106.09685"),
        ("Chain-of-Thought Prompting Elicits Reasoning", "We explore how generating a chain of thought—a series of intermediate reasoning steps—significantly improves the ability of large language models to perform complex reasoning.", "2022-01-28", "2201.11903", None, "https://arxiv.org/abs/2201.11903", "https://arxiv.org/pdf/2201.11903"),
        ("Constitutional AI: Harmlessness from AI Feedback", "As AI systems become more capable, we would like to enlist their help to supervise other AI agents. We explore methods for training AI systems to be helpful and harmless.", "2022-12-15", "2212.08073", None, "https://arxiv.org/abs/2212.08073", "https://arxiv.org/pdf/2212.08073"),
        ("Vision Transformer: An Image is Worth 16x16 Words", "While the Transformer architecture has become the de-facto standard for NLP tasks, its applications to computer vision remain limited. We show that a pure transformer applied directly to sequences of image patches can perform very well.", "2020-10-22", "2010.11929", None, "https://arxiv.org/abs/2010.11929", "https://arxiv.org/pdf/2010.11929"),
        ("DALL-E: Zero-Shot Text-to-Image Generation", "We present DALL-E, a transformer that generates images from text tokens, achieving zero-shot performance competitive with state-of-the-art models.", "2021-02-05", "2102.12092", None, "https://arxiv.org/abs/2102.12092", "https://arxiv.org/pdf/2102.12092"),
        ("ResNet: Deep Residual Learning for Image Recognition", "We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously.", "2015-12-10", "1512.03385", None, "https://arxiv.org/abs/1512.03385", "https://arxiv.org/pdf/1512.03385"),
        ("Adam: A Method for Stochastic Optimization", "We propose Adam, a method for stochastic optimization that only requires first-order gradients with little memory requirement.", "2014-12-22", "1412.6980", None, "https://arxiv.org/abs/1412.6980", "https://arxiv.org/pdf/1412.6980"),
        ("Dropout: A Simple Way to Prevent Neural Networks from Overfitting", "Deep neural nets with a large number of parameters are very powerful machine learning systems. However, overfitting is a serious problem in such networks.", "2014-01-10", "1301.3781", None, "https://arxiv.org/abs/1301.3781", "https://arxiv.org/pdf/1301.3781"),
        ("Batch Normalization: Accelerating Deep Network Training", "We present a novel method for training deep neural networks that normalizes the activations of each layer.", "2015-02-11", "1502.03167", None, "https://arxiv.org/abs/1502.03167", "https://arxiv.org/pdf/1502.03167"),
        ("YOLO: Real-Time Object Detection", "We present YOLO, a new approach to object detection. Prior work on object detection repurposes classifiers to perform detection.", "2015-06-08", "1506.02640", None, "https://arxiv.org/abs/1506.02640", "https://arxiv.org/pdf/1506.02640"),
        ("Generative Adversarial Networks", "We propose a new framework for estimating generative models via an adversarial process, in which we simultaneously train two models.", "2014-06-10", "1406.2661", None, "https://arxiv.org/abs/1406.2661", "https://arxiv.org/pdf/1406.2661"),
        ("Variational Autoencoders", "We introduce a stochastic variational inference and learning algorithm that scales to large datasets.", "2013-12-20", "1312.6114", None, "https://arxiv.org/abs/1312.6114", "https://arxiv.org/pdf/1312.6114"),
        ("Deep Learning in Neural Networks: An Overview", "This monograph provides an overview of general deep learning methodology including its mathematical foundations.", "2014-04-14", "1404.7828", None, "https://arxiv.org/abs/1404.7828", "https://arxiv.org/pdf/1404.7828"),
        ("Sequence to Sequence Learning with Neural Networks", "We present a general end-to-end approach to sequence learning that makes minimal assumptions on the sequence structure.", "2014-09-10", "1409.3215", None, "https://arxiv.org/abs/1409.3215", "https://arxiv.org/pdf/1409.3215"),
        ("Neural Machine Translation by Jointly Learning to Align and Translate", "We propose a novel architecture for neural machine translation that learns to align and translate jointly.", "2014-09-01", "1409.0473", None, "https://arxiv.org/abs/1409.0473", "https://arxiv.org/pdf/1409.0473"),
        ("Word2Vec: Efficient Estimation of Word Representations", "We propose two novel model architectures for computing continuous vector representations of words from very large data sets.", "2013-01-16", "1301.3781", None, "https://arxiv.org/abs/1301.3781", "https://arxiv.org/pdf/1301.3781"),
        ("GloVe: Global Vectors for Word Representation", "We propose a new global log-bilinear regression model that combines the advantages of global matrix factorization and local context window methods.", "2014-02-14", "1402.2252", None, "https://arxiv.org/abs/1402.2252", "https://arxiv.org/pdf/1402.2252"),
    ]

    print("[*] 插入论文数据...")
    for paper in papers_data:
        cursor.execute(
            "INSERT INTO papers (title, abstract, publication_date, preprint_number, venue_id, publication_link, pdf_link) VALUES (?, ?, ?, ?, ?, ?, ?)",
            paper
        )
    print(f"[+] 已插入 {len(papers_data)} 篇论文")

    # ==========================================
    # 2. Paper Authors
    # ==========================================
    authors_data = [
        # Transformers (1)
        (1, "Ashish Vaswani", 1), (1, "Noam Shazeer", 2), (1, "Niki Parmar", 3), (1, "Jakob Uszkoreit", 4),
        (1, "Llion Jones", 5), (1, "Aidan Gomez", 6), (1, "Łukasz Kaiser", 7), (1, "Illia Polosukhin", 8),
        # BERT (2)
        (2, "Jacob Devlin", 1), (2, "Ming-Wei Chang", 2), (2, "Kenton Lee", 3), (2, "Kristina Toutanova", 4),
        # GPT-4 (3)
        (3, "OpenAI", 1),
        # LoRA (4)
        (4, "Edward Hu", 1), (4, "Yelong Shen", 2), (4, "Phillip Wallis", 3), (4, "Zeyuan Allen-Zhu", 4),
        # CoT (5)
        (5, "Jason Wei", 1), (5, "Xuezhi Wang", 2), (5, "Dale Schuurmans", 3),
        # ViT (7)
        (7, "Alexey Dosovitskiy", 1), (7, "Lucas Beyer", 2), (7, "Alexander Kolesnikov", 3),
        # DALL-E (8)
        (8, "Aditya Ramesh", 1), (8, "Mikhail Pavlov", 2), (8, "Gabriel Goh", 3),
        # ResNet (9)
        (9, "Kaiming He", 1), (9, "Xiangyu Zhang", 2), (9, "Shaoqing Ren", 3), (9, "Jian Sun", 4),
        # Adam (10)
        (10, "Diederik Kingma", 1), (10, "Jimmy Ba", 2),
        # GANs (14)
        (14, "Ian Goodfellow", 1), (14, "Jean Pouget-Abadie", 2), (14, "Mehdi Mirza", 3),
        # Seq2Seq (17)
        (17, "Ilya Sutskever", 1), (17, "Oriol Vinyals", 2), (17, "Quoc Le", 3),
    ]

    print("[*] 插入论文作者...")
    for author in authors_data:
        cursor.execute(
            "INSERT INTO paper_authors (article_id, author_name, author_order) VALUES (?, ?, ?)",
            author
        )
    print(f"[+] 已插入 {len(authors_data)} 条作者记录")

    # ==========================================
    # 3. Paper Categories
    # ==========================================
    categories_data = [
        (1, "cs.CL"), (1, "cs.LG"), (1, "cs.AI"),
        (2, "cs.CL"), (2, "cs.LG"),
        (3, "cs.AI"), (3, "cs.CL"), (3, "cs.LG"),
        (4, "cs.LG"), (4, "cs.CL"),
        (5, "cs.AI"), (5, "cs.CL"),
        (6, "cs.AI"), (6, "cs.LG"),
        (7, "cs.CV"), (7, "cs.LG"),
        (8, "cs.CV"), (8, "cs.LG"),
        (9, "cs.CV"), (9, "cs.LG"),
        (10, "cs.LG"),
        (11, "cs.LG"), (11, "cs.NE"),
        (12, "cs.LG"), (12, "cs.CV"),
        (13, "cs.CV"),
        (14, "cs.LG"), (14, "cs.CV"),
        (15, "cs.LG"), (15, "cs.AI"),
        (16, "cs.LG"), (16, "cs.NE"),
        (17, "cs.CL"), (17, "cs.LG"),
        (18, "cs.CL"), (18, "cs.LG"),
        (19, "cs.CL"), (19, "cs.LG"),
        (20, "cs.CL"), (20, "cs.LG"),
    ]

    print("[*] 插入论文分类...")
    for cat in categories_data:
        cursor.execute(
            "INSERT INTO paper_categories (article_id, category) VALUES (?, ?)",
            cat
        )
    print(f"[+] 已插入 {len(categories_data)} 条分类记录")

    # ==========================================
    # 4. Favorite Folders
    # ==========================================
    folders_data = [
        (None, "深度学习基础"),
        (None, "Transformer系列"),
        (1, "注意力机制"),
        (1, "预训练模型"),
        (None, "计算机视觉"),
        (None, "生成模型"),
    ]

    print("[*] 插入收藏文件夹...")
    folder_ids = []
    for folder in folders_data:
        cursor.execute(
            "INSERT INTO favorite_folders (parent_id, folder_name) VALUES (?, ?)",
            folder
        )
        folder_ids.append(cursor.lastrowid)
    print(f"[+] 已插入 {len(folders_data)} 个文件夹")

    # ==========================================
    # 5. Favorite Papers
    # ==========================================
    favorites_data = [
        (1, None),   # Attention Is All You Need - 根目录
        (2, None),   # BERT - 根目录
        (4, 3),      # LoRA - 深度学习基础/注意力机制
        (7, folder_ids[4]),  # ViT - 计算机视觉
        (9, folder_ids[4]),  # ResNet - 计算机视觉
        (14, folder_ids[5]), # GANs - 生成模型
        (15, folder_ids[5]), # VAE - 生成模型
        (3, folder_ids[3]),  # GPT-4 - Transformer系列/预训练模型
        (5, None),   # CoT - 根目录
        (6, None),   # Constitutional AI - 根目录
    ]

    print("[*] 插入收藏论文...")
    for fav in favorites_data:
        cursor.execute(
            "INSERT INTO favorite_papers (article_id, folder_id) VALUES (?, ?)",
            fav
        )
    print(f"[+] 已插入 {len(favorites_data)} 条收藏记录")

    # ==========================================
    # 6. Subscribed Authors
    # ==========================================
    subscribed_authors = [
        ("Yann LeCun"),
        ("Geoffrey Hinton"),
        ("Andrew Ng"),
        ("Ian Goodfellow"),
        ("Kaiming He"),
    ]

    print("[*] 插入订阅作者...")
    for author in subscribed_authors:
        cursor.execute(
            "INSERT INTO subscribed_authors (author_name) VALUES (?)",
            (author,)
        )
    print(f"[+] 已插入 {len(subscribed_authors)} 位订阅作者")

    # ==========================================
    # 7. Subscribed Categories
    # ==========================================
    subscribed_categories = [
        ("cs.AI"),
        ("cs.LG"),
        ("cs.CL"),
        ("cs.CV"),
    ]

    print("[*] 插入订阅分类...")
    for cat in subscribed_categories:
        cursor.execute(
            "INSERT INTO subscribed_categories (category) VALUES (?)",
            (cat,)
        )
    print(f"[+] 已插入 {len(subscribed_categories)} 个订阅分类")

    # ==========================================
    # 8. Subscribed Keywords
    # ==========================================
    subscribed_keywords = [
        ("transformer"),
        ("attention"),
        ("pre-training"),
        ("fine-tuning"),
        ("generative"),
        ("diffusion"),
    ]

    print("[*] 插入订阅关键词...")
    for kw in subscribed_keywords:
        cursor.execute(
            "INSERT INTO subscribed_keywords (keyword) VALUES (?)",
            (kw,)
        )
    print(f"[+] 已插入 {len(subscribed_keywords)} 个订阅关键词")

    # ==========================================
    # 9. Chat Sessions
    # ==========================================
    sessions_data = [
        ("关于Transformer的讨论", None, "chat"),
        ("BERT论文分析", 2, "paper_chat"),
        ("深度学习入门指南", None, "chat"),
        ("ResNet架构解读", 9, "paper_chat"),
        ("GAN生成图像探讨", 14, "paper_chat"),
        ("模型优化技巧", None, "chat"),
    ]

    print("[*] 插入对话会话...")
    session_ids = []
    for session in sessions_data:
        cursor.execute(
            "INSERT INTO chat_sessions (title, article_id, mode) VALUES (?, ?, ?)",
            session
        )
        session_ids.append(cursor.lastrowid)
    print(f"[+] 已插入 {len(sessions_data)} 个对话会话")

    # ==========================================
    # 10. Chat Messages
    # ==========================================
    messages_data = [
        # Session 1: Transformer讨论
        (1, "user", "请解释一下Transformer的核心思想"),
        (1, "assistant", "Transformer的核心创新在于完全抛弃了RNN和CNN的结构，仅使用注意力机制来处理序列数据。这使得模型可以并行处理序列中的所有位置，大大提高了训练效率。"),
        (1, "user", "自注意力机制是如何工作的？"),
        (1, "assistant", "自注意力机制通过计算序列中每个位置与其他所有位置的相关性来生成新的表示。具体来说，它使用Query、Key、Value三个矩阵，通过Query与Key的点积计算注意力权重，然后与Value加权求和。"),

        # Session 2: BERT论文分析
        (2, "user", "BERT的预训练任务是什么？"),
        (2, "assistant", "BERT使用两个预训练任务：Masked Language Model (MLM) 和 Next Sentence Prediction (NSP)。MLM随机遮盖15%的词汇让模型预测，NSP判断两句话是否连续。"),

        # Session 3: 深度学习入门
        (3, "user", "什么是深度学习？"),
        (3, "assistant", "深度学习是机器学习的一个分支，使用多层神经网络来学习数据的层次化表示。它能够自动从原始数据中提取特征，无需人工设计特征工程。"),

        # Session 4: ResNet架构
        (4, "user", "ResNet的残差连接有什么作用？"),
        (4, "assistant", "残差连接解决了深度网络训练中的梯度消失问题。通过跳跃连接，梯度可以直接传递到前面的层，使得网络可以训练得更深而不会出现退化。"),
    ]

    print("[*] 插入对话消息...")
    for msg in messages_data:
        cursor.execute(
            "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)",
            msg
        )
    print(f"[+] 已插入 {len(messages_data)} 条对话消息")

    # ==========================================
    # 11. User Action Logs (历史记录)
    # ==========================================
    conn.commit()
    conn.close()

    print("\n[+] ========== 测试数据插入完成！ ==========")
    print(f"[+] 数据库位置: {db_path}")
    print("[+] 包含:")
    print(f"    - {len(papers_data)} 篇论文")
    print(f"    - {len(folders_data)} 个收藏文件夹")
    print(f"    - {len(favorites_data)} 条收藏记录")
    print(f"    - {len(subscribed_authors)} 位订阅作者")
    print(f"    - {len(subscribed_categories)} 个订阅分类")
    print(f"    - {len(subscribed_keywords)} 个订阅关键词")
    print(f"    - {len(sessions_data)} 个对话会话")
    print("\n[*] 现在可以启动应用体验了！")

if __name__ == "__main__":
    main()