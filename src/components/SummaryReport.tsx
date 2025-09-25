import React from 'react';
import type { CategoryData } from '../types';

interface SummaryReportProps {
  summary: string | null;
  onRestart: () => void;
  onBack: () => void;
}

export const SummaryReport: React.FC<SummaryReportProps> = ({
  summary,
  onRestart,
  onBack,
}) => {
  // 尝试从 summary 文本中提取之前生成的统计（如果存在），否则只展示 summary 文本
  const parseStats = (text: string | null) => {
    if (!text) return null;
    try {
      // 简单匹配格式：AI已将财务条目分为X个类别。其中： - Am 个类别金额完全一致 - Bm 个类别存在金额差异 - Cm 个类别数据缺失
      const matchTotal = text.match(/分为(\d+)个类别/);
      const matchMatch = text.match(/(\d+)个类别金额完全一致/);
      const matchMismatch = text.match(/(\d+)个类别存在金额差异/);
      const matchMissing = text.match(/(\d+)个类别数据缺失/);

      return {
        total: matchTotal ? Number(matchTotal[1]) : undefined,
        match: matchMatch ? Number(matchMatch[1]) : undefined,
        mismatch: matchMismatch ? Number(matchMismatch[1]) : undefined,
        missing: matchMissing ? Number(matchMissing[1]) : undefined,
      };
    } catch (e) {
      return null;
    }
  };

  const stats = parseStats(summary);

  return (
    <div className="text-white max-w-4xl mx-auto">
      <h2 className="text-2xl mb-4">总结报告</h2>

      {/* 概览统计（若可解析） */}
      {stats ? (
        <div className="bg-slate-800/50 p-4 rounded-lg mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-300">分类总数</div>
              <div className="text-xl font-bold">{stats.total ?? '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-300">金额一致</div>
              <div className="text-xl font-bold text-green-400">{stats.match ?? '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-300">金额差异</div>
              <div className="text-xl font-bold text-yellow-400">{stats.mismatch ?? '-'}</div>
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-400">数据缺失：{stats.missing ?? '-'}</div>
        </div>
      ) : null}

      {/* AI 生成的完整 summary 文本 */}
      <div className="bg-white/10 p-4 rounded-lg mb-4 max-w-2xl mx-auto whitespace-pre-wrap">
        <pre className="text-left text-sm text-gray-200">{summary || '暂无总结内容'}</pre>
      </div>

      <div className="mt-4 flex justify-center space-x-4">
        <button
          onClick={onBack}
          className="px-6 py-2 bg-gray-600 rounded-lg"
        >
          上一步
        </button>
        <button
          onClick={onRestart}
          className="px-6 py-2 bg-green-600 rounded-lg"
        >
          重新开始
        </button>
      </div>
    </div>
  );
};
