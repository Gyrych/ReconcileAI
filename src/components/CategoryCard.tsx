import React from 'react';
import { motion } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { CheckCircle, AlertTriangle, XCircle, DollarSign, Users } from 'lucide-react';
import { EntryCard } from './EntryCard';
import type { CategoryData } from '../types';

interface CategoryCardProps {
  categoryName: string;
  categoryData: CategoryData[string];
  onEntryClick?: (entryId: string) => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  categoryName,
  categoryData,
  onEntryClick,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: categoryName,
  });

  const getStatusIcon = () => {
    switch (categoryData.status) {
      case 'match':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'mismatch':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'missing':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <XCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (categoryData.status) {
      case 'match':
        return 'border-green-400/30 bg-green-400/5';
      case 'mismatch':
        return 'border-yellow-400/30 bg-yellow-400/5';
      case 'missing':
        return 'border-red-400/30 bg-red-400/5';
      default:
        return 'border-gray-400/30 bg-gray-400/5';
    }
  };

  const getStatusText = () => {
    switch (categoryData.status) {
      case 'match':
        return '金额一致';
      case 'mismatch':
        return '金额差异';
      case 'missing':
        return '数据缺失';
      default:
        return '未知状态';
    }
  };

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: 1,
        borderColor: isOver ? 'rgba(59, 130, 246, 0.5)' : undefined,
      }}
      transition={{ duration: 0.3 }}
      className={`
        relative rounded-xl border-2 p-6 transition-all duration-300
        ${getStatusColor()}
        ${isOver ? 'ring-2 ring-blue-400/50 ring-offset-2 ring-offset-slate-900' : ''}
      `}
    >
      {/* 拖拽覆盖层 */}
      {isOver && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-blue-400/10 rounded-xl flex items-center justify-center z-10"
        >
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
            }}
            className="text-blue-400 font-medium"
          >
            放置到此处
          </motion.div>
        </motion.div>
      )}

      <div className="relative z-0">
        {/* 类别头部 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-lg">
              {getStatusIcon()}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{categoryName}</h3>
              <p className="text-sm text-gray-400">{getStatusText()}</p>
            </div>
          </div>

          {/* 条目统计 */}
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1 text-blue-400">
              <Users className="w-4 h-4" />
              <span>{categoryData.standard.length}</span>
            </div>
            <div className="flex items-center space-x-1 text-green-400">
              <Users className="w-4 h-4" />
              <span>{categoryData.check.length}</span>
            </div>
          </div>
        </div>

        {/* 金额对比 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-500/10 rounded-lg p-3">
            <div className="text-xs text-blue-400 mb-1">标准表</div>
            <div className="text-lg font-bold text-blue-300">
              ¥{categoryData.totalStandard.toLocaleString('zh-CN')}
            </div>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3">
            <div className="text-xs text-green-400 mb-1">待核对表</div>
            <div className="text-lg font-bold text-green-300">
              ¥{categoryData.totalCheck.toLocaleString('zh-CN')}
            </div>
          </div>
        </div>

        {/* 差异显示 */}
        {categoryData.difference > 0.01 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
          >
            <div className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-yellow-300">
                差异: ¥{categoryData.difference.toLocaleString('zh-CN')}
              </span>
            </div>
          </motion.div>
        )}

        {/* 条目列表 */}
        <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {/* 标准表条目 */}
          {categoryData.standard.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-400 flex items-center">
                <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                标准表条目
              </h4>
              {categoryData.standard.map((entry, index) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  index={index}
                  onClick={() => onEntryClick?.(entry.id)}
                  animate={false}
                  className="scale-95"
                />
              ))}
            </div>
          )}

          {/* 核对表条目 */}
          {categoryData.check.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-green-400 flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                待核对表条目
              </h4>
              {categoryData.check.map((entry, index) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  index={index}
                  onClick={() => onEntryClick?.(entry.id)}
                  animate={false}
                  className="scale-95"
                />
              ))}
            </div>
          )}

          {/* 空状态 */}
          {categoryData.standard.length === 0 && categoryData.check.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-gray-500"
            >
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无条目</p>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
