import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ArrowRight, ArrowLeft, SkipForward, Brain, AlertTriangle } from 'lucide-react';
import { CategoryCard } from './CategoryCard';
import { EntryCard } from './EntryCard';
import type { CategoryData, Entry } from '../types';

interface ClassificationBoardProps {
  categories: CategoryData | null;
  onEntryMove: (entryId: string, fromCategory: string, toCategory: string) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export const ClassificationBoard: React.FC<ClassificationBoardProps> = ({
  categories,
  onEntryMove,
  onNext,
  onSkip,
  onBack,
}) => {
  const { t } = useTranslation();
  const [activeEntry, setActiveEntry] = useState<Entry | null>(null);
  const [draggedFromCategory, setDraggedFromCategory] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;

    // 找到被拖拽的条目
    if (categories) {
      for (const [categoryName, categoryData] of Object.entries(categories)) {
        const entry = [...categoryData.standard, ...categoryData.check]
          .find(e => e.id === active.id);

        if (entry) {
          setActiveEntry(entry);
          setDraggedFromCategory(categoryName);
          break;
        }
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveEntry(null);
    setDraggedFromCategory('');

    if (!over || !active.id || !over.id) return;

    // 检查是否是有效的拖拽操作
    if (active.id !== over.id && typeof over.id === 'string') {
      const entryId = active.id as string;
      const toCategory = over.id;

      if (toCategory !== draggedFromCategory) {
        onEntryMove(entryId, draggedFromCategory, toCategory);
      }
    }
  };

  if (!categories) {
    return (
      <div className="text-center text-white">
        <p>暂无分类数据</p>
      </div>
    );
  }

  const categoryNames = Object.keys(categories);
  const totalEntries = Object.values(categories).reduce(
    (sum, cat) => sum + cat.standard.length + cat.check.length,
    0
  );
  const mismatchCount = Object.values(categories).filter(
    cat => cat.status === 'mismatch'
  ).length;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto space-y-8"
      >
        {/* 标题区域 */}
        <div className="text-center">
          <motion.h1
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-bold text-white mb-2"
          >
            {t('confirm.title')}
          </motion.h1>
          <p className="text-gray-300">{t('confirm.description')}</p>
        </div>

        {/* 统计信息 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="glass-effect p-4 rounded-xl text-center">
            <Brain className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{categoryNames.length}</div>
            <div className="text-sm text-gray-300">分类数量</div>
          </div>

          <div className="glass-effect p-4 rounded-xl text-center">
            <div className="text-2xl font-bold text-white">{totalEntries}</div>
            <div className="text-sm text-gray-300">总条目数</div>
          </div>

          {mismatchCount > 0 && (
            <div className="glass-effect p-4 rounded-xl text-center border border-yellow-400/30">
              <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-yellow-400">{mismatchCount}</div>
              <div className="text-sm text-gray-300">存在差异</div>
            </div>
          )}
        </motion.div>

        {/* 拖拽提示 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-4"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            </div>
            <div>
              <h3 className="text-blue-300 font-medium">拖拽操作提示</h3>
              <p className="text-blue-200 text-sm">
                {t('confirm.dragHint')} - AI分类结果可能需要人工调整
              </p>
            </div>
          </div>
        </motion.div>

        {/* 分类卡片网格 */}
        <SortableContext items={categoryNames} strategy={verticalListSortingStrategy}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {categoryNames.map((categoryName, index) => (
              <motion.div
                key={categoryName}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 + 0.6 }}
              >
                <CategoryCard
                  categoryName={categoryName}
                  categoryData={categories[categoryName]}
                />
              </motion.div>
            ))}
          </motion.div>
        </SortableContext>

        {/* 导航按钮 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex justify-center space-x-6 pt-8"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="flex items-center space-x-2 px-6 py-3 bg-gray-600/50 hover:bg-gray-600/70 text-white rounded-xl font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('common.previous')}</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onSkip}
            className="flex items-center space-x-2 px-6 py-3 bg-yellow-600/50 hover:bg-yellow-600/70 text-white rounded-xl font-medium transition-colors"
          >
            <SkipForward className="w-5 h-5" />
            <span>{t('confirm.skipConfirm')}</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onNext}
            className="flex items-center space-x-2 px-8 py-3 finance-gradient hover:shadow-lg hover:shadow-finance-blue/25 rounded-xl font-semibold text-white transition-all"
          >
            <span>{t('confirm.proceed')}</span>
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </motion.div>

      {/* 拖拽覆盖层 */}
      <DragOverlay>
        {activeEntry ? (
          <div className="rotate-3 opacity-90">
            <EntryCard entry={activeEntry} index={0} animate={false} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
