import React from 'react';
import { motion } from 'framer-motion';
import { useDraggable } from '@dnd-kit/core';
import { DollarSign, FileText } from 'lucide-react';
import type { Entry } from '../types';

interface EntryCardProps {
  entry: Entry;
  index: number;
  onClick?: () => void;
  className?: string;
  animate?: boolean;
}

export const EntryCard: React.FC<EntryCardProps> = ({
  entry,
  index,
  onClick,
  className = '',
  animate = true,
}) => {
  const isStandard = entry.source === 'standard';

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: entry.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const cardVariants = {
    hidden: {
      opacity: 0,
      y: 50,
      scale: 0.8,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 12,
        delay: animate ? index * 0.1 : 0,
      },
    },
    hover: {
      scale: 1.05,
      y: -5,
      transition: {
        type: 'spring' as const,
        stiffness: 400,
        damping: 10,
      },
    },
    tap: {
      scale: 0.95,
    },
  };

  const iconVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: {
      scale: 1,
      rotate: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 200,
        damping: 10,
        delay: animate ? index * 0.1 + 0.2 : 0.2,
      },
    },
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      variants={cardVariants}
      initial="hidden"
      animate={isDragging ? 'tap' : 'visible'}
      whileHover={!isDragging ? 'hover' : undefined}
      whileTap={!isDragging ? 'tap' : undefined}
      onClick={!isDragging ? onClick : undefined}
      className={`
        entry-card cursor-pointer
        ${isDragging ? 'z-50 rotate-2 shadow-2xl' : ''}
        ${isStandard
          ? 'border-blue-400/30 hover:border-blue-400/50'
          : 'border-green-400/30 hover:border-green-400/50'
        }
        ${className}
      `}
      {...listeners}
      {...attributes}
    >
      {/* 背景渐变效果 */}
      <div className={`absolute inset-0 rounded-xl opacity-20 ${
        isStandard
          ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20'
          : 'bg-gradient-to-br from-green-500/20 to-emerald-500/20'
      }`} />

      <div className="relative z-10">
        {/* 头部：图标和类型标识 */}
        <div className="flex items-center justify-between mb-3">
          <motion.div
            variants={iconVariants}
            className={`p-2 rounded-lg ${
              isStandard
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-green-500/20 text-green-300'
            }`}
          >
            {isStandard ? (
              <FileText className="w-5 h-5" />
            ) : (
              <DollarSign className="w-5 h-5" />
            )}
          </motion.div>

          <motion.span
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: animate ? index * 0.1 + 0.3 : 0.3 }}
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              isStandard
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-green-500/20 text-green-300'
            }`}
          >
            {isStandard ? '标准' : '核对'}
          </motion.span>
        </div>

        {/* 条目名称 */}
        <motion.h3
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: animate ? index * 0.1 + 0.4 : 0.4 }}
          className="text-white font-semibold text-sm mb-2 line-clamp-2 leading-tight"
        >
          {entry.name}
        </motion.h3>

        {/* 金额显示 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: animate ? index * 0.1 + 0.5 : 0.5 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center space-x-1">
            <DollarSign className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 font-bold text-lg">
              {entry.amount.toLocaleString('zh-CN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          {/* 金额变化指示器 */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              delay: animate ? index * 0.1 + 0.6 : 0.6,
              type: 'spring',
              stiffness: 300,
            }}
            className={`w-2 h-2 rounded-full ${
              isStandard ? 'bg-blue-400' : 'bg-green-400'
            }`}
          />
        </motion.div>

        {/* 底部装饰线 */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{
            delay: animate ? index * 0.1 + 0.7 : 0.7,
            duration: 0.5,
          }}
          className={`h-0.5 mt-3 rounded-full ${
            isStandard
              ? 'bg-gradient-to-r from-blue-400 to-purple-400'
              : 'bg-gradient-to-r from-green-400 to-emerald-400'
          }`}
        />
      </div>

      {/* 悬停时的光晕效果 */}
      <motion.div
        className={`absolute inset-0 rounded-xl opacity-0 ${
          isStandard
            ? 'shadow-lg shadow-blue-500/20'
            : 'shadow-lg shadow-green-500/20'
        }`}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
};
