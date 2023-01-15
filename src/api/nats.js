import { AckPolicy, connect, DeliverPolicy, ReplayPolicy, createInbox } from 'nats.ws'

const serverUri = 'ws://localhost:444'
let subscriptions = [],
  pullInterval

onmessage = event => {
  const { startTime } = event.data

  // noinspection JSIgnoredPromiseFromCall
  getStreams(startTime)
}

async function getStreams(startTime) {
  clearInterval(pullInterval)

  for (const subscription of subscriptions) {
    subscription.destroy()
  }

  subscriptions = []

  let nc

  try {
    nc = await connect({ servers: serverUri })
  } catch (e) {
    throw `Failed to connect to NATS server at ${serverUri}`
  }

  const jsm = await nc.jetstreamManager(),
    js = nc.jetstream(),
    streams = await jsm.streams.list().next()

  for (const stream of streams) {
    const consumerConfiguration = {
        ack_policy: AckPolicy.None, // we don't need to ack messages
        deliver_policy: DeliverPolicy.StartTime, // we want to start at a specific time
        deliver_subject: createInbox(), // specify subject to make this consumer a push consumer
        description: 'apollo-jetstream debug consumer',
        opt_start_time: startTime, // start at the specified time
        replay_policy: ReplayPolicy.Instant // get messages as soon as possible
      },
      consumerOptions = {
        config: consumerConfiguration,
        stream: stream.config.name
      }

    const subscription = await js.subscribe('>', consumerOptions)
    subscriptions.push(subscription)
    ;(async () => {
      for await (const message of subscription) {
        const entry = {
          stream,
          message: {
            info: message.info,
            data: message.data,
            headers: message.headers,
            seq: message.seq,
            subject: message.subject
          }
        }

        postMessage({ type: 'message', message: entry })
      }
    })()
  }

  postMessage({
    type: 'streams',
    streams: streams.sort((a, b) => a.config.name.localeCompare(b.config.name))
  })
}
