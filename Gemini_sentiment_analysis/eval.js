const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs');
const Papa = require('papaparse');

async function processReviews(inputCsvPath, outputCsvPath, projectId = 'censored') {
    try {
        let system_instruction_string = "You are a seasoned gamer and sentiment analysis expert. You will be given a number of game reviews taken from the online platform Steam. Your task is to classify the sentiment of each game review and also try to predict the opinion held by other readers regarding the helpfulness of each game review. For each game review you are given, analyze it from the perspective of how a reader is likely to perceive the review — not how you personally interpret it. " + 
		  "Focus on the tone, gaming-specific language, humor, sarcasm, and the possible intent behind the review. " +
		  "On the platform Steam, readers of game reviews are given the option to express their opinion by answering the question 'Was this review helpful?' and the options for readers are as follows 'Yes', 'No' or 'Funny'. " +
		  "This may affect how reviews are written, especially in sarcastic or ironic cases. " +
		  "Helpful is by far the most common and likely opinion held by readers, and should be the default unless there's strong reason to classify it otherwise. " +
		  "Avoid overusing Funny unless the humor is obvious and dominant. " +
		  "Sentiment must be either Positive or Negative (never Mixed). Opinion must be one of: Helpful, Unhelpful or Funny (never Mixed). " +
		  "Respond only with a classification in this exact format: [Sentiment; Opinion]. Do not explain your answer. Do not include any extra text or labels. " +
		  "Only return a single line like this: [Positive; Helpful] or [Negative; Funny], etc.";
		const vertexAI = new VertexAI({ project: projectId, location: 'europe-north1' });
        const generativeModel = vertexAI.getGenerativeModel(
		{ 
			model: "gemini-2.0-flash-001",
			system_instruction: system_instruction_string
		});

        const csvData = fs.readFileSync(inputCsvPath, 'utf8');
        const parsedCsv = Papa.parse(csvData, { header: true });
        const reviews = parsedCsv.data;

        const outputData = [];

		let index = 1;
        for (const review of reviews) {
	
            const prompt = `Analyze the following review from the perspective of how a reader is likely to perceive it, with the understanding of a dedicated gamer who recognizes gaming-specific language, tone, sarcasm, and humor. Classify the review's sentiment (Positive or Negative — never Mixed) and try to predict the opinion held by other readers regarding the helpfulness of the review (Helpful, Unhelpful or Funny — never Mixed). Helpful is the most common and likely opinion held by readers. Avoid labeling opinion as Funny unless it is clearly the dominant tone. Respond in this exact format: [Sentiment; Opinion]. Do not include any other text. Here is the review: '${review.review}'`;

            const resp = await generativeModel.generateContent(prompt);
            const contentResponse = await resp.response;
            const responseText = contentResponse.candidates[0].content.parts[0].text;
            const trimmedText = responseText.trim();
			let content = trimmedText;
			if (content.startsWith('[') && content.endsWith(']')) content = trimmedText.slice(1, trimmedText.length - 1); // Remove square brackets

			let res_p1 = null;
			let res_p2 = null;
			let match_res_p1 = null;
			let match_res_p2 = null;

			const semicolonIndex = content.indexOf(";");

			if (semicolonIndex !== -1) {
				res_p1 = content.slice(0, semicolonIndex).trim();
				res_p2 = content.slice(semicolonIndex + 1).trim();
			}

			if (res_p1 !== null) match_res_p1 = res_p1.match(new RegExp('^' + review.sentiment + '$', 'i'));

			if (res_p2 !== null) match_res_p2 = res_p2.match(new RegExp('^' + review.opinion + '$', 'i'));
			
            if (match_res_p1 != null && match_res_p2 != null) {
                outputData.push({
					appId: review.appId,
                    reviewId: review.reviewId,
                    review: review.review,
					voted_up: review.voted_up,
                    votes_up: review.votes_up,
                    votes_funny: review.votes_funny,
                    weighted_vote_score: review.weighted_vote_score,
					sentiment: review.sentiment,
                    opinion: review.opinion,
                    llm_assumed_sentiment: match_res_p1[0],
                    llm_assumed_opinion: match_res_p2[0],
                    llm_matches: 2,
                });
            } else if (match_res_p1 != null && match_res_p2 == null){
                outputData.push({
					appId: review.appId,
                    reviewId: review.reviewId,
                    review: review.review,
					voted_up: review.voted_up,
                    votes_up: review.votes_up,
                    votes_funny: review.votes_funny,
                    weighted_vote_score: review.weighted_vote_score,
					sentiment: review.sentiment,
                    opinion: review.opinion,
                    llm_assumed_sentiment: match_res_p1[0],
                    llm_assumed_opinion: res_p2,
                    llm_matches: 1,
                });
            } else if (match_res_p1 == null && match_res_p2 != null){
                outputData.push({
					appId: review.appId,
                    reviewId: review.reviewId,
                    review: review.review,
					voted_up: review.voted_up,
                    votes_up: review.votes_up,
                    votes_funny: review.votes_funny,
                    weighted_vote_score: review.weighted_vote_score,
					sentiment: review.sentiment,
                    opinion: review.opinion,
                    llm_assumed_sentiment: res_p1,
                    llm_assumed_opinion: match_res_p2[0],
                    llm_matches: 1,
                });
            } else if ( (match_res_p1 == null && match_res_p2 == null) && (res_p1 != null && res_p2 != null) ){
                outputData.push({
					appId: review.appId,
                    reviewId: review.reviewId,
                    review: review.review,
					voted_up: review.voted_up,
                    votes_up: review.votes_up,
                    votes_funny: review.votes_funny,
                    weighted_vote_score: review.weighted_vote_score,
					sentiment: review.sentiment,
                    opinion: review.opinion,
                    llm_assumed_sentiment: res_p1,
                    llm_assumed_opinion: res_p2,
                    llm_matches: 0,
                });
            } else {
                outputData.push({
					appId: review.appId,
                    reviewId: review.reviewId,
                    review: review.review,
					voted_up: review.voted_up,
                    votes_up: review.votes_up,
                    votes_funny: review.votes_funny,
                    weighted_vote_score: review.weighted_vote_score,
					sentiment: review.sentiment,
                    opinion: review.opinion,
                    llm_assumed_sentiment: trimmedText,
                    llm_assumed_opinion: trimmedText,
                    llm_matches: 0,
                });
			}
			console.log(`Processed ${index++} review(s), currently processed id: ${review.reviewId} with result: ${res_p1}, ${res_p2}`);
            // delay inputs
            await new Promise(resolve => setTimeout(resolve, 250));
        }

        const outputCsv = Papa.unparse(outputData, { header: true });
        fs.writeFileSync(outputCsvPath, outputCsv);
        console.log(`Processed reviews and saved to ${outputCsvPath}`);
    } catch (error) {
        console.error('Error:', error);
    }
}

const inputCsv = '..\\data\\dataset_of_reviews.csv';
const outputCsv = 'merged_reviews_output_gemini-2-0-flash-001.csv';
processReviews(inputCsv, outputCsv);