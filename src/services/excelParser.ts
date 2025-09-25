import * as XLSX from 'xlsx';
import { DeepSeekService } from './deepseekService';
import type { Entry, ParsedData, SimplifiedFileData } from '../types';

/**
 * 解析Excel文件并转换为结构化数据
 */
export class ExcelParser {
  /**
   * 解析单个Excel文件
   */
  static async parseFile(file: File, source: 'standard' | 'check', apiKey?: string): Promise<Entry[]> {
    console.log(`开始解析${source}文件:`, {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      timestamp: new Date().toISOString()
    });

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });

          console.log('工作簿信息:', {
            sheetNames: workbook.SheetNames,
            sheetCount: workbook.SheetNames.length,
            timestamp: new Date().toISOString()
          });

          // 获取第一个工作表
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // 转换为JSON
          const rawJsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
          }) as any[][];

          console.log('转换为原始JSON数据:', {
            rowCount: rawJsonData.length,
            firstRowLength: rawJsonData[0]?.length || 0,
            timestamp: new Date().toISOString()
          });

          // 使用AI检测标题行位置
          let headerRowIndex = 0; // 默认第一行
          let processedJsonData = rawJsonData;

          // 启发式标题行检测（回退/补充 AI）：尝试在前几行中找到可能的标题行
          const heuristicHeaderIndex = this.detectHeaderRowHeuristic(rawJsonData);
          if (heuristicHeaderIndex >= 0) {
            headerRowIndex = heuristicHeaderIndex;
            processedJsonData = [rawJsonData[headerRowIndex] as string[], ...rawJsonData.slice(headerRowIndex + 1)];
            console.log('启发式检测到标题行位置:', {
              headerRowIndex,
              headers: processedJsonData[0],
              timestamp: new Date().toISOString()
            });
          }

          if (apiKey && DeepSeekService.validateApiKey(apiKey)) {
            try {
              console.log('开始AI检测标题行位置...');
              const headerDetection = await DeepSeekService.detectHeaderRow(rawJsonData, apiKey);

              if (headerDetection.headerRowIndex >= 0 && headerDetection.confidence > 0.5) {
                headerRowIndex = headerDetection.headerRowIndex;
                console.log('AI检测到标题行位置:', {
                  headerRowIndex,
                  reason: headerDetection.reason,
                  confidence: headerDetection.confidence,
                  timestamp: new Date().toISOString()
                });

                // 根据检测结果重新组织数据
                if (headerRowIndex > 0) {
                  // 标题行不是第一行，需要重新组织数据
                  const headers = rawJsonData[headerRowIndex] as string[];
                  const dataRows = rawJsonData.slice(headerRowIndex + 1);
                  processedJsonData = [headers, ...dataRows];
                }
              } else if (headerDetection.headerRowIndex === -1) {
                // 没有明确的标题行，使用AI推断列含义
                console.log('AI判断没有明确的标题行，开始推断列含义...');
                try {
                  const columnInferences = await DeepSeekService.inferColumnMeanings(rawJsonData, apiKey);
                  const inferredHeaders = columnInferences.map(inf => inf.inferredName);
                  processedJsonData = [inferredHeaders, ...rawJsonData];
                  headerRowIndex = 0;

                  console.log('AI推断的列含义:', {
                    inferences: columnInferences,
                    headers: inferredHeaders,
                    timestamp: new Date().toISOString()
                  });
                } catch (inferenceError) {
                  console.log('AI列含义推断失败，使用虚拟列名:', inferenceError);
                  // 回退到虚拟列名
                  const firstDataRow = rawJsonData[0] || [];
                  const virtualHeaders = firstDataRow.map((_, index) => `列${index + 1}`);
                  processedJsonData = [virtualHeaders, ...rawJsonData];
                  headerRowIndex = 0;
                }
              }
            } catch (error) {
              console.log('AI标题行检测失败，使用默认第一行作为标题行:', error);
              // 保持默认设置
            }
          } else {
            console.log('未提供有效API Key，使用默认第一行作为标题行');
          }

          console.log('处理后的数据结构:', {
            headerRowIndex,
            processedRowCount: processedJsonData.length,
            headers: processedJsonData[0],
            timestamp: new Date().toISOString()
          });

          // 解析为Entry数组
          const entries = await this.parseJsonToEntries(processedJsonData, source, apiKey);
          console.log(`${source}文件解析完成:`, {
            entriesCount: entries.length,
            timestamp: new Date().toISOString()
          });
          resolve(entries);
        } catch (error) {
          console.error(`${source}文件解析失败:`, {
            error: error instanceof Error ? error.message : '未知错误',
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
          });
          reject(new Error(`文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`));
        }
      };

      reader.onerror = () => {
        console.error('文件读取失败:', {
          fileName: file.name,
          error: 'FileReader error',
          timestamp: new Date().toISOString()
        });
        reject(new Error('文件读取失败'));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 启发式检测标题行：扫描前几行，找到第一个具有多个非空单元格且含文本的行
   * 返回标题行索引（相对于 rawJsonData），找不到则返回 -1
   */
  private static detectHeaderRowHeuristic(rawJsonData: any[][]): number {
    if (!rawJsonData || rawJsonData.length === 0) return -1;

    const maxScan = Math.min(5, rawJsonData.length);

    // 清理字符串的辅助函数（去除零宽字符、BOM等）
    const cleanStr = (s: any) => String(s || '').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim();

    for (let i = 0; i < maxScan; i++) {
      const row = rawJsonData[i] || [];
      const nonEmptyCount = row.filter(cell => cleanStr(cell) !== '').length;

      // 至少两列非空并且存在非纯数字的单元格（避免把数字行误判为标题）
      const hasText = row.some(cell => {
        const v = cleanStr(cell);
        return v !== '' && isNaN(Number(v));
      });

      if (nonEmptyCount >= 2 && hasText) {
        return i;
      }
    }

    return -1;
  }

  /**
   * 同时解析两个文件
   */
  static async parseFiles(
    standardFile: File,
    checkFile: File,
    apiKey?: string
  ): Promise<ParsedData> {
    try {
      // 调试日志：确认 parseFiles 接收到的 apiKey（掩码显示前4字符）
      console.log('ExcelParser.parseFiles 接收到 apiKey:', {
        apiKeyInfo: apiKey ? `${String(apiKey).slice(0,4)}... (len=${String(apiKey).length})` : '无',
        timestamp: new Date().toISOString()
      });
      const [standard, check] = await Promise.all([
        this.parseFile(standardFile, 'standard', apiKey),
        this.parseFile(checkFile, 'check', apiKey),
      ]);

      return { standard, check };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 将JSON数组转换为Entry数组
   */
  private static async parseJsonToEntries(
    jsonData: any[][],
    source: 'standard' | 'check',
    apiKey?: string,
    simplifiedData?: SimplifiedFileData
  ): Promise<Entry[]> {
    console.log(`开始解析${source}文件数据:`, {
      dataRows: jsonData.length,
      useSimplifiedData: !!simplifiedData,
      timestamp: new Date().toISOString()
    });

    // 如果提供了简化数据，直接使用简化数据进行解析
    if (simplifiedData && simplifiedData.simplifiedData.length > 1) {
      console.log('使用大模型返回的简化数据进行解析:', {
        simplifiedRows: simplifiedData.dataRowsCount,
        confidence: simplifiedData.confidence,
        reasoning: simplifiedData.reasoning,
        timestamp: new Date().toISOString()
      });

      const entries: Entry[] = [];

      // 从简化数据的第二行开始处理（第一行是标题行）
      for (let i = 1; i < simplifiedData.simplifiedData.length; i++) {
        const row = simplifiedData.simplifiedData[i];

        if (!row || row.length < 2) {
          console.log(`跳过简化数据第${i + 1}行: 数据不完整`);
          continue;
        }

        const name = String(row[0] || '').trim();
        const amountStr = String(row[1] || '').trim();

        // 跳过空行
        if (!name && !amountStr) {
          console.log(`跳过第${i + 1}行: 空行`);
          continue;
        }

        // 解析金额
        const amount = this.parseAmount(amountStr);
        if (amount === null) {
          console.warn(`第${i + 1}行金额格式无效:`, {
            rowData: row,
            amountStr,
            name,
            timestamp: new Date().toISOString()
          });
          continue;
        }

        const entry = {
          id: `${source}_simplified_${i}`,
          name,
          amount,
          source,
          originalIndex: i,
        };

        entries.push(entry);
        console.log(`处理简化数据第${i + 1}行:`, {
          entryId: entry.id,
          name: entry.name,
          amount: entry.amount,
          timestamp: new Date().toISOString()
        });
      }

      if (entries.length === 0) {
        throw new Error('简化数据中没有找到有效的数据行');
      }

      return entries;
    }

    // 原始解析逻辑 - 如果没有简化数据，使用传统方法
    return this.parseJsonToEntriesTraditional(jsonData, source, apiKey);
  }

  /**
   * 传统JSON数据解析方法
   */
  private static async parseJsonToEntriesTraditional(
    jsonData: any[][],
    source: 'standard' | 'check',
    apiKey?: string
  ): Promise<Entry[]> {
    if (jsonData.length < 2) {
      const error = new Error('Excel文件至少需要包含标题行和一行数据');
      console.error('数据验证失败:', error.message);
      throw error;
    }

    const entries: Entry[] = [];
    const headers = jsonData[0] as string[];

    console.log('标题行内容详情:', {
      headers: headers,
      headersLength: headers.length,
      nonEmptyHeaders: headers.filter(h => h && h.trim() !== '').length,
      firstFewHeaders: headers.slice(0, 10),
      allHeadersAsString: headers.join('|'),
      timestamp: new Date().toISOString()
    });

    // 查找必要的列索引
    const nameKeywords = [
      'name', '名称', '条目', '项目', '项目名称',
      '摘要', '描述', '内容', '事项', '科目', '科目名称',
      '交易类型', '业务类型', '对方名称', '收款方', '付款方',
      '收款人', '收款人全称', '收款人名称', '收款单位', '收款单位名称',
      '单位', '单位信息', '单位名称',
      '商品名称', '服务名称', '商品', '服务', '品名',
      '标题', '主题', '明细'
    ];

    const amountKeywords = [
      'amount', '金额', '价值', '价格', '数额',
      '交易金额', '付款金额', '收款金额', '收入金额', '支出金额',
      '发生额', '本金金额', '借方金额', '贷方金额',
      '应收金额', '应付金额', '实收金额', '实付金额',
      '总金额', '小计', '合计', '总额', '净额',
      '余额', '剩余金额', '可用金额'
    ];

    const nameIndex = this.findColumnIndex(headers, nameKeywords);
    const amountIndex = this.findColumnIndex(headers, amountKeywords);

    // 名称列相关的状态变量
    let finalNameIndex = nameIndex;
    let aiNameDetection: { columnIndices: number[]; combinationRule: string } | null = null;
    // 金额列最终索引（提前声明，避免在后续代码分支中被提前使用）
    let finalAmountIndex = amountIndex;

    // 如果找不到明确的名称列，强制使用AI智能检测
    if (nameIndex === -1) {
      // 首先检查是否为复合数据格式
      const isCompositeFormat = this.detectCompositeFormat(headers, jsonData);

      if (isCompositeFormat && headers.length === 1) {
        console.log('检测到复合数据格式（名称和金额在同一列），使用复合数据解析');
        finalNameIndex = 0; // 使用第0列
        finalAmountIndex = 0; // 金额也在第0列
      } else if (apiKey && DeepSeekService.validateApiKey(apiKey)) {
        console.log('API Key有效，开始AI智能检测名称列...');
        try {
          console.log('尝试使用AI智能检测名称列...');
          const aiResult = await DeepSeekService.detectAndCombineNameColumns(headers, jsonData, apiKey);
          if (aiResult.columnIndices.length > 0) {
            aiNameDetection = aiResult;
            console.log('AI成功检测名称列组合:', {
              columnIndices: aiResult.columnIndices,
              columnNames: aiResult.columnIndices.map(idx => headers[idx]),
              combinationRule: aiResult.combinationRule,
              timestamp: new Date().toISOString()
            });

            // 如果AI检测到多个列需要组合为名称，则尝试使用AI批量生成每行的语义化名称（仅当提供apiKey时）
            if (aiNameDetection.columnIndices.length > 1 && apiKey && DeepSeekService.validateApiKey(apiKey)) {
              try {
                console.log('尝试使用AI批量生成行级语义化名称...');

                // 收集所有需要汇总的行样本（只包含候选列）
                const rowsToSummarize: string[][] = [];
                for (let i = 1; i < jsonData.length; i++) {
                  const row = jsonData[i];
                  const rowSamples = aiNameDetection.columnIndices.map((ci: number) => String(row[ci] || '').trim());
                  rowsToSummarize.push(rowSamples);
                }

                // 调用 DeepSeek 批量摘要接口
                const summaries = await DeepSeekService.summarizeRowsForNameGeneration(headers, aiNameDetection.columnIndices, rowsToSummarize, apiKey);

                // 如果得到有效的 summaries，则用其作为合并逻辑的首选；否则保持现有逻辑
                if (Array.isArray(summaries) && summaries.length === rowsToSummarize.length) {
                  console.log('AI批量摘要完成，使用生成的名称回填行数据（空或失败条目将回退到本地合并）');
                  // 将 summaries 写回到 jsonData 的一个虚拟列位置（便于后续处理）
                  // 我们不修改 headers 的结构，直接在后续处理时使用 summaries
                  // 把 summaries 暂存到局部变量，后面解析行时优先使用
                  (jsonData as any).__aiSummaries = summaries;
                } else {
                  console.log('AI批量摘要未返回有效结果，继续使用原有合并策略');
                }
              } catch (err) {
                console.log('AI批量生成名称失败，继续使用原有合并策略:', err);
              }
            }
          } else {
            console.log('AI未能检测到名称列，尝试从现有列中提取名称信息...');
            // 如果AI没有找到明确的名称列，尝试分析现有列的内容
            finalNameIndex = await this.aiAnalyzeExistingColumns(headers, jsonData, apiKey);
            if (finalNameIndex >= 0) {
              console.log('AI成功从现有列中提取名称信息:', {
                selectedIndex: finalNameIndex,
                selectedHeader: headers[finalNameIndex],
                timestamp: new Date().toISOString()
              });
            } else {
              console.log('AI也未能从现有列中提取名称信息');
            }
          }
        } catch (error) {
          console.log('AI名称列检测失败:', error);
          // 继续尝试传统方法作为最后的回退
          finalNameIndex = this.autoSelectNameColumn(headers, jsonData);
          console.log('回退到传统自动选择名称列:', {
            selectedIndex: finalNameIndex,
            selectedHeader: finalNameIndex >= 0 ? headers[finalNameIndex] : '未找到',
            timestamp: new Date().toISOString()
          });
        }
      } else {
        console.log('API Key无效或未提供，直接使用传统自动选择方法');
        finalNameIndex = this.autoSelectNameColumn(headers, jsonData);
        console.log('传统自动选择名称列:', {
          selectedIndex: finalNameIndex,
          selectedHeader: finalNameIndex >= 0 ? headers[finalNameIndex] : '未找到',
          timestamp: new Date().toISOString()
        });
      }
    }

    // 如果找不到金额列，尝试使用AI智能识别
    if (amountIndex === -1 && apiKey) {
      try {
        console.log('尝试使用AI识别金额列...');
        const aiDetectedIndex = await DeepSeekService.detectAmountColumn(headers, jsonData, apiKey);
        if (aiDetectedIndex >= 0) {
          finalAmountIndex = aiDetectedIndex;
          console.log('AI成功识别金额列:', {
            selectedIndex: finalAmountIndex,
            selectedHeader: headers[finalAmountIndex],
            timestamp: new Date().toISOString()
          });
        } else {
          console.log('AI未能识别金额列，使用传统方法');
        }
      } catch (error) {
        console.log('AI金额列识别失败，使用传统方法:', error);
      }
    }

    console.log('最终列索引查找结果:', {
      nameIndex: finalNameIndex,
      amountIndex: finalAmountIndex,
      nameHeader: finalNameIndex >= 0 ? headers[finalNameIndex] : '未找到',
      amountHeader: finalAmountIndex >= 0 ? headers[finalAmountIndex] : '未找到',
      nameColumnAutoSelected: nameIndex === -1 && finalNameIndex >= 0 && !aiNameDetection,
      nameColumnAiDetected: !!aiNameDetection,
      amountColumnAiDetected: amountIndex === -1 && finalAmountIndex >= 0,
      aiNameDetection: aiNameDetection,
      timestamp: new Date().toISOString()
    });

    if (finalNameIndex === -1 || finalAmountIndex === -1) {
      const foundColumns = [];
      if (finalNameIndex >= 0) foundColumns.push(`名称列（${headers[finalNameIndex]}）`);
      if (finalAmountIndex >= 0) foundColumns.push(`金额列（${headers[finalAmountIndex]}）`);

      const missingColumns = [];
      if (finalNameIndex === -1) missingColumns.push('名称列');
      if (finalAmountIndex === -1) missingColumns.push('金额列');

      let errorMessage = `Excel文件缺少必需的列。发现的列：${foundColumns.join('、') || '无'}。缺少的列：${missingColumns.join('、')}。`;

      if (finalNameIndex === -1 && headers.length > 0) {
        const validHeaders = headers.filter(h => h && h.trim() !== '');
        if (validHeaders.length === 0) {
          errorMessage += `Excel文件的标题行似乎是空的。请检查文件格式：\n`;
          errorMessage += `1. 确保第一行是标题行，且包含列名\n`;
          errorMessage += `2. 列名不能为空或只有空格\n`;
          errorMessage += `3. 尝试重新保存Excel文件\n`;
          errorMessage += `4. 确保使用.xlsx或.xls格式`;
        } else {
          errorMessage += `系统已使用AI深度分析所有列，但未能找到合适的名称列。可用的列名：${validHeaders.slice(0, 10).join('、')}${validHeaders.length > 10 ? '...' : ''}。\n`;
          errorMessage += `建议：检查数据是否包含名称信息，或者考虑添加一个明确的名称列。`;
        }
      } else if (finalNameIndex >= 0 && nameIndex === -1 && !aiNameDetection) {
        errorMessage += `系统已自动选择"${headers[finalNameIndex]}"列作为名称列。`;
      } else if (aiNameDetection) {
        const columnNames = aiNameDetection.columnIndices.map(idx => headers[idx]).join('、');
        errorMessage += `系统已使用AI智能组合"${columnNames}"列作为名称列（组合规则：${aiNameDetection.combinationRule}）。`;
      } else if (finalNameIndex >= 0 && nameIndex === -1) {
        errorMessage += `系统已使用AI从现有列中提取"${headers[finalNameIndex]}"列作为名称列。`;
      }

      if (finalAmountIndex >= 0 && amountIndex === -1) {
        errorMessage += `系统已使用AI智能识别"${headers[finalAmountIndex]}"列作为金额列。`;
      }

      if (finalAmountIndex === -1) {
        errorMessage += `请确保文件包含金额相关的列（如：${amountKeywords.slice(0, 5).join('、')}等）。`;
      }

      // 如果都没有找到，添加更多指导信息
      if (finalNameIndex === -1 && finalAmountIndex === -1) {
        errorMessage += `\n\n文件格式检查指南：\n`;
        errorMessage += `1. 第一行必须是标题行（列名）\n`;
        errorMessage += `2. 至少包含一列名称相关信息（如：项目、摘要、科目等）\n`;
        errorMessage += `3. 至少包含一列金额相关信息（如：金额、价格、价值等）\n`;
        errorMessage += `4. 数据从第二行开始\n`;
        errorMessage += `5. 确保API Key已正确设置（如果要使用AI智能识别）`;
      }

      const error = new Error(errorMessage);
      console.error('必需列缺失:', {
        foundColumns,
        missingColumns,
        availableHeaders: headers,
        finalNameIndex,
        finalAmountIndex,
        nameColumnAutoSelected: nameIndex === -1 && finalNameIndex >= 0,
        amountColumnAiDetected: amountIndex === -1 && finalAmountIndex >= 0,
        nameKeywords,
        amountKeywords
      });
      throw error;
    }

    // 检测是否为复合数据格式（名称和金额在同一列）
    const isCompositeFormat = this.detectCompositeFormat(headers, jsonData);

    // 从第二行开始处理数据
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];

      // 根据检测结果处理名称和金额
      let name: string;
      let amount: number | null = null;

      if (isCompositeFormat && headers.length === 1) {
        // 复合数据格式：名称和金额在同一列
        const compositeData = String(row[0] || '').trim();
        const parsed = this.extractFromCompositeData(compositeData);

        name = parsed.name;
        amount = parsed.amount;

        console.log(`复合数据解析第${i + 1}行:`, {
          compositeData,
          parsedName: name,
          parsedAmount: amount,
          timestamp: new Date().toISOString()
        });
      } else {
        // 传统格式：名称和金额在不同列
        if (aiNameDetection) {
          // 优先使用AI批量生成的摘要结果（如果存在）
          const aiSummaries = (jsonData as any).__aiSummaries as string[] | undefined;
          if (aiSummaries && aiSummaries[i - 1]) {
            name = String(aiSummaries[i - 1]).trim();
            if (!name) {
              // 回退到组合规则或单列提取
              name = this.combineNameValues(row, aiNameDetection.columnIndices, aiNameDetection.combinationRule) || this.extractNameFromCompositeData(String(row[finalNameIndex] || '').trim());
            }
          } else {
            // 使用AI检测的组合规则（本地合并）
            name = this.combineNameValues(row, aiNameDetection.columnIndices, aiNameDetection.combinationRule);
          }
        } else {
          // 使用传统单列方法，可能需要解析复合信息
          const rawName = String(row[finalNameIndex] || '').trim();
          name = this.extractNameFromCompositeData(rawName);
        }

        const amountStr = String(row[finalAmountIndex] || '').trim();

        // 跳过空行
        if (!name && !amountStr) {
          console.log(`跳过第${i + 1}行: 空行`);
          continue;
        }

        // 解析金额
        amount = this.parseAmount(amountStr);
      }

      // 验证数据完整性
      if (!name) {
        console.warn(`第${i + 1}行名称为空:`, {
          rowData: row,
          timestamp: new Date().toISOString()
        });
        continue;
      }

      if (amount === null) {
        console.warn(`第${i + 1}行金额格式无效:`, {
          rowData: row,
          name,
          timestamp: new Date().toISOString()
        });
        continue;
      }

      // 生成行级上下文文本：拼接除金额列外的所有非空文本列，用于AI分类提供更多语义上下文
      const contextColumns: string[] = [];
      for (let ci = 0; ci < headers.length; ci++) {
        if (ci === finalAmountIndex) continue; // 跳过金额列
        const cellVal = String(row[ci] || '').trim();
        if (!cellVal) continue;
        // 排除纯数字、非常短的噪声或仅为单位的文本
        if (!isNaN(Number(cellVal))) continue;
        const cleaned = cellVal.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').replace(/[,，\s]{2,}/g, ' ').trim();
        if (cleaned.length <= 1) continue;
        contextColumns.push(cleaned);
      }

      // 去重并按原始顺序合并，限制长度以防过大
      const uniqueContext: string[] = [];
      for (const txt of contextColumns) {
        if (!uniqueContext.includes(txt)) uniqueContext.push(txt);
      }
      let contextText = uniqueContext.join(' · ');
      const MAX_CONTEXT_LEN = 240; // 字符数上限
      if (contextText.length > MAX_CONTEXT_LEN) {
        contextText = contextText.slice(0, MAX_CONTEXT_LEN - 3) + '...';
      }

      // 保留原始解析到的名称，然后把 contextText 作为最终展示名称
      const entry = {
        id: `${source}_${i}`,
        name: contextText || name,
        originalName: name,
        amount,
        source,
        originalIndex: i,
        contextText,
      };

      entries.push(entry);
      console.log(`处理第${i + 1}行数据:`, {
        entryId: entry.id,
        name: entry.name,
        amount: entry.amount,
        timestamp: new Date().toISOString()
      });
    }

    if (entries.length === 0) {
      throw new Error('文件中没有找到有效的数据行');
    }

    return entries;
  }

  /**
   * AI分析现有列，尝试从中提取名称信息
   */
  private static async aiAnalyzeExistingColumns(headers: string[], jsonData: any[][], apiKey: string): Promise<number> {
    const prompt = this.buildExistingColumnAnalysisPrompt(headers, jsonData);

    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的数据分析师，擅长从现有的数据列中提取和推断名称信息。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 600,
          top_p: 0.8,
        }),
      });

      if (!response.ok) {
        throw new Error(`现有列分析失败: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('现有列分析返回内容为空');
      }

      return this.parseExistingColumnAnalysisResponse(content, headers);
    } catch (error) {
      console.error('AI现有列分析失败:', error);
      return -1;
    }
  }

  /**
   * 构建现有列分析Prompt
   */
  private static buildExistingColumnAnalysisPrompt(headers: string[], jsonData: any[][]): string {
    const dataRows = jsonData.slice(1, Math.min(11, jsonData.length)); // 跳过标题行，取前10行数据

    const columnAnalysis = headers.map((header, index) => {
      const columnData = dataRows.map(row => row[index]);
      const sampleValues = columnData.slice(0, 5).map(cell => String(cell || '').trim());

      return `列${index + 1} ("${header}") 示例数据: ${sampleValues.join(', ')}`;
    }).join('\n');

    return `
请分析以下Excel数据列，判断哪一列最可能包含或能够提取出名称信息。

数据样本（前${dataRows.length}行）：
${columnAnalysis}

请判断：
1. 哪一列包含了名称信息（即使列名不是"名称"）
2. 或者哪一列的数据能够被解析出名称部分（如"项目A: 100元"中的"项目A"）
3. 或者哪一列的数据模式暗示它是名称列

请返回JSON格式的结果：
{
  "bestColumnIndex": 列索引数字（从0开始），
  "reason": "选择的理由",
  "extractionMethod": "提取方法：'直接使用' | '解析复合信息' | '推断名称'",
  "confidence": 0.0-1.0之间的置信度
}

如果所有列都不适合，返回：
{
  "bestColumnIndex": -1,
  "reason": "所有列都不包含名称信息",
  "extractionMethod": "无",
  "confidence": 0.0
}

只返回JSON格式的结果，不要包含其他说明文字。
`;
  }

  /**
   * 解析现有列分析响应
   */
  private static parseExistingColumnAnalysisResponse(content: string, headers: string[]): number {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析现有列分析响应为JSON格式');
      }

      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      const bestColumnIndex = parsed.bestColumnIndex ?? -1;
      const confidence = parsed.confidence || 0;

      console.log('AI现有列分析结果:', {
        bestColumnIndex,
        bestColumnName: bestColumnIndex >= 0 ? headers[bestColumnIndex] : '未找到',
        reason: parsed.reason,
        extractionMethod: parsed.extractionMethod,
        confidence
      });

      return confidence > 0.3 ? bestColumnIndex : -1;
    } catch (error) {
      console.error('解析现有列分析响应失败:', error);
      return -1;
    }
  }

  /**
   * 从复合数据中提取名称和金额信息
   * 处理类似"项目名称: 金额"或"名称(金额)"这样的复合格式
   */
  private static extractFromCompositeData(compositeData: string): { name: string; amount: number | null } {
    if (!compositeData) return { name: '', amount: null };

    // 移除常见的货币符号和单位
    let cleaned = compositeData.replace(/[¥$€£₽₹₩₪₫₡₵₺₴₸₼₲₱₭₯₰₳₶₷₹₻₽₾₿]/g, '').trim();

    // 尝试分割常见的复合格式
    const separators = [':', '：', '-', '(', '（', '|', ' ', '\t'];

    for (const separator of separators) {
      if (cleaned.includes(separator)) {
        const parts = cleaned.split(separator).map(p => p.trim()).filter(p => p);

        // 如果有多个部分，尝试判断哪个是名称部分
        if (parts.length >= 2) {
          // 通常名称在前面，金额在后面
          // 检查最后一个部分是否看起来像金额
          const lastPart = parts[parts.length - 1];
          const secondLastPart = parts[parts.length - 2];

          // 如果最后一部分是纯数字或包含数字和货币单位，可能是金额
          if (/^\d+(\.\d+)?$/.test(lastPart) ||
              /\d+(\.\d+)?元?$/.test(lastPart) ||
              /\d+(\.\d+)?块?$/.test(lastPart) ||
              /\d+(\.\d+)?角?$/.test(lastPart) ||
              /\d+(\.\d+)?分?$/.test(lastPart)) {
            // 返回除最后一个部分外的所有部分作为名称，最后一部分作为金额
            const name = parts.slice(0, -1).join(separator).trim();
            const amount = this.parseAmount(lastPart);
            return { name, amount };
          }

          // 如果最后一部分看起来像金额单位，也认为是金额
          if (lastPart.match(/^(元|块|角|分|人民币|美元|欧元|日元|港币|澳元)$/)) {
            const name = parts.slice(0, -1).join(separator).trim();
            return { name, amount: null }; // 需要从倒数第二个部分提取金额
          }

          // 如果倒数第二个部分看起来像金额，最后一个是单位
          if (parts.length >= 3 &&
              (/^\d+(\.\d+)?$/.test(secondLastPart) ||
               /\d+(\.\d+)?元?$/.test(secondLastPart)) &&
              lastPart.match(/^(元|块|角|分|人民币|美元|欧元|日元|港币|澳元)$/)) {
            const name = parts.slice(0, -2).join(separator).trim();
            const amount = this.parseAmount(secondLastPart);
            return { name, amount };
          }
        }
      }
    }

    // 如果没有找到明显的分割符，返回清理后的原始数据，金额为null
    return { name: cleaned, amount: null };
  }

  /**
   * 检测数据是否为复合格式（名称和金额在同一列）
   */
  private static detectCompositeFormat(headers: string[], jsonData: any[][]): boolean {
    // 如果有多列，不太可能是复合格式
    if (headers.length !== 1) return false;

    // 检查前几行数据
    const sampleRows = jsonData.slice(1, Math.min(10, jsonData.length)); // 跳过标题行，取前9行数据

    let compositeCount = 0;
    const separators = [':', '：', '-', '(', '（', '|'];

    for (const row of sampleRows) {
      const cellValue = String(row[0] || '').trim();
      if (!cellValue) continue;

      // 检查是否包含常见的分隔符
      const hasSeparator = separators.some(sep => cellValue.includes(sep));

      if (hasSeparator) {
        // 检查分割后是否包含数字（金额）
        const parts = cellValue.split(/[:：\-（(]/).map(p => p.trim()).filter(p => p);
        const lastPart = parts[parts.length - 1];

        // 如果最后一部分看起来像金额，则认为是复合格式
        if (/^\d+(\.\d+)?$/.test(lastPart) ||
            /\d+(\.\d+)?元?$/.test(lastPart) ||
            /\d+(\.\d+)?块?$/.test(lastPart) ||
            /\d+(\.\d+)?角?$/.test(lastPart) ||
            /\d+(\.\d+)?分?$/.test(lastPart)) {
          compositeCount++;
        }
      }
    }

    // 如果超过一半的行都是复合格式，则认为是复合数据
    const ratio = compositeCount / sampleRows.length;
    console.log('复合格式检测结果:', {
      totalRows: sampleRows.length,
      compositeRows: compositeCount,
      ratio: ratio.toFixed(2),
      isComposite: ratio > 0.5
    });

    return ratio > 0.5;
  }

  /**
   * 从复合数据中提取名称信息（向后兼容的旧函数）
   * 处理类似"项目名称: 金额"或"名称(金额)"这样的复合格式
   */
  private static extractNameFromCompositeData(compositeData: string): string {
    const result = this.extractFromCompositeData(compositeData);
    return result.name;
  }

  /**
   * 根据组合规则组合名称列的值
   */
  private static combineNameValues(row: any[], columnIndices: number[], combinationRule: string): string {
    if (columnIndices.length === 0) return '';
    if (columnIndices.length === 1) {
      return String(row[columnIndices[0]] || '').trim();
    }

    // 如果没有明确的组合规则，使用默认的连接方式
    if (!combinationRule || combinationRule === '直接使用单列') {
      return columnIndices.map(idx => String(row[idx] || '').trim()).filter(val => val).join(' ');
    }

    // 解析组合规则，如："组合格式：{0}-{1}" 或 "组合格式：{列A}({列B})"
    let result = combinationRule;

    // 替换列索引占位符 {0}, {1}, {2}...
    columnIndices.forEach((colIndex, placeholderIndex) => {
      const value = String(row[colIndex] || '').trim();
      const regex = new RegExp(`\\{${placeholderIndex}\\}`, 'g');
      result = result.replace(regex, value);
    });

    // 清理结果：移除多余的空格和空括号
    result = result.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '').replace(/-\s*$/g, '').replace(/^\s*-/g, '').trim();

    return result;
  }

  /**
   * 自动选择名称列
   * 当找不到明确的名列时，根据数据特征自动选择合适的列
   */
  private static autoSelectNameColumn(headers: string[], jsonData: any[][]): number {
    if (headers.length === 0 || jsonData.length < 2) return -1;

    // 分析每列的数据特征
    const columnAnalysis = headers.map((header, index) => {
      const columnData = jsonData.slice(1).map(row => row[index]); // 跳过标题行
      const nonEmptyCells = columnData.filter(cell => cell != null && String(cell).trim() !== '');

      // 计算文本特征
      const textCells = nonEmptyCells.filter(cell => isNaN(Number(cell)) && String(cell).trim().length > 0);
      const numericCells = nonEmptyCells.filter(cell => !isNaN(Number(cell)));
      const longTextCells = textCells.filter(cell => String(cell).length > 5);

      // 计算唯一值比例
      const uniqueValues = new Set(nonEmptyCells.map(cell => String(cell).trim().toLowerCase()));
      const uniquenessRatio = uniqueValues.size / nonEmptyCells.length;

      // 计算平均文本长度
      const avgTextLength = textCells.length > 0
        ? textCells.reduce((sum, cell) => sum + String(cell).length, 0) / textCells.length
        : 0;

      return {
        index,
        header,
        totalCells: columnData.length,
        nonEmptyCells: nonEmptyCells.length,
        textCells: textCells.length,
        numericCells: numericCells.length,
        longTextCells: longTextCells.length,
        uniquenessRatio,
        avgTextLength,
        // 计算名称列的评分（越高越可能是名称列）
        nameScore: (textCells.length / nonEmptyCells.length) * 0.4 + // 文本占比
                   uniquenessRatio * 0.3 + // 唯一值比例
                   Math.min(avgTextLength / 20, 1) * 0.3 // 文本长度（归一化）
      };
    });

    console.log('列数据分析结果:', columnAnalysis.map(col => ({
      header: col.header,
      textRatio: (col.textCells / col.nonEmptyCells).toFixed(2),
      uniqueness: col.uniquenessRatio.toFixed(2),
      avgLength: col.avgTextLength.toFixed(1),
      nameScore: col.nameScore.toFixed(3)
    })));

    // 排除明显不是名称列的列（纯数字列、ID列等）
    const candidateColumns = columnAnalysis.filter(col => {
      // 排除空列名
      if (!col.header || col.header.trim() === '') return false;
      // 排除纯数字列
      if (col.numericCells > 0 && col.textCells === 0) return false;
      // 排除唯一值太少的列（可能是序号、状态等）
      if (col.uniquenessRatio < 0.3 && col.totalCells > 5) return false;
      // 排除文本长度太短的列
      if (col.avgTextLength < 2) return false;
      return true;
    });

    if (candidateColumns.length === 0) return -1;

    // 选择评分最高的列
    candidateColumns.sort((a, b) => b.nameScore - a.nameScore);
    const selectedColumn = candidateColumns[0];

    console.log('自动选择名称列详情:', {
      selectedHeader: selectedColumn.header,
      selectedIndex: selectedColumn.index,
      nameScore: selectedColumn.nameScore.toFixed(3),
      textRatio: (selectedColumn.textCells / selectedColumn.nonEmptyCells).toFixed(2),
      alternatives: candidateColumns.slice(1, 3).map(col => `${col.header}(评分:${col.nameScore.toFixed(3)})`)
    });

    return selectedColumn.index;
  }

  /**
   * 查找列索引 - 支持多种匹配方式
   */
  private static findColumnIndex(headers: string[], keywords: string[]): number {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]?.toLowerCase().trim();
      if (!header) continue;

      // 1. 完全匹配
      if (keywords.some(keyword => header === keyword.toLowerCase())) {
        return i;
      }

      // 2. 包含匹配
      if (keywords.some(keyword => header.includes(keyword.toLowerCase()))) {
        return i;
      }

      // 3. 关键词匹配（处理多词列名，如"项目名称"匹配"名称"）
      const headerWords = header.split(/[\s_－\-]+/);
      if (headerWords.some(word => keywords.some(keyword => word.includes(keyword.toLowerCase())))) {
        return i;
      }

      // 4. 缩写匹配（处理"amt"匹配"amount"）
      const abbreviations = {
        'amt': 'amount', 'amt.': 'amount',
        'qty': 'quantity', 'qty.': 'quantity',
        'desc': 'description', 'desc.': 'description',
        'subj': 'subject', 'subj.': 'subject'
      };

      for (const [abbr, full] of Object.entries(abbreviations)) {
        if (header === abbr && keywords.some(k => k.toLowerCase().includes(full))) {
          return i;
        }
      }
    }
    return -1;
  }

  /**
   * 解析金额字符串
   */
  private static parseAmount(amountStr: string): number | null {
    if (!amountStr) return null;

    // 移除货币符号和空格
    const cleaned = amountStr
      .replace(/[¥$€£₽₹₩₪₫₡₵₺₴₸₼₲₱₭₯₰₳₶₷₹₻₽₾₿]/g, '')
      .replace(/,/g, '')
      .trim();

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : Math.round(parsed * 100) / 100; // 保留两位小数
  }

  /**
   * 验证文件类型
   */
  static validateFile(file: File): { valid: boolean; error?: string } {
    // 检查文件大小 (最大10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return { valid: false, error: '文件大小不能超过10MB' };
    }

    // 检查文件类型
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      'text/csv',
    ];

    const allowedExtensions = ['.xlsx', '.xls', '.xlsm', '.csv'];

    const hasValidType = allowedTypes.includes(file.type);
    const hasValidExtension = allowedExtensions.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidType && !hasValidExtension) {
      return { valid: false, error: '只支持Excel文件(.xlsx, .xls, .xlsm)和CSV文件' };
    }

    return { valid: true };
  }

}
