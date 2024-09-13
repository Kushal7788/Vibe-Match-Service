const { OpenAI } = require('openai');

// Set your OpenAI API key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function getMovieEmbeddings(titles) {
  try {
    const response = await openai.embeddings.create({
        input: titles,
        model: "text-embedding-3-small"
    });

    // Return an array of embeddings, one for each title
    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error("Error getting embeddings:", error);
    throw error;
  }
}

function combineEmbeddings(embeddings) {
  const sum = embeddings.reduce((acc, curr) => acc.map((val, idx) => val + curr[idx]), new Array(embeddings[0].length).fill(0));
  return sum.map(val => val / embeddings.length);
}

function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

function findTopKSimilarUsers(users, k) {
  const similarities = [];
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      similarities.push({
        pair: [i, j],
        similarity: cosineSimilarity(users[i], users[j])
      });
    }
  }
  return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, k);
}

function extractTitles(jsonData) {
  // Check if jsonData is an array and has at least one element
  if (!Array.isArray(jsonData) || jsonData.length === 0) {
    throw new Error('Invalid input: Expected a non-empty array');
  }

  // Access the first (and presumably only) object in the array
  const dataObject = jsonData[0];

  // Check if the object has a publicData property with a titles array
  if (!dataObject.publicData || !Array.isArray(dataObject.publicData.titles)) {
    throw new Error('Invalid data structure: Expected publicData.titles array');
  }

  // Return the titles array
  return dataObject.publicData.titles;
}

module.exports = { 
  getMovieEmbeddings, 
  combineEmbeddings, 
  findTopKSimilarUsers,
  extractTitles,
  cosineSimilarity  // Add this export
};

// Example usage:
// const { getMovieEmbeddings, combineEmbeddings, findTopKSimilarUsers } = require('./utils');
// 
// async function main() {
//   const usersTitles = [
//     ["The Shawshank Redemption", "The Godfather", "The Dark Knight"],
//     ["Pulp Fiction", "Inception", "The Matrix"],
//     ["Forrest Gump", "The Green Mile", "Schindler's List"]
//   ];
//   
//   try {
//     const usersEmbeddings = await Promise.all(usersTitles.map(getMovieEmbeddings));
//     const combinedEmbeddings = usersEmbeddings.map(combineEmbeddings);
//     const topKSimilar = findTopKSimilarUsers(combinedEmbeddings, 2);
//     console.log("Top K similar users:", topKSimilar);
//   } catch (error) {
//     console.error("An error occurred:", error);
//   }
// }
// 
// main();