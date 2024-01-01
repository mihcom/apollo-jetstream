import { AckPolicy, connect, DeliverPolicy, ReplayPolicy, createInbox } from 'nats.ws'
import moment from 'moment/moment.js'

const tracingStreamName = 'Tracing',
  debugConsumerDescription = 'apollo-jetstream debug consumer'

let natsServerAddress, connectionPromise

onmessage = event => {
  const { type } = event.data

  switch (type) {
    case 'setNatsServerAddress':
      natsServerAddress = event.data.natsServerAddress
      ;(async () => {
        while (true) {
          connectionPromise = connect({ servers: natsServerAddress, maxReconnectAttempts: -1 })

          try {
            const nc = await connectionPromise

            postMessage({ type: 'natsConnectivityChanged', status: 'connected' })
            ;(async () => {
              for await (const s of nc.status()) {
                postMessage({ type: 'natsConnectivityChanged', status: s.type })
              }
            })().then()

            // noinspection JSIgnoredPromiseFromCall
            watchStreams()

            break
          } catch {
            postMessage({ type: 'natsConnectivityChanged', status: 'connectionError', message: `Failed to connect to NATS server at ${natsServerAddress}` })
            await new Promise(resolve => setTimeout(resolve, 5000))
          }
        }
      })().then()

      break

    case 'getStreams':
      // noinspection JSIgnoredPromiseFromCall
      getStreams(event.data.startTime)
      break

    case 'fetchMessageTrace':
      // noinspection JSIgnoredPromiseFromCall
      fetchMessageTrace(event.data.messageId)
      break

    case 'listenForFailures':
      // noinspection JSIgnoredPromiseFromCall
      listenForFailures(event.data.startTime)
      break

    case 'getConsumers':
      // noinspection JSIgnoredPromiseFromCall
      getConsumers(event.data.streamName)
      break

    default:
      throw `Unknown message type: ${type}`
  }
}

let subscriptions = [],
  pullInterval

async function getStreams(startTime) {
  await connectionPromise

  clearInterval(pullInterval)

  for (const subscription of subscriptions) {
    subscription.destroy()
  }

  subscriptions = []

  const natsConnection = await getNatsConnection(),
    jetStreamManager = await natsConnection.jetstreamManager()

  const streams = (await jetStreamManager.streams.list().next()).filter(x => x.config.name !== tracingStreamName)

  postMessage({
    type: 'streams',
    streams: streams.sort((a, b) => a.config.name.localeCompare(b.config.name))
  })

  for (const stream of streams) {
    await createStreamConsumer(stream, startTime)
  }
}

async function getConsumers(streamName) {
  await connectionPromise

  const natsConnection = await getNatsConnection(),
    jetStreamManager = await natsConnection.jetstreamManager(),
    consumers = (await jetStreamManager.consumers.list(streamName).next()).filter(x => x.config.description !== debugConsumerDescription)

  postMessage({
    type: 'consumers',
    consumers: consumers.sort((a, b) => a.name.localeCompare(b.name))
  })
}

async function createStreamConsumer(stream, startTime) {
  const natsConnection = await getNatsConnection(),
    jetStreamClient = natsConnection.jetstream()

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

async function fetchMessageTrace(messageId) {
  const natsConnection = await getNatsConnection(),
    jetStreamClient = natsConnection.jetstream()

  await createConsumer({
    jetStreamClient,
    streamName: tracingStreamName,
    subject: `Tracing.${messageId}.*`,
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
      description: debugConsumerDescription,
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

async function watchStreams() {
  const natsConnection = await getNatsConnection(),
    subscription = natsConnection.subscribe('$JS.EVENT.ADVISORY.STREAM.>')

  ;(async () => {
    for await (const message of subscription) {
      const content = JSON.parse(new TextDecoder().decode(message.data))

      if (content.action !== 'create' && content.action !== 'delete') {
        continue
      }

      const startTime = moment().toISOString(),
        streamName = content.stream,
        jetStreamManager = await natsConnection.jetstreamManager(),
        streams = (await jetStreamManager.streams.list().next()).filter(x => x.config.name !== tracingStreamName),
        stream = streams.find(x => x.config.name === streamName)

      if (!stream) {
        continue
      }

      postMessage({
        type: 'streams',
        streams: streams.sort((a, b) => a.config.name.localeCompare(b.config.name))
      })

      if (content.action === 'create') {
        await createStreamConsumer(stream, startTime)
      }
    }
  })()
}

async function listenForFailures(startTime) {
  await awaitOnStream(tracingStreamName)

  const natsConnection = await getNatsConnection(),
    jetStreamClient = natsConnection.jetstream()

  await createConsumer({
    jetStreamClient,
    streamName: tracingStreamName,
    subject: `Tracing.*.Failure`,
    consumerConfigurationOverride: {
      deliver_policy: DeliverPolicy.StartTime, // we want to start at a specific time
      opt_start_time: startTime
    },
    onMessage: message => {
      const messageId = message.subject.match(/^Tracing\.(.*)\.Failure$/)[1],
        entry = {
          messageId,
          info: message.info,
          data: message.data,
          headers: message.headers?.headers,
          seq: message.seq
        }

      postMessage({ type: 'messageFailure', message: entry })
    }
  })
}

async function awaitOnStream(streamName) {
  const natsConnection = await getNatsConnection(),
    jetStreamManager = await natsConnection.jetstreamManager()

  while (true) {
    const streams = await jetStreamManager.streams.list().next(),
      stream = streams.find(x => x.config.name === streamName)

    if (stream) {
      return stream
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }
}

async function getNatsConnection() {
  try {
    return await connectionPromise
  } catch (e) {
    throw `Failed to connect to NATS server at ${natsServerAddress}`
  }
}
