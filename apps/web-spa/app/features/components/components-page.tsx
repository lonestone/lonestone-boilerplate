import { AppLoader } from '@boilerstone/ui/components/app'
import { EmptyState } from '@boilerstone/ui/components/app'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@boilerstone/ui/components/primitives/accordion'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from '@boilerstone/ui/components/primitives/avatar'
import { Badge } from '@boilerstone/ui/components/primitives/badge'
import { Button } from '@boilerstone/ui/components/primitives/button'
import { DatePicker } from '@boilerstone/ui/components/primitives/date-picker'
import { Checkbox } from '@boilerstone/ui/components/primitives/checkbox'
import { Input } from '@boilerstone/ui/components/primitives/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@boilerstone/ui/components/primitives/input-group'
import { Label } from '@boilerstone/ui/components/primitives/label'
import { MultiSelect } from '@boilerstone/ui/components/primitives/multi-select'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@boilerstone/ui/components/primitives/popover'
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@boilerstone/ui/components/primitives/progress'
import { RadioGroup, RadioGroupItem } from '@boilerstone/ui/components/primitives/radio-group'
import { Separator } from '@boilerstone/ui/components/primitives/separator'
import { Skeleton } from '@boilerstone/ui/components/primitives/skeleton'
import { Switch } from '@boilerstone/ui/components/primitives/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@boilerstone/ui/components/primitives/table'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@boilerstone/ui/components/primitives/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@boilerstone/ui/components/primitives/tooltip'
import { cn } from '@boilerstone/ui/lib/utils'
import {
  Bell,
  Check,
  ChevronRight,
  Code2,
  FileText,
  Globe,
  Grid3X3,
  Inbox,
  Mail,
  PlusCircle,
  Search,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/* ─── Section wrapper ──────────────────────────────────────────────────────── */
function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  id: string
  eyebrow: string
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="mb-6 border-b border-border pb-4">
        <p className="mb-0.5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <h2 className="font-sans text-2xl font-black tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className={cn('space-y-4', className)}>{children}</div>
    </section>
  )
}

/* ─── Demo block ────────────────────────────────────────────────────────────── */
function DemoBlock({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="border-b border-border bg-muted/40 px-4 py-2">
        <span className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          {label}
        </span>
      </div>
      <div className={cn('flex flex-wrap items-center gap-3 p-6 bg-background', className)}>
        {children}
      </div>
    </div>
  )
}

/* ─── TOC sidebar item ──────────────────────────────────────────────────────── */
const SECTIONS = [
  { id: 'buttons', label: 'Buttons' },
  { id: 'badges', label: 'Badges' },
  { id: 'inputs', label: 'Inputs' },
  { id: 'controls', label: 'Controls' },
  { id: 'display', label: 'Display' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'data', label: 'Data table' },
  { id: 'overlays', label: 'Overlays' },
] as const

/* ──────────────────────────────────────────────────────────────────────────── */

export default function ComponentsPage() {
  const { t } = useTranslation()
  const [checkboxState, setCheckboxState] = useState<boolean | 'indeterminate'>(false)
  const [switchState, setSwitchState] = useState(false)
  const [radioValue, setRadioValue] = useState('option1')
  const [multiSelectValues, setMultiSelectValues] = useState<string[]>([])
  const [loaderVisible, setLoaderVisible] = useState(false)

  const tableData = [
    { name: 'Button', category: 'Action', status: 'Stable', version: '1.0' },
    { name: 'Badge', category: 'Display', status: 'Stable', version: '1.0' },
    { name: 'Input', category: 'Form', status: 'Stable', version: '1.0' },
    { name: 'Sidebar', category: 'Layout', status: 'Stable', version: '1.0' },
    { name: 'DataTable', category: 'Data', status: 'Beta', version: '0.9' },
  ]

  return (
    <TooltipProvider>
      <div className="flex gap-8">
        {/* Sticky TOC */}
        <aside className="hidden xl:block w-44 shrink-0">
          <nav className="sticky top-6 space-y-1">
            <p className="mb-3 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Sections
            </p>
            {SECTIONS.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-12">
          {/* Page header */}
          <div className="relative overflow-hidden rounded-lg border border-border bg-card p-8">
            <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1">
                <Grid3X3 className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
                  {t('components.subtitle')}
                </span>
              </div>
              <h1 className="mb-2 font-sans text-4xl font-black tracking-tight text-foreground md:text-5xl">
                {t('components.title')}
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground">
                {t('components.description')}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1.5">
                  <Code2 className="h-3 w-3" />
                  Base UI
                </Badge>
                <Badge variant="outline" className="gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  Radix Nova
                </Badge>
                <Badge variant="outline" className="gap-1.5">
                  <Zap className="h-3 w-3" />
                  Tailwind v4
                </Badge>
              </div>
            </div>
          </div>

          {/* ── Buttons ─────────────────────────────────────────────────── */}
          <Section
            id="buttons"
            eyebrow="01"
            title={t('components.sections.buttons')}
            description="All variants and sizes. Use render prop for link composition."
          >
            <DemoBlock label="Variants">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </DemoBlock>

            <DemoBlock label="Sizes">
              <Button size="lg">Large</Button>
              <Button size="default">Default</Button>
              <Button size="sm">Small</Button>
              <Button size="xs">X-Small</Button>
              <Button size="icon">
                <PlusCircle />
              </Button>
              <Button size="icon-sm">
                <Search />
              </Button>
              <Button variant="outline" disabled>Disabled</Button>
            </DemoBlock>

            <DemoBlock label="With icons">
              <Button>
                <Mail className="h-4 w-4" />
                Send email
              </Button>
              <Button variant="outline">
                <Star className="h-4 w-4" />
                Favourite
              </Button>
              <Button variant="secondary">
                Save changes
                <ChevronRight className="h-4 w-4" />
              </Button>
            </DemoBlock>
          </Section>

          {/* ── Badges ──────────────────────────────────────────────────── */}
          <Section
            id="badges"
            eyebrow="02"
            title={t('components.sections.badges')}
          >
            <DemoBlock label="Variants">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="ghost">Ghost</Badge>
            </DemoBlock>

            <DemoBlock label="With icons">
              <Badge>
                <Check className="h-3 w-3" />
                Published
              </Badge>
              <Badge variant="secondary">
                <Globe className="h-3 w-3" />
                Global
              </Badge>
              <Badge variant="outline">
                <Tag className="h-3 w-3" />
                TypeScript
              </Badge>
              <Badge variant="destructive">
                <Bell className="h-3 w-3" />
                Alert
              </Badge>
            </DemoBlock>
          </Section>

          {/* ── Inputs ──────────────────────────────────────────────────── */}
          <Section
            id="inputs"
            eyebrow="03"
            title={t('components.sections.inputs')}
          >
            <DemoBlock label="Input variants" className="grid grid-cols-1 gap-4 sm:grid-cols-2 w-full">
              <div className="space-y-1.5">
                <Label htmlFor="demo-input">Default</Label>
                <Input id="demo-input" placeholder="Enter value..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-input-disabled">Disabled</Label>
                <Input id="demo-input-disabled" placeholder="Disabled..." disabled />
              </div>
            </DemoBlock>

            <DemoBlock label="InputGroup" className="grid grid-cols-1 gap-4 sm:grid-cols-2 w-full">
              <div className="space-y-1.5 w-full">
                <Label>With icon prefix</Label>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput placeholder="Search..." />
                </InputGroup>
              </div>
              <div className="space-y-1.5 w-full">
                <Label>With text suffix</Label>
                <InputGroup>
                  <InputGroupInput placeholder="0.00" />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>USD</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </div>
            </DemoBlock>

            <DemoBlock label="Date picker" className="grid grid-cols-1 gap-4 sm:grid-cols-2 w-full">
              <div className="space-y-1.5 w-full">
                <Label>Pick a date</Label>
                <DatePicker placeholder="Select date..." />
              </div>
              <div className="space-y-1.5 w-full">
                <Label>Multi-select</Label>
                <MultiSelect
                  options={[
                    { label: 'TypeScript', value: 'ts' },
                    { label: 'React', value: 'react' },
                    { label: 'Tailwind', value: 'tw' },
                    { label: 'NestJS', value: 'nest' },
                    { label: 'MikroORM', value: 'orm' },
                  ]}
                  values={multiSelectValues}
                  onChange={setMultiSelectValues}
                  placeholder="Select technologies..."
                />
              </div>
            </DemoBlock>
          </Section>

          {/* ── Controls ────────────────────────────────────────────────── */}
          <Section
            id="controls"
            eyebrow="04"
            title={t('components.sections.controls')}
          >
            <DemoBlock label="Checkbox">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="demo-cb1"
                  checked={checkboxState === true}
                  onCheckedChange={v => setCheckboxState(v)}
                />
                <Label htmlFor="demo-cb1">Accept terms</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="demo-cb2" defaultChecked />
                <Label htmlFor="demo-cb2">Checked by default</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="demo-cb3" disabled />
                <Label htmlFor="demo-cb3" className="opacity-50">Disabled</Label>
              </div>
            </DemoBlock>

            <DemoBlock label="Radio group">
              <RadioGroup
                value={radioValue}
                onValueChange={setRadioValue}
                className="flex flex-row gap-6"
              >
                {['option1', 'option2', 'option3'].map(opt => (
                  <div key={opt} className="flex items-center gap-2">
                    <RadioGroupItem value={opt} id={`radio-${opt}`} />
                    <Label htmlFor={`radio-${opt}`} className="capitalize">{opt}</Label>
                  </div>
                ))}
              </RadioGroup>
            </DemoBlock>

            <DemoBlock label="Switch">
              <div className="flex items-center gap-2">
                <Switch
                  id="demo-switch"
                  checked={switchState}
                  onCheckedChange={setSwitchState}
                />
                <Label htmlFor="demo-switch">
                  {switchState ? 'On' : 'Off'}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="demo-switch-sm" size="sm" defaultChecked />
                <Label htmlFor="demo-switch-sm">Small, checked</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="demo-switch-d" disabled />
                <Label htmlFor="demo-switch-d" className="opacity-50">Disabled</Label>
              </div>
            </DemoBlock>
          </Section>

          {/* ── Display (Tabs, Accordion, Avatar, Progress, Skeleton) ───── */}
          <Section
            id="display"
            eyebrow="05"
            title={t('components.sections.layout')}
          >
            <DemoBlock label="Tabs — default">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <div className="rounded-md border border-border p-4 mt-2 text-sm text-muted-foreground">
                    Overview content goes here.
                  </div>
                </TabsContent>
                <TabsContent value="analytics">
                  <div className="rounded-md border border-border p-4 mt-2 text-sm text-muted-foreground">
                    Analytics content goes here.
                  </div>
                </TabsContent>
                <TabsContent value="settings">
                  <div className="rounded-md border border-border p-4 mt-2 text-sm text-muted-foreground">
                    Settings content goes here.
                  </div>
                </TabsContent>
              </Tabs>
            </DemoBlock>

            <DemoBlock label="Tabs — line variant">
              <Tabs defaultValue="tab1" className="w-full">
                <TabsList variant="line">
                  <TabsTrigger value="tab1">All</TabsTrigger>
                  <TabsTrigger value="tab2">Published</TabsTrigger>
                  <TabsTrigger value="tab3">Drafts</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1" className="mt-2 text-sm text-muted-foreground">All posts</TabsContent>
                <TabsContent value="tab2" className="mt-2 text-sm text-muted-foreground">Published posts</TabsContent>
                <TabsContent value="tab3" className="mt-2 text-sm text-muted-foreground">Draft posts</TabsContent>
              </Tabs>
            </DemoBlock>

            <DemoBlock label="Accordion">
              <Accordion className="w-full border border-border rounded-lg px-4">
                {[
                  { value: 'q1', trigger: 'What is the Lonestone boilerplate?', content: 'A production-ready monorepo template with NestJS, React, and a curated component library.' },
                  { value: 'q2', trigger: 'Which UI components are included?', content: 'Buttons, Badges, Inputs, Tables, Sidebars, Data tables, and many more — all built on Base UI and Tailwind v4.' },
                  { value: 'q3', trigger: 'How is authentication handled?', content: 'Via Better Auth — a lightweight, fully-typed auth library with session management and email verification.' },
                ].map(item => (
                  <AccordionItem key={item.value} value={item.value}>
                    <AccordionTrigger>{item.trigger}</AccordionTrigger>
                    <AccordionContent>{item.content}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </DemoBlock>

            <DemoBlock label="Avatar">
              <Avatar>
                <AvatarImage src="https://i.pravatar.cc/150?img=3" />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <Avatar size="lg">
                <AvatarFallback>AB</AvatarFallback>
              </Avatar>
              <Avatar size="sm">
                <AvatarFallback>CD</AvatarFallback>
              </Avatar>
              <AvatarGroup>
                {['JD', 'AB', 'EF', 'GH'].map(initials => (
                  <Avatar key={initials}>
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                ))}
                <AvatarGroupCount>+5</AvatarGroupCount>
              </AvatarGroup>
            </DemoBlock>

            <DemoBlock label="Progress" className="flex-col items-stretch">
              {[25, 50, 75, 100].map(v => (
                <Progress key={v} value={v}>
                  <ProgressLabel>
                    {v === 25 ? 'Getting started' : v === 50 ? 'Halfway there' : v === 75 ? 'Almost done' : 'Complete'}
                  </ProgressLabel>
                  <ProgressValue />
                </Progress>
              ))}
            </DemoBlock>

            <DemoBlock label="Skeleton">
              <div className="flex items-center gap-3 w-full">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </DemoBlock>
          </Section>

          {/* ── Feedback (EmptyState, AppLoader) ────────────────────────── */}
          <Section
            id="feedback"
            eyebrow="06"
            title={t('components.sections.feedback')}
          >
            <DemoBlock label="EmptyState">
              <div className="w-full">
                <EmptyState
                  icon={<Inbox className="size-6 text-muted-foreground" />}
                  title="No notifications yet"
                  description="When you receive notifications, they will appear here."
                  action={{ label: 'Explore dashboard', onClick: () => {} }}
                  className="border border-dashed border-border rounded-lg"
                />
              </div>
            </DemoBlock>

            <DemoBlock label="AppLoader — animated dots">
              <div className="flex flex-col items-center gap-4 w-full">
                <p className="text-sm text-muted-foreground">
                  The AppLoader is used as a full-screen Suspense fallback. Preview:
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setLoaderVisible(true)
                    setTimeout(() => setLoaderVisible(false), 2000)
                  }}
                >
                  <TrendingUp className="h-4 w-4" />
                  Show for 2 seconds
                </Button>
              </div>
              {loaderVisible && <AppLoader />}
            </DemoBlock>
          </Section>

          {/* ── Data table ──────────────────────────────────────────────── */}
          <Section
            id="data"
            eyebrow="07"
            title={t('components.sections.dataDisplay')}
            description="Static table built from primitives. For sortable/filterable tables use DataTableContent from @boilerstone/ui."
          >
            <div className="border border-border rounded-lg overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Version</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map(row => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{row.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.status === 'Stable' ? 'default' : 'secondary'} className="text-[10px]">
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.version}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Section>

          {/* ── Overlays (Tooltip, Popover, Separator) ──────────────────── */}
          <Section
            id="overlays"
            eyebrow="08"
            title={t('components.sections.overlays')}
          >
            <DemoBlock label="Tooltip">
              <Tooltip>
                <TooltipTrigger>
                  <Button variant="outline">
                    <Bell className="h-4 w-4" />
                    Hover me
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Notifications — coming soon</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger>
                  <Button variant="outline" size="icon">
                    <User className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">View profile</TooltipContent>
              </Tooltip>
            </DemoBlock>

            <DemoBlock label="Popover">
              <Popover>
                <PopoverTrigger
                  render={<Button variant="outline" />}
                >
                  <FileText className="h-4 w-4" />
                  Open popover
                </PopoverTrigger>
                <PopoverContent>
                  <PopoverHeader>
                    <PopoverTitle>More information</PopoverTitle>
                  </PopoverHeader>
                  <p className="text-sm text-muted-foreground">
                    Popovers are great for contextual actions and supplementary content without navigating away.
                  </p>
                </PopoverContent>
              </Popover>
            </DemoBlock>

            <DemoBlock label="Separator">
              <div className="flex items-center gap-4 w-full">
                <span className="text-sm text-muted-foreground">Left</span>
                <Separator className="flex-1" />
                <span className="text-sm text-muted-foreground">Right</span>
              </div>
              <div className="flex h-12 items-center gap-4">
                <span className="text-sm text-muted-foreground">Top</span>
                <Separator orientation="vertical" />
                <span className="text-sm text-muted-foreground">Bottom</span>
              </div>
            </DemoBlock>
          </Section>
        </div>
      </div>
    </TooltipProvider>
  )
}
