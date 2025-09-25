// 真实AI API调用测试 - 测试DeepSeek API调用

// 模拟的问题数据（基于用户遇到的问题）
const mockProblematicExcelData = [
  ['金额单位：元'],  // 标题行
  ['5000.00'],        // 数据行1
  ['1500.50'],        // 数据行2
  ['2000.00'],        // 数据行3
  ['1200.00'],        // 数据行4
  ['3000.00']         // 数据行5
];

// 模拟复合数据格式
const mockCompositeData = [
  ['项目名称'],           // 标题行
  ['员工工资:5000.00'],   // 复合数据行1
  ['办公用品:1500.50'],   // 复合数据行2
  ['房租:2000.00'],       // 复合数据行3
  ['水电费:1200.00'],     // 复合数据行4
  ['差旅费:3000.00']      // 复合数据行5
];

// 导入DeepSeek服务类（模拟）
class TestDeepSeekService {
  static API_BASE_URL = 'https://api.deepseek.com/v1';
  static MODEL = 'deepseek-chat';

  static validateApiKey(apiKey) {
    return apiKey.startsWith('sk-') && apiKey.length >= 30 && apiKey.length <= 200;
  }

  static async makeApiCall(prompt, apiKey, temperature = 0.1) {
    console.log('🔗 真实API调用开始...');
    console.log('📝 Prompt:', prompt.substring(0, 200) + '...');
    console.log('🌡️  Temperature:', temperature);
    console.log('🔑 API Key格式验证:', this.validateApiKey(apiKey) ? '✅ 有效' : '❌ 无效');

    if (!this.validateApiKey(apiKey)) {
      throw new Error('API Key格式无效，请检查API Key是否以sk-开头且长度在30-200字符之间');
    }

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
          temperature,
          max_tokens: 600,
          top_p: 0.8,
        }),
      });

      console.log('📡 API响应状态:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ API调用失败:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`API调用失败: ${response.status} ${response.statusText}\n${errorData.error?.message || ''}`);
      }

      const data = await response.json();
      console.log('✅ API调用成功');
      console.log('📊 Token使用情况:', {
        prompt_tokens: data.usage?.prompt_tokens,
        completion_tokens: data.usage?.completion_tokens,
        total_tokens: data.usage?.total_tokens
      });

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('API返回内容为空');
      }

      return content;
    } catch (error) {
      console.error('❌ API调用异常:', error);
      throw error;
    }
  }

  // 测试标题行检测
  static async testHeaderRowDetection(apiKey) {
    console.log('\n🧪 === 测试标题行检测 ===');

    const prompt = this.buildHeaderRowDetectionPrompt(mockProblematicExcelData);

    try {
      const response = await this.makeApiCall(prompt, apiKey);
      console.log('🤖 AI标题行检测结果:');
      console.log(response);

      const parsed = this.parseHeaderRowDetectionResponse(response);
      console.log('📋 解析后的结果:', parsed);

      return parsed;
    } catch (error) {
      console.error('标题行检测测试失败:', error.message);
      return null;
    }
  }

  // 测试名称列检测
  static async testNameColumnDetection(apiKey) {
    console.log('\n🧪 === 测试名称列检测 ===');

    const prompt = this.buildNameColumnDetectionPrompt(mockProblematicExcelData[0], mockProblematicExcelData);

    try {
      const response = await this.makeApiCall(prompt, apiKey);
      console.log('🤖 AI名称列检测结果:');
      console.log(response);

      const parsed = this.parseNameColumnDetectionResponse(response, mockProblematicExcelData[0]);
      console.log('📋 解析后的结果:', parsed);

      return parsed;
    } catch (error) {
      console.error('名称列检测测试失败:', error.message);
      return null;
    }
  }

  // 测试金额列检测
  static async testAmountColumnDetection(apiKey) {
    console.log('\n🧪 === 测试金额列检测 ===');

    const prompt = this.buildAmountDetectionPrompt(mockProblematicExcelData[0], mockProblematicExcelData);

    try {
      const response = await this.makeApiCall(prompt, apiKey);
      console.log('🤖 AI金额列检测结果:');
      console.log(response);

      const parsed = this.parseAmountDetectionResponse(response, mockProblematicExcelData[0]);
      console.log('📋 解析后的结果:', parsed);

      return parsed;
    } catch (error) {
      console.error('金额列检测测试失败:', error.message);
      return null;
    }
  }

  // 测试现有列分析
  static async testExistingColumnAnalysis(apiKey) {
    console.log('\n🧪 === 测试现有列分析 ===');

    const prompt = this.buildExistingColumnAnalysisPrompt(mockProblematicExcelData[0], mockProblematicExcelData);

    try {
      const response = await this.makeApiCall(prompt, apiKey);
      console.log('🤖 AI现有列分析结果:');
      console.log(response);

      const parsed = this.parseExistingColumnAnalysisResponse(response, mockProblematicExcelData[0]);
      console.log('📋 解析后的结果:', parsed);

      return parsed;
    } catch (error) {
      console.error('现有列分析测试失败:', error.message);
      return null;
    }
  }

  // 构建标题行检测Prompt（从excelParser.ts复制）
  static buildHeaderRowDetectionPrompt(worksheetData) {
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

只返回JSON格式的结果，不要包含其他说明文字。`;
  }

  // 构建名称列检测Prompt
  static buildNameColumnDetectionPrompt(headers, sampleData) {
    const sampleRows = sampleData.slice(1, Math.min(6, sampleData.length));

    return `
请分析以下Excel表格数据，找出最可能包含名称信息的所有列...

表格列名：
${headers.map((header, index) => `${index}: "${header}"`).join('\n')}

示例数据（前${sampleRows.length}行）：
${sampleRows.map((row, index) => `第${index + 1}行: ${row.map(cell => cell || '(空)').join(', ')}`).join('\n')}

请返回JSON格式的结果：
{
  "columnIndices": [列的索引数字数组],
  "combinationRule": "组合规则描述",
  "reason": "选择这些列和组合规则的理由",
  "confidence": 0.0-1.0之间的置信度
}`;
  }

  // 构建金额列检测Prompt
  static buildAmountDetectionPrompt(headers, sampleData) {
    const sampleRows = sampleData.slice(1, Math.min(6, sampleData.length));

    return `
请分析以下Excel表格数据，找出最可能包含金额信息的列。

表格列名：
${headers.map((header, index) => `${index}: "${header}"`).join('\n')}

示例数据（前${sampleRows.length}行）：
${sampleRows.map((row, index) => `第${index + 1}行: ${row.map(cell => cell || '(空)').join(', ')}`).join('\n')}

请返回JSON格式的结果：
{
  "amountColumnIndex": 列的索引数字,
  "reason": "选择该列的理由",
  "confidence": 0.0-1.0之间的置信度
}`;
  }

  // 构建现有列分析Prompt
  static buildExistingColumnAnalysisPrompt(headers, jsonData) {
    const dataRows = jsonData.slice(1, Math.min(11, jsonData.length));

    const columnAnalysis = headers.map((header, index) => {
      const columnData = dataRows.map(row => row[index]);
      const sampleValues = columnData.slice(0, 5).map(cell => String(cell || '').trim());
      return `列${index + 1} ("${header}") 示例数据: ${sampleValues.join(', ')}`;
    }).join('\n');

    return `
请分析以下Excel数据列，判断哪一列最可能包含或能够提取出名称信息。

数据样本（前${dataRows.length}行）：
${columnAnalysis}

请返回JSON格式的结果：
{
  "bestColumnIndex": 列索引数字（从0开始），
  "reason": "选择的理由",
  "confidence": 0.0-1.0之间的置信度
}`;
  }

  // 解析响应函数
  static parseHeaderRowDetectionResponse(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('无法解析响应为JSON格式');
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('解析响应失败:', error);
      return null;
    }
  }

  static parseNameColumnDetectionResponse(content, headers) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('无法解析响应为JSON格式');
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        columnIndices: parsed.columnIndices || [],
        combinationRule: parsed.combinationRule || '',
        confidence: parsed.confidence || 0,
        reason: parsed.reason || ''
      };
    } catch (error) {
      console.error('解析响应失败:', error);
      return { columnIndices: [], combinationRule: '', confidence: 0, reason: '' };
    }
  }

  static parseAmountDetectionResponse(content, headers) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('无法解析响应为JSON格式');
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.amountColumnIndex || -1;
    } catch (error) {
      console.error('解析响应失败:', error);
      return -1;
    }
  }

  static parseExistingColumnAnalysisResponse(content, headers) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('无法解析响应为JSON格式');
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        bestColumnIndex: parsed.bestColumnIndex || -1,
        reason: parsed.reason || '',
        confidence: parsed.confidence || 0
      };
    } catch (error) {
      console.error('解析响应失败:', error);
      return { bestColumnIndex: -1, reason: '', confidence: 0 };
    }
  }

  // 测试API连接
  static async testConnection(apiKey) {
    console.log('\n🔌 === 测试API连接 ===');

    if (!this.validateApiKey(apiKey)) {
      console.log('❌ API Key格式无效，无法进行连接测试');
      return false;
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      console.log('API连接测试结果:', response.ok ? '✅ 成功' : '❌ 失败');
      if (response.ok) {
        const data = await response.json();
        console.log('可用模型:', data.data?.map(m => m.id).join(', '));
      } else {
        const error = await response.json();
        console.log('错误详情:', error);
      }

      return response.ok;
    } catch (error) {
      console.log('❌ 连接测试异常:', error.message);
      return false;
    }
  }
}

// 主测试函数
async function testRealAICalls() {
  console.log('🚀 === 开始真实AI API调用测试 ===\n');

  // 从环境变量或用户输入获取API Key
  const apiKey = process.env.DEEPSEEK_API_KEY || 'sk-your-api-key-here';

  if (!apiKey || apiKey === 'sk-your-api-key-here') {
    console.log('❌ 请设置正确的API Key');
    console.log('💡 方式1: 环境变量 - export DEEPSEEK_API_KEY="your-api-key"');
    console.log('💡 方式2: 修改代码中的apiKey变量');
    return;
  }

  console.log('🔑 API Key状态:', {
    length: apiKey.length,
    format: apiKey.startsWith('sk-') ? '✅ 正确格式' : '❌ 错误格式',
    lengthCheck: apiKey.length >= 30 ? '✅ 长度合适' : '❌ 长度不足'
  });

  // 测试API连接
  const connectionOk = await TestDeepSeekService.testConnection(apiKey);
  if (!connectionOk) {
    console.log('❌ API连接失败，请检查API Key和网络连接');
    return;
  }

  // 运行各种AI分析测试
  console.log('\n📊 测试数据:');
  console.log('标题:', mockProblematicExcelData[0]);
  console.log('数据行数:', mockProblematicExcelData.length - 1);

  await TestDeepSeekService.testHeaderRowDetection(apiKey);
  await TestDeepSeekService.testNameColumnDetection(apiKey);
  await TestDeepSeekService.testAmountColumnDetection(apiKey);
  await TestDeepSeekService.testExistingColumnAnalysis(apiKey);

  console.log('\n🎉 真实AI API调用测试完成！');
  console.log('💡 所有API调用都是真实的，消耗了真实的token');
  console.log('💡 请检查上述结果，确认AI能够正确分析你的问题数据');
}

// 运行测试
testRealAICalls().catch(console.error);
