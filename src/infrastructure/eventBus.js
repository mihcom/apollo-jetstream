import mitt from 'mitt'

export const eventBus = mitt()
export const events = {
  NewMessage: Symbol('NewMessage')
}
