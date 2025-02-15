let socket;
let latestChannelPoints = 0;
let latestRewards = [];
let streamerUUID;

// 스트리머별 웹소켓 주소 설정
const streamerSockets = new Map([
    ["6d395c84c99777272f872171b4dfc122", "ws://ws.yuaru.kr:8081"]
]);

async function getClientUUID(targetUrl) {
    try {
        const response = await fetch(targetUrl, {
            method: "GET",
            credentials: "include" // 브라우저의 쿠키를 자동 포함
        });

        if (!response.ok) {
            throw new Error(`HTTP 오류! 상태 코드: ${response.status}`);
        }

        const data = await response.json(); // JSON 변환
        console.log("응답 데이터:", data);
        return data; // JSON 데이터 반환
    } catch (error) {
        console.error("데이터 가져오기 실패:", error);
        return null; // 오류 발생 시 null 반환
    }
}

async function connectWebSocket() {

    const client = await getClientUUID('https://comm-api.game.naver.com/nng_main/v1/user/getUserStatus'); // 클라이언트가 사용할 고유 UUID

    // `content.js`에서 웹소켓 데이터를 요청할 때 응답
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.streamerUUID) {
            streamerUUID = message.streamerUUID;
        }
        if (message.type === "request_channel_points") {
            console.log("채널 포인트 요청 수신, 현재 포인트:", latestChannelPoints);

            // 웹소켓을 통해 새로운 데이터를 요청하는 기능 (서버가 지원하는 경우)
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "get_channel_points", streamerUUID: message.streamerUUID, targetUUID: client.content.userIdHash })); // 서버에서 새 데이터 요청
            }

            // 현재 저장된 포인트를 바로 반환
            sendResponse({ points: latestChannelPoints });
        } else if (message.type === "request_rewards") {
            console.log("보상 목록 요청 수신, 현재 보상 개수:", latestRewards.length);

            // 서버에 새 데이터 요청 (선택사항)
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "get_rewards", streamerUUID: message.streamerUUID }));
            }

            // 현재 저장된 보상 리스트를 반환
            sendResponse({ rewards: latestRewards });
        } else if (message.type === "redeem_reward") {
            const { rewardName, rewardPoints, inputValue } = message;

            console.log(`보상 사용 요청: ${rewardName} (${rewardPoints} 포인트) | 입력값: ${inputValue}`);

            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "redeem_reward", name: rewardName, points: rewardPoints, input: inputValue }));
            }
        }
    });

    if (client?.content?.loggedIn && streamerSockets.has(streamerUUID)) {
        const wsUrl = `${streamerSockets.get(streamerUUID)}?uuid=${client.content.userIdHash}`;
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log("웹소켓 연결됨:", client.content.userIdHash);
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "assign_uuid") {
                console.log("서버에서 할당된 UUID:", data.uuid);
            } else if (data.type === "message") {
                console.log(`받은 메시지: [${data.from}] ${data.message}`);
                chrome.runtime.sendMessage({ type: "websocket_message", from: data.from, message: data.message });
            } else if (data.type === "broadcast") {
                console.log(`브로드캐스트: [${data.from}] ${data.message}`);
                chrome.runtime.sendMessage({ type: "websocket_broadcast", from: data.from, message: data.message });
            } else if (data.type === "channel_points") {
                latestChannelPoints = data.points; // 최신 채널 포인트 값 저장
                chrome.runtime.sendMessage({ type: "update_channel_points", points: latestChannelPoints });
            } else if (data.type === "channel_rewards") {
                latestRewards = data.rewards; // 최신 보상 리스트 저장
                chrome.runtime.sendMessage({ type: "update_rewards", rewards: latestRewards });
            } else if (data.type === "error") {
                console.error("오류:", data.message);
            }
        };

        socket.onclose = () => {
            console.log("웹소켓 연결 종료됨. 5초 후 재연결 시도...");
            setTimeout(connectWebSocket, 5000);
        };
    } else {
        console.log('로그인하지 않았습니다!');
    }
}

// 웹소켓 종료 함수
function closeWebSocket() {
    if (socket) {
        socket.close();
        socket = null;
    }
}

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.log(`탭 ${tabId}이 ${removeInfo}에 의해 닫힘. 웹소켓 종료.`);
    closeWebSocket();
});

connectWebSocket();
