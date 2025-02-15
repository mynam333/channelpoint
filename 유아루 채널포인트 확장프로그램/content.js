let popup; // 팝업 요소를 저장할 변수
let channelPoints = 0;
let rewards = [];
let broadcastUid;

// 버튼 추가 함수
function addButton() {
  if (document.getElementById("yuaru-channelpoint")) return; // 중복 추가 방지

  const targetElement = document.getElementById("aside-chatting");

  console.log(targetElement)

  if (targetElement) {
    const button = document.createElement("button");
    // 확장 프로그램 리소스 경로 가져오기
    const iconUrl = chrome.runtime.getURL("point-icon.svg");
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
  }
}

// 팝업 추가 함수
function createPopup() {
  if (document.getElementById("channelpoint-popup")) return; // 중복 생성 방지

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
  rewardsContainer.style.marginTop = "40px";

  // 입력창 추가 (팝업 하단)
  const inputField = document.createElement("input");
  inputField.id = "reward-input";
  inputField.type = "text";
  inputField.placeholder = "입력하세요...";
  inputField.style.width = "100%";
  inputField.style.padding = "10px";
  inputField.style.marginTop = "15px";
  inputField.style.border = "1px solid #ccc";
  inputField.style.borderRadius = "5px";

  popup.appendChild(closeButton);
  popup.appendChild(pointsContainer);
  popup.appendChild(rewardsContainer);
  popup.appendChild(inputField);
  document.body.appendChild(popup);
}

// 팝업 열기/닫기 + 보상 요청
function togglePopup() {
  if (!popup) {
    createPopup();
  }

  if (popup.style.display === "none") {
    popup.style.display = "block";

    // 팝업이 열릴 때마다 백그라운드에 웹소켓 요청
    chrome.runtime.sendMessage({ type: "request_channel_points", streamerUUID: broadcastUid }, (response) => {
      if (response && response.points !== undefined) {
        channelPoints = response.points;
        console.log("백그라운드에서 받은 채널 포인트:", channelPoints);

        // UI 업데이트
        const pointsDisplay = document.getElementById("channel-points-display");
        if (pointsDisplay) {
          pointsDisplay.textContent = `채널 포인트: ${channelPoints}`;
        }
      }
    });

    // 팝업 열릴 때 백그라운드에서 보상 데이터 요청
    chrome.runtime.sendMessage({ type: "request_rewards", streamerUUID: broadcastUid }, (response) => {
      if (response && response.rewards) {
        rewards = response.rewards;
        console.log("백그라운드에서 받은 보상 리스트:", rewards);

        // UI 업데이트
        updateRewardsUI();
      }
    });
  } else {
    popup.style.display = "none";
  }
}

// 보상 버튼을 생성하는 함수
function updateRewardsUI() {
  const rewardsContainer = document.getElementById("rewards-container");
  if (!rewardsContainer) return;

  rewardsContainer.innerHTML = ""; // 기존 버튼 삭제 후 새로 추가

  rewards.forEach((reward) => {
    const rewardButton = document.createElement("button");

    // 보상 버튼 스타일
    rewardButton.style.padding = "10px";
    rewardButton.style.border = "1px solid #ccc";
    rewardButton.style.borderRadius = "5px";
    rewardButton.style.backgroundColor = "#007BFF";
    rewardButton.style.color = "white";
    rewardButton.style.cursor = "pointer";
    rewardButton.style.width = "100%";
    rewardButton.style.display = "flex";
    rewardButton.style.flexDirection = "column"; // 줄바꿈
    rewardButton.style.alignItems = "center";

    // 이름 요소 추가
    const nameSpan = document.createElement("span");
    nameSpan.textContent = reward.이름;
    nameSpan.style.fontWeight = "bold";
    nameSpan.style.fontSize = "14px";

    // 포인트 요소 추가
    const pointsSpan = document.createElement("span");
    pointsSpan.textContent = `${reward.포인트} 포인트`;
    pointsSpan.style.fontSize = "12px";
    pointsSpan.style.opacity = "0.8";

    // 클릭 이벤트 추가
    rewardButton.addEventListener("click", () => {
      const inputField = document.getElementById("reward-input");
      const inputValue = inputField.value.trim(); // 입력된 값 가져오기

      // 입력값과 함께 보상 요청 보내기
      chrome.runtime.sendMessage({
        type: "redeem_reward",
        streamerUUID: broadcastUid,
        rewardName: reward.이름,
        rewardPoints: reward.포인트,
        inputValue: inputValue
      });

      alert(`${reward.이름} 사용됨! (${inputValue})`);

      // 입력창 비우기
      inputField.value = "";
    });

    rewardButton.appendChild(nameSpan);
    rewardButton.appendChild(pointsSpan);
    rewardsContainer.appendChild(rewardButton);
  });
}

// 백그라운드에서 실시간 보상 업데이트 받기
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "update_rewards") {
    rewards = message.rewards;
    console.log("실시간 보상 업데이트:", rewards);

    updateRewardsUI();
  }
});

monitorUrlChanges()

function monitorUrlChanges() {
  const observeUrlChange = (path) => {
    handlePathChange(path); // URL이 변경될 때 실행할 로직
  };

  // 현재 로드된 URL 처리
  if (location.pathname) {
    observeUrlChange(location.pathname);
  } else {
    console.error('Invalid location.pathname detected.');
  }

  // 원래 history 메서드를 저장
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  // history.pushState 가로채기
  history.pushState = function (...args) {
    originalPushState.apply(this, args); // 원래 동작 수행
    observeUrlChange(location.pathname); // URL 변경 감지
  };

  // history.replaceState 가로채기
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args); // 원래 동작 수행
    observeUrlChange(location.pathname); // URL 변경 감지
  };

  // popstate 이벤트 감지
  window.addEventListener("popstate", () => {
    observeUrlChange(location.pathname); // URL 변경 감지
  });
}

// 방송 UID를 추출하고 처리하는 함수
function handlePathChange(path) {
  console.log("현재 path:", path);

  // "/live/" 뒤의 UID 추출
  const livePathMatch = path.match(/^\/live\/([^/]+)/);
  if (livePathMatch) {
    broadcastUid = livePathMatch[1];
    console.log("방송 UID 감지:", broadcastUid);
    if (broadcastUid === "6d395c84c99777272f872171b4dfc122") {
      addButton();

      // `MutationObserver`를 사용해서 DOM 변경 감지
      const observer = new MutationObserver(() => {
        addButton();
      });

      // 감시할 대상: `body` (전체 페이지 변경 감지)
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
}