#!/bin/bash

# Lambda 関数名
LAMBDA_FUNCTION_NAME="updateCredits"

# ZIP ファイル名
ZIP_FILE="function.zip"

# AWS CLI プロファイル（デフォルトプロファイルを使用しない場合は設定）
AWS_PROFILE="default"

echo "🚀 Starting deployment process..."

# 既存の ZIP を削除
if [ -f "$ZIP_FILE" ]; then
    echo "🗑 Removing old ZIP file..."
    rm "$ZIP_FILE"
fi

# ZIP を作成
echo "📦 Creating ZIP package..."
zip -r "$ZIP_FILE" index.mjs node_modules package.json > /dev/null

# AWS Lambda にアップロード
echo "☁️ Deploying to AWS Lambda..."
aws lambda update-function-code --function-name "$LAMBDA_FUNCTION_NAME" --zip-file fileb://"$ZIP_FILE" --profile "$AWS_PROFILE"

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
else
    echo "❌ Deployment failed!"
fi
