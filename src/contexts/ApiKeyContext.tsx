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
    // 简单的API Key格式验证
    const isValidFormat = key.startsWith('sk-') && key.length > 20;
    setIsValid(isValidFormat);
    return isValidFormat;
  };

  const setApiKey = (key: string) => {
    setApiKeyState(key);
    validateApiKey(key);
    if (key) {
      localStorage.setItem('deepseek-api-key', key);
    } else {
      localStorage.removeItem('deepseek-api-key');
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
