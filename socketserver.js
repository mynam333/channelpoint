import express from "express";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node"; // ✅ 최신 방식
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// LowDB 설정 (JSON 파일 기반 데이터베이스)
const adapter = new JSONFile("streamerSockets.json");
const db = new Low(adapter, adapter);

// 초기화: DB 로드 후 기본 구조 설정
const initDB = async () => {
    await db.read();
    await db.write();
};
await initDB();

app.use(express.json());

// GitHub 정보 설정
const GITHUB_REPO = "mynam333/channelpoint"; // GitHub 저장소 이름
const GITHUB_FILE_PATH = "streamerSockets.json"; // JSON 파일 위치
const GITHUB_BRANCH = "main"; // 업데이트할 브랜치
const GITHUB_TOKEN = process.env.TOKEN; // GitHub Personal Access Token

// 📌 JSON 데이터 조회 (GET 요청)
app.get("/settings", async (req, res) => {
    await db.read(); // 최신 데이터 로드
    res.json(db.data);
});

// 📌 JSON 데이터 수정 (PUT 요청)
app.put("/settings", async (req, res) => {
    try {
        await db.read();
        const newValues = req.body;

        // 기존 키만 변경 (새로운 키 추가 방지)
        Object.keys(newValues).forEach((key) => {
            if (db.data.hasOwnProperty(key)) {
                db.data[key] = newValues[key];
            }
        });

        await db.write(); // 변경 사항 저장

        // GitHub에 변경 사항 푸시
        await updateGitHubFile(JSON.stringify(db.data, null, 2));

        res.json({ success: true, updated: db.data, github_sync: "success" });
    } catch (error) {
        console.error("❌ GitHub 업데이트 실패:", error);
        res.status(500).json({ success: false, error: "GitHub 업데이트 실패" });
    }
});

// 📌 GitHub API를 사용하여 `streamerSockets.json` 업데이트
async function updateGitHubFile(newContent) {
    try {
        let sha = "";
        try {
            const { data: fileData } = await axios.get(
                `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`,
                { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
            );
            sha = fileData.sha;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.warn("⚠️ GitHub에 기존 파일이 없어 새로 생성합니다.");
            } else {
                throw error;
            }
        }

        // 변경된 JSON 파일을 GitHub에 커밋 & 푸시
        await axios.put(
            `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`,
            {
                message: "자동 업데이트: LowDB에서 변경된 JSON 반영",
                content: Buffer.from(newContent).toString("base64"), // Base64 인코딩
                sha,
                branch: GITHUB_BRANCH,
            },
            { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
        );

        console.log("✅ GitHub 업데이트 성공!");
    } catch (error) {
        console.error("❌ GitHub 업데이트 오류:", error);
        throw error;
    }
}

// 📌 서버 실행
app.listen(PORT, () => {
    console.log(`✅ LowDB JSON API 서버 실행 중: http://localhost:${PORT}`);
});
