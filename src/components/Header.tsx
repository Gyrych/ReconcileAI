import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { useApiKey } from '../contexts/ApiKeyContext';
import { Languages, Key, FileText, TestTube } from 'lucide-react';
import { motion } from 'framer-motion';
import { DeepSeekService } from '../services/deepseekService';

export const Header: React.FC = () => {
  const { t } = useTranslation();
  const { language, toggleLanguage } = useLanguage();
  const { apiKey, setApiKey, isValid } = useApiKey();
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<string | null>(null);

  // 调试日志
  console.log('🔑 Header组件API Key状态:', {
    apiKeyLength: apiKey.length,
    isValid,
    hasValue: !!apiKey,
    timestamp: new Date().toISOString()
  });

  const testApiKey = async () => {
    if (!apiKey || !isValid) {
      setApiTestResult('API密钥格式无效');
      return;
    }

    setIsTestingApi(true);
    setApiTestResult(null);

    try {
      console.log('开始测试API密钥连接...');
      const isConnected = await DeepSeekService.testConnection(apiKey);
      console.log('API连接测试结果:', isConnected);

      if (isConnected) {
        setApiTestResult('✅ API连接成功');
      } else {
        setApiTestResult('❌ API连接失败，请检查密钥是否正确');
      }
    } catch (error) {
      console.error('API测试失败:', error);
      setApiTestResult('❌ API测试失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsTestingApi(false);
    }
  };

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
              <Key className={`w-4 h-4 ${isValid ? 'text-green-400' : 'text-yellow-400'}`} />
              <div className="relative">
                <input
                  type="password"
                  placeholder={t('api.keyPlaceholder')}
                  value={apiKey}
                  onChange={(e) => {
                    console.log('API密钥输入变更:', {
                      hasValue: !!e.target.value,
                      length: e.target.value.length,
                      timestamp: new Date().toISOString()
                    });
                    setApiKey(e.target.value);
                  }}
                  className={`px-3 py-2 bg-white/10 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-finance-blue/50 focus:border-transparent text-sm w-64 ${
                    isValid ? 'border-green-400/50' : 'border-yellow-400/50'
                  }`}
                />
                {!isValid && apiKey && (
                  <div className="absolute top-full left-0 mt-1 p-2 bg-yellow-900/90 backdrop-blur-md border border-yellow-500/30 rounded-lg text-xs text-yellow-200 min-w-max z-10">
                    API密钥格式无效，请检查密钥格式（应以sk-开头）
                  </div>
                )}
                {apiTestResult && (
                  <div className={`absolute top-full left-0 mt-1 p-2 backdrop-blur-md border rounded-lg text-xs min-w-max z-10 ${
                    apiTestResult.includes('✅')
                      ? 'bg-green-900/90 border-green-500/30 text-green-200'
                      : 'bg-red-900/90 border-red-500/30 text-red-200'
                  }`}>
                    {apiTestResult}
                  </div>
                )}
              </div>
              <button
                onClick={testApiKey}
                disabled={isTestingApi || !apiKey}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isTestingApi
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-blue-200 border border-blue-500/30'
                }`}
                title="测试API连接"
              >
                <TestTube className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </header>
  );
};
