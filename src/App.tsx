import React from 'react';
import { useMachine } from '@xstate/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ApiKeyProvider, useApiKey } from './contexts/ApiKeyContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { reconcileMachine } from './machines/reconcileMachine';
import './utils/i18n';
import type { ReconcileState } from './types';

// 导入组件（将在后续步骤中创建）
import { Header } from './components/Header';
import { StepIndicator } from './components/StepIndicator';
import { FileUpload } from './components/FileUpload';
import { DataDisplay } from './components/DataDisplay';
import { ClassificationBoard } from './components/ClassificationBoard';
import { AmountComparison } from './components/AmountComparison';
import { SummaryReport } from './components/SummaryReport';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorMessage } from './components/ErrorMessage';

function AppContent() {
  const [state, send] = useMachine(reconcileMachine);
  const { context } = state;
  // 暴露当前 state 和 send 以便在控制台调试和确保发送到正确的实例
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      // 将当前 state/send 挂到 window 上，供控制台和调试命令使用
      (window as any).__reconcileState = state;
      (window as any).__reconcileSend = send;
      // 兼容别名，方便手动调用
      (window as any).reconcileSend = (window as any).__reconcileSend;
      // 让 debugStateMachine.getCurrentState 返回当前 state 引用
      (window as any).debugStateMachine.getCurrentState = () => (window as any).__reconcileState;
    }
    // 每当 state 或 send 变化时更新全局引用
  }, [state, send]);

  // 检查状态机状态
  React.useEffect(() => {
    console.log('🎭 状态机状态检查:', {
      currentState: state.value,
      isStopped: state.status === 'stopped',
      isDone: (state as any).done,
      hasError: state.error,
      canAcceptEvents: (state as any).canAccept,
      timestamp: new Date().toISOString()
    });

    // 如果状态机停止但不在最终状态，重置状态机
    if ((state as any).status === 'stopped' && !(state as any).done) {
      console.warn('⚠️ 状态机意外停止，执行重置...');
      sendEvent('RESTART');
    }
  }, [state.value, state.status]);
  const { apiKey: contextApiKey } = useApiKey();
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  // 从 localStorage 或 context 获取要发送的 API Key，优先使用 localStorage（避免闭包/时序导致的空值）
  const getApiKeyToSend = () => {
    try {
      const fromStorage = typeof window !== 'undefined' ? localStorage.getItem('deepseek-api-key') : null;
      return fromStorage || contextApiKey || '';
    } catch {
      return contextApiKey || '';
    }
  };

  const sendSetApiKey = (overrideKey?: string) => {
    const keyToSend = overrideKey ?? getApiKeyToSend();
    if (!keyToSend) {
      console.warn('⚠️ 未找到 API Key，取消发送');
      return;
    }
    const sender = (window as any).__reconcileSend ?? send;
    try {
      sender({ type: 'SET_API_KEY', apiKey: keyToSend });
      console.log('🔄 已发送 SET_API_KEY 事件（使用运行时读取的密钥）');
    } catch (err) {
      console.error('❌ 发送 SET_API_KEY 失败:', err);
    }
  };

  // 显示API Key状态对比
  React.useEffect(() => {
    console.log('🔍 API Key状态对比:', {
      contextApiKey: contextApiKey ? `${contextApiKey.length}字符` : '无',
      stateContextApiKey: context.apiKey ? `${context.apiKey.length}字符` : '无',
      areEqual: context.apiKey === contextApiKey,
      timestamp: new Date().toISOString()
    });
  }, [contextApiKey, context.apiKey]);

  // 状态变化监听器
  React.useEffect(() => {
    console.log('🔄 状态机状态更新:', {
      currentState: state.value,
      context: {
        hasStandardFile: !!context.standardFile,
        hasCheckFile: !!context.checkFile,
        hasApiKey: !!context.apiKey,
        apiKeyLength: context.apiKey?.length || 0,
        hasError: !!context.error,
        isLoading: context.isLoading,
        currentStep: context.currentStep,
      },
      timestamp: new Date().toISOString()
    });

    // 强制重新渲染以确保调试面板更新
    forceUpdate();
  }, [state.value, context.isLoading, context.error, context.currentStep, context.standardFile, context.checkFile, context.apiKey]);

  // 监听状态变化
  React.useEffect(() => {
    // XState v5 使用不同的API监听状态变化
    console.log('📡 状态变化监听已设置');
  }, [state]);

  // 专门监听context变化
  React.useEffect(() => {
    console.log('📊 状态机context变化:', {
      standardFile: context.standardFile ? {
        name: (context.standardFile as any).name,
        size: (context.standardFile as any).size
      } : null,
      checkFile: context.checkFile ? {
        name: (context.checkFile as any).name,
        size: (context.checkFile as any).size
      } : null,
      apiKey: context.apiKey ? `${context.apiKey.length}字符` : '无',
      timestamp: new Date().toISOString()
    });
  }, [context.standardFile, context.checkFile, context.apiKey]);

  // 同步API Key到状态机（去掉门禁：只要不同就发送）
  React.useEffect(() => {
    if (contextApiKey && context.apiKey !== contextApiKey) {
      console.log('🔄 同步API Key到状态机（无门禁）:', {
        contextApiKeyLength: contextApiKey.length,
        contextCurrentApiKeyLength: context.apiKey?.length || 0,
        status: (state as any).status,
        timestamp: new Date().toISOString()
      });
      sendSetApiKey();
    }
  }, [contextApiKey, context.apiKey, state]);

  // 监听自定义测试事件
  React.useEffect(() => {
    const handleTestEvent = (event: CustomEvent) => {
      console.log('🧪 收到测试事件:', event.detail);
      sendEvent('NEXT');
    };

    const handleSyncApiKey = () => {
      console.log('🔄 收到API Key同步事件');
      sendSetApiKey();
    };

    window.addEventListener('test-state-machine', handleTestEvent as EventListener);
    window.addEventListener('sync-api-key', handleSyncApiKey);

    return () => {
      window.removeEventListener('test-state-machine', handleTestEvent as EventListener);
      window.removeEventListener('sync-api-key', handleSyncApiKey);
    };
  }, [contextApiKey, context.apiKey]);

  const sendEvent = (eventType: string) => {
    console.log(`🎯 发送事件: ${eventType}`, {
      fromState: state.value,
      context: {
        hasStandardFile: !!context.standardFile,
        hasCheckFile: !!context.checkFile,
        hasApiKey: !!context.apiKey,
        apiKeyLength: context.apiKey?.length || 0,
        isLoading: context.isLoading,
        hasError: !!context.error,
      },
      timestamp: new Date().toISOString()
    });

    console.log(`🔄 调用状态机send函数...`);
    try {
      send({ type: eventType });
      console.log(`✅ 状态机事件发送完成: ${eventType}`);
    } catch (error) {
      console.error(`❌ 状态机事件发送失败: ${eventType}`, {
        error: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
    }
  };

  const renderCurrentStep = () => {

    // 加载状态
    if (context.isLoading) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center justify-center min-h-[400px]"
        >
          <LoadingSpinner />
        </motion.div>
      );
    }

    // 错误状态
    if (context.error) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="max-w-md mx-auto"
        >
          <ErrorMessage
            message={context.error}
            onRetry={() => {
              console.log('用户点击重试按钮:', {
                error: context.error,
                timestamp: new Date().toISOString()
              });
              sendEvent('RESTART');
            }}
            showRetry={true}
          />
        </motion.div>
      );
    }

    // 根据当前状态渲染对应组件
    switch (state.value) {
      case 'upload':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <FileUpload
              onStandardFileSelect={(file) => send({ type: 'SET_STANDARD_FILE', file })}
              onCheckFileSelect={(file) => send({ type: 'SET_CHECK_FILE', file })}
              onNext={() => sendEvent('NEXT')}
              standardFile={context.standardFile}
              checkFile={context.checkFile}
            />
          </motion.div>
        );

      case 'display':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
          >
            <DataDisplay
              data={context.parsedData}
              onNext={() => sendEvent('NEXT')}
              onBack={() => sendEvent('BACK')}
            />
          </motion.div>
        );

      case 'manualConfirm':
        return (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.5 }}
          >
            <ClassificationBoard
              categories={context.categories}
              onEntryMove={(entryId, fromCategory, toCategory) =>
                send({ type: 'MOVE_ENTRY', entryId, fromCategory, toCategory })
              }
              onNext={() => sendEvent('NEXT')}
              onSkip={() => sendEvent('SKIP_CONFIRM')}
              onBack={() => sendEvent('BACK')}
            />
          </motion.div>
        );

      case 'compare':
        return (
          <motion.div
            initial={{ opacity: 0, rotateY: 90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: -90 }}
            transition={{ duration: 0.6 }}
          >
            <AmountComparison
              data={context.categories}
              onNext={() => sendEvent('NEXT')}
              onBack={() => sendEvent('BACK')}
            />
          </motion.div>
        );

      case 'summarize':
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <SummaryReport
              summary={context.summary}
              onRestart={() => sendEvent('RESTART')}
              onBack={() => sendEvent('BACK')}
            />
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-deep via-surface-deep to-bg-deep">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-10 opacity-20">
          <motion.div
            animate={{
              backgroundPosition: ['0% 0%', '100% 100%'],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              repeatType: 'reverse',
            }}
            className="w-full h-full bg-gradient-to-r from-gold/8 via-gold/5 to-transparent"
          />
        </div>
      </div>

      <div className="relative z-10">
        <Header />

        {/* 调试面板已移除：页面不再展示调试信息 */}

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <StepIndicator currentStep={context.currentStep as ReconcileState} />

            <div className="mt-8">
              <AnimatePresence mode="wait">
                {renderCurrentStep()}
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <ApiKeyProvider>
        <AppContent />
      </ApiKeyProvider>
    </LanguageProvider>
  );
}

// 声明全局调试函数类型
declare global {
  interface Window {
    testStateMachine: () => void;
    syncApiKey: () => void;
    debugStateMachine: {
      sendEvent: (eventType: string) => void;
      getCurrentState: () => void;
      forceNext: () => void;
      forceSyncApiKey: () => void;
    };
  }
}

  // 已移除全局页面级调试函数，避免在生产或演示环境暴露调试入口

export default App;
