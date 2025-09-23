import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { useApiKey } from '../contexts/ApiKeyContext';
import { Languages, Key, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

export const Header: React.FC = () => {
  const { t } = useTranslation();
  const { language, toggleLanguage } = useLanguage();
  const { apiKey, setApiKey, isValid } = useApiKey();

  return (
    <header className="relative z-20 bg-black/20 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center space-x-3"
          >
            <div className="finance-gradient p-2 rounded-xl">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">财务核对AI</h1>
              <p className="text-sm text-gray-300">Financial Reconciliation Agent</p>
            </div>
          </motion.div>

          {/* Controls */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center space-x-4"
          >
            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Languages className="w-4 h-4 text-white" />
              <span className="text-white text-sm">
                {language === 'zh-CN' ? 'EN' : '中文'}
              </span>
            </button>

            {/* API Key Input */}
            <div className="flex items-center space-x-2">
              <Key className={`w-4 h-4 ${isValid ? 'text-green-400' : 'text-gray-400'}`} />
              <input
                type="password"
                placeholder={t('api.keyPlaceholder')}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-finance-blue/50 focus:border-transparent text-sm w-64"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </header>
  );
};
