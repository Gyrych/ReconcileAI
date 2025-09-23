import React from 'react';

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
  return (
    <div className="text-center text-white">
      <h2 className="text-2xl mb-4">总结报告组件 (开发中)</h2>
      <div className="bg-white/10 p-4 rounded-lg mb-4 max-w-2xl mx-auto">
        <p>{summary || '暂无总结内容'}</p>
      </div>
      <div className="mt-4 space-x-4">
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
