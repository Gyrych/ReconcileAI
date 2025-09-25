import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Upload, FileText, Brain, CheckCircle, Calculator, BarChart3, FileCheck } from 'lucide-react';
import type { ReconcileState } from '../types';

interface StepIndicatorProps {
  currentStep: ReconcileState;
}

const steps = [
  { id: 'upload', labelKey: 'upload.title', icon: Upload },
  { id: 'parse', labelKey: 'parse.title', icon: FileText },
  { id: 'display', labelKey: 'display.title', icon: FileText },
  { id: 'aiClassify', labelKey: 'classify.title', icon: Brain },
  { id: 'manualConfirm', labelKey: 'confirm.title', icon: CheckCircle },
  { id: 'calculate', labelKey: 'calculate.title', icon: Calculator },
  { id: 'compare', labelKey: 'compare.title', icon: BarChart3 },
  { id: 'summarize', labelKey: 'summary.title', icon: FileCheck },
] as const;

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const { t } = useTranslation();

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = index < currentStepIndex;
          const isPending = index > currentStepIndex;

          return (
            <div key={step.id} className="flex flex-col items-center">
              {/* Step Circle */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className={`
                  relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
                  ${isActive ? 'bg-gold-gradient glow-gold shadow-lg' : ''}
                  ${isCompleted ? 'bg-gold/10 shadow-lg shadow-gold/10' : ''}
                  ${isPending ? 'bg-gray-600' : ''}
                `}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'text-white' : isCompleted ? 'text-gold' : 'text-gray-400'}`} />

                {/* Pulse animation for active step (金色边框脉冲) */}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-gold"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                    }}
                  />
                )}
              </motion.div>

              {/* Step Label */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 + 0.2 }}
                className="mt-2 text-center"
              >
                <p className={`text-xs font-medium ${
                  isActive ? 'text-gold' :
                  isCompleted ? 'text-gold-dark' :
                  'text-gray-400'
                }`}>
                  {t(step.labelKey)}
                </p>
              </motion.div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: index * 0.1 + 0.3 }}
                  className="absolute top-6 left-12 w-16 h-0.5 bg-gray-600 origin-left"
                  style={{
                    background: isCompleted ? 'linear-gradient(to right, #B8860B, #D4AF37)' :
                              isActive ? 'linear-gradient(to right, #D4AF37, #ECD39A)' :
                              '#4B5563'
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
