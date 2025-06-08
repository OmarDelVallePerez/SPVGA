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

    console.log('Grupo creado:', group);
    console.log('ID del grupo:', group.gid._serialized);
    const id = group.gid._serialized;
    console.log('Descripción del grupo:', descripcion);

    return res.json({
      status: 'ok',
        group_id: id,
        group_name: nombre_grupo
    });

  } catch (e) {
    console.error('Error en /crear_grupo:', e);
    return res.status(500).json({ status: 'error', error: e.message });
  }
});

// Ruta para agregar participantes a un grupo existente
app.post('/agregar_participantes', async (req, res) => {
  const { group_id, miembros = [] } = req.body;

  try {
    if (!group_id) {
      return res.status(400).json({ status: 'error', error: 'El ID del grupo es requerido.' });
    }

    // 1) Obtener el chat por ID
    const chat = await client.getChatById(group_id);
    if (!chat?.isGroup) {
      return res.status(400).json({ status: 'error', error: 'El ID proporcionado no corresponde a un grupo.' });
    }

    // 2) Resolver cada número a JID válido
    const toAdd = [];
    const invalidos = [];
    for (let num of miembros) {
      const contact = await client.getNumberId(num);
      if (contact) {
        toAdd.push(contact._serialized);
      } else {
        invalidos.push(num);
      }
    }

    if (invalidos.length) {
      return res.status(400).json({
        status: 'error',
        error: `Los siguientes números no han iniciado chat y no pueden agregarse: ${invalidos.join(', ')}`
      });
    }

    if (!toAdd.length) {
      return res.status(400).json({ status: 'error', error: 'No hay participantes válidos para agregar.' });
    }

    console.log('Agregando a:', toAdd);

    // 3) Agregar participantes
    await chat.addParticipants(toAdd);


    return res.json({
      status: 'ok',
    });

  } catch (e) {
    console.error('Error en /agregar_participantes:', e);
    return res.status(500).json({ status: 'error', error: e.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});

