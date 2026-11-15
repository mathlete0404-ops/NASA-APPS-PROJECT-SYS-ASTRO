// Per-crew pet wardrobe, kept on this device (same approach as the pet's name and hatch flag).
import { EMPTY_WARDROBE, sanitize } from '../engine/petshop'
import { createCrewStore } from './localStore'

export const useWardrobe = createCrewStore('crew-mirror:pet-wardrobe', EMPTY_WARDROBE, sanitize)
