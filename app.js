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

const synthesis = window.speechSynthesis;
let voices = [];
let speaking = false;
let chunks = [];
let chunkIndex = 0;
let stopped = false;
let voiceFilter = 'male';

function updateCount() { count.textContent = `${textInput.value.length.toLocaleString('zh-CN')} 字`; }
function updateRate() { rateValue.textContent = `${Number(rate.value).toFixed(1)}×`; }
function updatePitch() { pitchValue.textContent = Number(pitch.value) === 1 ? '标准' : Number(pitch.value) < 1 ? '低沉' : '明亮'; }
function setStatus(message, active = false) { status.classList.toggle('playing', active); status.lastChild.textContent = ` ${message}`; }

function voiceGender(voice) {
  const name = voice.name.toLowerCase();
  if (/(yunxi|yunyang|yunjian|yunye|kangkang|xiaobei|xiaomo|xiaogang|zhiyu|male|david|mark|guy|daniel|andrew|eric|gordon|ryan)/.test(name)) return 'male';
  if (/(xiaoxiao|xiaoyi|xiaorui|xiaoshuang|xiaoqiu|xiaohan|xiaomeng|xiaoxuan|female|zira|hazel|aria|jenny|susan|linda)/.test(name)) return 'female';
  return 'unknown';
}

function voiceLabel(voice) {
  const gender = voiceGender(voice);
  const prefix = gender === 'male' ? '男声' : gender === 'female' ? '女声' : '系统声音';
  const natural = /natural/i.test(voice.name) ? ' · 自然音色' : '';
  return `${prefix} · ${voice.name}${natural}`;
}

function renderVoiceOptions() {
  const chinese = voices.filter(v => /^(zh|cmn|yue)/i.test(v.lang));
  const source = chinese.length ? chinese : voices;
  const filtered = voiceFilter === 'all' ? source : source.filter(v => voiceGender(v) === voiceFilter);
  const choices = filtered.length ? filtered : source;
  const selected = Number(voiceSelect.value);
  voiceSelect.innerHTML = '';
  if (!choices.length) { voiceSelect.innerHTML = '<option>正在加载系统声音…</option>'; return; }
  choices.sort((a, b) => Number(/natural/i.test(b.name)) - Number(/natural/i.test(a.name))).forEach((voice, index) => {
    const originalIndex = voices.indexOf(voice);
    const option = new Option(voiceLabel(voice), originalIndex);
    if (originalIndex === selected || (index === 0 && selected < 0)) option.selected = true;
    voiceSelect.add(option);
  });
  const filterName = voiceFilter === 'male' ? '中文男声' : voiceFilter === 'female' ? '中文女声' : '中文系统声音';
  hint.textContent = filtered.length ? `已发现 ${filtered.length} 个${filterName}，已优先排列自然音色。` : `未识别到${filterName}，已显示可用的中文系统声音。`;
}

function loadVoices() {
  voices = synthesis.getVoices();
  renderVoiceOptions();
}

function stop() {
  stopped = true;
  synthesis.cancel();
  speaking = false;
  chunks = [];
  chunkIndex = 0;
  playButton.innerHTML = '<span class="play-icon">▶</span><span>开始播报</span>';
  setStatus('准备就绪');
}

function splitText(content) {
  const parts = content.match(/[^。！？；.!?;]+[。！？；.!?;]?/g) || [content];
  const result = [];
  parts.forEach(part => {
    let remaining = part.trim();
    while (remaining.length > 220) {
      let cut = remaining.lastIndexOf('，', 220);
      if (cut < 80) cut = remaining.lastIndexOf('、', 220);
      if (cut < 80) cut = 220;
      result.push(remaining.slice(0, cut + 1));
      remaining = remaining.slice(cut + 1).trim();
    }
    if (remaining) result.push(remaining);
  });
  return result;
}

function speakNext() {
  if (stopped || chunkIndex >= chunks.length) {
    if (!stopped) { speaking = false; playButton.innerHTML = '<span class="play-icon">▶</span><span>开始播报</span>'; setStatus('播报完成'); }
    return;
  }
  const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
  utterance.voice = voices[Number(voiceSelect.value)] || null;
  utterance.lang = utterance.voice?.lang || 'zh-CN';
  utterance.rate = Number(rate.value);
  utterance.pitch = Number(pitch.value);
  utterance.onstart = () => { speaking = true; playButton.innerHTML = '<span class="play-icon">Ⅱ</span><span>暂停播报</span>'; setStatus('正在播报', true); };
  utterance.onend = () => { chunkIndex += 1; window.setTimeout(speakNext, 40); };
  utterance.onerror = event => { if (event.error !== 'canceled') { speaking = false; setStatus('播报未能开始'); hint.textContent = `语音服务提示：${event.error}`; } };
  synthesis.speak(utterance);
}

function speak() {
  const content = textInput.value.trim();
  if (!content) { hint.textContent = '请先输入需要播报的文字。'; textInput.focus(); return; }
  if (speaking && synthesis.paused) {
    synthesis.resume(); speaking = true; playButton.innerHTML = '<span class="play-icon">Ⅱ</span><span>暂停播报</span>'; setStatus('正在播报', true); return;
  }
  if (speaking) { synthesis.pause(); playButton.innerHTML = '<span class="play-icon">▶</span><span>继续播报</span>'; setStatus('播报已暂停'); return; }
  stopped = false;
  chunks = splitText(content);
  chunkIndex = 0;
  speakNext();
}

if (!('speechSynthesis' in window)) { hint.textContent = '当前浏览器不支持语音合成，请使用最新版 Chrome、Edge 或 Safari。'; playButton.disabled = true; }
else { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
textInput.addEventListener('input', updateCount); rate.addEventListener('input', updateRate); pitch.addEventListener('input', updatePitch);
playButton.addEventListener('click', speak); stopButton.addEventListener('click', stop);
clearButton.addEventListener('click', () => { stop(); textInput.value = ''; updateCount(); textInput.focus(); });
filterButtons.forEach(button => button.addEventListener('click', () => {
  voiceFilter = button.dataset.filter;
  filterButtons.forEach(item => item.classList.toggle('active', item === button));
  renderVoiceOptions();
}));
previewButton.addEventListener('click', () => {
  stop();
  stopped = false;
  chunks = ['您好，我是小智。很高兴为您播报今天的内容。'];
  chunkIndex = 0;
  speakNext();
});
window.addEventListener('beforeunload', () => synthesis?.cancel());
updateCount(); updateRate(); updatePitch();
