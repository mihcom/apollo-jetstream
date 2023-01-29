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
  watchers = []

onMounted(async () => {
  // output data when streams are changed
  watch(() => store.streams, outputData)

  // output data when window is resized
  window.onresize = throttle(500, () => outputData(true), { noLeading: true })

  hotkeys('esc', () => {
    customRanges.value.shift()
    customRanges.value = [...customRanges.value]
  })

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
      .attr('height', window.innerHeight / 2),
    rangeSelector = d3.select('svg.timeline').append('rect').attr('class', 'range-selector').attr('x', 0).attr('y', 0).attr('width', 0).attr('height', height),
    tooltip = d3.select(svgContainer.value).append('div').attr('class', 'tooltip').style('opacity', 0),
    timeRange = () => [Date.now() - store.duration, Date.now()],
    mouseDown = ref(undefined),
    xScale = d3
      .scaleTime()
      .domain(timeRange())
      .range([0, width - leftMargin]),
    yScale = d3
      .scaleBand()
      .domain(streams.map(x => x.config.name))
      .range([0, height]),
    accent = d3
      .scaleOrdinal()
      .domain(streams.map(x => x.config.name))
      .range(d3.schemeTableau10),
    g = svg.append('g').attr('transform', 'translate(' + leftMargin + ',' + 10 + ')')

  let animationContainerStart = timeRange()[0],
    pauseAnimation = false

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
      .style('top', `${e.offsetY + 18}px`)
      .style('left', `${e.offsetX + 100 < width ? e.offsetX + 28 : e.offsetX - 100}px`)
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
    .call(d3.axisBottom(xScale))

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
      id: x.reply,
      timestampNanos: x.info.timestampNanos,
      message: x
    }),
    data = computed(() => messages.map(prepareDataEntry)),
    messageRadius = 5

  manageLiveEvents()

  if (forceRender) {
    renderData()
  }

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

  function renderData() {
    animationContainer
      .selectAll('.message')
      .data(data.value, d => d.id)
      .join(enter =>
        enter
          .append('circle')
          .attr('class', 'message')
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
          .attr('cy', d => yScale(d.stream) + 5)
          .attr('r', messageRadius)
          .attr('fill', d => accent(d.stream))
          .attr('opacity', 1)
          .attr('data-stream', d => d.stream)
          .on('click', function (_, d) {
            animationContainer.selectAll('.message.selected').classed('selected', false)
            d3.select(this).classed('selected', true)
            store.selectedMessage = d.message
          })
          .append('title')
          .text(d => `${d.subject} at ${moment(millis(d.timestampNanos)).format('HH:mm:ss.SSS')}`)
      )
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
        svg.select('.axis--x').transition().call(d3.axisBottom(xScale))

        const animationContainerStartScaled = xScale(animationContainerStart)

        animationContainer.transition().attr('transform', `translate(${animationContainerStartScaled}, 10)`)
        animationContainer.selectAll('.message.out').remove()

        for (let [x, elements] of messagesCoordinatesMap) {
          if (x + animationContainerStartScaled <= 10) {
            elements.forEach(e => {
              d3.select(e).transition().attr('opacity', 0)
              d3.select(e).classed('out', true)
            })
            messagesCoordinatesMap.delete(x)
          }
        }

        updateStreamStatistics()
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
    d3.select('.axis--x').transition().call(d3.axisBottom(xScale))

    animationContainer.selectAll('.message').call(d => d.transition().attr('cx', d => xScale(millis(d.timestampNanos))))

    updateStreamStatistics(true)
  }

  let lastStreamStatisticsSize = undefined,
    lastStreamStatisticsMin = undefined

  function updateStreamStatistics(force) {
    const statisticsSize = messagesCoordinatesMap.size,
      statisticsMin = messagesCoordinatesMap.keys().next().value

    if (!force && lastStreamStatisticsSize === statisticsSize && lastStreamStatisticsMin === statisticsMin) {
      return
    }

    lastStreamStatisticsSize = statisticsSize
    lastStreamStatisticsMin = statisticsMin

    const messages = animationContainer.selectAll('.message').filter(d => {
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
}
</script>

<template>
  <v-select :items="timeRanges" outlines density="compact" variant="underlined" v-model="store.timeRange">
    <template v-slot:selection="data"> {{ rangeUi() }} </template>
  </v-select>
  <div ref="svgContainer" class="svg-container" />
  <v-progress-linear color="grey-darken-3" indeterminate location="bottom" absolute :active="store.loading" />
  <v-dialog v-model="openDialog" max-width="40em">
    <v-card>
      <v-toolbar color="primary" dense>
        <v-toolbar-title><v-icon>mdi-tray-full</v-icon> {{ selectedStream?.config.name }} </v-toolbar-title>
      </v-toolbar>
      <v-card-text>
        <v-row v-if="selectedStream?.config.description">
          <v-col>Description</v-col>
          <v-col>{{ selectedStream?.config.description }}</v-col>
        </v-row>
        <v-row>
          <v-col><v-icon>mdi-filter</v-icon> Subjects</v-col>
          <v-col>{{ selectedStream?.config.subjects.join(', ') }}</v-col>
        </v-row>
        <v-row>
          <v-col><v-icon>mdi-database</v-icon>Retention policy</v-col>
          <v-col
            >{{ selectedStream?.config.retention }}
            <ul class="limits">
              <li v-if="selectedStream?.config.max_age > 0">{{ moment.duration(millis(selectedStream?.config.max_age)).humanize() }} lifetime</li>
              <li v-if="selectedStream?.config.max_bytes > 0">
                {{ selectedStream?.config.max_bytes }} bytes ({{
                  (selectedStream?.config.max_bytes / 1024 / 1024).toLocaleString('da-DK', {
                    style: 'unit',
                    unit: 'megabyte',
                    unitDisplay: 'long'
                  })
                }})
              </li>
              <li v-if="selectedStream?.config.max_msgs > 0">{{ selectedStream?.config.max_msgs.toLocaleString('da-DK') }} messages</li>
            </ul>
          </v-col>
        </v-row>
        <v-row>
          <v-col><v-icon>mdi-email-multiple</v-icon> Messages</v-col>
          <v-col>{{ selectedStream?.state.messages.toLocaleString('da-DK') }}</v-col>
        </v-row>
        <v-row>
          <v-col><v-icon>mdi-content-save</v-icon> Size</v-col>
          <v-col>
            {{
              (selectedStream?.state.bytes / 1024 / 1024).toLocaleString('da-DK', {
                style: 'unit',
                unit: 'megabyte',
                unitDisplay: 'long'
              })
            }}</v-col
          >
        </v-row>
        <v-row>
          <v-col><v-icon>mdi-human-queue</v-icon> Consumers</v-col>
          <v-col>{{ (selectedStream?.state.consumer_count - 1).toLocaleString('da-DK') }}</v-col>
        </v-row>
        <v-row>
          <v-col><v-icon>mdi-calendar-clock</v-icon> First message</v-col>
          <v-col>
            <div v-if="selectedStream?.state.first_ts != '0001-01-01T00:00:00Z'">
              {{ moment(selectedStream?.state.first_ts).format('DD MMM YYYY  HH:mm:ss.SSS') }} ({{
                moment.duration(moment().diff(moment(selectedStream?.state.first_ts))).humanize()
              }}
              ago)
            </div>
            <div v-else>never</div>
          </v-col>
        </v-row>
        <v-row>
          <v-col><v-icon>mdi-calendar-clock</v-icon> Last message</v-col>
          <v-col>
            <div v-if="selectedStream?.state.last_ts != '0001-01-01T00:00:00Z'">
              {{ moment(selectedStream?.state.last_ts).format('DD MMM YYYY  HH:mm:ss.SSS') }} ({{
                moment.duration(moment().diff(moment(selectedStream?.state.last_ts))).humanize()
              }}
              ago)
            </div>
            <div v-else>never</div>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions class="justify-end">
        <v-btn text @click="openDialog = undefined">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style lang="stylus" scoped>
.v-select
  position absolute
  right 1em
  top 0
  width 15em

.v-col:first-child
  flex 0 0 12em

ul.limits
  margin-left 1em
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

.message
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
</style>
