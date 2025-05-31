require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);
const sessions = {};

// Regex pattern
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^01[0-9]{8,9}$/; // Malaysia 10-11 digit format

const ticketCounter = {}; // Simpan kiraan berdasarkan tarikh

function generateTicketID() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;

  if (!ticketCounter[dateStr]) {
    ticketCounter[dateStr] = 1;
  } else {
    ticketCounter[dateStr]++;
  }

  const count = String(ticketCounter[dateStr]).padStart(3, '0');
  return `TPA-${dateStr}-${count}`;
}


bot.start((ctx) => {
  const chatId = ctx.chat.id;
  sessions[chatId] = { step: 1 };
  ctx.reply('👋 Hai! Sila berikan *nama penuh* anda:', { parse_mode: 'Markdown' });
});

bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();
  if (!sessions[chatId]) {
    sessions[chatId] = { step: 1 };
    return ctx.reply('Sila mula semula dengan taip /start');
  }

  const session = sessions[chatId];

  if (session.step === 1) {
    if (text.length < 3) {
      return ctx.reply('❗ Nama terlalu pendek. Sila masukkan nama penuh anda.');
    }
    session.nama = text;
    session.step++;
    return ctx.reply('✅ Terima kasih! Sekarang sila masukkan *alamat emel* anda:', { parse_mode: 'Markdown' });
  }

  if (session.step === 2) {
    if (!emailRegex.test(text)) {
      return ctx.reply('❗ Emel tidak sah. Sila cuba lagi dengan format yang betul, contoh: user@email.com');
    }
    session.emel = text;
    session.step++;
    return ctx.reply('📱 Seterusnya, sila berikan *nombor telefon* anda (contoh: 0123456789):', { parse_mode: 'Markdown' });
  }

  if (session.step === 3) {
    if (!phoneRegex.test(text)) {
      return ctx.reply('❗ Nombor telefon tidak sah. Sila masukkan nombor yang bermula dengan 01 dan 10-11 digit.');
    }
    session.telefon = text;
    session.step++;
    return ctx.reply('📝 Akhir sekali, sila nyatakan *masalah atau pertanyaan* anda:', { parse_mode: 'Markdown' });
  }

  if (session.step === 4) {
    if (text.length < 5) {
      return ctx.reply('❗ Sila nyatakan masalah dengan lebih jelas (minimum 5 aksara).');
    }

    session.masalah = text;

    try {
      // Guna axios GET untuk elak CORS
      const ticketID = generateTicketID();

      await axios.get(process.env.GAS_URL, {
        params: {
          nama: session.nama,
          emel: session.emel,
          telefon: session.telefon,
          masalah: session.masalah,
          ticketID: ticketID // ← hantar ticketID ke Google Sheet
        }
      });
      
      ctx.reply(`🎉 Tiket anda telah dihantar!\n\n🆔 Ticket ID: *${ticketID}*\n\nKami akan hubungi anda secepat mungkin.`, { parse_mode: 'Markdown' });
      
      delete sessions[chatId];
    } catch (error) {
      console.error('Error:', error);
      ctx.reply('⚠️ Maaf, berlaku masalah ketika menghantar tiket. Sila cuba semula nanti.');
    }
  }
});

bot.launch();
console.log('🚀 Bot sedang berjalan...');
