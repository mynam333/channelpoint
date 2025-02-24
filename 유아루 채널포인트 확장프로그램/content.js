let popup; // 팝업 요소를 저장할 변수
let channelPoints = 0;
let rewards = [];
let broadcastUid;
let streamerList = [];
let chatChannelId;

async function fetchchatChannelId() {
  await fetch(`https://api.chzzk.naver.com/polling/v3/channels/${broadcastUid}/live-status`, { method: "GET", credentials: "include", })
    .then((response) => response.json())
    .then((data) => {
      chatChannelId = data.content.chatChannelId;
      console.log(chatChannelId)
      return chatChannelId;
    })
}

async function isBan() {
  try {
    const response = await fetch(`https://comm-api.game.naver.com/nng_main/v1/chats/access-token?channelId=${chatChannelId}&chatType=STREAMING`, { method: "GET", credentials: "include", });
    const data = await response.json();
    console.log(data)

    if (data.code !== 200) {
      alert("해당 스트리머에게 차단당하셨습니다.");
      return false;
    }
    return true;
  } catch (error) {
    console.error("API 요청 중 오류 발생:", error);
    return false; // 오류 발생 시 기본적으로 차단된 것으로 처리
  }
}

async function fetchStreamerList() {
  await fetch("https://raw.githubusercontent.com/mynam333/channelpoint/refs/heads/main/streamerSockets.json", { method: "GET", })
    .then((response) => response.json())
    .then((data) => {
      streamerList = Object.keys(data);
      checkBroadcastUid();
    })
}
fetchStreamerList();

// 메시지를 보낼 때 오류 확인
async function safeSendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.error("🚨 메시지 전송 오류:", chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

function waitForElement(selector, callback) {
  const observer = new MutationObserver(() => {
    const element = document.getElementById(selector);
    if (element) {
      observer.disconnect(); // 요소가 발견되면 감시 중지
      callback(element);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// 버튼 추가 함수
function addButton() {
  if (document.getElementById("yuaru-channelpoint")) return; // 중복 추가 방지

  waitForElement("aside-chatting", (targetElement) => {

    const button = document.createElement("button");
    button.id = "yuaru-channelpoint";
    button.textContent = "채널포인트";
    button.style.position = "fixed";
    button.style.bottom = "10px";
    button.style.right = "70px";
    button.style.zIndex = "1000";
    button.style.padding = "6px 6px";
    button.style.backgroundColor = "rgba(46,48,51,1)";
    button.style.color = "rgba(209,210,212,1)";
    button.style.border = "none";
    button.style.borderRadius = "8px";
    button.style.cursor = "pointer";
    button.style.fontFamily = "Sandoll Nemony2, Apple SD Gothic NEO, Helvetica Neue, Helvetica, 나눔고딕, NanumGothic, Malgun Gothic, 맑은 고딕, 굴림, gulim, 새굴림, noto sans, 돋움, Dotum, sans-serif";
    button.style.fontSize = "12px";

    // 버튼 클릭 시 팝업 열기/닫기
    button.addEventListener("click", togglePopup);

    targetElement.appendChild(button);

    chrome.runtime.sendMessage({ type: "start_websockets", streamerUUID: broadcastUid });
  });
}

// 버튼 삭제 함수
function removeButton() {
  const button = document.getElementById("yuaru-channelpoint");
  if (button) {
    button.remove();
  }
}

// 팝업 추가 함수
function createPopup() {
  if (document.getElementById("channelpoint-popup")) return; // 중복 생성 방지

  const targetElement = document.getElementById("aside-chatting");

  popup = document.createElement("div");
  popup.id = "channelpoint-popup";
  popup.style.position = "fixed";
  popup.style.bottom = "60px";
  popup.style.right = "20px";
  popup.style.width = "300px";
  popup.style.height = "200px";
  popup.style.backgroundColor = "rgba(70,70,70,1)";
  popup.style.border = "1px solid #ccc";
  popup.style.boxShadow = "0px 4px 6px rgba(0,0,0,0.1)";
  popup.style.borderRadius = "10px";
  popup.style.padding = "15px";
  popup.style.overflowY = "auto";
  popup.style.zIndex = "1000";
  popup.style.display = "none"; // 초기에는 숨김

  // 닫기 버튼 추가
  const closeButton = document.createElement("button");
  closeButton.textContent = "닫기";
  closeButton.style.position = "absolute";
  closeButton.style.top = "5px";
  closeButton.style.right = "10px";
  closeButton.style.border = "none";
  closeButton.style.background = "rgba(46,48,51,1)";
  closeButton.style.color = "rgba(209,210,212,1)";
  closeButton.style.padding = "5px";
  closeButton.style.borderRadius = "5px";
  closeButton.style.cursor = "pointer";
  closeButton.style.fontFamily = "Sandoll Nemony2, Apple SD Gothic NEO, Helvetica Neue, Helvetica, 나눔고딕, NanumGothic, Malgun Gothic, 맑은 고딕, 굴림, gulim, 새굴림, noto sans, 돋움, Dotum, sans-serif";
  closeButton.addEventListener("click", togglePopup);

  // 채널 포인트 표시 영역
  const pointsContainer = document.createElement("div");
  pointsContainer.id = "channel-points-display";
  pointsContainer.style.position = "absolute";
  pointsContainer.style.top = "12px";
  pointsContainer.style.left = "10px";
  pointsContainer.style.color = "rgba(209,210,212,1)";
  pointsContainer.style.fontSize = "16px";
  pointsContainer.style.fontFamily = "system,BlinkMacSystemFont,Apple SD Gothic Neo,Helvetica,Arial,NanumGothic,나눔고딕,Malgun Gothic,맑은 고딕,Dotum,굴림,gulim,새굴림,noto sans,돋움,sans-serif";
  pointsContainer.textContent = `채널포인트: ${channelPoints}`;

  // 보상 버튼 컨테이너 (그리드 레이아웃)
  const rewardsContainer = document.createElement("div");
  rewardsContainer.id = "rewards-container";
  rewardsContainer.style.display = "grid";
  rewardsContainer.style.gridTemplateColumns = "repeat(3, 1fr)"; // 한 줄에 3개씩 배치
  rewardsContainer.style.gap = "10px"; // 버튼 간격 추가
  rewardsContainer.style.marginTop = "10px";

  // 입력창 추가 (팝업 하단)
  const inputField = document.createElement("input");
  inputField.id = "reward-input";
  inputField.type = "text";
  inputField.placeholder = "검색창";
  inputField.style.width = "100%";
  inputField.style.padding = "10px";
  inputField.style.marginTop = "30px";
  inputField.style.border = "1px solid #ccc";
  inputField.style.borderRadius = "5px";

  // 검색 이벤트 리스너 추가
  inputField.addEventListener("input", () => {
    updateRewardsUI(inputField.value.trim().toLowerCase());
  });

  popup.appendChild(closeButton);
  popup.appendChild(pointsContainer);
  popup.appendChild(inputField);
  popup.appendChild(rewardsContainer);
  targetElement.appendChild(popup);
}

function updateRewardsUI(searchQuery = "") {
  const rewardsContainer = document.getElementById("rewards-container");
  if (!rewardsContainer) return;

  rewardsContainer.innerHTML = ""; // 기존 버튼 삭제 후 새로 추가

  if (typeof rewards !== "object" || rewards === null) {
    console.error("보상 목록이 객체가 아닙니다:", rewards);
    return;
  }

  Object.entries(rewards).forEach(([rewardName, rewardPoints]) => {
    // 입력값과 비교하여 필터링
    if (searchQuery && !rewardPoints.이름.toLowerCase().includes(searchQuery)) {
      return; // 검색어와 일치하지 않으면 건너뜀
    }

    const rewardButton = document.createElement("button");

    rewardButton.style.padding = "10px";
    rewardButton.style.border = "1px solid #ccc";
    rewardButton.style.borderRadius = "5px";
    rewardButton.style.backgroundColor = "rgb(31, 30, 37)";
    rewardButton.style.color = "white";
    rewardButton.style.cursor = "pointer";
    rewardButton.style.width = "100%";
    rewardButton.style.display = "flex";
    rewardButton.style.flexDirection = "column";
    rewardButton.style.alignItems = "center";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = rewardPoints.이름;
    nameSpan.style.fontWeight = "bold";
    nameSpan.style.fontSize = "14px";

    const pointsSpan = document.createElement("span");
    pointsSpan.textContent = `${rewardPoints.포인트} 포인트`;
    pointsSpan.style.fontSize = "12px";
    pointsSpan.style.opacity = "0.8";

    // 클릭 이벤트 추가
    rewardButton.addEventListener("click", async () => {
      if (await isBan()) {
        // 입력 알림창 표시
        const inputValue = prompt(`${rewardPoints.이름} 뒤에 올 인자를 입력하세요:`, "");

        if (inputValue !== null) { // 취소 버튼을 누른 경우 무시
          // 입력값과 함께 보상 요청 보내기
          chrome.runtime.sendMessage({
            type: "redeem_reward",
            streamerUUID: broadcastUid,
            rewardPoints: rewardPoints,
            inputValue: inputValue.trim()
          });

          alert(`${rewardPoints.이름} 사용됨! (${inputValue.trim()})`);
        } else {
          alert("취소되었습니다.");
        }
      }
      togglePopup(); // 팝업 닫기
    });

    rewardButton.appendChild(nameSpan);
    rewardButton.appendChild(pointsSpan);
    rewardsContainer.appendChild(rewardButton);
  });
}

// 팝업 열기/닫기 + 보상 요청
async function togglePopup() {
  if (!popup) {
    createPopup();
  }
  const inputField = document.getElementById("reward-input");

  if (popup.style.display === "none") {
    popup.style.display = "block";
    chrome.runtime.sendMessage({ type: "start_websockets", streamerUUID: broadcastUid });

    try {
      // 채널 포인트 요청을 비동기 처리
      const responsePoints = await safeSendMessage({ type: "request_channel_points", streamerUUID: broadcastUid });
      if (responsePoints && responsePoints.points !== undefined) {
        channelPoints = responsePoints.points;
        console.log("✅ 백그라운드에서 받은 채널 포인트:", channelPoints);
        document.getElementById("channel-points-display").textContent = `채널 포인트: ${channelPoints}`;
      }

      // 보상 목록 요청을 비동기 처리
      const responseRewards = await safeSendMessage({ type: "request_rewards", streamerUUID: broadcastUid });
      if (responseRewards && responseRewards.rewards) {
        rewards = responseRewards.rewards;
        console.log("✅ 백그라운드에서 받은 보상 리스트:", rewards);
        updateRewardsUI();
      }
    } catch (error) {
      console.error("🚨 메시지 요청 중 오류 발생:", error);
    }
  } else {
    popup.style.display = "none";
    inputField.value = ""; // 팝업이 닫힐 때 입력창 초기화
  }
}

// 백그라운드에서 실시간 보상 업데이트 받기
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "update_rewards") {
    rewards = message.rewards;
    console.log("실시간 보상 업데이트:", rewards);

    updateRewardsUI();
  }
});

let lastUrl = location.href;

new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    checkBroadcastUid();
  }
}).observe(document, { subtree: true, childList: true });

function checkBroadcastUid() {
  const livePathMatch = location.pathname.match(/^\/live\/([^/]+)/);
  if (livePathMatch) {
    broadcastUid = livePathMatch[1];
    console.log("방송 UID 감지:", broadcastUid);
    if (streamerList.includes(broadcastUid)) {
      fetchchatChannelId();
      addButton();
    } else {
      removeButton();
    }
  }
}