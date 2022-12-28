import { AckPolicy, connect, DeliverPolicy, ReplayPolicy, createInbox } from 'nats.ws'
import moment from 'moment'

const serverUri = 'ws://localhost:443'

async function getStreams() {
  const nc = await connect({ servers: serverUri }),
    jsm = await nc.jetstreamManager(),
    js = nc.jetstream(),
    streams = await jsm.streams.list().next()

  for (const stream of streams) {
    const consumerConfiguration = {
        ack_policy: AckPolicy.None, // we don't need to ack messages
        deliver_policy: DeliverPolicy.StartTime, // we want to start at a specific time
        deliver_subject: createInbox(), // specify subject to make this consumer a push consumer
        description: 'apollo-jetstream debug consumer',
        opt_start_time: moment().add(-30, 'minutes').toISOString(), // start 5 minutes ago
        replay_policy: ReplayPolicy.Instant // get messages as soon as possible
      },
      consumerOptions = {
        config: consumerConfiguration,
        stream: stream.config.name
      }

    stream.messages = []

    const subscription = await js.subscribe('>', consumerOptions)

    ;(async () => {
      for await (const message of subscription) {
        stream.messages.push(message)
        console.log(message)
      }
    })()
  }

  return streams.sort((a, b) => a.config.name.localeCompare(b.config.name))
}

export { getStreams }
