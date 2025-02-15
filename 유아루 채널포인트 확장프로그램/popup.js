chrome.runtime.onMessage.addListener((message) => {
    const msgDiv = document.getElementById("messages");
    const newMsg = document.createElement("p");

    if (message.type === "websocket_message") {
        newMsg.textContent = `[FROM: ${message.from}] ${message.message}`;
    } else if (message.type === "websocket_broadcast") {
        newMsg.textContent = `[BROADCAST: ${message.from}] ${message.message}`;
    }

    msgDiv.appendChild(newMsg);
});
