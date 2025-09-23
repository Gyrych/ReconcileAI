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

      {/* 调试信息 */}
      <motion.div
        className="mt-6 p-4 bg-gray-900/50 border border-gray-600 rounded-lg"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
      >
        <h4 className="text-white font-medium mb-2">调试信息：</h4>
        <div className="space-y-1 text-sm text-gray-300">
          <div>标准表文件：{standardStatus.file ? standardStatus.file.name : '未选择'} {standardStatus.isValid ? '✅' : '❌'}</div>
          <div>待核对表文件：{checkStatus.file ? checkStatus.file.name : '未选择'} {checkStatus.isValid ? '✅' : '❌'}</div>
          <div>可以进入下一步：{canProceed ? '✅ 是' : '❌ 否'}</div>
          {standardStatus.error && <div className="text-red-400">标准表错误：{standardStatus.error}</div>}
          {checkStatus.error && <div className="text-red-400">待核对表错误：{checkStatus.error}</div>}
        </div>
      </motion.div>

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

            // 显示点击反馈
            alert('✅ 按钮点击成功！请查看控制台日志。');

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
              alert(`无法进入下一步：${standardStatus.error || checkStatus.error || '请检查文件格式'}`);
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

        {/* 调试按钮 */}
        <div className="mt-4 flex justify-center space-x-2">
          <button
            onClick={() => {
              console.log('🧪 测试状态机事件发送');
              // 直接调用父组件的状态机事件
              if (typeof window !== 'undefined' && (window as any).testStateMachine) {
                (window as any).testStateMachine();
              }
            }}
            className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-300 hover:text-blue-200 transition-colors text-sm"
          >
            🧪 测试状态机
          </button>
          <button
            onClick={() => {
              console.log('🔄 强制刷新调试面板');
              // 强制重新渲染
              window.location.reload();
            }}
            className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg text-green-300 hover:text-green-200 transition-colors text-sm"
          >
            🔄 强制刷新
          </button>
          <button
            onClick={() => {
              console.log('🩺 诊断当前状态');
              console.log('📦 当前组件状态:', {
                standardStatus: {
                  file: standardStatus.file?.name,
                  isValid: standardStatus.isValid,
                  error: standardStatus.error
                },
                checkStatus: {
                  file: checkStatus.file?.name,
                  isValid: checkStatus.isValid,
                  error: checkStatus.error
                },
                canProceed,
                standardFile,
                checkFile
              });
              alert('请查看控制台的诊断信息');
            }}
            className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-purple-300 hover:text-purple-200 transition-colors text-sm"
          >
            🩺 诊断状态
          </button>
          <button
            onClick={() => {
              console.log('🔄 强制同步API Key');
              // 强制触发API Key同步
              if (typeof window !== 'undefined' && window.syncApiKey) {
                window.syncApiKey();
              }
              alert('API Key同步已触发，请查看控制台');
            }}
            className="px-4 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/30 rounded-lg text-yellow-300 hover:text-yellow-200 transition-colors text-sm"
          >
            🔄 同步API
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
