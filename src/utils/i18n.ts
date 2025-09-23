import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

// 中文翻译
const zhCN = {
  common: {
    upload: '上传',
    cancel: '取消',
    confirm: '确认',
    next: '下一步',
    previous: '上一步',
    loading: '加载中...',
    error: '错误',
    success: '成功',
    retry: '重试',
    skip: '跳过',
    restart: '重新开始',
  },
  upload: {
    title: '上传财务文件',
    description: '请上传标准表和待核对表文件，开始智能核对流程',
    standardFile: '标准表文件',
    checkFile: '待核对表文件',
    dragDrop: '拖拽文件到此处或点击选择',
    selectFile: '选择文件',
    fileSelected: '已选择文件',
    invalidFormat: '不支持的文件格式，请上传 Excel 文件',
    fileTooLarge: '文件过大，请选择小于10MB的文件',
  },
  parse: {
    title: '解析文件',
    processing: '正在解析文件内容...',
    success: '文件解析完成',
    error: '文件解析失败',
  },
  display: {
    title: '数据预览',
    standardTitle: '标准表数据',
    checkTitle: '待核对表数据',
    totalEntries: '总条目数',
    proceed: '开始AI分类',
  },
  classify: {
    title: 'AI智能分类',
    processing: 'AI正在分析和分类条目...',
    success: '分类完成',
    error: '分类失败',
  },
  confirm: {
    title: '人工确认分类',
    description: '拖拽条目到正确的类别，或直接跳过此步骤',
    dragHint: '拖拽条目重新分类',
    skipConfirm: '跳过确认',
    proceed: '确认并继续',
  },
  calculate: {
    title: '金额计算',
    processing: '正在计算各分类金额...',
    success: '计算完成',
  },
  compare: {
    title: '差异对比',
    match: '金额一致',
    mismatch: '金额差异',
    missing: '数据缺失',
    viewDetails: '查看详情',
  },
  summary: {
    title: '核对总结',
    generating: '正在生成总结报告...',
    restart: '开始新的核对',
  },
  api: {
    title: 'API设置',
    keyRequired: '请输入您的DeepSeek API密钥',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    keyStored: '密钥已存储在本地',
    keyInvalid: 'API密钥无效',
  },
  errors: {
    networkError: '网络连接失败',
    apiError: 'API调用失败',
    parseError: '文件解析错误',
    validationError: '数据验证失败',
    unknownError: '未知错误，请重试',
  },
};

// 英文翻译
const enUS = {
  common: {
    upload: 'Upload',
    cancel: 'Cancel',
    confirm: 'Confirm',
    next: 'Next',
    previous: 'Previous',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    retry: 'Retry',
    skip: 'Skip',
    restart: 'Restart',
  },
  upload: {
    title: 'Upload Financial Files',
    description: 'Upload standard and check files to start intelligent reconciliation',
    standardFile: 'Standard File',
    checkFile: 'Check File',
    dragDrop: 'Drag and drop files here or click to select',
    selectFile: 'Select File',
    fileSelected: 'File Selected',
    invalidFormat: 'Unsupported file format, please upload Excel files',
    fileTooLarge: 'File too large, please select files smaller than 10MB',
  },
  parse: {
    title: 'Parse Files',
    processing: 'Parsing file contents...',
    success: 'File parsing completed',
    error: 'File parsing failed',
  },
  display: {
    title: 'Data Preview',
    standardTitle: 'Standard Data',
    checkTitle: 'Check Data',
    totalEntries: 'Total Entries',
    proceed: 'Start AI Classification',
  },
  classify: {
    title: 'AI Classification',
    processing: 'AI is analyzing and classifying entries...',
    success: 'Classification completed',
    error: 'Classification failed',
  },
  confirm: {
    title: 'Manual Classification Confirmation',
    description: 'Drag entries to correct categories or skip this step',
    dragHint: 'Drag entries to reclassify',
    skipConfirm: 'Skip Confirmation',
    proceed: 'Confirm and Continue',
  },
  calculate: {
    title: 'Amount Calculation',
    processing: 'Calculating amounts for each category...',
    success: 'Calculation completed',
  },
  compare: {
    title: 'Difference Comparison',
    match: 'Amount matches',
    mismatch: 'Amount difference',
    missing: 'Data missing',
    viewDetails: 'View Details',
  },
  summary: {
    title: 'Reconciliation Summary',
    generating: 'Generating summary report...',
    restart: 'Start New Reconciliation',
  },
  api: {
    title: 'API Settings',
    keyRequired: 'Please enter your DeepSeek API key',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    keyStored: 'Key stored locally',
    keyInvalid: 'Invalid API key',
  },
  errors: {
    networkError: 'Network connection failed',
    apiError: 'API call failed',
    parseError: 'File parsing error',
    validationError: 'Data validation failed',
    unknownError: 'Unknown error, please try again',
  },
};

i18next
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS },
    },
    lng: localStorage.getItem('language') || 'zh-CN',
    fallbackLng: 'zh-CN',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18next;
