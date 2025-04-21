'use server'

import type { AssistantThreadStartedEvent, GenericMessageEvent } from "@slack/web-api";
import { client, getThreadLangBase, updateStatusUtil } from "./slack-utils";
import { chaiAgent } from "./chai-agent";
export async function assistantThreadMessageChai(event: AssistantThreadStartedEvent) {
	const { channel_id, thread_ts } = event.assistant_thread;
	
	await client.chat.postMessage({
		channel: channel_id,
		thread_ts: thread_ts,
		text: "Hello, I'm an your Chai Agent!"
    });
  
}
  
export async function assistantMessageChai(
	event: GenericMessageEvent,
	botUserId: string,
  ) {
	
	const shouldSkipResponse = event.bot_id || event.bot_id === botUserId || event.bot_profile || !event.thread_ts
	if (shouldSkipResponse)
    return;

	if (!event.thread_ts)
		return;

  
	const { thread_ts, channel } = event;
	const updateStatus = updateStatusUtil(channel, thread_ts);
	updateStatus("is running...");

	const messages = await getThreadLangBase(channel, thread_ts, botUserId);
	const content = messages.map(m => m.content).join('\n')
	const result = await chaiAgent(content);
  
    await client.chat.postMessage({
		channel: channel,
		thread_ts: thread_ts,
		text: result,
		unfurl_links: false,
		blocks: [
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: result,
				},
			},
      	],
    });
  
    updateStatus("");
}
  