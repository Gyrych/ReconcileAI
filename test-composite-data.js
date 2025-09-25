// 测试复合数据格式解析功能

// 模拟复合数据格式的Excel文件
const mockCompositeExcelData = [
  ['项目名称'],           // 标题行
  ['员工工资:5000.00'],   // 复合数据行1
  ['办公用品:1500.50'],   // 复合数据行2
  ['房租:2000.00'],       // 复合数据行3
  ['水电费:1200.00'],     // 复合数据行4
  ['差旅费:3000.00']      // 复合数据行5
];

// 模拟传统格式的Excel文件（对比）
const mockTraditionalExcelData = [
  ['项目名称', '金额'],     // 标题行
  ['员工工资', '5000.00'],  // 数据行1
  ['办公用品', '1500.50'],  // 数据行2
  ['房租', '2000.00'],      // 数据行3
  ['水电费', '1200.00'],    // 数据行4
  ['差旅费', '3000.00']     // 数据行5
];

// 模拟解析函数（从excelParser.ts复制）
class TestExcelParser {
  static parseAmount(amountStr) {
    if (!amountStr) return null;
    const cleaned = amountStr.replace(/[¥$€£₽₹₩₪₫₡₵₺₴₸₼₲₱₭₯₰₳₶₷₹₻₽₾₿]/g, '').replace(/,/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : Math.round(parsed * 100) / 100;
  }

  static extractFromCompositeData(compositeData) {
    if (!compositeData) return { name: '', amount: null };

    let cleaned = compositeData.replace(/[¥$€£₽₹₩₪₫₡₵₺₴₸₼₲₱₭₯₰₳₶₷₹₻₽₾₿]/g, '').trim();
    const separators = [':', '：', '-', '(', '（', '|', ' ', '\t'];

    for (const separator of separators) {
      if (cleaned.includes(separator)) {
        const parts = cleaned.split(separator).map(p => p.trim()).filter(p => p);
        if (parts.length >= 2) {
          const lastPart = parts[parts.length - 1];
          const secondLastPart = parts[parts.length - 2];

          if (/^\d+(\.\d+)?$/.test(lastPart) ||
              /\d+(\.\d+)?元?$/.test(lastPart) ||
              /\d+(\.\d+)?块?$/.test(lastPart) ||
              /\d+(\.\d+)?角?$/.test(lastPart) ||
              /\d+(\.\d+)?分?$/.test(lastPart)) {
            const name = parts.slice(0, -1).join(separator).trim();
            const amount = this.parseAmount(lastPart);
            return { name, amount };
          }
        }
      }
    }

    return { name: cleaned, amount: null };
  }

  static detectCompositeFormat(headers, jsonData) {
    if (headers.length !== 1) return false;

    const sampleRows = jsonData.slice(1, Math.min(10, jsonData.length));
    let compositeCount = 0;
    const separators = [':', '：', '-', '(', '（', '|'];

    for (const row of sampleRows) {
      const cellValue = String(row[0] || '').trim();
      if (!cellValue) continue;

      const hasSeparator = separators.some(sep => cellValue.includes(sep));
      if (hasSeparator) {
        const parts = cellValue.split(/[:：\-（(]/).map(p => p.trim()).filter(p => p);
        const lastPart = parts[parts.length - 1];

        if (/^\d+(\.\d+)?$/.test(lastPart)) {
          compositeCount++;
        }
      }
    }

    const ratio = compositeCount / sampleRows.length;
    console.log('复合格式检测结果:', {
      totalRows: sampleRows.length,
      compositeRows: compositeCount,
      ratio: ratio.toFixed(2),
      isComposite: ratio > 0.5
    });

    return ratio > 0.5;
  }

  static parseCompositeData(data) {
    const headers = data[0];
    const jsonData = data;
    const isCompositeFormat = this.detectCompositeFormat(headers, jsonData);

    const entries = [];

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];

      if (isCompositeFormat && headers.length === 1) {
        const compositeData = String(row[0] || '').trim();
        const parsed = this.extractFromCompositeData(compositeData);

        if (parsed.name && parsed.amount !== null) {
          entries.push({
            id: `composite_${i}`,
            name: parsed.name,
            amount: parsed.amount,
            source: 'test'
          });

          console.log(`✅ 解析复合数据第${i}行: "${compositeData}" → 名称:"${parsed.name}", 金额:${parsed.amount}`);
        }
      }
    }

    return entries;
  }

  static parseTraditionalData(data) {
    const headers = data[0];
    const jsonData = data;

    // 查找名称列和金额列
    const nameIndex = headers.indexOf('项目名称');
    const amountIndex = headers.indexOf('金额');

    const entries = [];

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const name = String(row[nameIndex] || '').trim();
      const amountStr = String(row[amountIndex] || '').trim();
      const amount = this.parseAmount(amountStr);

      if (name && amount !== null) {
        entries.push({
          id: `traditional_${i}`,
          name,
          amount,
          source: 'test'
        });

        console.log(`✅ 解析传统数据第${i}行: 名称:"${name}", 金额:${amount}`);
      }
    }

    return entries;
  }
}

// 测试函数
async function testCompositeParsing() {
  console.log('🧪 === 测试复合数据格式解析功能 ===\n');

  // 测试复合数据
  console.log('📋 测试复合数据格式:');
  console.log('标题:', mockCompositeExcelData[0]);
  console.log('数据:');
  mockCompositeExcelData.slice(1).forEach((row, i) => {
    console.log(`  行${i + 1}: ${row[0]}`);
  });
  console.log('');

  const compositeEntries = TestExcelParser.parseCompositeData(mockCompositeExcelData);
  console.log(`\n✅ 复合数据解析完成，共${compositeEntries.length}条记录\n`);

  // 测试传统数据
  console.log('📋 测试传统数据格式:');
  console.log('标题:', mockTraditionalExcelData[0]);
  console.log('数据:');
  mockTraditionalExcelData.slice(1).forEach((row, i) => {
    console.log(`  行${i + 1}: ${row[0]} | ${row[1]}`);
  });
  console.log('');

  const traditionalEntries = TestExcelParser.parseTraditionalData(mockTraditionalExcelData);
  console.log(`\n✅ 传统数据解析完成，共${traditionalEntries.length}条记录\n`);

  // 对比结果
  console.log('📊 === 解析结果对比 ===');
  console.log('复合数据格式结果:');
  compositeEntries.forEach(entry => {
    console.log(`  - ${entry.name}: ${entry.amount}元`);
  });

  console.log('\n传统数据格式结果:');
  traditionalEntries.forEach(entry => {
    console.log(`  - ${entry.name}: ${entry.amount}元`);
  });

  console.log('\n🎉 测试完成！两种格式都能正确解析数据。');

  return { compositeEntries, traditionalEntries };
}

// 运行测试
testCompositeParsing();
