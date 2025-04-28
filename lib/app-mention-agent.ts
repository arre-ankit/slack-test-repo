'use server';

import { AppMentionEvent } from '@slack/web-api';
import { client, getThread, getChannelMessages } from './slack-utils';
import { runAgent } from './agent';

/**
 * Posts a status message in a Slack thread
 * @param params Object containing event and status message
 * @returns Object with data (message timestamp) or error
 */
const postStatusMessage = async ({
	event,
	status
}: {
	event: AppMentionEvent;
	status: string;
}): Promise<{ data: string | null; error: string | null }> => {
	try {
		const initialMessage = await client.chat.postMessage({
			channel: event.channel,
			thread_ts: event.thread_ts ?? event.ts,
			text: status
		});

		if (!initialMessage || !initialMessage.ok || !initialMessage.ts) {
			console.error('Failed to post initial message:', initialMessage);
			return { data: null, error: 'Failed to post initial message' };
		}

		return { data: initialMessage.ts, error: null };
	} catch (error) {
		console.error('Error posting status message:', error);
		return {
			data: null,
			error: 'Something went wrong while posting initial status'
		};
	}
};

/**
 * Updates an existing Slack message
 * @param params Object containing message update parameters
 * @returns Object with operation success status or error
 */
const updateStatusMessage = async ({
	channel,
	messageTs,
	text
}: {
	channel: string;
	messageTs: string;
	text: string;
}): Promise<{ data: boolean | null; error: string | null }> => {
	try {
		const updateResult = await client.chat.update({
			channel,
			ts: messageTs,
			text
		});

		if (!updateResult || !updateResult.ok) {
			console.error('Failed to update message:', updateResult);
			return { data: null, error: 'Failed to update message' };
		}

		return { data: true, error: null };
	} catch (error) {
		console.error('Error updating status message:', error);
		return {
			data: null,
			error: 'Something went wrong while updating status message'
		};
	}
};

/**
 * Processes app mention events and runs the agent with appropriate context
 * @param event The Slack app mention event
 * @param botUserId The bot's user ID
 * @returns Object with operation result or error
 */
export async function appMentionAgent({
	event,
	botUserId
}: {
	event: AppMentionEvent;
	botUserId: string;
}): Promise<{ success: boolean; error: string | null }> {
	try {
		// Skip if the message is from a bot
		if (event.bot_id || event.user === botUserId || event.bot_profile) {
			console.log('Skipping app mention from bot');
			return { success: true, error: null };
		}

		const { thread_ts, channel } = event;
		const status = 'Agent is thinking...';

		// Post initial status message
		const statusResult = await postStatusMessage({ event, status });

		if (statusResult.error) {
			console.error('Status message posting failed:', statusResult.error);
			return { success: false, error: statusResult.error };
		}

		const messageTs = statusResult.data;
		if (!messageTs) {
			return { success: false, error: 'Message timestamp is undefined' };
		}

		let agentResult;

		// Handle thread messages
		if (thread_ts) {
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
					error: 'Failed to retrieve thread messages or thread is empty'
				};
			}

			const content = messages.map(m => m.content).join('\n');
			agentResult = await runAgent(content);
		}
		// Handle channel messages
		else {
			const channelMessagesResult = await getChannelMessages({
				channel_id: channel
			});

			if (channelMessagesResult.error) {
				console.error(
					'Error processing channel messages:',
					channelMessagesResult.error
				);
				return {
					success: false,
					error: 'Something went wrong while processing channel messages'
				};
			}

			const channelMessages = channelMessagesResult.data;

			if (!channelMessages || channelMessages.length === 0) {
				agentResult = { success: false, error: 'No context found' };
			} else {
				const content = channelMessages
					.map(msg => msg.content)
					.join('\n');
				agentResult = await runAgent(content);
			}
		}

		// Update the status message with the agent's response
		if (!agentResult || agentResult.error) {
			const errorMessage =
				agentResult?.error || 'Unknown error with agent processing';
			const updateResult = await updateStatusMessage({
				channel: event.channel,
				messageTs,
				text: `${errorMessage}`
			});

			if (updateResult.error) {
				console.error(
					'Failed to update message with error:',
					updateResult.error
				);
			}

			return {
				success: false,
				error: 'Something went wrong with agent processing!'
			};
		}

		// Update message with success result
		const updateResult = await updateStatusMessage({
			channel: event.channel,
			messageTs,
			text: agentResult.data
		});

		if (updateResult.error) {
			console.error(
				'Failed to update message with result:',
				updateResult.error
			);
			return {
				success: false,
				error: 'Something went wrong with agent processing!'
			};
		}

		return { success: true, error: null };
	} catch (error) {
		console.error('Unhandled error in appMentionAgent:', error);
		return {
			success: false,
			error: 'Error processing mention'
		};
	}
}