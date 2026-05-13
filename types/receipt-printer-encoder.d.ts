declare module '@point-of-sale/receipt-printer-encoder' {
  interface EncoderOptions {
    language?: 'esc-pos' | 'star-prnt' | 'star-line'
    columns?: number
    embedded?: boolean
    createCanvas?: unknown
  }

  interface EncoderChain {
    initialize(): EncoderChain
    codepage(value: string): EncoderChain
    align(value: 'left' | 'center' | 'right'): EncoderChain
    bold(value: boolean): EncoderChain
    text(value: string): EncoderChain
    newline(value?: string): EncoderChain
    line(value: string): EncoderChain
    cut(value?: 'full' | 'partial'): EncoderChain
    encode(format?: 'array' | 'lines' | 'commands'): Uint8Array
  }

  class ReceiptPrinterEncoder implements EncoderChain {
    constructor(options?: EncoderOptions)
    initialize(): EncoderChain
    codepage(value: string): EncoderChain
    align(value: 'left' | 'center' | 'right'): EncoderChain
    bold(value: boolean): EncoderChain
    text(value: string): EncoderChain
    newline(value?: string): EncoderChain
    line(value: string): EncoderChain
    cut(value?: 'full' | 'partial'): EncoderChain
    encode(format?: 'array' | 'lines' | 'commands'): Uint8Array
  }

  export default ReceiptPrinterEncoder
}
