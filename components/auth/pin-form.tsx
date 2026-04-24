'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/lib/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Lock, Loader2 } from 'lucide-react'

interface PinFormProps {
  onSuccess: () => void
  onBack?: () => void
}

export function PinForm({ onSuccess, onBack }: PinFormProps) {
  const { loginWithPin, isLoading } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [])

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newPin = pin.split('')
    newPin[index] = value
    const newPinString = newPin.join('').slice(0, 4)
    setPin(newPinString)

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    if (newPinString.length === 4) {
      handleSubmit(newPinString)
    }

    if (error) setError('')
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleSubmit = async (pinValue?: string) => {
    const pinToSubmit = pinValue || pin
    if (pinToSubmit.length !== 4) return

    setError('')
    setIsSubmitting(true)

    try {
      const result = await loginWithPin(pinToSubmit)

      if (result.success) {
        onSuccess()
      } else {
        setError(result.message)
        setPin('')
        inputRefs.current[0]?.focus()
      }
    } catch (error) {
      setError('An unexpected error occurred')
      setPin('')
      inputRefs.current[0]?.focus()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)

    if (pastedData.length === 4) {
      setPin(pastedData)
      handleSubmit(pastedData)
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map((index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={pin[index] || ''}
              onChange={(e) => handlePinChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              className="h-14 w-14 rounded-xl border-2 border-border bg-muted/50 text-center text-2xl font-bold text-foreground transition-all duration-200 focus:border-primary focus:bg-primary/5 focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-40"
              disabled={isSubmitting}
            />
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Enter your 4-digit PIN
        </p>
      </div>

      <Button
        onClick={() => handleSubmit()}
        className="w-full h-11 rounded-xl bg-primary font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
        disabled={pin.length !== 4 || isSubmitting || isLoading}
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Verify PIN
          </span>
        )}
      </Button>

      {onBack && (
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="w-full text-muted-foreground hover:text-foreground"
          disabled={isSubmitting}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Login
        </Button>
      )}
    </div>
  )
}
