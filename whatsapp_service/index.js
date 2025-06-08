const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    console.log('Escanea este código QR:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp está listo!');
});

client.initialize();

// Ruta para crear grupo
app.post('/crear_grupo', async (req, res) => {
  const { nombre_grupo, miembros = [] , descripcion} = req.body;

  try {
    // 1) Comprobar que el cliente está ready
    if (!client.info) {
      return res.status(500).json({ status:'error', error:'El cliente no está listo aún.' });
    }

    // 2) Validar números con getNumberId()
    const chatIds = [];
    const noChat = [];

    for (let num of miembros) {
      const contact = await client.getNumberId(num);
      if (contact) {
        chatIds.push(contact._serialized);       // ej: "5255XXXXXXX@c.us"
      } else {
        noChat.push(num);
      }
    }

    if (noChat.length) {
      return res.status(400).json({
        status: 'error',
        error: `Los siguientes números no son válidos o no están registrados: ${noChat.join(', ')}`
      });
    }

    if (chatIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        error: 'No hay participantes válidos para crear el grupo.'
      });
    }

    console.log('IDs válidos:', chatIds);

    // 3) Crear el grupo
    console.log('Iniciando createGroup()... con nombre:', nombre_grupo);
    const group = await client.createGroup(nombre_grupo, chatIds);
    


    // 6) Responder al cliente HTTP
    return res.json({
      status: 'ok',
    });

  } catch (e) {
    console.error('Error en /crear_grupo:', e);
    return res.status(500).json({ status: 'error', error: e.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});