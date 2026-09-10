import badmintonCourt from '@/assets/images/courts/badminton.jpg'
import basketballCourt from '@/assets/images/courts/basketball.jpg'
import footballCourt from '@/assets/images/courts/football.jpg'
import tennisCourt from '@/assets/images/courts/tennis.jpg'
import volleyballCourt from '@/assets/images/courts/volleyball.jpg'
import type { SportType } from '@/lib/pitchkit-api'

export function getCourtImage(sportType: SportType | null | undefined): string {
  switch (sportType) {
    case 'basketball':
      return basketballCourt
    case 'volleyball':
      return volleyballCourt
    case 'tennis':
    case 'padel':
      return tennisCourt
    case 'badminton':
      return badmintonCourt
    default:
      return footballCourt
  }
}
