// 调试AI分析过程 - 模拟文件解析失败的情况

// 模拟的Excel数据（基于错误信息）
const mockExcelData = [
  ['金额单位：元'],  // 标题行
  ['5000.00'],        // 数据行1
  ['1500.50'],        // 数据行2
  ['2000.00'],        // 数据行3
  ['1200.00'],        // 数据行4
  ['3000.00']         // 数据行5
];

// 模拟API调用的函数
async function mockDeepSeekAPI(prompt, temperature = 0.1) {
  console.log('🔍 AI分析请求:');
  console.log('Prompt:', prompt);
  console.log('Temperature:', temperature);

  // 模拟API延迟
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 基于列名"金额单位：元"的情况，模拟AI的分析结果
  if (prompt.includes('找出最可能包含名称信息')) {
    const response = {
      "columnIndices": [],
      "combinationRule": "",
      "reason": "列名'金额单位：元'明显是金额列，不包含名称信息。分析数据内容显示这是一列纯数字数据，没有文本描述。",
      "confidence": 0.05
    };
    console.log('🤖 AI名称列检测结果:');
    console.log(JSON.stringify(response, null, 2));
    return response;
  }

  if (prompt.includes('判断哪一列最可能包含或能够提取出名称信息')) {
    const response = {
      "bestColumnIndex": -1,
      "reason": "所有列都是纯数字格式，没有发现任何文本描述信息",
      "extractionMethod": "无",
      "confidence": 0.0
    };
    console.log('🤖 AI现有列分析结果:');
    console.log(JSON.stringify(response, null, 2));
    return response;
  }

  if (prompt.includes('找出最可能包含金额信息的列')) {
    const response = {
      "amountColumnIndex": 0,
      "reason": "列名'金额单位：元'包含明显的金额关键词，且数据都是数字格式",
      "confidence": 0.95
    };
    console.log('🤖 AI金额列检测结果:');
    console.log(JSON.stringify(response, null, 2));
    return response;
  }

  return { error: '未匹配的请求' };
}

// 模拟Excel解析器的AI分析过程
async function simulateExcelParserAnalysis() {
  console.log('📊 === 开始模拟Excel解析AI分析过程 ===\n');

  const headers = mockExcelData[0]; // ['金额单位：元']
  const jsonData = mockExcelData;

  console.log('📋 模拟Excel文件数据:');
  console.log('标题行:', headers);
  console.log('数据行数:', jsonData.length - 1);
  console.log('数据内容:');
  jsonData.forEach((row, index) => {
    console.log(`  行${index + 1}: ${row.join(' | ')}`);
  });
  console.log('');

  // 步骤1: 传统方法查找名称列
  console.log('🔍 === 步骤1: 传统方法查找名称列 ===');
  const nameKeywords = [
    'name', '名称', '条目', '项目', '项目名称',
    '摘要', '描述', '内容', '事项', '科目', '科目名称'
  ];

  const nameIndex = findColumnIndex(headers, nameKeywords);
  console.log('传统名称列查找结果:', nameIndex >= 0 ? `找到列索引${nameIndex}（${headers[nameIndex]}）` : '未找到名称列');
  console.log('');

  // 步骤2: 传统方法查找金额列
  console.log('🔍 === 步骤2: 传统方法查找金额列 ===');
  const amountKeywords = [
    'amount', '金额', '价值', '价格', '数额'
  ];

  const amountIndex = findColumnIndex(headers, amountKeywords);
  console.log('传统金额列查找结果:', amountIndex >= 0 ? `找到列索引${amountIndex}（${headers[amountIndex]}）` : '未找到金额列');
  console.log('');

  // 步骤3: AI智能检测名称列
  console.log('🔍 === 步骤3: AI智能检测名称列 ===');
  try {
    const nameColumnPrompt = buildNameColumnDetectionPrompt(headers, jsonData);
    const aiNameResult = await mockDeepSeekAPI(nameColumnPrompt);
    console.log('AI名称列检测完成');
    console.log('');
  } catch (error) {
    console.log('AI名称列检测失败:', error);
  }

  // 步骤4: AI分析现有列
  console.log('🔍 === 步骤4: AI分析现有列 ===');
  try {
    const existingColumnPrompt = buildExistingColumnAnalysisPrompt(headers, jsonData);
    const aiExistingResult = await mockDeepSeekAPI(existingColumnPrompt);
    console.log('AI现有列分析完成');
    console.log('');
  } catch (error) {
    console.log('AI现有列分析失败:', error);
  }

  // 步骤5: AI检测金额列
  console.log('🔍 === 步骤5: AI检测金额列 ===');
  try {
    const amountColumnPrompt = buildAmountDetectionPrompt(headers, jsonData);
    const aiAmountResult = await mockDeepSeekAPI(amountColumnPrompt);
    console.log('AI金额列检测完成');
    console.log('');
  } catch (error) {
    console.log('AI金额列检测失败:', error);
  }

  // 步骤6: 传统自动选择方法
  console.log('🔍 === 步骤6: 传统自动选择方法 ===');
  const autoSelectedIndex = autoSelectNameColumn(headers, jsonData);
  console.log('自动选择名称列结果:', autoSelectedIndex >= 0 ? `列索引${autoSelectedIndex}（${headers[autoSelectedIndex]}）` : '未找到合适列');
  console.log('');

  // 最终结果分析
  console.log('📊 === 最终结果分析 ===');
  console.log('传统名称列索引:', nameIndex);
  console.log('传统金额列索引:', amountIndex);
  console.log('自动选择名称列索引:', autoSelectedIndex);

  if (nameIndex === -1 && autoSelectedIndex === -1) {
    console.log('❌ 结论: 无法找到名称列');
    console.log('🔍 原因分析:');
    console.log('  1. 列名"金额单位：元"明显是金额列');
    console.log('  2. 数据内容都是纯数字，没有文本描述');
    console.log('  3. AI分析置信度过低(<0.3)，被拒绝');
    console.log('  4. 传统方法无法找到合适的名称列');
    console.log('');
    console.log('💡 解决方案:');
    console.log('  1. Excel文件应该包含名称列（如：项目、摘要、科目等）');
    console.log('  2. 建议的列名：项目名称、交易摘要、科目名称等');
    console.log('  3. 或者将名称信息和金额放在同一列，用特定格式分隔');
  }
}

// 辅助函数（从excelParser.ts复制）
function findColumnIndex(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]?.toLowerCase().trim();
    if (!header) continue;

    if (keywords.some(keyword => header === keyword.toLowerCase())) {
      return i;
    }

    if (keywords.some(keyword => header.includes(keyword.toLowerCase()))) {
      return i;
    }

    const headerWords = header.split(/[\s_－\-]+/);
    if (headerWords.some(word => keywords.some(keyword => word.includes(keyword.toLowerCase())))) {
      return i;
    }
  }
  return -1;
}

function buildNameColumnDetectionPrompt(headers, sampleData) {
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

function buildExistingColumnAnalysisPrompt(headers, jsonData) {
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

function buildAmountDetectionPrompt(headers, sampleData) {
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

function autoSelectNameColumn(headers, jsonData) {
  if (headers.length === 0 || jsonData.length < 2) return -1;

  const columnAnalysis = headers.map((header, index) => {
    const columnData = jsonData.slice(1).map(row => row[index]);
    const nonEmptyCells = columnData.filter(cell => cell != null && String(cell).trim() !== '');
    const textCells = nonEmptyCells.filter(cell => isNaN(Number(cell)) && String(cell).trim().length > 0);
    const avgTextLength = textCells.length > 0
      ? textCells.reduce((sum, cell) => sum + String(cell).length, 0) / textCells.length
      : 0;

    return {
      index,
      header,
      textCells: textCells.length,
      nonEmptyCells: nonEmptyCells.length,
      avgTextLength,
      nameScore: (textCells.length / nonEmptyCells.length) * 0.4 + Math.min(avgTextLength / 20, 1) * 0.3
    };
  });

  const candidateColumns = columnAnalysis.filter(col => {
    if (!col.header || col.header.trim() === '') return false;
    if (col.nonEmptyCells === 0) return false;
    if (col.textCells === 0) return false; // 纯数字列排除
    if (col.avgTextLength < 2) return false;
    return true;
  });

  if (candidateColumns.length === 0) return -1;

  candidateColumns.sort((a, b) => b.nameScore - a.nameScore);
  return candidateColumns[0].index;
}

// 运行模拟
simulateExcelParserAnalysis();
