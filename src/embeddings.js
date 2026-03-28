/**
 * Embedding generation for VyasaGraph vector search
 * @module embeddings
 */

import OpenAI from 'openai';

let openai = null;

/**
 * Initialize OpenAI client
 */
function getClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Generate embedding for text
 * @param {string} text - Text to embed
 * @returns {Promise<number[]|null>} 1536-dimension embedding vector or null if no API key
 */
export async function generateEmbedding(text) {
  const client = getClient();
  
  if (!client) {
    return null;  // No API key configured
  }

  try {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 1536
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Embedding generation failed:', error.message);
    return null;
  }
}

/**
 * Generate embeddings for multiple texts (batch)
 * @param {string[]} texts - Array of texts to embed
 * @returns {Promise<Array<number[]|null>>}
 */
export async function generateEmbeddings(texts) {
  const client = getClient();
  
  if (!client) {
    return texts.map(() => null);
  }

  try {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
      dimensions: 1536
    });

    return response.data.map(d => d.embedding);
  } catch (error) {
    console.error('Batch embedding generation failed:', error.message);
    return texts.map(() => null);
  }
}
