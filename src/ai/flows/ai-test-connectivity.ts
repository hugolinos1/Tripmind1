'use server';
/**
 * @fileOverview A Genkit flow for testing basic connectivity to the AI model.
 *
 * - testAiConnectivity - A function that calls the AI model with a simple prompt.
 * - TestConnectivityInput - The input type for the function.
 * - TestConnectivityOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export type TestConnectivityInput = string;
export type TestConnectivityOutput = string;

export async function testAiConnectivity(prompt: TestConnectivityInput): Promise<TestConnectivityOutput> {
  return testConnectivityFlow(prompt);
}

const testConnectivityFlow = ai.defineFlow(
  {
    name: 'testConnectivityFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (prompt) => {
    const llmResponse = await ai.generate({
      prompt: `This is a connectivity test. Please respond with a short, simple, polite confirmation message in French confirming you received the following message. Your response should only contain that confirmation. The message is: "${prompt}"`,
    });
    return llmResponse.text;
  }
);
