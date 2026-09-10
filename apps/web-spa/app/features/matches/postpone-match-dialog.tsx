import { Button } from '@pitchkit/ui/components/primitives/button'
import { DatePicker } from '@pitchkit/ui/components/primitives/date-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pitchkit/ui/components/primitives/dialog'
import { Label } from '@pitchkit/ui/components/primitives/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pitchkit/ui/components/primitives/select'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  combineDateAndTime,
  TIME_OPTIONS,
  timeFromDate,
} from './match-schedule-utils'

type PostponeMatchDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentStartsAt: string
  isPending?: boolean
  onConfirm: (startsAt: Date) => void
}

export function PostponeMatchDialog({
  open,
  onOpenChange,
  currentStartsAt,
  isPending,
  onConfirm,
}: PostponeMatchDialogProps) {
  const { t } = useTranslation()
  const [date, setDate] = useState<Date | undefined>()
  const [time, setTime] = useState('19:00')

  useEffect(() => {
    if (!open) return
    const current = new Date(currentStartsAt)
    setDate(current)
    setTime(timeFromDate(current))
  }, [open, currentStartsAt])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('matches.postponeTitle')}</DialogTitle>
          <DialogDescription>{t('matches.postponeDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('matches.date')}</Label>
            <DatePicker
              value={date}
              onDateChange={setDate}
              localeCode="fr-FR"
              placeholder={t('matches.datePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('matches.time')}</Label>
            <Select value={time} onValueChange={(v) => v && setTime(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('matches.postponeCancel')}
          </Button>
          <Button
            disabled={!date || isPending}
            onClick={() => {
              if (!date) return
              onConfirm(combineDateAndTime(date, time))
            }}
          >
            {t('matches.postponeConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
