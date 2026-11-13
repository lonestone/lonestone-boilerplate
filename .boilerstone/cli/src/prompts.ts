/**
 * Enquirer prompts with their types: the package ships constructors that its
 * typings do not describe.
 */
import Enquirer from 'enquirer'

interface InputPromptOptions {
  message: string
  initial?: string
}

interface ConfirmPromptOptions {
  name: string
  message: string
  initial?: boolean
}

interface ChoicePromptOptions {
  name: string
  message: string
  choices: string[]
  initial?: number | string[]
}

interface Prompt<T> {
  run: () => Promise<T>
}

interface EnquirerConstructors {
  Input: new (options: InputPromptOptions) => Prompt<string>
  Confirm: new (options: ConfirmPromptOptions) => Prompt<boolean>
  Select: new (options: ChoicePromptOptions) => Prompt<string>
  MultiSelect: new (options: ChoicePromptOptions) => Prompt<string[]>
}

export const { Confirm, Input, MultiSelect, Select } = Enquirer as unknown as EnquirerConstructors
