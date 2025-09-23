import { createMachine, assign } from 'xstate';
import type { ReconcileContext } from '../types';
import { ExcelParser } from '../services/excelParser';
import { DeepSeekService } from '../services/deepseekService';

export const reconcileMachine = createMachine({
  id: 'reconcile',
  initial: 'upload',
  context: {
    standardFile: null,
    checkFile: null,
    parsedData: null,
    categories: null,
    summary: null,
    apiKey: '',
    currentStep: 'upload' as const,
    error: null,
    isLoading: false,
  } as ReconcileContext,
  states: {
    upload: {
      on: {
        SET_STANDARD_FILE: {
          actions: assign({
            standardFile: (_, event: any) => event.file,
            error: null,
          }),
        },
        SET_CHECK_FILE: {
          actions: assign({
            checkFile: (_, event: any) => event.file,
            error: null,
          }),
        },
        SET_API_KEY: {
          actions: assign({
            apiKey: (_, event: any) => event.apiKey,
          }),
        },
        NEXT: {
          target: 'parse',
          guard: 'canProceedToParse',
        },
      },
    },
    parse: {
      entry: [
        assign({ isLoading: true, error: null, currentStep: 'parse' }),
      ],
      invoke: {
        src: 'parseFiles',
        onDone: {
          target: 'display',
          actions: assign({
            parsedData: (_, event: any) => event.data,
            isLoading: false,
          }),
        },
        onError: {
          actions: assign({
            error: (_, event: any) => event.data.message || '文件解析失败',
            isLoading: false,
          }),
        },
      },
      on: {
        BACK: 'upload',
      },
    },
    display: {
      entry: assign({ currentStep: 'display' }),
      on: {
        NEXT: 'aiClassify',
        BACK: 'upload',
      },
    },
    aiClassify: {
      entry: [
        assign({ isLoading: true, error: null, currentStep: 'aiClassify' }),
      ],
      invoke: {
        src: 'classifyEntries',
        onDone: {
          target: 'manualConfirm',
          actions: assign({
            categories: (_, event: any) => event.data.categories,
            summary: (_, event: any) => event.data.summary,
            isLoading: false,
          }),
        },
        onError: {
          actions: assign({
            error: (_, event: any) => event.data.message || 'AI分类失败',
            isLoading: false,
          }),
        },
      },
      on: {
        BACK: 'display',
      },
    },
    manualConfirm: {
      entry: assign({ currentStep: 'manualConfirm' }),
      on: {
        MOVE_ENTRY: {
          actions: 'moveEntry',
        },
        NEXT: 'calculate',
        SKIP_CONFIRM: 'calculate',
        BACK: 'aiClassify',
      },
    },
    calculate: {
      entry: [
        assign({ isLoading: true, currentStep: 'calculate' }),
      ],
      invoke: {
        src: 'calculateAmounts',
        onDone: {
          target: 'compare',
          actions: assign({
            categories: (_, event: any) => event.data,
            isLoading: false,
          }),
        },
      },
      on: {
        BACK: 'manualConfirm',
      },
    },
    compare: {
      entry: assign({ currentStep: 'compare' }),
      on: {
        NEXT: 'summarize',
        BACK: 'calculate',
      },
    },
    summarize: {
      entry: [
        assign({ isLoading: true, currentStep: 'summarize' }),
      ],
      invoke: {
        src: 'generateSummary',
        onDone: {
          actions: assign({
            summary: (_, event: any) => event.data,
            isLoading: false,
          }),
        },
        onError: {
          actions: assign({
            error: (_, event: any) => event.data.message || '总结生成失败',
            isLoading: false,
          }),
        },
      },
      on: {
        BACK: 'compare',
        RESTART: {
          target: 'upload',
          actions: assign({
            standardFile: null,
            checkFile: null,
            parsedData: null,
            categories: null,
            summary: null,
            error: null,
            isLoading: false,
          }),
        },
      },
    },
  },
}, {
  guards: {
    canProceedToParse: (context: any) => {
      return !!(context.standardFile && context.checkFile && context.apiKey);
    },
  },
  actions: {
    moveEntry: assign({
      categories: (context: any, event: any) => {
        if (!context.categories) return context.categories;

        const { entryId, fromCategory, toCategory } = event;
        const categories = { ...context.categories };

        // 从源类别移除条目
        if (categories[fromCategory]) {
          categories[fromCategory] = {
            ...categories[fromCategory],
            standard: categories[fromCategory].standard.filter((e: any) => e.id !== entryId),
            check: categories[fromCategory].check.filter((e: any) => e.id !== entryId),
          };
        }

        // 添加到目标类别
        if (!categories[toCategory]) {
          categories[toCategory] = {
            standard: [],
            check: [],
            totalStandard: 0,
            totalCheck: 0,
            difference: 0,
            status: 'missing',
          };
        }

        // 找到要移动的条目
        const entry = [
          ...categories[fromCategory].standard,
          ...categories[fromCategory].check,
        ].find((e: any) => e.id === entryId);

        if (entry) {
          if (entry.source === 'standard') {
            categories[toCategory].standard.push(entry);
          } else {
            categories[toCategory].check.push(entry);
          }
        }

        return categories;
      },
    }),
  },
  services: {
    parseFiles: async (context: any) => {
      if (!context.standardFile || !context.checkFile) {
        throw new Error('文件未选择');
      }
      return await ExcelParser.parseFiles(context.standardFile, context.checkFile);
    },
    classifyEntries: async (context: any) => {
      if (!context.parsedData || !context.apiKey) {
        throw new Error('数据或API密钥缺失');
      }
      return await DeepSeekService.classifyEntries(
        context.parsedData.standard,
        context.parsedData.check,
        context.apiKey
      );
    },
    calculateAmounts: (context: any) => {
      if (!context.categories) {
        return {};
      }

      const categories = { ...context.categories };

      // 重新计算每个类别的金额总和和状态
      for (const categoryName of Object.keys(categories)) {
        const category = categories[categoryName];
        const totalStandard = category.standard.reduce((sum: number, entry: any) => sum + entry.amount, 0);
        const totalCheck = category.check.reduce((sum: number, entry: any) => sum + entry.amount, 0);
        const difference = Math.abs(totalStandard - totalCheck);

        // 判断状态
        let status: 'match' | 'mismatch' | 'missing' = 'missing';
        if (category.standard.length > 0 && category.check.length > 0) {
          status = difference < 0.01 ? 'match' : 'mismatch';
        } else if (category.standard.length > 0 || category.check.length > 0) {
          status = 'missing';
        }

        categories[categoryName] = {
          ...category,
          totalStandard,
          totalCheck,
          difference,
          status,
        };
      }

      return categories;
    },
    generateSummary: async (context: any) => {
      if (!context.categories || !context.apiKey) {
        throw new Error('分类数据或API密钥缺失');
      }
      return await DeepSeekService.generateSummary(context.categories, context.apiKey);
    },
  },
});
