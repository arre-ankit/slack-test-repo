#  Chai Agent as Slack Bot

## Features

* Seamless integration with Slack's API
* Powered by Langbase and Chai agent API
* Responds to: 
    * App mentions in channels
    * Direct messages (DMs)
* Maintains conversation context across threads, DMs, and channels

## Prerequisites

* Node.js 18+
* Slack workspace with admin privileges
* Langbase account and API key
* Slack App with relevant scopes
* Hosting (e.g., Vercel) or local development env

### Create Your Slack App

1. Visit https://api.slack.com/apps
2. Click “Create New App” → “From scratch”
3. Name your app and choose your workspace

### Configure Slack App Settings

#### Basic Information

* Under "App Credentials", note down your "Signing Secret"

#### OAuth & Permissions

* Add the following Bot Token Scopes: 
    * `app_mentions:read`
    * `assistant:write`
    * `chat:write`
    * `im:history`
    * `im:read`
    * `im:write`
    * `channels:history`
* Install the app to your workspace and note down the "Bot User OAuth Token"

### Deploying to Vercel

1. Fork this template
2. Deploy to Vercel: 
    * Go to vercel.com
    * Import this GitHub repository

1. Add your environment variables in the Vercel project settings: 

   ```
   SLACK_BOT_TOKEN='<your-bot-token>'
   SLACK_SIGNING_SECRET='<your-signing-secret>'
   LANGBASE_API_KEY='<your-langbase-api-key>'
   ```

### Event Subscriptions configuration:

* In your App
* Go to "Event Subscriptions"
* Enable Events
* Set the Request URL to either your local URL or your deployment URL: (e.g. https://your-app.vercel.app/api/events)
* Save Changes
* Under "Subscribe to bot events", add: 
    * `app_mention`
    * `assistant_thread_started`
    * `message:im`

| Remember to include `/api/events` in the Request URL.

### For Direct Message:

* In your App
* Go to APP Home
* Enable Chat Tab
* Allow users to send Slash commands and messages from the chat tab


### Usage

The bot will respond to:
1. Direct messages - Send a DM to your bot
2. Mentions - Mention your bot in a channel using `@YourBotName`

The bot maintains context within both threads and direct messages, so it can follow along with the conversation.
