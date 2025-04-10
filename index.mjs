import AWS from "aws-sdk";

// AWS SDK の設定
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const BUCKET_NAME = "usagi-server-homepage-new"; // S3バケット名
const FILE_KEY = "dynmap/standalone/dynmap_world.json"; // S3内のJSONファイルのパス

export const handler = async () => {
  try {
    // S3からプレイヤーデータを取得
    const s3Data = await s3.getObject({ Bucket: BUCKET_NAME, Key: FILE_KEY }).promise();
    const player_list = JSON.parse(s3Data.Body.toString()).players;

    for (const player of player_list) {
      const { playerId } = player.name;

      const now = Date.now();

      // PlayerStateテーブルからログイン情報を取得
      const stateResult = await dynamoDB
        .get({
          TableName: "PlayerState",
          Key: { playerId },
        })
        .promise();

      if (!stateResult.Item) {
        // 初回保存: ログイン時刻とオンライン状況を保存
        await dynamoDB
          .put({
            TableName: "PlayerState",
            Item: {
              playerId,
              loginTimestamp: now, // TTL対象
              isOnline: true,
            },
          })
          .promise();
      } else {
        // 経過時間を計算してクレジットを加算
        const elapsedSeconds = Math.floor((now - stateResult.Item.loginTimestamp) / 1000);
        const creditToAdd = elapsedSeconds;

        // PlayerCreditsテーブルのクレジットを更新
        await dynamoDB
          .update({
            TableName: "PlayerCredits",
            Key: { playerId },
            UpdateExpression: "ADD credit :creditToAdd",
            ExpressionAttributeValues: {
              ":creditToAdd": creditToAdd,
            },
          })
          .promise();

        // PlayerStateテーブルのオンライン状況を更新
        await dynamoDB
          .update({
            TableName: "PlayerState",
            Key: { playerId },
            UpdateExpression: "SET loginTimestamp = :now, isOnline = :isOnline",
            ExpressionAttributeValues: {
              ":now": now,
              ":isOnline": true,
            },
          })
          .promise();
      }
    }

    console.log("✅ クレジットの更新が完了しました");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
  }
};