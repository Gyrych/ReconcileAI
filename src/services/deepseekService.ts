import type { Entry, CategoryData, ClassificationResult, SimplifiedFileData } from '../types';

export class DeepSeekService {
  private static readonly API_BASE_URL = 'https://api.deepseek.com/v1';
  private static readonly MODEL = 'deepseek-chat';

  /**
   * 调用DeepSeek API进行条目分类
   */
  static async classifyEntries(
    standardEntries: Entry[],
    checkEntries: Entry[],
    apiKey: string
  ): Promise<ClassificationResult> {
    const prompt = this.buildClassificationPrompt(standardEntries, checkEntries);

    try {
      const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        // 请求体：提高 max_tokens 以避免长输出被截断，并保持较低 temperature 以稳定结果
        body: JSON.stringify({
          model: this.MODEL,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的财务数据分析师，擅长对账目进行智能分类和汇总。请根据条目的名称和金额特征，将相似的条目归类到一起。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1, // 极低温度以获得确定性、更可重复的分类输出
          // 提高 max_tokens，具体数值依赖于模型与账户上限，这里设置为较大值以减少截断风险
          max_tokens: 8000,
          top_p: 0.9,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API调用失败: ${response.status} ${response.statusText}\n${errorData.error?.message || ''}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('API返回内容为空');
      }

      return this.parseClassificationResponse(content, standardEntries, checkEntries);
    } catch (error) {
      console.error('DeepSeek API调用失败:', error);
      throw error;
    }
  }

  /**
   * 生成财务总结报告
   */
  static async generateSummary(
    categories: CategoryData,
    apiKey: string
  ): Promise<string> {
    const prompt = this.buildSummaryPrompt(categories);

    try {
      const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的财务审计专家，擅长分析财务数据并生成清晰的总结报告。请用简洁明了的语言描述财务状况。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.2, // 更低的温度以获得更准确的总结
          max_tokens: 1500,
          top_p: 0.8,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`总结生成失败: ${response.status} ${response.statusText}\n${errorData.error?.message || ''}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('总结内容生成失败');
      }

      return content;
    } catch (error) {
      console.error('总结生成失败:', error);
      throw error;
    }
  }

  /**
   * 构建分类Prompt
   */
  private static buildClassificationPrompt(
    standardEntries: Entry[],
    checkEntries: Entry[]
  ): string {
    // 为避免输出过长导致被截断，prompt 设计要求：
    // 1) 在示例中只使用条目 ID 与简短金额示例，不包含完整名称或上下文。
    // 2) 明确要求模型仅返回 JSON，并且在类别数组中只使用 ID（如 "standard_1" / "check_10"）。
    const formatIdLines = (entries: Entry[]) => entries.map(e => `${e.id} | 金额: ${e.amount}元`).join('\n');

    return `
注意（非常重要）：本次分类要求更精细的层级化输出，严格遵守以下规则：

1) **严格 ID-only**：所有类别内的成员必须使用输入条目的 ID（例如："standard_1" 或 "check_10"），绝对不要在成员数组中返回完整名称、上下文或额外说明。
2) **层级子类强制化规则**：如果任何顶级类别包含超过 5 个成员，请务必在该类别下创建若干子类别（字段名："subcategories"，可递归），直至每个子类别的成员数量不超过 5。子类别名称要简洁、描述性强（建议 4-12 字）。
3) **不要返回空类别**：若某类别的 standard/check 均为空，请省略该类别。
4) **输出格式严格性**：仅返回纯 JSON 对象，顶层为若干类别键；每个类别对象必须包含至少一个 of: "standard", "check" 或 "subcategories"。示例中可选包含 "subcategories"（递归结构）。不要包含 code fences、解释性文字或其它非 JSON 内容。
5) **排序/确定性**：请尽量把更通用的父类放在前面（模型会尽力但非强制），并确保 JSON 可直接解析。

示例返回格式（务必仅做模板参考，仍然使用 ID-only）：
{
  "工资福利支出": {
    "standard": ["standard_61","standard_62"],
    "check": ["check_10"],
    "subcategories": {
      "基本工资": { "standard": ["standard_96"], "check": [] },
      "社会保障": { "standard": ["standard_66","standard_68"], "check": ["check_11"] }
    }
  },
  "物资采购": {
    "standard": ["standard_50","standard_51"],
    "check": ["check_34"]
  }
}

标准表条目（仅作示例）：
${formatIdLines(standardEntries)}

待核对表条目（仅作示例）：
${formatIdLines(checkEntries)}

请严格按照上述要求输出，若不能严格遵守则返回错误信息（但不要在最终输出中包含错误信息或非 JSON 文本）。
`;
  }

  /**
   * 构建总结Prompt
   */
  private static buildSummaryPrompt(categories: CategoryData): string {
    const categorySummary = Object.entries(categories).map(([categoryName, data]) => {
      const standardTotal = data.totalStandard;
      const checkTotal = data.totalCheck;
      const difference = data.difference;
      const status = data.status;

      return `${categoryName}：
  - 标准表总金额：${standardTotal.toLocaleString()}元
  - 待核对表总金额：${checkTotal.toLocaleString()}元
  - 差异：${difference.toLocaleString()}元
  - 状态：${status === 'match' ? '一致' : status === 'mismatch' ? '不一致' : '缺失'}`;
    }).join('\n\n');

    return `
基于以下财务分类数据，请生成一份专业的财务对账总结报告：

${categorySummary}

请在总结报告中包含以下内容：
1. 整体对账情况概述
2. 各分类的对比分析
3. 异常情况说明（差异过大或缺失的项目）
4. 建议和结论

请用专业、简洁的语言撰写总结报告，直接输出报告内容。
`;
  }

  /**
   * 解析分类API响应
   */
  private static parseClassificationResponse(
    content: string,
    standardEntries: Entry[],
    checkEntries: Entry[]
  ): ClassificationResult {
    try {
      // 尝试提取并清洗 JSON 内容（处理 code fence / 前后说明 等常见情况）
      const extractJsonLikeString = (text: string): string | null => {
        if (!text) return null;
        // 去除 ```json 或 ``` 包裹
        const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (fencedMatch && fencedMatch[1]) text = fencedMatch[1];

        // 优先匹配第一个完整的花括号块
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch && braceMatch[0]) return braceMatch[0];

        // 尝试由首个 { 到最后一个 } 截取
        const first = text.indexOf('{');
        const last = text.lastIndexOf('}');
        if (first !== -1 && last !== -1 && last > first) return text.substring(first, last + 1);

        return null;
      };

      const rawContent = String(content || '');
      // 记录原始响应以便离线分析
      try { (globalThis as any).__LAST_CLASSIFY_RAW = rawContent; } catch (e) {}

      const jsonStr = extractJsonLikeString(rawContent);
      if (!jsonStr) {
        // 如果未能直接提取 JSON，尝试查找仅包含类别对象的情况（例如模型直接返回了一个带 categories 字段的包装对象）
        const categoriesMatch = rawContent.match(/"categories"\s*:\s*\{[\s\S]*\}/);
        if (categoriesMatch && categoriesMatch[0]) {
          // 尝试把 categories 对象前后补全为完整 JSON
          const reconstructed = `{${categoriesMatch[0]}}`;
          try {
            const parsedWrapped = JSON.parse(reconstructed);
            // 解析成功，采用 parsedWrapped.categories 作为 parsed 对象
            const parsed = parsedWrapped.categories ?? parsedWrapped;
            return this._convertParsedToResult(parsed, standardEntries, checkEntries, rawContent);
          } catch (e) {
            // 继续下方统一错误处理
          }
        }

        throw new Error('无法解析API响应为JSON格式');
      }

      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        // 简单清理：移除尾随逗号后再试
        const cleaned = jsonStr.replace(/,\s*([}\]])/g, '$1');
        try {
          parsed = JSON.parse(cleaned);
          console.warn('解析AI分类响应时发现非法JSON，已尝试尾随逗号修复');
        } catch (e2) {
          // 如果仍然失败，抛出以触发回退
          throw e2;
        }
      }

      // 将解析并转换为结果的逻辑拆出，便于在尝试不同 parsed 结构时复用
      return this._convertParsedToResult(parsed, standardEntries, checkEntries, rawContent);
    } catch (error) {
      // 记录并回退到未分类策略
      try { console.error('解析分类响应失败:', error); } catch (e) {}
      try { console.error('无法解析的AI响应内容（已截断）:', String(content).slice(0, 2000)); } catch (e) {}

      try {
        const allStandard = standardEntries || [];
        const allCheck = checkEntries || [];
        const totalStandard = allStandard.reduce((sum, entry) => sum + entry.amount, 0);
        const totalCheck = allCheck.reduce((sum, entry) => sum + entry.amount, 0);
        const categories: CategoryData = {
          '未分类': {
            standard: allStandard,
            check: allCheck,
            totalStandard,
            totalCheck,
            difference: Math.abs(totalStandard - totalCheck),
            status: 'mismatch'
          }
        };

        const result: any = {
          categories,
          summary: 'AI返回格式异常，已回退为未分类，请检查AI响应或日志以获取更多信息。',
          source: 'fallback'
        };

        try { (globalThis as any).__LAST_CLASSIFY_RESULT = result; } catch (e) {}

        return result;
      } catch (fallbackErr) {
        console.error('回退生成未分类失败:', fallbackErr);
        throw new Error(`分类结果解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }
  }

  /**
   * 将解析后的中间结构转换为 ClassificationResult
   */
  private static _convertParsedToResult(parsed: any, standardEntries: Entry[], checkEntries: Entry[], rawContent?: string) {
    // 兼容两种主要格式：
    // 1) 直接的 categories 对象：{ "类别": { standard: ["standard_1"], check: ["check_2"] }, ... }
    // 2) 模型可能返回以每类数组包含描述字符串（之前的实现），需要解析 description

    const categories: CategoryData = {};

    // 递归遍历解析结果，支持 subcategories 嵌套结构，并将子类别展平为名为 "父/子" 的键
    const walkAndCollect = (node: any, prefix: string | null = null) => {
      if (!node || typeof node !== 'object') return;
      for (const [categoryName, categoryData] of Object.entries(node)) {
        if (!categoryName) continue;

        const catData = categoryData as any;
        const standard: Entry[] = [];
        const check: Entry[] = [];

        // 解析 standard 列表（支持 ID-only 或描述字符串）
        if (Array.isArray(catData.standard)) {
          for (const item of catData.standard) {
            if (typeof item !== 'string') continue;
            let entry: Entry | null = null;
            const idMatch = String(item).trim().match(/(standard_|check_)\w+/i);
            if (idMatch) {
              const id = idMatch[0];
              entry = standardEntries.find(e => e.id === id) ?? null;
            }
            if (!entry) entry = this.findEntryByDescription(standardEntries, item) || this.findEntryByContext(standardEntries, item);
            if (entry) standard.push(entry);
          }
        }

        // 解析 check 列表
        if (Array.isArray(catData.check)) {
          for (const item of catData.check) {
            if (typeof item !== 'string') continue;
            let entry: Entry | null = null;
            const idMatch = String(item).trim().match(/(standard_|check_)\w+/i);
            if (idMatch) {
              const id = idMatch[0];
              entry = checkEntries.find(e => e.id === id) ?? null;
            }
            if (!entry) entry = this.findEntryByDescription(checkEntries, item) || this.findEntryByContext(checkEntries, item);
            if (entry) check.push(entry);
          }
        }

        const totalStandard = standard.reduce((sum, entry) => sum + entry.amount, 0);
        const totalCheck = check.reduce((sum, entry) => sum + entry.amount, 0);
        const difference = Math.abs(totalStandard - totalCheck);

        let status: 'match' | 'mismatch' | 'missing' = 'missing';
        if (standard.length > 0 && check.length > 0) {
          status = difference < 0.01 ? 'match' : 'mismatch';
        } else if (standard.length > 0 || check.length > 0) {
          status = 'missing';
        }

        const fullName = prefix ? `${prefix}/${categoryName}` : categoryName;
        categories[fullName] = {
          standard,
          check,
          totalStandard,
          totalCheck,
          difference,
          status,
        };

        // 递归处理可能存在的子类别
        if (catData.subcategories && typeof catData.subcategories === 'object') {
          walkAndCollect(catData.subcategories, fullName);
        }
      }
    };

    walkAndCollect(parsed, null);

    // 补上未分类
    const classifiedStandardIds = new Set(Object.values(categories).flatMap(cat => cat.standard.map(e => e.id)));
    const classifiedCheckIds = new Set(Object.values(categories).flatMap(cat => cat.check.map(e => e.id)));

    const unclassifiedStandard = standardEntries.filter(e => !classifiedStandardIds.has(e.id));
    const unclassifiedCheck = checkEntries.filter(e => !classifiedCheckIds.has(e.id));

    if (unclassifiedStandard.length > 0 || unclassifiedCheck.length > 0) {
      categories['未分类'] = {
        standard: unclassifiedStandard,
        check: unclassifiedCheck,
        totalStandard: unclassifiedStandard.reduce((sum, e) => sum + e.amount, 0),
        totalCheck: unclassifiedCheck.reduce((sum, e) => sum + e.amount, 0),
        difference: Math.abs(unclassifiedStandard.reduce((sum, e) => sum + e.amount, 0) - unclassifiedCheck.reduce((sum, e) => sum + e.amount, 0)),
        status: 'mismatch',
      };
    }

    const result: any = {
      categories,
      summary: this.generateClassificationSummary(categories),
      source: 'ai'
    };

    try { (globalThis as any).__LAST_CLASSIFY_RESULT = result; } catch (e) {}

    // 诊断日志：记录 parsed keys 与原始响应大小，便于排查截断问题
    try { console.log('AI分类解析完成，类别数量:', Object.keys(categories).length, 'rawContentLen:', rawContent ? String(rawContent).length : 0); } catch (e) {}

    return result;
  }

  /**
   * 根据描述找到条目
   */
  private static findEntryByDescription(entries: Entry[], description: string): Entry | null {
    // 解析描述格式："条目名称:金额"
    const colonIndex = description.lastIndexOf(':');
    if (colonIndex === -1) return null;

    const name = description.substring(0, colonIndex).trim();
    const amountStr = description.substring(colonIndex + 1).trim();

    // 移除货币符号和单位
    const cleanAmountStr = amountStr.replace(/[元¥]/g, '').trim();
    const amount = parseFloat(cleanAmountStr);

    if (isNaN(amount)) return null;

    // 找到匹配的条目（名称相似且金额相同）
    return entries.find(entry =>
      (entry.name.includes(name) || name.includes(entry.name)) &&
      Math.abs(entry.amount - amount) < 0.01
    ) || null;
  }

  /**
   * 基于描述字符串尝试使用 entry.contextText 进行模糊匹配
   */
  private static findEntryByContext(entries: Entry[], description: string): Entry | null {
    try {
      const colonIndex = description.lastIndexOf(':');
      const descName = colonIndex === -1 ? description.trim() : description.substring(0, colonIndex).trim();

      // 首先尝试在 contextText 中包含描述名称的条目
      const byContext = entries.find(e => e.contextText && e.contextText.includes(descName));
      if (byContext) return byContext;

      // 其次尝试名称或上下文包含关键短语
      for (const e of entries) {
        if (e.name && descName && (e.name.includes(descName) || descName.includes(e.name))) return e;
        if (e.contextText && descName && e.contextText.includes(descName)) return e;
      }

      return null;
    } catch (error) {
      console.error('基于context匹配条目失败:', error);
      return null;
    }
  }

  /**
   * 生成分类总结
   */
  private static generateClassificationSummary(categories: CategoryData): string {
    const totalCategories = Object.keys(categories).length;
    const matchCategories = Object.values(categories).filter(cat => cat.status === 'match').length;
    const mismatchCategories = Object.values(categories).filter(cat => cat.status === 'mismatch').length;
    const missingCategories = Object.values(categories).filter(cat => cat.status === 'missing').length;

    return `AI已将财务条目分为${totalCategories}个类别。其中：
- ${matchCategories}个类别金额完全一致
- ${mismatchCategories}个类别存在金额差异
- ${missingCategories}个类别数据缺失

建议人工检查存在差异的类别，并调整分类结果以获得更准确的对账结果。`;
  }

  /**
   * 验证API Key格式
   */
  static validateApiKey(apiKey: string): boolean {
    return apiKey.startsWith('sk-') && apiKey.length >= 30 && apiKey.length <= 200;
  }

  /**
   * 构建列含义推断Prompt
   */
  private static buildColumnInferencePrompt(dataRows: any[][]): string {
    // 分析前几行数据来推断列含义
    const rowsToAnalyze = dataRows.slice(0, Math.min(8, dataRows.length));
    const columnCount = dataRows[0]?.length || 0;

    const columnAnalysis = [];
    for (let colIndex = 0; colIndex < columnCount; colIndex++) {
      const columnData = rowsToAnalyze.map(row => row[colIndex]);
      const nonEmptyCells = columnData.filter(cell => cell != null && String(cell).trim() !== '');
      const numericCells = columnData.filter(cell => !isNaN(Number(cell)) && String(cell).trim() !== '');
      const textCells = columnData.filter(cell => cell != null && String(cell).trim() !== '' && isNaN(Number(cell)));

      // 获取一些示例值
      const sampleValues = nonEmptyCells.slice(0, 3).map(cell => String(cell).trim());

      columnAnalysis.push(`列${colIndex + 1}:
  示例值: ${sampleValues.join(', ')}
  统计: 非空${nonEmptyCells.length}, 数字${numericCells.length}, 文本${textCells.length}
  数字比例: ${(numericCells.length / nonEmptyCells.length * 100).toFixed(1)}%`);
    }

    return `
请分析以下数据列的特征，为每列推断出最可能的含义和列名。

数据总行数：${rowsToAnalyze.length}
列数：${columnCount}

各列数据分析：
${columnAnalysis.join('\n\n')}

请根据每列的数据特征推断其含义。对于财务对账数据，常见的列类型包括：
- 名称列：包含项目名称、摘要、描述等文本信息
- 金额列：包含数字金额，通常是数值类型
- 日期列：包含日期信息
- 编号列：包含ID、序号等
- 其他列：根据具体内容判断

请为每列返回推断结果：
[
  {
    "columnIndex": 列索引（从0开始）,
    "inferredName": "推断的列名",
    "confidence": 0.0-1.0之间的置信度,
    "dataType": "数据类型：'text' | 'number' | 'date' | 'id' | 'other'"
  },
  ...
]

只返回JSON数组，不要包含其他说明文字。
`;
  }

  /**
   * 解析列含义推断响应
   */
  private static parseColumnInferenceResponse(content: string): Array<{ columnIndex: number; inferredName: string; confidence: number; dataType: string }> {
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('无法解析列含义推断响应为JSON格式');
      }

      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed)) {
        throw new Error('列含义推断响应不是数组格式');
      }

      const result = parsed.map((item: any) => ({
        columnIndex: item.columnIndex ?? 0,
        inferredName: item.inferredName || `列${(item.columnIndex ?? 0) + 1}`,
        confidence: item.confidence ?? 0,
        dataType: item.dataType || 'other'
      }));

      console.log('AI列含义推断结果:', result);

      return result;
    } catch (error) {
      console.error('解析列含义推断响应失败:', error);
      throw new Error(`列含义推断结果解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 构建标题行检测Prompt
   */
  private static buildHeaderRowDetectionPrompt(worksheetData: any[][]): string {
    // 分析前10行数据，避免数据过大
    const rowsToAnalyze = worksheetData.slice(0, Math.min(10, worksheetData.length));
    const totalRows = worksheetData.length;

    const formatRows = rowsToAnalyze.map((row, index) => {
      const nonEmptyCells = row.filter(cell => cell != null && String(cell).trim() !== '');
      const numericCells = row.filter(cell => !isNaN(Number(cell)));
      const textCells = row.filter(cell => cell != null && String(cell).trim() !== '' && isNaN(Number(cell)));

      return `第${index + 1}行: ${row.map((cell, colIndex) =>
        `列${colIndex + 1}:${cell != null ? String(cell).trim() : '(空)'}`
      ).join(', ')}
      [统计: 非空${nonEmptyCells.length}, 数字${numericCells.length}, 文本${textCells.length}]`;
    }).join('\n');

    return `
请分析以下Excel工作表数据，找出最可能是标题行（列名行）的那一行。

工作表总行数：${totalRows}
分析的行数：${rowsToAnalyze.length}

各行数据详情：
${formatRows}

请根据以下标准判断哪一行最可能是标题行：
1. 标题行通常包含列名，如"名称"、"金额"、"日期"等描述性文字
2. 标题行通常没有或很少有纯数字
3. 标题行各列通常都有内容（非空）
4. 标题行通常在工作表的前几行
5. 数据行通常包含具体的值，而标题行包含字段名称

请返回JSON格式的结果：
{
  "headerRowIndex": 行索引数字（从0开始）,
  "reason": "选择该行的理由",
  "confidence": 0.0-1.0之间的置信度,
  "rowType": "标题行类型：'明确的列名行' | '推断的列名行' | '无标题行'"
}

如果认为整个工作表都没有明确的标题行，返回：
{
  "headerRowIndex": -1,
  "reason": "整个工作表都没有明确的标题行",
  "confidence": 0.0,
  "rowType": "无标题行"
}

只返回JSON格式的结果，不要包含其他说明文字。
`;
  }

  /**
   * 解析标题行检测响应
   */
  private static parseHeaderRowDetectionResponse(content: string): { headerRowIndex: number; reason: string; confidence: number } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析标题行检测响应为JSON格式');
      }

      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      const headerRowIndex = parsed.headerRowIndex ?? -1;
      const reason = parsed.reason || '';
      const confidence = parsed.confidence || 0;

      console.log('AI标题行检测结果:', {
        detectedHeaderRowIndex: headerRowIndex,
        reason,
        confidence,
        rowType: parsed.rowType
      });

      return { headerRowIndex, reason, confidence };
    } catch (error) {
      console.error('解析标题行检测响应失败:', error);
      throw new Error(`标题行检测结果解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 构建名称列检测Prompt
   */
  private static buildNameColumnDetectionPrompt(headers: string[], sampleData: any[][]): string {
    // 获取前几行的示例数据（最多5行，避免数据过大）
    const sampleRows = sampleData.slice(1, Math.min(6, sampleData.length)); // 跳过标题行

    const formatSampleData = sampleRows.map((row, index) => {
      const rowData = headers.map((header, colIndex) => {
        const cellValue = row[colIndex];
        return `${colIndex}:${header}: ${cellValue != null ? cellValue : '(空)'}`;
      });
      return `第${index + 1}行: ${rowData.join(', ')}`;
    }).join('\n');

    return `
请分析以下Excel表格数据，找出最可能包含名称信息的所有列，并提供组合规则。

表格列名：
${headers.map((header, index) => `${index}: "${header}"`).join('\n')}

示例数据（前${sampleRows.length}行）：
${formatSampleData}

请根据以下标准分析名称列：
1. 列名特征：包含"名称"、"项目"、"摘要"、"描述"、"内容"、"事项"、"科目"等关键词
2. 数据特征：通常是文本型数据，包含描述性信息
3. 业务逻辑：财务数据中的名称列通常描述交易的主体、项目或事项

请判断是否需要组合多个列来形成完整的名称描述。例如：
- 如果有"项目名称"和"项目类型"两列，可能需要组合为"项目类型-项目名称"
- 如果有"科目"和"明细"两列，可能需要组合为"科目:明细"

请返回JSON格式的结果：
{
  "columnIndices": [列的索引数字数组],
  "combinationRule": "组合规则描述，如：'直接使用单列' 或 '组合格式：{列A}-{列B}' 或 '组合格式：{列A}({列B})'",
  "reason": "选择这些列和组合规则的理由",
  "confidence": 0.0-1.0之间的置信度
}

如果没有找到合适的名称列，请返回：
{
  "columnIndices": [],
  "combinationRule": "",
  "reason": "未找到合适的名称列",
  "confidence": 0.0
}

只返回JSON格式的结果，不要包含其他说明文字。
`;
  }

  /**
   * 解析名称列检测响应
   */
  private static parseNameColumnDetectionResponse(content: string, headers: string[]): { columnIndices: number[]; combinationRule: string } {
    try {
      // 尝试提取JSON内容
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析名称列检测响应为JSON格式');
      }

      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      const columnIndices = parsed.columnIndices || [];
      const combinationRule = parsed.combinationRule || '';
      const confidence = parsed.confidence || 0;

      console.log('AI名称列检测结果:', {
        detectedColumnIndices: columnIndices,
        detectedColumnNames: columnIndices.map((idx: number) => headers[idx]),
        combinationRule,
        confidence,
        reason: parsed.reason
      });

      // 如果置信度太低，返回空结果
      if (confidence < 0.3 || columnIndices.length === 0) {
        console.log('AI检测置信度过低，使用传统方法');
        return { columnIndices: [], combinationRule: '' };
      }

      return { columnIndices, combinationRule };
    } catch (error) {
      console.error('解析名称列检测响应失败:', error);
      throw new Error(`名称列检测结果解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 构建金额列检测Prompt
   */
  private static buildAmountDetectionPrompt(headers: string[], sampleData: any[][]): string {
    // 获取前几行的示例数据（最多5行，避免数据过大）
    const sampleRows = sampleData.slice(1, Math.min(6, sampleData.length)); // 跳过标题行

    const formatSampleData = sampleRows.map((row, index) => {
      const rowData = headers.map((header, colIndex) => {
        const cellValue = row[colIndex];
        return `${header}: ${cellValue != null ? cellValue : '(空)'}`;
      });
      return `第${index + 1}行: ${rowData.join(', ')}`;
    }).join('\n');

    return `
请分析以下Excel表格数据，找出最可能包含金额信息的列。

表格列名：
${headers.map((header, index) => `${index}: "${header}"`).join('\n')}

示例数据（前${sampleRows.length}行）：
${formatSampleData}

请根据以下标准判断哪一列最可能是金额列：
1. 数据类型：通常是数字格式
2. 列名特征：包含"金额"、"价格"、"价值"、"费用"等关键词
3. 数据特征：通常是数值，可能是正数或负数，包含小数点
4. 业务逻辑：财务数据中的金额列通常具有数值特征

请返回JSON格式的结果：
{
  "amountColumnIndex": 列的索引数字,
  "reason": "选择该列的理由",
  "confidence": 0.0-1.0之间的置信度
}

如果没有找到合适的金额列，请返回：
{
  "amountColumnIndex": -1,
  "reason": "未找到合适的金额列",
  "confidence": 0.0
}

只返回JSON格式的结果，不要包含其他说明文字。
`;
  }

  /**
   * 解析金额列检测响应
   */
  private static parseAmountDetectionResponse(content: string, headers: string[]): number {
    try {
      // 尝试提取JSON内容
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析金额列检测响应为JSON格式');
      }

      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      const columnIndex = parsed.amountColumnIndex;
      const confidence = parsed.confidence || 0;

      console.log('AI金额列检测结果:', {
        detectedColumnIndex: columnIndex,
        detectedColumnName: columnIndex >= 0 ? headers[columnIndex] : '未找到',
        confidence,
        reason: parsed.reason
      });

      // 如果置信度太低，返回-1
      if (confidence < 0.3) {
        console.log('AI检测置信度过低，使用传统方法');
        return -1;
      }

      return columnIndex;
    } catch (error) {
      console.error('解析金额列检测响应失败:', error);
      throw new Error(`金额列检测结果解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * AI智能识别标题行位置
   */
  static async detectHeaderRow(
    worksheetData: any[][],
    apiKey: string
  ): Promise<{ headerRowIndex: number; reason: string; confidence: number }> {
    const prompt = this.buildHeaderRowDetectionPrompt(worksheetData);

    try {
      const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的数据分析师，擅长分析Excel表格结构，识别标题行位置。请根据数据特征和业务逻辑判断哪一行最可能是列名行。',
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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`标题行检测失败: ${response.status} ${response.statusText}\n${errorData.error?.message || ''}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('标题行检测返回内容为空');
      }

      return this.parseHeaderRowDetectionResponse(content);
    } catch (error) {
      console.error('AI标题行检测失败:', error);
      throw error;
    }
  }

  /**
   * AI智能识别和组合名称列
   */
  static async detectAndCombineNameColumns(
    headers: string[],
    sampleData: any[][],
    apiKey: string
  ): Promise<{ columnIndices: number[]; combinationRule: string }> {
    const prompt = this.buildNameColumnDetectionPrompt(headers, sampleData);

    try {
      const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的数据分析师，擅长识别财务数据中的名称列，并能智能组合多个列的信息来形成完整的名称描述。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1, // 很低的温度以获得确定性的结果
          max_tokens: 800,
          top_p: 0.8,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`名称列检测失败: ${response.status} ${response.statusText}\n${errorData.error?.message || ''}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('名称列检测返回内容为空');
      }

      return this.parseNameColumnDetectionResponse(content, headers);
    } catch (error) {
      console.error('AI名称列检测失败:', error);
      throw error;
    }
  }

  /**
   * AI智能识别金额列
   */
  static async detectAmountColumn(
    headers: string[],
    sampleData: any[][],
    apiKey: string
  ): Promise<number> {
    const prompt = this.buildAmountDetectionPrompt(headers, sampleData);

    try {
      const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的数据分析师，擅长识别财务数据中的金额列。请分析表格结构和数据特征，找出最可能包含金额信息的列。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1, // 很低的温度以获得确定性的结果
          max_tokens: 500,
          top_p: 0.8,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`金额列检测失败: ${response.status} ${response.statusText}\n${errorData.error?.message || ''}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('金额列检测返回内容为空');
      }

      return this.parseAmountDetectionResponse(content, headers);
    } catch (error) {
      console.error('AI金额列检测失败:', error);
      throw error;
    }
  }

  /**
   * AI根据数据内容推断列含义（当没有明确的列名时）
   */
  static async inferColumnMeanings(
    dataRows: any[][],
    apiKey: string
  ): Promise<Array<{ columnIndex: number; inferredName: string; confidence: number; dataType: string }>> {
    const prompt = this.buildColumnInferencePrompt(dataRows);

    try {
      const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的数据分析师，擅长根据数据内容推断列的含义。请分析每列的数据特征，推断出最可能的列名和数据类型。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 1000,
          top_p: 0.8,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`列含义推断失败: ${response.status} ${response.statusText}\n${errorData.error?.message || ''}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('列含义推断返回内容为空');
      }

      return this.parseColumnInferenceResponse(content);
    } catch (error) {
      console.error('AI列含义推断失败:', error);
      throw error;
    }
  }

  /**
   * AI全文件内容分析，选择名称列和金额列，并返回简化后的文件数据
   */
  static async analyzeAndSelectColumns(
    fileData: any[][],
    apiKey: string
  ): Promise<SimplifiedFileData> {
    const prompt = this.buildColumnSelectionPrompt(fileData);

    try {
      const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的数据分析师，擅长分析Excel表格数据，识别财务数据中的名称列和金额列。请根据整个文件的内容特征，准确识别最合适的列。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1, // 很低的温度以获得确定性的结果
          max_tokens: 800,
          top_p: 0.8,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`列选择分析失败: ${response.status} ${response.statusText}\n${errorData.error?.message || ''}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('列选择分析返回内容为空');
      }

      return this.parseColumnSelectionResponse(content);
    } catch (error) {
      console.error('AI列选择分析失败:', error);
      throw error;
    }
  }

  /**
   * 构建列选择分析Prompt
   */
  private static buildColumnSelectionPrompt(fileData: any[][]): string {
    // 限制数据量，避免token过大
    const maxRows = 20; // 最多分析20行数据
    const dataToAnalyze = fileData.slice(0, maxRows);

    const formatData = dataToAnalyze.map((row, index) => {
      const rowData = row.map((cell, colIndex) => {
        const cellValue = cell != null ? String(cell).trim() : '(空)';
        return `列${colIndex + 1}: ${cellValue}`;
      });
      return `第${index + 1}行: ${rowData.join(', ')}`;
    }).join('\n');

    return `
请分析以下Excel文件的所有数据，找出最合适的名称列和金额列。

文件数据总览：
- 总行数：${fileData.length}
- 总列数：${fileData[0]?.length || 0}
- 分析的行数：${dataToAnalyze.length}

完整数据内容：
${formatData}

请根据以下标准分析：

名称列特征：
1. 通常包含文本描述，如项目名称、摘要、科目、交易类型等
2. 列名可能包含：名称、项目、摘要、描述、内容、事项、科目、类型等关键词
3. 数据通常是描述性的文本，不是纯数字
4. 同一列中通常有不同的值（非重复数据）

金额列特征：
1. 通常包含数值数据，表示金额、价格、价值等
2. 列名可能包含：金额、价格、价值、费用、数额等关键词
3. 数据通常是数字格式，可能包含小数点、正负号
4. 数值范围合理（财务数据通常不会是极大或极小值）

请综合分析整个文件的数据模式，返回最合适的列索引，并生成简化后的文件数据。

返回JSON格式的结果：
{
  "nameColumnIndex": 名称列的索引数字（从0开始），
  "amountColumnIndex": 金额列的索引数字（从0开始），
  "confidence": 0.0-1.0之间的置信度，
  "reasoning": "选择这些列和生成简化数据的详细理由",
  "simplifiedData": [
    ["名称", "金额"],  // 第一行是标题行
    ["项目A", "100.00"],  // 后续行是从原始数据中提取的名称和金额
    ["项目B", "200.00"],
    // ... 其他数据行
  ]
}

如果无法确定合适的列，请返回：
{
  "nameColumnIndex": -1,
  "amountColumnIndex": -1,
  "confidence": 0.0,
  "reasoning": "无法确定合适的列",
  "simplifiedData": []
}

简化数据说明：
- simplifiedData的第一行应该是["名称", "金额"]作为标题
- 后续行应该只包含从原始数据中提取的名称和金额值
- 确保数据格式正确，金额应该是数字或字符串格式
- 只提取有效的数据行，跳过空行或无效行
- 如果原始数据有问题或无法提取，请在reasoning中说明

只返回JSON格式的结果，不要包含其他说明文字。
`;
  }

  /**
   * 使用AI对多列文本进行语义汇总，批量生成每行的简短名称
   * @param headers 标题数组
   * @param columnIndices 参与汇总的列索引数组
   * @param rows 每项为对应列的文本数组（例如：[ [col2row1, col5row1], [col2row2, col5row2], ... ]）
   * @param apiKey DeepSeek API Key
   * @param batchSize 每次请求的最大样本数（默认100）
   * @returns 与 rows 等长的字符串数组，AI失败或无结果时对应项为空字符串
   */
  static async summarizeRowsForNameGeneration(
    headers: string[],
    columnIndices: number[],
    rows: string[][],
    apiKey: string,
    batchSize = 100,
    maxSamples = 500,
    perRequestTimeoutMs = 15000
  ): Promise<string[]> {
    // 返回数组初始化
    if (!rows || rows.length === 0) return [];

    try {
      // 规范化每行的样本为单个字符串，用分隔符连接，便于去重和批量请求
      const samples = rows.map(r => r.map(c => String(c || '').replace(/\s+/g, ' ').trim()).join(' || '));

      // 去重并记录原始索引映射
      const sampleToIndexes = new Map<string, number[]>();
      samples.forEach((s, idx) => {
        const key = s || '__EMPTY__';
        const arr = sampleToIndexes.get(key) || [];
        arr.push(idx);
        sampleToIndexes.set(key, arr);
      });

      const uniqueSamples = Array.from(sampleToIndexes.keys());

      // 限制样本数量以防止过多的AI调用导致阻塞
      if (uniqueSamples.length > maxSamples) {
        console.warn(`样本数(${uniqueSamples.length})超过最大允许值(${maxSamples})，仅对前${maxSamples}个样本使用AI，其余使用本地回退策略`);
      }

      // 准备结果映射 uniqueSample -> summary
      const sampleToSummary = new Map<string, string>();

      // 分批请求AI（仅对不超过 maxSamples 的样本）
      for (let i = 0; i < Math.min(uniqueSamples.length, maxSamples); i += batchSize) {
        const batch = uniqueSamples.slice(i, i + batchSize);

        const columnNames = columnIndices.map(idx => headers[idx] ?? `列${idx + 1}`).join(', ');

        const userPrompt = `你是一个中文数据清洗与摘要助手。给定若干行来自同一表格的多列候选文本（每行以 ' || ' 分隔多个列的值），请为每行生成一个简洁且具描述性的中文名称（6-12个字为宜），去除金额、单位、日期与明显噪声，仅保留代表性实体或用途。不要添加额外注释，只以JSON数组的形式返回与输入顺序对应的字符串数组。列名: ${columnNames}\n\n输入示例:\n${batch.map(s => JSON.stringify(s)).join('\n')}`;

        // 使用 AbortController 实现请求超时，避免长时间挂起
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), perRequestTimeoutMs);

        let response: Response;
        try {
          response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                { role: 'system', content: '你是一个专业的数据清洗助手，善于从多列文本中提取短名称。' },
                { role: 'user', content: userPrompt }
              ],
              temperature: 0.0,
              max_tokens: 800,
              top_p: 0.9,
            }),
            signal: controller.signal,
          });
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          console.error('AI行级摘要请求发生错误或超时:', fetchErr);
          // 标记这批样本为空，以便调用方回退
          batch.forEach(s => sampleToSummary.set(s, ''));
          continue;
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          console.error('AI行级摘要请求失败，状态：', response.status);
          batch.forEach(s => sampleToSummary.set(s, ''));
          continue;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // 尝试从返回文本中解析JSON数组
        try {
          const jsonMatch = content.match(/\[([\s\S]*)\]/);
          if (!jsonMatch) {
            // 解析失败，记录空
            console.error('AI返回未按JSON数组格式响应行级摘要:', content);
            batch.forEach(s => sampleToSummary.set(s, ''));
            continue;
          }

          const jsonStr = jsonMatch[0];
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed) && parsed.length === batch.length) {
            for (let j = 0; j < batch.length; j++) {
              const sampleKey = batch[j];
              const summary = String(parsed[j] || '').trim();
              sampleToSummary.set(sampleKey, summary);
            }
          } else {
            console.error('AI行级摘要返回数组长度与输入不匹配或解析出错', { parsed, batchLength: batch.length });
            batch.forEach(s => sampleToSummary.set(s, ''));
          }
        } catch (err) {
          console.error('解析AI行级摘要响应失败:', err, content);
          batch.forEach(s => sampleToSummary.set(s, ''));
        }
      }

      // 对于未被AI处理的样本（超过maxSamples），填充为空以便回退
      if (uniqueSamples.length > maxSamples) {
        const remaining = uniqueSamples.slice(maxSamples);
        remaining.forEach(s => sampleToSummary.set(s, ''));
      }

      // 将结果映射回原始行顺序
      const results: string[] = samples.map(s => sampleToSummary.get(s || '__EMPTY__') || '');
      return results;
    } catch (error) {
      console.error('summarizeRowsForNameGeneration失败:', error);
      // 出现任何异常，回退为全空数组，调用方将使用本地合并逻辑
      return rows.map(() => '');
    }
  }

  /**
   * 解析列选择响应
   */
  private static parseColumnSelectionResponse(content: string): SimplifiedFileData {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析列选择响应为JSON格式');
      }

      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      const result: SimplifiedFileData = {
        simplifiedData: parsed.simplifiedData || [],
        originalMapping: {
          nameColumnIndex: parsed.nameColumnIndex ?? -1,
          amountColumnIndex: parsed.amountColumnIndex ?? -1,
          originalHeaders: [], // 这个会在调用处填充
        },
        confidence: parsed.confidence ?? 0,
        reasoning: parsed.reasoning || '无详细理由',
        dataRowsCount: parsed.simplifiedData ? Math.max(0, parsed.simplifiedData.length - 1) : 0, // 减去标题行
      };

      console.log('AI列选择和简化数据分析结果:', {
        nameColumnIndex: result.originalMapping.nameColumnIndex,
        amountColumnIndex: result.originalMapping.amountColumnIndex,
        simplifiedRows: result.dataRowsCount,
        confidence: result.confidence,
        reasoning: result.reasoning
      });

      return result;
    } catch (error) {
      console.error('解析列选择响应失败:', error);
      throw new Error(`列选择结果解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 测试API连接
   */
  static async testConnection(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
