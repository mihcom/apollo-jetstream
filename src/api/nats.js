import { AckPolicy, connect, DeliverPolicy, ReplayPolicy, createInbox } from 'nats.ws'

onmessage = event => {
  const { type } = event.data

  switch (type) {
    case 'getStreams':
      // noinspection JSIgnoredPromiseFromCall
      getStreams(event.data.startTime)
      break

    case 'fetchMessageTrace':
      // noinspection JSIgnoredPromiseFromCall
      fetchMessageTrace(event.data.messageId)
      break

    default:
      throw `Unknown message type: ${type}`
  }
}

const serverUri = 'wss://localhost:444',
  tracingStreamName = 'Tracing',
  connectionPromise = connect({ servers: serverUri })

let subscriptions = [],
  pullInterval

async function getStreams(startTime) {
  clearInterval(pullInterval)

  for (const subscription of subscriptions) {
    subscription.destroy()
  }

  subscriptions = []

  const natsConnection = await getNatsConnection(),
    jetStreamManager = await natsConnection.jetstreamManager(),
    jetStreamClient = natsConnection.jetstream()

  const streams = (await jetStreamManager.streams.list().next()).filter(x => x.config.name !== tracingStreamName)

  postMessage({
    type: 'streams',
    streams: streams.sort((a, b) => a.config.name.localeCompare(b.config.name))
  })

  for (const stream of streams) {
    await createConsumer({
      jetStreamClient,
      streamName: stream.config.name,
      consumerConfigurationOverride: {
        deliver_policy: DeliverPolicy.StartTime, // we want to start at a specific time
        opt_start_time: startTime
      },
      onMessage: message => {
        const entry = {
          stream,
          info: message.info,
          data: message.data,
          headers: message.headers?.headers,
          seq: message.seq,
          subject: message.subject
        }

        postMessage({ type: 'message', message: entry })
      }
    })
  }
}

async function fetchMessageTrace(messageId) {
  const natsConnection = await getNatsConnection(),
    jetStreamClient = natsConnection.jetstream()

  await createConsumer({
    jetStreamClient,
    streamName: tracingStreamName,
    subject: `Tracing.${messageId}`,
    onMessage: message => {
      const entry = {
        messageId,
        info: message.info,
        data: message.data,
        headers: message.headers?.headers,
        seq: message.seq
      }

      postMessage({ type: 'messageTrace', message: entry })
    }
  })
}

async function createConsumer(options) {
  const { jetStreamClient, streamName, consumerConfigurationOverride, onMessage, subject = '>' } = options,
    consumerConfiguration = {
      ack_policy: AckPolicy.None, // we don't need to ack messages
      deliver_subject: createInbox(), // specify subject to make this consumer a push consumer
      description: 'apollo-jetstream debug consumer',
      replay_policy: ReplayPolicy.Instant, // get messages as soon as possible
      ...consumerConfigurationOverride
    },
    consumerOptions = {
      config: consumerConfiguration,
      stream: streamName
    },
    subscription = await jetStreamClient.subscribe(subject, consumerOptions)

  subscriptions.push(subscription)
  ;(async () => {
    for await (const message of subscription) {
      onMessage(message)
    }
  })()
}

async function getNatsConnection() {
  try {
    return await connectionPromise
  } catch (e) {
    throw `Failed to connect to NATS server at ${serverUri}`
  }
}
