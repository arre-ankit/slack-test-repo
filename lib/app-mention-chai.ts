'use server'

import { AppMentionEvent } from "@slack/web-api";
import { client, getThreadLangBase, getChannelMessages } from "./slack-utils";
import { chaiAgent } from "./chai-agent";
const updateStatusUtil = async (
    initialStatus: string,
    event: AppMentionEvent,
) => {
    const initialMessage = await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts ?? event.ts,
        text: initialStatus,
    });

    const isInitialMessageFailed = !initialMessage || !initialMessage.ts;
    if (isInitialMessageFailed)
        throw new Error("Failed to post initial message");

    const updateMessage = async (status: string) => {
        await client.chat.update({
            channel: event.channel,
            ts: initialMessage.ts as string,
            text: status,
        });
    };
    return updateMessage;
};

export async function appMentionChai(
    event: AppMentionEvent,
    botUserId: string,
) {
    const isBotNotMentioned = event.bot_id || event.bot_id === botUserId || event.bot_profile;
    if (isBotNotMentioned) {
        console.log("Skipping app mention");
        return;
    }

    const { thread_ts, channel } = event;
    const updateMessage = await updateStatusUtil("is running...", event);

    if (thread_ts) {
        const messages = await getThreadLangBase(channel, thread_ts, botUserId);
        const content = messages.map(m => m.content).join('\n')
        const result = await chaiAgent(content);
        await updateMessage(result);
    } 
    else {
        const channelMessages = await getChannelMessages(channel);
        if (!channelMessages) {
            await updateMessage("Give some context to the agent");
            return;
        }
        const content = channelMessages.map(msg => msg.text).join("\n");
        const result = await chaiAgent(content);
        await updateMessage(result);
    }
}