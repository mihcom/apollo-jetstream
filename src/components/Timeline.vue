<script setup>
import * as d3 from 'd3'
import { onMounted, ref, watch, onBeforeUnmount, computed } from 'vue'
import { useJetStreamStore } from '../stores/JetStream'
import { millis } from 'nats.ws'
import moment from 'moment'
import pluralize from 'pluralize'
import hotkeys from 'hotkeys-js'
import { throttle } from 'throttle-debounce'
import groupToMap from 'core-js/actual/array/group-to-map'
import StreamInfo from './StreamInfo'

const store = useJetStreamStore(),
  svgContainer = ref(null),
  timeRanges = ['Live', 'Last 5 minutes', 'Last 15 minutes', 'Last 30 minutes', 'Last 1 hour', 'Last 2 hours', 'Last 4 hours', 'Last 8 hours', 'Last 24 hours'],
  customRanges = ref([]),
  dateFormat = 'HH:mm:ss.SSS',
  rangeUi = () =>
    customRanges.value.length
      ? `${moment(customRanges.value[0][0]).format(dateFormat)} - ${moment(customRanges.value[0][1]).format(dateFormat)}`
      : store.timeRange,
  selectedStream = ref(undefined),
  openDialog = ref(false)

let animationFrameRequestId,
  watchers = [],
  pauseAnimation = false,
  xScale

onMounted(async () => {
  // output data when streams are changed
  watch(() => store.streams, outputData)

  // output data when window is resized
  window.onresize = throttle(500, () => outputData(true), { noLeading: true })

  hotkeys('esc', () => {
    customRanges.value.shift()
    customRanges.value = [...customRanges.value]
  })

  hotkeys('shift+right', () => scrollTimeline('right'))
  hotkeys('shift+left', () => scrollTimeline('left'))

  hotkeys('ctrl+right', () => selectMessage('next'))
  hotkeys('ctrl+left', () => selectMessage('previous'))

  // output data on load
  outputData()
})

onBeforeUnmount(cleanup)

function cleanup() {
  cancelAnimationFrame(animationFrameRequestId)

  watchers.forEach(unwatch => unwatch())
  watchers = []
}

function outputData(forceRender) {
  cleanup()

  d3.select(svgContainer.value).selectAll('*').remove()

  const streams = store.streams,
    messages = store.messages,
    leftMargin = 130,
    rightMargin = 50,
    width = window.innerWidth - rightMargin,
    height = window.innerHeight / 2 - 30,
    svg = d3
      .select(svgContainer.value)
      .append('svg')
      .attr('class', 'timeline')
      .attr('width', window.innerWidth)
      .attr('height', window.innerHeight / 2)
      .on('wheel', zoom),
    rangeSelector = d3.select('svg.timeline').append('rect').attr('class', 'range-selector').attr('x', 0).attr('y', 0).attr('width', 0).attr('height', height),
    tooltip = d3.select(svgContainer.value).append('div').attr('class', 'tooltip').style('opacity', 0),
    timeRange = () => [Date.now() - store.duration, Date.now()],
    mouseDown = ref(undefined),
    yScale = d3
      .scaleBand()
      .domain(streams.map(x => x.config.name))
      .range([0, height]),
    accent = d3
      .scaleOrdinal()
      .domain(streams.map(x => x.config.name))
      .range(d3.schemeTableau10),
    g = svg.append('g').attr('transform', 'translate(' + leftMargin + ',' + 10 + ')')

  xScale = d3
    .scaleTime()
    .domain(timeRange())
    .range([0, width - leftMargin])

  let animationContainerStart = timeRange()[0],
    lastStreamStatisticsSize = undefined,
    lastStreamStatisticsMin = undefined

  svg.on('mousedown', e => {
    pauseAnimation = true
    mouseDown.value = e.offsetX
    rangeSelector.attr('x', e.offsetX).attr('width', 0)
  })

  svg.on('mouseup', e => {
    pauseAnimation = false

    const mousedownValue = mouseDown.value

    rangeSelector.attr('width', 0)
    mouseDown.value = undefined

    if (Math.abs(mousedownValue - e.offsetX) < 10) {
      return
    }

    const left = xScale.invert(mousedownValue - leftMargin).getTime(),
      right = xScale.invert(e.offsetX - leftMargin).getTime(),
      domain = [Math.min(left, right), Math.max(left, right)]

    customRanges.value = [domain, ...customRanges.value]
    pauseAnimation = false
  })

  svg.on('mousemove', e => {
    const tooltipParts = [xScale.invert(e.offsetX - leftMargin)]

    if (mouseDown.value !== undefined) {
      tooltipParts.push(xScale.invert(mouseDown.value - leftMargin))
    }

    let tooltipText

    if (tooltipParts.length === 1) {
      tooltipText = moment(tooltipParts[0]).format(dateFormat)
    } else {
      const start = moment(Math.min(...tooltipParts)),
        end = moment(Math.max(...tooltipParts)),
        duration = moment.duration(end.diff(start))

      const elementsInRange = data.value.reduce((acc, x) => {
        const messageMoment = moment(millis(x.timestampNanos))

        if (messageMoment.isBetween(start, end)) {
          acc.push(x)
        }

        return acc
      }, [])

      tooltipText = `${start.format(dateFormat)} - ${end.format(dateFormat)} (${
        duration.asSeconds() > 3 ? duration.humanize() : duration.asMilliseconds() + ' ms'
      })`

      if (e.shiftKey) {
        elementsInRange.forEach((message, i) => {
          console.log(i, JSON.parse(new TextDecoder().decode(message.data)))
        })
      }

      if (elementsInRange.length > 0) {
        tooltipText += `<br/>${elementsInRange.length} ${pluralize('message', elementsInRange.length)} in range<hr/>`

        groupToMap(elementsInRange, x => x.stream).forEach((value, key) => {
          tooltipText += `${key}: ${value.length} ${pluralize('message', value.length)}<br/>`
        })
      }
    }

    tooltip
      .style('top', `${e.offsetY + 23}px`)
      .style('left', `${e.offsetX + 100 < width ? e.offsetX + 15 : e.offsetX - 93}px`)
      .style('opacity', e.offsetX > leftMargin ? '1' : '0')
      .html(tooltipText)

    if (e.buttons !== 1 || mouseDown.value === undefined) {
      // ignore if primary buttons is not pressed
      return
    }

    const rangeSelectorWidth = e.offsetX - mouseDown.value

    // user can drag mouse left or right
    if (rangeSelectorWidth > 0) {
      rangeSelector.attr('x', mouseDown.value).attr('width', rangeSelectorWidth)
    } else {
      rangeSelector.attr('x', mouseDown.value + rangeSelectorWidth).attr('width', Math.abs(rangeSelectorWidth))
    }
  })

  svg.on('mouseenter', () => tooltip.style('opacity', 1))
  svg.on('mouseleave', () => tooltip.style('opacity', 0))

  // add the x Axis (time)
  g.append('g')
    .attr('class', 'axis axis--x')
    .attr('transform', 'translate(0,' + height + ')')
    .call(d3.axisBottom(xScale).tickFormat(timeStamp => moment(timeStamp).format(dateFormat)))

  // add the y Axis (streams)
  g.append('g')
    .attr('class', 'axis axis--y')
    .call(d3.axisLeft(yScale))
    .selectAll('text')
    .style('fill', d => accent(d))
    .attr('data-stream', d => d)

  // add the animation container
  const animationContainer = g.append('g').attr('class', 'animation-container'),
    messagesCoordinatesMap = new Map()

  g.selectAll('.axis--y .tick').on('click', (_, streamName) => {
    const stream = streams.find(x => x.config.name === streamName)
    selectedStream.value = stream
    openDialog.value = true
  })

  const prepareDataEntry = x => ({
      stream: x.stream.config.name,
      subject: x.subject,
      data: x.data,
      id: `${x.stream.config.name}_${x.seq}`,
      timestampNanos: x.info.timestampNanos,
      message: x
    }),
    data = computed(() => messages.map(prepareDataEntry)),
    messageRadius = 5

  manageLiveEvents()

  renderData(forceRender)

  watchers.push(
    watch(
      () => store.timeRange,
      () => {
        if (customRanges.value.length) {
          customRanges.value = []
        }

        manageLiveEvents()
      }
    )
  )

  watchers.push(
    watch(customRanges, () => {
      manageLiveEvents()
      displayCustomRange()
    })
  )

  watchers.push(watch(data, throttle(333, renderData, { noLeading: true })))

  watchers.push(watch(() => store.selectedTimestamp, displayTimestampMarker))

  watchers.push(watch(store.failures, displayFailures))
  displayFailures(store.failures)

  watchers.push(
    watch(
      () => store.selectedMessage,
      () => {
        animationContainer.selectAll('.jetstream-message').attr('class', function (d) {
          let result = 'jetstream-message'

          if (d.message === store.selectedMessage) {
            result += ' selected'
          }

          return result
        })
      }
    )
  )

  function renderData(forceRender) {
    if (!forceRender && customRanges.value.length) {
      return // do not render data if custom range is selected
    }

    const visibleData = data.value.filter(d => xScale(millis(d.timestampNanos)) > 0)

    animationContainer
      .selectAll('.jetstream-message')
      .data(visibleData, d => d.id)
      .join(
        enter =>
          enter
            .append('circle')
            .attr('class', function (d) {
              let result = 'jetstream-message'

              if (d.message === store.selectedMessage) {
                result += ' selected'
              }

              return result
            })
            .attr('cx', function (d) {
              const xCoordinate = xScale(millis(d.timestampNanos)) - xScale(animationContainerStart),
                cacheKey = Math.floor(xCoordinate)

              let cache = messagesCoordinatesMap.get(cacheKey)

              if (!cache) {
                cache = []
                messagesCoordinatesMap.set(cacheKey, cache)
              }

              cache.push(this)

              return xCoordinate
            })
            .attr('cy', d => yScale(d.stream) + 16)
            .attr('r', messageRadius)
            .attr('fill', d => accent(d.stream))
            .attr('data-stream', d => d.stream)
            .on('click', function (_, d) {
              store.selectedMessage = d.message
            })
            .append('title')
            .text(d => `${d.subject} at ${moment(millis(d.timestampNanos)).format('HH:mm:ss.SSS')}`),
        update => update,
        exit => exit.remove()
      )

    updateStreamStatistics()
  }

  function manageLiveEvents() {
    if (store.timeRange === 'Live' && !customRanges.value.length) {
      captureLiveEvents()
    } else {
      stopLiveEvents()
    }
  }

  function captureLiveEvents() {
    stopLiveEvents()

    let lastAnimated

    animationContainerStart = timeRange()[0]

    function animate(now) {
      if (!pauseAnimation && (!lastAnimated || now - lastAnimated > 1000)) {
        lastAnimated = now
        xScale.domain(timeRange())
        svg
          .select('.axis--x')
          .transition()
          .call(d3.axisBottom(xScale).tickFormat(timeStamp => moment(timeStamp).format(dateFormat)))

        const animationContainerStartScaled = xScale(animationContainerStart)

        animationContainer.transition().attr('transform', `translate(${animationContainerStartScaled}, 0)`)

        for (let [x, elements] of messagesCoordinatesMap) {
          if (x + animationContainerStartScaled <= 10) {
            elements.forEach(e => {
              d3.select(e).transition().attr('opacity', 0)
              d3.select(e).classed('out', true)
            })
            messagesCoordinatesMap.delete(x)
          }
        }
      }

      animationFrameRequestId = requestAnimationFrame(animate)
    }

    animationFrameRequestId = requestAnimationFrame(animate)
  }

  function stopLiveEvents() {
    cancelAnimationFrame(animationFrameRequestId)
  }

  function displayCustomRange() {
    const domain = customRanges.value.length ? customRanges.value[0] : timeRange()

    xScale.domain(domain)
    d3.select('.axis--x')
      .transition()
      .call(d3.axisBottom(xScale).tickFormat(timeStamp => moment(timeStamp).format(dateFormat)))

    animationContainer.selectAll('.jetstream-message').call(d => d.transition().attr('cx', d => xScale(millis(d.timestampNanos))))

    animationContainer.selectAll('.failure').call(d =>
      d
        .transition()
        .attr('x1', d => xScale(millis(d.info.timestampNanos)))
        .attr('x2', d => xScale(millis(d.info.timestampNanos)))
    )

    if (!customRanges.value.length) {
      outputData(true) // force render when custom range is removed
    }

    updateStreamStatistics(true)
  }

  function zoom(e) {
    if (e.deltaY > 0) {
      // zoom out
      customRanges.value.shift()
      customRanges.value = [...customRanges.value]
      return
    }

    const focusPointX = e.offsetX - leftMargin,
      focusPointTime = xScale.invert(focusPointX).getTime(),
      domain = xScale.domain().map(x => x.getTime()),
      domainDuration = domain[1] - domain[0],
      newDomainDuration = domainDuration / 3,
      range = xScale.range(),
      focusPointScaled = (focusPointX - range[0]) / (range[1] - range[0]),
      newDomain = [focusPointTime - newDomainDuration * focusPointScaled, focusPointTime + newDomainDuration * (1 - focusPointScaled)]

    customRanges.value = [newDomain, ...customRanges.value]
  }

  function updateStreamStatistics(force) {
    const statisticsSize = messagesCoordinatesMap.size,
      statisticsMin = messagesCoordinatesMap.keys().next().value

    if (!force && lastStreamStatisticsSize === statisticsSize && lastStreamStatisticsMin === statisticsMin) {
      return
    }

    lastStreamStatisticsSize = statisticsSize
    lastStreamStatisticsMin = statisticsMin

    const messages = animationContainer.selectAll('.jetstream-message:not(.out)').filter(d => {
        const x = xScale(millis(d.timestampNanos))
        return x >= 0 && x <= width
      }),
      streamsStatistics = groupToMap(messages.data(), x => x.stream)

    d3.selectAll('text[data-stream]').each(function () {
      d3.select(this).text(this.dataset.stream)
    })

    streamsStatistics.forEach((value, key) => {
      d3.select(`text[data-stream="${key}"]`).text(`${key} (${value.length})`)
    })
  }

  function displayTimestampMarker(timestamp) {
    if (timestamp === undefined) {
      animationContainer.selectAll('.timestamp-marker').remove()
      return
    }

    let x = xScale(millis(timestamp))

    if (!customRanges.value.length) {
      x -= xScale(animationContainerStart)
    }

    animationContainer
      .selectAll('.timestamp-marker')
      .data([timestamp])
      .join(enter =>
        enter
          .append('line')
          .attr('class', 'timestamp-marker')
          .attr('x1', x)
          .attr('x2', x)
          .attr('y1', 0)
          .attr('y2', height)
          .attr('stroke', '#2196f3')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '5,5')
      )
  }

  function displayFailures(failures) {
    function x(d) {
      let x = xScale(millis(d.info.timestampNanos))

      if (!customRanges.value.length) {
        x -= xScale(animationContainerStart)
      }

      return x
    }

    animationContainer
      .selectAll('.failure')
      .data(failures, x => `${x.info.stream}_${x.seq}`)
      .join(enter =>
        enter
          .append('line')
          .attr('class', 'failure')
          .attr('x1', x)
          .attr('x2', x)
          .attr('y1', 0)
          .attr('y2', height)
          .on('click', function (_, d) {
            const stream = d.headers.get('Tracing.Headers.Stream')[0],
              messageId = d.messageId

            store.selectMessage(stream, messageId)
          })
      )
  }
}

function scrollTimeline(direction) {
  const scrollPercentage = 0.2,
    domainDirectionMultiplier = direction === 'right' ? 1 : -1,
    domain = xScale.domain().map(x => x.getTime()),
    domainDuration = domain[1] - domain[0],
    newDomain = [
      domain[0] + domainDuration * scrollPercentage * domainDirectionMultiplier,
      domain[1] + domainDuration * scrollPercentage * domainDirectionMultiplier
    ]

  customRanges.value = [newDomain, ...customRanges.value.slice(1)]
}

function selectMessage(direction) {
  if (!store.selectedMessage) {
    return
  }

  const messageSeq = store.selectedMessage.seq + (direction === 'next' ? 1 : -1),
    message = store.messages.find(x => x.stream.config.name === store.selectedMessage.stream.config.name && x.seq === messageSeq)

  if (!message) {
    return
  }

  store.selectedMessage = message
}
</script>

<template>
  <div class="timeline">
    <v-select :items="timeRanges" outlines density="compact" variant="underlined" v-model="store.timeRange">
      <template v-slot:selection="data"> {{ rangeUi() }} </template>
    </v-select>
    <div ref="svgContainer" class="svg-container" />
    <v-progress-linear color="grey-darken-3" indeterminate location="bottom" absolute :active="store.loading" />
    <v-dialog v-model="openDialog" max-width="40em">
      <stream-info :stream="selectedStream" @close="openDialog = false" />
    </v-dialog>
  </div>
</template>

<style lang="stylus" scoped>
.timeline
  position relative

  .v-select
    position absolute
    right 1em
    top 0
    width 15em

  .v-col:first-child
    flex 0 0 12em
</style>

<style lang="stylus">
.axis
  font 10px sans-serif

  &.axis--y
    cursor pointer

    .tick
      transition all 0.2s ease-in-out

      &:hover
        color yellowgreen

.jetstream-message
  stroke white
  stroke-width 1px
  margin-top 0.5em
  cursor pointer

  &.selected
    fill red
    stroke-width 2px

  &:hover
    fill #646cff

.range-selector
  fill #2B2E33

svg text
  -webkit-user-select none
  -moz-user-select none
  -ms-user-select none
  user-select none

svg text::selection
  background none

.tooltip
  position absolute
  background-color #22252B
  color #fff
  padding 5px
  border-radius 2px
  transition opacity 0.5s
  pointer-events none
  z-index 100

.failure
  stroke red
  stroke-width 10px
  cursor pointer
  opacity: 0.3
</style>
