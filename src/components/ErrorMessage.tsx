import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  showRetry?: boolean;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  onRetry,
  showRetry = true
}) => {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-red-900/20 backdrop-blur-md border border-red-500/30 rounded-xl p-6 max-w-md w-full"
    >
      <div className="flex items-start space-x-3">
        <motion.div
          animate={{
            rotate: [0, -10, 10, -10, 0],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatDelay: 3,
          }}
        >
          <AlertTriangle className="w-6 h-6 text-gold flex-shrink-0 mt-0.5" />
        </motion.div>

        <div className="flex-1">
          <h3 className="text-gold font-semibold mb-2">
            {t('common.error')}
          </h3>
          <p className="text-gold-dark text-sm leading-relaxed">
            {message}
          </p>

          {showRetry && onRetry && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onRetry}
            className="mt-4 flex items-center space-x-2 px-4 py-2 bg-white/6 hover:bg-white/8 border border-white/6 rounded-lg text-gold transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{t('common.retry')}</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-2 right-2 w-20 h-20 opacity-10">
        <motion.div
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="w-full h-full border-2 border-red-400 rounded-full"
        />
      </div>
    </motion.div>
  );
};
