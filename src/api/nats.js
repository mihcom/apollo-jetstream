import { AckPolicy, connect, DeliverPolicy, ReplayPolicy, createInbox } from 'nats.ws'

const serverUri = 'ws://localhost:443'
let subscriptions = []

async function getStreams(startTime, messages) {
  console.log(startTime)

  messages.value = []

  for (const subscription of subscriptions) {
    subscription.destroy()
  }

  subscriptions = []

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
        opt_start_time: startTime, // start at the specified time
        replay_policy: ReplayPolicy.Instant // get messages as soon as possible
      },
      consumerOptions = {
        config: consumerConfiguration,
        stream: stream.config.name
      }

    stream.messages = []

    const subscription = await js.subscribe('>', consumerOptions)
    subscriptions.push(subscription)
    ;(async () => {
      for await (const message of subscription) {
        messages.value.push({
          stream,
          message
        })
      }
    })()
  }

  return streams.sort((a, b) => a.config.name.localeCompare(b.config.name))
}

export { getStreams }
