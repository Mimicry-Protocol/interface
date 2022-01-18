import { Currency } from '@uniswap/sdk-core'
import { SupportedChainId } from 'constants/chains'
import { nativeOnChain } from 'constants/tokens'
import { atom, WritableAtom } from 'jotai'
import { atomWithImmer } from 'jotai/immer'
import { useUpdateAtom } from 'jotai/utils'
import { atomWithReset } from 'jotai/utils'
import { Customizable, pickAtom, setCustomizable, setTogglable } from 'lib/state/atoms'
import { useMemo } from 'react'

/** Max slippage, as a percentage. */
export enum MaxSlippage {
  P01 = 0.1,
  P05 = 0.5,
  // Members to satisfy CustomizableEnum; see setCustomizable
  CUSTOM = -1,
  DEFAULT = P05,
}

export const TRANSACTION_TTL_DEFAULT = 40

export interface Settings {
  maxSlippage: Customizable<MaxSlippage>
  transactionTtl: number | undefined
  mockTogglable: boolean
}

const initialSettings: Settings = {
  maxSlippage: { value: MaxSlippage.DEFAULT },
  transactionTtl: undefined,
  mockTogglable: true,
}

export const settingsAtom = atomWithReset(initialSettings)
export const maxSlippageAtom = pickAtom(settingsAtom, 'maxSlippage', setCustomizable(MaxSlippage))
export const transactionTtlAtom = pickAtom(settingsAtom, 'transactionTtl')
export const mockTogglableAtom = pickAtom(settingsAtom, 'mockTogglable', setTogglable)

export enum Field {
  INPUT = 'input',
  OUTPUT = 'output',
}

function otherField(field: Field): Field {
  switch (field) {
    case Field.INPUT:
      return Field.OUTPUT
    case Field.OUTPUT:
      return Field.INPUT
  }
}

export interface Input {
  value?: number
  token?: Currency
  usdc?: number
}

export interface State {
  activeInput: Field
  [Field.INPUT]: Input & { approved?: boolean }
  [Field.OUTPUT]: Input
  swap?: {
    lpFee: number
    priceImpact: number
    slippageTolerance: number
    integratorFee?: number
    maximumSent?: number
    minimumReceived?: number
  }
}

export const stateAtom = atomWithImmer<State>({
  activeInput: Field.INPUT,
  input: { token: nativeOnChain(SupportedChainId.MAINNET) },
  output: {},
})

export const swapAtom = pickAtom(stateAtom, 'swap')

function setInputAtom(field: Field, update: Input, state: State) {
  state.activeInput = field
  if (update.token && update.token === state[otherField(field)].token) {
    // If selecting the other field's token, swap the fields
    update.value = state[otherField(field)].value
    state[otherField(field)] = { token: state[field].token, value: state[field].value }
  }
  state[field] = update
  state.swap = undefined
}

export const inputAtom = atom(
  (get) => get(stateAtom).input,
  (get, set, update: Input & { approved?: boolean }) => {
    set(stateAtom, (state) => setInputAtom(Field.INPUT, update, state))
  }
)

export const outputAtom = atom(
  (get) => get(stateAtom).output,
  (get, set, update: Input) => {
    set(stateAtom, (state) => setInputAtom(Field.OUTPUT, update, state))
  }
)

export function useUpdateInputValue(inputAtom: WritableAtom<Input, Input>) {
  return useUpdateAtom(
    useMemo(
      () => atom(null, (get, set, value: Input['value']) => set(inputAtom, { token: get(inputAtom).token, value })),
      [inputAtom]
    )
  )
}

export function useUpdateInputToken(inputAtom: WritableAtom<Input, Input>) {
  return useUpdateAtom(
    useMemo(() => atom(null, (get, set, token: Input['token']) => set(inputAtom, { token })), [inputAtom])
  )
}

export interface Transaction {
  input: Required<Pick<Input, 'token' | 'value'>>
  output: Required<Pick<Input, 'token' | 'value'>>
  receipt: string
  timestamp: number
  elapsedMs?: number
  status?: true | Error
}

export const transactionAtom = atomWithImmer<Transaction | null>(null)
