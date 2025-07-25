const fs = require("fs");
const Papa = require("papaparse");
require("dotenv").config();
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_KEY,
});

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processReviews(inputCsvPath, outputCsvPath) {
  try {
    console.log("Reading input file:", inputCsvPath);
    const csvData = fs.readFileSync(inputCsvPath, "utf8");
    console.log("File read successfully.");

    console.log("Parsing CSV data...");
    const parsedCsv = Papa.parse(csvData, { header: true });
    const reviews = parsedCsv.data;
    console.log(`parsed ${reviews.length} reviews.`);

    const outputData = [];

    const systemInstructions = {
      role: "system",
      content:
        "You are a seasoned gamer and sentiment analysis expert. You will be given a number of game reviews taken from the online platform Steam. Your task is to classify the sentiment of each game review and also try to predict the opinion held by other readers regarding the helpfulness of each game review. For each game review you are given, analyze it from the perspective of how a reader is likely to perceive the review — not how you personally interpret it. " +
        "Focus on the tone, gaming-specific language, humor, sarcasm, and the possible intent behind the review. " +
        "On the platform Steam, readers of game reviews are given the option to express their opinion by answering the question 'Was this review helpful?' and the options for readers are as follows 'Yes', 'No' or 'Funny'. " +
        "This may affect how reviews are written, especially in sarcastic or ironic cases. " +
        "Helpful is by far the most common and likely opinion held by readers, and should be the default unless there's strong reason to classify it otherwise. " +
        "Avoid overusing Funny unless the humor is obvious and dominant. " +
        "Sentiment must be either Positive or Negative (never Mixed). Opinion must be one of: Helpful, Unhelpful or Funny (never Mixed). " +
        "Respond only with a classification in this exact format: [Sentiment; Opinion]. Do not explain your answer. Do not include any extra text or labels. " +
        "Only return a single line like this: [Positive; Helpful] or [Negative; Funny], etc.",
    };

    const BATCH_SIZE = 100;
    const BATCH_DELAY_MS = 60000;

    for (let i = 0; i < reviews.length; i++) {
      const review = reviews[i];
      if (!review.review) {
        console.log(`skipping empty review at index ${i}`);
        continue;
      }

      console.log(`[${i + 1}/${reviews.length}] Processing review ID: ${review.reviewId}`);

      const userPrompt = `Analyze the following review from the perspective of how a reader is likely to perceive it, with the understanding of a dedicated gamer who recognizes gaming-specific language, tone, sarcasm, and humor. Classify the review's sentiment (Positive or Negative — never Mixed) and try to predict the opinion held by other readers regarding the helpfulness of the review (Helpful, Unhelpful or Funny — never Mixed). Helpful is the most common and likely opinion held by readers. Avoid labeling opinion as Funny unless it is clearly the dominant tone. Respond in this exact format: [Sentiment; Opinion]. Do not include any other text. Here is the review: '${review.review}'`;

      let responseText = "";

      try {
        const start = Date.now();
        const llmResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            systemInstructions,
            { role: "user", content: userPrompt },
          ],
          max_tokens: 64,
          temperature: 0,
        });

        const elapsed = Date.now() - start;
        responseText = llmResponse.choices[0].message.content.trim();
        console.log(`LLM response: ${responseText} (${elapsed}ms)`);
      } catch (llmError) {
        console.log(`LLM failed for review ID: ${review.reviewId}`);
        console.error(llmError.message);
        responseText = "[Failed; Failed]";
      }

      const match = responseText.match(/\[?\s*(Positive|Negative)\s*;\s*(Funny|Helpful|Unhelpful)\s*\]?/i);
      const llm_assumed_sentiment = match ? match[1] : "Failed";
      const llm_assumed_opinion = match ? match[2] : "Failed";

      if (!match) {
        console.log(`Failed to parse llm response for ID ${review.reviewId}`);
      }

      let llm_matches = 0;
      if (review.sentiment && review.opinion) {
        const sentimentMatch =
          review.sentiment.trim().toLowerCase() === llm_assumed_sentiment.toLowerCase();
        const opinionMatch =
          review.opinion.trim().toLowerCase() === llm_assumed_opinion.toLowerCase();
        llm_matches = sentimentMatch && opinionMatch ? 2 : sentimentMatch || opinionMatch ? 1 : 0;
      } else {
        console.log(`Missing ground truth data to compare for ID ${review.reviewId}`);
      }

      outputData.push({
        ...review,
        llm_assumed_sentiment,
        llm_assumed_opinion,
        llm_matches,
      });

      // Delay after every batch
      if ((i + 1) % BATCH_SIZE === 0) {
        console.log(`Batch complete (${i + 1}). Waiting ${BATCH_DELAY_MS / 1000} seconds to avoid throttling...`);
        await delay(BATCH_DELAY_MS);
      }

      await delay(800); // 80ms between individual requests
    }

    console.log("Writing results to output file...");
    const outputCsv = Papa.unparse(outputData, { header: true });
    fs.writeFileSync(outputCsvPath, outputCsv);
    console.log(`Output saved: ${outputCsvPath}`);
    console.log(`Full path: ${__dirname}/${outputCsvPath}`);
  } catch (error) {
    console.error("Uncaught error:", error.stack || error.message || error);
  }
}

// Example usage
const inputCsv = "..\\TablesOfData\\test_1_merged_reviews_output_gemini-2-0-flash-001.csv";
const outputCsv = "merged_reviews_output_llm-4o-mini.csv";
console.log("Starting review processing script...");
processReviews(inputCsv, outputCsv);
