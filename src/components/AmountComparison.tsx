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
  return (
    <div className="text-center text-white">
      <h2 className="text-2xl mb-4">金额对比组件 (开发中)</h2>
      <p>分类数量: {Object.keys(data || {}).length}</p>
      <div className="mt-4 space-x-4">
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
