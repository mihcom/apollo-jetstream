import { AckPolicy, connect, DeliverPolicy, ReplayPolicy, nanos, createInbox } from 'nats.ws'
import moment from 'moment'
import { v4 as uuidv4 } from 'uuid'

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
        replay_policy: ReplayPolicy.Instant, // get messages as soon as possible
        inactive_threshold: nanos(moment.duration(10, 'seconds').asMilliseconds())
      },
      consumerOptions = {
        config: consumerConfiguration,
        stream: stream.config.name
      }

    // const subscription = await js.subscribe('>', consumerOptions)
    const subscription = await js.subscribe('>', consumerOptions)

    const done = (async () => {
      for await (const m of subscription) {
        console.log(`[${m.seq}] ${m.subject} ${m.data}`)
        m.ack()
      }
    })()

    await done
  }

  return streams.sort((a, b) => a.config.name.localeCompare(b.config.name))
}

export { getStreams }
