// 基础数据类型定义
export interface Entry {
  id: string;
  name: string;
  amount: number;
  source: 'standard' | 'check';
  category?: string;
  confidence?: number; // AI分类置信度 0-1
  originalIndex?: number; // 原始数据中的索引
  // 行级上下文文本：由该行所有非金额列拼接、去噪而成，用于AI分类时提供更多语义上下文
  contextText?: string;
  // 原始名称（解析前的名称列内容），在将contextText用作name时保留原始值
  originalName?: string;
}

export interface CategoryData {
  [categoryName: string]: {
    standard: Entry[];
    check: Entry[];
    totalStandard: number;
    totalCheck: number;
    difference: number;
    status: 'match' | 'mismatch' | 'missing';
  };
}

export interface ParsedData {
  standard: Entry[];
  check: Entry[];
  categories?: CategoryData;
}

// API相关类型
export interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface ClassificationResult {
  categories: CategoryData;
  summary: string;
}

// 状态机相关类型
export type ReconcileState =
  | 'upload'
  | 'parse'
  | 'display'
  | 'aiClassify'
  | 'manualConfirm'
  | 'calculate'
  | 'compare'
  | 'summarize';

export interface ReconcileContext {
  standardFile: File | null;
  checkFile: File | null;
  parsedData: ParsedData | null;
  categories: CategoryData | null;
  summary: string | null;
  apiKey: string;
  currentStep: ReconcileState;
  error: string | null;
  isLoading: boolean;
}

// 组件Props类型
export interface EntryCardProps {
  entry: Entry;
  index: number;
  onClick?: () => void;
  className?: string;
}

export interface CategoryBoardProps {
  categories: CategoryData;
  onEntryMove: (entryId: string, fromCategory: string, toCategory: string) => void;
}

export interface AmountChartProps {
  data: CategoryData;
  width?: number;
  height?: number;
}

// 动画相关类型
export interface AnimationConfig {
  duration: number;
  delay: number;
  easing: string;
}

export interface EntryAnimationProps {
  children: React.ReactNode;
  index: number;
  config?: Partial<AnimationConfig>;
}

// AI列选择相关类型
export interface ColumnSelection {
  nameColumnIndex: number;
  amountColumnIndex: number;
  confidence: number;
  reasoning: string;
}

// AI简化文件相关类型
export interface SimplifiedFileData {
  simplifiedData: any[][]; // 简化后的数据，只包含名称列和金额列
  originalMapping: {
    nameColumnIndex: number;
    amountColumnIndex: number;
    originalHeaders: string[];
  };
  confidence: number;
  reasoning: string;
  dataRowsCount: number;
}

// 国际化相关类型
export type Language = 'zh-CN' | 'en-US';

export interface TranslationKeys {
  common: {
    upload: string;
    cancel: string;
    confirm: string;
    next: string;
    previous: string;
    loading: string;
    error: string;
  };
  upload: {
    title: string;
    description: string;
    standardFile: string;
    checkFile: string;
    dragDrop: string;
    selectFile: string;
  };
  // 更多翻译键...
}
