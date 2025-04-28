'use server';

import { WebClient } from '@slack/web-api';
import crypto from 'crypto';
import { Message } from 'langbase';

export const client = new WebClient(process.env.SLACK_BOT_TOKEN);

// See https://api.slack.com/authentication/verifying-requests-from-slack
export async function isValidSlackRequest({
	request,
	rawBody
}: {
	request: Request;
	rawBody: string;
}) {
	try {
		// console.log('Validating Slack request')
		const timestamp = request.headers.get('X-Slack-Request-Timestamp');
		const slackSignature = request.headers.get('X-Slack-Signature');

		if (!timestamp || !slackSignature) {
			console.log('Missing timestamp or signature');
			return false;
		}

		// Prevent replay attacks on the order of 5 minutes
		const currentTime = Math.floor(Date.now() / 1000);
		const timeDiff = Math.abs(currentTime - parseInt(timestamp));
		const isTimeMoreThanFiveMinutes = timeDiff > 60 * 5;
		if (isTimeMoreThanFiveMinutes) {
			console.log('Timestamp out of range');
			return false;
		}

		const base = `v0:${timestamp}:${rawBody}`;
		const hmac = crypto
			.createHmac('sha256', process.env.SLACK_SIGNING_SECRET!)
			.update(base)
			.digest('hex');
		const computedSignature = `v0=${hmac}`;

		// Prevent timing attacks
		return crypto.timingSafeEqual(
			Buffer.from(computedSignature),
			Buffer.from(slackSignature)
		);
	} catch (error) {
		console.error('Error:', error);
		return false;
	}
}

export const verifyRequest = async ({
	requestType,
	request,
	rawBody
}: {
	requestType: string;
	request: Request;
	rawBody: string;
}) => {
	try {
		const validRequest = await isValidSlackRequest({ request, rawBody });
		const isReqNotValid = !validRequest || requestType !== 'event_callback';
		if (isReqNotValid) {
			return new Response('Invalid request', { status: 400 });
		}
	} catch (error) {
		console.error('Error in verifyRequest:', error);
		return new Response(
			'Something went wrong while verifying request. Please try again.',
			{ status: 500 }
		);
	}
};

export async function getThread({
	channel_id,
	thread_ts,
	botUserId
}: {
	channel_id: string;
	thread_ts: string;
	botUserId: string;
}): Promise<{ data: Message[] | null; error: string | null }> {
	try {
		const { messages } = await client.conversations.replies({
			channel: channel_id,
			ts: thread_ts,
			limit: 50
		});

		// Ensure we have messages
		if (!messages) {
			return {
				data: null,
				error: 'No messages found in thread'
			};
		}

		const result = messages
			.map(message => {
				const isBot = !!message.bot_id;
				if (!message.text) return null;

				// For app mentions, remove the mention prefix
				// For IM messages, keep the full text
				let content = message.text;
				if (!isBot && content.includes(`<@${botUserId}>`)) {
					content = content.replace(`<@${botUserId}> `, '');
				}

				return {
					role: isBot ? 'assistant' : 'user',
					content: content
				} as Message;
			})
			.filter((msg): msg is Message => msg !== null);

		return {
			data: result,
			error: null
		};
	} catch (error) {
		console.error('Error in getThread:', error);
		return {
			data: null,
			error: 'Something went wrong while getting thread messages. Please try again.'
		};
	}
}

export async function getChannelMessages({
	channel_id
}: {
	channel_id: string;
}): Promise<{ data: Message[] | null; error: string | null }> {
	try {
		const { messages } = await client.conversations.history({
			channel: channel_id,
			limit: 5
		});

		if (!messages) {
			return {
				data: null,
				error: 'No messages found in channel'
			};
		}

		const result = messages
			.map(message => {
				const isBot = !!message.bot_id;
				if (!message.text) return null;

				return {
					role: isBot ? 'assistant' : 'user',
					content: message.text
				} as Message;
			})
			.filter((msg): msg is Message => msg !== null);

		return {
			data: result,
			error: null
		};
	} catch (error) {
		console.error('Error in getChannelMessages:', error);
		return {
			data: null,
			error: 'Something went wrong while getting channel messages. Please try again.'
		};
	}
}

export const getBotId = async (): Promise<{
	data: string | null;
	error: string | null;
}> => {
	try {
		const { user_id: botUserId } = await client.auth.test();

		if (!botUserId) {
			return {
				data: null,
				error: 'botUserId is undefined'
			};
		}

		return {
			data: botUserId,
			error: null
		};
	} catch (error) {
		console.error('Error in getBotId:', error);
		return {
			data: null,
			error: 'Something went wrong while getting bot ID. Please try again.'
		};
	}
};