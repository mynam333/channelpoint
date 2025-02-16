let socketMap = new Map();
let latestChannelPoints = new Map();
let latestRewards = new Map();
let streamerSockets = new Map();
let streamerUUID;
let start = false;
let client;

// JSON 파일에서 웹소켓 주소 불러오기
async function loadStreamerSockets(streamerUUID) {
    try {
        await fetch("https://raw.githubusercontent.com/mynam333/channelpoint/refs/heads/main/streamerSockets.json", { method: "GET", })
            .then((response) => response.json())
            .then((data) => {
                streamerSockets = new Map(Object.entries(data)); // JSON 데이터를 Map으로 변환

                console.log("✅ 스트리머 웹소켓 주소 불러오기 완료:", streamerSockets);
                console.log(data)
                if (data[streamerUUID]) {
                    console.log("✅ 스트리머 UUID 불러오기 완료:", streamerUUID);
                    connectWebSocket(streamerUUID);
                }
            })
    } catch (error) {
        console.error("❌ JSON 로드 오류:", error);
    }
}

// 클라이언트 UUID 가져오기
async function getClientUUID(targetUrl) {
    try {
        const response = await fetch(targetUrl, {
            method: "GET",
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error(`HTTP 오류! 상태 코드: ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ 응답 데이터:", data);
        return data;
    } catch (error) {
        console.error("❌ 데이터 가져오기 실패:", error);
        return null;
    }
}

// `content.js`에서 웹소켓 데이터를 요청할 때 응답
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.streamerUUID) {
        streamerUUID = message.streamerUUID;
    }
    if (message.type === "start_websockets" && !start) {
        console.log(`🚀 웹소켓 시작 - ${streamerUUID}`);
        start = true;
        loadStreamerSockets(streamerUUID);
    } else if (message.type === "request_channel_points") {
        console.log(`📩 채널 포인트 요청 (${streamerUUID})`);

        if (socketMap.has(streamerUUID)) {
            const socket = socketMap.get(streamerUUID);
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "getPoint", targetUUID: client.content.userIdHash }));
            }
        }
        sendResponse({ points: latestChannelPoints.get(streamerUUID) || 0 });
    } else if (message.type === "request_rewards") {
        console.log(`📩 보상 목록 요청 (${streamerUUID})`);

        if (socketMap.has(streamerUUID)) {
            const socket = socketMap.get(streamerUUID);
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "get_rewards" }));
            }
        }
        sendResponse({ rewards: latestRewards.get(streamerUUID) || {} });
    } else if (message.type === "redeem_reward") {
        const { rewardPoints, inputValue } = message;
        console.log(`🎯 보상 사용 요청 (${streamerUUID}): ${rewardPoints.이름} (${rewardPoints.포인트} 포인트) | 입력값: ${inputValue}`);

        if (socketMap.has(streamerUUID)) {
            const socket = socketMap.get(streamerUUID);
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: "redeem_reward",
                    uuid: client.content.userIdHash,
                    user: client.content.nickname,
                    name: rewardPoints.이름,
                    points: rewardPoints.포인트,
                    input: inputValue
                }));
            }
        }
    }
});

// 웹소켓 연결 함수
async function connectWebSocket(streamerUUID) {
    client = await getClientUUID('https://comm-api.game.naver.com/nng_main/v1/user/getUserStatus');

    if (client?.content?.loggedIn && streamerSockets.has(streamerUUID)) {
        const wsUrl = `${streamerSockets.get(streamerUUID)}?uuid=${client.content.userIdHash}`;
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log(`✅ 웹소켓 연결됨: (Streamer: ${streamerUUID}, User: ${client.content.userIdHash})`);
            socket.send(JSON.stringify({ type: "getPoint", targetUUID: streamerUUID }));
            socket.send(JSON.stringify({ type: "get_rewards", streamerUUID }));
        };

        socket.onmessage = async (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "assign_uuid") {
                console.log("📌 서버에서 할당된 UUID:", data.uuid);
            } else if (data.type === "message") {
                console.log(`📩 받은 메시지: [${data.from}] ${data.message}`);
                chrome.runtime.sendMessage({ type: "websocket_message", from: data.from, message: data.message });
            } else if (data.type === "broadcast") {
                console.log(`📢 브로드캐스트: [${data.from}] ${data.message}`);
                chrome.runtime.sendMessage({ type: "websocket_broadcast", from: data.from, message: data.message });
            } else if (data.type === "channel_points") {
                latestChannelPoints.set(streamerUUID, data.points);
                chrome.runtime.sendMessage({ type: "update_channel_points", points: data.points });
            } else if (data.type === "channel_rewards") {
                latestRewards.set(streamerUUID, data.rewards);
                chrome.runtime.sendMessage({ type: "update_rewards", rewards: data.rewards });
            } else if (data.type === "error") {
                console.error("🚨 오류:", data.message);
            }
        };

        socket.onclose = () => {
            console.log(`🔴 웹소켓 종료됨 (Streamer: ${streamerUUID}). 5초 후 재연결...`);
            setTimeout(() => connectWebSocket(streamerUUID), 5000);
        };

        socketMap.set(streamerUUID, socket);
    } else {
        console.log(`❌ 로그인하지 않았거나 해당 스트리머(${streamerUUID})의 웹소켓 주소가 없습니다!`);
    }
}

// 웹소켓 종료 함수
function closeWebSocket(streamerUUID) {
    if (socketMap.has(streamerUUID)) {
        socketMap.get(streamerUUID).close();
        socketMap.delete(streamerUUID);
    }
}

// 모든 탭이 닫힐 경우 모든 웹소켓 종료
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.log(`🛑 탭 ${tabId} 닫힘. 모든 웹소켓 종료.`);
    for (const [streamerUUID] of socketMap) {
        closeWebSocket(streamerUUID);
    }
});
