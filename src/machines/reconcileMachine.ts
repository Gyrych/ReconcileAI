import { createMachine, assign, fromPromise } from 'xstate';
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
    currentStep: 'upload',
    error: '',
    isLoading: false,
  },
  states: {
    upload: {
      on: {
        SET_STANDARD_FILE: {
          actions: assign({
            standardFile: ({ event }: any) => (event as any)?.file ?? null,
            error: '',
          }),
        },
        SET_CHECK_FILE: {
          actions: assign({
            checkFile: ({ event }: any) => (event as any)?.file ?? null,
            error: '',
          }),
        },
        SET_API_KEY: {
          actions: [
            ({ context, event }: any) => {
              console.log('🔑 SET_API_KEY 事件被触发:', {
                eventApiKeyLength: (event as any)?.apiKey?.length || 0,
                currentContextApiKeyLength: context.apiKey?.length || 0,
                timestamp: new Date().toISOString()
              });
            },
            assign({
              apiKey: ({ event }: any) => (event as any)?.apiKey ?? '',
            }),
            ({ context }: any) => {
              console.log('🔑 API Key 已设置到状态机上下文:', {
                newApiKeyLength: context.apiKey?.length || 0,
                timestamp: new Date().toISOString()
              });
            }
          ],
        },
        NEXT: {
          target: 'parse',
          guard: 'canProceedToParse',
          actions: [
            ({ context, event }: any) => {
              console.log('🎯 NEXT事件触发 - 准备转换状态:', {
                currentState: 'upload',
                targetState: 'parse',
                guardWillBeChecked: true,
                context: {
                  hasStandardFile: !!context.standardFile,
                  hasCheckFile: !!context.checkFile,
                  hasApiKey: !!context.apiKey,
                  apiKeyLength: context.apiKey?.length || 0,
                  standardFileName: (context.standardFile as any)?.name,
                  checkFileName: (context.checkFile as any)?.name,
                },
                event,
                timestamp: new Date().toISOString()
              });
            }
          ]
        },
      },
    },
    parse: {
      entry: [
        assign({ isLoading: true, error: '', currentStep: 'parse' }),
        ({ context }: any) => {
          console.log('进入parse状态:', {
            files: {
              standardFile: (context.standardFile as any)?.name,
              checkFile: (context.checkFile as any)?.name,
            },
            timestamp: new Date().toISOString()
          });
        }
      ],
      invoke: {
        src: 'parseFiles',
        input: ({ context }: any) => ({
          standardFile: context.standardFile,
          checkFile: context.checkFile
        }),
        onDone: {
          target: 'display',
          actions: [
            assign({
              parsedData: (_, event: any) => event.output,
              isLoading: false,
            }),
            (_, event: any) => {
              console.log('文件解析成功:', {
                standardEntriesCount: event.output.standard?.length || 0,
                checkEntriesCount: event.output.check?.length || 0,
                timestamp: new Date().toISOString()
              });
            }
          ],
        },
        onError: {
          actions: [
            assign({
              error: ({ event }: any) => {
                const error = (event as any)?.error;
                let userFriendlyMessage = '文件解析失败';

                // 根据错误类型提供更具体的错误信息
                if (error instanceof Error) {
                  if (error.message.includes('文件未选择')) {
                    userFriendlyMessage = '请先选择标准表和待核对表文件';
                  } else if (error.message.includes('至少需要包含标题行')) {
                    userFriendlyMessage = 'Excel文件格式不正确，至少需要包含标题行和一行数据';
                  } else if (error.message.includes('必须包含')) {
                    userFriendlyMessage = 'Excel文件缺少必需的列：名称和金额列';
                  } else if (error.message.includes('文件中没有找到有效的数据行')) {
                    userFriendlyMessage = 'Excel文件中没有找到有效的数据，请检查文件内容';
                  } else if (error.message.includes('文件读取失败')) {
                    userFriendlyMessage = '文件读取失败，请检查文件是否损坏或格式是否正确';
                  } else {
                    userFriendlyMessage = error.message;
                  }
                }

                console.error('文件解析失败:', {
                  originalError: error,
                  userMessage: userFriendlyMessage,
                  timestamp: new Date().toISOString()
                });

                return userFriendlyMessage;
              },
              isLoading: false,
            }),
            ({ event }: any) => {
              console.error('文件解析失败:', {
                error: (event as any)?.data,
                timestamp: new Date().toISOString()
              });
            }
          ],
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
        assign({ isLoading: true, error: '', currentStep: 'aiClassify' }),
      ],
      invoke: {
        src: 'classifyEntries',
        input: ({ context }: any) => ({
          parsedData: context.parsedData,
          apiKey: context.apiKey
        }),
        onDone: {
          target: 'manualConfirm',
          actions: assign({
            categories: (_, event: any) => event.output.categories,
            summary: (_, event: any) => event.output.summary,
            isLoading: false,
          }),
        },
        onError: {
          actions: assign({
            error: (_, event: any) => event.error.message || 'AI分类失败',
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
        input: ({ context }: any) => ({
          categories: context.categories
        }),
        onDone: {
          target: 'compare',
          actions: assign({
            categories: (_, event: any) => event.output,
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
        input: ({ context }: any) => ({
          categories: context.categories,
          apiKey: context.apiKey
        }),
        onDone: {
          actions: assign({
            summary: (_, event: any) => event.output,
            isLoading: false,
          }),
        },
        onError: {
          actions: assign({
            error: (_, event: any) => event.error.message || '总结生成失败',
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
            error: '',
            isLoading: false,
          }),
        },
      },
    },
  },
}, {
  guards: {
    canProceedToParse: ({ context, event }: any) => {
      const canProceed = !!(context.standardFile && context.checkFile && context.apiKey);
      console.log('🔍 守卫检查: canProceedToParse', {
        context: {
          hasStandardFile: !!context.standardFile,
          hasCheckFile: !!context.checkFile,
          hasApiKey: !!context.apiKey,
          apiKeyLength: context.apiKey?.length || 0,
          standardFileName: (context.standardFile as any)?.name,
          checkFileName: (context.checkFile as any)?.name,
          standardFileSize: (context.standardFile as any)?.size,
          checkFileSize: (context.checkFile as any)?.size,
        },
        event,
        guardResult: canProceed,
        reason: canProceed
          ? '✅ 所有条件满足'
          : !context.standardFile && !context.checkFile
            ? '❌ 缺少两个文件'
            : !context.standardFile
              ? '❌ 缺少标准表文件'
              : !context.checkFile
                ? '❌ 缺少核对表文件'
                : !context.apiKey
                  ? '❌ 缺少API密钥'
                  : '❌ 未知原因',
        timestamp: new Date().toISOString()
      });
      return canProceed;
    },
  },
  actions: {
    moveEntry: assign({
      categories: ({ context, event }: any) => {
        if (!context.categories) return context.categories;

        const { entryId, fromCategory, toCategory } = event as any;
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
          ...(categories[fromCategory]?.standard || []),
          ...(categories[fromCategory]?.check || []),
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
  actors: {
    parseFiles: fromPromise(async ({ input }: any) => {
      console.log('开始解析文件:', {
        standardFile: input.standardFile?.name,
        checkFile: input.checkFile?.name,
        standardFileSize: input.standardFile?.size,
        checkFileSize: input.checkFile?.size,
        timestamp: new Date().toISOString()
      });

      if (!input.standardFile || !input.checkFile) {
        const error = new Error('文件未选择');
        console.error('文件验证失败:', error.message);
        throw error;
      }

      try {
        const result = await ExcelParser.parseFiles(input.standardFile, input.checkFile);
        console.log('文件解析完成:', {
          standardEntries: result.standard.length,
          checkEntries: result.check.length,
          timestamp: new Date().toISOString()
        });
        return result;
      } catch (error) {
        console.error('文件解析过程中出错:', {
          error: error instanceof Error ? error.message : '未知错误',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        // 确保抛出的错误是Error对象
        if (error instanceof Error) {
          throw error;
        } else {
          throw new Error(String(error));
        }
      }
    }),
    classifyEntries: fromPromise(async ({ input }: any) => {
      if (!input.parsedData || !input.apiKey) {
        throw new Error('数据或API密钥缺失');
      }

      try {
        return await DeepSeekService.classifyEntries(
          input.parsedData.standard,
          input.parsedData.check,
          input.apiKey
        );
      } catch (error) {
        console.error('AI分类服务出错:', {
          error: error instanceof Error ? error.message : '未知错误',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        // 确保抛出的错误是Error对象
        if (error instanceof Error) {
          throw error;
        } else {
          throw new Error(String(error));
        }
      }
    }),
    calculateAmounts: fromPromise(async ({ input }: any) => {
      if (!input.categories) {
        return {};
      }

      const categories = { ...input.categories };

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
    }),
    generateSummary: fromPromise(async ({ input }: any) => {
      if (!input.categories || !input.apiKey) {
        throw new Error('分类数据或API密钥缺失');
      }

      try {
        return await DeepSeekService.generateSummary(input.categories, input.apiKey);
      } catch (error) {
        console.error('总结生成服务出错:', {
          error: error instanceof Error ? error.message : '未知错误',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        // 确保抛出的错误是Error对象
        if (error instanceof Error) {
          throw error;
        } else {
          throw new Error(String(error));
        }
      }
    }),
  },
});
