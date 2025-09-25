import React, { createContext, useContext, useState, useEffect } from 'react';

interface ApiKeyContextType {
  apiKey: string;
  setApiKey: (key: string) => void;
  isValid: boolean;
}

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

export const useApiKey = () => {
  const context = useContext(ApiKeyContext);
  if (context === undefined) {
    throw new Error('useApiKey must be used within an ApiKeyProvider');
  }
  return context;
};

interface ApiKeyProviderProps {
  children: React.ReactNode;
}

export const ApiKeyProvider: React.FC<ApiKeyProviderProps> = ({ children }) => {
  const [apiKey, setApiKeyState] = useState('');
  const [isValid, setIsValid] = useState(false);

  // 从localStorage加载API Key
  useEffect(() => {
    const storedKey = localStorage.getItem('deepseek-api-key');
    if (storedKey) {
      setApiKeyState(storedKey);
      validateApiKey(storedKey);
    }
  }, []);

  const validateApiKey = (key: string) => {
    // DeepSeek API Key格式验证：以sk-开头，长度在30-200字符之间
    const isValidFormat = key.startsWith('sk-') && key.length >= 30 && key.length <= 200;
    // 已移除开发调试日志，避免在生产环境泄露敏感信息
    setIsValid(isValidFormat);
    return isValidFormat;
  };

  const setApiKey = (key: string) => {
    console.log('🔑 API Key 设置:', {
      keyLength: key.length,
      hasValue: !!key,
      startsWithSk: key.startsWith('sk-'),
      timestamp: new Date().toISOString()
    });

    setApiKeyState(key);
    validateApiKey(key);
    if (key) {
      localStorage.setItem('deepseek-api-key', key);
      console.log('💾 API Key 已保存到 localStorage');
    } else {
      localStorage.removeItem('deepseek-api-key');
      console.log('🗑️ API Key 已从 localStorage 移除');
    }
  };

  const value = {
    apiKey,
    setApiKey,
    isValid,
  };

  return (
    <ApiKeyContext.Provider value={value}>
      {children}
    </ApiKeyContext.Provider>
  );
};
