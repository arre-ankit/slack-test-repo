'use server';

import type {
	AssistantThreadStartedEvent,
	GenericMessageEvent
} from '@slack/web-api';
import { client, getThread } from './slack-utils';
import { runAgent } from './agent';

/**
 * Handles the assistant thread started event by posting a welcome message
 * @param event The assistant thread started event
 */
export async function assistantThreadMessageAgent(
	event: AssistantThreadStartedEvent
): Promise<{ success: boolean; error: string | null }> {
	try {
		const { channel_id, thread_ts } = event.assistant_thread;

		if (!channel_id || !thread_ts) {
			console.error('Missing required event data:', {
				channel_id,
				thread_ts
			});
			return {
				success: false,
				error: 'Missing required event data'
			};
		}

		await client.chat.postMessage({
			channel: channel_id,
			thread_ts: thread_ts,
			text: "Hello, I'm an Agent! I'm here to help you with your questions."
		});

		return {
			success: true,
			error: null
		};
	} catch (error) {
		console.error('Error in assistantThreadMessageAgent:', error);
		return {
			success: false,
			error: `Something went wrong while posting the welcome message. Please try again.`
		};
	}
}

/**
 * Processes messages in an assistant thread and generates responses using the agent
 * @param event The Slack message event
 * @param botUserId The bot's user ID
 * @returns Object with operation result or error
 */
export async function assistantMessageAgent({
	event,
	botUserId
}: {
	event: GenericMessageEvent;
	botUserId: string;
}): Promise<{ success: boolean; error: string | null }> {
	// Skip processing if message is from a bot or not in a thread
	const shouldSkipResponse =
		event.bot_id ||
		event.user === botUserId ||
		event.bot_profile ||
		!event.thread_ts;

	if (shouldSkipResponse) {
		return {
			success: true,
			error: null
		};
	}

	// Extract event data
	const { thread_ts, channel } = event;

	if (!channel || !thread_ts) {
		return {
			success: false,
			error: 'Missing channel or thread_ts information'
		};
	}

	try {
		// Update status to indicate agent is thinking
		const status = 'agent is thinking...';

		await client.assistant.threads.setStatus({
			channel_id: channel,
			thread_ts,
			status
		});
	} catch (error) {
		console.error('Error in assistantMessageAgent:', error);
		return {
			success: false,
			error: `Something went wrong while updating status. Please try again.`
		};
	}

	// Fetch thread messages
	const messagesResult = await getThread({
		channel_id: channel,
		thread_ts,
		botUserId
	});

	if (messagesResult.error) {
		console.error(
			'Error processing thread messages:',
			messagesResult.error
		);
		return {
			success: false,
			error: 'Something went wrong while processing thread messages'
		};
	}

	const messages = messagesResult.data;

	if (!messages || messages.length === 0) {
		return {
			success: false,
			error: 'No messages found in thread'
		};
	}

	// Prepare content for agent
	const content = messages.map(m => m.content).join('\n');

	// Process with agent
	const agentResult = await runAgent(content);

	if (agentResult.error) {
		console.error('Agent processing error:', agentResult.error);
		await client.chat.postMessage({
			channel: channel,
			thread_ts: thread_ts,
			text: `Something went wrong while processing the message. Please try again.`
		});

		return {
			success: false,
			error: 'Something went wrong while processing the message. Please try again.'
		};
	}

	try {
		// Post agent response
		await client.chat.postMessage({
			channel: channel,
			thread_ts: thread_ts,
			text: agentResult.data,
			unfurl_links: false,
			blocks: [
				{
					type: 'section',
					text: {
						type: 'mrkdwn',
						text: agentResult.data
					}
				}
			]
		});
	} catch (error) {
		console.error('Error in assistantMessageAgent:', error);
		return {
			success: false,
			error: 'Something went wrong while posting the response message. Please try again.'
		};
	}

	try {
		// Clear status message
		await client.assistant.threads.setStatus({
			channel_id: channel,
			thread_ts,
			status: ''
		});
	} catch (error) {
		console.error('Error in assistantMessageAgent:', error);
		return {
			success: false,
			error: `Something went wrong while clearing status. Please try again.`
		};
	}

	return {
		success: true,
		error: null
	};
}
