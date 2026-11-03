// Module de diffusion d'événements en temps réel (Server-Sent Events)
const clients = new Set();

function addClient(res) {
  clients.add(res);
}

function removeClient(res) {
  clients.delete(res);
}

function broadcast(event, data = {}) {
  const namedPayload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const defaultPayload = `event: message\ndata: ${JSON.stringify({ type: event, data })}\n\n`;
  const fullPayload = namedPayload + defaultPayload;

  for (const client of clients) {
    try {
      client.write(fullPayload);
    } catch (err) {
      clients.delete(client);
    }
  }
}

module.exports = {
  addClient,
  removeClient,
  broadcast
};
