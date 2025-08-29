// server.js
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import http from "http";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const STORAGE_PATH = path.resolve("./yard.json");
const PUBLIC_DIR = path.resolve("./public");

const app = express();
app.use(cors());
app.use(express.json());

// 静的ファイル（クライアントHTML と 画像等）を提供
app.use(express.static(PUBLIC_DIR));

// 初期状態（クライアントと同じ場所ID一覧を置く）
let yardState = [
  { id: "spot-1", assigned: [] },
  { id: "spot-2", assigned: [] },
  { id: "spot-3", assigned: [] },
  { id: "spot-4", assigned: [] },
  { id: "spot-5", assigned: [] },
  { id: "spot-6", assigned: [] },
  { id: "spot-7", assigned: [] },
  { id: "spot-8", assigned: [] },
  { id: "spot-9", assigned: [] },
];

// ファイルから読み込めれば復元
if (fs.existsSync(STORAGE_PATH)) {
  try {
    const raw = fs.readFileSync(STORAGE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) yardState = parsed;
  } catch (e) {
    console.warn("yard.json read error:", e);
  }
}

// API: 現在状態を返す
app.get("/yard", (req, res) => {
  res.json({ state: yardState });
});

// API: 保存（クライアントから全体を送る想定）
app.post("/yard", (req, res) => {
  const body = req.body;
  if (!body || !Array.isArray(body.state)) {
    return res.status(400).json({ error: "invalid payload" });
  }
  yardState = body.state;
  // ファイル保存（簡易）
  try {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(yardState, null, 2), "utf8");
  } catch (e) {
    console.error("write error", e);
  }
  // ブロードキャスト（WS経由） - 別で実装
  broadcastUpdate();
  res.json({ ok: true });
});

// HTTP サーバー作成して WS を付ける
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// WS：接続時・受信時（受信は特に使わないがログ出し）
wss.on("connection", (ws) => {
  console.log("ws client connected");
  // 接続直後に現在状態を送る
  ws.send(JSON.stringify({ type: "update", state: yardState }));

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      // 将来クライアントからの差分を受けるならここで処理
      console.log("ws recv:", msg && msg.type);
    } catch (e) {}
  });

  ws.on("close", () => {
    console.log("ws client disconnected");
  });
});

// サーバー内からWSクライアント全員に送るユーティリティ
function broadcastUpdate() {
  const payload = JSON.stringify({ type: "update", state: yardState });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
