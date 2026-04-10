<script lang="ts">
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  const quickActions = [
    {
      href: '/tx/categorize',
      title: 'Categorize transactions',
      description: 'Process the screening queue month by month and assign categories quickly.',
      icon: icons.DocumentMagnifyingGlass,
      tone: 'primary'
    },
    {
      href: '/blik/upload',
      title: 'Upload BLIK file',
      description: 'Start a fresh import flow and move directly into preview and matching.',
      icon: icons.InboxArrowDown,
      tone: 'secondary'
    },
    {
      href: '/tools/citi',
      title: 'Open Citi import',
      description: 'Upload Citi TXT, inspect parsed preview and download ZIP with CSV exports.',
      icon: icons.DocumentArrowUp,
      tone: 'success'
    },
    {
      href: '/allegro/accounts',
      title: 'Review Allegro accounts',
      description: 'Open configured marketplace accounts and jump into payments or matches.',
      icon: icons.BuildingStorefront,
      tone: 'warning'
    },
    {
      href: '#',
      title: 'Amazon sync',
      description: 'Planned workspace for future Amazon import, matching and reconciliation flows.',
      icon: icons.GlobeAlt,
      tone: 'success',
      badge: 'TBD'
    }
  ] as const;

  const workspaceSections = [
    {
      title: 'Transactions',
      description: 'Categorization and statistics for the monthly screening workflow.',
      hrefs: [
        { label: 'Categorize', href: '/tx/categorize' },
        { label: 'Stats', href: '/tx/stats' }
      ],
      icon: icons.ShoppingBag,
      tone: 'primary'
    },
    {
      title: 'BLIK Sync',
      description: 'File upload, preview, match flow and sync statistics in one area.',
      hrefs: [
        { label: 'Upload', href: '/blik/upload' },
        { label: 'Preview', href: '/blik/file' },
        { label: 'Stats', href: '/blik/stats' }
      ],
      icon: icons.DocumentCurrencyEuro,
      tone: 'secondary'
    },
    {
      title: 'Allegro',
      description: 'Marketplace accounts, imported payments, matching decisions and stats.',
      hrefs: [
        { label: 'Accounts', href: '/allegro/accounts' },
        { label: 'Stats', href: '/allegro/stats' }
      ],
      icon: icons.ChartBar,
      tone: 'warning'
    },
    {
      title: 'Import Tools',
      description:
        'Focused import flows for bank and file-based sources that need preview and export.',
      hrefs: [
        { label: 'Citi Import', href: '/tools/citi' },
        { label: 'Citi Preview', href: '/tools/citi/preview' }
      ],
      icon: icons.ArchiveBoxArrowDown,
      tone: 'success'
    },
    {
      title: 'Settings',
      description: 'Configuration entry points for integration secrets and application setup.',
      hrefs: [{ label: 'Secrets', href: '/settings/secrets' }],
      icon: icons.Key,
      tone: 'success'
    }
  ] as const;

  function toneClass(tone: string) {
    if (tone === 'secondary') return 'bg-secondary/12 text-secondary';
    if (tone === 'warning') return 'bg-warning/15 text-warning';
    if (tone === 'success') return 'bg-success/15 text-success';
    return 'bg-primary/12 text-primary';
  }
</script>

<svelte:head>
  <title>Firefly Toolkit</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-6">
  <section class="card bg-base-100 border-base-200 overflow-hidden border shadow-xl">
    <div
      class="from-primary/10 via-base-100 to-base-100 grid gap-5 bg-gradient-to-br px-6 py-6 lg:grid-cols-[1.25fr_0.75fr] lg:px-8"
    >
      <div class="flex items-start gap-4">
        <div class="bg-primary/12 text-primary rounded-3xl p-4">
          <Icon src={icons.Squares2x2} class="h-8 w-8" />
        </div>

        <div class="space-y-2">
          <div
            class="bg-base-200/80 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium tracking-[0.24em] uppercase"
          >
            <span class="bg-success h-2 w-2 rounded-full"></span>
            Workspace overview
          </div>
          <div>
            <h2 class="text-3xl font-semibold tracking-tight">Firefly Toolkit</h2>
            <p class="text-base-content/70 mt-2 max-w-2xl text-sm sm:text-base">
              Central place for transaction screening, import workflows, marketplace matching and
              day-to-day admin operations.
            </p>
          </div>
        </div>
      </div>

      <div
        class="bg-base-100/80 ring-base-200 flex flex-col justify-between gap-4 rounded-3xl p-5 shadow-sm ring-1"
      >
        <div>
          <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">
            Recommended next step
          </div>
          <p class="mt-2 text-sm">
            Start with the transaction screening queue or jump into a sync workflow that needs
            attention today.
          </p>
        </div>

        <div class="flex flex-wrap justify-end gap-3">
          <a href="/tx/categorize" class="btn btn-primary">
            <Icon src={icons.DocumentMagnifyingGlass} class="h-5 w-5" />
            Open screening
          </a>
        </div>
      </div>
    </div>
  </section>

  <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    {#each quickActions as action}
      <a
        href={action.href}
        class="card bg-base-100 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-xl"
        aria-disabled={action.href === '#' ? 'true' : undefined}
      >
        <div class="card-body">
          <div class="flex items-start justify-between gap-3">
            <div class={`w-fit rounded-2xl p-3 ${toneClass(action.tone)}`}>
              <Icon src={action.icon} class="h-5 w-5" />
            </div>
            {#if 'badge' in action}
              <span class="badge badge-outline badge-sm">{action.badge}</span>
            {/if}
          </div>
          <h3 class="mt-3 text-lg font-semibold">{action.title}</h3>
          <p class="text-base-content/65 text-sm">{action.description}</p>
          <div class="text-primary mt-4 inline-flex items-center gap-2 text-sm font-medium">
            {'badge' in action ? 'Coming soon' : 'Open'}
            <Icon src={'badge' in action ? icons.Clock : icons.ArrowRight} class="h-4 w-4" />
          </div>
        </div>
      </a>
    {/each}
  </section>

  <section class="card bg-base-100 shadow-xl">
    <div class="card-body gap-5">
      <div>
        <h3 class="text-xl font-semibold">Workspace areas</h3>
        <p class="text-base-content/70 mt-1 text-sm">
          Use these sections as stable entry points into the main operational flows.
        </p>
      </div>

      <div class="divider my-0"></div>

      <div class="grid gap-4 lg:grid-cols-2">
        {#each workspaceSections as section}
          <article
            class="from-base-100 to-base-200/60 rounded-[1.75rem] bg-gradient-to-br p-[1px] shadow-sm"
          >
            <div class="bg-base-100 rounded-[calc(1.75rem-1px)] p-5">
              <div class="flex items-start gap-4">
                <div class={`rounded-2xl p-3 ${toneClass(section.tone)}`}>
                  <Icon src={section.icon} class="h-5 w-5" />
                </div>
                <div class="min-w-0">
                  <h4 class="text-lg font-semibold">{section.title}</h4>
                  <p class="text-base-content/65 mt-2 text-sm">{section.description}</p>
                </div>
              </div>

              <div class="mt-5 flex flex-wrap gap-2">
                {#each section.hrefs as link}
                  <a href={link.href} class="btn btn-ghost btn-sm">
                    {link.label}
                  </a>
                {/each}
              </div>
            </div>
          </article>
        {/each}
      </div>
    </div>
  </section>
</div>
