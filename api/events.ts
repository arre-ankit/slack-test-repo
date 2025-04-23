import type { SlackEvent } from '@slack/web-api';
import { waitUntil } from '@vercel/functions';
import { verifyRequest, getBotId } from '../lib/slack-utils';
import { appMentionAgent } from '../lib/app-mention-agent';
import {
	assistantThreadMessageAgent,
	assistantMessageAgent
} from '../lib/handle-message-agent';

export async function POST(request: Request) {
	const rawBody = await request.json();
	const payload = rawBody;
	const requestType = payload.type as 'url_verification' | 'event_callback';

	const isRequestTypeUrlVerification = requestType === 'url_verification';
	if (isRequestTypeUrlVerification) {
		return new Response(payload.challenge, { status: 200 });
	}

	const isRequestVerified = await verifyRequest({
		requestType,
		request,
		rawBody
	});
	if (!isRequestVerified) {
		return new Response('Unauthorized', { status: 401 });
	}

	try {
		const botUserIdResult = await getBotId();
		if (!botUserIdResult.data) {
			console.error('Error getting bot ID:', botUserIdResult.error);
			return new Response('Error getting bot ID', { status: 500 });
		}

		const botUserId = botUserIdResult.data;
		const event = payload.event as SlackEvent;

		const isAppMention = event.type === 'app_mention';
		const isAssistantThreadStarted =
			event.type === 'assistant_thread_started';
		const isMessage =
			event.type === 'message' &&
			!event.subtype &&
			event.channel_type === 'im' &&
			!event.bot_id &&
			!event.bot_profile &&
			event.bot_id !== botUserId;

		if (isAppMention) {
			waitUntil(appMentionAgent({event, botUserId}));
		}

		if (isAssistantThreadStarted) {
			waitUntil(assistantThreadMessageAgent(event));
		}

		if (isMessage) {
			waitUntil(assistantMessageAgent({event, botUserId}));
		}

		return new Response('Success!', { status: 200 });
	} catch (error) {
		console.error('Error generating response', error);
		return new Response('Error generating response', { status: 500 });
	}
}
