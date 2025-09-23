import type { Entry, CategoryData, ClassificationResult } from '../types';

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
          temperature: 0.3, // 较低的温度以获得更稳定的分类结果
          max_tokens: 2000,
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
    const formatEntries = (entries: Entry[]) => {
      return entries.map(entry =>
        `${entry.name}: ${entry.amount}元`
      ).join('\n');
    };

    return `
请根据以下财务条目的名称和金额特征，将相似的条目智能归类。

标准表条目：
${formatEntries(standardEntries)}

待核对表条目：
${formatEntries(checkEntries)}

请按照以下规则进行分类：
1. 根据条目名称的语义相似性进行归类（如：工资、薪资 → "工资类"）
2. 考虑金额特征（如：固定金额、变动金额）
3. 合并相似的类别，保持分类简洁合理
4. 每个类别名称要简洁明了

请以JSON格式返回分类结果：
{
  "类别名称1": {
    "standard": ["条目名称1:金额", "条目名称2:金额", ...],
    "check": ["条目名称A:金额", "条目名称B:金额", ...]
  },
  "类别名称2": {
    ...
  }
}

只返回JSON格式的结果，不要包含其他说明文字。
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
      // 尝试提取JSON内容
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析API响应为JSON格式');
      }

      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      // 转换为CategoryData格式
      const categories: CategoryData = {};

      for (const [categoryName, categoryData] of Object.entries(parsed)) {
        if (typeof categoryData !== 'object' || categoryData === null) continue;

        const catData = categoryData as any;
        const standard: Entry[] = [];
        const check: Entry[] = [];

        // 处理标准表条目
        if (Array.isArray(catData.standard)) {
          for (const item of catData.standard) {
            if (typeof item === 'string') {
              // 从标准表中找到匹配的条目
              const entry = this.findEntryByDescription(standardEntries, item);
              if (entry) standard.push(entry);
            }
          }
        }

        // 处理核对表条目
        if (Array.isArray(catData.check)) {
          for (const item of catData.check) {
            if (typeof item === 'string') {
              // 从核对表中找到匹配的条目
              const entry = this.findEntryByDescription(checkEntries, item);
              if (entry) check.push(entry);
            }
          }
        }

        // 计算总金额
        const totalStandard = standard.reduce((sum, entry) => sum + entry.amount, 0);
        const totalCheck = check.reduce((sum, entry) => sum + entry.amount, 0);
        const difference = Math.abs(totalStandard - totalCheck);

        // 判断状态
        let status: 'match' | 'mismatch' | 'missing' = 'missing';
        if (standard.length > 0 && check.length > 0) {
          status = difference < 0.01 ? 'match' : 'mismatch';
        }

        categories[categoryName] = {
          standard,
          check,
          totalStandard,
          totalCheck,
          difference,
          status,
        };
      }

      // 为未分类的条目创建"未分类"类别
      const classifiedStandardIds = new Set(
        Object.values(categories).flatMap(cat => cat.standard.map(e => e.id))
      );
      const classifiedCheckIds = new Set(
        Object.values(categories).flatMap(cat => cat.check.map(e => e.id))
      );

      const unclassifiedStandard = standardEntries.filter(e => !classifiedStandardIds.has(e.id));
      const unclassifiedCheck = checkEntries.filter(e => !classifiedCheckIds.has(e.id));

      if (unclassifiedStandard.length > 0 || unclassifiedCheck.length > 0) {
        categories['未分类'] = {
          standard: unclassifiedStandard,
          check: unclassifiedCheck,
          totalStandard: unclassifiedStandard.reduce((sum, e) => sum + e.amount, 0),
          totalCheck: unclassifiedCheck.reduce((sum, e) => sum + e.amount, 0),
          difference: Math.abs(
            unclassifiedStandard.reduce((sum, e) => sum + e.amount, 0) -
            unclassifiedCheck.reduce((sum, e) => sum + e.amount, 0)
          ),
          status: 'mismatch',
        };
      }

      return {
        categories,
        summary: this.generateClassificationSummary(categories),
      };
    } catch (error) {
      console.error('解析分类响应失败:', error);
      throw new Error(`分类结果解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
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
      entry.name.includes(name) || name.includes(entry.name) &&
      Math.abs(entry.amount - amount) < 0.01
    ) || null;
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
    return apiKey.startsWith('sk-') && apiKey.length > 20;
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
