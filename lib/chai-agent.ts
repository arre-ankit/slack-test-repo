'use server'

export const chaiAgent = async (content: string) => {
	const api = `https://staging-api.langbase.com/${process.env.LANGBASE_USER_NAME}/${process.env.LANGBASE_AGENT_NAME}`;
    const response = await fetch(api, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.LANGBASE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({"input":content})
    });

    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }

    const agentResponse = await response.json();
    console.log('Agent response:', agentResponse);

	return agentResponse
}
