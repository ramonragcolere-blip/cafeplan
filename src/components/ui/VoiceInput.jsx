import * as React from 'react';
import { useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';

/**
 * VoiceInput — wrapper sobre <input> que adiciona botão de microfone.
 * Aceita todas as props de <input> padrão, mais:
 *   - onVoiceResult(value): chamado com o texto/número reconhecido (opcional; se omitido usa onChange)
 *
 * Uso direto (substitui <Input> onde quiser voz):
 *   <VoiceInput type="text" value={v} onChange={e => setV(e.target.value)} />
 *   <VoiceInput type="number" value={v} onChange={e => setV(e.target.value)} />
 */
const VoiceInput = React.forwardRef(function VoiceInput(
  { className, type, onChange, onVoiceResult, ...props },
  ref
) {
  const isNumeric = type === 'number';

  const handleResult = useCallback((value) => {
    if (onVoiceResult) {
      onVoiceResult(value);
      return;
    }
    if (onChange) {
      // Simula evento sintético para compatibilidade com react-hook-form e state handlers
      const nativeInput = typeof ref === 'object' && ref?.current;
      if (nativeInput) {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
          ?.set?.call(nativeInput, value);
        nativeInput.dispatchEvent(new Event('input', { bubbles: true }));
        nativeInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      onChange({ target: { value, type } });
    }
  }, [onChange, onVoiceResult, ref, type]);

  const { listening, toggle, isSupported } = useVoiceRecognition({
    isNumeric,
    onResult: handleResult,
  });

  return (
    <div className="relative flex items-center w-full">
      <input
        type={type}
        ref={ref}
        onChange={onChange}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          isSupported ? 'pr-8' : '',
          className
        )}
        {...props}
      />
      {isSupported && (
        <button
          type="button"
          tabIndex={-1}
          onClick={toggle}
          title={listening ? 'Parar gravação' : 'Falar para preencher'}
          className={cn(
            'absolute right-2 flex items-center justify-center rounded-full transition-colors focus:outline-none',
            listening
              ? 'text-red-500 animate-pulse'
              : 'text-muted-foreground hover:text-primary'
          )}
        >
          {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
});

VoiceInput.displayName = 'VoiceInput';

export { VoiceInput };