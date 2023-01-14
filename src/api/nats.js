import { AckPolicy, connect, DeliverPolicy, ReplayPolicy, createInbox } from 'nats.ws'
import { useToast } from 'vue-toastification'

const serverUri = 'ws://localhost:444',
  toast = useToast()
let subscriptions = [],
  pullInterval

async function getStreams(startTime, messages) {
  messages.value = []
  clearInterval(pullInterval)

  for (const subscription of subscriptions) {
    subscription.destroy()
  }

  subscriptions = []

  let nc

  try {
    nc = await connect({ servers: serverUri })
  } catch (e) {
    toast.error(`Failed to connect to NATS server at ${serverUri}`, { timeout: 0 })
    throw e
  }

  const jsm = await nc.jetstreamManager(),
    js = nc.jetstream(),
    streams = await jsm.streams.list().next()

  for (const stream of streams) {
    const consumerConfiguration = {
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.StartTime, // we want to start at a specific time
        description: 'apollo-jetstream debug consumer',
        opt_start_time: startTime, // start at the specified time
        replay_policy: ReplayPolicy.Instant // get messages as soon as possible
      },
      consumerOptions = {
        config: consumerConfiguration,
        stream: stream.config.name
      }

    const subscription = await js.pullSubscribe('>', consumerOptions)
    subscriptions.push(subscription)
    ;(async () => {
      for await (const message of subscription) {
        const entry = {
          stream,
          message
        }

        messages.value.push(entry)
        message.ack()
      }
    })()

    const pull = () => {
      subscription.pull({ batch: 1000, expires: 1000 })
    }

    pull()

    pullInterval = setInterval(pull, 1000)
  }

  return streams.sort((a, b) => a.config.name.localeCompare(b.config.name))
}

export { getStreams }
