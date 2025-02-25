const jsonServer = require('json-server');
const express = require('express');
const fs = require('fs');
const axios = require('axios');

const server = express();
const router = jsonServer.router('streamerSockets.json');
const middlewares = jsonServer.defaults();

server.use(express.json()); // JSON 요청 본문을 읽기 위함
server.use(middlewares);

// GitHub 정보 설정
const GITHUB_REPO = "mynam333/channelpoint";  // GitHub 저장소 이름
const GITHUB_FILE_PATH = "streamerSockets.json";  // JSON 파일 위치
const GITHUB_BRANCH = "main";  // 업데이트할 브랜치
const GITHUB_TOKEN = process.env.TOKEN;  // GitHub Personal Access Token

// Render에서 JSON 수정 시 GitHub에도 자동 업데이트
server.put('/settings', async (req, res) => {
    let db = JSON.parse(fs.readFileSync('streamerSockets.json', 'utf8'));

    // 현재 존재하는 키 목록 가져오기
    const existingKeys = Object.keys(db.settings);
    const newValues = req.body;

    // 새로운 키 추가 방지
    const invalidKeys = Object.keys(newValues).filter(key => !existingKeys.includes(key));
    if (invalidKeys.length > 0) {
        return res.status(400).json({ error: `새로운 키 추가 불가: ${invalidKeys.join(', ')}` });
    }

    // 기존 키 값만 변경
    Object.keys(newValues).forEach(key => {
        db.settings[key] = newValues[key];
    });

    // 변경된 데이터 저장
    fs.writeFileSync('streamerSockets.json', JSON.stringify(db, null, 2));

    // GitHub에 변경 사항 푸시
    try {
        await updateGitHubFile(JSON.stringify(db, null, 2));
        res.json({ success: true, updated: db.settings, github_sync: "success" });
    } catch (error) {
        console.error("GitHub 업데이트 실패:", error);
        res.status(500).json({ success: false, error: "GitHub 업데이트 실패" });
    }
});

// GitHub API를 사용하여 `streamerSockets.json` 업데이트
async function updateGitHubFile(newContent) {
    try {
        // GitHub API를 사용하여 현재 파일 정보 가져오기
        const { data: fileData } = await axios.get(
            `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`,
            { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
        );

        // 변경된 JSON 파일을 GitHub에 커밋 & 푸시
        await axios.put(
            `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`,
            {
                message: "자동 업데이트: Render에서 변경된 JSON 반영",
                content: Buffer.from(newContent).toString('base64'), // Base64 인코딩
                sha: fileData.sha, // 기존 파일의 SHA 필요
                branch: GITHUB_BRANCH
            },
            { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
        );

        console.log("✅ GitHub 업데이트 성공!");
    } catch (error) {
        console.error("❌ GitHub 업데이트 오류:", error);
        throw error;
    }
}

// JSON Server 라우터 추가
server.use(router);

// 서버 실행
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`JSON Server running on port ${PORT}`);
});
