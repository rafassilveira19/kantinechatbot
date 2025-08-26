const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const path = require('path');
const qrcode = require('qrcode');

let isReconnecting = false;
const ultimasMensagensMinhas = new Map();

const numerosBloqueados = [
  '553493007502@s.whatsapp.net',
  '553496830188@s.whatsapp.net',
  '553499006476@s.whatsapp.net',
  '553491176892@s.whatsapp.net',
  '553499215444@s.whatsapp.net',
  '553498819966@s.whatsapp.net',
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enviarMensagemSeparada(client, from, mensagens) {
  for (const texto of mensagens) {
    await client.sendMessage(from, { text: texto });
    await delay(1500);
  }
}

function estaDentroDoHorarioDeAtendimento() {
  const agoraUTC = new Date();
  const agoraBrasilia = new Date(agoraUTC.getTime() - 3 * 60 * 60 * 1000);

  const horarioAtual = agoraBrasilia.getHours() * 60 + agoraBrasilia.getMinutes();
  const dia = agoraBrasilia.getDay(); 

  if (dia === 1) return horarioAtual >= 12 * 60 && horarioAtual < 18 * 60;
  if (dia >= 2 && dia <= 5) return horarioAtual >= 10 * 60 && horarioAtual < 18 * 60;
  if (dia === 6) return horarioAtual >= 10 * 60 && horarioAtual < 17 * 60 + 30;

  return false;
}

async function createWhatsAppClient(instanceId = 'default') {
  const storePath = path.join(__dirname, `auth_info_${instanceId}`);
  const { state, saveCreds } = await useMultiFileAuthState(storePath);

  const client = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  client.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📲 Escaneie o QR Code para autenticação:');
      try {
        const qrString = await qrcode.toString(qr, { type: 'terminal' });
        console.log(qrString);
      } catch (err) {
        console.error('❌ Erro ao gerar o QR Code:', err);
      }
    }

    if (connection === 'open') {
      console.log(`✅ Wpp ${instanceId} conectado com sucesso!`);
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect && !isReconnecting) {
        isReconnecting = true;
        console.log(`🔄 Reconectando ${instanceId}...`);
        setTimeout(() => {
          createWhatsAppClient(instanceId);
          isReconnecting = false;
        }, 2000);
      } else {
        console.log(`⚠️ Usuário deslogado da ${instanceId}. Escaneie o QR Code novamente.`);
      }
    }
  });

  client.ev.on('creds.update', saveCreds);

  client.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) {
      if (msg.key.fromMe) {
        const to = msg.key.remoteJid;
        ultimasMensagensMinhas.set(to, new Date());
      }
      return;
    }

    const from = msg.key.remoteJid;
    if (from.includes('@g.us') || numerosBloqueados.includes(from)) return;

    const agora = new Date();
    const ultimaMsgMinha = ultimasMensagensMinhas.get(from);

    if (ultimaMsgMinha && agora - ultimaMsgMinha < 2 * 60 * 60 * 1000) {
      return;
    }

    const mensagensAtendimento = [
      `Olá! Seja bem-vindo(a) à Kantine 😊
Recebemos muitas mensagens, então pedimos um pouquinho de paciência — *já já respondemos você!*
Enquanto isso, pode nos contar aqui o que você precisa?`,
      `*Cardápios:*  
🎂 *Bolos e sobremesas*: https://drive.google.com/file/d/1XkH3CPugY1E1xPsGm3J3i6xZY-z4iF8P/view

🛵 *Delivery ou retirada:*  
pedido.takeat.app/kantinegastronomia  
_(AQUI TAMBÉM VOCÊ CONSEGUE VER NOSSAS CESTAS PRESENTEÁVEIS E TUDO QUE TEMOS NA LOJA HOJE!!😉)_

*Para pagamento antecipado, é só fazer o pedido normalmente e, assim que receber nossa mensagem de confirmação, nos avisar que deseja antecipar o pagamento.* 💳✨

📦 *Encomendas de bolos e sobremesas devem ser feitas com 48h de antecedência.*  
👩🏻‍🍳 Caso seja feita dentro disso, iremos verificar com a cozinha se conseguimos atender você. 

🛍️ Retiradas são exclusivamente na loja da Getúlio.`,
      `📱 *Horários de Funcionamento de Delivery e Atendimento no Whatsapp:*  
• Seg: 12h às 18h  
• Ter a Sex: 10h às 18h  
• Sáb: 10h às 17h30  
• Domingo estamos fechados

🕒 *Horários de Funcionamento das Lojas*  
📍 *Loja Vinhedos e Getúlio*  
• Seg: 12h – 19h  
• Ter a Sex: 09h – 19h  
• Sábados e Feriados: 09h – 18h  
• Domingo estamos fechados`,

      `🌟 *CHOUX DAY* 🌟

⚠ Atenção: estamos recebendo muitas mensagens. Respondemos por ordem de chegada, então tenha paciência 💛.

As reservas foram encerradas!
*Pedidos feitos antes de 14h00 ainda serão validados!"
A equipe Kantine agradece! 

🛵 Entregas:

Devido à alta demanda, não conseguimos garantir o horário exato, mas faremos o possível para chegar o mais próximo do escolhido

⚠ IMPORTANTE:

- Sabores são somente os que estão no cardápio
- As choux serão entregues/retiradas apenas no dia 27/08
- Retirada na unidade Vinhedos deve ser informada após a nossa mensagem de confirmação do pedido
- Entregas e retiradas serão possíveis somente até 16h00`
    ];

    const mensagensForaHorario = [
      `Olá! Seja bem-vindo(a) à Kantine 😊
      *ESSA É UMA MENSAGEM AUTOMÁTICA*

Estamos fora do horário de atendimento, mas assim que alguém estiver disponível responderemos sua mensagem. *Enquanto isso, me diga como posso ajudar você*`

,
 `*Cardápios:*  
🎂 *Bolos e sobremesas*: https://drive.google.com/file/d/1XkH3CPugY1E1xPsGm3J3i6xZY-z4iF8P/view


📦 *Encomendas de bolos e sobremesas devem ser feitas com 48h de antecedência.*  
👩🏻‍🍳 Caso seja feita dentro disso, iremos verificar com a cozinha se conseguimos atender você. 

🛍️ Retiradas são exclusivamente na loja da Getúlio.`,
      `📱 *Horários de Funcionamento de Delivery e Atendimento no Whatsapp:*  
• Seg: 12h às 18h  
• Ter a Sex: 10h às 18h  
• Sáb: 10h às 17h30  
• Domingo estamos fechados

🕒 *Horários de Funcionamento das Lojas*  
📍 *Loja Vinhedos e Getúlio*  
• Seg: 12h – 19h  
• Ter a Sex: 09h – 19h  
• Sábados e Feriados: 09h – 18h  
• Domingo estamos fechados`,

    
    ];

    const mensagensParaEnviar = estaDentroDoHorarioDeAtendimento()
      ? mensagensAtendimento
      : mensagensForaHorario;

    await enviarMensagemSeparada(client, from, mensagensParaEnviar);

    ultimasMensagensMinhas.set(from, new Date());
  });

  return client;
}

createWhatsAppClient('kantine');

setInterval(() => {
  console.log("Bot rodando...");
}, 60000);


const http = require('http');
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot Kantine rodando...');
}).listen(PORT, () => {
  console.log(`Servidor HTTP ativo na porta ${PORT}`);
});
