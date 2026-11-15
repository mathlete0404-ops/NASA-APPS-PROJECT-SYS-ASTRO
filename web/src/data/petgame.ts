// Per-crew pet trips, odometer and Space Exchange holdings, kept on this device.
import { EMPTY_GAME, sanitizeGame } from '../engine/petgame'
import { createCrewStore } from './localStore'

export const useGame = createCrewStore('crew-mirror:pet-game', EMPTY_GAME, sanitizeGame)
