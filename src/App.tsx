// React is automatically imported in JSX
import { useMachine } from '@xstate/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ApiKeyProvider } from './contexts/ApiKeyContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { reconcileMachine } from './machines/reconcileMachine';
import './utils/i18n';

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

  const sendEvent = (eventType: string) => send({ type: eventType });

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
          <ErrorMessage message={context.error} />
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
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
            className="w-full h-full bg-gradient-to-r from-finance-blue/20 via-finance-purple/20 to-finance-pink/20"
          />
        </div>
      </div>

      <div className="relative z-10">
        <Header />

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <StepIndicator currentStep={context.currentStep} />

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

export default App;
