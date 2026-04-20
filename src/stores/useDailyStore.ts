import { create } from 'zustand';
import { DailyReport, DailyReportListItem } from '../types';

interface DailyStore {
  reports: DailyReportListItem[];
  currentReport: DailyReport | null;
  loading: boolean;
  totalReports: number;

  // Actions
  fetchReports: (page: number, pageSize: number, searchMonth?: string) => Promise<void>;
  fetchReportById: (id: string) => Promise<DailyReport | null>;
  getRecentReports: () => DailyReportListItem[];
}

// Mock data for prototype
const mockReports: DailyReportListItem[] = [
  {
    id: 'daily-2024-01-15',
    date: '2024-01-15',
    title: '深度学习优化方法新进展',
    summary: '今日收录 12 篇论文，涵盖优化器改进、学习率调度、梯度压缩等领域',
    articleCount: 12,
  },
  {
    id: 'daily-2024-01-14',
    date: '2024-01-14',
    title: '大语言模型推理加速技术',
    summary: '今日收录 8 篇论文，包括量化、剪枝、知识蒸馏等推理优化方法',
    articleCount: 8,
  },
  {
    id: 'daily-2024-01-13',
    date: '2024-01-13',
    title: '多模态学习前沿进展',
    summary: '今日收录 15 篇论文，涉及视觉-语言模型、音频处理、跨模态对齐等',
    articleCount: 15,
  },
  {
    id: 'daily-2024-01-12',
    date: '2024-01-12',
    title: '图神经网络应用研究',
    summary: '今日收录 10 篇论文，涵盖分子图学习、社交网络分析、推荐系统等应用',
    articleCount: 10,
  },
  {
    id: 'daily-2024-01-11',
    date: '2024-01-11',
    title: '注意力机制改进研究',
    summary: '今日收录 9 篇论文，包括线性注意力、稀疏注意力、高效Transformer变体',
    articleCount: 9,
  },
  {
    id: 'daily-2024-01-10',
    date: '2024-01-10',
    title: '强化学习算法突破',
    summary: '今日收录 11 篇论文，涵盖模型预测控制、策略优化、探索策略改进',
    articleCount: 11,
  },
  {
    id: 'daily-2024-01-09',
    date: '2024-01-09',
    title: '自然语言生成技术',
    summary: '今日收录 7 篇论文，涉及文本生成质量评估、可控生成、长文本生成',
    articleCount: 7,
  },
  {
    id: 'daily-2024-01-08',
    date: '2024-01-08',
    title: '计算机视觉新架构',
    summary: '今日收录 14 篇论文，包括Vision Transformer改进、卷积网络优化等',
    articleCount: 14,
  },
];

const mockReportContent = `# 深度学习优化方法新进展

**日期**: 2024-01-15

## 概述

今日 Claw 共收录 **12 篇** 与深度学习优化相关的高质量论文，涵盖以下几个主要方向：

- 优化器改进
- 学习率调度策略
- 梯度压缩与通信优化
- 自适应训练方法

## 重点论文推荐

### 1. AdamW 的收敛性分析与改进

**论文链接**: [arXiv:2401.01234](https://arxiv.org/abs/2401.01234)

本文对 AdamW 优化器进行了严格的理论分析，证明了其在非凸优化问题上的收敛性。作者提出了一种改进的权重衰减策略，在保持收敛性的同时提高了泛化性能。

**核心贡献**:
- 首次给出 AdamW 的收敛性证明
- 提出自适应权重衰减策略
- 在 ImageNet 和 GLUE 基准上验证有效性

### 2. 学习率预热的必要性研究

**论文链接**: [arXiv:2401.05678](https://arxiv.org/abs/2401.05678)

本研究深入分析了学习率预热对训练稳定性的影响，发现在大模型训练中，预热阶段对于避免早期训练崩溃至关重要。

**核心发现**:
- 预热阶段帮助初始化更好的梯度估计
- 推导出最小预热长度的理论下界
- 提出动态预热策略

## 其他收录论文

3. **梯度压缩中的误差补偿机制** - 提出新的误差补偿方法，显著提升分布式训练效率
4. **AdaBelief 在 NLP 任务上的表现** - 分析 AdaBelief 与 Adam 在 Transformer 训练中的差异
5. **动量方法的方差缩减** - 理论分析动量对方差缩减的贡献
6. **二阶优化方法的实用改进** - 降低 K-FAC 的计算开销
7. **学习率调度的自动化** - 基于验证集反馈的自动调度
8. **梯度噪声与泛化的关系** - 实验验证梯度噪声对泛化的影响
9. **批量大小自适应训练** - 动态调整批量大小的策略
10. **混合精度训练的稳定性分析** - 解决 FP16 训练中的数值问题
11. **分布式训练中的通信压缩** - 新的拓扑感知压缩算法
12. **学习率衰减策略的比较研究** - 余弦衰减 vs 线性衰减的实证比较

## 总结

今日收录的论文为深度学习优化领域提供了新的理论见解和实用方法。特别是对 AdamW 的收敛性分析和学习率预热的理论研究，为大模型训练提供了重要指导。

---

*由 Claw 智能生成*`;

export const useDailyStore = create<DailyStore>((set, get) => ({
  reports: mockReports,
  currentReport: null,
  loading: false,
  totalReports: mockReports.length,

  fetchReports: async (page: number, pageSize: number, searchMonth?: string) => {
    set({ loading: true });
    await new Promise((resolve) => setTimeout(resolve, 300));

    let filtered = mockReports;
    if (searchMonth) {
      // Filter by month prefix (YYYY-MM)
      filtered = mockReports.filter((r) => r.date.startsWith(searchMonth));
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginated = filtered.slice(start, end);

    set({
      reports: paginated,
      totalReports: filtered.length,
      loading: false,
    });
  },

  fetchReportById: async (id: string) => {
    set({ loading: true });
    await new Promise((resolve) => setTimeout(resolve, 200));

    const reportItem = mockReports.find((r) => r.id === id);
    if (!reportItem) {
      set({ loading: false, currentReport: null });
      return null;
    }

    const report: DailyReport = {
      ...reportItem,
      content: mockReportContent,
      createdAt: `${reportItem.date}T00:00:00`,
      updatedAt: `${reportItem.date}T00:00:00`,
    };

    set({ currentReport: report, loading: false });
    return report;
  },

  getRecentReports: () => {
    return mockReports.slice(0, 5);
  },
}));