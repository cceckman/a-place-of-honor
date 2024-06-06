// lokiPush.js

export async function pushToLoki(message, tags = {}) {
    var payload = {
        streams: [
            {
                stream: tags,
                values: [[(Date.now() * 1000000).toString(), message]],
            },
        ],
    };

    try {
        const response = await fetch(
            "https://apoh.alexkarpinski.com/loki/api/v1/push",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        if (!response.ok) {
            throw new Error("Network response was not ok");
        }

        return response;
    } catch (error) {
        console.error("There was a problem with your fetch operation:", error);
        throw error;
    }
}
