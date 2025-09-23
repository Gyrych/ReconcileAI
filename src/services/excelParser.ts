import * as XLSX from 'xlsx';
import type { Entry, ParsedData } from '../types';

/**
 * 解析Excel文件并转换为结构化数据
 */
export class ExcelParser {
  /**
   * 解析单个Excel文件
   */
  static async parseFile(file: File, source: 'standard' | 'check'): Promise<Entry[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });

          // 获取第一个工作表
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // 转换为JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
          }) as any[][];

          // 解析为Entry数组
          const entries = this.parseJsonToEntries(jsonData, source);
          resolve(entries);
        } catch (error) {
          reject(new Error(`文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('文件读取失败'));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 同时解析两个文件
   */
  static async parseFiles(
    standardFile: File,
    checkFile: File
  ): Promise<ParsedData> {
    try {
      const [standard, check] = await Promise.all([
        this.parseFile(standardFile, 'standard'),
        this.parseFile(checkFile, 'check'),
      ]);

      return { standard, check };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 将JSON数组转换为Entry数组
   */
  private static parseJsonToEntries(
    jsonData: any[][],
    source: 'standard' | 'check'
  ): Entry[] {
    if (jsonData.length < 2) {
      throw new Error('Excel文件至少需要包含标题行和一行数据');
    }

    const entries: Entry[] = [];
    const headers = jsonData[0] as string[];

    // 查找必要的列索引
    const nameIndex = this.findColumnIndex(headers, ['name', '名称', '条目', '项目']);
    const amountIndex = this.findColumnIndex(headers, ['amount', '金额', '价值', '价格', '数额']);

    if (nameIndex === -1 || amountIndex === -1) {
      throw new Error('Excel文件必须包含"名称"和"金额"列');
    }

    // 从第二行开始处理数据
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const name = String(row[nameIndex] || '').trim();
      const amountStr = String(row[amountIndex] || '').trim();

      // 跳过空行
      if (!name && !amountStr) continue;

      // 解析金额
      const amount = this.parseAmount(amountStr);
      if (amount === null) {
        console.warn(`第${i + 1}行金额格式无效: ${amountStr}`);
        continue;
      }

      entries.push({
        id: `${source}_${i}`,
        name,
        amount,
        source,
        originalIndex: i,
      });
    }

    if (entries.length === 0) {
      throw new Error('文件中没有找到有效的数据行');
    }

    return entries;
  }

  /**
   * 查找列索引
   */
  private static findColumnIndex(headers: string[], keywords: string[]): number {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]?.toLowerCase().trim();
      if (keywords.some(keyword => header?.includes(keyword.toLowerCase()))) {
        return i;
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
