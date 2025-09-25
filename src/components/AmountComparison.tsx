import React from 'react';
import type { CategoryData } from '../types';

interface AmountComparisonProps {
  data: CategoryData | null;
  onNext: () => void;
  onBack: () => void;
}

export const AmountComparison: React.FC<AmountComparisonProps> = ({
  data,
  onNext,
  onBack,
}) => {
  // 计算总体统计
  const categoryNames = data ? Object.keys(data) : [];
  const totalStandardAll = categoryNames.reduce((s, k) => s + (data?.[k]?.totalStandard || 0), 0);
  const totalCheckAll = categoryNames.reduce((s, k) => s + (data?.[k]?.totalCheck || 0), 0);
  const totalDifferenceAll = Math.abs(totalStandardAll - totalCheckAll);

  return (
    <div className="text-white max-w-6xl mx-auto">
      <h2 className="text-2xl mb-4">金额对比</h2>

      {/* 总体统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="glass-effect p-4 rounded-xl text-center">
          <div className="text-sm text-gray-300">分类数量</div>
          <div className="text-2xl font-bold text-white">{categoryNames.length}</div>
        </div>
        <div className="glass-effect p-4 rounded-xl text-center">
          <div className="text-sm text-gray-300">标准表总金额</div>
          <div className="text-2xl font-bold text-white">¥{totalStandardAll.toLocaleString('zh-CN')}</div>
        </div>
        <div className="glass-effect p-4 rounded-xl text-center">
          <div className="text-sm text-gray-300">待核对表总金额（差异）</div>
          <div className="text-2xl font-bold text-white">¥{totalCheckAll.toLocaleString('zh-CN')} <span className="text-sm text-gray-400">| 差值 ¥{totalDifferenceAll.toLocaleString('zh-CN')}</span></div>
        </div>
      </div>

      {/* 每类明细 */}
      <div className="bg-slate-900/50 p-4 rounded-lg max-h-[60vh] overflow-y-auto">
        {categoryNames.length === 0 ? (
          <div className="text-center text-gray-400 py-12">暂无分类数据</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-300 border-b border-gray-700">
                <th className="py-2 px-3">类别</th>
                <th className="py-2 px-3">标准表金额</th>
                <th className="py-2 px-3">待核对表金额</th>
                <th className="py-2 px-3">差值</th>
                <th className="py-2 px-3">状态</th>
              </tr>
            </thead>
            <tbody>
              {categoryNames.map(name => {
                const cat = data?.[name];
                const ts = cat?.totalStandard ?? 0;
                const tc = cat?.totalCheck ?? 0;
                const diff = Math.abs(ts - tc);
                const status = cat?.status ?? 'missing';
                const statusColor = status === 'match' ? 'text-green-400' : status === 'mismatch' ? 'text-yellow-400' : 'text-red-400';

                return (
                  <tr key={name} className="border-b border-gray-800">
                    <td className="py-2 px-3 align-top w-1/3">{name}</td>
                    <td className="py-2 px-3 align-top">¥{ts.toLocaleString('zh-CN')}</td>
                    <td className="py-2 px-3 align-top">¥{tc.toLocaleString('zh-CN')}</td>
                    <td className="py-2 px-3 align-top">¥{diff.toLocaleString('zh-CN')}</td>
                    <td className="py-2 px-3 align-top"><span className={statusColor}>{status === 'match' ? '一致' : status === 'mismatch' ? '差异' : '缺失'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="mt-6 flex justify-center space-x-4">
        <button
          onClick={onBack}
          className="px-6 py-2 bg-gray-600 rounded-lg"
        >
          上一步
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-blue-600 rounded-lg"
        >
          下一步
        </button>
      </div>
    </div>
  );
};
