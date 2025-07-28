const axios = require('axios');
const fs = require('fs');
const Papa = require('papaparse');
/*
const appIds = [
    730, 578080, 381210, 271590, 359550, 440, 105600, 252490, 4000, 221100,
    2358720, 1245620, 292030, 413150, 1091500, 550, 553850, 1086940, 1174180,
    1085660, 739630, 945360, 275850, 346110, 1517290, 242760, 1097150, 218620,
	892970, 1966720, 291550, 2357570, 252950, 1172620, 582010, 1293830, 1203220,
	2767030, 377160, 289070, 251570, 1063730, 438100
];
*/
const appIds = [
2246340,3164500,3241660,1771300,516750,1903340,2001120,3240220,2623190,1295660,2943650,1062520,2134320,2531310,3159330,394690,2407270,2384580,2456740,3117820,690830,2909400,3419430,2651280,1374490,2680010,3244220,2725260,2634950,3058630,1239080,3017860,3513350,2457220,1426450,496240,3191030,3108510,3199170,2067920,1569580,1635450,1641960,3061810,1486920,2294660,1340990,2239140,2185060,3059070,1796470,2495100,1689620,3164330,3020510,2625420,1104280,2890830,2376580,2361680,2763740,619820,3399950,3167550,2421410,2239710,3014080,2103130,3478870,2089600,2820820,2244130,2486740,1422440,1902960,1054510,2854740,1270580,1534840,1691340,2273980,2169200,3084280,2073250,3228590,2660460,801800,3314070,1491000,2344320,1456940,1991040,2850190,2695490,1203190,2756920,3300410,1376200,3287520,2680550,490110,1830970,3123410,3195790,1245480,2994020,3472550,1657090,1763250,2754380,1660080,2240080,1934570,2796010,1649730,2878960,1548520,2827230,3371240,1133870,2773280,1721060,3079280,2385530,3373660,2697930,3028310,2612700,2056210,1984020,3272300,3431040,2436940,2379740,3416070,2026820,1915510,3094010,1213300,1932570,3228180,1932640,3433810,1801520,1136380,1299460,3167180,2776450,1931180,2226280,2488370,1907590,3478700,1401730,3347400,3109580,3314060,2892880,2228280,3069120,3112260,2318480,2825530,2097570,2328480,1690710,2020710,3107800,2492040,1732430,3267430,3292260,3238670,1639430,3126330,2442460,2869860,3149840,3178350,1479730,1437760,3003300,2473480,2151290,1990110,3247270,3389330,3004100,3438990,3226530,2346410,3463050,2688570,3402530,3183280,2512560,1839430,2232880,3174480,2585830
];
async function fetchAndSaveMultipleReviews(appId, fetchAmount, reviewType, allReviews) {
    let cursor = '*';
    let totalReviewsFetched = 0;
    let n = 0;

    try {
        while (totalReviewsFetched < fetchAmount) {
            let url = `https://store.steampowered.com/appreviews/${appId}?json=1&cursor='${encodeURIComponent(cursor)}'&review_type=${reviewType}&filter='all'&filter_offtopic_activity=1&day_range=365&language=english`;
            if (n > 0) url = `https://store.steampowered.com/appreviews/${appId}?json=1&cursor=${encodeURIComponent(cursor)}&review_type=${reviewType}&filter='all'&filter_offtopic_activity=1&day_range=365&language=english`;

            const response = await axios.get(url);
            const data = response.data;

            if (data && data.reviews && data.reviews.length > 0) {
                const reviews = data.reviews;
				
				var match = false;
				allReviews.forEach(review => {
					if(review.reviewId == reviews[0].recommendationid) match = true;
				});
				
				if(match) {
					console.log("--------------> allReviews already includes a review from new cursor, skipping");
					break;
				}
				
                reviews.forEach(reviewObj => {
					
					let reviewText = reviewObj.review ? reviewObj.review.replace(/[\r\n]+/g, ' ') : '';
					
					if(reviewText.length > 0 && !containsNonUtf8(reviewText) && parseFloat(reviewObj.weighted_vote_score) != 0.5 && (reviewObj.votes_up != 0 || reviewObj.votes_funny != 0)) {
						
						let reviewSentiment = reviewObj.voted_up ? "Positive" : "Negative";

						let helpfulnessOpinion = "";
						if (reviewObj.votes_funny > reviewObj.votes_up) helpfulnessOpinion = "Funny";
						else if (parseFloat(reviewObj.weighted_vote_score) < 0.5) helpfulnessOpinion = "Unhelpful";
						else if (parseFloat(reviewObj.weighted_vote_score) > 0.5 && reviewObj.votes_up > 0) helpfulnessOpinion = "Helpful";
						else helpfulnessOpinion = "Mixed";

						const obj = {
							appId: appId,
							reviewId: reviewObj.recommendationid,
							review: reviewText,
							voted_up: reviewObj.voted_up,
							votes_up: reviewObj.votes_up,
							votes_funny: reviewObj.votes_funny,
							weighted_vote_score: reviewObj.weighted_vote_score,
							sentiment: reviewSentiment,
							opinion: helpfulnessOpinion,
						};
						
						allReviews.push(obj);
						totalReviewsFetched++;
					}
                });

                console.log(`Current Cursor (${cursor}) in appId ${appId} | Review Amount: ` + data.reviews.length);
				if(data.cursor == cursor) {
					console.log("--------------> data.cursor == cursor, skipping and going to next appID");
					break;
				}
                cursor = data.cursor;
                n++;
                //console.log("Total Reviews Accepted: " + totalReviewsFetched);

                if (!cursor) {
                    console.log("No more cursors, all reviews fetched.");
                    break;
                }
            } else {
                console.log("--------------> Error or no data received in this chunk.");
                console.log("--------------> cursor: " + cursor);
				console.log("--------------> appID: " + appId);
                break;
            }
            if (totalReviewsFetched >= fetchAmount) {
                console.log(`\n${totalReviewsFetched} reviews fetched.`);
                break;
            }
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

async function processAllAppIds(fetchAmount, reviewType) {
    const allReviews = []; // array to store all reviews
    for (const appId of appIds) {
		if(allReviews.length >= 5000) break;
		else await fetchAndSaveMultipleReviews(appId, fetchAmount, reviewType, allReviews);
    }

    if (allReviews.length > 0) {
        const outputCsvPath = "all_reviews_"+reviewType+".csv";
        const csv = Papa.unparse(allReviews, { header: true, quotes: true });
        fs.writeFileSync(outputCsvPath, csv);
        console.log(`Processed ${allReviews.length} reviews and saved to ${outputCsvPath}`);
    } else {
        console.log("No reviews fetched.");
    }
}

function containsNonUtf8(str) {
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    
    if (charCode > 0xFFFF && !containsEmoji(charCode)) {
      return true;
    }
    if (charCode > 255 && !containsEmoji(charCode)) {
        return true;
    }
  }
  return false;
}

function containsEmoji(text) {
	// regular expression to match a wide range of emojis
	const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{1F191}-\u{1F19A}\u{1F200}-\u{1F202}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F23A}\u{1F250}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B55}\u{231A}-\u{231B}\u{23F0}-\u{23F3}\u{2328}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2934}-\u{2935}\u{2B06}-\u{2B07}\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}\u{2194}-\u{2199}\u{21A9}-\u{21AA}\u{231A}-\u{231B}\u{2328}\u{2388}\u{23CF}\u{24C2}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2600}-\u{2604}\u{260E}\u{2611}\u{2614}-\u{2615}\u{2618}\u{261D}\u{2620}\u{2622}-\u{2623}\u{2626}\u{262A}\u{262E}-\u{262F}\u{2638}-\u{263A}\u{2640}\u{2642}\u{2648}-\u{2653}\u{2660}\u{2663}\u{2665}-\u{2666}\u{2668}\u{267B}\u{267F}\u{2692}-\u{2694}\u{2696}-\u{2697}\u{2699}\u{26A0}-\u{26A1}\u{26AA}-\u{26AB}\u{26B0}-\u{26B1}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26C8}\u{26CE}\u{26CF}\u{26D1}\u{26D3}-\u{26D4}\u{26E1}\u{26E3}\u{26F0}-\u{26F5}\u{26FA}-\u{26FC}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}-\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{27C3}-\u{27C4}\u{27CC}\u{27D0}\u{27E1}\u{27E3}\u{27F0}\u{27F3}\u{27FA}\u{27FC}\u{27FF}’“”\u{0027}\u{0027}\u{0027}\u{0027}\u{0027}\u{0027}\u{0027}\u{0027}\u{0027}\u{0027}\u{0027}\u{0027}•\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}——€\u{0027}\u{002D}\u{0027}\u{0027}\u{0027}\u{0027}\u{002D}\u{0027}\u{0027}\u{2026}\u{2013}\u{2014}\u{2015}\u{2721}\u{221A}]/u;

	return emojiRegex.test(text);
}

processAllAppIds(40, "negative");