import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, Database, CheckCircle } from 'lucide-react';
import { EntryCard } from './EntryCard';
import type { ParsedData } from '../types';

interface DataDisplayProps {
  data: ParsedData | null;
  onNext: () => void;
  onBack: () => void;
}

export const DataDisplay: React.FC<DataDisplayProps> = ({
  data,
  onNext,
  onBack,
}) => {
  const { t } = useTranslation();

  if (!data) {
    return (
      <div className="text-center text-white">
        <p>暂无数据</p>
      </div>
    );
  }

  const standardEntries = data.standard || [];
  const checkEntries = data.check || [];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const columnVariants = {
    hidden: { opacity: 0, x: -50 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 15,
      },
    },
  };

  return (
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
          {t('display.title')}
        </motion.h1>
        <p className="text-gray-300">{t('display.proceed')}</p>
      </div>

      {/* 数据概览卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="glass-effect p-4 rounded-xl text-center">
          <Database className="w-8 h-8 text-gold mx-auto mb-2" />
          <div className="text-2xl font-bold text-white">{standardEntries.length}</div>
          <div className="text-sm text-gray-300">{t('display.standardTitle')}</div>
        </div>

        <div className="glass-effect p-4 rounded-xl text-center">
          <Database className="w-8 h-8 text-gold mx-auto mb-2" />
          <div className="text-2xl font-bold text-white">{checkEntries.length}</div>
          <div className="text-sm text-gray-300">{t('display.checkTitle')}</div>
        </div>

        <div className="glass-effect p-4 rounded-xl text-center">
          <CheckCircle className="w-8 h-8 text-gold mx-auto mb-2" />
          <div className="text-2xl font-bold text-white">
            {standardEntries.length + checkEntries.length}
          </div>
          <div className="text-sm text-gray-300">{t('display.totalEntries')}</div>
        </div>
      </motion.div>

      {/* 数据展示区域 */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-2 gap-8"
      >
        {/* 标准表列 */}
        <motion.div variants={columnVariants} className="space-y-4">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-4 h-4 bg-blue-400 rounded-full"></div>
            <h2 className="text-xl font-semibold text-white">
              {t('display.standardTitle')}
            </h2>
            <span className="text-sm text-gray-400">
              ({standardEntries.length} 条)
            </span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-blue-400 scrollbar-track-transparent">
            {standardEntries.length > 0 ? (
              standardEntries.map((entry, index) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  index={index}
                  animate={true}
                />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8 text-gray-400"
              >
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>暂无标准表数据</p>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* 核对表列 */}
        <motion.div variants={columnVariants} className="space-y-4">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-4 h-4 bg-green-400 rounded-full"></div>
            <h2 className="text-xl font-semibold text-white">
              {t('display.checkTitle')}
            </h2>
            <span className="text-sm text-gray-400">
              ({checkEntries.length} 条)
            </span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-green-400 scrollbar-track-transparent">
            {checkEntries.length > 0 ? (
              checkEntries.map((entry, index) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  index={index}
                  animate={true}
                />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8 text-gray-400"
              >
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>暂无核对表数据</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>

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
          onClick={onNext}
          className="flex items-center space-x-2 px-8 py-3 finance-gradient hover:shadow-lg hover:shadow-finance-blue/25 rounded-xl font-semibold text-white transition-all"
        >
          <span>{t('display.proceed')}</span>
          <ArrowRight className="w-5 h-5" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
};
