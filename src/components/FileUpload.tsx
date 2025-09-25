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
  const [standardStatus, setStandardStatus] = useState<FileStatus>({
    file: standardFile,
    isValid: standardFile ? ExcelParser.validateFile(standardFile).valid : false
  });
  const [checkStatus, setCheckStatus] = useState<FileStatus>({
    file: checkFile,
    isValid: checkFile ? ExcelParser.validateFile(checkFile).valid : false
  });

  // 调试日志 - 组件props
  console.log('📦 FileUpload 组件props:', {
    standardFile: standardFile ? {
      name: standardFile.name,
      size: standardFile.size,
      type: standardFile.type
    } : null,
    checkFile: checkFile ? {
      name: checkFile.name,
      size: checkFile.size,
      type: checkFile.type
    } : null,
    onStandardFileSelect: typeof onStandardFileSelect,
    onCheckFileSelect: typeof onCheckFileSelect,
    onNext: typeof onNext,
    timestamp: new Date().toISOString()
  });

  const validateAndSetFile = useCallback((
    file: File,
    setter: (file: File) => void,
    statusSetter: (status: FileStatus) => void
  ) => {
    console.log('🔍 文件验证开始:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      timestamp: new Date().toISOString()
    });

    const validation = ExcelParser.validateFile(file);
    const status: FileStatus = {
      file,
      isValid: validation.valid,
      error: validation.error,
    };

    console.log('📋 文件验证结果:', {
      isValid: validation.valid,
      error: validation.error,
      timestamp: new Date().toISOString()
    });

    statusSetter(status);
    if (validation.valid) {
      console.log('✅ 文件验证通过，设置文件...');
      setter(file);
    } else {
      console.log('❌ 文件验证失败:', validation.error);
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

      {/* 调试信息区已移除（仅在开发或诊断脚本中保留） */}

      {/* 下一步按钮 */}
      <motion.div
        className="text-center pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: canProceed ? 1 : 0.5 }}
      >
        <motion.button
          onClick={() => {
            console.log('🎯 下一步按钮被点击！', {
              timestamp: new Date().toISOString(),
              canProceed,
              standardStatus: {
                isValid: standardStatus.isValid,
                fileName: standardStatus.file?.name,
                fileSize: standardStatus.file?.size,
              },
              checkStatus: {
                isValid: checkStatus.isValid,
                fileName: checkStatus.file?.name,
                fileSize: checkStatus.file?.size,
              },
            });

            // 点击反馈保留为控制台日志，移除页面弹窗以改善用户体验
            console.log('✅ 下一步按钮点击（已触发 onNext）');

            if (!canProceed) {
              console.error('❌ 无法进入下一步：', {
                reason: !standardStatus.isValid && !checkStatus.isValid
                  ? '两个文件都无效'
                  : !standardStatus.isValid
                    ? '标准表文件无效'
                    : '待核对表文件无效',
                standardError: standardStatus.error,
                checkError: checkStatus.error,
                canProceed,
                standardIsValid: standardStatus.isValid,
                checkIsValid: checkStatus.isValid,
              });
              // 将错误反馈改为控制台输出并通过可视化提示处理（UI 层已显示错误）
              console.error('无法进入下一步：', standardStatus.error || checkStatus.error || '请检查文件格式');
              return;
              return;
            }

            console.log('🔄 开始触发NEXT事件...', {
              timestamp: new Date().toISOString(),
              buttonElement: 'FileUpload onNext button',
              currentState: 'About to call onNext prop'
            });
            console.log('🔄 调用onNext函数...');

            try {
              onNext();
              console.log('✅ onNext函数调用完成');
            } catch (error) {
              console.error('❌ onNext函数调用失败:', {
                error: error instanceof Error ? error.message : '未知错误',
                stack: error instanceof Error ? error.stack : undefined,
                timestamp: new Date().toISOString()
              });
            }
          }}
          disabled={!canProceed}
          whileTap={{ scale: 0.95 }}
          whileHover={canProceed ? { scale: 1.05 } : {}}
          className={`px-8 py-3 rounded-xl font-semibold transition-all duration-300 ${
            canProceed
              ? 'finance-gradient hover:shadow-lg hover:shadow-finance-blue/25 transform'
              : 'bg-gray-600 cursor-not-allowed'
          } text-white`}
        >
          {t('common.next')}
        </motion.button>

        {!canProceed && (
          <p className="text-gray-400 text-sm mt-2">
            请先选择有效的Excel文件
          </p>
        )}

        {/* 调试按钮已移除：避免在页面中展示调试操作 */}
      </motion.div>
    </motion.div>
  );
};
