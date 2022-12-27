import { connect } from 'nats.ws'

const serverUri = 'ws://localhost:443'

async function getStreams() {
  const nc = await connect({ servers: serverUri }),
    jsm = await nc.jetstreamManager(),
    streams = await jsm.streams.list().next()

  await nc.close()

  return streams.sort((a, b) => a.config.name.localeCompare(b.config.name))
}

export { getStreams }
