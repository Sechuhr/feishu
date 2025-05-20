import { Configuration, OpenAIApi } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

export async function chatWithGpt(prompt) {
  try {
    const resp = await openai.createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });
    return resp.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI error:', error.response?.data || error.message);
    return 'ChatGPT is temporarily unavailable, please try again later.';
  }
}
