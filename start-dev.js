const { spawn } = require('child_process');

async function start() {
  // バックエンドの起動 (npx nodemon を使用してローカルインストールされた nodemon を実行)
  const backend = spawn('npx', ['nodemon', 'server/index.js'], { stdio: 'inherit', shell: true });

  // フロントエンドの起動
  const frontend = spawn('npm', ['run', 'dev'], { cwd: './client', stdio: 'inherit', shell: true });

  let cloudflared = null;

  // トンネルの起動 (Viteのデフォルトポート 5173 を公開)
  try {
    try {
      require('child_process').execSync('pkill -f cloudflared');
    } catch (e) {} // 無視

    console.log("Starting Cloudflare Tunnel...");

    // 少し待ってからcloudflaredを起動
    setTimeout(() => {
      try {
        cloudflared = spawn('npx', ['cloudflared', 'tunnel', '--url', 'http://localhost:5173'], { shell: true });

        // cloudflaredは標準エラー出力（stderr）に情報を出力するため、そこからURLを抽出する
        cloudflared.stderr.on('data', (data) => {
          const output = data.toString();
          
          // .trycloudflare.com のURLを抽出
          const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
          if (match) {
            const url = match[0];
            console.log(`\n======================================================`);
            console.log(`🚀 Cloudflare Tunnel is successfully running!`);
            console.log(`👉 Public URL: ${url}`);
            console.log(`======================================================\n`);
            console.log(`LINE Developersコンソールの以下の項目に上記のURLを設定してください：`);
            console.log(`1. LIFFアプリのエンドポイントURL (例: ${url}/ )`);
            console.log(`2. Messaging APIのWebhook URL (例: ${url}/api/webhook ) ※Webhook未実装でも設定可\n`);
          }
        });
        
        cloudflared.on('close', () => {
          console.log('Tunnel closed');
        });
      } catch (err) {
        console.error('Failed to start cloudflared tunnel:', err.message || err);
      }
    }, 2000);
  } catch (err) {
    console.error('Error starting tunnel:', err);
  }

  // プロセス終了時のクリーンアップ
  process.on('SIGINT', () => {
    backend.kill();
    frontend.kill();
    if (cloudflared) {
      cloudflared.kill();
    }
    process.exit();
  });
}

start();
