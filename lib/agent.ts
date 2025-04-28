'use server';

import { error } from 'console';

/**
 * Runs an AI agent with the provided content and returns the response
 * @param content The input content to process
 * @returns Object with agent response data or error
 */
export const runAgent = async (
	content: string
): Promise<{ data: any | null; error: string | null }> => {
	// Validate environment variables
	const ownerLogin = process.env.OWNER_LOGIN;
	const agentName = process.env.AGENT_NAME;
	const apiKey = process.env.LANGBASE_API_KEY;

	if (!ownerLogin || !agentName || !apiKey) {
		console.error('Missing required environment variables');
		return {
			data: null,
			error: 'Configuration error: Missing required environment variables'
		};
	}

	const api = `https://api.langbase.com/${ownerLogin}/${agentName}`;

	try {
		// Validate input
		if (!content || content.trim() === '') {
			return {
				data: null,
				error: 'Invalid input: Content cannot be empty'
			};
		}

		const response = await fetch(api, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ input: content })
		});

		if (!response.ok) {
			console.error(`API request failed: ${error}`);
			return {
				data: null,
				error: 'Something went wrong while running the agent'
			};
		}

		const agentResponse = await response.json();
		if (!agentResponse) {
			return {
				data: null,
				error: 'Empty response received'
			};
		}

		return {
			data: agentResponse,
			error: null
		};
	} catch (error) {
		console.error('Error in runAgent:', error);
		return {
			data: null,
			error: 'Something went wrong while running the agent'
		};
	}
};