// lokiPush.js

export default class Telemetry {
    telemetryEnabled = true;
    loggingURL = "https://apoh.alexkarpinski.com/loki/api/v1/push";

    constructor() {
        this.telemetryToggle = document.createElement("button");
        this.telemetryToggle.id = "telemetry";
        this.telemetryToggle.classList.add("action");
        this.telemetryToggle.classList.add("margin-top");
        this.telemetryToggle.innerText = "Telemetry On";
        this.telemetryToggle.addEventListener("click", () => {
            this.toggleTelemetry();
        });
    }

    toggleTelemetry() {
        this.telemetryEnabled = !this.telemetryEnabled;
        this.telemetryToggle.innerText = this.telemetryEnabled
            ? "Telemetry On"
            : "Telemetry Off";
    }

    attachControls(parent) {
        parent.appendChild(this.telemetryToggle);
    }

    async log(message, tags = {}) {
        if (!this.telemetryEnabled) {
            return;
        }

        var payload = {
            streams: [
                {
                    stream: tags,
                    values: [[(Date.now() * 1000000).toString(), message]],
                },
            ],
        };

        try {
            const response = await fetch(this.loggingURL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error("Network response was not ok");
            }

            return response;
        } catch (error) {
            console.error(
                "There was a problem with your fetch operation:",
                error
            );
            throw error;
        }
    }
}
