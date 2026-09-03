require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocket, WebSocketServer } = require('ws');
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.DASHSCOPE_API_KEY;
const upstreamBase = process.env.DASHSCOPE_REALTIME_URL || 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime';
const model = 'qwen3-tts-instruct-flash-realtime';
const allowedVoices = new Set(['Ethan', 'Kai', 'Neil', 'Eldric Sage', 'Nofish', 'Cherry', 'Serena', 'Maia', 'Mia']);
const files = new Map([['/', 'index.html'], ['/index.html', 'index.html'], ['/styles.css', 'styles.css'], ['/app.js', 'app.js']]);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8' };
const id = () => `event_${crypto.randomUUID()}`;
const send = (socket, payload) => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify(payload));
const server = http.createServer((req, res) => {
  const file = files.get(new URL(req.url, `http://${req.headers.host}`).pathname);
  if (!file) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store' });
  fs.createReadStream(path.join(__dirname, file)).pipe(res);
});
const gateway = new WebSocketServer({ server, path: '/tts' });
gateway.on('connection', browser => {
  let upstream;
  browser.once('message', raw => {
    let request; try { request = JSON.parse(raw.toString()); } catch { return send(browser, { type: 'error', message: '请求格式无效。' }); }
    const text = String(request.text || '').trim();
    const voice = allowedVoices.has(request.voice) ? request.voice : 'Neil';
    const rate = Math.min(2, Math.max(0.5, Number(request.rate) || 0.9));
    const pitch = Math.min(2, Math.max(0.5, Number(request.pitch) || 0.9));
    if (!apiKey) return send(browser, { type: 'error', message: '服务端尚未配置 DASHSCOPE_API_KEY。' });
    if (!text || text.length > 10000) return send(browser, { type: 'error', message: '文稿不能为空且不能超过 10,000 字。' });
    upstream = new WebSocket(`${upstreamBase}?model=${model}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    upstream.on('open', () => send(browser, { type: 'status', message: '已连接千问语音服务，正在合成…' }));
    upstream.on('message', message => {
      let event; try { event = JSON.parse(message.toString()); } catch { return; }
      if (event.type === 'session.created') upstream.send(JSON.stringify({ event_id: id(), type: 'session.update', session: { voice, mode: 'commit', language_type: 'Chinese', response_format: 'pcm', sample_rate: 24000, speech_rate: rate, pitch_rate: pitch, instructions: '使用自然、沉稳、亲切的新闻播报风格。吐字清晰，段落之间自然停顿，避免机械和夸张的语气。', optimize_instructions: true } }));
      else if (event.type === 'session.updated') { upstream.send(JSON.stringify({ event_id: id(), type: 'input_text_buffer.append', text })); upstream.send(JSON.stringify({ event_id: id(), type: 'input_text_buffer.commit' })); }
      else if (event.type === 'response.audio.delta') send(browser, { type: 'audio', delta: event.delta });
      else if (event.type === 'response.done') { send(browser, { type: 'done', characters: event.response?.usage?.characters || 0 }); upstream.send(JSON.stringify({ event_id: id(), type: 'session.finish' })); }
      else if (event.type === 'error') send(browser, { type: 'error', message: event.error?.message || '千问语音服务返回错误。' });
    });
    upstream.on('error', () => send(browser, { type: 'error', message: '无法连接千问语音服务，请检查 API Key 与地域配置。' }));
  });
  browser.on('close', () => upstream?.close());
});
server.listen(port, () => console.log(`小智语音播报已启动：http://localhost:${port}`));
