import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { ExcelParser } from '../services/excelParser';

interface FileUploadProps {
  onStandardFileSelect: (file: File) => void;
  onCheckFileSelect: (file: File) => void;
  onNext: () => void;
  standardFile: File | null;
  checkFile: File | null;
}

interface FileStatus {
  file: File | null;
  isValid: boolean;
  error?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onStandardFileSelect,
  onCheckFileSelect,
  onNext,
  standardFile,
  checkFile,
}) => {
  const { t } = useTranslation();
  const [dragOver, setDragOver] = useState<'standard' | 'check' | null>(null);
  const [standardStatus, setStandardStatus] = useState<FileStatus>({ file: standardFile, isValid: false });
  const [checkStatus, setCheckStatus] = useState<FileStatus>({ file: checkFile, isValid: false });

  const validateAndSetFile = useCallback((
    file: File,
    setter: (file: File) => void,
    statusSetter: (status: FileStatus) => void
  ) => {
    const validation = ExcelParser.validateFile(file);
    const status: FileStatus = {
      file,
      isValid: validation.valid,
      error: validation.error,
    };

    statusSetter(status);
    if (validation.valid) {
      setter(file);
    }
  }, []);

  const handleFileSelect = useCallback((
    files: FileList | null,
    type: 'standard' | 'check'
  ) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (type === 'standard') {
      validateAndSetFile(file, onStandardFileSelect, setStandardStatus);
    } else {
      validateAndSetFile(file, onCheckFileSelect, setCheckStatus);
    }
  }, [validateAndSetFile, onStandardFileSelect, onCheckFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent, type: 'standard' | 'check') => {
    e.preventDefault();
    setDragOver(type);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, type: 'standard' | 'check') => {
    e.preventDefault();
    setDragOver(null);
    handleFileSelect(e.dataTransfer.files, type);
  }, [handleFileSelect]);

  const removeFile = useCallback((type: 'standard' | 'check') => {
    if (type === 'standard') {
      setStandardStatus({ file: null, isValid: false });
      onStandardFileSelect({} as File); // 清除文件
    } else {
      setCheckStatus({ file: null, isValid: false });
      onCheckFileSelect({} as File); // 清除文件
    }
  }, [onStandardFileSelect, onCheckFileSelect]);

  const canProceed = standardStatus.isValid && checkStatus.isValid;

  const FileDropZone: React.FC<{
    type: 'standard' | 'check';
    status: FileStatus;
    title: string;
    color: string;
  }> = ({ type, status, title, color }) => (
    <motion.div
      className={`relative p-6 border-2 border-dashed rounded-xl transition-all duration-300 ${
        dragOver === type
          ? `border-${color}-400 bg-${color}-400/10`
          : status.isValid
            ? 'border-green-400 bg-green-400/5'
            : `border-${color}-300/50 hover:border-${color}-400`
      }`}
      onDragOver={(e) => handleDragOver(e, type)}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDrop(e, type)}
    >
      <input
        type="file"
        accept=".xlsx,.xls,.xlsm,.csv"
        onChange={(e) => handleFileSelect(e.target.files, type)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />

      <div className="text-center">
        {status.file ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-center space-x-2">
              {status.isValid ? (
                <CheckCircle className="w-6 h-6 text-green-400" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-400" />
              )}
              <FileText className={`w-8 h-8 ${status.isValid ? 'text-green-400' : 'text-red-400'}`} />
            </div>

            <div>
              <p className="text-white font-medium truncate">{status.file.name}</p>
              <p className="text-gray-400 text-sm">
                {(status.file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>

            {status.error && (
              <p className="text-red-400 text-sm">{status.error}</p>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFile(type);
              }}
              className="absolute top-2 right-2 p-1 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors"
            >
              <X className="w-4 h-4 text-red-400" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <Upload className={`w-12 h-12 mx-auto text-${color}-400`} />
            <div>
              <p className="text-white font-medium">{title}</p>
              <p className="text-gray-400 text-sm mt-1">
                {t('upload.dragDrop')}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      {/* 标题 */}
      <div className="text-center">
        <motion.h1
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="text-3xl font-bold text-white mb-2"
        >
          {t('upload.title')}
        </motion.h1>
        <p className="text-gray-300">{t('upload.description')}</p>
      </div>

      {/* 文件上传区域 */}
      <div className="grid md:grid-cols-2 gap-6">
        <FileDropZone
          type="standard"
          status={standardStatus}
          title={t('upload.standardFile')}
          color="blue"
        />

        <FileDropZone
          type="check"
          status={checkStatus}
          title={t('upload.checkFile')}
          color="green"
        />
      </div>

      {/* 下一步按钮 */}
      <motion.div
        className="text-center pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: canProceed ? 1 : 0.5 }}
      >
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`px-8 py-3 rounded-xl font-semibold transition-all duration-300 ${
            canProceed
              ? 'finance-gradient hover:shadow-lg hover:shadow-finance-blue/25 transform hover:scale-105'
              : 'bg-gray-600 cursor-not-allowed'
          } text-white`}
        >
          {t('common.next')}
        </button>

        {!canProceed && (
          <p className="text-gray-400 text-sm mt-2">
            请先选择有效的Excel文件
          </p>
        )}
      </motion.div>
    </motion.div>
  );
};
