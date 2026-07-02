import { Slot } from '@radix-ui/react-slot'
import {
  FileArchiveIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileCogIcon,
  FileIcon,
  FileTextIcon,
  FileVideoIcon,
} from 'lucide-react'
import * as React from 'react'
import { cn } from '@boilerstone/ui/lib/utils'

// ── helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${sizes[i]}`
}

function getFileIcon(file: File): React.ReactNode {
  const type = file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (type.startsWith('video/')) return <FileVideoIcon />
  if (type.startsWith('audio/')) return <FileAudioIcon />
  if (type.startsWith('text/') || ['txt', 'md', 'rtf', 'pdf'].includes(ext)) return <FileTextIcon />
  if (
    [
      'html',
      'css',
      'js',
      'jsx',
      'ts',
      'tsx',
      'json',
      'xml',
      'php',
      'py',
      'rb',
      'java',
      'c',
      'cpp',
      'cs',
    ].includes(ext)
  )
    return <FileCodeIcon />
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return <FileArchiveIcon />
  if (['exe', 'msi', 'app', 'apk', 'deb', 'rpm'].includes(ext) || type.startsWith('application/'))
    return <FileCogIcon />
  return <FileIcon />
}

// ── internal hooks ────────────────────────────────────────────────────────────

function useLazyRef<T>(fn: () => T): React.RefObject<T> {
  const ref = React.useRef<T | null>(null)
  if (ref.current === null) ref.current = fn()
  return ref as React.RefObject<T>
}

function useAsRef<T>(value: T): React.RefObject<T> {
  const ref = React.useRef<T>(value)
  React.useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}

// ── store ─────────────────────────────────────────────────────────────────────

interface FileState {
  file: File
  progress: number
  error?: string
  status: 'idle' | 'uploading' | 'error' | 'success'
}

interface StoreState {
  files: Map<File, FileState>
  dragOver: boolean
  invalid: boolean
}

type StoreAction =
  | { type: 'ADD_FILES'; files: File[] }
  | { type: 'SET_FILES'; files: File[] }
  | { type: 'SET_PROGRESS'; file: File; progress: number }
  | { type: 'SET_SUCCESS'; file: File }
  | { type: 'SET_ERROR'; file: File; error: string }
  | { type: 'REMOVE_FILE'; file: File }
  | { type: 'SET_DRAG_OVER'; dragOver: boolean }
  | { type: 'SET_INVALID'; invalid: boolean }
  | { type: 'CLEAR' }

interface Store {
  getState: () => StoreState
  dispatch: (action: StoreAction) => void
  subscribe: (listener: () => void) => () => void
}

const StoreContext = React.createContext<Store | null>(null)

function useStoreContext(name: string): Store {
  const ctx = React.use(StoreContext)
  if (!ctx) throw new Error(`\`${name}\` must be used within \`FileUpload\``)
  return ctx
}

function useStore<T>(selector: (state: StoreState) => T): T {
  const store = useStoreContext('useStore')
  const lastValueRef = useLazyRef<{ value: T; state: StoreState } | null>(() => null)

  const getSnapshot = React.useCallback(() => {
    const state = store.getState()
    const prev = lastValueRef.current
    if (prev && prev.state === state) return prev.value
    const next = selector(state)
    lastValueRef.current = { value: next, state }
    return next
  }, [store, selector, lastValueRef])

  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot)
}

// ── context ───────────────────────────────────────────────────────────────────

interface FileUploadContextValue {
  inputId: string
  dropzoneId: string
  listId: string
  labelId: string
  disabled: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  urlCache: WeakMap<File, string>
}

const FileUploadContext = React.createContext<FileUploadContextValue | null>(null)

function useFileUploadContext(name: string): FileUploadContextValue {
  const ctx = React.use(FileUploadContext)
  if (!ctx) throw new Error(`\`${name}\` must be used within \`FileUpload\``)
  return ctx
}

// ── FileUpload root ───────────────────────────────────────────────────────────

interface FileUploadProps extends Omit<React.ComponentProps<'div'>, 'defaultValue' | 'onChange'> {
  value?: File[]
  defaultValue?: File[]
  onValueChange?: (files: File[]) => void
  onAccept?: (files: File[]) => void
  onFileAccept?: (file: File) => void
  onFileReject?: (file: File, message: string) => void
  onFileValidate?: (file: File) => string | null | undefined
  onUpload?: (
    files: File[],
    options: {
      onProgress: (file: File, progress: number) => void
      onSuccess: (file: File) => void
      onError: (file: File, error: Error) => void
    },
  ) => Promise<void> | void
  accept?: string
  maxFiles?: number
  maxSize?: number
  label?: string
  name?: string
  asChild?: boolean
  disabled?: boolean
  invalid?: boolean
  multiple?: boolean
  required?: boolean
}

function FileUpload(props: FileUploadProps) {
  const {
    value,
    defaultValue,
    onValueChange,
    onAccept,
    onFileAccept,
    onFileReject,
    onFileValidate,
    onUpload,
    accept,
    maxFiles,
    maxSize,
    label,
    name,
    asChild,
    disabled = false,
    invalid = false,
    multiple = false,
    required = false,
    children,
    className,
    ...rootProps
  } = props

  const inputId = React.useId()
  const dropzoneId = React.useId()
  const listId = React.useId()
  const labelId = React.useId()

  const listeners = useLazyRef(() => new Set<() => void>()).current
  const filesMap = useLazyRef<Map<File, FileState>>(() => new Map()).current
  const urlCache = useLazyRef(() => new WeakMap<File, string>()).current
  const inputRef = React.useRef<HTMLInputElement>(null)
  const isControlled = value !== undefined

  const propsRef = useAsRef({
    onValueChange,
    onAccept,
    onFileAccept,
    onFileReject,
    onFileValidate,
    onUpload,
  })

  const store = React.useMemo<Store>(() => {
    let state: StoreState = { files: filesMap, dragOver: false, invalid }

    function reducer(s: StoreState, action: StoreAction): StoreState {
      switch (action.type) {
        case 'ADD_FILES': {
          for (const file of action.files) {
            filesMap.set(file, { file, progress: 0, status: 'idle' })
          }
          propsRef.current.onValueChange?.(Array.from(filesMap.values()).map((f) => f.file))
          return { ...s, files: filesMap }
        }
        case 'SET_FILES': {
          const next = new Set(action.files)
          for (const existing of filesMap.keys()) {
            if (!next.has(existing)) filesMap.delete(existing)
          }
          for (const file of action.files) {
            if (!filesMap.has(file)) {
              filesMap.set(file, { file, progress: 0, status: 'idle' })
            }
          }
          return { ...s, files: filesMap }
        }
        case 'SET_PROGRESS': {
          const fs = filesMap.get(action.file)
          if (fs)
            filesMap.set(action.file, { ...fs, progress: action.progress, status: 'uploading' })
          return { ...s, files: filesMap }
        }
        case 'SET_SUCCESS': {
          const fs = filesMap.get(action.file)
          if (fs) filesMap.set(action.file, { ...fs, progress: 100, status: 'success' })
          return { ...s, files: filesMap }
        }
        case 'SET_ERROR': {
          const fs = filesMap.get(action.file)
          if (fs) filesMap.set(action.file, { ...fs, error: action.error, status: 'error' })
          return { ...s, files: filesMap }
        }
        case 'REMOVE_FILE': {
          const cached = urlCache.get(action.file)
          if (cached) {
            URL.revokeObjectURL(cached)
            urlCache.delete(action.file)
          }
          filesMap.delete(action.file)
          propsRef.current.onValueChange?.(Array.from(filesMap.values()).map((f) => f.file))
          return { ...s, files: filesMap }
        }
        case 'SET_DRAG_OVER':
          return { ...s, dragOver: action.dragOver }
        case 'SET_INVALID':
          return { ...s, invalid: action.invalid }
        case 'CLEAR': {
          for (const file of filesMap.keys()) {
            const cached = urlCache.get(file)
            if (cached) {
              URL.revokeObjectURL(cached)
              urlCache.delete(file)
            }
          }
          filesMap.clear()
          propsRef.current.onValueChange?.([])
          return { ...s, files: filesMap, invalid: false }
        }
        default:
          return s
      }
    }

    return {
      getState: () => state,
      dispatch: (action) => {
        state = reducer(state, action)
        for (const l of listeners) l()
      },
      subscribe: (l) => {
        listeners.add(l)
        return () => listeners.delete(l)
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listeners, filesMap, invalid, propsRef, urlCache])

  const acceptTypes = React.useMemo(() => accept?.split(',').map((t) => t.trim()) ?? null, [accept])

  const onProgress = useLazyRef(() => {
    let frame = 0
    return (file: File, progress: number) => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        store.dispatch({
          type: 'SET_PROGRESS',
          file,
          progress: Math.min(Math.max(0, progress), 100),
        })
      })
    }
  }).current

  React.useEffect(() => {
    if (isControlled) {
      store.dispatch({ type: 'SET_FILES', files: value })
    } else if (defaultValue && defaultValue.length > 0 && !store.getState().files.size) {
      store.dispatch({ type: 'SET_FILES', files: defaultValue })
    }
  }, [value, defaultValue, isControlled, store])

  React.useEffect(() => {
    return () => {
      for (const file of filesMap.keys()) {
        const cached = urlCache.get(file)
        if (cached) URL.revokeObjectURL(cached)
      }
    }
  }, [filesMap, urlCache])

  const onFilesUpload = React.useCallback(
    async (files: File[]) => {
      try {
        for (const file of files) {
          store.dispatch({ type: 'SET_PROGRESS', file, progress: 0 })
        }
        if (propsRef.current.onUpload) {
          await propsRef.current.onUpload(files, {
            onProgress,
            onSuccess: (file) => store.dispatch({ type: 'SET_SUCCESS', file }),
            onError: (file, error) =>
              store.dispatch({ type: 'SET_ERROR', file, error: error.message ?? 'Upload failed' }),
          })
        } else {
          for (const file of files) {
            store.dispatch({ type: 'SET_SUCCESS', file })
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Upload failed'
        for (const file of files) {
          store.dispatch({ type: 'SET_ERROR', file, error: msg })
        }
      }
    },
    [store, propsRef, onProgress],
  )

  const onFilesChange = React.useCallback(
    (originalFiles: File[]) => {
      if (disabled) return

      let filesToProcess = [...originalFiles]
      let hasInvalid = false

      if (maxFiles) {
        const remaining = Math.max(0, maxFiles - store.getState().files.size)
        if (remaining < filesToProcess.length) {
          const rejected = filesToProcess.slice(remaining)
          hasInvalid = true
          filesToProcess = filesToProcess.slice(0, remaining)
          for (const file of rejected) {
            propsRef.current.onFileReject?.(file, `Maximum ${maxFiles} files allowed`)
          }
        }
      }

      const accepted: File[] = []
      for (const file of filesToProcess) {
        let rejected = false
        let msg = ''

        if (propsRef.current.onFileValidate) {
          const validationMsg = propsRef.current.onFileValidate(file)
          if (validationMsg) {
            msg = validationMsg
            propsRef.current.onFileReject?.(file, msg)
            rejected = true
            hasInvalid = true
          }
        }

        if (!rejected && acceptTypes) {
          const fileExt = `.${file.name.split('.').pop()}`
          if (
            !acceptTypes.some(
              (t) =>
                t === file.type ||
                t === fileExt ||
                (t.includes('/*') && file.type.startsWith(t.replace('/*', '/'))),
            )
          ) {
            propsRef.current.onFileReject?.(file, 'File type not accepted')
            rejected = true
            hasInvalid = true
          }
        }

        if (!rejected && maxSize && file.size > maxSize) {
          propsRef.current.onFileReject?.(file, 'File too large')
          rejected = true
          hasInvalid = true
        }

        if (!rejected) accepted.push(file)
      }

      if (hasInvalid) {
        store.dispatch({ type: 'SET_INVALID', invalid: true })
        setTimeout(() => store.dispatch({ type: 'SET_INVALID', invalid: false }), 2000)
      }

      if (accepted.length > 0) {
        store.dispatch({ type: 'ADD_FILES', files: accepted })
        propsRef.current.onAccept?.(accepted)
        for (const file of accepted) propsRef.current.onFileAccept?.(file)
        if (propsRef.current.onUpload) {
          requestAnimationFrame(() => onFilesUpload(accepted))
        }
      }
    },
    [store, propsRef, onFilesUpload, maxFiles, acceptTypes, maxSize, disabled],
  )

  const onInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? [])
      onFilesChange(files)
      event.target.value = ''
    },
    [onFilesChange],
  )

  const contextValue = React.useMemo<FileUploadContextValue>(
    () => ({ dropzoneId, inputId, listId, labelId, disabled, inputRef, urlCache }),
    [dropzoneId, inputId, listId, labelId, disabled, urlCache],
  )

  const RootPrimitive = asChild ? Slot : 'div'

  return (
    <StoreContext value={store}>
      <FileUploadContext value={contextValue}>
        <RootPrimitive
          data-disabled={disabled ? '' : undefined}
          data-slot="file-upload"
          {...rootProps}
          className={cn('relative flex flex-col gap-2', className)}
        >
          {children}
          <input
            type="file"
            id={inputId}
            aria-labelledby={labelId}
            aria-describedby={dropzoneId}
            ref={inputRef}
            tabIndex={-1}
            accept={accept}
            name={name}
            className="sr-only"
            disabled={disabled}
            multiple={multiple}
            required={required}
            onChange={onInputChange}
          />
          <span id={labelId} className="sr-only">
            {label ?? 'File upload'}
          </span>
        </RootPrimitive>
      </FileUploadContext>
    </StoreContext>
  )
}

// ── FileUploadDropzone ────────────────────────────────────────────────────────

interface FileUploadDropzoneProps extends React.ComponentProps<'div'> {
  asChild?: boolean
}

function FileUploadDropzone({
  asChild,
  className,
  onClick: onClickProp,
  onDragOver: onDragOverProp,
  onDragEnter: onDragEnterProp,
  onDragLeave: onDragLeaveProp,
  onDrop: onDropProp,
  onPaste: onPasteProp,
  onKeyDown: onKeyDownProp,
  ...rest
}: FileUploadDropzoneProps) {
  const context = useFileUploadContext('FileUploadDropzone')
  const store = useStoreContext('FileUploadDropzone')
  const dragOver = useStore((s) => s.dragOver)
  const invalid = useStore((s) => s.invalid)

  const propsRef = useAsRef({
    onClickProp,
    onDragOverProp,
    onDragEnterProp,
    onDragLeaveProp,
    onDropProp,
    onPasteProp,
    onKeyDownProp,
  })

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      propsRef.current.onClickProp?.(event)
      if (event.defaultPrevented) return
      const isFromTrigger =
        event.target instanceof HTMLElement &&
        event.target.closest('[data-slot="file-upload-trigger"]')
      if (!isFromTrigger) context.inputRef.current?.click()
    },
    [context.inputRef, propsRef],
  )

  const onDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current.onDragOverProp?.(event)
      if (event.defaultPrevented) return
      event.preventDefault()
      store.dispatch({ type: 'SET_DRAG_OVER', dragOver: true })
    },
    [store, propsRef],
  )

  const onDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current.onDragEnterProp?.(event)
      if (event.defaultPrevented) return
      event.preventDefault()
      store.dispatch({ type: 'SET_DRAG_OVER', dragOver: true })
    },
    [store, propsRef],
  )

  const onDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current.onDragLeaveProp?.(event)
      if (event.defaultPrevented) return
      if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))
        return
      event.preventDefault()
      store.dispatch({ type: 'SET_DRAG_OVER', dragOver: false })
    },
    [store, propsRef],
  )

  const onDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current.onDropProp?.(event)
      if (event.defaultPrevented) return
      event.preventDefault()
      store.dispatch({ type: 'SET_DRAG_OVER', dragOver: false })
      const files = Array.from(event.dataTransfer.files)
      const input = context.inputRef.current
      if (!input) return
      const dt = new DataTransfer()
      for (const file of files) dt.items.add(file)
      input.files = dt.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
    },
    [store, context.inputRef, propsRef],
  )

  const onPaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      propsRef.current.onPasteProp?.(event)
      if (event.defaultPrevented) return
      event.preventDefault()
      store.dispatch({ type: 'SET_DRAG_OVER', dragOver: false })
      const items = event.clipboardData?.items
      if (!items) return
      const files: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item?.kind === 'file') {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }
      if (files.length === 0) return
      const input = context.inputRef.current
      if (!input) return
      const dt = new DataTransfer()
      for (const file of files) dt.items.add(file)
      input.files = dt.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
    },
    [store, context.inputRef, propsRef],
  )

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      propsRef.current.onKeyDownProp?.(event)
      if (!event.defaultPrevented && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
        context.inputRef.current?.click()
      }
    },
    [context.inputRef, propsRef],
  )

  const DropzonePrimitive = asChild ? Slot : 'div'

  return (
    <DropzonePrimitive
      role="region"
      id={context.dropzoneId}
      aria-controls={`${context.inputId} ${context.listId}`}
      aria-disabled={context.disabled}
      aria-invalid={invalid}
      data-disabled={context.disabled ? '' : undefined}
      data-dragging={dragOver ? '' : undefined}
      data-invalid={invalid ? '' : undefined}
      data-slot="file-upload-dropzone"
      tabIndex={context.disabled ? undefined : 0}
      {...rest}
      className={cn(
        'relative flex select-none flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 outline-none transition-colors hover:bg-accent/30 focus-visible:border-ring/50 data-disabled:pointer-events-none data-dragging:border-primary/30 data-invalid:border-destructive data-dragging:bg-accent/30',
        className,
      )}
      onClick={onClick}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
  )
}

// ── FileUploadTrigger ─────────────────────────────────────────────────────────

interface FileUploadTriggerProps extends React.ComponentProps<'button'> {
  asChild?: boolean
}

function FileUploadTrigger({ asChild, onClick: onClickProp, ...rest }: FileUploadTriggerProps) {
  const context = useFileUploadContext('FileUploadTrigger')

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClickProp?.(event)
      if (event.defaultPrevented) return
      context.inputRef.current?.click()
    },
    [context.inputRef, onClickProp],
  )

  const TriggerPrimitive = asChild ? Slot : 'button'

  return (
    <TriggerPrimitive
      type="button"
      aria-controls={context.inputId}
      data-disabled={context.disabled ? '' : undefined}
      data-slot="file-upload-trigger"
      {...rest}
      disabled={context.disabled}
      onClick={onClick}
    />
  )
}

// ── FileUploadList ────────────────────────────────────────────────────────────

interface FileUploadListProps extends React.ComponentProps<'div'> {
  orientation?: 'horizontal' | 'vertical'
  asChild?: boolean
  forceMount?: boolean
}

function FileUploadList({
  className,
  orientation = 'vertical',
  asChild,
  forceMount,
  ...rest
}: FileUploadListProps) {
  const context = useFileUploadContext('FileUploadList')
  const fileCount = useStore((s) => s.files.size)
  const shouldRender = forceMount || fileCount > 0

  if (!shouldRender) return null

  const ListPrimitive = asChild ? Slot : 'div'

  return (
    <ListPrimitive
      role="list"
      id={context.listId}
      aria-orientation={orientation}
      data-orientation={orientation}
      data-slot="file-upload-list"
      data-state={shouldRender ? 'active' : 'inactive'}
      {...rest}
      className={cn(
        'data-[state=inactive]:fade-out-0 data-[state=active]:fade-in-0 data-[state=inactive]:slide-out-to-top-2 data-[state=active]:slide-in-from-top-2 flex flex-col gap-2 data-[state=active]:animate-in data-[state=inactive]:animate-out',
        orientation === 'horizontal' && 'flex-row overflow-x-auto p-1.5',
        className,
      )}
    />
  )
}

// ── FileUploadItem ────────────────────────────────────────────────────────────

interface FileUploadItemContextValue {
  id: string
  fileState: FileState | undefined
  nameId: string
  sizeId: string
  statusId: string
  messageId: string
}

const FileUploadItemContext = React.createContext<FileUploadItemContextValue | null>(null)

function useFileUploadItemContext(name: string): FileUploadItemContextValue {
  const ctx = React.use(FileUploadItemContext)
  if (!ctx) throw new Error(`\`${name}\` must be used within \`FileUploadItem\``)
  return ctx
}

interface FileUploadItemProps extends React.ComponentProps<'div'> {
  value: File
  asChild?: boolean
}

function FileUploadItem({ value, asChild, className, ...rest }: FileUploadItemProps) {
  const id = React.useId()
  const statusId = `${id}-status`
  const nameId = `${id}-name`
  const sizeId = `${id}-size`
  const messageId = `${id}-message`

  const context = useFileUploadContext('FileUploadItem')
  const fileState = useStore((s) => s.files.get(value))
  const fileCount = useStore((s) => s.files.size)
  const fileIndex = useStore((s) => Array.from(s.files.keys()).indexOf(value) + 1)

  const itemContext = React.useMemo(
    () => ({ id, fileState, nameId, sizeId, statusId, messageId }),
    [id, fileState, nameId, sizeId, statusId, messageId],
  )

  if (!fileState) return null

  const statusText = fileState.error
    ? `Error: ${fileState.error}`
    : fileState.status === 'uploading'
      ? `Uploading: ${fileState.progress}% complete`
      : fileState.status === 'success'
        ? 'Upload complete'
        : 'Ready to upload'

  const ItemPrimitive = asChild ? Slot : 'div'

  return (
    <FileUploadItemContext value={itemContext}>
      <ItemPrimitive
        role="listitem"
        id={id}
        aria-setsize={fileCount}
        aria-posinset={fileIndex}
        aria-describedby={`${nameId} ${sizeId} ${statusId} ${fileState.error ? messageId : ''}`}
        aria-labelledby={nameId}
        data-slot="file-upload-item"
        dir={context.disabled ? undefined : undefined}
        {...rest}
        className={cn('relative flex items-center gap-2.5 rounded-md border p-3', className)}
      >
        {rest.children}
        <span id={statusId} className="sr-only">
          {statusText}
        </span>
      </ItemPrimitive>
    </FileUploadItemContext>
  )
}

// ── FileUploadItemPreview ─────────────────────────────────────────────────────

interface FileUploadItemPreviewProps extends React.ComponentProps<'div'> {
  render?: (file: File, fallback: () => React.ReactNode) => React.ReactNode
  asChild?: boolean
}

function FileUploadItemPreview({
  render,
  asChild,
  children,
  className,
  ...rest
}: FileUploadItemPreviewProps) {
  const itemContext = useFileUploadItemContext('FileUploadItemPreview')
  const context = useFileUploadContext('FileUploadItemPreview')

  const getDefaultRender = React.useCallback(
    (file: File) => {
      if (itemContext.fileState?.file.type.startsWith('image/')) {
        let url = context.urlCache.get(file)
        if (!url) {
          url = URL.createObjectURL(file)
          context.urlCache.set(file, url)
        }
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={url} alt={file.name} className="size-full object-cover" />
      }
      return getFileIcon(file)
    },
    [itemContext.fileState?.file.type, context.urlCache],
  )

  const onPreviewRender = React.useCallback(
    (file: File) => (render ? render(file, () => getDefaultRender(file)) : getDefaultRender(file)),
    [render, getDefaultRender],
  )

  if (!itemContext.fileState) return null

  const PreviewPrimitive = asChild ? Slot : 'div'

  return (
    <PreviewPrimitive
      aria-labelledby={itemContext.nameId}
      data-slot="file-upload-preview"
      {...rest}
      className={cn(
        'relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded border bg-accent/50 [&>svg]:size-10',
        className,
      )}
    >
      {onPreviewRender(itemContext.fileState.file)}
      {children}
    </PreviewPrimitive>
  )
}

// ── FileUploadItemMetadata ────────────────────────────────────────────────────

interface FileUploadItemMetadataProps extends React.ComponentProps<'div'> {
  asChild?: boolean
  size?: 'default' | 'sm'
}

function FileUploadItemMetadata({
  asChild,
  size = 'default',
  children,
  className,
  ...rest
}: FileUploadItemMetadataProps) {
  const itemContext = useFileUploadItemContext('FileUploadItemMetadata')

  if (!itemContext.fileState) return null

  const MetaPrimitive = asChild ? Slot : 'div'

  return (
    <MetaPrimitive
      data-slot="file-upload-metadata"
      {...rest}
      className={cn('flex min-w-0 flex-1 flex-col', className)}
    >
      {children ?? (
        <>
          <span
            id={itemContext.nameId}
            className={cn(
              'truncate font-medium text-sm',
              size === 'sm' && 'font-normal text-[13px] leading-snug',
            )}
          >
            {itemContext.fileState.file.name}
          </span>
          <span
            id={itemContext.sizeId}
            className={cn(
              'truncate text-muted-foreground text-xs',
              size === 'sm' && 'text-[11px] leading-snug',
            )}
          >
            {formatBytes(itemContext.fileState.file.size)}
          </span>
          {itemContext.fileState.error && (
            <span id={itemContext.messageId} className="text-destructive text-xs">
              {itemContext.fileState.error}
            </span>
          )}
        </>
      )}
    </MetaPrimitive>
  )
}

// ── FileUploadItemProgress ────────────────────────────────────────────────────

interface FileUploadItemProgressProps extends React.ComponentProps<'div'> {
  variant?: 'linear' | 'circular' | 'fill'
  size?: number
  asChild?: boolean
  forceMount?: boolean
}

function FileUploadItemProgress({
  variant = 'linear',
  size = 40,
  asChild,
  forceMount,
  className,
  ...rest
}: FileUploadItemProgressProps) {
  const itemContext = useFileUploadItemContext('FileUploadItemProgress')

  if (!itemContext.fileState) return null

  const shouldRender = forceMount || itemContext.fileState.progress !== 100
  if (!shouldRender) return null

  const ProgressPrimitive = asChild ? Slot : 'div'

  if (variant === 'circular') {
    const circumference = 2 * Math.PI * ((size - 4) / 2)
    const strokeDashoffset = circumference - (itemContext.fileState.progress / 100) * circumference
    return (
      <ProgressPrimitive
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={itemContext.fileState.progress}
        aria-valuetext={`${itemContext.fileState.progress}%`}
        aria-labelledby={itemContext.nameId}
        data-slot="file-upload-progress"
        {...rest}
        className={cn('-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2', className)}
      >
        <svg
          className="-rotate-90 transform"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          fill="none"
          stroke="currentColor"
        >
          <circle
            className="text-primary/20"
            strokeWidth="2"
            cx={size / 2}
            cy={size / 2}
            r={(size - 4) / 2}
          />
          <circle
            className="text-primary transition-[stroke-dashoffset] duration-300 ease-linear"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            cx={size / 2}
            cy={size / 2}
            r={(size - 4) / 2}
          />
        </svg>
      </ProgressPrimitive>
    )
  }

  if (variant === 'fill') {
    return (
      <ProgressPrimitive
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={itemContext.fileState.progress}
        aria-valuetext={`${itemContext.fileState.progress}%`}
        aria-labelledby={itemContext.nameId}
        data-slot="file-upload-progress"
        {...rest}
        className={cn(
          'absolute inset-0 bg-primary/50 transition-[clip-path] duration-300 ease-linear',
          className,
        )}
        style={{ clipPath: `inset(${100 - itemContext.fileState.progress}% 0% 0% 0%)` }}
      />
    )
  }

  return (
    <ProgressPrimitive
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={itemContext.fileState.progress}
      aria-valuetext={`${itemContext.fileState.progress}%`}
      aria-labelledby={itemContext.nameId}
      data-slot="file-upload-progress"
      {...rest}
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20', className)}
    >
      <div
        className="h-full w-full flex-1 bg-primary transition-transform duration-300 ease-linear"
        style={{ transform: `translateX(-${100 - itemContext.fileState.progress}%)` }}
      />
    </ProgressPrimitive>
  )
}

// ── FileUploadItemDelete ──────────────────────────────────────────────────────

interface FileUploadItemDeleteProps extends React.ComponentProps<'button'> {
  asChild?: boolean
}

function FileUploadItemDelete({
  asChild,
  onClick: onClickProp,
  ...rest
}: FileUploadItemDeleteProps) {
  const store = useStoreContext('FileUploadItemDelete')
  const itemContext = useFileUploadItemContext('FileUploadItemDelete')

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClickProp?.(event)
      if (!itemContext.fileState || event.defaultPrevented) return
      store.dispatch({ type: 'REMOVE_FILE', file: itemContext.fileState.file })
    },
    [store, itemContext.fileState, onClickProp],
  )

  if (!itemContext.fileState) return null

  const DeletePrimitive = asChild ? Slot : 'button'

  return (
    <DeletePrimitive
      type="button"
      aria-controls={itemContext.id}
      aria-describedby={itemContext.nameId}
      data-slot="file-upload-item-delete"
      {...rest}
      onClick={onClick}
    />
  )
}

// ── FileUploadClear ───────────────────────────────────────────────────────────

interface FileUploadClearProps extends React.ComponentProps<'button'> {
  forceMount?: boolean
  asChild?: boolean
}

function FileUploadClear({
  asChild,
  forceMount,
  disabled,
  onClick: onClickProp,
  ...rest
}: FileUploadClearProps) {
  const context = useFileUploadContext('FileUploadClear')
  const store = useStoreContext('FileUploadClear')
  const fileCount = useStore((s) => s.files.size)

  const isDisabled = disabled ?? context.disabled

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClickProp?.(event)
      if (event.defaultPrevented) return
      store.dispatch({ type: 'CLEAR' })
    },
    [store, onClickProp],
  )

  const shouldRender = forceMount || fileCount > 0
  if (!shouldRender) return null

  const ClearPrimitive = asChild ? Slot : 'button'

  return (
    <ClearPrimitive
      type="button"
      aria-controls={context.listId}
      data-slot="file-upload-clear"
      data-disabled={isDisabled ? '' : undefined}
      {...rest}
      disabled={isDisabled}
      onClick={onClick}
    />
  )
}

export {
  FileUpload,
  FileUploadClear,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadItemProgress,
  FileUploadList,
  FileUploadTrigger,
  type FileUploadProps,
}
