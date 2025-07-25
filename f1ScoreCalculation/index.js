const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// Define model input files
const models = {
  'gemini': [
    '..\\data\\test_1_merged_reviews_output_gemini-2-0-flash-001.csv',
    '..\\data\\test_2_merged_reviews_output_gemini-2-0-flash-001.csv',
    '..\\data\\test_3_merged_reviews_output_gemini-2-0-flash-001.csv'
  ],
  'gpt-4o-mini': [
    '..\\data\\test_1_merged_reviews_output_gpt-4o-mini.csv',
    '..\\data\\test_2_merged_reviews_output_gpt-4o-mini.csv',
    '..\\data\\test_3_merged_reviews_output_gpt-4o-mini.csv'
  ]
};

async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const trueLabels = [];
    const predictedLabels = [];
    const sentiments = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        trueLabels.push(row['opinion'].trim().toLowerCase());
        predictedLabels.push(row['llm_assumed_opinion'].trim().toLowerCase());

        const sentiment = (row['sentiment'] || '').trim().toLowerCase();
        if (!sentiment) {
          console.warn("missing sentiment in row:", row);
        }
        sentiments.push(sentiment);
      })
      .on('end', () => resolve({ trueLabels, predictedLabels, sentiments }))
      .on('error', reject);
  });
}

function buildConfusionMatrix(trueLabels, predictedLabels, labels) {
  const labelIndex = Object.fromEntries(labels.map((label, i) => [label, i]));
  const matrix = Array(labels.length).fill(0).map(() => Array(labels.length).fill(0));

  for (let i = 0; i < trueLabels.length; i++) {
    const t = labelIndex[trueLabels[i]];
    const p = labelIndex[predictedLabels[i]];
    if (t !== undefined && p !== undefined) {
      matrix[t][p]++;
    }
  }

  return { matrix, labelIndex };
}

async function processModel(modelName, filePaths) {
  const allTrue = [];
  const allPred = [];
  const allSentiments = [];

  for (const file of filePaths) {
    const { trueLabels, predictedLabels, sentiments } = await readCSV(file);
    allTrue.push(...trueLabels);
    allPred.push(...predictedLabels);
    allSentiments.push(...sentiments);
  }

  function subset(sentimentValue) {
    const trueSub = [], predSub = [];
    allTrue.forEach((t, i) => {
      if (sentimentValue === 'all' || allSentiments[i] === sentimentValue) {
        trueSub.push(t);
        predSub.push(allPred[i]);
      }
    });
    return { trueSub, predSub };
  }

  const negative = subset('negative');
  const positive = subset('positive');
  const overall  = subset('all');

  const f1File = `f1_scores_opinion_${modelName}.csv`;
  let csvContent = `Model,Subset,Class,Precision,Recall,F1-Score,Support\n`;

  function appendF1Block({ trueSub, predSub }, subsetName) {
    const labels = Array.from(new Set([...trueSub, ...predSub]));
    const { matrix, labelIndex } = buildConfusionMatrix(trueSub, predSub, labels);

    let totalF1 = 0, totalSupport = 0;

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const tp = matrix[i][i];
      const fp = matrix.reduce((sum, row, j) => sum + (j !== i ? row[i] : 0), 0);
      const fn = matrix[i].reduce((sum, val, j) => sum + (j !== i ? val : 0), 0);
      const support = matrix[i].reduce((sum, val) => sum + val, 0);

      const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
      const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
      const f1 = (precision + recall === 0) ? 0 : (2 * precision * recall) / (precision + recall);

      csvContent += `${modelName},${subsetName},${label},${precision.toFixed(2)},${recall.toFixed(2)},${f1.toFixed(2)},${support}\n`;

      totalF1 += f1 * support;
      totalSupport += support;
    }

    const weightedF1 = totalSupport === 0 ? 0 : totalF1 / totalSupport;
    csvContent += `${modelName},${subsetName},Average (weighted),,,${weightedF1.toFixed(2)},${totalSupport}\n`;
  }

  appendF1Block(negative, 'negative');
  appendF1Block(positive, 'positive');
  appendF1Block(overall,  'all');

  fs.writeFileSync(f1File, csvContent);
  console.log(`extended F1 scores saved: "${f1File}"`);
}

async function runAll() {
  console.log("starting process...");
  for (const [modelName, filePaths] of Object.entries(models)) {
    console.log(`processing model: ${modelName}`);
    await processModel(modelName, filePaths);
  }
  console.log("all models processed.");
}

runAll();
