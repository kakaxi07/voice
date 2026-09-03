const textInput = document.querySelector('#text-input');
const count = document.querySelector('#count');
const voiceSelect = document.querySelector('#voice-select');
const rate = document.querySelector('#rate');
const pitch = document.querySelector('#pitch');
const rateValue = document.querySelector('#rate-value');
const pitchValue = document.querySelector('#pitch-value');
const playButton = document.querySelector('#play-btn');
const stopButton = document.querySelector('#stop-btn');
const clearButton = document.querySelector('#clear-btn');
const previewButton = document.querySelector('#preview-btn');
const filterButtons = document.querySelectorAll('.filter-button');
const status = document.querySelector('#status');
const hint = document.querySelector('#support-hint');
const voices = [
  { id: 'Neil', name: '阿闻', gender: 'male', detail: '专业新闻主持人' }, { id: 'Ethan', name: '晨煦', gender: 'male', detail: '阳光温暖的普通话男声' },
  { id: 'Kai', name: '凯', gender: 'male', detail: '自然舒服、松弛沉稳' }, { id: 'Eldric Sage', name: '沧明子', gender: 'male', detail: '沉稳睿智的长者' },
  { id: 'Nofish', name: '不吃鱼', gender: 'male', detail: '亲切的设计师男声' }, { id: 'Cherry', name: '芊悦', gender: 'female', detail: '阳光亲切的女声' },
  { id: 'Serena', name: '苏瑶', gender: 'female', detail: '温柔自然的女声' }, { id: 'Maia', name: '四月', gender: 'female', detail: '知性温柔的女声' }
];
let voiceFilter = 'male', socket, audioContext, scheduledUntil = 0, audioNodes = [], speaking = false, streamingDone = false;
const updateCount = () => count.textContent = `${textInput.value.length.toLocaleString('zh-CN')} 字`;
const updateRate = () => rateValue.textContent = `${Number(rate.value).toFixed(1)}×`;
const updatePitch = () => pitchValue.textContent = Number(pitch.value) === 1 ? '标准' : Number(pitch.value) < 1 ? '低沉' : '明亮';
const setStatus = (message, active = false) => { status.classList.toggle('playing', active); status.lastChild.textContent = ` ${message}`; };
function renderVoices() {
  const list = voiceFilter === 'all' ? voices : voices.filter(voice => voice.gender === voiceFilter);
  voiceSelect.innerHTML = '';
  list.forEach(voice => voiceSelect.add(new Option(`${voice.gender === 'male' ? '男声' : '女声'} · ${voice.name} — ${voice.detail}`, voice.id)));
  hint.textContent = `已加载 ${list.length} 个千问${voiceFilter === 'male' ? '男' : voiceFilter === 'female' ? '女' : ''}声；默认采用自然播报指令。`;
}
function pcmToBuffer(base64) {
  const binary = atob(base64), samples = new Int16Array(binary.length / 2);
  for (let i = 0; i < binary.length; i += 2) samples[i / 2] = binary.charCodeAt(i) | (binary.charCodeAt(i + 1) << 8);
  const buffer = audioContext.createBuffer(1, samples.length, 24000), channel = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) channel[i] = samples[i] / 32768;
  return buffer;
}
function queueAudio(base64) {
  const source = audioContext.createBufferSource(); source.buffer = pcmToBuffer(base64); source.connect(audioContext.destination);
  const startAt = Math.max(audioContext.currentTime + 0.04, scheduledUntil); scheduledUntil = startAt + source.buffer.duration; source.start(startAt); audioNodes.push(source);
  source.onended = () => { audioNodes = audioNodes.filter(node => node !== source); if (streamingDone && !audioNodes.length) finishPlayback(); };
}
function finishPlayback() { speaking = false; streamingDone = false; playButton.innerHTML = '<span class="play-icon">▶</span><span>开始播报</span>'; setStatus('播报完成'); }
function stop() {
  socket?.close(); socket = undefined; audioNodes.forEach(node => { try { node.stop(); } catch {} }); audioNodes = []; scheduledUntil = 0; streamingDone = false; speaking = false;
  if (audioContext?.state === 'suspended') audioContext.resume(); playButton.innerHTML = '<span class="play-icon">▶</span><span>开始播报</span>'; setStatus('准备就绪');
}
function startStream(content) {
  audioContext ||= new AudioContext({ sampleRate: 24000 }); audioContext.resume(); scheduledUntil = audioContext.currentTime + 0.08; streamingDone = false;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'; socket = new WebSocket(`${protocol}//${location.host}/tts`);
  socket.onopen = () => socket.send(JSON.stringify({ text: content, voice: voiceSelect.value, rate: Number(rate.value), pitch: Number(pitch.value) }));
  socket.onmessage = ({ data }) => {
    const event = JSON.parse(data);
    if (event.type === 'status') { setStatus('正在生成语音', true); hint.textContent = event.message; }
    if (event.type === 'audio') { speaking = true; setStatus('正在播报', true); queueAudio(event.delta); }
    if (event.type === 'done') { streamingDone = true; hint.textContent = `本次已合成 ${event.characters} 个字符。`; if (!audioNodes.length) finishPlayback(); }
    if (event.type === 'error') { stop(); hint.textContent = `服务提示：${event.message}`; }
  };
  socket.onerror = () => { stop(); hint.textContent = '无法连接语音服务。请确认使用 npm start 启动，并已配置 API Key。'; };
}
function speak() {
  const content = textInput.value.trim(); if (!content) { hint.textContent = '请先输入需要播报的文字。'; return textInput.focus(); }
  if (speaking && audioContext?.state === 'running') { audioContext.suspend(); playButton.innerHTML = '<span class="play-icon">▶</span><span>继续播报</span>'; return setStatus('播报已暂停'); }
  if (speaking && audioContext?.state === 'suspended') { audioContext.resume(); playButton.innerHTML = '<span class="play-icon">Ⅱ</span><span>暂停播报</span>'; return setStatus('正在播报', true); }
  stop(); startStream(content); playButton.innerHTML = '<span class="play-icon">Ⅱ</span><span>正在生成</span>'; setStatus('连接语音服务', true);
}
textInput.addEventListener('input', updateCount); rate.addEventListener('input', updateRate); pitch.addEventListener('input', updatePitch); playButton.addEventListener('click', speak); stopButton.addEventListener('click', stop);
clearButton.addEventListener('click', () => { stop(); textInput.value = ''; updateCount(); textInput.focus(); });
previewButton.addEventListener('click', () => { textInput.value = '您好，我是小智。现在为您演示千问实时语音播报。'; updateCount(); speak(); });
filterButtons.forEach(button => button.addEventListener('click', () => { voiceFilter = button.dataset.filter; filterButtons.forEach(item => item.classList.toggle('active', item === button)); renderVoices(); }));
window.addEventListener('beforeunload', stop); renderVoices(); updateCount(); updateRate(); updatePitch();
