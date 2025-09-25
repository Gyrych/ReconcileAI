import { createMachine, assign, fromPromise } from 'xstate';

// 从 invoke 事件中提取解析结果的通用函数，兼容不同平台事件包装
function extractParsedPayload(event: any): any {
  if (!event) return null;
  // 常见位置： event.data, event.output, event
  const candidates: any[] = [event?.data, event?.output, event];

  for (const cand of candidates) {
    if (!cand) continue;
    const candAny = cand as any;
    if (candAny?.standard && candAny?.check) return candAny;
    // 递归查找第一层对象中包含 standard/check 的子对象
    for (const key of Object.keys(candAny)) {
      try {
        const v = (candAny as any)[key];
        if (v && typeof v === 'object' && ((v as any).standard || (v as any).check)) return v;
      } catch (_) {}
    }
  }

  // 最后尝试深度搜索（受限深度）
  const seen = new Set<any>();
  function dfs(obj: any, depth = 0): any {
    if (!obj || typeof obj !== 'object' || seen.has(obj) || depth > 4) return null;
    seen.add(obj);
    if ((obj as any).standard && (obj as any).check) return obj;
    for (const k of Object.keys(obj)) {
      const res: any = dfs(obj[k], depth + 1);
      if (res) return res;
    }
    return null;
  }

  for (const cand of candidates) {
    const res: any = dfs(cand, 0);
    if (res) return res;
  }

  return null;
}
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
          checkFile: context.checkFile,
          apiKey: context.apiKey
        }),
        onDone: {
          target: 'display',
          actions: [
            assign({
              parsedData: (_, event: any) => {
                // 诊断性日志，记录 event 的顶层键
                try {
                  console.log('DEBUG parse onDone event keys:', Object.keys(event || {}));
                  console.log('DEBUG event.data keys:', event?.data ? Object.keys(event.data) : null);
                  console.log('DEBUG event.output keys:', event?.output ? Object.keys(event.output) : null);
                } catch (e) {}

                // 首选直接获取 event.data/event.output
                let payload = event?.data ?? event?.output ?? event;

                // 如果 payload 本身不包含 standard/check，尝试在其子属性中查找
                if (payload && !((payload as any).standard && (payload as any).check)) {
                  for (const val of Object.values(payload || {})) {
                    if (val && typeof val === 'object' && (((val as any).standard) || ((val as any).check))) {
                      payload = val;
                      break;
                    }
                  }
                }

                // 最后回退到 extractParsedPayload 的更深层查找
                if (!payload || !(((payload as any).standard) && ((payload as any).check))) {
                  payload = extractParsedPayload(event) ?? null;
                }

                // 如果仍然没有有效 payload，尝试使用全局回退（由 actors.parseFiles 暂存）
                if ((!payload || !(((payload as any).standard) && ((payload as any).check))) && (globalThis as any).__LAST_PARSE_RESULT) {
                  try {
                    console.log('使用全局回退解析结果 __LAST_PARSE_RESULT 作为 payload 回退来源');
                  } catch (e) {}
                  payload = (globalThis as any).__LAST_PARSE_RESULT;
                }

                // 规范化返回结构，兼容 frontend 可能读取的不同字段名
                if (payload) {
                  const normalized: any = {
                    standard: payload.standard ?? payload.standardEntries ?? payload.standardRows ?? [],
                    check: payload.check ?? payload.checkEntries ?? payload.checkRows ?? []
                  };
                  // 将兼容字段一并保留，便于前端逐步迁移
                  normalized.standardEntries = normalized.standard;
                  normalized.checkEntries = normalized.check;
                  return normalized;
                }

                return null;
              },
              isLoading: false,
            }),
            // 诊断：在 assign 完成后打印 context.parsedData 的摘要，确保前端能读取到
            ({ context }: any) => {
              try {
                const pd = (context as any).parsedData;
                console.log('DEBUG context.parsedData after assign:', {
                  keys: pd ? Object.keys(pd) : null,
                  standardLen: pd?.standard?.length ?? pd?.standardEntries?.length ?? 0,
                  checkLen: pd?.check?.length ?? pd?.checkEntries?.length ?? 0,
                });
              } catch (e) {}
            },
            (_, event: any) => {
                const payload = extractParsedPayload(event) || (event?.data ?? event?.output ?? event);
                console.log('文件解析成功:', {
                standardEntriesCount: payload?.standard?.length || 0,
                checkEntriesCount: payload?.check?.length || 0,
                timestamp: new Date().toISOString()
              });
            }
          ],
        },
        onError: {
          actions: [
            assign({
              error: ({ event }: any) => {
                const evt = (event as any) || {};
                const err = evt.error ?? evt.data ?? evt;
                let userFriendlyMessage = '文件解析失败';

                // 根据错误类型提供更具体的错误信息
                const message = (err instanceof Error ? err.message : (typeof err === 'string' ? err : JSON.stringify(err || {})));
                if (message.includes && message.includes('文件未选择')) {
                  userFriendlyMessage = '请先选择标准表和待核对表文件';
                } else if (message.includes && message.includes('至少需要包含标题行')) {
                  userFriendlyMessage = 'Excel文件格式不正确，至少需要包含标题行和一行数据';
                } else if (message.includes && message.includes('必须包含')) {
                  userFriendlyMessage = 'Excel文件缺少必需的列：名称和金额列';
                } else if (message.includes && message.includes('文件中没有找到有效的数据行')) {
                  userFriendlyMessage = 'Excel文件中没有找到有效的数据，请检查文件内容';
                } else if (message.includes && message.includes('分类结果解析失败')) {
                  userFriendlyMessage = 'AI分类返回格式异常，已回退为未分类，请检查日志';
                } else if (message.includes && message.includes('文件读取失败')) {
                  userFriendlyMessage = '文件读取失败，请检查文件是否损坏或格式是否正确';
                } else {
                  userFriendlyMessage = message || userFriendlyMessage;
                }

                console.error('文件解析失败（事件）：', {
                  event: evt,
                  message,
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
            categories: (_, event: any) => {
              // 尝试多路径提取 categories，兼容不同运行时和 invoke wrapping
              let payload: any = (event && (event.data ?? event.output ?? event)) ?? null;

              // 深度查找可能包含 categories 的子对象
              if (payload && !payload.categories) {
                try {
                  for (const v of Object.values(payload)) {
                    const vv: any = v;
                    if (vv && typeof vv === 'object' && (vv.categories || (vv.standard && vv.check))) {
                      payload = vv;
                      break;
                    }
                  }
                } catch (e) {}
              }

              // 使用通用提取器
              const deep = extractParsedPayload(event) ?? payload;

              // 最后回退到全局缓存（actors 可能已写入）
              const globalFallback = (globalThis as any).__LAST_CLASSIFY_RESULT ?? (globalThis as any).__LAST_PARSE_RESULT ?? null;

              const finalPayload = deep ?? globalFallback ?? null;

              try { // 诊断性日志
                console.log('DEBUG aiClassify onDone payload keys:', finalPayload ? Object.keys(finalPayload) : null);
              } catch (e) {}

              return finalPayload?.categories ?? null;
            },
            summary: (_, event: any) => {
              let payload: any = (event && (event.data ?? event.output ?? event)) ?? null;

              if (payload && !payload.summary) {
                try {
                  for (const v of Object.values(payload)) {
                    const vv: any = v;
                    if (vv && typeof vv === 'object' && vv.summary) {
                      payload = vv;
                      break;
                    }
                  }
                } catch (e) {}
              }

              const deep = extractParsedPayload(event) ?? payload;
              const globalFallback = (globalThis as any).__LAST_CLASSIFY_RESULT ?? null;
              const finalPayload = deep ?? globalFallback ?? null;

              return finalPayload?.summary ?? null;
            },
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
            categories: (_, event: any) => {
              // 尝试多路径提取计算结果，兼容不同运行时的包装形式
              let payload: any = (event && (event.data ?? event.output ?? event)) ?? null;

              // 如果 payload 包含 categories 字段，优先使用它
              if (payload && typeof payload === 'object' && payload.categories) {
                return payload.categories;
              }

              // 如果 payload 本身就是 categories 对象（以类别名为键），直接返回
              if (payload && typeof payload === 'object') {
                return payload;
              }

              // 回退到全局缓存（actor 可能已写入）
              const globalFallback = (globalThis as any).__LAST_CALCULATE_RESULT ?? (globalThis as any).__LAST_CLASSIFY_RESULT?.categories ?? (globalThis as any).__LAST_PARSE_RESULT ?? null;
              return globalFallback;
            },
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
            summary: (_, event: any) => {
              // 兼容不同运行时的 event 包装，优先取 data/output，然后尝试在子属性中查找 summary
              let payload: any = (event && (event.data ?? event.output ?? event)) ?? null;

              if (payload && typeof payload === 'object') {
                if (payload.summary && typeof payload.summary === 'string') return payload.summary;
                // 某些实现把 summary 放在 payload.data.summary 或 payload.output.summary
                if (payload.data && payload.data.summary) return payload.data.summary;
                if (payload.output && payload.output.summary) return payload.output.summary;
                // 若 payload 本身就是字符串（rare），直接返回
              }

              // 如果 payload 是字符串则直接作为 summary
              if (typeof payload === 'string') return payload;

              // 回退到全局缓存
              const globalFallback = (globalThis as any).__LAST_SUMMARY_RESULT ?? (globalThis as any).__LAST_CLASSIFY_RESULT?.summary ?? null;
              return globalFallback ?? null;
            },
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
        // 在此处记录传入的 apiKey（掩码显示前4字符）以便调试
        apiKeyInfo: input.apiKey ? `${String(input.apiKey).slice(0,4)}... (len=${String(input.apiKey).length})` : '无',
        timestamp: new Date().toISOString()
      });

      if (!input.standardFile || !input.checkFile) {
        const error = new Error('文件未选择');
        console.error('文件验证失败:', error.message);
        throw error;
      }

      try {
        const result = await ExcelParser.parseFiles(input.standardFile, input.checkFile, input.apiKey);
        console.log('文件解析完成:', {
          standardEntries: result.standard.length,
          checkEntries: result.check.length,
          timestamp: new Date().toISOString()
        });
        // 兼容性补丁：在某些运行环境中 onDone 的 event 可能不可枚举，
        // 将解析结果暂存到全局变量，作为 onDone 的回退读取来源
        try {
          (globalThis as any).__LAST_PARSE_RESULT = result;
        } catch (e) {
          // 忽略在受限环境中设置全局变量可能失败的情况
        }
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
