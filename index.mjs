import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

// AWS SDK の設定
const dynamoDB = new DynamoDBClient({});
const s3 = new S3Client({});

const BUCKET_NAME = "usagi-server-homepage-new"; // S3バケット名
const FILE_KEY = "dynmap/standalone/dynmap_world.json"; // S3内のJSONファイルのパス

// S3オブジェクトのBodyを文字列に変換するヘルパー関数
const streamToString = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
};

export const handler = async () => {
  try {
    // S3からプレイヤーデータを取得
    const s3Data = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: FILE_KEY }));
    const player_list = JSON.parse(await streamToString(s3Data.Body)).players;

    for (const player of player_list) {
      const playerId = player.name; // プレイヤーID
      const now = Date.now();

      // PlayerStateテーブルからログイン情報を取得
      const stateResult = await dynamoDB.send(
        new GetItemCommand({
          TableName: "PlayerState",
          Key: {
            playerId: { S: playerId },
          },
        })
      );

      if (!stateResult.Item) {
        // 初回保存: ログイン時刻とオンライン状況を保存
        await dynamoDB.send(
          new PutItemCommand({
            TableName: "PlayerState",
            Item: {
              playerId: { S: playerId },
              loginTimestamp: { N: now.toString() }, // TTL対象
              isOnline: { BOOL: true },
            },
          })
        );
      } else {
        // 経過時間を計算してクレジットを加算
        const elapsedSeconds = Math.floor((now - parseInt(stateResult.Item.loginTimestamp.N)) / 1000);
        const creditToAdd = elapsedSeconds;

        // PlayerCreditsテーブルのクレジットを更新
        await dynamoDB.send(
          new UpdateItemCommand({
            TableName: "PlayerCredits",
            Key: {
              playerId: { S: playerId },
            },
            UpdateExpression: "ADD credit :creditToAdd",
            ExpressionAttributeValues: {
              ":creditToAdd": { N: creditToAdd.toString() },
            },
          })
        );

        // PlayerStateテーブルのオンライン状況を更新
        await dynamoDB.send(
          new UpdateItemCommand({
            TableName: "PlayerState",
            Key: {
              playerId: { S: playerId },
            },
            UpdateExpression: "SET loginTimestamp = :now, isOnline = :isOnline",
            ExpressionAttributeValues: {
              ":now": { N: now.toString() },
              ":isOnline": { BOOL: true },
            },
          })
        );
      }
    }

    console.log("✅ クレジットの更新が完了しました");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
  }
};